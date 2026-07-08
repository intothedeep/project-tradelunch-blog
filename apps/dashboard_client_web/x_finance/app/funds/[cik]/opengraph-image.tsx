// app/funds/[cik]/opengraph-image.tsx
// Purpose: Dynamic OG image for per-fund 13F pages. Looks up fund label via
//   getFunds (mirrors the page's own fetcher pattern) — degrade to CIK on
//   failure. Colocated so Next.js auto-injects <meta og:image>.
// Runtime: nodejs (ImageResponse requires it).

import { ImageResponse } from 'next/og';
import { getFunds } from '@/app/actions/getFunds.action';
import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Fund 13F holdings open graph image';

interface Props {
    params: Promise<{ cik: string }>;
}

export default async function Image({ params }: Props): Promise<ImageResponse> {
    const { cik } = await params;

    let fundLabel = cik;
    try {
        const result = await getFunds();
        if (result.ok) {
            fundLabel = result.data.find((f) => f.cik === cik)?.label ?? cik;
        }
    } catch {
        // Degrade to CIK on fetch failure.
    }

    return new ImageResponse(
        renderOgCard({
            title: fundLabel,
            subtitle: '13F holdings',
            badge: 'prettylog',
        }),
        OG_SIZE
    );
}
