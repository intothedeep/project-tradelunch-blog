// controllers/securities/byTicker.ts
// Purpose: Read-only per-ticker detail (Phase P, STEP 2 / P9 — extended).
//   Axis 1 — weekly market-cap ranking history (market_rankings, scope='global').
//   Axis 2 — institutional 13F holders at the ticker's latest filing period
//             (v_sec_holdings_enriched + fund_registry; Δweight/isNew derived from
//             sec_holdings aggregates, NOT v_sec_position_delta — see Query B).
//   Axis 3 — daily price sparkline from market_history (tracked universe only).
//   Axis 4 — politician trading activity over 90-day disclosure window
//             (v_politician_activity, migration 0022; presence-guarded).
// Invariants:
//   - Ticker validated by regex before any DB hit.
//   - Presence guard: absent views/tables → data:null, not 500.
//   - Unknown ticker (no rows in any source) → data:null.
//   - BIGINT value_usd → Number in DTO (fund position values < 2^53 — safe,
//     unlike the post-id BIGINT case which IS > 2^53 in production).
//   - CUSIP unresolved (no security_map row) → weight/delta null, isNew false.
//   - market_history absent/empty → priceHistory: [].
//   - v_politician_activity absent → politicianActivity: null (regression 0).
// Constraints: raw SQL, no ORM, no side effects beyond pool reads.

import { pool } from '../../database';
import { Router } from 'express';
import { getHolderWeights } from '../../helpers/holderWeights';
import {
    fetchPoliticianActivity,
    type PoliticianActivityDto,
} from '../../helpers/politicianActivity';

export const router = Router();

const FUNDS_CACHE_CONTROL =
    'public, s-maxage=86400, stale-while-revalidate=604800';

// Ticker: 1–12 chars, letters/digits/dot/hyphen (e.g. BRK-B, BRK.B, SPY).
const TICKER_RE = /^[A-Za-z0-9.\-]{1,12}$/;

// --- Presence probe ---

interface IRawPresence {
    has_holdings: boolean;
    has_rankings: boolean;
    has_market_history: boolean;
    has_politician_activity: boolean;
}

async function probePresence(): Promise<{
    hasHoldings: boolean;
    hasRankings: boolean;
    hasMarketHistory: boolean;
    hasPoliticianActivity: boolean;
}> {
    const { rows } = await pool.query<IRawPresence>(
        `SELECT to_regclass('public.v_sec_holdings_enriched')   IS NOT NULL AS has_holdings,
                to_regclass('public.market_rankings')            IS NOT NULL AS has_rankings,
                to_regclass('public.market_history')             IS NOT NULL AS has_market_history,
                to_regclass('public.v_politician_activity')      IS NOT NULL AS has_politician_activity`
    );
    return {
        hasHoldings:             rows[0]?.has_holdings              ?? false,
        hasRankings:             rows[0]?.has_rankings              ?? false,
        hasMarketHistory:        rows[0]?.has_market_history        ?? false,
        hasPoliticianActivity:   rows[0]?.has_politician_activity   ?? false,
    };
}

// --- DB row shapes (only columns we SELECT) ---

interface IRankingRow {
    as_of: Date | string;
    scope: string;
    rank: number;
    market_cap: string | null;
}

interface IHolderRow {
    cik: string;
    label: string;
    is_active_manager: boolean;
    value_usd: string;
    period_of_report: Date | string;
    sector: string | null;
    cusip: string | null;
}

interface IPriceRow {
    bar_time: Date | string;
    close: string;
}

// --- Pure helpers ---

