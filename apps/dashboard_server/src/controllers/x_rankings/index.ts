// controllers/rankings/index.ts
// Aggregates market-cap rankings routes: snapshot + flow.
// Mirrors the funds/ controller layout (separate files combined here).
import { Router } from 'express';
import { router as rankingsRouter } from './rankings';
import { router as rankflowRouter } from './rankflow';

const combined = Router();
combined.use(rankingsRouter);
combined.use(rankflowRouter);

export default combined;
