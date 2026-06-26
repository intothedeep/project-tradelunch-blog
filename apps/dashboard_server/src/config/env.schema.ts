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
    API_SITE_DOMAIN: z.string().default('https://my-api.prettylog.com'),

    // aws
    AWS_REGION: z.string().default('localhost'),
    AWS_ACCESS_KEY_ID: z.string().default('localhost'),
    AWS_SECRET_ACCESS_KEY: z.string().default('localhost'),
    AWS_S3_BUCKET: z.string().default('localhost'),

    // ec2
    EC2_HOST: z.string().default('13.57.82.45'),
    EC2_PORT: z.string().default('22'),
    EC2_USERNAME: z.string().default('ec2-user'),

    // aws rds postgres
    DB_PG_HOST: z.string().default('localhost'),
    DB_PG_DATABASE: z.string().default('db20250627'),
    DB_PG_USER: z.string().default('super'),
    DB_PG_PASSWORD: z.string().default(''),
    DB_PG_PORT: z.coerce.number().default(5432),

    // CDN
    CDN_ASSET_POSTS: z.string().default('https://posts.prettylog.com/'),

    // user id
    DEFAULT_USER_ID: z.coerce.number().default(2),

    // supabase
    DATABASE_URL: z.string().optional(),
    DATABASE_URL_DIRECT: z.string().optional(),
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

    // cloudfront / image
    CLOUDFRONT_DOMAIN: z.string().optional(),
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

// db
export const DB_PG_HOST = env.DB_PG_HOST;
export const DB_PG_PORT = env.DB_PG_PORT;
export const DB_PG_DATABASE = env.DB_PG_DATABASE;
export const DB_PG_USER = env.DB_PG_USER;
export const DB_PG_PASSWORD = env.DB_PG_PASSWORD;

// aws
export const AWS_REGION = env.AWS_REGION;
export const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
export const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;
export const AWS_S3_BUCKET = env.AWS_S3_BUCKET;

export const CDN_ASSET_POSTS = env.CDN_ASSET_POSTS;

export const EC2_HOST = env.EC2_HOST;
export const EC2_PORT = env.EC2_PORT;
export const EC2_USERNAME = env.EC2_USERNAME;
export const DEFAULT_USER_ID = env.DEFAULT_USER_ID;

// supabase / database url
export const DATABASE_URL = env.DATABASE_URL;
export const DATABASE_URL_DIRECT = env.DATABASE_URL_DIRECT;
export const SUPABASE_PROJECT_ID = env.SUPABASE_PROJECT_ID;
export const SUPABASE_DB_PASSWORD = env.SUPABASE_DB_PASSWORD;
export const SUPABASE_URL = env.SUPABASE_URL;
export const SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;

// auth
export const CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;

// cors / app
export const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS;
export const APP_URL = env.APP_URL;
export const GIT_SHA = env.GIT_SHA;

// file upload
export const MAX_FILE_SIZE = env.MAX_FILE_SIZE;
export const ALLOWED_FILE_TYPES = env.ALLOWED_FILE_TYPES;

// cloudfront / image optimization
export const CLOUDFRONT_DOMAIN = env.CLOUDFRONT_DOMAIN;
export const THUMBNAIL_WIDTH = env.THUMBNAIL_WIDTH;
export const THUMBNAIL_HEIGHT = env.THUMBNAIL_HEIGHT;
export const THUMBNAIL_QUALITY = env.THUMBNAIL_QUALITY;
export const IMAGE_OPTIMIZATION_QUALITY = env.IMAGE_OPTIMIZATION_QUALITY;
export const MAX_IMAGE_WIDTH = env.MAX_IMAGE_WIDTH;
export const MAX_IMAGE_HEIGHT = env.MAX_IMAGE_HEIGHT;
