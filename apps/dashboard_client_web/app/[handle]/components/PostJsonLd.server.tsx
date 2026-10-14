import { auth } from '@clerk/nextjs/server';

import { getPostBySlug } from '@/apis/getPost.api';
import { JsonLd } from '@/components/seo/JsonLd.server';
import { buildBlogPostingLd, buildBreadcrumbLd } from '@/lib/jsonld';
import { buildDescription } from '@/utils/post-description';

type Props = { slug: string; author: string };

// JSON-LD leaf. The auth() read lives here, inside a Suspense boundary, so the
// post page itself stays free of dynamic reads (design §7.3). The token lets the
// owner get correct JSON-LD for their private post.
export async function PostJsonLd({ slug, author }: Props) {
    const canonicalPath = `/@${author}/${slug}`;

    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken();
    } catch {
        token = null;
    }

    // getPostBySlug's cache() keys by positional value, so this dedupes with the
    // other same-request call sites passing the same (slug, token).
    let jsonLd: object[] | null = null;
    try {
        const post = await getPostBySlug(slug, token);
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
                        | undefined) ?? author,
            }),
            buildBreadcrumbLd([
                { name: 'Home', url: '/' },
                { name: `@${author}`, url: `/@${author}/posts` },
                { name: post.title as string, url: canonicalPath },
            ]),
        ];
    } catch {
        // JSON-LD is non-critical; degrade silently.
    }

    return jsonLd ? <JsonLd data={jsonLd} /> : null;
}
