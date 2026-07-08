// app/symbols/[ticker]/opengraph-image.tsx
// Purpose: Dynamic OG image for per-ticker symbol pages. Colocated so Next.js
//   auto-injects <meta og:image>. Ticker from URL param (no backend fetch needed
//   — the title is the symbol itself, which is deterministic from the route).
// Runtime: nodejs (ImageResponse requires it).

import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt =
    'Symbol marketcap and institutional holders open graph image';

interface Props {
    params: Promise<{ ticker: string }>;
}

export default async function Image({ params }: Props): Promise<ImageResponse> {
    const { ticker } = await params;
    const symbol = ticker.toUpperCase();

    return new ImageResponse(
        renderOgCard({
            title: symbol,
            subtitle: 'Marketcap & institutional holders',
            badge: 'prettylog',
        }),
        OG_SIZE
    );
}
