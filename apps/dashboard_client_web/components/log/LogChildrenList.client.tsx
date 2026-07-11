'use client';

// components/log/LogChildrenList.client.tsx
// Purpose: nested (comment-style) reply list for the focus view. Renders a FLAT
//   pre-order array of depth-1 direct replies AND their depth-2 grandchildren;
//   depth-2 rows are indented with a thread line so the parent→child relationship
//   is visible. Clicking any reply refocuses on it (/log/[author]/[id]) to see its
//   own subtree (and depth-3+ beyond the eager 2 levels). Delete affordance for
//   child author, profile owner, or admin. Dead leaves are pruned server-side.
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

// Per-level left margin + thread line. Only two nesting levels are rendered
// (depth-1 = 0, depth-2 = 1); deeper replies are reached by refocusing.
const INDENT_CLASS = ['', 'ml-5 border-l-2 border-primary/15 pl-3 sm:ml-8'];

export function LogChildrenList({ username, logId, initialData }: Props) {
    const router = useRouter();
    const { data: me } = useMe();

    const {
        focus,
        children,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useLogThread(logId, initialData);

    const deleteLog = useDeleteLog(username, logId);

    // Depth-1 replies sit at focus.depth + 1; indent is relative to that so
    // depth-1 renders flush (0) and depth-2 renders one level in (1).
    const baseDepth = (focus?.depth ?? 0) + 1;
    const indentOf = (log: TLog): number =>
        Math.min(Math.max(log.depth - baseDepth, 0), INDENT_CLASS.length - 1);

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

    // Refocus directly on the reply's canonical author (a reply may be by another
    // user); fall back to the current segment for a deleted node (author masked →
    // canonical redirect is skipped and renders masked).
    function openReply(log: TLog): void {
        const segment = log.authorUsername
            ? `@${log.authorUsername}`
            : username;
        router.push(`/log/${encodeURIComponent(segment)}/${log.id}`);
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
                            className={cn(
                                'cursor-pointer',
                                INDENT_CLASS[indentOf(child)]
                            )}
                            onClick={() => openReply(child)}
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
