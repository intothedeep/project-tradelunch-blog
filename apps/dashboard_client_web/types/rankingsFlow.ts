// types/rankingsFlow.ts
// Purpose: TS interfaces for GET /v1/api/rankings/flow — symbol-keyed rank-flow.
// Mirrors the backend FlowData shape; data:null is valid (no data yet).
// Side effects: none (type declarations only).

export interface RankingsFlowPeriod {
    asOf: string; // 'YYYY-MM-DD'
}

export interface RankingsFlowCell {
    rank: number;
    marketCap: number | null;
}

export interface RankingsFlowRow {
    symbol: string;
    cells: Record<string, RankingsFlowCell | null>;
}

export interface RankingsFlow {
    granularity: string;
    periods: RankingsFlowPeriod[];
    rows: RankingsFlowRow[];
}
