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
import { withSsrFetchLog } from '@/utils/ssrFetchLog.util';

// Isomorphic fetchers (getCategories, getComments, get-log-*) run in Server
// Components too. Those SSR calls must carry the origin key like serverRequest
// does, or Express logs ssr=false and the per-IP limit (all SSR = one VM IP)
// counts them (D12, traffic.design.md §7.4). The key is added ONLY when
// `window` is absent. ORIGIN_KEY is not NEXT_PUBLIC_, so Next never inlines it
// into the browser bundle, and http.server.ts (server-only) stays unimported.
function ssrOriginKeyHeaders(): Record<string, string> {
    if (typeof window !== 'undefined') return {};
    // Runtime-only secret read; it does not change build output, so it stays out of turbo.json.
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const key = process.env.ORIGIN_KEY;
    return key ? { 'x-origin-key': key } : {};
}

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
    const res = await withSsrFetchLog(
        { path, method, hasToken: Boolean(token) },
        () =>
            fetch(`${API_BASE}${path}${buildQuery(query)}`, {
                method,
                headers: {
                    ...buildHeaders(token, body),
                    ...ssrOriginKeyHeaders(),
                },
                body: encodeBody(body),
                signal: composeSignal(signal),
            })
    );
    return parseResponse<T>(res, fallbackError);
}
