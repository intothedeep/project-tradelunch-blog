import 'server-only';

// apis/http.server.ts
// Purpose: single native-`fetch` wrapper for server-side requests to the
// Express backend. All requests are always `no-store` — Cloudflare is the
// sole edge cache; Next.js tag-based revalidation is not used.
// Constraints: server-only (token must never reach the browser). Side effects
// are isolated here; callers stay declarative.

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
};

export async function serverRequest<T>({
    path,
    method = 'GET',
    body,
    token,
    signal,
    fallbackError,
}: TServerRequest): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: buildHeaders(token, body),
        body: encodeBody(body),
        // Always bypass Next's fetch cache — Cloudflare is the single edge
        // cache. This prevents stale SSR output from being served to viewers
        // after a publish or status change.
        cache: 'no-store',
        signal: composeSignal(signal),
    });

    return parseResponse<T>(res, fallbackError);
}
