// types/consensus.ts
// Purpose: Shared TS interfaces for the cross-fund consensus endpoint contract.
// Invariant: mirrors GET /v1/api/securities/:cusip/consensus exactly.
//   data:null is valid (unknown cusip / views absent) → { ok:true, data:null }.
// Side effects: none (type declarations only).

export interface ConsensusHolder {
    cik: string;
    label: string;
    isActiveManager: boolean;
    shares: number | null;
    valueUsd: number;
    weightPct: number | null;
    deltaShares: number | null;
    deltaWeightPct: number | null;
    isNew: boolean;
}

export interface SecurityConsensus {
    cusip: string;
    name: string;
    mappedTicker: string | null;
    periodOfReport: string; // 'YYYY-MM-DD'
    holderCountActive: number;
    holderCountTotal: number;
    activeValueUsd: number | null;
    holders: ConsensusHolder[]; // value-desc
}
