import express from 'express';
import cors, { CorsOptions } from 'cors';
import routers from './controllers';

export const app = express();

const whitelist: string[] = [
    'https://my.prettylog.com',
    'https://admin.prettylog.com',
    'http://localhost:3000',
];

const corsOptions: CorsOptions = {
    origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        if (!origin || whitelist.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204, // Safari preflight 200 → 204 fix
};

app.use(cors(corsOptions));

// https://expressjs.com/en/guide/migrating-5.html#path-syntax
app.options('*every', cors(corsOptions)); // preflight 대응

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.send('CORS working');
    console.log(req.query, req.body);
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
