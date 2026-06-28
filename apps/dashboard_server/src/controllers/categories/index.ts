// Purpose: expose the category authoring routes under a single Router, mounted
//          at /v1/api/categories by controllers/index.ts.
import { Router } from 'express';
import { router as writeRouter } from './categories.write';

const router = Router();
router.use(writeRouter);

export default router;
