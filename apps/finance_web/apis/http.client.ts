// apis/http.client.ts
// Purpose: single native-fetch wrapper for CLIENT-side (browser) requests to the
// Express backend. Replaces the isomorphic axios_instance for client fetchers,
// mirroring its semantics: 5s timeout, per-call Clerk token, JSON/FormData body,
// ApiError on non-2xx, HTTP body resolved directly (matching the old response
// interceptor's `.data` unwrap).
// Constraints: NO Next cache directives — server-side cache/tags/revalidate live
// in http.server.ts. Side effects (the fetch) isolated here; callers stay
// declarative.

import { API_BASE } from '@/env.schema';
import {
    buildHeaders,
    buildQuery,
    composeSignal,
    encodeBody,
    parseResponse,
    type TQuery,
} from '@/apis/http.core';

export type TClientRequest = {
    path: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    token?: string | null;
    query?: TQuery;
    signal?: AbortSignal;
    fallbackError: string;
};

export async function clientRequest<T>({
    path,
    method = 'GET',
    body,
    token,
    query,
    signal,
    fallbackError,
}: TClientRequest): Promise<T> {
    const res = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
        method,
        headers: buildHeaders(token, body),
        body: encodeBody(body),
        signal: composeSignal(signal),
    });
    return parseResponse<T>(res, fallbackError);
}
