import { currentUser } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';

import { stripUsernameAt } from '@/utils/blog-author';

// Purpose: `/@u/me` and `/@u/saved` are the viewer's own pages. Anyone else
// (signed out, or another user) gets a real 404, never a sign-in redirect
// (owner, 2026-10-14). Server-side so the status code is 404. The API still
// scopes data to the token's user; this gate is the URL rule.
// The real 404 comes from proxy.ts, which gates signed-in RSC navigations too
// (#103); signed-in prefetch skips that gate (#106). This is the fallback for
// those prefetches and for fail-open requests.
export async function OwnerOnly({
    handle,
    children,
}: {
    handle: string;
    children: React.ReactNode;
}) {
    const user = await currentUser();
    if (
        !user?.username ||
        user.username !== stripUsernameAt(decodeURIComponent(handle))
    ) {
        notFound();
    }
    return <>{children}</>;
}
