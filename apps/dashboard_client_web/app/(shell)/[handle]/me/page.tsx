import type { Metadata } from 'next';

import { MyPostsList } from '@/components/me/MyPostsList.client';
import { OwnerOnly } from '@/components/me/OwnerOnly.server';

// Per-user drafts route: must never be statically prerendered (the client list
// uses TanStack Query, which has no QueryClient during static export). Owner-
// only, 404 for everyone else.
export const dynamic = 'force-dynamic';

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
        <OwnerOnly handle={handle}>
            <MyPostsList />
        </OwnerOnly>
    );
}
