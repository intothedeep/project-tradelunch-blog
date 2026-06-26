// Purpose: compose the read-only post routes (./posts) with the owner-scoped
//          authoring routes (./posts.write) under a single posts Router.
// Note: read mounts first; authoring (POST/PATCH/DELETE) falls through to write.
import { Router } from 'express';
import { router as readRouter } from './posts';
import { router as writeRouter } from './posts.write';

const router = Router();
router.use(readRouter);
router.use(writeRouter);

export default router;
