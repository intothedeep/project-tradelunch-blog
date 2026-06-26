// Purpose: Zod runtime schema mirroring the frozen IItemOHLCHistory contract.
// Invariant: z.infer MUST stay structurally equal to IItemOHLCHistory.
// Side effects: none.

import { z } from 'zod';
import type { IItemOHLCHistory } from '@/types/history';

const ohlcPointSchema = z.object({
    time: z.union([z.string(), z.number()]),
    open: z.number(),
    high: z.number(),
    low: z.number(),
    close: z.number(),
    volume: z.number(),
});

export const itemOHLCHistorySchema = z.object({
    label: z.string(),
    candles: z.array(ohlcPointSchema),
});

export type ItemOHLCHistory = z.infer<typeof itemOHLCHistorySchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _historyAligns: AssertEqual<ItemOHLCHistory, IItemOHLCHistory> = true;
void _historyAligns;
