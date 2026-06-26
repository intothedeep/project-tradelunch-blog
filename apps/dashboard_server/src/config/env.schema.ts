// apps/dashboard_server/src/config/env.schema.ts
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load default .env first
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const IS_DEVELOPMENT = process.env.NODE_ENV == 'development';
export const IS_LOCAL = process.env.NODE_ENV == 'local';
export const IS_PRODUCTION = process.env.NODE_ENV == 'production';

const dotEnvConfigPath =
    process.env.NODE_ENV == 'production'
        ? '.env.production'
        : '.env.development';

// Load .env.production to override any variables from .env
dotenv.config({ path: path.resolve(process.cwd(), dotEnvConfigPath) });

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z.coerce.number().default(4000),
    HOST_NAME: z.string().default('localhost'),

    // domain
    SITE_DOMAIN: z.string().default('http://localhost:3000'),

    // CDN
    CDN_ASSET_POSTS: z.string().default('https://posts.prettylog.com/'),

    // user id
    DEFAULT_USER_ID: z.coerce.number().default(2),

    // supabase
    DATABASE_URL: z.string().optional(),
    DATABASE_URL_DIRECT: z.string().optional(),
    // Vercel ↔ Supabase integration auto-injects these (preferred on Vercel):
    //   POSTGRES_URL             = pooled (transaction pooler, port 6543) → runtime pg Pool
    //   POSTGRES_URL_NON_POOLING = direct (port 5432) → migrations / direct
    POSTGRES_URL: z.string().optional(),
    POSTGRES_URL_NON_POOLING: z.string().optional(),
    SUPABASE_PROJECT_ID: z.string().optional(),
    SUPABASE_DB_PASSWORD: z.string().optional(),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SECRET_KEY: z.string().optional(),

    // auth
    CLERK_SECRET_KEY: z.string().optional(),

    // cors / app
    ALLOWED_ORIGINS: z.string().default(''),
    APP_URL: z.string().default('http://localhost:3000'),
    GIT_SHA: z.string().default('local'),

    // file upload limits
    MAX_FILE_SIZE: z.coerce.number().default(10485760),
    ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp'),

    // image optimization
    THUMBNAIL_WIDTH: z.coerce.number().default(400),
    THUMBNAIL_HEIGHT: z.coerce.number().default(300),
    THUMBNAIL_QUALITY: z.coerce.number().default(80),
    IMAGE_OPTIMIZATION_QUALITY: z.coerce.number().default(85),
    MAX_IMAGE_WIDTH: z.coerce.number().default(1920),
    MAX_IMAGE_HEIGHT: z.coerce.number().default(1080),
});

export const env = envSchema.parse(process.env);

// server
export const NODE_ENV = env.NODE_ENV;
export const SERVER_PORT = env.PORT;
export const HOST_NAME = env.HOST_NAME;

export const CDN_ASSET_POSTS = env.CDN_ASSET_POSTS;

export const DEFAULT_USER_ID = env.DEFAULT_USER_ID;

// supabase / database url
// Prefer the Vercel↔Supabase integration vars (POSTGRES_URL); fall back to
// DATABASE_URL for local .env. database.ts consumes DATABASE_URL — no change needed there.
export const DATABASE_URL = env.POSTGRES_URL ?? env.DATABASE_URL;
export const DATABASE_URL_DIRECT = env.POSTGRES_URL_NON_POOLING ?? env.DATABASE_URL_DIRECT;
export const SUPABASE_PROJECT_ID = env.SUPABASE_PROJECT_ID;
export const SUPABASE_DB_PASSWORD = env.SUPABASE_DB_PASSWORD;
export const SUPABASE_URL = env.SUPABASE_URL;
export const SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;

// auth
export const CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;

// cors / app
export const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS;
// Single source of truth for allowed frontend origins, parsed once. Consumed by
// the CORS whitelist (server.ts) and Clerk's authorizedParties (resolveAuth.ts):
// the frontend origins ARE the authorized parties. Empty/blank entries dropped.
export const ALLOWED_ORIGINS_LIST: string[] = ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
export const APP_URL = env.APP_URL;
export const GIT_SHA = env.GIT_SHA;

// file upload
export const MAX_FILE_SIZE = env.MAX_FILE_SIZE;
export const ALLOWED_FILE_TYPES = env.ALLOWED_FILE_TYPES;

// image optimization
export const THUMBNAIL_WIDTH = env.THUMBNAIL_WIDTH;
export const THUMBNAIL_HEIGHT = env.THUMBNAIL_HEIGHT;
export const THUMBNAIL_QUALITY = env.THUMBNAIL_QUALITY;
export const IMAGE_OPTIMIZATION_QUALITY = env.IMAGE_OPTIMIZATION_QUALITY;
export const MAX_IMAGE_WIDTH = env.MAX_IMAGE_WIDTH;
export const MAX_IMAGE_HEIGHT = env.MAX_IMAGE_HEIGHT;
