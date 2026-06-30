// Purpose: author-scoped post feed routes.
// Routes:
//   GET /users/:username              — per-author keyset-paginated feed with optional
//                                       multi-category (&&-overlap) + multi-tag (EXISTS) filters.
//   GET /users/:username/by-tag/:tag  — per-author tag-filtered feed.
// Constraints:
//   * Authenticated owner may see own drafts/private (OR p.user_id = $4).
//     Response is then per-viewer → Cache-Control: private, no-store.
//   * Anonymous responses are CDN-cacheable (viewer-agnostic).
//   * CATEGORY_PATH_CTE is imported from ./posts.shared — do NOT redefine it here.

import { Router, Request } from 'express';
import { pool } from '../../database';
import { optionalAuth } from '../../middlewares/optionalAuth';
import { normalizeCursor, clampFeedLimit, listPostsByTag } from '../../helpers/postsByTag';
import { parseFeedFacet } from '../../helpers/parseFeedFacet';
import { CATEGORY_PATH_CTE } from './posts.shared';

export function registerUserFeedRoutes(router: Router): void {
    /**
     * @api {get} /posts/users/:username Get posts by a specific user
     * @apiName GetUserPosts
     * @apiGroup Posts
     *
     * @apiParam {String} username The username of the author.
     * @apiParam {Number} [cursor=0] Cursor for pagination (post ID to start from).
     * @apiParam {Number} [limit=10] Number of posts per page.
     * @apiParam {String} [categories] Comma-joined category titles — OR within the
     *   facet, ancestor-inclusive (matches any title in the category PATH).
     * @apiParam {String} [tags] Comma-joined tag titles — OR within the facet.
     * @apiParam {String} [category_title] Legacy single category title; folded into
     *   `categories` when `categories` is absent.
     *
     * @apiSuccess {Boolean} success Indicates if the request was successful.
     * @apiSuccess {Object[]} posts List of the user's most recent posts for each slug.
     * @apiSuccess {String|null} nextCursor Next cursor value (null if no more posts).
     * @apiSuccess {Boolean} hasMore Indicates if more posts are available.
     */
    router.get(
        '/users/:username',
        optionalAuth,
        async (
            req: Request<
                { username: string },
                {},
                {},
                {
                    cursor?: string;
                    limit?: string;
                    category_title?: string;
                    categories?: string;
                    tags?: string;
                }
            >,
            res
        ) => {
            try {
                const { username } = req.params;
                const rawCursor =
                    typeof req.query.cursor === 'string' ? req.query.cursor : '';
                const cursorParam =
                    /^\d+$/.test(rawCursor) && rawCursor !== '0'
                        ? rawCursor
                        : '9223372036854775807';
                const limit = parseInt(req.query.limit || '10', 10);

                // Multi-category filter ($5 text[]). OR within the facet via array
                // overlap (&&) against the category PATH, so each title matches
                // ANYWHERE in the path (ancestor-inclusive). Matches by TITLE (not
                // id): a title can map to several categories under different parents
                // (UNIQUE is (user_id, parent_id, title) since migration 0010), so
                // filtering by title intentionally MERGES same-titled categories.
                // Legacy single `category_title` is folded in when `categories` is
                // absent (server safety net). null = no filter (predicate skipped).
                const categoriesArr =
                    parseFeedFacet(req.query.categories) ??
                    parseFeedFacet(req.query.category_title);

                // Multi-tag filter ($6 text[]). OR within the facet via correlated
                // EXISTS against post_tags. tag_title is canonical-lowercase
                // (helpers/normalizeTags). null = no filter (predicate skipped).
                const tagsArr = parseFeedFacet(req.query.tags);

                // Fetch one extra row to determine if there are more posts
                const fetchLimit = limit + 1;

                const postsQuery = `
                WITH ${CATEGORY_PATH_CTE},
                ranked_posts AS (
                    SELECT
                        p.id,
                        p.user_id,
                        p.slug,
                        p.title,
                        p.description,
                        p.content,
                        p.status,
                        p.category_id,
                        p.updated_at,
                        p.created_at,
                        p.created_at as date,
                        f.stored_uri,
                        c.title as category,
                        cpath.path as category_path,
                        u.username,
                        u.display_name,
                        u.avatar_url,
                        ROW_NUMBER() OVER(PARTITION BY p.slug ORDER BY p.created_at DESC) as rn
                    FROM
                        posts p
                        INNER JOIN users u ON p.user_id = u.id
                        LEFT JOIN files f ON p.id = f.post_id AND f.is_thumbnail = true
                        LEFT JOIN categories c ON p.category_id = c.id
                        LEFT JOIN cat_path cpath ON cpath.id = p.category_id
                    WHERE
                        p.deleted_at IS NULL
                        AND u.username = $1
                        AND u.deleted_at IS NULL
                        AND (p.status = 'public' OR p.user_id = $4)
                        -- AND (f.deleted_at IS NULL OR f.deleted_at IS NOT NULL
                        AND p.id < $2
                        -- Multi-category filter ($5 null => no filter). OR within
                        -- the facet via array overlap (&&): a post matches when ANY
                        -- selected title appears ANYWHERE in its category PATH (not
                        -- just the leaf), so an ANCESTOR click includes descendant
                        -- posts. NULL path (uncategorized / broken chain) =>
                        -- excluded when filtering.
                        AND ($5::text[] IS NULL OR cpath.path && $5::text[])
                        -- Multi-tag filter ($6 null => no filter). OR within the
                        -- facet via correlated EXISTS (kept as EXISTS, NOT a JOIN,
                        -- so ROW_NUMBER PARTITION BY slug + the tag/category
                        -- aggregates below stay intact). Cross-attribute is AND
                        -- (this predicate is separate from the category one).
                        AND ($6::text[] IS NULL OR EXISTS (
                            SELECT 1 FROM post_tags pt
                            WHERE pt.post_id = p.id
                              AND pt.deleted_at IS NULL
                              AND pt.tag_title = ANY($6)
                        ))
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
                    display_name,
                    avatar_url,
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
                          AND pl.user_id = $4
                    ) AS "viewerLiked",
                    (SELECT COUNT(*)::int FROM comments cc
                      WHERE cc.post_id = ranked_posts.id
                        AND cc.deleted_at IS NULL) AS "commentCount"
                FROM ranked_posts
                WHERE rn = 1
                ORDER BY id DESC
                LIMIT $3
            `;

                // D2.3b: anon (viewerId -1, never matches) sees public only;
                // the owner sees their own drafts/private on their own profile.
                const viewerId = req.auth?.userId ?? -1;

                // Cache (Option X — TTL/SWR). Authenticated context = an owner may
                // see their own drafts via `OR p.user_id = $4`, so the response is
                // per-viewer and MUST NOT be shared-cached. Anonymous (no resolved
                // token => req.auth undefined) is viewer-agnostic and CDN-cacheable.
                if (req.auth) {
                    res.setHeader('Cache-Control', 'private, no-store');
                } else {
                    res.setHeader(
                        'Cache-Control',
                        'public, s-maxage=60, stale-while-revalidate=86400'
                    );
                }

                const { rows } = await pool.query(postsQuery, [
                    username,
                    cursorParam,
                    fetchLimit,
                    viewerId,
                    categoriesArr,
                    tagsArr,
                ]);

                // Check if there are more posts
                const hasMore = rows.length > limit;
                const posts = hasMore ? rows.slice(0, limit) : rows;
                const nextCursor =
                    hasMore && posts.length > 0 ? posts[posts.length - 1].id : null;

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
     * @api {get} /posts/users/:username/by-tag/:tag Author-scoped tag feed
     * @apiName GetUserPostsByTag
     * @apiGroup Posts
     *
     * As /by-tag/:tag but scoped to one author. Registered ABOVE /:postid.
     */
    router.get(
        '/users/:username/by-tag/:tag',
        async (
            req: Request<
                { username: string; tag: string },
                {},
                {},
                { cursor?: string; limit?: string }
            >,
            res
        ) => {
            try {
                const { username, tag } = req.params;
                const cursor = normalizeCursor(req.query.cursor);
                const limit = clampFeedLimit(req.query.limit);
                const data = await listPostsByTag(pool, {
                    tag,
                    cursor,
                    limit,
                    username,
                });
                res.json({ success: true, data });
            } catch (error) {
                console.error('API Error fetching user posts by tag:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch posts',
                });
            }
        }
    );
}
