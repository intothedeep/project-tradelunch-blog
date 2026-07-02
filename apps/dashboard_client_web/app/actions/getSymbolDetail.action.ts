// Purpose: Server Action returning per-ticker detail (ranking history + holders).
// Cache: cache:'no-store' — read fresh from Express every render, relying on
//   Express's own CDN cache (s-maxage=86400) for speed. We deliberately do NOT
//   use Next's Data Cache here: caching per-ticker responses caches a transient
//   `data:null` (e.g. a backend outage) for up to 24h and, because the frontend
//   is a separate Vercel project, a backend-only fix does not purge it — tickers
//   stay stuck on "not found" long after the backend recovers. no-store + the
//   Express CDN gives freshness without the double-cache stale-null trap.
// Invariant: a null data response (unknown ticker / tables absent) passes through
//   as { ok:true, data:null } — NOT an error. Raw throws are typed network
//   errors AND forwarded to error_log (source='ssr'). NO mock fallback.
// Access: public read-only data — no Clerk token forwarded.
// Side effects: one network fetch; a best-effort error POST on failure.

'use server';

import { API_BASE } from '@/env.schema';
import { reportSsrError } from '@/apis/reportSsrError.server';
import { symbolDetailSchema } from '@/app/actions/getSymbolDetail.schema';
import type { SymbolDetail } from '@/types/symbolDetail';

const SECURITIES_ENDPOINT = '/v1/api/securities';

export type SymbolDetailErrorKind = 'network' | 'parse';

export interface SymbolDetailError {
    kind: SymbolDetailErrorKind;
    message: string;
}

export type SymbolDetailResult =
    | { ok: true; data: SymbolDetail | null }
    | { ok: false; error: SymbolDetailError };

export async function getSymbolDetail(
    ticker: string
): Promise<SymbolDetailResult> {
    const path = `${SECURITIES_ENDPOINT}/${encodeURIComponent(ticker)}/by-ticker`;
    let payload: unknown;
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            cache: 'no-store',
        });
        if (!res.ok) {
            await reportSsrError(`symbolDetail HTTP ${res.status}`, path);
            return {
                ok: false,
                error: { kind: 'network', message: `HTTP ${res.status}` },
            };
        }
        const body: unknown = await res.json();
        payload = (body as { data?: unknown }).data;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'fetch failed';
        await reportSsrError(`symbolDetail ${message}`, path);
        return { ok: false, error: { kind: 'network', message } };
    }

    // Backend explicitly returns null for unknown ticker / absent tables.
    if (payload === null) {
        return { ok: true, data: null };
    }

    const parsed = symbolDetailSchema.safeParse(payload);
    if (!parsed.success) {
        await reportSsrError(
            `symbolDetail parse: ${parsed.error.message}`,
            path
        );
        return {
            ok: false,
            error: { kind: 'parse', message: parsed.error.message },
        };
    }

    return { ok: true, data: parsed.data };
}
