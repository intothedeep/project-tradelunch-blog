import 'server-only';

// apis/http.server.ts
// Purpose: single native-`fetch` wrapper for server-side requests to the
// Express backend, so Next 16 tag-based revalidation (cache/tags/revalidate) is
// expressible per call while keeping axios parity (5s timeout, ApiError).
// Invariant: NEVER pass `next` together with cache:'no-store' — Next ignores
// both and warns; the no-store branch omits `next` entirely.
// Constraints: server-only (token + cache directives must never reach the
// browser). Side effects are isolated here; callers stay declarative.

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
    cache?: RequestCache;
    tags?: string[];
    revalidate?: number;
    signal?: AbortSignal;
    fallbackError: string;
};

export async function serverRequest<T>({
    path,
    method = 'GET',
    body,
    token,
    cache,
    tags,
    revalidate,
    signal,
    fallbackError,
}: TServerRequest): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: buildHeaders(token, body),
        body: encodeBody(body),
        cache,
        // Critical guard: no `next` block under no-store (revalidate + no-store
        // are mutually exclusive in Next 16).
        next: cache === 'no-store' ? undefined : { tags, revalidate },
        signal: composeSignal(signal),
    });

    return parseResponse<T>(res, fallbackError);
}
