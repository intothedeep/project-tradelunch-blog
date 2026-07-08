// utils/apiError.util.ts
// Purpose: normalize fetch failures into a single typed ApiError carrying the
// HTTP status + server message (+ parsed body), so .api.ts fetchers surface
// non-2xx uniformly (mirrors the UsernameClaimError pattern without duplicating
// it per fetcher).
// Constraints: pure transform; no I/O beyond reading the Response body.

export class ApiError extends Error {
    readonly status: number;
    // Parsed error-response body (when JSON). Lets callers read server-supplied
    // payload on non-2xx — e.g. createCategory reads the existing node from a
    // 409 conflict body. Undefined when the body was empty / non-JSON.
    readonly body?: unknown;

    constructor(status: number, message: string, body?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

// Convert a non-ok fetch Response into an ApiError. fetch (unlike axios) does
// NOT reject on 4xx/5xx, so server wrappers must inspect res.ok and build the
// error explicitly. Tolerant: a non-JSON / empty body falls back to `fallback`.
export async function toFetchApiError(
    res: Response,
    fallback: string
): Promise<ApiError> {
    let message = fallback;
    let body: unknown;
    try {
        body = await res.json();
        const msg = (body as { message?: string } | undefined)?.message;
        if (msg) message = msg;
    } catch {
        // non-JSON / empty body — keep the fallback message, body stays undefined.
    }
    return new ApiError(res.status, message, body);
}
