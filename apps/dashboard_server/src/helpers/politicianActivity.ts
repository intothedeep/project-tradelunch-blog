// helpers/politicianActivity.ts
// Purpose: Presence-guarded fetch of per-ticker politician trading activity
//          from v_politician_activity (migration 0022). If the view is absent
//          the function returns null without querying, preventing any 500 error.
// Invariants:
//   - View absence → null (degraded, never throws).
//   - View present but no rows for ticker → null.
//   - All numeric aggregate columns are cast to number in the DTO.
//   - latestDisclosure is returned as 'YYYY-MM-DD' string.
// Constraints: raw SQL, no ORM, no side effects beyond one pool read.

import { pool } from '../database';

export interface PoliticianActivityDto {
    count90d: number;
    buyMembers: number;
    sellMembers: number;
    netDirection: 'buy_skew' | 'sell_skew' | 'mixed';
    latestDisclosure: string; // 'YYYY-MM-DD'
    clusterFlag: boolean;
}

interface IRawActivityRow {
    traded_by_count: string;
    buy_member_count: string;
    sell_member_count: string;
    net_direction: string;
    latest_disclosure_date: Date | string;
    cluster_flag: boolean;
}

function toIsoDate(d: Date | string): string {
    return typeof d === 'string'
        ? d.slice(0, 10)
        : d.toISOString().slice(0, 10);
}

/**
 * Fetches politician-activity aggregate for a single ticker.
 * Returns null when the view is absent OR when there are no rows
 * for the ticker in the 90-day window.
 */
export async function fetchPoliticianActivity(
    ticker: string,
    hasPoliticianActivity: boolean
): Promise<PoliticianActivityDto | null> {
    if (!hasPoliticianActivity) return null;

    const { rows } = await pool.query<IRawActivityRow>(
        `SELECT traded_by_count,
                buy_member_count,
                sell_member_count,
                net_direction,
                latest_disclosure_date,
                cluster_flag
           FROM v_politician_activity
          WHERE ticker = $1`,
        [ticker]
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
        count90d: Number(r.traded_by_count),
        buyMembers: Number(r.buy_member_count),
        sellMembers: Number(r.sell_member_count),
        netDirection: r.net_direction as PoliticianActivityDto['netDirection'],
        latestDisclosure: toIsoDate(r.latest_disclosure_date),
        clusterFlag: r.cluster_flag,
    };
}
