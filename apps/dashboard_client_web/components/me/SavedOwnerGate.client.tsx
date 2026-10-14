'use client';

// Purpose: show the saved list only to its owner. `/@u/saved` is the viewer's
// own data, so a different (or signed-out) viewer gets the 404 screen and no
// request is made. Client-only on purpose: the server page stays free of
// `auth()` (cacheComponents, design §7.3). This is a UX gate, not a security
// one: the API returns saved posts for the token's own user only.

import { notFound } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import { SavedPostsList } from '@/components/me/SavedPostsList.client';
import { stripUsernameAt } from '@/utils/blog-author';

export function SavedOwnerGate({ handle }: { handle: string }) {
    const { user, isLoaded } = useUser();
    if (!isLoaded) return null;
    if (user?.username !== stripUsernameAt(decodeURIComponent(handle))) {
        notFound();
    }
    return <SavedPostsList />;
}
