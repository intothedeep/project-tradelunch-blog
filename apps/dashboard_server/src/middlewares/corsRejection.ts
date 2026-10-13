// Purpose: answer a CORS-whitelist rejection as an expected client error (403)
//   instead of letting it fall through to the global errorHandler.
// Why: any caller can send an arbitrary Origin header, so a rejection is
//   routine traffic, not a server fault. Through errorHandler it cost a 500, two
//   ERROR log lines and one error_log INSERT per request (24 in 7 days, 2026-10-13).
// Invariants:
//   * Catches ONLY CorsRejectedError; every other error goes on via next(err).
//   * No DB write, no error-level log. The response is sent without res.err set,
//     so pino-http sees no err and its customLogLevel logs the 403 at warn.
//   * Mounted right after cors(): preflight (OPTIONS) errors reach it too.
import type { ErrorRequestHandler } from 'express';
import { sendError } from '../helpers/response';

export class CorsRejectedError extends Error {
    constructor(public readonly origin: string) {
        super('Not allowed by CORS');
        this.name = 'CorsRejectedError';
    }
}

export const corsRejectionHandler: ErrorRequestHandler = (
    err,
    _req,
    res,
    next
) => {
    if (!(err instanceof CorsRejectedError) || res.headersSent) {
        next(err);
        return;
    }
    sendError(res, 403, 'origin not allowed');
};
