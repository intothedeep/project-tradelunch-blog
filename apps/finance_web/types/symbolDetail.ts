// types/symbolDetail.ts
// Purpose: Shared TS interfaces for the per-ticker detail endpoint contract.
// Invariant: mirrors GET /v1/api/securities/:ticker/by-ticker exactly.
//   data:null is valid (unknown ticker / tables absent) → { ok:true, data:null }.
//   politicianActivity is absent when migration 0022 (v_politician_activity) has
//   not been applied yet; consumers MUST treat undefined / null identically.
//   politicianHolders is absent when migration 0023 has not been applied;
//   empty array when the view exists but no data for this ticker.
//   committeeRelevant on SymbolPoliticianHolder is absent when Phase Q tables
//   (migration 0025) are not yet applied; treat undefined as false.
//   gexDaily is absent when migration 0030 (gex_daily) has not been applied;
//   null when the table exists but no row for this ticker.
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
 *   - committeeRelevant: true when the holder's committee oversees the ticker's
 *     sector (CURRENT membership only; absent tables → field absent/false).
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
    /**
     * True when the holder sits on a committee whose jurisdiction covers
     * this ticker's sector (CURRENT membership only). Absent when Phase Q
     * tables not yet applied — treat as false.
     */
    committeeRelevant?: boolean;
}

/**
 * Aggregate 13F options exposure for the ticker at its latest filed period
 * (Phase U, migration 0027). PUT/CALL notional summed across all filers.
 * NOT a gamma/GEX signal — 13F is quarter-lagged positions, not option chains.
 */
export interface SymbolSecDerivatives {
    periodOfReport: string; // 'YYYY-MM-DD' latest 13F period with option legs
    callValueUsd: number;
    putValueUsd: number;
    holderCount: number; // distinct funds holding options on this ticker
    netSkew: 'call_skew' | 'put_skew' | 'balanced';
}

/**
 * GEX (gamma-exposure) latest daily row for the ticker (Phase V, migration 0030).
 * net_gex / call_gex / put_gex are raw gamma-exposure floats (may be negative).
 * spot is the underlying price at collection time; null when not recorded.
 * NOT used in any score — history accumulation required before signal use.
 */
export interface SymbolGexDaily {
    netGex: number;
    callGex: number;
    putGex: number;
    spot: number | null;
    asOf: string; // 'YYYY-MM-DD'
    source: string;
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
    // Absent when migration 0027 (v_sec_derivatives_exposure) has not been applied.
    // Null when the view exists but no filer disclosed options on this ticker.
    secDerivatives?: SymbolSecDerivatives | null;
    // Absent when migration 0030 (gex_daily) has not been applied.
    // Null when the table exists but no GEX row for this ticker.
    gexDaily?: SymbolGexDaily | null;
}
