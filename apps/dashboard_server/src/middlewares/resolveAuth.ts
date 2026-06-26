// Purpose: pure-ish resolution of a Clerk bearer token to a provisioned
//          users row. Shared by requireAuth / optionalAuth to avoid duplication.
// Invariants: a valid token whose `sub` has no users row is "unprovisioned"
//             (distinct from invalid token).
// Side effects: one DB read; one Clerk token verification (network).
import { verifyToken } from '@clerk/express';
import { pool } from '../database';
import { CLERK_SECRET_KEY } from '../config/env.schema';

export type TAuthIdentity = {
    userId: number;
    username: string;
    isAdmin: boolean;
};

export type TResolveAuthResult =
    | { kind: 'anonymous' } // no/invalid token
    | { kind: 'unprovisioned' } // valid token, no users row
    | { kind: 'authenticated'; identity: TAuthIdentity };

function readBearerToken(header?: string): string | undefined {
    if (!header) return undefined;
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return undefined;
    return token.trim() || undefined;
}

export async function resolveAuth(
    authorizationHeader?: string
): Promise<TResolveAuthResult> {
    const token = readBearerToken(authorizationHeader);
    if (!token || !CLERK_SECRET_KEY) return { kind: 'anonymous' };

    let clerkUserId: string;
    try {
        const payload = await verifyToken(token, {
            secretKey: CLERK_SECRET_KEY,
        });
        if (!payload.sub) return { kind: 'anonymous' };
        clerkUserId = payload.sub;
    } catch {
        return { kind: 'anonymous' };
    }

    const { rows } = await pool.query<{
        id: number;
        username: string;
        is_admin: boolean;
    }>(
        'SELECT id, username, is_admin FROM users WHERE clerk_user_id = $1 AND deleted_at IS NULL',
        [clerkUserId]
    );

    const user = rows[0];
    if (!user) return { kind: 'unprovisioned' };

    return {
        kind: 'authenticated',
        identity: {
            userId: user.id,
            username: user.username,
            isAdmin: Boolean(user.is_admin),
        },
    };
}
