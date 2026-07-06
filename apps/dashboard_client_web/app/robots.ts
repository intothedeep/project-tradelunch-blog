import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/env.schema';

// robots.txt generator (Next.js 16 MetadataRoute.Robots).
// Purpose: keep crawlers on the indexable BLOG content only.
// The finance surfaces (/dashboard, /rankings, /funds, /screener, /symbols,
// /politicians, /backtest) are the owner's personal analysis views — NOT public content.
// Crawling them was the dominant Supabase-egress source (thousands of
// DB-backed detail pages, uncached), so they are Disallowed here AND removed
// from sitemap.ts. Note: robots is ADVISORY — Googlebot/Bingbot obey it, but
// aggressive scrapers may not, so the AI-crawler bucket below is blocked
// wholesale and the de-sitemap is the reinforcing signal.
// Public/indexable: /, /blog, /about, /resume, and published posts.
const FINANCE_DISALLOW = [
    '/dashboard',
    '/rankings',
    '/funds',
    '/screener',
    '/symbols',
    '/politicians',
    '/backtest',
];

// Data/AI scraper bots with no SEO value — blocked wholesale. These are the
// crawlers most likely to hammer the DB-backed pages and often ignore nuance.
const BLOCKED_BOTS = [
    'GPTBot',
    'ChatGPT-User',
    'OAI-SearchBot',
    'CCBot',
    'ClaudeBot',
    'anthropic-ai',
    'Claude-Web',
    'Google-Extended',
    'Bytespider',
    'PerplexityBot',
    'Amazonbot',
    'Applebot-Extended',
    'meta-externalagent',
    'FacebookBot',
    'Diffbot',
    'Omgilibot',
    'cohere-ai',
];

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
                    ...FINANCE_DISALLOW,
                ],
            },
            {
                userAgent: BLOCKED_BOTS,
                disallow: '/',
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
