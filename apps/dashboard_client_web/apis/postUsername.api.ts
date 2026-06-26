// apis/postUsername.api.ts
// Purpose: claim a username for the authenticated user.
// Constraints: requires a Clerk bearer token. Surfaces 400/409 as a typed
// error (UsernameClaimError) carrying the HTTP status + server message so the
// caller can render inline validation without re-inspecting axios internals.

import axios from 'axios';
import axios_instance from '@/apis/axios_instance';

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
        return await axios_instance.post<unknown, TUsernameClaim>(
            '/v1/api/users/me/username',
            { username },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            const status = error.response.status;
            const message =
                (error.response.data as { message?: string } | undefined)
                    ?.message ?? 'Failed to claim username';
            throw new UsernameClaimError(status, message);
        }
        throw error;
    }
}
