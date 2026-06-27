// components/me/MyPostsList.client.tsx
// Purpose: render the signed-in user's drafts (newest-updated first) with a
// "New post" CTA, plus loading / error / empty states.
// Constraints: client-only (uses the gated useMyDrafts hook). Drafts-only
// endpoint, so no status pills are shown.

'use client';

import Link from 'next/link';
import { useMyDrafts } from '@/hooks/useMyDrafts.query.client';
import { PostListItem } from '@/components/me/PostListItem.client';
import { cn } from '@/lib/utils';

const newPostButtonClass = cn(
    'inline-block border-2 border-primary px-4 py-2 text-sm transition-colors',
    'hover:bg-primary hover:text-primary-foreground'
);

export function MyPostsList() {
    const { data, isLoading, isError } = useMyDrafts();

    return (
        <div className="mx-auto w-full max-w-3xl p-4 font-mono">
            <div className="mb-4 flex items-center justify-between gap-2">
                <h1 className="text-lg">DRAFTS</h1>
                <Link
                    href="/write"
                    className={newPostButtonClass}
                >
                    NEW POST
                </Link>
            </div>

            {isLoading && (
                <ul
                    className="flex flex-col gap-2"
                    aria-busy="true"
                >
                    {[0, 1, 2].map((i) => (
                        <li
                            key={i}
                            className="h-10 animate-pulse border-2 border-primary/20 bg-primary/5"
                        />
                    ))}
                </ul>
            )}

            {!isLoading && isError && (
                <p
                    role="alert"
                    className="text-sm text-destructive"
                >
                    Failed to load drafts.
                </p>
            )}

            {!isLoading && !isError && data && data.length === 0 && (
                <div className="flex flex-col items-start gap-3 border-2 border-primary/30 p-6 text-sm">
                    <span className="text-muted-foreground">
                        No drafts yet.
                    </span>
                    <Link
                        href="/write"
                        className={newPostButtonClass}
                    >
                        WRITE YOUR FIRST POST
                    </Link>
                </div>
            )}

            {!isLoading && !isError && data && data.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {[...data]
                        .sort(
                            (a, b) =>
                                new Date(b.updatedAt).getTime() -
                                new Date(a.updatedAt).getTime()
                        )
                        .map((draft) => (
                            <li key={draft.id}>
                                <PostListItem draft={draft} />
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
}
