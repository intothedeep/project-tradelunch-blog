// Purpose: global popular-tags read endpoint. Mounted at /api/tags so it resolves
//          to GET /v1/api/tags (NOT under /api/posts — that would wrongly yield
//          /api/posts/tags). Viewer-agnostic; safe for a shared/anonymous cache.
import { Router, Request } from 'express';
import { pool } from '../../database';
import { clampTagLimit, listPopularTags } from '../../helpers/popularTags';

export const router = Router();

/**
 * @api {get} /tags Global popular tags
 * @apiName GetPopularTags
 * @apiGroup Tags
 *
 * @apiQuery {Number} [limit=30] Max tags (clamped to 100).
 * @apiSuccess {Boolean} success
 * @apiSuccess {Object[]} data TPopularTag[] — { tag, count }, count desc then tag asc.
 */
router.get('', async (req: Request<{}, {}, {}, { limit?: string }>, res) => {
    try {
        const limit = clampTagLimit(req.query.limit);
        const tags = await listPopularTags(pool, limit);
        res.json({ success: true, data: tags });
    } catch (error) {
        console.error('API Error fetching popular tags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tags',
        });
    }
});

export default router;
