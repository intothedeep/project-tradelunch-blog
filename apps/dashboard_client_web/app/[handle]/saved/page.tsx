import type { Metadata } from 'next';

import { SavedOwnerGate } from '@/components/me/SavedOwnerGate.client';

// Per-viewer page: kept out of the index. The shell reads no request data; the
// owner check is the client gate (PJ-2-02).
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default async function SavedPage({
    params,
}: {
    params: Promise<{ handle: string }>;
}) {
    const { handle } = await params;
    return <SavedOwnerGate handle={handle} />;
}
