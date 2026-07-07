import { API_BASE, CDN_ASSETS } from '@/env.schema';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Build-time diagnostic: prints once during `next build` (Vercel build log),
// NOT in the client bundle. Compares the RAW Vercel env var against the
// zod-validated value — if they differ, the raw value failed `.url()` and
// fell back to the default (e.g. quotes/bare-host → old domain).
console.log('[build] NEXT_PUBLIC_API_BASE (raw)      =', JSON.stringify(process.env.NEXT_PUBLIC_API_BASE));
console.log('[build] API_BASE (validated, baked in)  =', API_BASE);

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
    transpilePackages: ['@repo/types'],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: hostnameOf(CDN_ASSETS),
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
