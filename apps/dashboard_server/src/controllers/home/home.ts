import { Router } from 'express';

export const router = Router();

router.get('/', (req, res) => {
    res.json({ status: 'ok' });
});

router.get('/health', (req, res) => {
    res.json({ status: 'ok', msg: 'Healthy' });
});

router.get('/status', (_req, res) => {
    res.json({ status: 'ok' });
});
