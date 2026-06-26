// utils/apiError.util.ts
// Purpose: normalize axios failures into a single typed ApiError carrying the
// HTTP status + server message, so .api.ts fetchers surface non-2xx uniformly
// (mirrors the UsernameClaimError pattern without duplicating it per fetcher).
// Constraints: pure transform; no I/O, no hidden state.

import axios from 'axios';

export class ApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

// Convert an unknown thrown value into an ApiError when it is an axios HTTP
// error; otherwise return it unchanged so callers can rethrow as-is.
export function toApiError(error: unknown, fallback: string): unknown {
    if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const message =
            (error.response.data as { message?: string } | undefined)
                ?.message ?? fallback;
        return new ApiError(status, message);
    }
    return error;
}
