import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const dotenv_path = path.resolve(process.cwd(), '.env');
dotenv.config({ path: dotenv_path });

if (process.env.NODE_ENV == 'production') {
    // Load .env.production to override any variables from .env
    dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), override: true });
}

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z.coerce.number().default(3000),
    HOST_NAME: z.string().default('localhost'),

    NEXT_PUBLIC_API_BASE: z.string().url().default('http://localhost:4000'),
    NEXT_PUBLIC_CDN_ASSET_POSTS: z
        .string()
        .url()
        .default('https://posts.prettylog.com'),

    // Dashboard data source switch. Absent env → 'mock' (live behavior unchanged).
    DASHBOARD_DATA_SOURCE: z.enum(['mock', 'backend']).default('mock'),
});

export const env = envSchema.parse(process.env);

export const SERVER_PORT = env.PORT;
export const HOST_NAME = env.HOST_NAME;
export const API_BASE = env.NEXT_PUBLIC_API_BASE;
export const CDN_ASSET_POSTS = env.NEXT_PUBLIC_CDN_ASSET_POSTS;
export const DASHBOARD_DATA_SOURCE = env.DASHBOARD_DATA_SOURCE;
