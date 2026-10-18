// Purpose: Projects read routes (Phase PJ). A project is a direct child category
//   of the author's root category titled PROJECTS_ROOT_CATEGORY_TITLE (#72).
// Routes:
//   GET /users/:username/projects            - { projects: TProjectCard[] }
//   GET /users/:username/projects/:project   - { project: TProjectRef, posts: TProjectPost[] }
// Constraints:
//   * optionalAuth resolves the viewer id; -1 means anonymous (matches no user_id).
//   * Owner sees own non-public posts; everyone else sees status = 'public'.
//   * Slug-dedup (latest revision per slug) runs BEFORE the project filter, as in
//     posts.user-categories.ts, so a republished post counts and lists once.
//   * Posts order by priority ASC, seq ASC (#73); overview = first of that order (#72).
//   * BIGINT ids leave the DB as text and are bound as strings (no numeric coercion).
//   * The project path segment is the category title (Express already URL-decodes it).

import { Router } from 'express';
import type { TProjectCard, TProjectPost, TProjectRef } from '@repo/types';
import { PROJECTS_ROOT_CATEGORY_TITLE } from '@repo/types';
import { pool } from '../../database';
import { optionalAuth } from '../../middlewares/optionalAuth';
import { sendOk, sendError } from '../../helpers/response';
import { setPostReadCache } from './posts.cache';

// $1 username, $2 viewer id, $3 root category title.
const PROJECT_CTES = `
    root AS (
        SELECT c.id FROM categories c JOIN users u ON u.id = c.user_id
        WHERE u.username = $1 AND u.deleted_at IS NULL
            AND c.title = $3 AND c.deleted_at IS NULL
    ),
    project AS (
        SELECT c.id, c.title, c.priority, c.seq
        FROM categories c JOIN root r ON c.parent_id = r.id
        WHERE c.deleted_at IS NULL
    ),
    subtree AS (
        SELECT p.id AS project_id, p.id AS category_id FROM project p
        UNION ALL
        SELECT s.project_id, c.id FROM categories c
        JOIN subtree s ON c.parent_id = s.category_id
        WHERE c.deleted_at IS NULL
    ),
    latest AS (
        SELECT p.id, p.seq, p.slug, p.title, p.description, p.priority,
            p.status, p.created_at, p.updated_at, p.category_id,
            ROW_NUMBER() OVER (
                PARTITION BY p.slug
                ORDER BY p.created_at DESC, p.id DESC
            ) AS rn
        FROM posts p JOIN users u ON u.id = p.user_id
        WHERE u.username = $1 AND u.deleted_at IS NULL AND p.deleted_at IS NULL
            AND (p.status = 'public' OR p.user_id = $2)
    ),
    ranked AS (
        SELECT s.project_id, l.*,
            ROW_NUMBER() OVER (
                PARTITION BY s.project_id
                ORDER BY l.priority ASC, l.seq ASC
            ) AS ord
        FROM latest l JOIN subtree s ON s.category_id = l.category_id
        WHERE l.rn = 1
    )`;

// ORDER BY id DESC LIMIT 1: two thumbnail rows must still give one card/row.
const thumbnailJoin = (postAlias: string): string => `
    LEFT JOIN LATERAL (
        SELECT f.stored_uri FROM files f
        WHERE f.post_id = ${postAlias}.id AND f.is_thumbnail = true
            AND f.deleted_at IS NULL
        ORDER BY f.id DESC LIMIT 1
    ) th ON true`;

const CARDS_QUERY = `
    WITH RECURSIVE ${PROJECT_CTES}
    SELECT pr.id::text AS project_id, pr.title AS project,
        (SELECT COUNT(*) FROM ranked k WHERE k.project_id = pr.id)::int AS post_count,
        ov.id::text AS overview_post_id, ov.slug AS overview_slug,
        ov.title AS overview_title, th.stored_uri
    FROM project pr
    LEFT JOIN ranked ov ON ov.project_id = pr.id AND ov.ord = 1
    ${thumbnailJoin('ov')}
    ORDER BY pr.priority ASC, pr.seq ASC`;

