// utils/apiError.util.ts
// Purpose: normalize fetch failures into a single typed ApiError carrying the
// HTTP status + server message, so .api.ts fetchers surface non-2xx uniformly
// (mirrors the UsernameClaimError pattern without duplicating it per fetcher).
// Constraints: pure transform; no I/O beyond reading the Response body.

export class ApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
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
    try {
        const body = (await res.json()) as { message?: string } | undefined;
        if (body?.message) message = body.message;
    } catch {
        // non-JSON / empty body — keep the fallback message.
    }
    return new ApiError(res.status, message);
}
