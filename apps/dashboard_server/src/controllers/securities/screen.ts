// controllers/securities/screen.ts
// Purpose: 13F consensus candidate screener (Phase P, STEP 3 / P10).
//          Returns securities held by >= minActiveHolders active fund managers,
//          ranked by composite score (consensus strength + cap tier).
// Invariants:
//   - Presence guard: v_sec_consensus absent → data:null, not 500.
//   - Uses the single latest period_of_report across all securities in v_sec_consensus.
//   - LEFT JOIN security_map: ticker is NULL when CUSIP not yet resolved (0019 not seeded).
//   - LEFT JOIN LATERAL: most-recent global market_rankings row by ticker.
//   - Score computed in Node via computeScore() — deterministic, testable without DB.
//   - momentum (0.3) + lowVol (0.1): computed from market_history '1d' closes joined
//     by resolved ticker, cross-sectionally percentile-normalised across the candidate
//     set (helpers/priceSignals.ts). Candidates outside the tracked universe (no bars,
//     or < ~1yr history) keep null terms — the partial-score contract in screenScore.ts.
//   - Sort (compareScreenCandidates): price-signal-complete tier first, then
//     score DESC, then holderCountActive DESC; slice to limit. Each candidate
//     carries hasPriceSignals so the client can render the two data-availability
//     tiers without re-deriving it. (PM+architect decision 2026-07-02.)
// DEFERRED:
//   - filing_date lookahead: v_sec_consensus is period-based. A production signal
//     must gate on sec_filings.filing_date so the screener only runs after all funds
//     have filed for the period. Not yet implemented. (Live price momentum "as of now"
//     is current market data, not lookahead — the gap is the 13F period vs filing_date.)
// Constraints: raw SQL only, parameterized, no ORM, no side effects beyond pool reads.

import { pool } from '../../database';
import { Router } from 'express';
import { computeScore } from '../../helpers/screenScore';
import {
    compareScreenCandidates,
    hasPriceSignals,
} from '../../helpers/screenSort';
import {
    computeRawMomentum,
    computeAnnualizedVol,
    percentileRank,
} from '../../helpers/priceSignals';

export const router = Router();

const FUNDS_CACHE_CONTROL =
    'public, s-maxage=86400, stale-while-revalidate=604800';

// Mirrors clampParam from rankflow.ts exactly.
function clampParam(raw: unknown, defaultVal: number, min: number, max: number): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (isNaN(n)) return defaultVal;
    return Math.min(Math.max(n, min), max);
}

// --- Presence probe ---

interface IRawPresence {
    has_consensus: boolean;
    has_secmap: boolean;
    has_rankings: boolean;
    has_market_history: boolean;
}

async function probePresence(): Promise<{
    hasConsensus: boolean;
    hasSecmap: boolean;
    hasRankings: boolean;
    hasMarketHistory: boolean;
}> {
    const { rows } = await pool.query<IRawPresence>(
        `SELECT to_regclass('public.v_sec_consensus') IS NOT NULL AS has_consensus,
                to_regclass('public.security_map')     IS NOT NULL AS has_secmap,
                to_regclass('public.market_rankings')  IS NOT NULL AS has_rankings,
                to_regclass('public.market_history')   IS NOT NULL AS has_market_history`
    );
    return {
        hasConsensus: rows[0]?.has_consensus ?? false,
        hasSecmap: rows[0]?.has_secmap ?? false,
        hasRankings: rows[0]?.has_rankings ?? false,
        hasMarketHistory: rows[0]?.has_market_history ?? false,
    };
}

// --- Price-signal helper (momentum + lowVol) ---

interface IPriceRow {
    label: string;
    close: string;
}

/**
 * Fetch tracked '1d' closes for the given tickers and compute cross-sectionally
 * normalised momentum + lowVol for each ticker (candidate order preserved).
 * Returns null-filled arrays when market_history is absent or no tickers resolve.
 */
