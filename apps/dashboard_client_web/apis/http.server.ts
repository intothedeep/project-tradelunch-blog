import 'server-only';

// apis/http.server.ts
// Purpose: single native-`fetch` wrapper for server-side requests to the
// Express backend. Default is `no-store` — Cloudflare is the sole edge cache;
// Next.js tag-based revalidation is not used.
// Constraints: server-only (token must never reach the browser). Side effects
// are isolated here; callers stay declarative.
//
// `revalidate` is a NARROW opt-out of that default, added 2026-09-22 after the
// Vercel quota outage. Phase CF's blanket `no-store` silently un-cached the
// dynamic OG image route, so every crawler hit re-rendered an ImageResponse
// (the most CPU-expensive work in the app) and refetched the whole post just to
// read its title — the likeliest cause of blowing Hobby's Active CPU budget.
// ONLY the OG route may pass it. Page/feed fetches stay `no-store` so a publish
// is never served stale. Do not widen this without revisiting Phase CF.

import { API_BASE } from '@/env.schema';
import {
    buildHeaders,
    composeSignal,
    encodeBody,
    parseResponse,
} from '@/apis/http.core';

export type TServerRequest = {
    path: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
    fallbackError: string;
    /** Seconds to cache in Next's Data Cache. Omit for the `no-store` default. */
    revalidate?: number;
};

export async function serverRequest<T>({
    path,
    method = 'GET',
    body,
    token,
    signal,
    fallbackError,
    revalidate,
}: TServerRequest): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: buildHeaders(token, body),
        body: encodeBody(body),
        // Default: bypass Next's fetch cache — Cloudflare is the single edge
        // cache. This prevents stale SSR output from being served to viewers
        // after a publish or status change. A `no-store` fetch also forces its
        // route dynamic, which is why an opted-in caller must set BOTH this and
        // its own route-segment `revalidate`.
        ...(revalidate === undefined
            ? { cache: 'no-store' as const }
            : { next: { revalidate } }),
        signal: composeSignal(signal),
    });

    return parseResponse<T>(res, fallbackError);
}
