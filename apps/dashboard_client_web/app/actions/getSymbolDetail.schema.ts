// app/actions/getSymbolDetail.schema.ts
// Purpose: Zod runtime schema mirroring GET /v1/api/securities/:ticker/by-ticker.
// Invariant: SymbolDetailSchema's z.infer MUST stay structurally equal to
//   SymbolDetail (types/symbolDetail.ts). The AssertEqual guard fails typecheck
//   on drift. `data:null` is a valid response and is handled by the action.
//   politicianActivity is .optional() so that a stale Next Data Cache body
//   (pre-migration-0022) still parses without error — lenient-parsing rule.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { SymbolDetail } from '@/types/symbolDetail';

export const symbolRankingEntrySchema = z.object({
    asOf: z.string(),
    scope: z.string(),
    rank: z.number(),
    marketCap: z.number().nullable(),
});

export const symbolHolderSchema = z.object({
    cik: z.string(),
    label: z.string(),
    isActiveManager: z.boolean(),
    valueUsd: z.number(),
    weightPct: z.number().nullable(),
    deltaWeightPct: z.number().nullable(),
    isNew: z.boolean(),
});

export const pricePointSchema = z.object({
    t: z.string(),
    close: z.number(),
});

export const symbolPoliticianActivitySchema = z.object({
    count90d: z.number(),
    buyMembers: z.number(),
    sellMembers: z.number(),
    netDirection: z.enum(['buy_skew', 'sell_skew', 'mixed']),
    latestDisclosure: z.string(),
    clusterFlag: z.boolean(),
});

export const symbolDetailSchema = z.object({
    ticker: z.string(),
    sector: z.string().nullable(),
    rankingHistory: z.array(symbolRankingEntrySchema),
    holders: z.array(symbolHolderSchema),
    periodOfReport: z.string().nullable(),
    priceHistory: z.array(pricePointSchema),
    // Optional: absent when migration 0022 not yet applied (lenient-parse contract).
    politicianActivity: symbolPoliticianActivitySchema.nullable().optional(),
});

export type SymbolDetailSchema = z.infer<typeof symbolDetailSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _symbolDetailAligns: AssertEqual<SymbolDetailSchema, SymbolDetail> = true;
void _symbolDetailAligns;
