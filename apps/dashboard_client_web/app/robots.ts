import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/env.schema';

// robots.txt generator (Next.js 16 MetadataRoute.Robots).
// Purpose: keep crawlers on the indexable BLOG content only. (The finance
// surfaces moved to the standalone finance_web app.) Note: robots is ADVISORY —
// Googlebot/Bingbot obey it, but aggressive scrapers may not, so the AI-crawler
// bucket below is blocked wholesale.
// Public/indexable: /, /blog, /about, /resume, and published posts.

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
