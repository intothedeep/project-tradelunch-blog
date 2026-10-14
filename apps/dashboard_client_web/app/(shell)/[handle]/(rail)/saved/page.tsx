import type { Metadata } from 'next';
import { Suspense } from 'react';

import { OwnerOnly } from '@/components/me/OwnerOnly.server';
import { SavedPostsList } from '@/components/me/SavedPostsList.client';

// Per-viewer page: kept out of the index. Owner-only. The owner check is
// request-time data (Suspense leaf). Anonymous requests get the real 404 from
// proxy.ts; a signed-in non-owner gets the 404 view from OwnerOnly.
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
        <Suspense fallback={null}>
            <OwnerOnly handle={handle}>
                <SavedPostsList />
            </OwnerOnly>
        </Suspense>
    );
}
