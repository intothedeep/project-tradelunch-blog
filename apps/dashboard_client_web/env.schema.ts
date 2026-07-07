import { z } from 'zod';

// NOTE: do NOT call dotenv.config()/process.cwd() here. This module is
// isomorphic — it is pulled into the CLIENT bundle via axios_instance →
// apis/*.api.ts → client query hooks (e.g. useFavorites). dotenv reads
// process.stdout.isTTY, which is undefined in the browser and throws,
// crashing client module evaluation. Next.js already injects .env / .env.*
// (and NEXT_PUBLIC_* are inlined at build time), so dotenv is redundant.
// Read process.env directly; zod defaults cover anything unset on the client.

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),
    PORT: z.coerce.number().default(3000),
    HOST_NAME: z.string().default('localhost'),

    // Public URLs: `.default()` covers an UNSET var, but a var SET to an invalid
    // value (empty string, bare host, stale/renamed value on the deploy target)
    // would make `.url()` throw inside `env.parse()` — and because next.config.ts
    // imports from here at config-load time, that hard-fails the entire build
    // before any page is generated. `.catch()` makes the parse total: any invalid
    // value falls back to the safe default instead of crashing the build.
    NEXT_PUBLIC_API_BASE: z
        .url()
        // Default/catch to the PROD backend (mirrors NEXT_PUBLIC_CDN_ASSETS below).
        // Public hosts default to prod so an unset/invalid Vercel env can never
        // bake `localhost:4000` into the client bundle (favorites etc. → CONN
        // REFUSED). Local dev overrides via `.env.local` (NEXT_PUBLIC_API_BASE=
        // http://localhost:4000). Repoint to a custom api domain once one exists.
        .default('https://blogapi.prettylog.com')
        .catch('https://error.:::apibase.com'),

    NEXT_PUBLIC_CDN_ASSETS: z
        .url()
        .default('https://assets.prettylog.com')
        .catch('https://error.:::cdnassets.com'),

    // Dashboard data source switch. Absent env → 'mock' (live behavior unchanged).
    DASHBOARD_DATA_SOURCE: z.enum(['mock', 'backend']).default('mock'),

    // Canonical public site origin (the deployed frontend domain). Single
    // source for robots.ts / sitemap.ts absolute URLs (and share links).
    // Unified here so consumers read ONE validated value instead of divergent
    // inline `process.env.NEXT_PUBLIC_SITE_URL || '...'` fallbacks — robots.ts
    // previously defaulted to a STALE 'tradelunch.com'. `.url().default().catch()`
    // mirrors the other public hosts: an unset OR invalid Vercel env can never
    // hard-fail the build (next.config.ts imports this at config-load time).
    NEXT_PUBLIC_SITE_URL: z
        .string()
        .url()
        .default('https://my.prettylog.com')
        .catch('https://my.prettylog.com'),

    // Clerk publishable key. Optional so build stays green without it;
    // Clerk reads it at runtime (USER sets on Vercel).
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
});

// Dot-access each var so Next inlines the NEXT_PUBLIC_* ones into the CLIENT
// bundle. Passing the bare `process.env` object does NOT inline them, so in the
// browser they'd be undefined and fall back to the default/catch (e.g. API_BASE
// silently became the prod default even when .env.local set localhost). The
// explicit references below are what make client-side reads honor the real env.
export const env = envSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    HOST_NAME: process.env.HOST_NAME,
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
    NEXT_PUBLIC_CDN_ASSETS: process.env.NEXT_PUBLIC_CDN_ASSETS,
    DASHBOARD_DATA_SOURCE: process.env.DASHBOARD_DATA_SOURCE,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

export const SERVER_PORT = env.PORT;
export const HOST_NAME = env.HOST_NAME;
export const API_BASE = env.NEXT_PUBLIC_API_BASE;
export const CDN_ASSETS = env.NEXT_PUBLIC_CDN_ASSETS;
export const DASHBOARD_DATA_SOURCE = env.DASHBOARD_DATA_SOURCE;
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL;
