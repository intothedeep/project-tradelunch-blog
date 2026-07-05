import { Router } from 'express';
import home from './home';
import posts from './posts';
import likes, { likesListRouter } from './likes';
import { postCommentsRouter, commentsRouter } from './comments';
import dashboard from './dashboard';
import funds from './funds';
import securities from './securities';
import rankings from './rankings';
import users from './users';
import admin from './admin';
import favorites from './favorites';
import categories from './categories';
import tags from './tags';
import errorLogs from './errorLogs';
import politicians from './politicians';
import { blockCrawlers } from '../middlewares/blockCrawlers';

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
// Finance routers are PUBLIC to human browsers but crawler-gated: blockCrawlers
// 403s bot User-Agents BEFORE the DB query (Supabase-egress control). Legit
// Next SSR calls arrive with the Next server UA and pass through.
router.use('/api/dashboard', blockCrawlers, dashboard);
// SEC 13F holdings viewer (GET /api/funds, GET /api/funds/:cik) — PUBLIC read,
// store-derived; tables-absent guard returns empty (not 500) when 0017 unapplied.
router.use('/api/funds', blockCrawlers, funds);
// Cross-fund 13F consensus (GET /api/securities/:cusip/consensus) — PUBLIC read;
// view-absent guard returns data:null (not 500) when 0020 unapplied.
router.use('/api/securities', blockCrawlers, securities);
// Weekly market-cap ranking viewer (GET /api/rankings) — PUBLIC read, derived
// data; table-absent guard returns data:null (not 500) when 0012 unapplied.
router.use('/api/rankings', blockCrawlers, rankings);
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
// Politician PTR profile (GET /api/politicians/:filerId) — PUBLIC read;
// presence-guarded against 0022/0023 migrations; returns data:null when absent.
router.use('/api/politicians', blockCrawlers, politicians);

export default router;
