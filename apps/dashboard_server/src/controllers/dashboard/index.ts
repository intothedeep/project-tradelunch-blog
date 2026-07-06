import { Router } from 'express';
import { router as dashboardRouter } from './dashboard';
import { router as seriesBatchRouter } from './seriesBatch';

// Compose the two dashboard sub-routers under the same /api/dashboard mount
// point (registered with blockCrawlers in controllers/index.ts). The batch
// sub-router is separate to keep each file under the 300-LOC SRP threshold.
const router = Router();
router.use(dashboardRouter);
router.use(seriesBatchRouter);

export default router;
