// Purpose: Server Action wrapping the batch price-series fetcher (Phase X).
// Returns a discriminated union so callers handle the error branch explicitly
// without throwing across the server/client boundary.
// Invariant: mock fallback NOT included — real path only; explicit error state
//   for network failures keeps this action pure (no hidden fallback behavior).
// Access: public read — no Clerk token forwarded (market data, no user scope).
// Side effects: one network fetch; a best-effort SSR error POST on failure.

'use server';

import { getPriceSeries } from '@/apis/getPriceSeries.api';
import { reportSsrError } from '@/apis/reportSsrError.server';
import type {
    TPriceSeriesResponse,
    TPriceSeriesParams,
} from '@/apis/getPriceSeries.api';

const ENDPOINT = '/v1/api/dashboard/history/batch';

export type PriceSeriesErrorKind = 'network' | 'validation';

export interface PriceSeriesError {
    kind: PriceSeriesErrorKind;
    message: string;
}

export type PriceSeriesResult =
    | { ok: true; data: TPriceSeriesResponse }
    | { ok: false; error: PriceSeriesError };

export async function getPriceSeriesAction(
    params: TPriceSeriesParams
): Promise<PriceSeriesResult> {
    try {
        const data = await getPriceSeries(params);
        return { ok: true, data };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`price-series ${message}`, ENDPOINT);
        return {
            ok: false,
            error: { kind: 'network', message },
        };
    }
}
