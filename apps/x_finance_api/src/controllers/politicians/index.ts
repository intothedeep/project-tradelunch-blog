import { Router } from 'express';
import { router as politiciansRouter } from './politicians';

const combined = Router();
combined.use(politiciansRouter);

export default combined;
