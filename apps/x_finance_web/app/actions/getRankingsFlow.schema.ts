// app/actions/getRankingsFlow.schema.ts
// Purpose: Zod runtime schema mirroring GET /v1/api/rankings/flow response.
// Invariant: RankingsFlowSchema MUST stay structurally equal to RankingsFlow
//   (types/rankingsFlow.ts). The AssertEqual guard below fails typecheck on drift.
//   data:null is valid (no data yet) and is passed through as { ok:true, data:null }.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { RankingsFlow } from '@/types/rankingsFlow';

export const rankingsFlowCellSchema = z.object({
    rank: z.number(),
    marketCap: z.number().nullable(),
});

export const rankingsFlowPeriodSchema = z.object({
    asOf: z.string(),
});

export const rankingsFlowRowSchema = z.object({
    symbol: z.string(),
    cells: z.record(z.string(), rankingsFlowCellSchema.nullable()),
});

export const rankingsFlowSchema = z.object({
    granularity: z.string(),
    periods: z.array(rankingsFlowPeriodSchema),
    rows: z.array(rankingsFlowRowSchema),
});

export type RankingsFlowSchema = z.infer<typeof rankingsFlowSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _rankingsFlowAligns: AssertEqual<RankingsFlowSchema, RankingsFlow> = true;
void _rankingsFlowAligns;
