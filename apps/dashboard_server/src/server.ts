import express from 'express';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import cors, { CorsOptions } from 'cors';
import routers from './controllers';
import { errorHandler } from './middlewares/errorHandler';
import {
    CorsRejectedError,
    corsRejectionHandler,
} from './middlewares/corsRejection';
import { rateLimit } from './middlewares/rateLimit';
import { getClientIp, isMatchingKey } from './utils/clientIdentity.utils';
import { ALLOWED_ORIGINS_LIST, ORIGIN_KEY } from './config/env.schema';
import { logger } from './lib/logger';
import { sendError } from './helpers/response';

export const app = express();

// Do not advertise the framework (measured 2026-10-13: `x-powered-by: Express`).
app.disable('x-powered-by');

// CORS whitelist is env-driven (ALLOWED_ORIGINS, comma-separated) so each
// deploy target (local / Vercel preview / prod) controls its own origins
// without a code change. Parsed once in env.schema (single source of truth).
const firstHeader = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

const whitelist: string[] = ALLOWED_ORIGINS_LIST;

const corsOptions: CorsOptions = {
    origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        if (!origin || whitelist.includes(origin)) {
            callback(null, true);
        } else {
            callback(new CorsRejectedError(origin));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204, // Safari preflight 200 → 204 fix
};

// Mounted first so CORS rejections and every later error are logged with the
// request id. Bodies and headers are never serialized: only id/method/url plus
// the derived ip (full client IP) and ssr (boolean key match, never the key).
app.use(
    pinoHttp({
        logger,
        genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const id =
                (Array.isArray(incoming) ? incoming[0] : incoming) ||
                randomUUID();
            res.setHeader('x-request-id', id);
            return id;
        },
        autoLogging: { ignore: (req) => req.url === '/ping' },
        customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
        serializers: {
            req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                ip: getClientIp(req.headers['cf-connecting-ip'], req.ip),
                ssr: isMatchingKey(
                    firstHeader(req.headers['x-origin-key']),
                    ORIGIN_KEY
                ),
            }),
            res: (res) => ({ statusCode: res.statusCode }),
        },
    })
);

app.use(cors(corsOptions));
// Must sit directly after cors(): turns its rejection into a 403 before the
// terminal errorHandler can log it as an error and write error_log.
app.use(corsRejectionHandler);

// After CORS so a 429 still carries CORS headers the browser can read; OPTIONS
// is skipped inside, so preflight is unaffected.
app.use(rateLimit);

// https://expressjs.com/en/guide/migrating-5.html#path-syntax
app.options('*every', cors(corsOptions)); // preflight 대응

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('CORS working');
});

// NOTE: this module must NOT call app.listen(). The single listener (with
// graceful-shutdown wiring) lives in src/index.ts. A second app.listen(4000)
// here bound a stray port outside the SIGTERM/SIGINT shutdown flow.

app.use('/ping', (_, res) => {
    res.json({
        status: 'ok',
        msg: 'pong',
    });
});

app.use('/v1', routers);

// Unknown path -> JSON 404 instead of Express's default HTML page. Sits after
// every router (only unmatched requests reach it) and before errorHandler: it
// is a normal response, not an error, so it writes no error_log; pino-http
// already logs 4xx at warn.
app.use((_req, res) => {
    sendError(res, 404, 'not found');
});

// Terminal global error handler — MUST stay last. Catches anything a route did
// not handle (incl. Express-5 async rejections) → error_log (source='express').
app.use(errorHandler);
