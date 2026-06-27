import { CDN_ASSETS } from '@/env.schema';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

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
