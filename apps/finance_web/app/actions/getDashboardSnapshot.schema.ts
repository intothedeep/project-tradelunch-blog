// Purpose: Zod runtime schema mirroring the frozen IDashboardSnapshot contract.
// Invariant: dashboardSnapshotSchema's z.infer MUST stay structurally equal to
//   IDashboardSnapshot (see types/dashboard.ts). The aligns assertions below
//   fail typecheck if the two ever drift.
// Side effects: none (pure schema declaration).

import { z } from 'zod';
import type { IDashboardSnapshot } from '@/types/dashboard';

const dayChangeSchema = z.object({
    absolute: z.number(),
    percent: z.number(),
});

const dashboardItemSchema = z.object({
    label: z.string(),
    value: z.number(),
    change: dayChangeSchema,
});

const stockItemSchema = dashboardItemSchema.extend({
    ticker: z.string(),
    exchange: z.enum(['US', 'KRX']),
});

const categoryMetaSchema = z.object({
    asOf: z.string(),
    revalidateSeconds: z.number(),
});

const itemCategorySchema = z.object({
    meta: categoryMetaSchema,
    items: z.array(dashboardItemSchema),
});

const stockCategorySchema = z.object({
    meta: categoryMetaSchema,
    items: z.array(stockItemSchema),
});

export const dashboardSnapshotSchema = z.object({
    fetchedAt: z.string(),
    fx: itemCategorySchema,
    crypto: itemCategorySchema,
    indices: itemCategorySchema,
    rates: itemCategorySchema,
    stocks: stockCategorySchema,
});

export type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;

// Bidirectional structural-equality guard (compile-time only).
type AssertEqual<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? true
        : never
    : never;
const _snapshotAligns: AssertEqual<DashboardSnapshot, IDashboardSnapshot> =
    true;
void _snapshotAligns;
