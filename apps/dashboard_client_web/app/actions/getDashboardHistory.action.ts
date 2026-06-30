// Purpose: Server Action returning OHLC history for one item from the Express backend.
// Cache: next.revalidate=43200 (12h) — kept in phase with the Express s-maxage on
//   /v1/api/dashboard/history (past bars are immutable, one new bar/day).
// Param: range (1m|3m|6m|1y|5y|max) forwarded to the backend; default '1y' keeps
//   the chart payload light now that the DB holds full history.
// Invariant: a missing item resolves to null (not an error); never throws raw.
//   Failures are returned typed AND forwarded to error_log (source='ssr').
// Access: backend endpoint is public market data — no Clerk token forwarded by design.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import {
    itemOHLCHistorySchema,
    type ItemOHLCHistory,
} from '@/app/actions/getDashboardHistory.schema';

const HISTORY_ENDPOINT = '/v1/api/dashboard/history';
const REVALIDATE_SECONDS = 43200; // 12h — must match Express s-maxage
const DEFAULT_RANGE = '1y';

export type HistoryErrorKind = 'network' | 'parse';

export interface HistoryError {
    kind: HistoryErrorKind;
    message: string;
}

export type HistoryResult =
    | { ok: true; data: ItemOHLCHistory | null }
    | { ok: false; error: HistoryError };

export async function getDashboardHistory(
    label: string,
    interval: string,
    range: string = DEFAULT_RANGE
): Promise<HistoryResult> {
    let payload: unknown;
    try {
        const params = new URLSearchParams({ label, interval, range });
        const res = await fetch(
            `${API_BASE}${HISTORY_ENDPOINT}?${params.toString()}`,
            { next: { revalidate: REVALIDATE_SECONDS } }
        );
        if (!res.ok) {
            await reportSsrError(
                `history HTTP ${res.status}`,
                HISTORY_ENDPOINT
            );
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`history ${message}`, HISTORY_ENDPOINT);
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null for an unknown item — pass it through.
    if (payload === null) {
        return { ok: true, data: null };
    }

    const parsed = itemOHLCHistorySchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `history parse: ${parsed.error.message}`,
            HISTORY_ENDPOINT
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
