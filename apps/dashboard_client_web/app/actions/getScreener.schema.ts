// app/actions/getScreener.schema.ts
// Purpose: Zod runtime schema mirroring GET /v1/api/securities/screen.
// Invariant: ScreenerDataSchema's z.infer MUST stay structurally equal to
//   ScreenerData (types/screener.ts). The AssertEqual guard fails typecheck on
//   drift. `data:null` is a valid response — handled by the action, not here.
//   politicianCount90d / politicianNetDirection are .optional() so that a stale
//   Next Data Cache body (pre-migration-0022) still parses without error —
//   lenient-parsing rule.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { ScreenerData } from '@/types/screener';

const scoreComponentsSchema = z.object({
    consensus: z.number(),
    capTier: z.number(),
    momentum: z.number().nullable(),
    lowVol: z.number().nullable(),
});

const screenerCandidateSchema = z.object({
    cusip: z.string(),
    name: z.string(),
    ticker: z.string().nullable(),
    rank: z.number().nullable(),
    marketCap: z.number().nullable(),
    holderCountActive: z.number(),
    holderCountTotal: z.number(),
    score: z.number(),
    components: scoreComponentsSchema,
    hasPriceSignals: z.boolean(),
    // Optional: absent when migration 0022 not yet applied (lenient-parse contract).
    politicianCount90d: z.number().nullable().optional(),
    politicianNetDirection: z.string().nullable().optional(),
});

export const screenerDataSchema = z.object({
    periodOfReport: z.string(),
    totalActiveFunds: z.number(),
    candidates: z.array(screenerCandidateSchema),
});

export type ScreenerDataSchema = z.infer<typeof screenerDataSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _screenerAligns: AssertEqual<ScreenerDataSchema, ScreenerData> = true;
void _screenerAligns;
