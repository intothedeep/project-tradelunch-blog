import { logServerError } from '@/utils/serverLog.util';
import type { MetadataRoute } from 'next';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';
import { SITE_URL } from '@/env.schema';
import { HOME_FEED_AUTHOR } from '@/utils/blog-author';
import { aboutPath, postPath, resumePath } from '@/utils/routes';

// sitemap.xml generator (Next.js 16 MetadataRoute.Sitemap).
// Scope: BLOG CONTENT ONLY — the content statics (/, /@<owner>/about,
// /@<owner>/resume; the last two omitted when no owner is configured)
// and every published post. Finance now lives in a SEPARATE app/repo
// (finance_web) that owns its own sitemap; nothing finance is enumerated here.
// (Those DB-backed finance detail URLs were also a large Supabase-egress source,
// so keeping them out of the blog sitemap protects the free-tier egress budget.)
// Also excluded (unchanged): /dashboard*, /@[username]/posts author feeds
// (owner canonicalized to `/`), /(feed)/tags/[tag], all auth/protected routes.
// ISR: without `revalidate` this is a build-time static handler, so posts
// published after deploy never appear; a periodic re-fetch discovers them
// without a redeploy.
//
// 24h, and BOTH knobs are required. The segment `revalidate` below was silently
// dead: Phase CF hardcoded `cache: 'no-store'` in http.server.ts, and a single
// no-store fetch forces its route dynamic — so every crawler hit on
// /sitemap.xml re-fetched up to 1000 posts from Supabase. Next said so at build
// time ("couldn't be rendered statically because it used revalidate: 0 fetch")
// and it went unnoticed. The fetch below now opts into the same 24h window.
export const revalidate = 86400; // 24h — keep in sync with SITEMAP_CACHE_SECONDS

const SITEMAP_CACHE_SECONDS = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const staticPages: MetadataRoute.Sitemap = [
        {
            url: SITE_URL,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 1,
        },
        ...(HOME_FEED_AUTHOR
            ? [
                  {
                      url: `${SITE_URL}${aboutPath(HOME_FEED_AUTHOR)}`,
                      lastModified: now,
                      changeFrequency: 'monthly' as const,
                      priority: 0.6,
                  },
                  {
                      url: `${SITE_URL}${resumePath(HOME_FEED_AUTHOR)}`,
                      lastModified: now,
                      changeFrequency: 'monthly' as const,
                      priority: 0.7,
                  },
              ]
            : []),
    ];

    // Dynamic published posts: /@[username]/[slug]
    let postPages: MetadataRoute.Sitemap = [];
    try {
        const response = await getBlogPostsByUsername(
            0,
            1000, // all posts — the global feed route caps at 1000 for this caller
            '',
            undefined,
            SITEMAP_CACHE_SECONDS
        );
        postPages = response.posts.flatMap((post) =>
            post.username && post.slug
                ? [
                      {
                          url: `${SITE_URL}${postPath(post.username, post.slug)}`,
                          lastModified: post.updated_at
                              ? new Date(post.updated_at)
                              : now,
                          changeFrequency: 'weekly' as const,
                          priority: 0.8,
                      },
                  ]
                : []
        );
    } catch (error) {
        logServerError(
            'Failed to fetch posts for sitemap',
            error,
            {},
            'WARNING'
        );
    }

    return [...staticPages, ...postPages];
}
