// apis/getMe.api.ts
// Purpose: fetch the authenticated user's profile from the backend.
// Constraints: requires a Clerk bearer token; pure I/O, no hidden state.

import axios_instance from '@/apis/axios_instance';

export type TMe = {
    userId: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isAdmin: boolean;
    needsOnboarding: boolean;
};

// The response interceptor unwraps `response.data`, so the resolved value is TMe.
export async function getMe(token: string): Promise<TMe> {
    return axios_instance.get<unknown, TMe>('/v1/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
    });
}
