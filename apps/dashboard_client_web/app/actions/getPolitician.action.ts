// app/actions/getPolitician.action.ts
// Purpose: Server Action returning per-politician profile (filer + tickers + timeline).
// Cache: cache:'no-store' — read fresh from Express every render, relying on
//   Express's own CDN cache (s-maxage=86400). Mirrors getSymbolDetail cache strategy.
// Invariant: a null data response (unknown filerId / tables absent) passes through
//   as { ok:true, data:null } — NOT an error. Raw throws are typed network errors
//   AND forwarded to error_log (source='ssr'). NO mock fallback.
// Access: public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { politicianDetailSchema } from '@/app/actions/getPolitician.schema';
import type { PoliticianDetail } from '@/types/politician';

const POLITICIANS_ENDPOINT = '/v1/api/politicians';

export type PoliticianErrorKind = 'network' | 'parse';

export interface PoliticianError {
    kind: PoliticianErrorKind;
    message: string;
}

export type PoliticianResult =
    | { ok: true; data: PoliticianDetail | null }
    | { ok: false; error: PoliticianError };

export async function getPolitician(
    filerId: string
): Promise<PoliticianResult> {
    const path = `${POLITICIANS_ENDPOINT}/${encodeURIComponent(filerId)}`;
    let payload: unknown;
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            cache: 'no-store',
        });
        if (!res.ok) {
            await reportSsrError(`politician HTTP ${res.status}`, path);
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`politician ${message}`, path);
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null for unknown filerId / absent tables.
    if (payload === null || payload === undefined) {
        return { ok: true, data: null };
    }

    const parsed = politicianDetailSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(`politician parse: ${parsed.error.message}`, path);
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
