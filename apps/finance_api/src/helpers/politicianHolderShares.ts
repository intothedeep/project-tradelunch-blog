// helpers/politicianHolderShares.ts
// Purpose: Derive sharePctOfFilerVolume and rankInFilerVolume for politician
//   filers relative to their disclosed PTR transaction volume. Two exported
//   functions with a two-query shape mirroring holderWeights.ts:
//     getPoliticianHolderShares(ticker, filerIds[]) — per-ticker context:
//       one result per filer_id, how they rank on THIS ticker.
//     getFilerTickerShares(filerId) — per-filer profile context:
//       one result per ticker, how each ticker ranks within THIS filer.
//   Both share the TOTAL query (filer's overall volume) but use different
//   RANK queries — filtered to one ticker vs all tickers.
// Invariants:
//   - sharePctOfFilerVolume = (ticker's disclosed value / filer total) × 100.
//   - rankInFilerVolume = RANK() OVER (PARTITION BY filer_id ORDER BY SUM DESC).
//   - totalTickerCount = total distinct tickers the filer traded.
//   - Filer with no rows in politician_trades → all fields null.
//   - Empty input → empty map (no DB hit).
//   - NULL value_estimate rows: COALESCE to 0 in SUM.
//   - HONEST proxy: transaction volumes, NOT portfolio weights.
// Side effects: pool reads only.

import { pool } from '../database';

export interface HolderShare {
    sharePctOfFilerVolume: number | null;
    rankInFilerVolume: number | null;
    totalTickerCount: number | null;
}

interface ITotalRow {
    filer_id: string;
    total_value: string | null;
}

interface IRankRow {
    filer_id: string;
    ticker: string;
    rank_in_filer: string;
    total_ticker_count: string;
    ticker_value: string | null;
}

// Query 1: each filer's total disclosed volume across all their tickers.
const TOTAL_SQL = `
    SELECT filer_id,
           SUM(COALESCE(value_estimate, 0)) AS total_value
      FROM politician_trades
     WHERE filer_id = ANY($1)
       AND deleted_at IS NULL
       AND ticker IS NOT NULL
     GROUP BY filer_id`;

// Query 2a: all-ticker rank for filer_ids, filtered to one ticker.
// Used by getPoliticianHolderShares (per-ticker holder list).
const RANK_ONE_TICKER_SQL = `
    WITH per_ticker AS (
        SELECT filer_id,
               ticker,
               SUM(COALESCE(value_estimate, 0))                         AS ticker_value,
               RANK() OVER (
                   PARTITION BY filer_id
                   ORDER BY SUM(COALESCE(value_estimate, 0)) DESC
               )                                                         AS rank_in_filer,
               COUNT(*) OVER (PARTITION BY filer_id)                    AS total_ticker_count
          FROM politician_trades
         WHERE filer_id = ANY($1)
           AND deleted_at IS NULL
           AND ticker IS NOT NULL
         GROUP BY filer_id, ticker
    )
    SELECT filer_id, ticker, rank_in_filer, total_ticker_count, ticker_value
      FROM per_ticker
     WHERE ticker = $2`;

// Query 2b: all-ticker rank for ONE filer — returns every ticker row.
// Used by getFilerTickerShares (per-filer profile page).
const RANK_ALL_TICKERS_SQL = `
    WITH per_ticker AS (
        SELECT filer_id,
               ticker,
               SUM(COALESCE(value_estimate, 0))                         AS ticker_value,
               RANK() OVER (
                   PARTITION BY filer_id
                   ORDER BY SUM(COALESCE(value_estimate, 0)) DESC
               )                                                         AS rank_in_filer,
               COUNT(*) OVER (PARTITION BY filer_id)                    AS total_ticker_count
          FROM politician_trades
         WHERE filer_id = $1
           AND deleted_at IS NULL
           AND ticker IS NOT NULL
         GROUP BY filer_id, ticker
    )
    SELECT filer_id, ticker, rank_in_filer, total_ticker_count, ticker_value
      FROM per_ticker`;

function computeShare(
    row: IRankRow,
    totalRaw: string | null | undefined
): HolderShare {
    if (totalRaw == null) {
        return {
            sharePctOfFilerVolume: null,
            rankInFilerVolume: null,
            totalTickerCount: null,
        };
    }
    const total = Number(totalRaw);
    const tickerVal = row.ticker_value == null ? 0 : Number(row.ticker_value);
    return {
        sharePctOfFilerVolume: total === 0 ? null : (tickerVal * 100) / total,
        rankInFilerVolume: Number(row.rank_in_filer),
        totalTickerCount: Number(row.total_ticker_count),
    };
}

/**
 * Returns share/rank metadata keyed by filer_id for a given ticker.
 * Use for per-ticker holder list (Q9.2 / Q9.3).
 * Empty map when filerIds is empty.
 */
export async function getPoliticianHolderShares(
    ticker: string,
    filerIds: string[]
): Promise<Map<string, HolderShare>> {
    const out = new Map<string, HolderShare>();
    if (filerIds.length === 0) return out;

    const [totalRes, rankRes] = await Promise.all([
        pool.query<ITotalRow>(TOTAL_SQL, [filerIds]),
        pool.query<IRankRow>(RANK_ONE_TICKER_SQL, [filerIds, ticker]),
    ]);

    const totalByFiler = new Map(
        totalRes.rows.map((r) => [r.filer_id, r.total_value])
    );
    const rankByFiler = new Map(rankRes.rows.map((r) => [r.filer_id, r]));

    for (const filerId of filerIds) {
        const rankRow = rankByFiler.get(filerId);
        if (!rankRow) {
            out.set(filerId, {
                sharePctOfFilerVolume: null,
                rankInFilerVolume: null,
                totalTickerCount: null,
            });
            continue;
        }
        out.set(filerId, computeShare(rankRow, totalByFiler.get(filerId)));
    }
    return out;
}

/**
 * Returns share/rank metadata keyed by ticker for a single filer.
 * Use for the filer profile page (Q6.2 tickers list).
 * Empty map when filerId produces no rows.
 */
export async function getFilerTickerShares(
    filerId: string
): Promise<Map<string, HolderShare>> {
    const out = new Map<string, HolderShare>();

    const [totalRes, rankRes] = await Promise.all([
        pool.query<ITotalRow>(TOTAL_SQL, [[filerId]]),
        pool.query<IRankRow>(RANK_ALL_TICKERS_SQL, [filerId]),
    ]);

    const totalRaw = totalRes.rows[0]?.total_value ?? null;
    for (const row of rankRes.rows) {
        out.set(row.ticker, computeShare(row, totalRaw));
    }
    return out;
}
