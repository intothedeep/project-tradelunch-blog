// Purpose: PUBLIC error-log ingest. POST /v1/api/error-logs is called
//          server-to-server by the Next runtime (app/api/log-error), NEVER by
//          the browser directly, so there is no auth. The body is untrusted: the
//          helper coerces/truncates every field before insert. Returns 204 on
//          success; on DB failure returns 500 but NEVER throws (best-effort log).
// Invariants:
//   * Thin controller — all shaping lives in helpers/errorLog (the pure part).
//   * No response body on success (204) — the caller ignores it.
// Side effects: one INSERT via the shared pool (delegated to insertErrorLog).
import { Router } from 'express';
import { pool } from '../../database';
import { normalizeErrorLog, insertErrorLog } from '../../helpers/errorLog';

const router = Router();

router.post('', async (req, res) => {
    try {
        const row = normalizeErrorLog(req.body);
        await insertErrorLog(pool, row);
        res.status(204).end();
    } catch (error) {
        console.error('POST /api/error-logs error:', error);
        res.status(500).json({
            success: false,
            message: 'failed to log error',
        });
    }
});

export default router;
