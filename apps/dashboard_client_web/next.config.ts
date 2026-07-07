import { API_BASE, CDN_ASSETS } from '@/env.schema';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Build-time diagnostic: prints once during `next build` (Vercel build log),
// NOT in the client bundle. Vercel auto-REDACTS any log string equal to an env
// var value, so we print BOOLEANS/derived facts (never the raw value) — these
// are not secrets and survive the log scrubber. Reveals whether the baked value
// is the new host, whether it fell back, and the raw env presence/shape.
const rawApiBase = process.env.NEXT_PUBLIC_API_BASE;
console.log('[build] NEXT_PUBLIC_API_BASE present?    =', rawApiBase !== undefined);
console.log('[build] raw length                       =', rawApiBase?.length ?? 0);
console.log('[build] raw has quote/space?             =', /["'\s]/.test(rawApiBase ?? ''));
console.log('[build] raw === validated (no fallback)? =', rawApiBase === API_BASE);
console.log('[build] baked host = NEW (taeklim)?      =', API_BASE.includes('taeklim'));
console.log('[build] baked host = OLD (tradelunch)?   =', API_BASE.includes('project-tradelunch'));

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
