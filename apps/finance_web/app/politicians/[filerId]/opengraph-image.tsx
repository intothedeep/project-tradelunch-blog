// app/politicians/[filerId]/opengraph-image.tsx
// Purpose: Dynamic OG image for per-politician pages. Fetches filer name via
//   getPolitician (mirrors the page's own fetcher pattern) — degrade to filerId
//   on failure. Colocated so Next.js auto-injects <meta og:image>.
// Runtime: nodejs (ImageResponse requires it).

import { ImageResponse } from 'next/og';
import { getPolitician } from '@/app/actions/getPolitician.action';
import { OG_SIZE, OG_CONTENT_TYPE, renderOgCard } from '@/lib/og';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Politician PTR trade disclosures open graph image';

interface Props {
    params: Promise<{ filerId: string }>;
}

export default async function Image({ params }: Props): Promise<ImageResponse> {
    const { filerId } = await params;

    let filerName = filerId;
    try {
        const result = await getPolitician(filerId);
        if (result.ok && result.data) {
            filerName = result.data.filer.filerName;
        }
    } catch {
        // Degrade to filerId on fetch failure.
    }

    return new ImageResponse(
        renderOgCard({
            title: filerName,
            subtitle: 'PTR trade disclosures',
            badge: 'prettylog',
        }),
        OG_SIZE
    );
}
