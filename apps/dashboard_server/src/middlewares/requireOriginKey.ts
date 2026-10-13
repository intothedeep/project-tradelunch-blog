// Purpose: gate a server-to-server-only route behind the shared secret header
//   `x-origin-key` (the same header decision D12 option A names in
//   traffic.design.md §7.4 for the later rate-limit exemption).
// Why: POST /v1/api/error-logs is reachable from the internet and does one DB
//   INSERT per request; only the Next runtime is meant to call it.
// Invariants:
//   * ORIGIN_KEY unset -> pass through (old behavior) and warn once at startup,
//     so Express and Next can deploy in either order without losing logs.
//   * ORIGIN_KEY set -> a missing or wrong header gets 403 and the handler never runs.
//   * Compared timing-safe (isMatchingKey in utils/clientIdentity.utils).
import type { RequestHandler } from 'express';
import { ORIGIN_KEY } from '../config/env.schema';
import { sendError } from '../helpers/response';
import { logger } from '../lib/logger';
import { isMatchingKey } from '../utils/clientIdentity.utils';

if (!ORIGIN_KEY) {
    logger.warn('ORIGIN_KEY unset: error-logs ingest is open');
}

export const requireOriginKey: RequestHandler = (req, res, next) => {
    if (!ORIGIN_KEY) return next();
    if (isMatchingKey(req.header('x-origin-key'), ORIGIN_KEY)) return next();
    sendError(res, 403, 'forbidden');
};
