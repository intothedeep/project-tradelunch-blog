import type { MetadataRoute } from 'next';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';
import { SITE_URL } from '@/env.schema';

// sitemap.xml generator (Next.js 16 MetadataRoute.Sitemap).
// Scope: indexable CONTENT pages only — the content statics
// (/, /blog, /about, /resume) plus every published post.
// Deliberately EXCLUDED (KISS/YAGNI — avoid app noise & duplicate content):
//   - /dashboard, /dashboard/[username]  → interactive app views, not content
//   - /blog/@[username] author feeds      → owner's is canonicalized to `/`;
//                                            never emitted (not enumerated here)
//   - /(feed)/tags/[tag]                  → thin aggregations, no canonical meta
//   - all auth/protected routes           → already blocked in robots.ts
// NOTE: post URLs (/blog/@username/slug) are the canonical post pages and are
// distinct from the deduped author-feed page — safe to include in full.
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
                lastModified: post.updated_at
                    ? new Date(post.updated_at)
                    : now,
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            }));
    } catch (error) {
        console.error('Failed to fetch posts for sitemap:', error);
    }

    return [...staticPages, ...postPages];
}
