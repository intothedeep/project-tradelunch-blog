// helpers/fetchPoliticianHolders.ts
// Purpose: Presence-guarded fetch of per-ticker politician holders from
//          v_politician_ticker_holders (migration 0023). If the view is absent
//          the function returns [] without querying, preventing any 500 error.
// Invariants:
//   - View absence → [] (degraded, never throws).
//   - View present but no rows for ticker → [].
//   - disclosedValueBand is a coarse band (toValueBand) — never exact USD.
//   - sharePctOfFilerVolume / rankInFilerVolume are honest proxies of PTR
//     transaction volume, NOT portfolio weight or holdings.
//   - latestDisclosure is returned as 'YYYY-MM-DD' string.
//   - Results sorted by disclosed_value_usd DESC (highest trader first).
//   - committeeRelevant: true when the holder's committee oversees tickerSector
//     (CURRENT membership only; absent tables or null bioguide_id → false).
// Constraints: raw SQL, no ORM, no side effects beyond pool reads.

import { pool } from '../database';
import { toValueBand, type ValueBand } from './valueBand';
import { getPoliticianHolderShares } from './politicianHolderShares';

export interface PoliticianHolderDto {
    filerId: string;
    filerName: string;
    party: string | null;
    chamber: string | null;
    disclosedValueBand: ValueBand;
    /** % of that filer's total disclosed transaction volume (NOT portfolio weight) */
    sharePctOfFilerVolume: number | null;
    /** Rank among tickers this filer disclosed trading (NOT holdings rank) */
    rankInFilerVolume: number | null;
    totalTickerCount: number | null;
    tradeCount: number;
    netDirection: 'buy_skew' | 'sell_skew' | 'mixed';
    latestDisclosure: string; // 'YYYY-MM-DD'
    /**
     * True when the holder sits on a committee whose jurisdiction covers
     * the ticker's sector (CURRENT membership only). Always false when
     * politician_committees / v_politician_sector_oversight are absent or the
     * filer has no bioguide_id.
     */
    committeeRelevant: boolean;
}

interface IRawHolderRow {
    filer_id: string;
    filer_name: string;
    party: string | null;
    chamber: string | null;
    disclosed_value_usd: string | null;
    trade_count: string;
    net_direction: string;
    latest_disclosure: Date | string;
    bioguide_id: string | null;
}

function toIsoDate(d: Date | string): string {
    return typeof d === 'string'
        ? d.slice(0, 10)
        : d.toISOString().slice(0, 10);
}

const HOLDER_SQL = `
    SELECT h.filer_id,
           r.filer_name,
           r.party,
           r.chamber,
           r.bioguide_id,
           h.disclosed_value_usd,
           h.trade_count,
           h.net_direction,
           h.latest_disclosure
      FROM v_politician_ticker_holders h
      JOIN politician_registry r ON r.filer_id = h.filer_id AND r.deleted_at IS NULL
     WHERE h.ticker = $1
     ORDER BY h.disclosed_value_usd DESC NULLS LAST`;

/**
 * Fetches politician holders for a single ticker.
 * Returns [] when the view is absent or when there are no rows for the ticker.
 *
 * @param ticker             The stock ticker to look up.
 * @param hasPoliticianHolders  Whether v_politician_ticker_holders exists.
 * @param tickerSector       The GICS sector for this ticker (null if unknown).
 * @param hasSectorOversight Whether v_politician_sector_oversight exists.
 */
export async function fetchPoliticianHolders(
    ticker: string,
    hasPoliticianHolders: boolean,
    tickerSector: string | null = null,
    hasSectorOversight: boolean = false
): Promise<PoliticianHolderDto[]> {
    if (!hasPoliticianHolders) return [];

    const { rows } = await pool.query<IRawHolderRow>(HOLDER_SQL, [ticker]);
    if (rows.length === 0) return [];

    const filerIds = rows.map((r) => r.filer_id);
    const shareMap = await getPoliticianHolderShares(ticker, filerIds);

    // Batch resolve which bioguide_ids oversee the ticker's sector.
    const overseesBioguideIds = new Set<string>();
    if (hasSectorOversight && tickerSector !== null) {
        const bioguideIds = rows
            .map((r) => r.bioguide_id)
            .filter((id): id is string => id !== null);
        if (bioguideIds.length > 0) {
            const { rows: soRows } = await pool.query<{ bioguide_id: string }>(
                `SELECT DISTINCT bioguide_id
                   FROM v_politician_sector_oversight
                  WHERE bioguide_id = ANY($1::text[])
                    AND sector = $2`,
                [bioguideIds, tickerSector]
            );
            soRows.forEach((r) => overseesBioguideIds.add(r.bioguide_id));
        }
    }

    return rows.map((r) => {
        const share = shareMap.get(r.filer_id);
        const committeeRelevant =
            r.bioguide_id !== null && overseesBioguideIds.has(r.bioguide_id);
        return {
            filerId: r.filer_id,
            filerName: r.filer_name,
            party: r.party,
            chamber: r.chamber,
            disclosedValueBand: toValueBand(
                r.disclosed_value_usd === null
                    ? null
                    : Number(r.disclosed_value_usd)
            ),
            sharePctOfFilerVolume: share?.sharePctOfFilerVolume ?? null,
            rankInFilerVolume: share?.rankInFilerVolume ?? null,
            totalTickerCount: share?.totalTickerCount ?? null,
            tradeCount: Number(r.trade_count),
            netDirection:
                r.net_direction as PoliticianHolderDto['netDirection'],
            latestDisclosure: toIsoDate(r.latest_disclosure),
            committeeRelevant,
        };
    });
}
