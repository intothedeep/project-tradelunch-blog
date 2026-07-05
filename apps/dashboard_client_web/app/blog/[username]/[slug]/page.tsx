import type { Metadata } from 'next';
import clsx from 'clsx';
import { auth } from '@clerk/nextjs/server';
import { getPostBySlug } from '@/apis/getPost.api';
import { buildBlogPostingLd, buildBreadcrumbLd } from '@/lib/jsonld';
import { JsonLd } from '@/components/seo/JsonLd.server';
import PostContent from '@/components/blog/PostContent.server';

type Props = {
    params: Promise<{
        slug: string;
        username: string;
    }>;
};

/** Strip rudimentary markdown/HTML and collapse whitespace for plain-text snippets. */
function toPlainText(raw: string): string {
    return raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/[#*`_~[\]()>!|-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildDescription(post: {
    description?: string;
    content?: string;
}): string {
    const source =
        post.description ?? (post.content ? toPlainText(post.content) : '');
    return source.length > 160 ? source.slice(0, 157) + '...' : source;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, username } = await params;
    const author = decodeURIComponent(username ?? '').replace(/^@/, '');
    const canonicalPath = `/blog/@${author}/${slug}`;

    // Forward token so the owner gets correct metadata for their own private post.
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }

    try {
        const post = await getPostBySlug({ slug, token });
        const title = post.title as string;
        const description = buildDescription(post);
        // Only pass stored_uri as an explicit override — when absent, Next.js
        // auto-injects the colocated opengraph-image.tsx dynamic OG card.
        // Including a fallback here would create duplicate og:image tags.
        const storedImage = post.stored_uri as string | undefined;
        const authorName = (post.display_name as string | undefined) ?? author;

        return {
            title,
            description,
            alternates: { canonical: canonicalPath },
            openGraph: {
                type: 'article',
                title,
                description,
                url: canonicalPath,
                ...(storedImage ? { images: [storedImage] } : {}),
                publishedTime: post.created_at as string | undefined,
                modifiedTime: post.updated_at as string | undefined,
                authors: [authorName],
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
            },
        };
    } catch {
        return { title: 'Post' };
    }
}

export default async function BlogDetailPage({ params }: Props) {
    const { slug, username } = await params;

    // Route param is `@`-prefixed (links built as `/blog/@${username}`);
    // strip the leading `@` so it can be compared to a Clerk username.
    const ownerUsername = decodeURIComponent(username ?? '').replace(/^@/, '');
    const canonicalPath = `/blog/@${ownerUsername}/${slug}`;

    // Forward token so the owner gets a correct JSON-LD for their private post.
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }

    // Fetches the post again for JSON-LD. NOTE: getPostBySlug's cache() wrapper
    // keys by object identity, so this does NOT dedupe with the other call sites —
    // each is a distinct backend round-trip (acceptable: internal, no-store).
    let jsonLd: object[] | null = null;
    try {
        const post = await getPostBySlug({ slug, token });
        jsonLd = [
            buildBlogPostingLd({
                title: post.title as string,
                description: buildDescription(post),
                url: canonicalPath,
                image: post.stored_uri as string | undefined,
                datePublished: post.created_at as string | undefined,
                dateModified: post.updated_at as string | undefined,
                authorName:
                    ((post.display_name ?? post.username) as
                        | string
                        | undefined) ?? ownerUsername,
            }),
            buildBreadcrumbLd([
                { name: 'Home', url: '/' },
                { name: 'Blog', url: '/blog' },
                { name: post.title as string, url: canonicalPath },
            ]),
        ];
    } catch {
        // JSON-LD is non-critical; degrade silently.
    }

    return (
        <section className={clsx('blog-username-slug')}>
            {jsonLd && <JsonLd data={jsonLd} />}
            <PostContent
                slug={slug}
                ownerUsername={ownerUsername}
            />
        </section>
    );
}
