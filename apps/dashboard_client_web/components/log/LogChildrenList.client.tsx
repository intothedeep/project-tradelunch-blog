'use client';

// components/log/LogChildrenList.client.tsx
// Purpose: threaded (Threads-style) reply list for the focus view. Direct replies
//   (depth-1) render flush; their capped depth-2 grandchildren render INDENTED
//   inside a container whose left border is the vertical thread-line, dropping
//   from under the parent avatar. Every reply shows the parent's @handle, an
//   "Author" chip for the thread's original poster, and a "Show replies"
//   affordance when it has replies not rendered here (depth-2 overflow, or a
//   depth-2's own depth-3+). Clicking any reply refocuses on it.
// Constraints: "use client". ids stay STRINGS. Seeded from SSR.

import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
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

// Depth-2 wrapper: indent + a left border acting as the vertical thread-line that
// drops from beneath the depth-1 avatar (avatar center ≈ 18px).
const NEST_CLASS = 'ml-[18px] border-l-2 border-primary/15 pl-3';

export function LogChildrenList({ username, logId, initialData }: Props) {
    const router = useRouter();
    const { data: me } = useMe();

    const {
        ancestors,
        focus,
        children,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useLogThread(logId, initialData);

    const deleteLog = useDeleteLog(username, logId);

    // Thread's original poster = the root (first ancestor, or the focus itself
    // when top-level). Any reply by them gets the "Author" chip.
    const rootAuthor = ancestors[0]?.authorUsername ?? focus?.authorUsername;
    const isAuthor = (log: TLog): boolean =>
        !!log.authorUsername && log.authorUsername === rootAuthor;

    const baseDepth = (focus?.depth ?? 0) + 1;

    // Parent lookup for the "@parent" reply prefix — every reply's parent is in
    // the loaded set (focus for depth-1, a depth-1 sibling for depth-2).
    const byId = new Map<string, TLog>();
    if (focus) byId.set(focus.id, focus);
    for (const child of children) byId.set(child.id, child);
    const parentHandle = (log: TLog): string | undefined =>
        log.parentId ? byId.get(log.parentId)?.authorName : undefined;

    function canDelete(log: TLog): boolean {
        if (!me) return false;
        if (me.isAdmin) return true;
        if (me.username === username) return true;
        return (
            log.authorUsername !== undefined &&
            me.username === log.authorUsername
        );
    }

    function openReply(log: TLog): void {
        // '@' stays literal via toUsernameSegment (→ /log/@name/id, not %40).
        const segment = toUsernameSegment(log.authorUsername ?? username);
        router.push(`/log/${segment}/${log.id}`);
    }

    // Group the flat pre-order children into depth-1 nodes + their depth-2 replies.
    const groups: { node: TLog; replies: TLog[] }[] = [];
    for (const child of children) {
        if (child.depth === baseDepth)
            groups.push({ node: child, replies: [] });
        else groups[groups.length - 1]?.replies.push(child);
    }

    const renderCard = (log: TLog, avatarSize: number) => (
        <div
            className="cursor-pointer"
            onClick={() => openReply(log)}
        >
            <LogCard
                log={log}
                avatarSize={avatarSize}
                isAuthor={isAuthor(log)}
                replyingTo={parentHandle(log)}
                canDelete={canDelete(log)}
                onDelete={() => deleteLog.mutate({ logId: log.id })}
            />
        </div>
    );

    // "Show replies" affordance for a reply whose replies aren't rendered here —
    // clicking refocuses on it. Sits inside the nested container (already indented).
    const renderMore = (log: TLog, label: string) => (
        <button
            type="button"
            onClick={() => openReply(log)}
            className={cn(
                'mb-2 flex items-center gap-1 text-xs font-medium',
                'text-primary/60 hover:text-primary'
            )}
        >
            <ChevronDown className="h-3.5 w-3.5" />
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
                    {groups.map((group) => {
                        const nested =
                            group.replies.length > 0 ||
                            !!group.node.hasMoreReplies;
                        return (
                            <li key={group.node.id}>
                                {renderCard(group.node, 36)}
                                {nested ? (
                                    <div className={NEST_CLASS}>
                                        {group.replies.map((reply) => (
                                            <Fragment key={reply.id}>
                                                {renderCard(reply, 28)}
                                                {reply.hasMoreReplies
                                                    ? renderMore(
                                                          reply,
                                                          '답글 보기'
                                                      )
                                                    : null}
                                            </Fragment>
                                        ))}
                                        {group.node.hasMoreReplies
                                            ? renderMore(
                                                  group.node,
                                                  '답글 더 보기'
                                              )
                                            : null}
                                    </div>
                                ) : null}
                            </li>
                        );
                    })}
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
