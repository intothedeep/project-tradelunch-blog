import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// finance_web: standalone finance dashboard — no blog CDN, no public images.
// Full image remotePatterns + API rewrites arrive in P3 when routes are wired.
const nextConfig: NextConfig = {
    transpilePackages: ['@repo/types'],
};

// No arg → next-intl loads the request config from ./i18n/request.ts (mirrors
// dashboard_client_web). Messages live under messages/{en,ko}/.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