async function computePriceSignals(
    tickers: (string | null)[],
    hasMarketHistory: boolean
): Promise<{ momentum: (number | null)[]; lowVol: (number | null)[] }> {
    const nulls = tickers.map(() => null);
    const resolved = tickers.filter((t): t is string => t !== null);
    if (!hasMarketHistory || resolved.length === 0) {
        return { momentum: nulls, lowVol: nulls };
    }

    // One query for all candidate tickers; group ascending closes per label.
    // Cap to the most-recent 260 bars per label: momentum (12-1M) + vol only read
    // the last ~253 bars, so this is output-identical to the full history but
    // avoids transferring years of backfilled bars (386k rows → ~10k). The window
    // uses idx_market_history_label_interval.
    const { rows } = await pool.query<IPriceRow>(
        `SELECT label, close FROM (
            SELECT label, close, bar_time,
                   ROW_NUMBER() OVER (PARTITION BY label ORDER BY bar_time DESC) AS rn
              FROM market_history
             WHERE label = ANY($1) AND interval = '1d'
         ) t
         WHERE rn <= 260
         ORDER BY label, bar_time ASC`,
        [resolved]
    );
    const closesByTicker = new Map<string, number[]>();
    for (const r of rows) {
        const arr = closesByTicker.get(r.label) ?? [];
        arr.push(Number(r.close));
        closesByTicker.set(r.label, arr);
    }

    const rawMomentum = tickers.map((t) =>
        t ? computeRawMomentum(closesByTicker.get(t) ?? []) : null
    );
    // Negate vol so LOWER volatility percentile-ranks HIGHER.
    const rawInvVol = tickers.map((t) => {
        if (!t) return null;
        const vol = computeAnnualizedVol(closesByTicker.get(t) ?? []);
        return vol === null ? null : -vol;
    });

    return {
        momentum: percentileRank(rawMomentum),
        lowVol: percentileRank(rawInvVol),
    };
}

// --- DB row shapes (only columns we SELECT) ---

interface IActiveFundCountRow {
    total_active: string;
}

interface ILatestPeriodRow {
    period: string;
}

interface ICandidateRow {
    cusip: string;
    name_of_issuer: string;
    holder_count_active: string;   // BIGINT → string in pg
    holder_count_total: string;    // BIGINT → string in pg
    ticker: string | null;
    rank: number | null;           // INT → number in pg (from market_rankings)
    market_cap: string | null;     // NUMERIC → string in pg
}

// --- Helper ---

function numOrNull(v: string | null): number | null {
    return v === null ? null : Number(v);
}

/**
 * @api {get} /v1/api/securities/screen Consensus-candidate screener
 * @apiQuery {Number} [minActiveHolders=2] Min active-fund holders (clamp 1..3)
 * @apiQuery {Number} [maxRank=0]          Global rank upper bound; 0=off (clamp 0..1000)
 * @apiQuery {Number} [limit=50]           Max candidates returned (clamp 1..200)
 *
 * @apiSuccess {Boolean}     success
 * @apiSuccess {Object|null} data  { periodOfReport, totalActiveFunds, candidates[] }
 *                                  or null when v_sec_consensus is absent.
 */
