// controllers/users/index.ts
// GET /v1/api/users/me — the signed-in user's profile for finance_web.
// Auth: Clerk token (attached by clerkMiddleware in index.ts).
// isAdmin source: Clerk publicMetadata.isAdmin — NOT a DB users table. This
//   keeps finance_api decoupled from the blog's Supabase users table, so it
//   works unchanged against the Oracle VM PG17 instance (which has no users).
//   To grant admin: Clerk dashboard → user → publicMetadata { "isAdmin": true }.
import { Router } from 'express';
import { getAuth, clerkClient } from '@clerk/express';

export const router = Router();

router.get('/me', async (req, res) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            res.status(401).json({ success: false, message: 'unauthenticated' });
            return;
        }

        const user = await clerkClient.users.getUser(userId);
        const isAdmin = user.publicMetadata?.isAdmin === true;
        const displayName =
            [user.firstName, user.lastName].filter(Boolean).join(' ') || null;

        res.json({
            userId,
            username: user.username ?? null,
            displayName,
            avatarUrl: user.imageUrl ?? null,
            isAdmin,
            needsOnboarding: false,
        });
    } catch (error) {
        console.error('GET /v1/api/users/me error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to load profile',
        });
    }
});

export default router;
