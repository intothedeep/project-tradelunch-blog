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
import { toUsernameSegment } from '@/utils/blog-author';
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

    // Parent lookup for the "@parent" reply prefix. Every reply's parent is in
    // the loaded set: a depth-1 reply's parent is the focus; a depth-2 reply's
    // parent is its depth-1 sibling (both present, parent precedes child in the
    // pre-order children array). Uses authorName (the same display label the card
    // shows for the author). Deleted parent → undefined → no prefix.
    const byId = new Map<string, TLog>();
    if (focus) byId.set(focus.id, focus);
    for (const child of children) byId.set(child.id, child);
    const parentHandle = (log: TLog): string | undefined =>
        log.parentId ? byId.get(log.parentId)?.authorName : undefined;

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
        // '@' stays literal via toUsernameSegment (→ /log/@name/id, not %40).
        const segment = toUsernameSegment(log.authorUsername ?? username);
        router.push(`/log/${segment}/${log.id}`);
    }

    // Group the flat pre-order children into depth-1 nodes each with their
    // (capped) depth-2 replies, so the "see more replies" affordance can sit
    // directly under a reply that has overflow (node.hasMoreReplies).
    const groups: { node: TLog; replies: TLog[] }[] = [];
    for (const child of children) {
        if (indentOf(child) === 0) groups.push({ node: child, replies: [] });
        else groups[groups.length - 1]?.replies.push(child);
    }

    const renderCard = (log: TLog, indent: number) => (
        <div
            key={log.id}
            className={cn('cursor-pointer', INDENT_CLASS[indent])}
            onClick={() => openReply(log)}
        >
            <LogCard
                log={log}
                replyingTo={parentHandle(log)}
                canDelete={canDelete(log)}
                onDelete={() => deleteLog.mutate({ logId: log.id })}
            />
        </div>
    );

    // "See (more) replies" affordance: shown when a reply has replies not
    // rendered here — a depth-1 with overflow beyond the cap, or ANY depth-2
    // whose own replies (depth-3+) are hidden. Clicking refocuses on that reply
    // so the reader can tell there's more without opening it blindly.
    const renderMoreButton = (log: TLog, label: string) => (
        <button
            type="button"
            onClick={() => openReply(log)}
            className={cn(
                INDENT_CLASS[1],
                'mt-1 block text-xs font-medium',
                'text-primary/70 hover:text-primary'
            )}
        >
            {label}
        </button>
    );

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
                    {groups.map((group) => (
                        <li key={group.node.id}>
                            {renderCard(group.node, 0)}
                            {group.replies.map((reply) => (
                                <div key={reply.id}>
                                    {renderCard(reply, 1)}
                                    {reply.hasMoreReplies
                                        ? renderMoreButton(reply, '답글 보기 →')
                                        : null}
                                </div>
                            ))}
                            {group.node.hasMoreReplies
                                ? renderMoreButton(group.node, '답글 더 보기 →')
                                : null}
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
