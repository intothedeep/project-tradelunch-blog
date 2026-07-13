import { Router } from 'express';
import home from './home';
import posts from './posts';
import likes, { likesListRouter } from './likes';
import { postCommentsRouter, commentsRouter } from './comments';
import users from './users';
import admin from './admin';
import favorites from './favorites';
import categories from './categories';
import tags from './tags';
import errorLogs from './errorLogs';
import { logRouter } from './log';
import { followsRouter } from './follows';

export const router = Router();

router.use('/', home);
router.use('/api/posts', posts);
// Likes nest under a post (POST /api/posts/:postId/like). Mounted after the
// posts router so the posts read routes match first; the like toggle is the
// only POST handler here.
router.use('/api/posts', likes);
// Comments nest under a post for create/list (GET+POST /api/posts/:postId/comments);
// mounted after posts/likes so the literal `/comments` segment is not captured
// by a post id matcher. The delete-by-comment-id route mounts separately below.
router.use('/api/posts', postCommentsRouter);
router.use('/api/comments', commentsRouter);
router.use('/api/users', users);
router.use('/api/admin', admin);
router.use('/api/favorites', favorites);
// Category authoring (POST /api/categories) — owner-scoped create with
// (user_id, parent_id, title) conflict scope. The category TREE read stays under
// GET /api/posts/users/:username/categories.
router.use('/api/categories', categories);
// Tag reads (GET /api/tags) — global popular tags on their OWN prefix so they
// never collide with the posts feed. Per-user popular tags and the tag-filtered
// post feeds live under /api/posts (posts-scoped, multi-segment paths).
router.use('/api/tags', tags);
// Viewer-likes list (GET /api/likes) — the caller's own liked ids, on its own
// prefix so it never collides with the public feed at GET /api/posts.
router.use('/api/likes', likesListRouter);
// Error-log ingest (POST /api/error-logs) — PUBLIC, called server-to-server by
// the Next runtime (app/api/log-error), never by the browser. Its own prefix.
router.use('/api/error-logs', errorLogs);
// Log micro-feed (Phase Y) — /v1/api/log. Routes: GET /:username (stream),
// GET /thread/:id (focus view), POST / (create), DELETE /:id (soft-delete).
// Phase Y-M2: GET /timeline, POST /:id/like, GET /:id/like (social).
// /thread/:id and social routes are registered first inside logRouter to avoid
// username/id param capture.
router.use('/api/log', logRouter);
// Follow/unfollow (Phase Y-M2) — POST /v1/api/follow/:username.
// Presence-guarded: 503 when migration 0024 has not been applied.
router.use('/api/follow', followsRouter);

export default router;
