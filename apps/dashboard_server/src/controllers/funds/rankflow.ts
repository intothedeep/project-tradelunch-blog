// controllers/funds/rankflow.ts
// Purpose : Read-only rankflow endpoint — ranks the top-K holdings by value
//           for the most-recent N quarters, returning per-cusip rank/weight
//           timelines and per-period totals for the "remaining" bucket.
// Invariants:
//   - Filtered to equity-only rows: put_call='' AND prn_type <> 'PRN'
//   - union_cusips = ever-top-K across selected periods (MIN(rnk) <= k)
//   - label = name_of_issuer from the most-recent period present (ticker is NULL)
//   - weightPct rounded to 4 decimals (matching funds.ts convention)
// Constraints: raw SQL only, no ORM, no side effects beyond pool reads.
//              Table-absence guard returns null data, not 500.
import { pool } from '../../database';
import { Router } from 'express';

export const router = Router();

const FUNDS_CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800';

// Reuses the same guard as funds.ts — probe whether migration 0017 applied.
async function holdingsTablesPresent(): Promise<boolean> {
    const { rows } = await pool.query<{ present: boolean }>(
        `SELECT to_regclass('public.sec_filings') IS NOT NULL
             AND to_regclass('public.sec_holdings') IS NOT NULL AS present`
    );
    return rows[0]?.present ?? false;
}

// Clamp a numeric query param to [min, max], falling back to defaultVal.
function clampParam(raw: unknown, defaultVal: number, min: number, max: number): number {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (isNaN(n)) return defaultVal;
    return Math.min(Math.max(n, min), max);
}

// --- DB row shapes (only columns we SELECT) ---

interface IRankflowPeriodRow {
    period_of_report: Date;
    total_value_usd: string; // BIGINT → string
    remaining_count: string; // COUNT() → string
    remaining_weight_pct: string | null;
}

interface IRankflowCusipRow {
    cusip: string;
    label: string;
    period_of_report: Date;
    rnk: string; // bigint-like from ROW_NUMBER
    weight_pct: string | null;
    value_usd: string;
}

// --- Pure DTOs ---

interface PeriodDto {
    periodOfReport: string;
    totalValueUsd: number;
    remainingCount: number;
    remainingWeightPct: number;
}

interface CellDto {
    rank: number;
    weightPct: number;
    valueUsd: number;
}

interface RowDto {
    cusip: string;
    label: string;
    cells: Record<string, CellDto | null>;
}

interface RankflowData {
    cik: string;
    periods: PeriodDto[];
    rows: RowDto[];
}

// Pure: map a period-aggregate row to its DTO.
function toPeriodDto(r: IRankflowPeriodRow): PeriodDto {
    return {
        periodOfReport: r.period_of_report.toISOString().slice(0, 10),
        totalValueUsd: Number(r.total_value_usd),
        remainingCount: Number(r.remaining_count),
        remainingWeightPct: r.remaining_weight_pct === null ? 0 : Number(r.remaining_weight_pct),
    };
}

// Pure: aggregate flat cusip rows into RowDto[], one row per cusip.
// periodKeys is the ordered set of periods (newest-first ISO strings).
function toRowDtos(cusipRows: IRankflowCusipRow[], periodKeys: string[]): RowDto[] {
    // Group by cusip; preserve insertion order (rows arrive cusip-sorted by label).
    const map = new Map<string, RowDto>();
    for (const r of cusipRows) {
        const period = r.period_of_report.toISOString().slice(0, 10);
        if (!map.has(r.cusip)) {
            // Initialise all period cells to null — filled in as we encounter rows.
            const cells: Record<string, CellDto | null> = {};
            for (const p of periodKeys) cells[p] = null;
            map.set(r.cusip, { cusip: r.cusip, label: r.label, cells });
        }
        const dto = map.get(r.cusip)!;
        dto.cells[period] = {
            rank: Number(r.rnk),
            weightPct: r.weight_pct === null ? 0 : Number(r.weight_pct),
            valueUsd: Number(r.value_usd),
        };
    }
    return Array.from(map.values());
}

/**
 * @api {get} /api/funds/:cik/rankflow Rank-flow timeline for top-K holdings
 * @apiName GetFundRankflow
 * @apiGroup Funds
 *
 * @apiParam  {String} cik        Fund CIK (digits only; auto-padded to 10 chars).
 * @apiQuery  {Number} [quarters] Number of recent quarters to include (default 8, clamp 1–40).
 * @apiQuery  {Number} [k]        Top-K cutoff per period (default 25, clamp 1–200).
 *
 * @apiSuccess {Boolean}     success
 * @apiSuccess {Object|null} data    { cik, periods[], rows[] } or null when cik unknown.
 */
