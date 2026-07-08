import 'server-only';

// apis/getPriceSeries.api.ts
// Purpose: server-only fetcher for the batch price-series endpoint (Phase X).
// Feeds the client backtest engine; NOT used client-side.
// Cache: 24h ISR — price data refreshes once/day at the daily cron boundary.
//   Labels are sorted before joining so QQQ,JEPQ and JEPQ,QQQ share one cache slot.
// Constraint: ≤15 labels enforced here AND on the Express side (belt-and-suspenders).

import { serverRequest } from '@/apis/http.server';

const BATCH_PATH_PREFIX = '/v1/api/dashboard/history/batch';
const REVALIDATE_SECONDS = 86400; // 24h — data mutates once/day
const MAX_LABELS = 15;

// ─── Response types ──────────────────────────────────────────────────────────

export interface TPriceSeriesBar {
    date: string; // YYYY-MM-DD ISO date slice
    close: number; // adjusted close price
    dividends: number; // per-share dividend on this bar (0 on non-ex-div days)
    stockSplits: number; // split ratio on this bar (0 when no split)
}

/** Shape of the batch endpoint response `data` envelope. */
export type TPriceSeriesResponse = {
    series: Record<string, TPriceSeriesBar[]>;
};

export interface TPriceSeriesParams {
    /** Labels to fetch. Must be ≤15 after deduplication. */
    labels: string[];
    /** Inclusive range start — YYYY-MM-DD. */
    from: string;
    /** Inclusive range end — YYYY-MM-DD. */
    to: string;
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

export async function getPriceSeries({
    labels,
    from,
    to,
}: TPriceSeriesParams): Promise<TPriceSeriesResponse> {
    if (labels.length === 0 || labels.length > MAX_LABELS) {
        throw new Error(`labels must contain 1–${MAX_LABELS} entries`);
    }

    // Sort labels so QQQ,JEPQ and JEPQ,QQQ share the same edge-cache key.
    const sortedLabels = [...labels].sort().join(',');

    const qs = new URLSearchParams({
        labels: sortedLabels,
        from,
        to,
    }).toString();

    const envelope = await serverRequest<{
        success: boolean;
        data: TPriceSeriesResponse;
    }>({
        path: `${BATCH_PATH_PREFIX}?${qs}`,
        tags: ['backtest-series'],
        revalidate: REVALIDATE_SECONDS,
        fallbackError: 'Failed to fetch batch price series',
    });

    return envelope.data;
}
