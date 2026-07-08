import { z } from 'zod';

// NOTE: isomorphic module — pulled into the CLIENT bundle. Next.js inlines
// NEXT_PUBLIC_* at build time, BUT ONLY where `process.env.NEXT_PUBLIC_X` is
// referenced DIRECTLY (dot access). Passing the whole `process.env` object to
// zod does NOT inline them, so in the browser they'd be undefined and every
// field would fall back to its catch/default. We therefore parse an EXPLICIT
// object (below) that dot-accesses each NEXT_PUBLIC_ var. Non-public vars
// (CLERK_SECRET_KEY) are simply undefined on the client — that's expected.

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z.coerce.number().default(3002),

    // Finance API base URL (client-visible via NEXT_PUBLIC_). Local dev sets it
    // in .env.local; catch surfaces a misconfig loudly instead of a silent host.
    NEXT_PUBLIC_API_BASE: z.url().catch('https://error.:::PUBLICAPIBASE.com'),

    // Canonical public site origin — used by jsonld.ts for structured data URLs.
    NEXT_PUBLIC_SITE_URL: z.url().catch('https://error.:::siteurl.com'),

    // Clerk publishable key — optional so builds pass without it.
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
});

// Dot-access each NEXT_PUBLIC_ var so Next inlines it into the client bundle
// (a bare `process.env` is empty in the browser).
export const env = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
});

export const SERVER_PORT = env.PORT;
// Client + server both read the NEXT_PUBLIC_ value (the only one visible in the
// browser). There is no non-public API_BASE — it could never reach the client.
export const API_BASE = env.NEXT_PUBLIC_API_BASE;
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

console.log('env::', { env, API_BASE });
