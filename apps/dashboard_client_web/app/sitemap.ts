import type { MetadataRoute } from 'next';
import { getBlogPostsByUsername } from '@/apis/getPosts.api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || 'https://my.prettylog.com';

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/blog`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/resume`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.7,
        },
    ];

    // Dynamic blog posts: /blog/[username]/[slug]
    let blogPages: MetadataRoute.Sitemap = [];
    try {
        const response = await getBlogPostsByUsername(0, 1000); // Fetch all posts

        // console.log('>>', response);
        blogPages = response.posts
            .filter((post) => post.username && post.slug)
            .map((post) => ({
                url: `${baseUrl}/blog/@${post.username}/${post.slug}`,
                lastModified: post.updated_at
                    ? new Date(post.updated_at)
                    : new Date(),
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            }));
    } catch (error) {
        console.error('Failed to fetch posts for sitemap:', error);
    }

    return [...staticPages, ...blogPages];
}
