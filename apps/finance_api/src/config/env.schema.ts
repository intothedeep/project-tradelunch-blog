// apps/finance_api/src/config/env.schema.ts
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load env files in Next-style priority. dotenv keeps the FIRST value it sees,
// so load the highest-priority file first: .env.local > .env.<mode> > .env.
// This lets you keep secrets in .env.local (same habit as finance_web) — the
// previous version only read .env / .env.<mode>, so values placed in .env.local
// were silently ignored ("injected env (0)").
const cwd = process.cwd();
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

dotenv.config({ path: path.resolve(cwd, '.env.local') });
dotenv.config({ path: path.resolve(cwd, `.env.${mode}`) });
dotenv.config({ path: path.resolve(cwd, '.env') });

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z.coerce.number().default(4000),
    HOST_NAME: z.string().default('localhost'),

    // Postgres — SAME env-var names as the rest of the repo (the Vercel↔Supabase
    // integration injects these). The NAME is common; the VALUE differs per
    // environment: Supabase locally, Oracle VM PG17 in production.
    //   POSTGRES_URL             = pooled (transaction pooler, :6543) → pg Pool
    //   POSTGRES_URL_NON_POOLING = direct (:5432) → migrations / direct queries
    // Discrete POSTGRES_USER/HOST/… and SUPABASE_* are intentionally NOT parsed
    // (redundant with POSTGRES_URL*; zod ignores unknown keys so the full repo
    // env block can be pasted verbatim).
    POSTGRES_URL: z.string().optional(),
    POSTGRES_URL_NON_POOLING: z.string().optional(),

    // Clerk — Express auth needs BOTH keys. @clerk/express's clerkMiddleware
    // reads these from process.env directly (verifies the request token +
    // resolves the instance from the publishable key).
    CLERK_SECRET_KEY: z.string().optional(),
    CLERK_PUBLISHABLE_KEY: z.string().optional(),

    // CORS — comma-separated list of allowed frontend origins.
    ALLOWED_ORIGINS: z.string().default(''),
    APP_URL: z.string().default('http://localhost:3002'),
});

export const env = envSchema.parse(process.env);

export const IS_DEVELOPMENT = env.NODE_ENV === 'development';
export const IS_PRODUCTION = env.NODE_ENV === 'production';

export const SERVER_PORT = env.PORT;
export const HOST_NAME = env.HOST_NAME;

// Resolved from the common POSTGRES_URL* vars (mirrors dashboard_server).
export const DATABASE_URL = env.POSTGRES_URL;
export const DATABASE_URL_DIRECT = env.POSTGRES_URL_NON_POOLING;

export const CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
export const CLERK_PUBLISHABLE_KEY = env.CLERK_PUBLISHABLE_KEY;

export const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS;
export const ALLOWED_ORIGINS_LIST: string[] = ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
export const APP_URL = env.APP_URL;
