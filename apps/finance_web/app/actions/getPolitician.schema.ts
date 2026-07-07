// app/actions/getPolitician.schema.ts
// Purpose: Zod runtime schema mirroring GET /v1/api/politicians/:filerId.
// Invariant: PoliticianDetailSchema's z.infer MUST stay structurally equal to
//   PoliticianDetail (types/politician.ts). The AssertEqual guard fails typecheck
//   on drift. `data:null` is a valid response — handled by the action, not here.
//   All band enums must match ValueBand from types/symbolDetail.ts exactly.
//   committees + committeeRelevant are .optional() so that stale Next Data Cache
//   bodies (pre-migration-0025) still parse without error — lenient-parsing rule.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { PoliticianDetail } from '@/types/politician';

const valueBandSchema = z.enum([
    '<$15K',
    '$15K–$50K',
    '$50K–$250K',
    '$250K–$1M',
    '>$1M',
    '—',
]);

const politicianCommitteeSchema = z.object({
    thomasId: z.string(),
    name: z.string(),
});

const politicianFilerSchema = z.object({
    filerId: z.string(),
    filerName: z.string(),
    party: z.string().nullable(),
    chamber: z.string().nullable(),
    state: z.string().nullable(),
    office: z.string().nullable(),
    photoUrl: z.string().nullable(),
    tradeCount: z.number().nullable(),
    purchases: z.number().nullable(),
    sales: z.number().nullable(),
    lateFilings: z.number().nullable(),
    estVolumeBand: valueBandSchema,
    // Optional: absent when migration 0025 not yet applied (lenient-parse contract).
    committees: z.array(politicianCommitteeSchema).optional(),
});

const politicianTickerSchema = z.object({
    ticker: z.string(),
    disclosedValueBand: valueBandSchema,
    sharePctOfFilerVolume: z.number().nullable(),
    rankInFilerVolume: z.number().nullable(),
    totalTickerCount: z.number().nullable(),
    netDirection: z.enum(['buy_skew', 'sell_skew', 'mixed']),
    latestDisclosure: z.string(),
    tradeCount: z.number(),
    // Optional: absent when Phase Q tables not yet applied (lenient-parse contract).
    committeeRelevant: z.boolean().optional(),
});

const politicianTimelineEntrySchema = z.object({
    quarter: z.string(),
    ticker: z.string(),
    netValueBand: valueBandSchema,
    buyValueBand: valueBandSchema,
    sellValueBand: valueBandSchema,
    direction: z.string(),
});

export const politicianDetailSchema = z.object({
    filer: politicianFilerSchema,
    tickers: z.array(politicianTickerSchema),
    timeline: z.array(politicianTimelineEntrySchema),
});

export type PoliticianDetailSchema = z.infer<typeof politicianDetailSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _politicianDetailAligns: AssertEqual<
    PoliticianDetailSchema,
    PoliticianDetail
> = true;
void _politicianDetailAligns;
