// Purpose: authenticated self-service profile routes (read profile + onboarding
//          username claim + draft listing) for the signed-in Clerk identity.
// Invariants:
//   * Every route is gated by requireAuth; identity comes from req.auth ONLY.
//   * needsOnboarding is true exactly when the account has no username yet.
// Side effects: DB reads/writes scoped to the caller's own row.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import { validateUsername } from '../../helpers/validateUsername';
import { claimUsername } from '../../helpers/claimUsername';
import { listDrafts } from '../../helpers/listDrafts';

export const router = Router();

/**
 * @api {get} /api/users/me Get the signed-in user's profile
 * @apiName GetMe
 * @apiGroup Users
 */
router.get('/me', requireAuth, async (req, res) => {
    try {
        const userId = req.auth!.userId;
        const { rows } = await pool.query<{
            id: number;
            username: string | null;
            display_name: string | null;
            avatar_url: string | null;
            is_admin: boolean;
        }>(
            `SELECT id, username, display_name, avatar_url, is_admin
             FROM users
             WHERE id = $1 AND deleted_at IS NULL`,
            [userId]
        );

        const user = rows[0];
        if (!user) {
            res.status(404).json({ success: false, message: 'user not found' });
            return;
        }

        res.json({
            userId: user.id,
            username: user.username,
            displayName: user.display_name,
            avatarUrl: user.avatar_url,
            isAdmin: Boolean(user.is_admin),
            needsOnboarding: user.username === null,
        });
    } catch (error) {
        console.error('GET /api/users/me error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to load profile',
        });
    }
});

/**
 * @api {post} /api/users/me/username Claim a username (onboarding)
 * @apiName ClaimUsername
 * @apiGroup Users
 */
router.post('/me/username', requireAuth, async (req, res) => {
    try {
        const raw = (req.body as { username?: unknown } | undefined)?.username;
        if (typeof raw !== 'string') {
            res.status(400).json({
                success: false,
                message: 'username is required',
            });
            return;
        }

        const parsed = validateUsername(raw);
        if (!parsed.ok) {
            res.status(400).json({ success: false, message: parsed.reason });
            return;
        }

        const result = await claimUsername(
            pool,
            req.auth!.userId,
            parsed.value
        );
        if (!result.ok) {
            res.status(result.status).json({
                success: false,
                message: result.reason,
            });
            return;
        }

        res.status(200).json({
            userId: req.auth!.userId,
            username: result.username,
        });
    } catch (error) {
        console.error('POST /api/users/me/username error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to claim username',
        });
    }
});

/**
 * @api {get} /api/users/me/drafts List the signed-in user's drafts
 * @apiName GetMyDrafts
 * @apiGroup Users
 */
router.get('/me/drafts', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(
            parseInt(String(req.query.limit ?? '50'), 10) || 50,
            100
        );
        const drafts = await listDrafts(pool, req.auth!.userId, limit);
        res.json({ success: true, data: drafts });
    } catch (error) {
        console.error('GET /api/users/me/drafts error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to load drafts',
        });
    }
});

export default router;
