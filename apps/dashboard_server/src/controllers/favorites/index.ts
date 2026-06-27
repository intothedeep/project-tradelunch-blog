// Purpose: caller-scoped favorites routes (list / add / remove). All routes are
//          gated by requireAuth and act ONLY on req.auth.userId — a client-
//          supplied user id is never trusted. Mounted at /v1/api/favorites.
// Invariants:
//   * Snowflake post ids are STRINGS end-to-end — req.params.postId is passed to
//     the helper verbatim (never Number()/parseInt, which would truncate).
//   * POST is idempotent (helper uses ON CONFLICT DO NOTHING).
//   * Read/add/remove are scoped to req.auth.userId, so one user cannot read or
//     mutate another user's favorites.
// Side effects: DB reads/writes via the favorites helpers.
import { Router } from 'express';
import { pool } from '../../database';
import { requireAuth } from '../../middlewares/requireAuth';
import {
    listFavoritePostIds,
    addFavorite,
    removeFavorite,
} from '../../helpers/favorites';
import type { TFavoritesResponse, TFavoriteToggleResponse } from '@repo/types';

const router = Router();

// A Snowflake id is a non-empty run of digits; reject anything else with 400
// rather than letting node-pg raise a 500 on a malformed BIGINT bind.
function isValidPostId(value: string): boolean {
    return /^\d+$/.test(value);
}

router.get('', requireAuth, async (req, res) => {
    try {
        const postIds = await listFavoritePostIds(pool, req.auth!.userId);
        const payload: TFavoritesResponse = { postIds };
        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('GET /api/favorites error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to load favorites',
        });
    }
});

router.post('/:postId', requireAuth, async (req, res) => {
    try {
        const postId = String(req.params.postId);
        if (!isValidPostId(postId)) {
            res.status(400).json({ success: false, message: 'invalid post id' });
            return;
        }

        await addFavorite(pool, req.auth!.userId, postId);
        const payload: TFavoriteToggleResponse = { postId, favorited: true };
        res.json({ success: true, data: payload });
    } catch (error) {
        // FK violation (23503) = post_id does not exist → 404, not a 500.
        if ((error as { code?: string }).code === '23503') {
            res.status(404).json({ success: false, message: 'post not found' });
            return;
        }
        console.error('POST /api/favorites/:postId error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to add favorite',
        });
    }
});

router.delete('/:postId', requireAuth, async (req, res) => {
    try {
        const postId = String(req.params.postId);
        if (!isValidPostId(postId)) {
            res.status(400).json({ success: false, message: 'invalid post id' });
            return;
        }

        await removeFavorite(pool, req.auth!.userId, postId);
        const payload: TFavoriteToggleResponse = { postId, favorited: false };
        res.json({ success: true, data: payload });
    } catch (error) {
        console.error('DELETE /api/favorites/:postId error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to remove favorite',
        });
    }
});

export default router;
