// app/blog/[username]/[slug]/opengraph-image.tsx
// Purpose: Dynamic OG image for each blog post. Colocated so Next.js auto-injects
//   the <meta og:image> — the page's generateMetadata only provides stored_uri
//   as an explicit fallback when present (avoids duplicate og:image tags).
// Runtime: nodejs (ImageResponse requires it; edge has no sharp/canvas).

import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/apis/getPost.api';
import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Blog post open graph image';

interface Props {
    params: Promise<{ slug: string; username: string }>;
}

export default async function Image({ params }: Props): Promise<ImageResponse> {
    const { slug } = await params;

    try {
        const post = await getPostBySlug({ slug });
        const title = (post.title as string | undefined) ?? 'Untitled';
        const subtitle =
            (post.display_name as string | undefined) ??
            (post.username as string | undefined) ??
            undefined;

        return new ImageResponse(
            renderOgCard({ title, subtitle, badge: 'prettylog' }),
            OG_SIZE
        );
    } catch {
        // Degrade to a generic branded card on fetch failure.
        return new ImageResponse(
            renderOgCard({ title: 'prettylog', badge: 'prettylog' }),
            OG_SIZE
        );
    }
}
