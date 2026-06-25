import { CDN_ASSET_POSTS } from '@/env.schema';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
    transpilePackages: ['@repo/types'],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                // CDN_ASSET_POSTS 도메인으로 변경
                hostname: CDN_ASSET_POSTS.replace('https://', ''),
                pathname: '/**',
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
