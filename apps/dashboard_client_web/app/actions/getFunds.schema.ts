// Purpose: Zod runtime schema mirroring the GET /v1/api/funds contract.
// Invariant: FundsListSchema's z.infer MUST stay structurally equal to
//   Fund[] (see types/funds.ts). The alignment assertion below fails
//   typecheck if the two ever drift.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { Fund } from '@/types/funds';

export const fundSchema = z.object({
    cik: z.string(),
    label: z.string(),
    periodOfReport: z.string(),
    holdingsCount: z.number(),
});

export const fundsListSchema = z.array(fundSchema);

export type FundSchema = z.infer<typeof fundSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _fundAligns: AssertEqual<FundSchema, Fund> = true;
void _fundAligns;
