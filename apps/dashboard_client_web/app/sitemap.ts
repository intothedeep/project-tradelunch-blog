import type { MetadataRoute } from 'next';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';
import { getFunds } from '@/app/actions/getFunds.action';
import { getRankings } from '@/app/actions/getRankings.action';
import { getPoliticians } from '@/app/actions/getPoliticians.action';
import { SITE_URL } from '@/env.schema';

// sitemap.xml generator (Next.js 16 MetadataRoute.Sitemap).
// Scope: indexable CONTENT pages only — the content statics
// (/, /blog, /about, /resume), the finance section indexes
// (/rankings, /funds, /screener), every published post, and every 13F fund
// detail page (/funds/[cik], enumerated from the public funds list).
// Deliberately EXCLUDED (KISS/YAGNI — avoid app noise & duplicate content):
//   - /dashboard, /dashboard/[username]  → interactive app views, not content
//   - /blog/@[username] author feeds      → owner's is canonicalized to `/`;
//                                            never emitted (not enumerated here)
//   - /(feed)/tags/[tag]                  → thin aggregations, no canonical meta
//   - all auth/protected routes           → already blocked in robots.ts
// NOTE: post URLs (/blog/@username/slug) are the canonical post pages and are
// distinct from the deduped author-feed page — safe to include in full.
// Without this, sitemap.ts is a build-time-cached static Route Handler:
// getBlogPostsByUsername() resolves once at build, so posts published after
// deploy never appear until the next build. ISR revalidation re-fetches
// hourly so newly published posts get discovered without a redeploy.
export const revalidate = 3600; // seconds

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const staticPages: MetadataRoute.Sitemap = [
        {
            url: SITE_URL,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${SITE_URL}/blog`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/about`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.6,
        },
        {
            url: `${SITE_URL}/resume`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        // Finance section index pages — public, DB-backed content views.
        {
            url: `${SITE_URL}/rankings`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${SITE_URL}/funds`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${SITE_URL}/screener`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
    ];

    // Dynamic published posts: /blog/@[username]/[slug]
    let postPages: MetadataRoute.Sitemap = [];
    try {
        const response = await getBlogPostsByUsername(0, 1000); // all posts
        postPages = response.posts
            .filter((post) => post.username && post.slug)
            .map((post) => ({
                url: `${SITE_URL}/blog/@${post.username}/${post.slug}`,
                lastModified: post.updated_at ? new Date(post.updated_at) : now,
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            }));
    } catch (error) {
        console.error('Failed to fetch posts for sitemap:', error);
    }

    // Dynamic 13F fund detail pages: /funds/[cik]. Enumerated from the public
    // funds list (getFunds returns a typed result — never throws). On backend
    // failure we emit no fund URLs rather than break the whole sitemap.
    let fundPages: MetadataRoute.Sitemap = [];
    const fundsResult = await getFunds();
    if (fundsResult.ok) {
        fundPages = fundsResult.data.map((fund) => ({
            url: `${SITE_URL}/funds/${fund.cik}`,
            lastModified: fund.periodOfReport
                ? new Date(fund.periodOfReport)
                : now,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        }));
    }

    // Dynamic symbol pages: /symbols/[ticker]. Enumerated from the global
    // rankings top-1000 list (getRankings returns a typed result — never throws).
    // Emit the ticker verbatim (uppercase) to match the page's self-canonical
    // (symbols/[ticker]/page.tsx) and every inbound link — URLs are
    // case-sensitive, so lowercasing here would split into a duplicate page.
    // On backend failure emit no symbol URLs rather than break the sitemap.
    let symbolPages: MetadataRoute.Sitemap = [];
    const rankingsResult = await getRankings({ scope: 'global', limit: 1000 });
    if (rankingsResult.ok && rankingsResult.data) {
        symbolPages = rankingsResult.data.rows.map((row) => ({
            url: `${SITE_URL}/symbols/${row.symbol}`,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        }));
    }

    // Dynamic politician pages: /politicians/[filerId]. Enumerated from the
    // public politicians list. On backend failure emit no politician URLs.
    let politicianPages: MetadataRoute.Sitemap = [];
    const politiciansResult = await getPoliticians();
    if (politiciansResult.ok) {
        politicianPages = politiciansResult.data.map((p) => ({
            url: `${SITE_URL}/politicians/${p.filerId}`,
            changeFrequency: 'monthly' as const,
            priority: 0.5,
        }));
    }

    return [
        ...staticPages,
        ...postPages,
        ...fundPages,
        ...symbolPages,
        ...politicianPages,
    ];
}
