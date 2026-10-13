import { API_BASE, CDN_ASSETS } from '@/env.schema';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'node:url';

// Build-time diagnostic: prints once during `next build` (Vercel build log),
// NOT in the client bundle. Vercel auto-REDACTS any log string equal to an env
// var value, so we print BOOLEANS/derived facts (never the raw value) — these
// are not secrets and survive the log scrubber. Reveals whether the baked value
// is the new host, whether it fell back, and the raw env presence/shape.
const rawApiBase = process.env.NEXT_PUBLIC_API_BASE;
console.log(
    '[build] NEXT_PUBLIC_API_BASE present?    =',
    rawApiBase !== undefined
);
console.log(
    '[build] raw length                       =',
    rawApiBase?.length ?? 0
);
console.log(
    '[build] raw has quote/space?             =',
    /["'\s]/.test(rawApiBase ?? '')
);
console.log(
    '[build] raw === validated (no fallback)? =',
    rawApiBase === API_BASE
);
console.log(
    '[build] baked host = NEW (taeklim)?      =',
    API_BASE.includes('blog-api')
);
console.log(
    '[build] baked host = OLD (tradelunch)?   =',
    API_BASE.includes('prettylog.com')
);

// Extract a bare hostname even when CDN_ASSETS carries a path (e.g. a Supabase
// public-storage base). `remotePatterns.hostname` must be host-only.
function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
    }
}

const nextConfig: NextConfig = {
    // Do not advertise the framework (measured 2026-10-13: `x-powered-by: Next.js`).
    poweredByHeader: false,
    transpilePackages: ['@repo/types'],
    // Self-hosted PM2 deploy (GCP): standalone server.js + traced node_modules.
    // The trace root must be the monorepo root: with pnpm node-linker=isolated
    // the real packages live in the root .pnpm store, outside this app dir.
    output: 'standalone',
    outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
    // Dev only: the local-with-prod-Clerk host (LOCAL_PROD_API.md, mode C).
    // Without it the dev server blocks HMR from that origin.
    allowedDevOrigins: ['local.prettylog.com'],
    images: {
        // Bypass Vercel's image optimizer (2026-09-22, quota outage). Every
        // <Image> was being routed through /_next/image, which re-encodes to
        // avif/webp at 6 device widths and serves the bytes FROM VERCEL —
        // burning Image Transformations (Hobby caps at 5,000/mo) and Fast Data
        // Transfer, and bypassing the OCI + Cloudflare CDN that exists for
        // exactly this. Uploads are already resized and webp-encoded at write
        // time (Phase F/F2), so there is little left for the optimizer to do.
        // The settings below are kept for the day this is re-enabled.
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: hostnameOf(CDN_ASSETS),
                pathname: '/**',
            },
            {
                // OCI Object Storage served via the blog-assets.prettylog.com
                // Cloudflare Worker (production CDN). Explicit floor so next/image
                // allows it even if NEXT_PUBLIC_CDN_ASSETS is unset/misconfigured;
                // the dynamic pattern above also covers it when the env is set.
                protocol: 'https',
                hostname: 'blog-assets.prettylog.com',
                pathname: '/**',
            },
            {
                // Supabase public storage (raw URL until a CDN CNAME fronts it).
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
        ],
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 60 * 60 * 24 * 30, // 30일
        dangerouslyAllowSVG: true,
        contentDispositionType: 'attachment',
        contentSecurityPolicy:
            "default-src 'self'; script-src 'none'; sandbox;",
    },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
