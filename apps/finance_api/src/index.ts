// apps/finance_api — Express skeleton.
import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import { SERVER_PORT, HOST_NAME, ALLOWED_ORIGINS_LIST } from './config/env.schema';
import { pool } from './database';
import { blockCrawlers } from './middlewares/blockCrawlers';
import dashboardRouter from './controllers/dashboard/index';
import fundsRouter from './controllers/funds/index';
import securitiesRouter from './controllers/securities/index';
import rankingsRouter from './controllers/rankings/index';
import politiciansRouter from './controllers/politicians/index';
import errorLogsRouter from './controllers/errorLogs/index';

const app = express();

const corsOptions: CorsOptions = {
    origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        if (!origin || ALLOWED_ORIGINS_LIST.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
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

// Health check — used by Oracle VM process monitor and Clerk webhook verify.
app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
});

// Finance domain routers — all gated by blockCrawlers except error-logs
// (error-logs is server-to-server from the Next runtime, never a browser/bot hit).
app.use('/api/dashboard', blockCrawlers, dashboardRouter);
app.use('/api/funds', blockCrawlers, fundsRouter);
app.use('/api/securities', blockCrawlers, securitiesRouter);
app.use('/api/rankings', blockCrawlers, rankingsRouter);
app.use('/api/politicians', blockCrawlers, politiciansRouter);
app.use('/api/error-logs', errorLogsRouter);

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
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
