import type { MetadataRoute } from 'next';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';
import { SITE_URL } from '@/env.schema';

// sitemap.xml generator (Next.js 16 MetadataRoute.Sitemap).
// Scope: BLOG CONTENT ONLY — the content statics (/, /blog, /about, /resume)
// and every published post. Finance now lives in a SEPARATE app/repo
// (finance_web) that owns its own sitemap; nothing finance is enumerated here.
// (Those DB-backed finance detail URLs were also a large Supabase-egress source,
// so keeping them out of the blog sitemap protects the free-tier egress budget.)
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
