// apps/article_server/src/env.schema.ts
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
        : '.env.developement';

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
    API_SITE_DOMAIN: z.string('https://my-api.prettylog.com'),

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