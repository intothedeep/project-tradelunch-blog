// types/politician.ts
// Purpose: Shared TS interfaces for the per-politician endpoint contract.
// Invariant: mirrors GET /v1/api/politicians/:filerId exactly.
//   data:null is valid (unknown filerId / tables absent) → { ok:true, data:null }.
//   All USD amounts are coarsened to ValueBand strings — never exact dollars (PTR
//   honesty contract). sharePctOfFilerVolume / rankInFilerVolume are PTR transaction
//   volume proxies, NOT portfolio weights or holdings ranks.
//   timeline is [] when <2 distinct quarters of data (pre-backfill contract).
//   committees is absent/empty when politician_committees (migration 0025) is not yet
//   applied or the filer has no bioguide_id. CURRENT membership only (historical
//   not available).
//   committeeRelevant on each ticker is false when Phase Q tables are absent.
// Side effects: none (type declarations only).

import type { ValueBand } from '@/types/symbolDetail';

export interface PoliticianCommittee {
    thomasId: string;
    name: string;
}

export interface PoliticianFiler {
    filerId: string;
    filerName: string;
    party: string | null;
    chamber: string | null;
    state: string | null;
    office: string | null;
    photoUrl: string | null;
    tradeCount: number | null;
    purchases: number | null;
    sales: number | null;
    lateFilings: number | null;
    /** Coarse band "as reported by source" — NEVER exact USD. */
    estVolumeBand: ValueBand;
    /**
     * Current committee memberships (Phase Q, migration 0025).
     * Absent/empty when tables not yet applied or filer has no bioguide_id.
     * CURRENT membership only — historical not available from this dataset.
     */
    committees?: PoliticianCommittee[];
}

export interface PoliticianTicker {
    ticker: string;
    /** Coarse band — NEVER render as exact position size. */
    disclosedValueBand: ValueBand;
    /** % of this filer's total disclosed transaction volume. NOT portfolio weight. */
    sharePctOfFilerVolume: number | null;
    /** Rank among tickers this filer disclosed trading. NOT holdings rank. */
    rankInFilerVolume: number | null;
    totalTickerCount: number | null;
    netDirection: 'buy_skew' | 'sell_skew' | 'mixed';
    latestDisclosure: string; // 'YYYY-MM-DD'
    tradeCount: number;
    /**
     * True when the filer's committee oversees the sector of this ticker.
     * Based on CURRENT committee membership only; absent tables → false.
     */
    committeeRelevant?: boolean;
}

export interface PoliticianTimelineEntry {
    quarter: string; // 'YYYY-MM-DD' (quarter start)
    ticker: string;
    /** Net disclosed transaction band for this ticker/quarter. */
    netValueBand: ValueBand;
    /** Gross BUY disclosed band this quarter; '—' when no buys (or pre-0033). */
    buyValueBand: ValueBand;
    /** Gross SELL disclosed band this quarter; '—' when no sells (or pre-0033). */
    sellValueBand: ValueBand;
    /** Direction of net activity: 'buy' | 'sell' | 'mixed' (timeline view vocab) */
    direction: string;
}

export interface PoliticianDetail {
    filer: PoliticianFiler;
    tickers: PoliticianTicker[];
    timeline: PoliticianTimelineEntry[];
}
