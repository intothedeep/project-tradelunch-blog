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
//   - Sort: score DESC, then holderCountActive DESC; slice to limit.
// DEFERRED:
//   - momentum (0.3) + lowVol (0.1) score terms require price-history join → always null.
//   - filing_date lookahead: v_sec_consensus is period-based. A production signal
//     must gate on sec_filings.filing_date so the screener only runs after all funds
//     have filed for the period. Not yet implemented.
// Constraints: raw SQL only, parameterized, no ORM, no side effects beyond pool reads.

import { pool } from '../../database';
import { Router } from 'express';
import { computeScore } from '../../helpers/screenScore';

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
}

async function probePresence(): Promise<{
    hasConsensus: boolean;
    hasSecmap: boolean;
    hasRankings: boolean;
}> {
    const { rows } = await pool.query<IRawPresence>(
        `SELECT to_regclass('public.v_sec_consensus') IS NOT NULL AS has_consensus,
                to_regclass('public.security_map')     IS NOT NULL AS has_secmap,
                to_regclass('public.market_rankings')  IS NOT NULL AS has_rankings`
    );
    return {
        hasConsensus: rows[0]?.has_consensus ?? false,
        hasSecmap: rows[0]?.has_secmap ?? false,
        hasRankings: rows[0]?.has_rankings ?? false,
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

        const { hasConsensus, hasSecmap, hasRankings } = await probePresence();
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

        // Single latest period across all securities in v_sec_consensus.
        const { rows: periodRows } = await pool.query<ILatestPeriodRow>(
            `SELECT MAX(period_of_report)::text AS period FROM v_sec_consensus`
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

        // Score in Node (deterministic, no SQL), sort, then slice to limit.
        const scored = rows.map((r) => {
            const rank = r.rank === null ? null : Number(r.rank);
            const { score, components } = computeScore({
                holderCountActive: Number(r.holder_count_active),
                totalActiveFunds,
                rank,
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
            };
        });

        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.holderCountActive - a.holderCountActive;
        });

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
