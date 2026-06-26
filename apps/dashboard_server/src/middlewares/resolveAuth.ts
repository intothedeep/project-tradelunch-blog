// Purpose: pure-ish resolution of a Clerk bearer token to a provisioned
//          users row. Shared by requireAuth / optionalAuth to avoid duplication.
// Invariants: a valid token whose `sub` has no LIVE users row is "unprovisioned"
//             (only reachable when the clerk_user_id was soft-deleted: the
//             upsert's INSERT is blocked by ON CONFLICT and the SELECT is
//             filtered by deleted_at IS NULL).
//             When ALLOWED_ORIGINS_LIST is non-empty, the token's `azp` claim
//             must match one of those origins (Clerk authorizedParties hardening
//             against CSRF / subdomain cookie-leak token reuse); a foreign-party
//             token fails verification and resolves to anonymous. When the list
//             is empty (unset), this check is skipped so local/dev still works.
// Side effects: one DB upsert (read-or-create: INSERT ... ON CONFLICT DO NOTHING
//               then read), lazily provisioning a fresh users row on first sight
//               of a valid token; one Clerk token verification (network).
import { verifyToken, type VerifyTokenOptions } from '@clerk/express';
import { pool } from '../database';
import {
    CLERK_SECRET_KEY,
    ALLOWED_ORIGINS_LIST,
} from '../config/env.schema';

export type TAuthIdentity = {
    userId: number;
    username: string | null;
    isAdmin: boolean;
};

export type TResolveAuthResult =
    | { kind: 'anonymous' } // no/invalid token
    | { kind: 'unprovisioned' } // valid token, no live users row (soft-deleted)
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

    // Only enforce authorizedParties when origins are configured; an empty
    // array would break verification, so omit it for unset local/dev.
    const verifyOptions: VerifyTokenOptions = {
        secretKey: CLERK_SECRET_KEY,
        ...(ALLOWED_ORIGINS_LIST.length > 0
            ? { authorizedParties: ALLOWED_ORIGINS_LIST }
            : {}),
    };

    let clerkUserId: string;
    try {
        const payload = await verifyToken(token, verifyOptions);
        if (!payload.sub) return { kind: 'anonymous' };
        clerkUserId = payload.sub;
    } catch {
        return { kind: 'anonymous' };
    }

    // Race-safe lazy provisioning: INSERT the row if absent, otherwise read the
    // existing live row. A single round-trip; concurrent first requests for the
    // same clerk_user_id collapse to one row via ON CONFLICT DO NOTHING.
    const { rows } = await pool.query<{
        id: number;
        username: string | null;
        is_admin: boolean;
    }>(
        `WITH ins AS (
            INSERT INTO users (clerk_user_id)
            VALUES ($1)
            ON CONFLICT (clerk_user_id) DO NOTHING
            RETURNING id, username, is_admin
        )
        SELECT id, username, is_admin FROM ins
        UNION ALL
        SELECT id, username, is_admin FROM users
        WHERE clerk_user_id = $1 AND deleted_at IS NULL
        LIMIT 1`,
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
