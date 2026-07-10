'use client';

// components/log/LogChildrenList.client.tsx
// Purpose: infinite-scroll list of direct children (depth-1) in the focus view.
//   Clicking a child navigates to that child's focus route (/log/[username]/[childId]).
//   Delete affordance for child author, profile owner, or admin.
//   Dead leaves (deleted with no live descendants) are pruned server-side.
// Constraints: "use client". ids stay STRINGS. Seeded from SSR.

import { useRouter } from 'next/navigation';
import { useMe } from '@/hooks/useMe.query.client';
import { useLogThread } from '@/hooks/useLogThread.query.client';
import { useDeleteLog } from '@/hooks/useDeleteLog.query.client';
import { LogCard } from '@/components/log/LogCard';
import { cn } from '@/lib/utils';
import type { TLog, TLogThreadResponse } from '@repo/types';

type Props = {
    username: string;
    logId: string; // focus node id
    initialData?: TLogThreadResponse;
};

export function LogChildrenList({ username, logId, initialData }: Props) {
    const router = useRouter();
    const { data: me } = useMe();

    const {
        children,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useLogThread(logId, initialData);

    const deleteLog = useDeleteLog(username, logId);

    function canDelete(log: TLog): boolean {
        if (!me) return false;
        if (me.isAdmin) return true;
        if (me.username === username) return true;
        // Compare canonical username (identifier), not authorName (display label).
        return (
            log.authorUsername !== undefined &&
            me.username === log.authorUsername
        );
    }

    if (isError) {
        return (
            <p
                role="alert"
                className="text-sm text-destructive"
            >
                Failed to load replies.
            </p>
        );
    }

    return (
        <section
            aria-label="Replies"
            className="mt-4"
        >
            {children.length === 0 ? (
                <p className="text-xs text-primary/40">No replies yet.</p>
            ) : (
                <ul role="list">
                    {children.map((child) => (
                        <li
                            key={child.id}
                            className="cursor-pointer"
                            onClick={() =>
                                router.push(
                                    // Refocus directly on the child's canonical
                                    // author (a reply may be by another user);
                                    // fall back to the current segment for a
                                    // deleted child (author masked → canonical
                                    // redirect is skipped and renders masked).
                                    `/log/${encodeURIComponent(
                                        child.authorUsername
                                            ? `@${child.authorUsername}`
                                            : username
                                    )}/${child.id}`
                                )
                            }
                        >
                            <LogCard
                                log={child}
                                canDelete={canDelete(child)}
                                onDelete={() =>
                                    deleteLog.mutate({ logId: child.id })
                                }
                            />
                        </li>
                    ))}
                </ul>
            )}
            {hasNextPage ? (
                <button
                    type="button"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className={cn(
                        'mt-3 w-full border border-primary/30 py-2 text-xs',
                        'hover:bg-primary/5 disabled:opacity-50'
                    )}
                >
                    {isFetchingNextPage ? 'Loading…' : 'Load more replies'}
                </button>
            ) : null}
        </section>
    );
}
