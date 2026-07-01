// Purpose: global (non-user-scoped) post feed routes.
// Routes:
//   GET ''           — keyset-paginated global feed, slug-deduped (latest public revision).
//   GET /by-tag/:tag — global tag-filtered post feed, keyset-paginated, slug-deduped.
// Constraints:
//   * Viewer-agnostic responses (safe for shared CDN cache) when no auth token is present.
//   * optionalAuth only personalises viewer_liked when a token exists.
//   * CATEGORY_PATH_CTE is imported from ./posts.shared — do NOT redefine it here.

import { Router, Request } from 'express';
import { pool } from '../../database';
import { optionalAuth } from '../../middlewares/optionalAuth';
import {
    normalizeCursor,
    clampFeedLimit,
    listPostsByTag,
} from '../../helpers/postsByTag';
import { CATEGORY_PATH_CTE } from './posts.shared';

export function registerFeedRoutes(router: Router): void {
    /**
     * @api {get} GET /posts
     * @apiName GetUserPosts
     * @apiGroup Posts
     *
     * @apiParam {Number} [cursor=0] Cursor for pagination (post ID to start from).
     * @apiParam {Number} [limit=10] Number of posts per page.
     *
     * @apiSuccess {Boolean} success Indicates if the request was successful.
     * @apiSuccess {Object[]} posts List of the user's most recent posts for each slug.
     * @apiSuccess {String|null} nextCursor Next cursor value (null if no more posts).
     * @apiSuccess {Boolean} hasMore Indicates if more posts are available.
     *
     * CDN GUARDRAIL — the feed is cacheable-anonymous. `optionalAuth` only
     * personalizes `viewer_liked` WHEN a token is present; the client feed fetcher
     * (apis/getPosts.api.ts) intentionally sends NONE (viewer-likes are derived via
     * a separate client query — see 01.status.md FIX-like-persist), so every
     * response here is viewer-agnostic and safe for a shared cache. If you EVER
     * forward a per-user token to this route, the response becomes per-user — you
     * MUST then mark it `Cache-Control: private`/`no-store` or add
     * `Vary: Authorization`, or a CDN will serve one user's like-state to another.
     */
    router.get(
        '',
        optionalAuth,
        async (
            req: Request<{}, {}, {}, { cursor?: string; limit?: string }>,
            res
        ) => {
            try {
                const rawCursor =
                    typeof req.query.cursor === 'string'
                        ? req.query.cursor
                        : '';
                const cursorParam =
                    /^\d+$/.test(rawCursor) && rawCursor !== '0'
                        ? rawCursor
                        : '9223372036854775807';
                const limit = parseInt(req.query.limit || '10', 10);

                // Fetch one extra row to determine if there are more posts
                const fetchLimit = limit + 1;

                // EL3/L5: anon (viewerId -1, never matches a user_id) sees public
                // counts only; signed-in viewers get their own viewer_liked.
                const viewerId = req.auth?.userId ?? -1;

                const postsQuery = `
                WITH ${CATEGORY_PATH_CTE},
                ranked_posts AS (
                    SELECT
                        p.id,
                        p.user_id,
                        u.username,
                        p.slug,
                        p.title,
                        p.description,
                        p.content,
                        p.status,
                        p.created_at,
                        p.updated_at,
                        p.category_id,
                        f.stored_uri,
                        c.title as category,
                        cpath.path as category_path,
                        p.created_at as date,
                        ROW_NUMBER() OVER(PARTITION BY p.slug ORDER BY p.created_at DESC) as rn
                    FROM posts p
                    INNER JOIN users u ON p.user_id = u.id
                    LEFT JOIN files f ON p.id = f.post_id AND f.is_thumbnail = true
                    LEFT JOIN categories c ON c.id = p.category_id
                    LEFT JOIN cat_path cpath ON cpath.id = p.category_id

                    WHERE
                        p.deleted_at IS NULL
                        AND u.deleted_at IS NULL
                        AND p.status = 'public'
                        -- AND (f.deleted_at IS NULL OR f.deleted_at IS NOT NULL
                        AND p.id < $1
                )
                SELECT
                    id,
                    user_id,
                    username,
                    slug,
                    title,
                    description,
                    content,
                    status,
                    created_at,
                    updated_at,
                    category_id,
                    stored_uri,
                    category,
                    category_path,
                    date,
                    (SELECT ARRAY_AGG(pt.tag_title)
                     FROM post_tags pt
                     WHERE pt.post_id = ranked_posts.id
                       AND pt.deleted_at IS NULL
                    ) AS tags,
                    (SELECT COUNT(*)
                     FROM post_likes pl
                     WHERE pl.post_id = ranked_posts.id
                    )::int AS "likeCount",
                    EXISTS (
                        SELECT 1 FROM post_likes pl
                        WHERE pl.post_id = ranked_posts.id
                          AND pl.user_id = $3
                    ) AS "viewerLiked",
                    (SELECT COUNT(*)::int FROM comments cc
                      WHERE cc.post_id = ranked_posts.id
                        AND cc.deleted_at IS NULL) AS "commentCount"
                FROM ranked_posts
                WHERE rn = 1
                ORDER BY id DESC
                LIMIT $2
            `;

                const { rows } = await pool.query(postsQuery, [
                    cursorParam,
                    fetchLimit,
                    viewerId,
                ]);

                // Check if there are more posts
                const hasMore = rows.length > limit;
                const posts = hasMore ? rows.slice(0, limit) : rows;
                const nextCursor =
                    hasMore && posts.length > 0
                        ? posts[posts.length - 1].id
                        : null;

                const data = {
                    posts,
                    nextCursor,
                    hasMore,
                };

                res.json({
                    success: true,
                    data,
                });
            } catch (error) {
                console.error('API Error fetching user posts:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch posts',
                });
            }
        }
    );

    /**
     * @api {get} /posts/by-tag/:tag Global tag-filtered post feed
     * @apiName GetPostsByTag
     * @apiGroup Posts
     *
     * Keyset-paginated, slug-deduped (latest public revision per slug). Cursor is a
     * STRING (BIGINT precision). Registered ABOVE /:postid. Viewer-agnostic.
     */
    router.get(
        '/by-tag/:tag',
        async (
            req: Request<
                { tag: string },
                {},
                {},
                { cursor?: string; limit?: string }
            >,
            res
        ) => {
            try {
                const { tag } = req.params;
                const cursor = normalizeCursor(req.query.cursor);
                const limit = clampFeedLimit(req.query.limit);
                const data = await listPostsByTag(pool, { tag, cursor, limit });
                res.json({ success: true, data });
            } catch (error) {
                console.error('API Error fetching posts by tag:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch posts',
                });
            }
        }
    );
}
