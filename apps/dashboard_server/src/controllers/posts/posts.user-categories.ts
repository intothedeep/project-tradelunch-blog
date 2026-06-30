// Purpose: per-author category tree and category-scoped post feed.
// Routes:
//   GET /users/:username/categories              — full category+post tree (hierarchical).
//   GET /users/:username/category/:categoryId    — keyset-paginated posts within one category.
// Constraints:
//   * Both routes are public (no auth middleware) — only public posts are returned.
//   * categoryId is a BIGINT string — never parseInt (precision past 2^53).
//   * ETreeNodeType / TTreeNode / TCategoryTreeResponse imported from @repo/types.
// Note: this file is ~175 LOC due to the tree CTE SQL verbatim; faithful move
//   required to keep SQL byte-for-byte identical per refactor contract.

import { Router, Request } from 'express';
import { pool } from '../../database';
import {
    ETreeNodeType,
    TCategoryTreeResponse,
    TTreeNode,
} from '@repo/types';

export function registerUserCategoriesRoutes(router: Router): void {
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
                        $1::VARCHAR AS username,
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
                const rawCursor =
                    typeof req.query.cursor === 'string' ? req.query.cursor : '';
                const cursorParam =
                    /^\d+$/.test(rawCursor) && rawCursor !== '0'
                        ? rawCursor
                        : '9223372036854775807';
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

                // categoryId is a BIGINT id — bind the raw STRING (node-pg casts text
                // → int8); never parseInt it (precision past 2^53).
                const { rows } = await pool.query(postsQuery, [
                    username,
                    categoryId,
                    cursorParam,
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
}
