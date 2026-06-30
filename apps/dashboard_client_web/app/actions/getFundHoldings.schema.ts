// Purpose: Zod runtime schema mirroring the GET /v1/api/funds/:cik contract.
// Invariant: FundHoldingsSchema's z.infer MUST stay structurally equal to
//   FundHoldings (see types/funds.ts). The alignment assertion below fails
//   typecheck if the two ever drift. `data:null` is a valid response (unknown
//   fund) and is passed through as { ok:true, data:null } by the action.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { FundHoldings } from '@/types/funds';

export const holdingSchema = z.object({
    cusip: z.string(),
    nameOfIssuer: z.string(),
    titleOfClass: z.string().nullable(),
    ticker: z.string().nullable(),
    shares: z.number().nullable(),
    prnType: z.string(),
    valueUsd: z.number(),
    putCall: z.string(),
    weightPct: z.number(),
});

export const fundHoldingsSchema = z.object({
    cik: z.string(),
    label: z.string(),
    periodOfReport: z.string(),
    holdings: z.array(holdingSchema),
});

export type FundHoldingsSchema = z.infer<typeof fundHoldingsSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _holdingsAligns: AssertEqual<FundHoldingsSchema, FundHoldings> = true;
void _holdingsAligns;
