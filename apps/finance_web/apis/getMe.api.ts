// apis/getMe.api.ts
// Purpose: fetch the authenticated user's profile from the backend.
// Constraints: requires a Clerk bearer token; pure I/O, no hidden state.
// Called from a client query hook (useMe.query.client) → clientRequest.
// Express GET /v1/api/users/me returns { success, data: TMe } envelope.

import { clientRequest } from '@/apis/http.client';

export type TMe = {
    userId: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isAdmin: boolean;
    needsOnboarding: boolean;
};

export async function getMe(token: string): Promise<TMe> {
    const env = await clientRequest<{ success: boolean; data: TMe }>({
        path: '/v1/api/users/me',
        token,
        fallbackError: 'Failed to load profile',
    });
    return env.data;
}
