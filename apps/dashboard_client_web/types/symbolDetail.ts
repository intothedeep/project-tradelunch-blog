// types/symbolDetail.ts
// Purpose: Shared TS interfaces for the per-ticker detail endpoint contract.
// Invariant: mirrors GET /v1/api/securities/:ticker/by-ticker exactly.
//   data:null is valid (unknown ticker / tables absent) → { ok:true, data:null }.
//   politicianActivity is absent when migration 0022 (v_politician_activity) has
//   not been applied yet; consumers MUST treat undefined / null identically.
//   politicianHolders is absent when migration 0023 has not been applied;
//   empty array when the view exists but no data for this ticker.
// Side effects: none (type declarations only).

export interface SymbolRankingEntry {
    asOf: string; // 'YYYY-MM-DD'
    scope: string; // 'global' (only global-scope rows are returned)
    rank: number;
    marketCap: number | null;
}

export interface SymbolHolder {
    cik: string;
    label: string;
    isActiveManager: boolean;
    valueUsd: number;
    weightPct: number | null; // portfolio weight % from v_sec_position_delta; null when absent
    deltaWeightPct: number | null; // quarter-over-quarter Δ weight %; null when new/absent
    isNew: boolean; // true when fund opened this position in the latest period
}

export interface SymbolPoliticianActivity {
    count90d: number;
    buyMembers: number;
    sellMembers: number;
    netDirection: 'buy_skew' | 'sell_skew' | 'mixed';
    latestDisclosure: string; // 'YYYY-MM-DD'
    clusterFlag: boolean;
}

// Band string coarsened from PTR disclosure ranges (never an exact dollar amount).
// Mirrors helpers/valueBand.ts ValueBand.
export type ValueBand =
    | '<$15K'
    | '$15K–$50K'
    | '$50K–$250K'
    | '$250K–$1M'
    | '>$1M'
    | '—';

/**
 * Per-politician PTR transaction holder for a ticker (migration 0023).
 * Invariants:
 *   - disclosedValueBand is a coarse band — never an exact USD amount.
 *   - sharePctOfFilerVolume / rankInFilerVolume are PTR transaction volume proxies
 *     (NOT portfolio weight or holdings rank).
 *   - netDirection reflects transaction skew, NOT a current position direction.
 */
export interface SymbolPoliticianHolder {
    filerId: string;
    filerName: string;
    party: string | null;
    chamber: string | null;
    /** Coarse band — "as reported by source". NEVER render as exact position size. */
    disclosedValueBand: ValueBand;
    /** % of this filer's total disclosed transaction volume. NOT portfolio weight. */
    sharePctOfFilerVolume: number | null;
    /** Rank among tickers this filer disclosed trading. NOT holdings rank. */
    rankInFilerVolume: number | null;
    totalTickerCount: number | null;
    tradeCount: number;
    netDirection: 'buy_skew' | 'sell_skew' | 'mixed';
    latestDisclosure: string; // 'YYYY-MM-DD'
}

export interface SymbolDetail {
    ticker: string;
    sector: string | null; // from symbol_fundamentals via enriched view; null when absent
    rankingHistory: SymbolRankingEntry[]; // value-desc, latest-first, up to 52 weeks
    holders: SymbolHolder[]; // value-desc; empty until security_map is seeded
    periodOfReport: string | null; // 'YYYY-MM-DD' of latest 13F period; null when no holders
    priceHistory: { t: string; close: number }[]; // ascending daily closes; [] for untracked
    // Absent when migration 0022 (v_politician_activity) has not been applied.
    // Null when the view exists but no trades in the 90-day window for this ticker.
    politicianActivity?: SymbolPoliticianActivity | null;
    // Absent when migration 0023 (v_politician_ticker_holders) has not been applied.
    // Empty array when the view exists but no politicians traded this ticker.
    politicianHolders?: SymbolPoliticianHolder[];
}
