import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/env.schema';

// robots.txt generator (Next.js 16 MetadataRoute.Robots).
// Purpose: keep crawlers on indexable public CONTENT only.
// Disallow = framework internals (/_next), API surface (/api), auth pages,
// Clerk-protected app routes (no SEO value), and the eval-only
// /dashboard/preview variants. Public content (/, /blog, /about, /resume,
// posts) stays crawlable via `allow: '/'`. `host` reinforces the canonical
// origin now unified through SITE_URL.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/_next/',
                    '/sign-in',
                    '/sign-up',
                    '/onboarding',
                    '/write',
                    '/me',
                    '/settings',
                    '/admin',
                    '/dashboard/preview',
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
