// controllers/rankings/rankflow.ts
// Purpose: Read-only rank-flow endpoint — symbol-keyed time series of market-cap
//          rankings sampled by granularity bucket.
// Contract:
//   GET /rankings/flow?granularity=week|month|quarter|year&periods=<N>&k=<K>
//   - Samples one representative as_of per granularity bucket (newest in bucket).
//   - union_symbols = ever-top-K symbols across sampled periods (MIN(rank) <= k).
//   - Returns per-symbol per-period { rank, marketCap }.
//   - Scope is always 'global' — sector flow not supported (ranking is global).
// Guards: granularity whitelist (reject others 400); table-absence → data:null.
// Constraints: raw SQL only, no ORM, no side effects beyond pool reads.
import { pool } from '../../database';
import { Router } from 'express';

export const router = Router();

const RANKINGS_CACHE_CONTROL =
    'public, s-maxage=86400, stale-while-revalidate=604800';

// Whitelist prevents SQL injection via the granularity literal substitution.
const VALID_GRANULARITIES = new Set(['week', 'month', 'quarter', 'year']);
type Granularity = 'week' | 'month' | 'quarter' | 'year';

async function rankingsTablePresent(): Promise<boolean> {
    const { rows } = await pool.query<{ present: boolean }>(
        `SELECT to_regclass('public.market_rankings') IS NOT NULL AS present`
    );
    return rows[0]?.present ?? false;
}

function clampParam(
    raw: unknown,
    defaultVal: number,
    min: number,
    max: number
): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (isNaN(n)) return defaultVal;
    return Math.min(Math.max(n, min), max);
}

// DB row shape returned by the flow query.
interface IFlowRow {
    as_of: Date | string;
    symbol: string;
    rank: number;
    market_cap: string | null; // NUMERIC → string
}

interface FlowCellDto {
    rank: number;
    marketCap: number | null;
}

interface FlowRowDto {
    symbol: string;
    cells: Record<string, FlowCellDto | null>;
}

interface FlowData {
    granularity: Granularity;
    periods: { asOf: string }[];
    rows: FlowRowDto[];
}

// Pure: normalise the as_of column (pg driver may return Date or string).
function toDateStr(v: Date | string): string {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
}

// Pure: aggregate flat rows into FlowRowDto[], one entry per symbol.
// periodKeys is the ordered set of sampled periods (newest-first ISO strings).
function toFlowRowDtos(
    flatRows: IFlowRow[],
    periodKeys: string[]
): FlowRowDto[] {
    const map = new Map<string, FlowRowDto>();
    for (const r of flatRows) {
        const period = toDateStr(r.as_of);
        if (!map.has(r.symbol)) {
            const cells: Record<string, FlowCellDto | null> = {};
            for (const p of periodKeys) cells[p] = null;
            map.set(r.symbol, { symbol: r.symbol, cells });
        }
        const dto = map.get(r.symbol)!;
        dto.cells[period] = {
            rank: Number(r.rank),
            marketCap: r.market_cap === null ? null : Number(r.market_cap),
        };
    }
    // Sort by best rank (lowest) achieved across all periods — most persistent
    // leaders appear first, matching the expected visual ordering.
    return Array.from(map.values()).sort((a, b) => {
        const bestA = bestRank(a.cells);
        const bestB = bestRank(b.cells);
        if (bestA !== bestB) return bestA - bestB;
        return a.symbol.localeCompare(b.symbol);
    });
}

// Pure: find the minimum rank across all non-null cells.
function bestRank(cells: Record<string, FlowCellDto | null>): number {
    let best = Infinity;
    for (const cell of Object.values(cells)) {
        if (cell !== null && cell.rank < best) best = cell.rank;
    }
    return best;
}

/**
 * @api {get} /api/rankings/flow Rankings rank-flow time series
 * @apiName GetRankingsFlow
 * @apiGroup Rankings
 *
 * @apiQuery {String="week","month","quarter","year"} [granularity=week]
 * @apiQuery {Number} [periods=26] Number of sampled periods (clamp 1–104).
 * @apiQuery {Number} [k=25]       Top-K cutoff per period (clamp 1–200).
 *
 * @apiSuccess {Boolean}     success
 * @apiSuccess {Object|null} data  { granularity, periods[], rows[] } or null.
 */
router.get('/flow', async (req, res) => {
    try {
        const rawGran = req.query.granularity;
        if (
            typeof rawGran === 'string' &&
            !VALID_GRANULARITIES.has(rawGran)
        ) {
            return res
                .status(400)
                .json({ success: false, message: 'Invalid granularity' });
        }
        const granularity: Granularity =
            typeof rawGran === 'string' && VALID_GRANULARITIES.has(rawGran)
                ? (rawGran as Granularity)
                : 'week';

        const periods = clampParam(req.query.periods, 26, 1, 104);
        const k = clampParam(req.query.k, 25, 1, 200);

        const present = await rankingsTablePresent();
        if (!present) {
            res.set('Cache-Control', RANKINGS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }

        // granularity is whitelisted above — safe to interpolate as a SQL literal.
        const SQL = `
WITH sampled AS (
  SELECT DISTINCT ON (date_trunc('${granularity}', as_of))
         as_of
  FROM   market_rankings
  WHERE  scope = 'global'
  ORDER  BY date_trunc('${granularity}', as_of) DESC, as_of DESC
  LIMIT  $1
),
union_symbols AS (
  SELECT DISTINCT symbol
  FROM   market_rankings
  WHERE  as_of IN (SELECT as_of FROM sampled)
    AND  scope = 'global'
    AND  rank <= $2
)
SELECT mr.as_of, mr.symbol, mr.rank, mr.market_cap
FROM   market_rankings mr
WHERE  mr.as_of IN (SELECT as_of FROM sampled)
  AND  mr.scope = 'global'
  AND  mr.symbol IN (SELECT symbol FROM union_symbols)
ORDER  BY mr.symbol ASC, mr.as_of DESC
`;

        const { rows } = await pool.query<IFlowRow>(SQL, [periods, k]);

        if (rows.length === 0) {
            res.set('Cache-Control', RANKINGS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }

        // Derive ordered period keys from the result (newest-first).
        const periodSet = new Set<string>();
        for (const r of rows) periodSet.add(toDateStr(r.as_of));
        const periodKeys = Array.from(periodSet).sort((a, b) => b.localeCompare(a));

        const flowRows = toFlowRowDtos(rows, periodKeys);
        const periodsDto = periodKeys.map((p) => ({ asOf: p }));

        const data: FlowData = { granularity, periods: periodsDto, rows: flowRows };

        res.set('Cache-Control', RANKINGS_CACHE_CONTROL);
        res.json({ success: true, data });
    } catch (error) {
        console.error('API Error fetching rankings flow:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch rankings flow',
        });
    }
});
