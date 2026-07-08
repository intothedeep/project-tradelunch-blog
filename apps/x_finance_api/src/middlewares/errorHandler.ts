// Purpose: terminal GLOBAL error handler. Any error thrown — or, under Express
//   5, rejected from an async route — that no route caught lands here. It is
//   answered with a generic 500. Must be mounted LAST (Express identifies it by
//   arity). If the response was already partially sent, defer to Express's default.
// Invariants:
//   * Must be mounted LAST, after every router (Express identifies it by arity).
//   * If the response was already partially sent, defer to Express's default.
// Side effects: one 500 JSON response.
import type { ErrorRequestHandler } from 'express';
import { sendError } from '../helpers/response';

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error('Unhandled Express error:', err);

    if (res.headersSent) {
        next(err);
        return;
    }
    sendError(res, 500, 'internal server error');
};