router.get('/screen', async (req, res) => {
    try {
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);

        const minActiveHolders = clampParam(req.query.minActiveHolders, 2, 1, 3);
        const maxRank          = clampParam(req.query.maxRank,          0, 0, 1000);
        const limit            = clampParam(req.query.limit,           50, 1, 200);

        const { hasConsensus, hasSecmap, hasRankings, hasMarketHistory } =
            await probePresence();
        if (!hasConsensus) {
            return res.json({ success: true, data: null });
        }

        // Count active fund managers — denominator for the consensus score.
        const { rows: activeRows } = await pool.query<IActiveFundCountRow>(
            `SELECT COUNT(*) AS total_active
               FROM fund_registry
              WHERE is_active_manager = TRUE AND deleted_at IS NULL`
        );
        const totalActiveFunds = Number(activeRows[0]?.total_active ?? 0);

        // Latest 13F period. Read it straight from sec_holdings (registry funds,
        // same put_call/prn filter as v_sec_consensus) — a cheap MAX over a
        // filtered join, vs computing the entire grouped consensus view just to
        // find its max period (~2.3s → ~0.7s). The candidate query below still
        // filters v_sec_consensus by this period.
        const { rows: periodRows } = await pool.query<ILatestPeriodRow>(
            `SELECT MAX(h.period_of_report)::text AS period
               FROM sec_holdings h
               JOIN fund_registry r ON r.cik = h.cik AND r.deleted_at IS NULL
              WHERE h.deleted_at IS NULL AND h.put_call = '' AND h.prn_type <> 'PRN'`
        );
        const periodOfReport = periodRows[0]?.period ?? null;
        if (!periodOfReport) {
            return res.json({ success: true, data: null });
        }

        // Build dynamic SQL — joins only reference tables confirmed present.
        const hasTickerJoin = hasSecmap;
        const hasRankJoin   = hasSecmap && hasRankings;
        const applyRankFilter = maxRank > 0 && hasRankJoin;

        const smSelect    = hasTickerJoin ? 'sm.ticker' : 'NULL::text AS ticker';
        const rankSelect  = hasRankJoin
            ? 'mr.rank, mr.market_cap'
            : 'NULL::int AS rank, NULL::numeric AS market_cap';
        const smJoin      = hasTickerJoin
            ? `LEFT JOIN security_map sm ON sm.cusip = c.cusip AND sm.deleted_at IS NULL`
            : '';
        // r2 avoids alias collision with the outer lateral alias 'mr'.
        const rankJoin    = hasRankJoin
            ? `LEFT JOIN LATERAL (
                    SELECT r2.rank, r2.market_cap
                    FROM market_rankings r2
                    WHERE r2.symbol = sm.ticker AND r2.scope = 'global'
                    ORDER BY r2.as_of DESC
                    LIMIT 1
               ) mr ON TRUE`
            : '';
        const rankFilter  = applyRankFilter
            ? `AND (mr.rank IS NULL OR mr.rank <= $3)`
            : '';

        const params: (string | number)[] = [periodOfReport, minActiveHolders];
        if (applyRankFilter) params.push(maxRank);

        const sql = `
SELECT c.cusip,
       c.name_of_issuer,
       c.holder_count_active,
       c.holder_count_total,
       ${smSelect},
       ${rankSelect}
  FROM v_sec_consensus c
  ${smJoin}
  ${rankJoin}
 WHERE c.period_of_report = $1
   AND c.holder_count_active >= $2
   ${rankFilter}
`;
        const { rows } = await pool.query<ICandidateRow>(sql, params);

        // Price signals — normalised across the candidate set (candidate order).
        const { momentum, lowVol } = await computePriceSignals(
            rows.map((r) => r.ticker),
            hasMarketHistory
        );

        // Score in Node (deterministic, no SQL), sort, then slice to limit.
        const scored = rows.map((r, i) => {
            const rank = r.rank === null ? null : Number(r.rank);
            const { score, components } = computeScore({
                holderCountActive: Number(r.holder_count_active),
                totalActiveFunds,
                rank,
                momentum: momentum[i],
                lowVol: lowVol[i],
            });
            return {
                cusip: r.cusip,
                name: r.name_of_issuer,
                ticker: r.ticker,
                rank,
                marketCap: numOrNull(r.market_cap),
                holderCountActive: Number(r.holder_count_active),
                holderCountTotal: Number(r.holder_count_total),
                score,
                components,
                // Data-availability flag — drives the two-tier /screener view.
                hasPriceSignals: hasPriceSignals(components),
            };
        });

        // Two-tier order: price-signal-complete first, then score/holders desc.
        scored.sort(compareScreenCandidates);

        const candidates = scored.slice(0, limit);

        return res.json({
            success: true,
            data: {
                periodOfReport: periodOfReport.slice(0, 10),
                totalActiveFunds,
                candidates,
            },
        });
    } catch {
        // Degrade to null — never leak a 500 for a read-only endpoint.
        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        return res.json({ success: true, data: null });
    }
});
