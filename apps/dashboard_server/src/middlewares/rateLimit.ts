// Purpose: L-b backstop of traffic.design.md 7.4.3 - per-IP request cap inside
//   the origin, in memory only (single PM2 fork, so no shared store is needed).
// Invariants:
//   * RATE_LIMIT_MODE: off = skipped, log (default) = never blocks and warns
//     once per key per window on first exceed, enforce = 429 + Retry-After.
//   * Next SSR calls (valid x-origin-key) are not counted: they all come from
//     the VM's own IP and would lock the site out of its own API.
//   * A wrong or missing key counts like any client, so the header is no bypass.
//   * /ping and OPTIONS are never counted. 429 writes no error_log row.
import type { RequestHandler } from 'express';
import { ORIGIN_KEY, RATE_LIMIT_MODE } from '../config/env.schema';
import { sendError } from '../helpers/response';
import { logger } from '../lib/logger';
import { getClientIp, isMatchingKey } from '../utils/clientIdentity.utils';
import { createRateCounter, toRateLimitKey } from '../utils/rateLimit.utils';

// Provisional limits (decision D5); re-set from 14 days of logs (design 7.4.4).
const WINDOW_MS = 60_000;
const READ_LIMIT = 120;
const WRITE_LIMIT = 30;
const MAX_KEYS_PER_BUCKET = 50_000;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const counter = createRateCounter(WINDOW_MS, MAX_KEYS_PER_BUCKET);

export const rateLimit: RequestHandler = (req, res, next) => {
    if (RATE_LIMIT_MODE === 'off') return next();
    if (req.method === 'OPTIONS' || req.path === '/ping') return next();
    if (isMatchingKey(req.header('x-origin-key'), ORIGIN_KEY)) return next();

    const ip = toRateLimitKey(
        getClientIp(req.header('cf-connecting-ip'), req.ip)
    );
    const isWrite = WRITE_METHODS.has(req.method);
    const bucket = isWrite ? 'write' : 'read';
    const limit = isWrite ? WRITE_LIMIT : READ_LIMIT;
    const hit = counter.hit(bucket, ip, limit, Date.now());

    if (!hit.tracked) {
        if (hit.isCapFirstReached) {
            logger.warn(
                { bucket, maxKeys: MAX_KEYS_PER_BUCKET },
                'rate_limit_key_cap'
            );
        }
        return next();
    }
    if (!hit.isExceeded) return next();

    if (hit.isFirstExceed) {
        logger.warn({ ip, bucket, count: hit.count, limit }, 'rate_limit');
    }
    if (RATE_LIMIT_MODE === 'log') return next();

    res.setHeader('Retry-After', String(hit.retryAfterSec));
    sendError(res, 429, 'too many requests');
};
