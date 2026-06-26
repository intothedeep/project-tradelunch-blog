// Purpose: compose admin moderation routers under a single /api/admin Router.
import { Router } from 'express';
import { router as postsAdminRouter } from './posts.admin';

const router = Router();
router.use('/posts', postsAdminRouter);

export default router;
