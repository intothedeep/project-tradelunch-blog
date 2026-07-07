// helpers/holderWeights.ts
// Purpose: derive per-fund weight_pct / delta_weight_pct / isNew for a ticker's
//   13F holders at a period WITHOUT v_sec_position_delta. That view forces
//   v_sec_positions to GROUP BY all ~208k holdings across every quarter (twice),
//   costing ~1.2s to read ≤6 rows. Here we scope to the holder ciks at just two
//   periods (latest + each fund's own prior filing), riding idx_sec_holdings_cik_period.
// Invariants:
//   - weight_pct = fund's value in the ticker's cusip(s) / its whole 13F portfolio
//     value at that period, ×100 (share classes fold into one per-fund weight).
//   - Two STATIC-period queries (latest = equality, prev = per-fund MAX<latest):
//     an OR-both-periods query defeats the index (measured ~1.1s vs ~0.36s).
//   - Unresolved cusip / no ciks → empty map (caller renders null weight).
//   - First-ever filing (no prev row) → deltaWeightPct null, isNew false.
//   - Fund filed prev but held none → isNew true, delta = weight − 0.
// Side effects: pool reads only.

import { pool } from '../database';

export interface HolderWeight {
    weightPct: number | null;
    deltaWeightPct: number | null;
    isNew: boolean;
}

interface IWeightRow {
    cik: string;
    total_value: string | null; // fund's whole 13F portfolio value at the period
    cusip_value: string | null; // fund's value in the ticker's cusip(s), or null
}

function weightOf(row?: IWeightRow): number | null {
    if (!row || row.total_value == null) return null;
    const total = Number(row.total_value);
    if (total === 0) return null;
    const val = row.cusip_value == null ? 0 : Number(row.cusip_value);
    return (val * 100) / total;
}

const WEIGHT_LATEST_SQL = `
    SELECT s.cik,
           SUM(s.value_usd)                                  AS total_value,
           SUM(s.value_usd) FILTER (WHERE s.cusip = ANY($3)) AS cusip_value
      FROM sec_holdings s
     WHERE s.cik = ANY($1)
       AND s.period_of_report = $2::date
       AND s.deleted_at IS NULL AND s.put_call = '' AND s.prn_type <> 'PRN'
     GROUP BY s.cik`;

const WEIGHT_PREV_SQL = `
    WITH pp AS (
        SELECT cik, MAX(period_of_report) AS prev
          FROM sec_holdings
         WHERE cik = ANY($1) AND period_of_report < $2::date AND deleted_at IS NULL
         GROUP BY cik
    )
    SELECT s.cik,
           SUM(s.value_usd)                                  AS total_value,
           SUM(s.value_usd) FILTER (WHERE s.cusip = ANY($3)) AS cusip_value
      FROM sec_holdings s
      JOIN pp ON pp.cik = s.cik AND s.period_of_report = pp.prev
     WHERE s.deleted_at IS NULL AND s.put_call = '' AND s.prn_type <> 'PRN'
     GROUP BY s.cik`;

/**
 * weight_pct / delta_weight_pct / isNew for each holder cik of `ticker` at
 * `period`. Empty map when the ticker resolves to no cusip or `ciks` is empty.
 */
export async function getHolderWeights(
    ticker: string,
    ciks: string[],
    period: Date | string
): Promise<Map<string, HolderWeight>> {
    const out = new Map<string, HolderWeight>();
    if (ciks.length === 0) return out;

    const { rows: cusRows } = await pool.query<{ cusip: string }>(
        `SELECT cusip FROM security_map WHERE ticker = $1 AND deleted_at IS NULL`,
        [ticker]
    );
    const cusips = cusRows.map((r) => r.cusip);
    if (cusips.length === 0) return out;

    const [latest, prev] = await Promise.all([
        pool.query<IWeightRow>(WEIGHT_LATEST_SQL, [ciks, period, cusips]),
        pool.query<IWeightRow>(WEIGHT_PREV_SQL, [ciks, period, cusips]),
    ]);
    const latestByCik = new Map(latest.rows.map((w) => [w.cik, w]));
    const prevByCik = new Map(prev.rows.map((w) => [w.cik, w]));

    for (const cik of ciks) {
        const cur = latestByCik.get(cik);
        const prevRow = prevByCik.get(cik);
        const weightPct = weightOf(cur);
        let deltaWeightPct: number | null = null;
        let isNew = false;
        if (prevRow) {
            isNew = prevRow.cusip_value == null;
            const wPrev = isNew ? 0 : weightOf(prevRow);
            if (weightPct != null && wPrev != null) {
                deltaWeightPct = weightPct - wPrev;
            }
        }
        out.set(cik, { weightPct, deltaWeightPct, isNew });
    }
    return out;
}
