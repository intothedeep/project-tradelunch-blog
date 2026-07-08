// apps/finance_api — Express skeleton.
import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import { clerkMiddleware } from '@clerk/express';
import {
    SERVER_PORT,
    HOST_NAME,
    ALLOWED_ORIGINS_LIST,
    IS_DEVELOPMENT,
    CLERK_SECRET_KEY,
    CLERK_PUBLISHABLE_KEY,
} from './config/env.schema';
import { pool } from './database';
import { blockCrawlers } from './middlewares/blockCrawlers';
import { errorHandler } from './middlewares/errorHandler';
import dashboardRouter from './controllers/dashboard/index';
import fundsRouter from './controllers/funds/index';
import securitiesRouter from './controllers/securities/index';
import rankingsRouter from './controllers/rankings/index';
import politiciansRouter from './controllers/politicians/index';
import errorLogsRouter from './controllers/errorLogs/index';
import usersRouter from './controllers/users/index';

const app = express();

const corsOptions: CorsOptions = {
    origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        // Allow: no-origin (curl/server), explicitly-listed origins, and — in
        // dev only — any localhost origin so local frontends work regardless of
        // ALLOWED_ORIGINS being set. Prod stays strict (listed origins only).
        const isLocalhost = !!origin && /^https?:\/\/localhost(:\d+)?$/.test(origin);
        if (
            !origin ||
            ALLOWED_ORIGINS_LIST.includes(origin) ||
            (IS_DEVELOPMENT && isLocalhost)
        ) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*every', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Attach Clerk auth to every request. Keys passed EXPLICITLY (not left to
// @clerk/express's implicit process.env lookup) so a missing/misnamed env var
// fails loudly at boot, not per-request. Non-authed requests still pass;
// getAuth(req) is empty then. Only /users/me consumes it — data routes stay public.
console.log('Clerk keys loaded:', {
    secret: !!CLERK_SECRET_KEY,
    publishable: !!CLERK_PUBLISHABLE_KEY,
});
app.use(
    clerkMiddleware({
        secretKey: CLERK_SECRET_KEY,
        publishableKey: CLERK_PUBLISHABLE_KEY,
    })
);

// Health check — used by the Oracle VM process monitor.
app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
});

// Finance domain routers, mounted under /v1/api to match the finance_web
// fetchers (which call /v1/api/*). blockCrawlers on the public data routes;
// error-logs is server-to-server; users/me is Clerk-gated inside the router.
app.use('/v1/api/dashboard', blockCrawlers, dashboardRouter);
app.use('/v1/api/funds', blockCrawlers, fundsRouter);
app.use('/v1/api/securities', blockCrawlers, securitiesRouter);
app.use('/v1/api/rankings', blockCrawlers, rankingsRouter);
app.use('/v1/api/politicians', blockCrawlers, politiciansRouter);
app.use('/v1/api/error-logs', errorLogsRouter);
app.use('/v1/api/users', usersRouter);

// Terminal global error handler — MUST stay last. Catches anything a route did
// not handle (incl. Express-5 async rejections) → generic 500.
app.use(errorHandler);

async function shutdown(signal: string): Promise<void> {
    console.log(`${signal} received`);
    try {
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('Shutdown error:', error);
        process.exit(1);
    }
}

app.listen(SERVER_PORT, () => {
    console.log(`finance_api listening on http://${HOST_NAME}:${SERVER_PORT}/health`);
    console.log('CORS allowed origins:', ALLOWED_ORIGINS_LIST, '| dev-localhost:', IS_DEVELOPMENT);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
