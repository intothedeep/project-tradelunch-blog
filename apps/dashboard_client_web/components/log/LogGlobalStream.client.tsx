'use client';

// components/log/LogGlobalStream.client.tsx
// Purpose: infinite-scroll list of top-level log entries across ALL users — the
//   /log discovery feed. Seeded from a server-fetched first page; subsequent
//   pages via "Load more". Clicking an entry opens its thread focus view under
//   the entry's author (/log/[author]/[logId]). Read-only: no delete affordance
//   here (delete lives on the per-user stream + focus view).
// Constraints: "use client". ids stay STRINGS. The URL segment uses
//   authorUsername (the canonical identifier), NOT authorName (display label).
//   Deleted top-level entries have no author → rendered non-clickable.

import { useRouter } from 'next/navigation';
import { useLogGlobalStream } from '@/hooks/useLogGlobalStream.query.client';
import { LogCard } from '@/components/log/LogCard';
import { toUsernameSegment } from '@/utils/blog-author';
import { cn } from '@/lib/utils';
import type { TLog, TLogStreamResponse } from '@repo/types';

type Props = {
    initialData?: TLogStreamResponse;
};

export function LogGlobalStream({ initialData }: Props) {
    const router = useRouter();
    const { items, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useLogGlobalStream(initialData);

    // A global entry is navigable only when it has a resolvable author username
    // (a live, non-deleted node). Deleted tombstones stay as plain masked cards.
    function openThread(log: TLog): void {
        if (!log.authorUsername) return;
        router.push(`/log/${toUsernameSegment(log.authorUsername)}/${log.id}`);
    }

    if (isError) {
        return (
            <p
                role="alert"
                className="text-sm text-destructive"
            >
                Failed to load the log feed.
            </p>
        );
    }

    if (items.length === 0) {
        return <p className="text-sm text-primary/50">No log entries yet.</p>;
    }

    return (
        <section aria-label="Global log feed">
            <ul role="list">
                {items.map((log) => {
                    const navigable = !log.isDeleted && !!log.authorUsername;
                    return (
                        <li
                            key={log.id}
                            className={cn(navigable && 'cursor-pointer')}
                            onClick={
                                navigable ? () => openThread(log) : undefined
                            }
                        >
                            <LogCard log={log} />
                        </li>
                    );
                })}
            </ul>
            {hasNextPage ? (
                <button
                    type="button"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className={cn(
                        'mt-4 w-full border border-primary/30 py-2 text-xs',
                        'hover:bg-primary/5 disabled:opacity-50'
                    )}
                >
                    {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
            ) : null}
        </section>
    );
}
