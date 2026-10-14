import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MyPostsList } from '@/components/me/MyPostsList.client';
import { OwnerOnly } from '@/components/me/OwnerOnly.server';

// Per-user drafts route. The owner check is request-time data, so it sits in a
// Suspense leaf: the shell holds only the fallback and the client list is never
// prerendered. Anonymous requests get the real 404 from proxy.ts; a signed-in
// non-owner gets the 404 view from OwnerOnly.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default async function MyPostsPage({
    params,
}: {
    params: Promise<{ handle: string }>;
}) {
    const { handle } = await params;
    return (
        <Suspense fallback={null}>
            <OwnerOnly handle={handle}>
                <MyPostsList />
            </OwnerOnly>
        </Suspense>
    );
}
