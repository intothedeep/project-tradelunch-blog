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
    // client bundle (baked at build time). Default/catch to localhost for local
    // dev; set to the Oracle VM URL on Vercel. `.catch()` keeps build total
    // (an invalid value in the Vercel env won't hard-fail the build).
    NEXT_PUBLIC_FINANCE_API_BASE: z
        .string()
        .url()
        .default('http://localhost:4000')
        .catch('http://localhost:4000'),

    // Clerk publishable key — optional so builds pass without it; Clerk reads
    // it at runtime (set on Vercel).
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const SERVER_PORT = env.PORT;
export const FINANCE_API_BASE = env.NEXT_PUBLIC_FINANCE_API_BASE;
