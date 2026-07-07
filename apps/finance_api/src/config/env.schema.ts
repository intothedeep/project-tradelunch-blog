// apps/finance_api/src/config/env.schema.ts
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const dotEnvConfigPath =
    process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';

dotenv.config({ path: path.resolve(process.cwd(), dotEnvConfigPath) });

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z.coerce.number().default(4000),
    HOST_NAME: z.string().default('localhost'),

    // Finance Postgres (Oracle VM PG17).
    // Use the pooled URL for runtime queries; the non-pooling URL for migrations.
    FINANCE_POSTGRES_URL: z.string().optional(),
    FINANCE_POSTGRES_URL_NON_POOLING: z.string().optional(),

    // Clerk — secret key for Express request auth.
    CLERK_SECRET_KEY: z.string().optional(),

    // CORS — comma-separated list of allowed frontend origins.
    ALLOWED_ORIGINS: z.string().default(''),
    APP_URL: z.string().default('http://localhost:3002'),
});

export const env = envSchema.parse(process.env);

export const IS_DEVELOPMENT = env.NODE_ENV === 'development';
export const IS_PRODUCTION = env.NODE_ENV === 'production';

export const SERVER_PORT = env.PORT;
export const HOST_NAME = env.HOST_NAME;

export const FINANCE_DATABASE_URL = env.FINANCE_POSTGRES_URL;
export const FINANCE_DATABASE_URL_DIRECT = env.FINANCE_POSTGRES_URL_NON_POOLING;

export const CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;

export const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS;
export const ALLOWED_ORIGINS_LIST: string[] = ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
export const APP_URL = env.APP_URL;