function toIsoDate(d: Date | string): string {
    return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

function numOrNull(v: string | null): number | null {
    return v === null ? null : Number(v);
}

/**
 * @api {get} /v1/api/securities/:ticker/by-ticker Per-ticker detail
 * @apiSuccess {Object|null} data  { ticker, sector, rankingHistory[], holders[],
 *                                   periodOfReport, priceHistory[],
 *                                   politicianActivity }
 *                                  or null when ticker invalid/unknown or tables absent.
 */
router.get('/:ticker/by-ticker', async (req, res) => {
    try {
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        const ticker = req.params.ticker;
        if (!TICKER_RE.test(ticker)) {
            return res.json({ success: true, data: null });
        }

        const { hasHoldings, hasRankings, hasMarketHistory, hasPoliticianActivity } =
            await probePresence();

        // Query A — ranking history (global scope, desc, up to 52 weeks = ~1 year).
        const rankingHistory: Array<{
            asOf: string;
            scope: string;
            rank: number;
            marketCap: number | null;
        }> = [];
        if (hasRankings) {
            const { rows: rRows } = await pool.query<IRankingRow>(
                `SELECT as_of, scope, rank, market_cap
                   FROM market_rankings
                  WHERE symbol = $1 AND scope = 'global'
                  ORDER BY as_of DESC
                  LIMIT 52`,
                [ticker]
            );
            rRows.forEach((r) =>
                rankingHistory.push({
                    asOf: toIsoDate(r.as_of),
                    scope: r.scope,
                    rank: r.rank,
                    marketCap: numOrNull(r.market_cap),
                })
            );
        }

        // Query B — holders at the ticker's latest 13F period.
        // sector is sourced from v_sec_holdings_enriched (COALESCE(symbol_fundamentals, security_map)).
        // weight/delta/isNew are derived below from sec_holdings aggregates (see note).
        let holders: Array<{
            cik: string;
            label: string;
            isActiveManager: boolean;
            valueUsd: number;
            weightPct: number | null;
            deltaWeightPct: number | null;
            isNew: boolean;
        }> = [];
        let periodOfReport: string | null = null;
        let sector: string | null = null;
        if (hasHoldings) {
            // Holders at the ticker's latest 13F period (enriched view → sector +
            // fund_registry). Δweight/isNew are derived separately from sec_holdings
            // aggregates below — never via v_sec_position_delta, which recomputes
            // every fund's whole portfolio across all quarters (~1.2s).
            const { rows: hRows } = await pool.query<IHolderRow>(
                `WITH latest AS (
                    SELECT MAX(h.period_of_report) AS period
                    FROM v_sec_holdings_enriched h
                    WHERE h.mapped_ticker = $1
                )
                SELECT h.cik, r.label, r.is_active_manager,
                       h.value_usd, h.period_of_report, h.sector, h.cusip
                  FROM v_sec_holdings_enriched h
                  JOIN fund_registry r ON r.cik = h.cik AND r.deleted_at IS NULL
                  JOIN latest l ON h.period_of_report = l.period
                 WHERE h.mapped_ticker = $1
                 ORDER BY h.value_usd DESC`,
                [ticker]
            );
            if (hRows.length > 0) {
                periodOfReport = toIsoDate(hRows[0].period_of_report);
                sector = hRows[0].sector ?? null;
                const ciks = [...new Set(hRows.map((h) => h.cik))];

                // weight_pct / delta_weight_pct / isNew derived from sec_holdings
                // aggregates (helpers/holderWeights), NOT v_sec_position_delta.
                const weightByCik = await getHolderWeights(
                    ticker,
                    ciks,
                    hRows[0].period_of_report
                );

                holders = hRows.map((h) => {
                    const w = weightByCik.get(h.cik);
                    return {
                        cik: h.cik,
                        label: h.label,
                        isActiveManager: h.is_active_manager,
                        valueUsd: Number(h.value_usd),
                        weightPct: w?.weightPct ?? null,
                        deltaWeightPct: w?.deltaWeightPct ?? null,
                        isNew: w?.isNew ?? false,
                    };
                });
            }
        }

        // Query C — price sparkline (tracked universe only).
        // Fetch DESC then reverse to return ascending bar_time for the client.
        let priceHistory: Array<{ t: string; close: number }> = [];
        if (hasMarketHistory) {
            const { rows: pRows } = await pool.query<IPriceRow>(
                `SELECT bar_time, close
                   FROM market_history
                  WHERE label = $1 AND interval = '1d'
                  ORDER BY bar_time DESC
                  LIMIT 260`,
                [ticker]
            );
            if (pRows.length > 0) {
                priceHistory = pRows
                    .reverse()
                    .map((p) => ({ t: toIsoDate(p.bar_time), close: Number(p.close) }));
            }
        }

        // Query D — politician activity (90-day window, migration 0022).
        // fetchPoliticianActivity short-circuits to null when view is absent.
        const politicianActivity: PoliticianActivityDto | null =
            await fetchPoliticianActivity(ticker, hasPoliticianActivity);

        // Unknown ticker: no data in any source.
        if (
            rankingHistory.length === 0 &&
            holders.length === 0 &&
            priceHistory.length === 0 &&
            politicianActivity === null
        ) {
            return res.json({ success: true, data: null });
        }

        return res.json({
            success: true,
            data: {
                ticker,
                sector,
                rankingHistory,
                holders,
                periodOfReport,
                priceHistory,
                politicianActivity,
            },
        });
    } catch {
        // Degrade to null — never leak a 500 for a read-only endpoint.
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        return res.json({ success: true, data: null });
    }
});
