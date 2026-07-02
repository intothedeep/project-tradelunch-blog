import { Router } from 'express';
import { router as consensusRouter } from './consensus';

const combined = Router();
combined.use(consensusRouter);

export default combined;
