// apis/postUsername.api.ts
// Purpose: claim a username for the authenticated user.
// Constraints: requires a Clerk bearer token. Surfaces 400/409 as a typed
// error (UsernameClaimError) carrying the HTTP status + server message so the
// caller can render inline validation without re-inspecting internals.
// Express POST /v1/api/users/me/username returns { success, data: { userId, username } } envelope on 200.

import { clientRequest } from '@/apis/http.client';
import { ApiError } from '@/utils/apiError.util';

export type TUsernameClaim = { userId: string; username: string };

export class UsernameClaimError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'UsernameClaimError';
        this.status = status;
    }
}

export async function postUsername(
    token: string,
    username: string
): Promise<TUsernameClaim> {
    try {
        const env = await clientRequest<{
            success: boolean;
            data: TUsernameClaim;
        }>({
            path: '/v1/api/users/me/username',
            method: 'POST',
            body: { username },
            token,
            fallbackError: 'Failed to claim username',
        });
        return env.data;
    } catch (error) {
        if (error instanceof ApiError) {
            throw new UsernameClaimError(error.status, error.message);
        }
        throw error;
    }
}
