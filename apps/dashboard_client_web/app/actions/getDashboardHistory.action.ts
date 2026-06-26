// Purpose: Server Action returning OHLC history for one item from the configured source.
// Flag: DASHBOARD_DATA_SOURCE ('mock' default | 'backend').
// Invariant: a missing item resolves to null (not an error); never throws raw.
// Access: backend endpoint is public market data — no Clerk token forwarded by design.
// Side effects: network fetch only when source==='backend'.

'use server';

import { API_BASE, DASHBOARD_DATA_SOURCE } from '@/env.schema';
import { MOCK_DASHBOARD_HISTORY } from '@/apis/getDashboardHistory.mock.api';
import {
    itemOHLCHistorySchema,
    type ItemOHLCHistory,
} from '@/app/actions/getDashboardHistory.schema';

const HISTORY_ENDPOINT = '/v1/api/dashboard/history';

export type HistoryErrorKind = 'network' | 'parse';

export interface HistoryError {
    kind: HistoryErrorKind;
    message: string;
}

export type HistoryResult =
    | { ok: true; data: ItemOHLCHistory | null }
    | { ok: false; error: HistoryError };

function fromMock(label: string): ItemOHLCHistory | null {
    const candles = MOCK_DASHBOARD_HISTORY[label];
    if (candles === undefined) {
        return null;
    }
    return { label, candles };
}

export async function getDashboardHistory(
    label: string,
    interval: string
): Promise<HistoryResult> {
    if (DASHBOARD_DATA_SOURCE === 'mock') {
        return { ok: true, data: fromMock(label) };
    }

    let payload: unknown;
    try {
        const params = new URLSearchParams({ label, interval });
        const res = await fetch(
            `${API_BASE}${HISTORY_ENDPOINT}?${params.toString()}`,
            { cache: 'no-store' }
        );
        if (!res.ok) {
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null for an unknown item — pass it through.
    if (payload === null) {
        return { ok: true, data: null };
    }

    const parsed = itemOHLCHistorySchema.safeParse(payload);
    if (!parsed.success) {
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
