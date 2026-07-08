// controllers/users/index.ts
// GET /v1/api/users/me — the signed-in user's profile for finance_web.
// Auth: Clerk token (attached by clerkMiddleware in index.ts).
// isAdmin source: OUR finance `users` table (see 0002_users.sql), NOT Clerk
//   publicMetadata. Clerk stays the identity/auth provider (signin/signup); on
//   first authenticated request we lazily mirror the Clerk user into our DB
//   (provisionUser), then read role from that row. Per-user domain data FKs to
//   users.id. To grant admin: SQL `UPDATE users SET is_admin=true WHERE ...`.
import { Router } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { pool } from '../../database';
import { provisionUser } from '../../helpers/provisionUser';
import { sendOk, sendError } from '../../helpers/response';

export const router = Router();

router.get('/me', async (req, res) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            sendError(res, 401, 'unauthenticated');
            return;
        }

        const user = await clerkClient.users.getUser(userId);
        const displayName =
            [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
        const primaryEmail =
            user.emailAddresses.find(
                (e) => e.id === user.primaryEmailAddressId
            )?.emailAddress ??
            user.emailAddresses[0]?.emailAddress ??
            null;

        // Mirror Clerk identity into our DB (lazy, idempotent) and read role from it.
        const row = await provisionUser(pool, {
            clerkUserId: userId,
            username: user.username ?? null,
            displayName,
            avatarUrl: user.imageUrl ?? null,
            email: primaryEmail,
        });
        if (!row) {
            sendError(res, 401, 'unprovisioned');
            return;
        }

        sendOk(res, {
            userId,
            username: user.username ?? null,
            displayName,
            avatarUrl: user.imageUrl ?? null,
            isAdmin: row.is_admin,
            needsOnboarding: false,
        });
    } catch (error) {
        console.error('GET /v1/api/users/me error:', error);
        sendError(res, 500, 'failed to load profile');
    }
});

export default router;
