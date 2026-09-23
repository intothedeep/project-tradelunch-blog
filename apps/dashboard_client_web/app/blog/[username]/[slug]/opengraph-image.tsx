// app/blog/[username]/[slug]/opengraph-image.tsx
// Purpose: Dynamic OG image for each blog post. Colocated so Next.js auto-injects
//   the <meta og:image> — the page's generateMetadata only provides stored_uri
//   as an explicit fallback when present (avoids duplicate og:image tags).
// Runtime: nodejs (ImageResponse requires it; edge has no sharp/canvas).
// Caching: 24h, and deliberately so. Rendering an ImageResponse (satori + resvg)
//   is the most CPU-expensive work in the app, and crawlers fetch OG images far
//   more often than humans load pages. Uncached, this route alone can exhaust
//   Vercel Hobby's Active CPU budget — it is the prime suspect for the 2026-09-22
//   outage. BOTH knobs below are required: the route segment `revalidate` caches
//   the rendered PNG, while the fetch-level `revalidate` keeps the post lookup
//   out of `no-store` — a single `no-store` fetch would force this route dynamic
//   again and silently undo the segment cache.
//   A title changing up to 24h late in a social preview is harmless.

import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/apis/getPost.api';
import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/lib/og';

export const runtime = 'nodejs';
// Must be a literal: Next statically analyses segment config exports and
// rejects a const reference ("Invalid segment configuration export").
export const revalidate = 86400; // 24h

const OG_CACHE_SECONDS = 86400; // keep in sync with `revalidate` above
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Blog post open graph image';

interface Props {
    params: Promise<{ slug: string; username: string }>;
}

export default async function Image({ params }: Props): Promise<ImageResponse> {
    const { slug } = await params;

    try {
        const post = await getPostBySlug(slug, undefined, OG_CACHE_SECONDS);
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
