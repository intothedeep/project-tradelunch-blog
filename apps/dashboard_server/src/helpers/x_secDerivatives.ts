// helpers/secDerivatives.ts
// Purpose: Presence-guarded fetch of per-ticker 13F options exposure from
//          v_sec_derivatives_exposure (migration 0027, Phase U). Aggregates the
//          PUT/CALL notional every 13F filer disclosed for this ticker at its
//          latest filing period. If the view is absent the function returns null
//          without querying, preventing any 500 error.
// Invariants:
//   - View absence → null (degraded, never throws).
//   - View present but no option rows for ticker → null.
//   - CUSIP→ticker resolved via security_map (view is CUSIP-keyed).
//   - value_usd BIGINT summed into number (13F option notional < 2^53 — safe).
//   - netSkew derived from call vs put notional (NOT load-bearing color).
// Constraints: raw SQL, no ORM, no side effects beyond one pool read.

import { pool } from '../database';

export interface SecDerivativesDto {
    periodOfReport: string; // 'YYYY-MM-DD' — latest 13F period with option legs
    callValueUsd: number;
    putValueUsd: number;
    holderCount: number; // distinct funds holding options on this ticker
    netSkew: 'call_skew' | 'put_skew' | 'balanced';
}

interface IRawDerivRow {
    period_of_report: Date | string;
    call_value_usd: string | null;
    put_value_usd: string | null;
    holder_count: string;
}

function toIsoDate(d: Date | string): string {
    return typeof d === 'string'
        ? d.slice(0, 10)
        : d.toISOString().slice(0, 10);
}

function deriveSkew(call: number, put: number): SecDerivativesDto['netSkew'] {
    if (call > put) return 'call_skew';
    if (put > call) return 'put_skew';
    return 'balanced';
}

/**
 * Fetches aggregate 13F options exposure for a single ticker at its latest
 * filed period. Returns null when the view is absent OR when no filer disclosed
 * an option position on this ticker.
 */
export async function fetchSecDerivatives(
    ticker: string,
    hasSecDerivatives: boolean
): Promise<SecDerivativesDto | null> {
    if (!hasSecDerivatives) return null;

    const { rows } = await pool.query<IRawDerivRow>(
        `WITH resolved AS (
             SELECT d.period_of_report, d.cik,
                    d.call_value_usd, d.put_value_usd
               FROM v_sec_derivatives_exposure d
               JOIN security_map m
                 ON m.cusip = d.cusip AND m.deleted_at IS NULL AND m.ticker = $1
         ),
         latest AS (SELECT MAX(period_of_report) AS period FROM resolved)
         SELECT r.period_of_report,
                SUM(COALESCE(r.call_value_usd, 0)) AS call_value_usd,
                SUM(COALESCE(r.put_value_usd, 0))  AS put_value_usd,
                COUNT(DISTINCT r.cik)              AS holder_count
           FROM resolved r
           JOIN latest l ON r.period_of_report = l.period
          GROUP BY r.period_of_report`,
        [ticker]
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    const callValueUsd = Number(r.call_value_usd ?? 0);
    const putValueUsd = Number(r.put_value_usd ?? 0);
    return {
        periodOfReport: toIsoDate(r.period_of_report),
        callValueUsd,
        putValueUsd,
        holderCount: Number(r.holder_count),
        netSkew: deriveSkew(callValueUsd, putValueUsd),
    };
}
