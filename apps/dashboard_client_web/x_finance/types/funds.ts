// types/funds.ts
// Purpose: Shared TS interfaces for the SEC 13F funds viewer contract.
// Invariant: these shapes mirror the Express endpoint responses exactly.
//   GET /v1/api/funds        → Fund[]
//   GET /v1/api/funds/:cik   → FundHoldings | null
// Side effects: none (type declarations only).

export interface Fund {
    cik: string;
    label: string;
    periodOfReport: string;
    holdingsCount: number;
}

export interface Holding {
    cusip: string;
    nameOfIssuer: string;
    titleOfClass: string | null;
    ticker: string | null;
    shares: number | null;
    prnType: string;
    valueUsd: number;
    putCall: string;
    weightPct: number;
}

export interface FundHoldings {
    cik: string;
    label: string;
    periodOfReport: string;
    holdings: Holding[];
}
