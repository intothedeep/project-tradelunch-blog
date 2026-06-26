// Purpose: Server Action returning a dashboard snapshot from the configured source.
// Flag: DASHBOARD_DATA_SOURCE ('mock' default | 'backend').
// Invariant: never throws raw — failures are returned as a typed error result.
// Side effects: network fetch only when source==='backend'.

'use server';

import { API_BASE, DASHBOARD_DATA_SOURCE } from '@/env.schema';
import { MOCK_DASHBOARD_SNAPSHOT } from '@/apis/getDashboardSnapshot.mock.api';
import {
    dashboardSnapshotSchema,
    type DashboardSnapshot,
} from '@/app/actions/getDashboardSnapshot.schema';

const SNAPSHOT_ENDPOINT = '/v1/api/dashboard/snapshot';

export type SnapshotErrorKind = 'network' | 'parse';

export interface SnapshotError {
    kind: SnapshotErrorKind;
    message: string;
}

export type SnapshotResult =
    | { ok: true; data: DashboardSnapshot }
    | { ok: false; error: SnapshotError };

export async function getDashboardSnapshot(): Promise<SnapshotResult> {
    if (DASHBOARD_DATA_SOURCE === 'mock') {
        return { ok: true, data: MOCK_DASHBOARD_SNAPSHOT };
    }

    let payload: unknown;
    try {
        const res = await fetch(`${API_BASE}${SNAPSHOT_ENDPOINT}`, {
            cache: 'no-store',
        });
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

    const parsed = dashboardSnapshotSchema.safeParse(payload);
    if (!parsed.success) {
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
