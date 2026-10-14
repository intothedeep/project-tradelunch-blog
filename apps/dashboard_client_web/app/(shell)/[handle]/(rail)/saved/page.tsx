import type { Metadata } from 'next';

import { OwnerOnly } from '@/components/me/OwnerOnly.server';
import { SavedPostsList } from '@/components/me/SavedPostsList.client';

// Per-viewer page: kept out of the index. Owner-only, 404 for everyone else.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default async function SavedPage({
    params,
}: {
    params: Promise<{ handle: string }>;
}) {
    const { handle } = await params;
    return (
        <OwnerOnly handle={handle}>
            <SavedPostsList />
        </OwnerOnly>
    );
}
