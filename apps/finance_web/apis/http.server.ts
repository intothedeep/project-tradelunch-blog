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
import { toFetchApiError } from '@/utils/apiError.util';

const TIMEOUT_MS = 5000;

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

// Build request headers: bearer token when present; JSON content-type ONLY for
// a non-FormData object body (FormData must set its own multipart boundary).
function buildHeaders(token?: string | null, body?: unknown): HeadersInit {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const isFormData =
        typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

// Compose the 5s axios-parity timeout with any caller-supplied signal.
function composeSignal(signal?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

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
    const isFormData =
        typeof FormData !== 'undefined' && body instanceof FormData;

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: buildHeaders(token, body),
        body:
            body === undefined
                ? undefined
                : isFormData
                  ? (body as FormData)
                  : JSON.stringify(body),
        cache,
        // Critical guard: no `next` block under no-store (revalidate + no-store
        // are mutually exclusive in Next 16).
        next: cache === 'no-store' ? undefined : { tags, revalidate },
        signal: composeSignal(signal),
    });

    if (!res.ok) throw await toFetchApiError(res, fallbackError);

    // 204 / empty-body tolerant.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
}
