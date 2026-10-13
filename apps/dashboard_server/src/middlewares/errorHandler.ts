// Purpose: terminal GLOBAL error handler. Any error thrown — or, under Express
//   5, rejected from an async route — that no route caught lands here. It is
//   persisted to the shared error_log sink with source='express' (the backend
//   counterpart to the browser/SSR error boundaries) and answered with a generic
//   500. This makes Express's OWN runtime errors visible in the same Supabase
//   table that already holds 'browser'/'ssr' reports.
// Invariants:
//   * Best-effort logging — a DB failure is swallowed (logged only) and
//     never masks the original error or throws again.
//   * Must be mounted LAST, after every router (Express identifies it by arity).
//   * If the response was already partially sent, defer to Express's default.
// Side effects: one INSERT via the shared pool; one 500 JSON response.
import type { ErrorRequestHandler } from 'express';
import { pool } from '../database';
import { buildExpressErrorRow, insertErrorLog } from '../helpers/errorLog';
import { logger } from '../lib/logger';

export const errorHandler: ErrorRequestHandler = async (
    err,
    req,
    res,
    next
) => {
    // req.log carries the request id; fall back when pino-http never ran.
    const log = req.log ?? logger;
    log.error({ err }, 'Unhandled Express error');

    // Await the insert (not fire-and-forget): on serverless the function can
    // freeze once the response is sent, dropping a pending write. The latency
    // cost is paid only on the error path.
    try {
        const row = buildExpressErrorRow(
            err,
            req.originalUrl,
            req.get('user-agent')
        );
        await insertErrorLog(pool, row);
    } catch (logErr) {
        log.error({ err: logErr }, 'error_log insert failed');
    }

    if (res.headersSent) {
        next(err);
        return;
    }
    res.status(500).json({ success: false, message: 'internal server error' });
};
