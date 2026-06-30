// Purpose: Server Action returning a dashboard snapshot from the Express backend.
// Cache: next.revalidate=1800 (30min) — kept in phase with the Express s-maxage
//   on /v1/api/dashboard/snapshot so the SSR Data Cache and the edge CDN expire
//   together (validated by system-architect).
// Invariant: never throws raw — failures are returned as a typed error result
//   AND forwarded to the error_log sink (source='ssr'). NO mock fallback.
// Access: backend endpoint is public market data — no Clerk token forwarded by design.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import {
    dashboardSnapshotSchema,
    type DashboardSnapshot,
} from '@/app/actions/getDashboardSnapshot.schema';

const SNAPSHOT_ENDPOINT = '/v1/api/dashboard/snapshot';
const REVALIDATE_SECONDS = 1800; // 30min — must match Express s-maxage

export type SnapshotErrorKind = 'network' | 'parse';

export interface SnapshotError {
    kind: SnapshotErrorKind;
    message: string;
}

export type SnapshotResult =
    | { ok: true; data: DashboardSnapshot }
    | { ok: false; error: SnapshotError };

export async function getDashboardSnapshot(): Promise<SnapshotResult> {
    let payload: unknown;
    try {
        const res = await fetch(`${API_BASE}${SNAPSHOT_ENDPOINT}`, {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(
                `snapshot HTTP ${res.status}`,
                SNAPSHOT_ENDPOINT
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
        await reportSsrError(`snapshot ${message}`, SNAPSHOT_ENDPOINT);
        return { ok: false, error: { kind: 'network', message } };
    }

    const parsed = dashboardSnapshotSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `snapshot parse: ${parsed.error.message}`,
            SNAPSHOT_ENDPOINT
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
