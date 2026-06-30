import { Router } from 'express';
import { router as fundsRouter } from './funds';
import { router as rankflowRouter } from './rankflow';

const combined = Router();
combined.use(fundsRouter);
combined.use(rankflowRouter);

export default combined;
