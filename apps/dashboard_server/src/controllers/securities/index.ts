import { Router } from 'express';
import { router as consensusRouter } from './consensus';
import { router as byTickerRouter } from './byTicker';

const combined = Router();
combined.use(consensusRouter);
combined.use(byTickerRouter);

export default combined;
