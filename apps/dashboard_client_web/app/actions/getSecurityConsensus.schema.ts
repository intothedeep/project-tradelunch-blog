// app/actions/getSecurityConsensus.schema.ts
// Purpose: Zod runtime schema mirroring GET /v1/api/securities/:cusip/consensus.
// Invariant: SecurityConsensusSchema's z.infer MUST stay structurally equal to
//   SecurityConsensus (types/consensus.ts). The AssertEqual guard fails typecheck
//   on drift. `data:null` is a valid response and is handled by the action.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { SecurityConsensus } from '@/types/consensus';

export const consensusHolderSchema = z.object({
    cik: z.string(),
    label: z.string(),
    isActiveManager: z.boolean(),
    shares: z.number().nullable(),
    valueUsd: z.number(),
    weightPct: z.number().nullable(),
    deltaShares: z.number().nullable(),
    deltaWeightPct: z.number().nullable(),
    isNew: z.boolean(),
});

export const securityConsensusSchema = z.object({
    cusip: z.string(),
    name: z.string(),
    mappedTicker: z.string().nullable(),
    periodOfReport: z.string(),
    holderCountActive: z.number(),
    holderCountTotal: z.number(),
    activeValueUsd: z.number().nullable(),
    holders: z.array(consensusHolderSchema),
});

export type SecurityConsensusSchema = z.infer<typeof securityConsensusSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _consensusAligns: AssertEqual<SecurityConsensusSchema, SecurityConsensus> = true;
void _consensusAligns;