// One row per post; a project with no visible posts yields one row with NULL post
// columns, so "no rows" means "no such project" (404).
const PROJECT_POSTS_QUERY = `
    WITH RECURSIVE ${PROJECT_CTES}
    SELECT pr.id::text AS project_id, pr.title AS project,
        r.id::text AS id, r.slug, r.title, r.description,
        r.priority::int AS priority, r.seq::text AS seq, th.stored_uri,
        r.status, r.created_at, r.updated_at
    FROM project pr
    LEFT JOIN ranked r ON r.project_id = pr.id
    ${thumbnailJoin('r')}
    WHERE pr.title = $4
    ORDER BY r.ord ASC`;

type TCardRow = TProjectRef & {
    post_count: number;
    overview_post_id: string | null;
    overview_slug: string | null;
    overview_title: string | null;
    stored_uri: string | null;
};

type TPostRow = TProjectRef & Omit<TProjectPost, 'id'> & { id: string | null };

async function userExists(username: string): Promise<boolean> {
    const { rowCount } = await pool.query(
        'SELECT 1 FROM users WHERE username = $1 AND deleted_at IS NULL',
        [username]
    );
    return (rowCount ?? 0) > 0;
}

export function registerUserProjectsRoutes(router: Router): void {
    /**
     * @api {get} /posts/users/:username/projects Get the author's project cards
     * @apiName GetUserProjects
     * @apiGroup Posts
     */
    router.get<{ username: string }>(
        '/users/:username/projects',
        optionalAuth,
        async (req, res) => {
            try {
                const { username } = req.params;
                const viewerId = req.auth?.userId ?? -1;

                if (!(await userExists(username))) {
                    return sendError(res, 404, 'User not found');
                }

                const { rows } = await pool.query<TCardRow>(CARDS_QUERY, [
                    username,
                    viewerId,
                    PROJECTS_ROOT_CATEGORY_TITLE,
                ]);

                const projects: TProjectCard[] = rows.map((row) => ({
                    project_id: row.project_id,
                    project: row.project,
                    // Fixed null until PG-2-01 selects the real group columns.
                    group_id: null,
                    group: null,
                    post_count: row.post_count,
                    overview:
                        row.overview_post_id === null
                            ? null
                            : {
                                  post_id: row.overview_post_id,
                                  slug: row.overview_slug as string,
                                  title: row.overview_title as string,
                                  stored_uri: row.stored_uri,
                              },
                }));

                setPostReadCache(req, res);
                sendOk(res, { projects });
            } catch (error) {
                req.log.error({ err: error }, 'API Error fetching projects');
                sendError(res, 500, 'Failed to fetch projects');
            }
        }
    );

    /**
     * @api {get} /posts/users/:username/projects/:project Get one project's posts
     * @apiName GetUserProjectPosts
     * @apiGroup Posts
     */
    router.get(
        '/users/:username/projects/:project',
        optionalAuth,
        async (req, res) => {
            try {
                const { username, project } = req.params;
                const viewerId = req.auth?.userId ?? -1;

                const { rows } = await pool.query<TPostRow>(
                    PROJECT_POSTS_QUERY,
                    [username, viewerId, PROJECTS_ROOT_CATEGORY_TITLE, project]
                );
                if (rows.length === 0) {
                    return sendError(res, 404, 'Project not found');
                }

                const ref: TProjectRef = {
                    project_id: rows[0].project_id,
                    project: rows[0].project,
                    group_id: null,
                    group: null,
                };
                const posts: TProjectPost[] = [];
                for (const row of rows) {
                    if (row.id === null) continue;
                    posts.push({
                        id: row.id,
                        slug: row.slug,
                        title: row.title,
                        description: row.description,
                        priority: row.priority,
                        seq: row.seq,
                        stored_uri: row.stored_uri,
                        status: row.status,
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                    });
                }

                setPostReadCache(req, res);
                sendOk(res, { project: ref, posts });
            } catch (error) {
                req.log.error(
                    { err: error },
                    'API Error fetching project posts'
                );
                sendError(res, 500, 'Failed to fetch project posts');
            }
        }
    );
}