router.get('/:cik/rankflow', async (req, res) => {
    try {
        const rawCik = req.params.cik;

        // Validate: digits only.
        if (!/^\d+$/.test(rawCik)) {
            res.set('Cache-Control', FUNDS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }
        const cik = rawCik.padStart(10, '0');

        const quarters = clampParam(req.query.quarters, 8, 1, 40);
        const k = clampParam(req.query.k, 25, 1, 200);

        const present = await holdingsTablesPresent();
        if (!present) {
            res.set('Cache-Control', FUNDS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }

        // Step 1 — most-recent N distinct periods for this cik.
        // Step 2/3 — base holdings with period_total, weight_pct, rnk.
        // Step 4 — union_cusips = ever-top-K.
        // Step 5 — label = name_of_issuer from the most-recent period present.
        //          cells = per-period rank/weight/value for union cusips.
        // Step 6 — period aggregate with remaining (not-in-union) count + weight.
        //
        // Two queries: (a) cusip-level rows, (b) period-level aggregates.
        // Both reference the same CTEs — kept separate to keep each result set flat.

        const CUSIP_SQL = `
WITH periods AS (
  SELECT DISTINCT period_of_report
  FROM   sec_filings
  WHERE  cik = $1 AND deleted_at IS NULL
  ORDER  BY period_of_report DESC
  LIMIT  $2
),
base AS (
  SELECT h.cusip,
         h.name_of_issuer,
         h.value_usd,
         f.period_of_report,
         SUM(h.value_usd) OVER (PARTITION BY f.period_of_report) AS period_total
  FROM   sec_holdings h
  JOIN   sec_filings  f ON f.accession = h.accession AND f.cik = $1
  WHERE  h.cik          = $1
    AND  h.deleted_at   IS NULL
    AND  f.deleted_at   IS NULL
    AND  f.period_of_report IN (SELECT period_of_report FROM periods)
    AND  h.put_call     = ''
    AND  h.prn_type     <> 'PRN'
),
ranked AS (
  SELECT cusip,
         name_of_issuer,
         value_usd,
         period_of_report,
         ROUND(value_usd * 100.0 / NULLIF(period_total, 0), 4) AS weight_pct,
         ROW_NUMBER() OVER (
           PARTITION BY period_of_report
           ORDER BY value_usd DESC, cusip ASC
         ) AS rnk
  FROM   base
),
union_cusips AS (
  SELECT cusip
  FROM   ranked
  GROUP  BY cusip
  HAVING MIN(rnk) <= $3
),
latest_label AS (
  SELECT DISTINCT ON (cusip)
         cusip,
         name_of_issuer AS label
  FROM   ranked
  WHERE  cusip IN (SELECT cusip FROM union_cusips)
  ORDER  BY cusip, period_of_report DESC
)
SELECT r.cusip,
       ll.label,
       r.period_of_report,
       r.rnk,
       r.weight_pct,
       r.value_usd
FROM   ranked    r
JOIN   union_cusips uc ON uc.cusip = r.cusip
JOIN   latest_label ll ON ll.cusip = r.cusip
ORDER  BY ll.label ASC, r.cusip ASC, r.period_of_report DESC
`;

        const PERIOD_SQL = `
WITH periods AS (
  SELECT DISTINCT period_of_report
  FROM   sec_filings
  WHERE  cik = $1 AND deleted_at IS NULL
  ORDER  BY period_of_report DESC
  LIMIT  $2
),
base AS (
  SELECT h.cusip,
         h.value_usd,
         f.period_of_report,
         SUM(h.value_usd) OVER (PARTITION BY f.period_of_report) AS period_total
  FROM   sec_holdings h
  JOIN   sec_filings  f ON f.accession = h.accession AND f.cik = $1
  WHERE  h.cik          = $1
    AND  h.deleted_at   IS NULL
    AND  f.deleted_at   IS NULL
    AND  f.period_of_report IN (SELECT period_of_report FROM periods)
    AND  h.put_call     = ''
    AND  h.prn_type     <> 'PRN'
),
ranked AS (
  SELECT cusip,
         value_usd,
         period_of_report,
         ROUND(value_usd * 100.0 / NULLIF(period_total, 0), 4) AS weight_pct,
         ROW_NUMBER() OVER (
           PARTITION BY period_of_report
           ORDER BY value_usd DESC, cusip ASC
         ) AS rnk
  FROM   base
),
union_cusips AS (
  SELECT cusip
  FROM   ranked
  GROUP  BY cusip
  HAVING MIN(rnk) <= $3
),
period_totals AS (
  SELECT period_of_report,
         MAX(period_total) AS total_value_usd
  FROM   base
  GROUP  BY period_of_report
)
SELECT pt.period_of_report,
       pt.total_value_usd,
       COUNT(r.cusip) FILTER (WHERE r.cusip NOT IN (SELECT cusip FROM union_cusips))
         AS remaining_count,
       COALESCE(
         ROUND(
           SUM(r.value_usd) FILTER (WHERE r.cusip NOT IN (SELECT cusip FROM union_cusips))
             * 100.0 / NULLIF(pt.total_value_usd, 0),
           4
         ),
         0
       ) AS remaining_weight_pct
FROM   period_totals pt
JOIN   ranked        r  ON r.period_of_report = pt.period_of_report
GROUP  BY pt.period_of_report, pt.total_value_usd
ORDER  BY pt.period_of_report DESC
`;

        const [cusipResult, periodResult] = await Promise.all([
            pool.query<IRankflowCusipRow>(CUSIP_SQL, [cik, quarters, k]),
            pool.query<IRankflowPeriodRow>(PERIOD_SQL, [cik, quarters, k]),
        ]);

        // Unknown cik → no periods found.
        if (periodResult.rows.length === 0) {
            res.set('Cache-Control', FUNDS_CACHE_CONTROL);
            return res.json({ success: true, data: null });
        }

        const periods: PeriodDto[] = periodResult.rows.map(toPeriodDto);
        const periodKeys = periods.map((p) => p.periodOfReport);
        const rows: RowDto[] = toRowDtos(cusipResult.rows, periodKeys);

        const data: RankflowData = { cik, periods, rows };

        res.set('Cache-Control', FUNDS_CACHE_CONTROL);
        res.json({ success: true, data });
    } catch (error) {
        console.error('API Error fetching rankflow:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch rankflow' });
    }
});
