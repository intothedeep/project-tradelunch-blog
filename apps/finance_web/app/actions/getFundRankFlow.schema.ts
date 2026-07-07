// app/actions/getFundRankFlow.schema.ts
// Purpose: Zod runtime schema mirroring GET /v1/api/funds/:cik/rankflow response.
// Invariant: RankFlowSchema's z.infer MUST stay structurally equal to
//   RankFlow (see types/rankFlow.ts). The AssertEqual guard below fails
//   typecheck if the two ever drift. `data:null` is a valid response (unknown
//   fund) and is passed through as { ok:true, data:null } by the action.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { RankFlow } from '@/types/rankFlow';

export const rankFlowCellSchema = z.object({
    rank: z.number(),
    weightPct: z.number(),
    valueUsd: z.number(),
});

export const rankFlowPeriodSchema = z.object({
    periodOfReport: z.string(),
    totalValueUsd: z.number(),
    remainingCount: z.number(),
    remainingWeightPct: z.number(),
});

export const rankFlowRowSchema = z.object({
    cusip: z.string(),
    label: z.string(),
    cells: z.record(z.string(), rankFlowCellSchema.nullable()),
});

export const rankFlowSchema = z.object({
    cik: z.string(),
    periods: z.array(rankFlowPeriodSchema),
    rows: z.array(rankFlowRowSchema),
});

export type RankFlowSchema = z.infer<typeof rankFlowSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _rankFlowAligns: AssertEqual<RankFlowSchema, RankFlow> = true;
void _rankFlowAligns;
