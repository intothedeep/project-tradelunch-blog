import { pool } from '@/src/database';
import {
    ETreeNodeType,
    TCategoryTreeResponse,
    TTreeNode,
} from '@repo/types';

import { Router, Request } from 'express';

export const router = Router();

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
 */
router.get(
    '',
    async (
        req: Request<{}, {}, {}, { cursor?: string; limit?: string }>,
        res
    ) => {
        try {
            const cursor = parseInt(req.query.cursor || '0', 10);
            const limit = parseInt(req.query.limit || '10', 10);

            // Fetch one extra row to determine if there are more posts
            const fetchLimit = limit + 1;

            const postsQuery = `
                WITH ranked_posts AS (
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
                        p.created_at as date,
                        ROW_NUMBER() OVER(PARTITION BY p.slug ORDER BY p.created_at DESC) as rn
                    FROM posts p
                    INNER JOIN users u ON p.user_id = u.id
                    LEFT JOIN files f ON p.id = f.post_id AND f.is_thumbnail = true
                    LEFT JOIN categories c ON c.id = p.category_id

                    WHERE
                        p.deleted_at IS NULL
                        AND u.deleted_at IS NULL
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
                    date,
                    (SELECT ARRAY_AGG(pt.tag_title)
                     FROM post_tags pt
                     WHERE pt.post_id = ranked_posts.id
                       AND pt.deleted_at IS NULL
                    ) AS tags
                FROM ranked_posts
                WHERE rn = 1
                ORDER BY id DESC
                LIMIT $2
            `;

            const { rows } = await pool.query(postsQuery, [
                cursor || Number.MAX_SAFE_INTEGER,
                fetchLimit,
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
 * @api {get} /posts/users/:username Get posts by a specific user
 * @apiName GetUserPosts
 * @apiGroup Posts
 *
 * @apiParam {String} username The username of the author.
 * @apiParam {Number} [cursor=0] Cursor for pagination (post ID to start from).
 * @apiParam {Number} [limit=10] Number of posts per page.
 *
 * @apiSuccess {Boolean} success Indicates if the request was successful.
 * @apiSuccess {Object[]} posts List of the user's most recent posts for each slug.
 * @apiSuccess {String|null} nextCursor Next cursor value (null if no more posts).
 * @apiSuccess {Boolean} hasMore Indicates if more posts are available.
 */
router.get(
    '/users/:username',
    async (
        req: Request<
            { username: string },
            {},
            {},
            { cursor?: string; limit?: string }
        >,
        res
    ) => {
        try {
            const { username } = req.params;
            const cursor = parseInt(req.query.cursor || '0', 10);
            const limit = parseInt(req.query.limit || '10', 10);

            // Fetch one extra row to determine if there are more posts
            const fetchLimit = limit + 1;

            const postsQuery = `
                WITH ranked_posts AS (
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
                        u.username,
                        ROW_NUMBER() OVER(PARTITION BY p.slug ORDER BY p.created_at DESC) as rn
                    FROM
                        posts p
                        INNER JOIN users u ON p.user_id = u.id
                        LEFT JOIN files f ON p.id = f.post_id AND f.is_thumbnail = true
                        LEFT JOIN categories c ON p.category_id = c.id
                    WHERE
                        p.deleted_at IS NULL
                        AND u.username = $1
                        AND u.deleted_at IS NULL
                        -- AND (f.deleted_at IS NULL OR f.deleted_at IS NOT NULL
                        AND p.id < $2
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
                    date,
                    (SELECT ARRAY_AGG(pt.tag_title)
                     FROM post_tags pt
                     WHERE pt.post_id = ranked_posts.id
                       AND pt.deleted_at IS NULL
                    ) AS tags
                FROM ranked_posts
                WHERE rn = 1
                ORDER BY id DESC
                LIMIT $3
            `;

            const { rows } = await pool.query(postsQuery, [
                username,
                cursor || Number.MAX_SAFE_INTEGER,
                fetchLimit,
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
 * @api {get} /posts/:postid Get a single post by its ID
 * @apiName GetPostById
 * @apiGroup Posts
 *
 * @apiParam {Number} postid The unique ID of the post.
 *
 * @apiSuccess {Boolean} success Indicates if the request was successful.
 * @apiSuccess {Object} data The post object.
 */
router.get('/:postid', async (req, res) => {
    try {
        const { postid } = req.params;
        const { rows: results } = await pool.query(
            'SELECT * FROM posts WHERE id = $1',
            [postid]
        );
        const post = results[0];

        if (!post) {
            return res
                .status(404)
                .json({ success: false, message: 'Post not found' });
        }

        res.json({ success: true, data: post });
    } catch (error) {
        console.error(`API Error fetching post ${req.params.postid}:`, error);
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
router.get('/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { username } = req.query;

        const query = `
			SELECT
                p.*,
                u.username,
                f.stored_uri,
                p.created_at as date,
                ARRAY_AGG(pt.tag_title) FILTER (WHERE pt.tag_title IS NOT NULL) AS tags
			FROM
                posts p
                INNER JOIN users u ON p.user_id = u.id
                LEFT JOIN files f ON p.id = f.post_id AND f.is_thumbnail = true
                LEFT JOIN post_tags pt ON p.id = pt.post_id AND pt.deleted_at IS NULL
			WHERE p.slug = $1
			${username ? 'AND u.username = $2' : ''}
            GROUP BY p.id, u.username, f.stored_uri
			ORDER BY p.created_at DESC
			LIMIT 1
		`;

        const params = username ? [slug, username] : [slug];
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

// routes/posts.routes.ts
/**
 * @api {get} /posts/users/:username/categories Get user's post categories as tree
 * @apiName GetUserCategories
 * @apiGroup Posts
 *
 * @apiParam {String} username The username of the author.
 *
 * @apiSuccess {Boolean} success Indicates if the request was successful.
 * @apiSuccess {Object[]} categories Hierarchical category tree with post counts.
 */
router.get('/users/:username/categories', async (req, res) => {
    try {
        const { username } = req.params;

        const treeQuery = `
                WITH RECURSIVE category_tree AS (
                    -- 루트 카테고리
                    SELECT
                        c.id,
                        c.parent_id,
                        c.group_id,
                        c.level,
                        c.priority,
                        c.title,
                        LPAD(c.seq::text, 6, '0') AS path
                    FROM categories c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.parent_id IS NULL
                        AND c.deleted_at IS NULL
                        AND u.username = $1
                        AND u.deleted_at IS NULL

                    UNION ALL

                    -- 자식 카테고리
                    SELECT
                        c.id,
                        c.parent_id,
                        c.group_id,
                        c.level,
                        c.priority,
                        c.title,
                        ct.path || '.' || LPAD(c.seq::text, 6, '0') AS path
                    FROM categories c
                    JOIN category_tree ct ON c.parent_id = ct.id
                    JOIN users u ON c.user_id = u.id
                    WHERE c.deleted_at IS NULL
                        AND u.username = $1
                        AND u.deleted_at IS NULL
                    ),

                    user_posts AS (
                    -- 지정된 사용자의 게시글만 선택
                    SELECT
                        p.id,
                        p.seq,
                        p.slug,
                        p.title,
                        p.content,
                        p.description,
                        p.category_id,
                        p.priority,
                        p.created_at,
                        p.updated_at,
                        u.username
                    FROM posts p
                    JOIN users u ON u.id = p.user_id
                    WHERE u.username = $1
                        AND u.deleted_at IS NULL
                        AND p.deleted_at IS NULL
                        AND p.status = 'public'
                    ),

                    combined_tree_post AS (
                    -- 카테고리 노드
                    SELECT
                        '${ETreeNodeType.CATEGORY}' AS type,
                        ct.id,
                        ct.parent_id,
                        ct.group_id,
                        ct.level,
                        ct.priority,
                        ct.title,
                        NULL::BIGINT AS post_id,
                        NULL AS slug,
                        NULL AS content,
                        NULL AS description,
                        NULL::TIMESTAMP AS created_at,
                        NULL::TIMESTAMP AS updated_at,
                        NULL::VARCHAR AS username,
                        ct.path
                    FROM category_tree ct

                    UNION ALL

                    -- 게시글 노드 (카테고리 group_id 상속)
                    SELECT
                        '${ETreeNodeType.POST}' AS type,
                        p.id,
                        p.category_id AS parent_id,
                        ct.group_id AS group_id,
                        ct.level + 1 AS level,
                        p.priority,
                        p.title,
                        p.id AS post_id,
                        p.slug,
                        p.content,
                        p.description,
                        p.created_at,
                        p.updated_at,
                        p.username,
                        ct.path || '.' || LPAD(p.seq::text, 6, '0') AS path
                    FROM user_posts p
                    JOIN category_tree ct ON p.category_id = ct.id
                    )

                    SELECT
                        type,
                        id,
                        parent_id,
                        group_id,
                        level,
                        priority,
                        title,
                        post_id,
                        slug,
                        --content,
                        description,
                        created_at,
                        updated_at,
                        username,
                        path,
                        ROW_NUMBER() OVER (ORDER BY path) AS sort_key
                    FROM combined_tree_post
                    ORDER BY path;
            `;

        const { rows: categories } = await pool.query<TTreeNode>(treeQuery, [username]);

        const response: TCategoryTreeResponse = {
            status: 200,
            data: { categories },
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('API Error fetching categories:', error);
        res.status(500).json({
            status: 500,
            message: 'Failed to fetch categories',
        });
    }
});

// routes/posts.routes.ts
/**
 * @api {get} /posts/users/:username/category/:categoryId Get posts by category
 * @apiName GetPostsByCategory
 * @apiGroup Posts
 */
router.get(
    '/users/:username/category/:categoryId',
    async (
        req: Request<
            { username: string; categoryId: string },
            {},
            {},
            { cursor?: string; limit?: string }
        >,
        res
    ) => {
        try {
            const { username, categoryId } = req.params;
            const cursor = parseInt(req.query.cursor || '0', 10);
            const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
            const fetchLimit = limit + 1;

            const postsQuery = `
                SELECT
                    p.id,
                    p.user_id,
                    p.slug,
                    p.title,
                    p.description,
                    p.content,
                    p.status,
                    p.created_at,
                    p.updated_at,
                    p.category_id,
                    f.stored_uri
                FROM posts p
                INNER JOIN users u ON p.user_id = u.id
                LEFT JOIN files f ON p.id = f.post_id
                    AND f.is_thumbnail = true
                    AND f.deleted_at IS NULL
                WHERE u.username = $1
                    AND p.category_id = $2
                    AND p.deleted_at IS NULL
                    AND u.deleted_at IS NULL
                    AND p.status = 'public'
                    AND p.id < $3
                ORDER BY p.id DESC
                LIMIT $4
            `;

            const { rows } = await pool.query(postsQuery, [
                username,
                parseInt(categoryId, 10),
                cursor || Number.MAX_SAFE_INTEGER,
                fetchLimit,
            ]);

            const hasMore = rows.length > limit;
            const posts = hasMore ? rows.slice(0, limit) : rows;
            const nextCursor =
                hasMore && posts.length > 0 ? posts[posts.length - 1].id : null;

            res.json({
                success: true,
                posts,
                nextCursor,
                hasMore,
            });
        } catch (error) {
            console.error('API Error fetching posts by category:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch posts',
            });
        }
    }
);
