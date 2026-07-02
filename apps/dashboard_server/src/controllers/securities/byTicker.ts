// controllers/securities/byTicker.ts
// Purpose: Read-only per-ticker detail (Phase P, STEP 2 / P9).
//   Axis 1 — weekly market-cap ranking history (market_rankings, scope='global').
//   Axis 2 — institutional 13F holders at the ticker's latest filing period
//             (v_sec_holdings_enriched + fund_registry).
// Invariants:
//   - Ticker validated by regex before any DB hit.
//   - Presence guard: absent views/tables → data:null, not 500.
//   - Unknown ticker (no rows in either source) → data:null.
//   - BIGINT value_usd → Number in DTO (fund position values < 2^53 — safe,
//     unlike the post-id BIGINT case which IS > 2^53 in production).
// Constraints: raw SQL, no ORM, no side effects beyond pool reads.

import { pool } from '../../database';
import { Router } from 'express';

export const router = Router();

const FUNDS_CACHE_CONTROL =
    'public, s-maxage=86400, stale-while-revalidate=604800';

// Ticker: 1–12 chars, letters/digits/dot/hyphen (e.g. BRK-B, BRK.B, SPY).
const TICKER_RE = /^[A-Za-z0-9.\-]{1,12}$/;

// --- Presence probe ---

interface IRawPresence {
    has_holdings: boolean;
    has_rankings: boolean;
}

async function probePresence(): Promise<{
    hasHoldings: boolean;
    hasRankings: boolean;
}> {
    const { rows } = await pool.query<IRawPresence>(
        `SELECT to_regclass('public.v_sec_holdings_enriched') IS NOT NULL AS has_holdings,
                to_regclass('public.market_rankings')          IS NOT NULL AS has_rankings`
    );
    return {
        hasHoldings: rows[0]?.has_holdings ?? false,
        hasRankings: rows[0]?.has_rankings ?? false,
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
 * @apiSuccess {Object|null} data  { ticker, sector, rankingHistory[], holders[], periodOfReport }
 *                                  or null when ticker invalid/unknown or tables absent.
 */
router.get('/:ticker/by-ticker', async (req, res) => {
    try {
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        const ticker = req.params.ticker;
        if (!TICKER_RE.test(ticker)) {
            return res.json({ success: true, data: null });
        }

        const { hasHoldings, hasRankings } = await probePresence();

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
        let holders: Array<{
            cik: string;
            label: string;
            isActiveManager: boolean;
            valueUsd: number;
        }> = [];
        let periodOfReport: string | null = null;
        let sector: string | null = null;
        if (hasHoldings) {
            const { rows: hRows } = await pool.query<IHolderRow>(
                `WITH latest AS (
                    SELECT MAX(h.period_of_report) AS period
                    FROM v_sec_holdings_enriched h
                    WHERE h.mapped_ticker = $1
                )
                SELECT h.cik, r.label, r.is_active_manager,
                       h.value_usd, h.period_of_report, h.sector
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
                holders = hRows.map((h) => ({
                    cik: h.cik,
                    label: h.label,
                    isActiveManager: h.is_active_manager,
                    valueUsd: Number(h.value_usd),
                }));
            }
        }

        // Unknown ticker: no data in either source.
        if (rankingHistory.length === 0 && holders.length === 0) {
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
            },
        });
    } catch {
        // Degrade to null — never leak a 500 for a read-only endpoint.
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        return res.json({ success: true, data: null });
    }
});
