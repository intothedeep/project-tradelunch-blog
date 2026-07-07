// Purpose: Zod runtime schema mirroring the GET /v1/api/politicians list contract.
// Invariant: PoliticiansListSchema's z.infer MUST stay structurally equal to
//   PoliticianListItem[]. Side effects: none (pure schema declaration).

import { z } from 'zod';

export const politicianListItemSchema = z.object({
    filerId: z.string(),
    filerName: z.string(),
    party: z.string().nullable(),
    chamber: z.string().nullable(),
    state: z.string().nullable(),
    tradeCount: z.number().nullable(),
    purchases: z.number().nullable(),
    sales: z.number().nullable(),
});

export const politiciansListSchema = z.array(politicianListItemSchema);

export type PoliticianListItem = z.infer<typeof politicianListItemSchema>;
