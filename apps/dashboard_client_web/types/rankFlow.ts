// types/rankFlow.ts
// Purpose: Shared TS interfaces for the rank-flow endpoint contract.
// Invariant: mirrors GET /v1/api/funds/:cik/rankflow?quarters=8&k=25 exactly.
//   data:null is valid (unknown CIK) and passed through as { ok:true, data:null }.
// Side effects: none (type declarations only).

export interface RankFlowPeriod {
    periodOfReport: string; // 'YYYY-MM-DD'
    totalValueUsd: number;
    remainingCount: number;
    remainingWeightPct: number;
}

export interface RankFlowCell {
    rank: number;
    weightPct: number;
    valueUsd: number;
}

export interface RankFlowRow {
    cusip: string;
    label: string;
    cells: Record<string, RankFlowCell | null>;
}

export interface RankFlow {
    cik: string;
    periods: RankFlowPeriod[]; // newest-first
    rows: RankFlowRow[];
}
