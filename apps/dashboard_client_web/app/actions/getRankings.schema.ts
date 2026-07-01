// Purpose: Zod runtime schema mirroring the GET /v1/api/rankings contract.
// Invariant: RankingsSnapshotSchema's z.infer MUST stay structurally equal to
//   RankingsSnapshot (see types/rankings.ts). The alignment assertion below
//   fails typecheck if the two ever drift. `data:null` is a valid response
//   (table/weekly data absent) and is passed through as { ok:true, data:null }.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { RankingsSnapshot } from '@/types/rankings';

export const rankingEntrySchema = z.object({
    rank: z.number(),
    symbol: z.string(),
    sector: z.string().nullable(),
    marketCap: z.number().nullable(),
});

export const rankingsSnapshotSchema = z.object({
    asOf: z.string(),
    scope: z.enum(['global', 'sector']),
    sector: z.string().nullable(),
    sectors: z.array(z.string()),
    rows: z.array(rankingEntrySchema),
});

export type RankingsSnapshotSchema = z.infer<typeof rankingsSnapshotSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _rankingsAligns: AssertEqual<RankingsSnapshotSchema, RankingsSnapshot> =
    true;
void _rankingsAligns;
