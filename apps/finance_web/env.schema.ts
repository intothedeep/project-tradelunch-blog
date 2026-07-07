import { z } from 'zod';

// NOTE: do NOT call dotenv.config()/process.cwd() here. This module is
// isomorphic — it may be pulled into the client bundle. Next.js injects
// .env / .env.* and NEXT_PUBLIC_* are inlined at build time, so dotenv is
// redundant here. Read process.env directly; zod defaults cover unset vars.

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z.coerce.number().default(3002),

    // Finance API base URL. The NEXT_PUBLIC_ prefix makes it available to the
    // client bundle (baked at build time). Default/catch to the production
    // Express backend so finance_web works standalone before Oracle cutover.
    NEXT_PUBLIC_FINANCE_API_BASE: z
        .string()
        .url()
        .default('https://blogapi.prettylog.com')
        .catch('https://blogapi.prettylog.com'),

    // Canonical public site origin — used by jsonld.ts for structured data URLs.
    NEXT_PUBLIC_SITE_URL: z
        .string()
        .url()
        .default('https://my.prettylog.com')
        .catch('https://my.prettylog.com'),

    // Clerk publishable key — optional so builds pass without it; Clerk reads
    // it at runtime (set on Vercel).
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const SERVER_PORT = env.PORT;

// FINANCE_API_BASE: canonical name for this app.
export const FINANCE_API_BASE = env.NEXT_PUBLIC_FINANCE_API_BASE;

// API_BASE: alias for FINANCE_API_BASE so all copied server actions / fetchers
// that import `API_BASE` from '@/env.schema' resolve without modification.
export const API_BASE = env.NEXT_PUBLIC_FINANCE_API_BASE;

// SITE_URL: used by jsonld.ts for absolute URL construction in structured data.
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
