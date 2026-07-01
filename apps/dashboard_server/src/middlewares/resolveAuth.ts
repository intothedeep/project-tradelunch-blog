// Purpose: pure-ish resolution of a Clerk bearer token to a provisioned
//          users row. Shared by requireAuth / optionalAuth to avoid duplication.
// Invariants: a valid token whose `sub` has no LIVE users row is "unprovisioned"
//             (only reachable when the clerk_user_id was soft-deleted).
//             When ALLOWED_ORIGINS_LIST is non-empty, the token's `azp` claim
//             must match one of those origins (Clerk authorizedParties hardening
//             against CSRF / subdomain cookie-leak token reuse); a foreign-party
//             token fails verification and resolves to anonymous. When the list
//             is empty (unset), this check is skipped so local/dev still works.
//             Identity linking is delegated to provisionUser (read-first →
//             email-adoption → create); see helpers/provisionUser.ts and the
//             _docs/resolveAuth.md reference.
// Side effects: one Clerk token verification (network); a DB read on every call
//               and, on first sight only, a verified-email fetch + one write.
import { verifyToken, type VerifyTokenOptions } from '@clerk/express';
import { pool } from '../database';
import { CLERK_SECRET_KEY, ALLOWED_ORIGINS_LIST } from '../config/env.schema';
import { provisionUser } from '../helpers/provisionUser';
import { fetchVerifiedPrimaryEmail } from '../lib/clerkUsers';

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

    // Read-first lazy provisioning with email-adoption. The verified email is
    // fetched ONLY on a first-sight miss (no network on the hot path).
    const user = await provisionUser(pool, clerkUserId, () =>
        fetchVerifiedPrimaryEmail(clerkUserId)
    );
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
