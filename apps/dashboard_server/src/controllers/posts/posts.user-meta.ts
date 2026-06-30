// Purpose: lightweight per-author metadata routes (tags + profile card).
// Routes:
//   GET /users/:username/tags    — popular tag list for one author.
//   GET /users/:username/profile — author profile card (username, displayName,
//                                  avatarUrl, postCount).
// Constraints:
//   * Both routes are viewer-agnostic (no auth middleware).
//   * Multi-segment static routes — registered before /:postid so Express never
//     misroutes them to the single-post handler.

import { Router, Request } from 'express';
import { pool } from '../../database';
import { clampTagLimit, listUserPopularTags } from '../../helpers/popularTags';
import { getUserProfile } from '../../helpers/userProfile';

export function registerUserMetaRoutes(router: Router): void {
    /**
     * @api {get} /posts/users/:username/tags Popular tags for one author
     * @apiName GetUserPopularTags
     * @apiGroup Posts
     *
     * Multi-segment static route — registered ABOVE /:postid (defensive; Express 5
     * matches by segment count so /:postid cannot shadow it). Viewer-agnostic.
     */
    router.get(
        '/users/:username/tags',
        async (
            req: Request<{ username: string }, {}, {}, { limit?: string }>,
            res
        ) => {
            try {
                const { username } = req.params;
                const limit = clampTagLimit(req.query.limit);
                const tags = await listUserPopularTags(pool, username, limit);
                res.json({ success: true, data: tags });
            } catch (error) {
                console.error('API Error fetching user popular tags:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch tags',
                });
            }
        }
    );

    /**
     * @api {get} /posts/users/:username/profile Lightweight author profile card
     * @apiName GetUserProfile
     * @apiGroup Posts
     *
     * Multi-segment static route — registered ABOVE /:postid (defensive). Returns
     * { username, displayName, avatarUrl, postCount } (DISTINCT public slugs).
     * Viewer-agnostic. 404 when the user does not exist / is deleted.
     */
    router.get(
        '/users/:username/profile',
        async (req: Request<{ username: string }>, res) => {
            try {
                const { username } = req.params;
                const profile = await getUserProfile(pool, username);
                if (!profile) {
                    return res
                        .status(404)
                        .json({ success: false, message: 'User not found' });
                }
                res.json({ success: true, data: profile });
            } catch (error) {
                console.error('API Error fetching user profile:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch profile',
                });
            }
        }
    );
}
