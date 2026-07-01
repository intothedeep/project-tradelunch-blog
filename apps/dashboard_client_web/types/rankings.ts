// types/rankings.ts
// Purpose: Shared TS interfaces for the weekly market-cap rankings contract.
// Invariant: these shapes mirror the Express endpoint response exactly.
//   GET /v1/api/rankings → RankingsSnapshot | null
// Side effects: none (type declarations only).

export type RankingScope = 'global' | 'sector';

export interface RankingEntry {
    rank: number;
    symbol: string;
    sector: string | null;
    marketCap: number | null;
}

export interface RankingsSnapshot {
    asOf: string; // YYYY-MM-DD — the week actually returned (resolved)
    scope: RankingScope;
    sector: string | null; // selected sector when scope=sector, else null
    sectors: string[]; // sector filter options for asOf
    availableWeeks: string[]; // distinct weeks, newest-first — drives the picker
    rows: RankingEntry[];
}
