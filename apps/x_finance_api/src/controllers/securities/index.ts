import { Router } from 'express';
import { router as consensusRouter } from './consensus';
import { router as byTickerRouter } from './byTicker';
import { router as screenRouter } from './screen';

const combined = Router();
combined.use(screenRouter);
combined.use(consensusRouter);
combined.use(byTickerRouter);

export default combined;
