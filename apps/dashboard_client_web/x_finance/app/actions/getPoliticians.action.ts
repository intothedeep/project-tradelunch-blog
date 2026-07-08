// Purpose: Server Action returning the list of politicians from the Express backend.
// Cache: next.revalidate=86400 (24h) — matches Express s-maxage on /v1/api/politicians.
//   PTR registries change rarely; daily revalidation is more than sufficient.
// Invariant: never throws raw — failures are returned as a typed error result
//   AND forwarded to the error_log sink (source='ssr'). NO mock fallback.
// Access: endpoint is public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { politiciansListSchema } from '@/app/actions/getPoliticians.schema';
import type { PoliticianListItem } from '@/app/actions/getPoliticians.schema';

const POLITICIANS_ENDPOINT = '/v1/api/politicians';
const REVALIDATE_SECONDS = 86400; // 24h — must match Express s-maxage

export type PoliticiansErrorKind = 'network' | 'parse';

export interface PoliticiansError {
    kind: PoliticiansErrorKind;
    message: string;
}

export type PoliticiansResult =
    | { ok: true; data: PoliticianListItem[] }
    | { ok: false; error: PoliticiansError };

export async function getPoliticians(): Promise<PoliticiansResult> {
    let payload: unknown;
    try {
        const res = await fetch(`${API_BASE}${POLITICIANS_ENDPOINT}`, {
            next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!res.ok) {
            await reportSsrError(
                `politicians HTTP ${res.status}`,
                POLITICIANS_ENDPOINT
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
        await reportSsrError(`politicians ${message}`, POLITICIANS_ENDPOINT);
        return { ok: false, error: { kind: 'network', message } };
    }

    const parsed = politiciansListSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `politicians parse: ${parsed.error.message}`,
            POLITICIANS_ENDPOINT
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
