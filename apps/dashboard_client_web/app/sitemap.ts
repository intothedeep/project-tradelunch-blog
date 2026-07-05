import type { MetadataRoute } from 'next';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';
import { SITE_URL } from '@/env.schema';

// sitemap.xml generator (Next.js 16 MetadataRoute.Sitemap).
// Scope: BLOG CONTENT ONLY — the content statics (/, /blog, /about, /resume)
// and every published post. The finance section (/rankings, /funds, /screener,
// /symbols/[ticker], /politicians/[filerId], /funds/[cik]) is DELIBERATELY
// EXCLUDED: those are the owner's personal analysis surfaces, not public
// content, and enumerating them here (a) advertised thousands of DB-backed
// detail URLs to crawlers and (b) made THIS file pull funds + top-1000 rankings
// + up to 5000 politicians from Supabase on every (re)generation — a large
// Supabase-egress source. De-indexing them (also robots.ts-disallowed) keeps
// the free-tier egress budget for the blog. Re-add here only if a finance
// surface is intentionally made public again.
// Also excluded (unchanged): /dashboard*, /blog/@[username] author feeds
// (owner canonicalized to `/`), /(feed)/tags/[tag], all auth/protected routes.
// ISR: without `revalidate` this is a build-time static handler, so posts
// published after deploy never appear; hourly re-fetch discovers them without a
// redeploy.
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

    return [...staticPages, ...postPages];
}
