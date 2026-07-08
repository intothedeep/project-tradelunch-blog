// apis/http.core.ts
// Purpose: pure, isomorphic building blocks shared by the server (serverRequest)
// and client (clientRequest) native-fetch wrappers — header assembly, 5s timeout
// signal composition, body encoding (FormData passthrough), query-string build,
// and response parsing into either T or a thrown ApiError.
// Constraints: NO server-only / browser-only-required APIs and NO Next cache
// directives (those live in http.server.ts). Pure transforms + one fetch parse
// helper. parseResponse resolves the HTTP body directly, matching the old axios
// response interceptor's `.data` unwrap so per-fetcher envelope handling is kept.

import { toFetchApiError } from '@/utils/apiError.util';

export const HTTP_TIMEOUT_MS = 5000;

export type TQueryValue = string | number | boolean | undefined;
export type TQuery = Record<string, TQueryValue>;

// Bearer token when present; JSON content-type ONLY for a non-FormData object
// body (FormData must set its own multipart boundary — never set it by hand).
export function buildHeaders(
    token?: string | null,
    body?: unknown
): HeadersInit {
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
export function composeSignal(signal?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(HTTP_TIMEOUT_MS);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

// FormData passes through untouched (browser sets the multipart boundary); any
// other defined body is JSON-encoded. undefined stays undefined (no body).
export function encodeBody(body?: unknown): BodyInit | undefined {
    if (body === undefined) return undefined;
    const isFormData =
        typeof FormData !== 'undefined' && body instanceof FormData;
    return isFormData ? (body as FormData) : JSON.stringify(body);
}

// Build a `?a=1&b=2` suffix from defined params (undefined skipped) so callers
// can write `path + buildQuery(q)`. Returns '' when there is nothing to add.
export function buildQuery(query?: TQuery): string {
    if (!query) return '';
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) usp.append(key, String(value));
    }
    const qs = usp.toString();
    return qs ? `?${qs}` : '';
}

// Parse a fetch Response into T. Non-ok → ApiError (fetch does not reject on
// 4xx/5xx). 204 / empty body → undefined. Resolves the HTTP body directly.
export async function parseResponse<T>(
    res: Response,
    fallbackError: string
): Promise<T> {
    if (!res.ok) throw await toFetchApiError(res, fallbackError);
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
}
