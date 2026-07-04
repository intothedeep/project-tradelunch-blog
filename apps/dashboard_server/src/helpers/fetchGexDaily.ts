// helpers/fetchGexDaily.ts
// Purpose: Presence-guarded fetch of per-ticker GEX (gamma-exposure) from
//          gex_daily (migration 0030, Phase V-collect). Returns the latest
//          as_of row for the ticker. If the table is absent the function
//          returns null without querying, preventing any 500 error.
// Invariants:
//   - Table absence → null (degraded, never throws).
//   - Table present but no rows for ticker → null.
//   - net_gex / call_gex / put_gex are raw gamma-exposure floats (can be negative).
//   - spot is the underlying price at collection time; null when not recorded.
//   - asOf is returned as 'YYYY-MM-DD' string.
//   - No scoring or weight logic here — caller decides how to surface the data.
// Constraints: raw SQL, no ORM, no side effects beyond one pool read.

import { pool } from '../database';

export interface GexDailyDto {
    netGex: number;
    callGex: number;
    putGex: number;
    spot: number | null;
    asOf: string; // 'YYYY-MM-DD'
    source: string;
}

interface IRawGexRow {
    net_gex: string;
    call_gex: string;
    put_gex: string;
    spot: string | null;
    as_of: Date | string;
    source: string;
}

function toIsoDate(d: Date | string): string {
    return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * Fetches the latest GEX row for a single ticker.
 * Returns null when the table is absent or when there is no row for the ticker.
 *
 * @param ticker       The stock ticker to look up.
 * @param hasGexDaily  Whether the gex_daily table exists.
 */
export async function fetchGexDaily(
    ticker: string,
    hasGexDaily: boolean,
): Promise<GexDailyDto | null> {
    if (!hasGexDaily) return null;

    const { rows } = await pool.query<IRawGexRow>(
        // deleted_at IS NULL: mask soft-deleted rows at read (soft-delete rule) and
        // let the planner use the partial idx_gex_daily_active_ticker.
        `SELECT net_gex, call_gex, put_gex, spot, as_of, source
           FROM gex_daily
          WHERE ticker = $1
            AND deleted_at IS NULL
          ORDER BY as_of DESC
          LIMIT 1`,
        [ticker]
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
        netGex: Number(r.net_gex),
        callGex: Number(r.call_gex),
        putGex: Number(r.put_gex),
        spot: r.spot === null ? null : Number(r.spot),
        asOf: toIsoDate(r.as_of),
        source: r.source,
    };
}
