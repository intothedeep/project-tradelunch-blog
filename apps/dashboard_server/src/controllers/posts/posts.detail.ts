// Purpose: single-post retrieval routes (by ID and by slug).
// Routes:
//   GET /:postid      — fetch one post by BIGINT id. Catch-all single-segment
//                       route → MUST be mounted LAST in the read-router barrel
//                       so it never shadows more specific routes above.
//   GET /slug/:slug   — fetch the most-recent public revision of a post by slug,
//                       optionally scoped to one author via ?username=.
// Constraints:
//   * optionalAuth personalises viewerLiked; anon viewer binds id = -1.
//   * postid is a BIGINT string — never parseInt (precision past 2^53).
//   * Soft-deleted posts are excluded (deleted_at IS NULL).

import { Router } from 'express';
import { pool } from '../../database';
import { optionalAuth } from '../../middlewares/optionalAuth';

export function registerDetailRoutes(router: Router): void {
    /**
     * @api {get} /posts/:postid Get a single post by its ID
     * @apiName GetPostById
     * @apiGroup Posts
     *
     * @apiParam {Number} postid The unique ID of the post.
     *
     * @apiSuccess {Boolean} success Indicates if the request was successful.
     * @apiSuccess {Object} data The post object.
     */
    router.get('/:postid', optionalAuth, async (req, res) => {
        try {
            const { postid } = req.params;
            // D2.7: anon sees only public; owner sees own post in any status.
            // $1 = postid, $2 = viewer user id (-1 = nobody, never matches user_id).
            // Rule-1: deleted posts are never selected (deleted_at IS NULL).
            const viewerId = req.auth?.userId ?? -1;
            const { rows: results } = await pool.query(
                `SELECT
                p.*,
                f.stored_uri,
                (SELECT ARRAY_AGG(pt.tag_title)
                 FROM post_tags pt
                 WHERE pt.post_id = p.id
                   AND pt.deleted_at IS NULL
                ) AS tags,
                (SELECT COUNT(*)
                 FROM post_likes pl
                 WHERE pl.post_id = p.id
                )::int AS "likeCount",
                EXISTS (
                    SELECT 1 FROM post_likes pl
                    WHERE pl.post_id = p.id AND pl.user_id = $2
                ) AS "viewerLiked",
                (SELECT COUNT(*)::int FROM comments cc
                  WHERE cc.post_id = p.id
                    AND cc.deleted_at IS NULL) AS "commentCount"
             FROM posts p
             LEFT JOIN files f ON p.id = f.post_id AND f.is_thumbnail = true
             WHERE p.id = $1
               AND p.deleted_at IS NULL
               AND (p.status = 'public' OR p.user_id = $2)`,
                [postid, viewerId]
            );
            const post = results[0];

            if (!post) {
                return res
                    .status(404)
                    .json({ success: false, message: 'Post not found' });
            }

            res.json({ success: true, data: post });
        } catch (error) {
            console.error(
                `API Error fetching post ${req.params.postid}:`,
                error
            );
            res.status(500).json({
                success: false,
                message: 'Failed to fetch post',
            });
        }
    });

    /**
     * @api {get} /posts/slug/:slug Get a single post by its slug and author's username
     * @apiName GetPostBySlug
     * @apiGroup Posts
     *
     * @apiParam {String} slug The unique slug of the post.
     * @apiQuery {String} [username] Optional username to filter by author.
     *
     * @apiSuccess {Boolean} success Indicates if the request was successful.
     * @apiSuccess {Object} data The most recent post object.
     */
    router.get('/slug/:slug', optionalAuth, async (req, res) => {
        try {
            const { slug } = req.params;
            const { username } = req.query;

            // D2.7: anon sees only public; owner sees own post in any status.
            // Positional params: $1 = slug; if username present $2 = username and
            // the viewer-id binds to $3, otherwise the viewer-id binds to $2.
            const viewerId = req.auth?.userId ?? -1;
            const viewerParamIndex = username ? 3 : 2;

            const query = `
			SELECT
                p.*,
                u.username,
                u.display_name,
                u.avatar_url,
                f.stored_uri,
                p.created_at as date,
                ARRAY_AGG(pt.tag_title) FILTER (WHERE pt.tag_title IS NOT NULL) AS tags,
                (SELECT COUNT(*)
                 FROM post_likes pl
                 WHERE pl.post_id = p.id
                )::int AS "likeCount",
                EXISTS (
                    SELECT 1 FROM post_likes pl
                    WHERE pl.post_id = p.id AND pl.user_id = $${viewerParamIndex}
                ) AS "viewerLiked",
                (SELECT COUNT(*)::int FROM comments cc
                  WHERE cc.post_id = p.id
                    AND cc.deleted_at IS NULL) AS "commentCount"
			FROM
                posts p
                INNER JOIN users u ON p.user_id = u.id
                LEFT JOIN files f ON p.id = f.post_id AND f.is_thumbnail = true
                LEFT JOIN post_tags pt ON p.id = pt.post_id AND pt.deleted_at IS NULL
			WHERE p.slug = $1
                AND p.deleted_at IS NULL
			${username ? 'AND u.username = $2' : ''}
                AND (p.status = 'public' OR p.user_id = $${viewerParamIndex})
            GROUP BY p.id, u.username, u.display_name, u.avatar_url, f.stored_uri
			ORDER BY p.created_at DESC
			LIMIT 1
		`;

            const params = username
                ? [slug, username, viewerId]
                : [slug, viewerId];
            const { rows: results } = await pool.query(query, params);
            const post = results[0];

            if (!post) {
                return res
                    .status(404)
                    .json({ success: false, message: 'Post not found' });
            }

            res.json({ success: true, data: post });
        } catch (error) {
            console.error(
                `API Error fetching post by slug ${req.params.slug}:`,
                error
            );
            res.status(500).json({
                success: false,
                message: 'Failed to fetch post',
            });
        }
    });
}
