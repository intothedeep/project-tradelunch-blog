'use client';

// components/log/LogChildrenList.client.tsx
// Purpose: threaded (Threads-style) reply list for the focus view. Direct replies
//   (depth-1) each render with their capped depth-2 grandchildren beneath, and a
//   vertical thread-line runs down the avatar gutter connecting a parent avatar to
//   its child avatars (avatar-to-avatar). Every reply shows the parent's @handle,
//   an "Author" chip for the thread's original poster, and a "Show replies"
//   affordance when it has replies not rendered here (depth-2 overflow, or a
//   depth-2's own depth-3+). Clicking any reply refocuses on it. Dead leaves are
//   pruned server-side.
// Constraints: "use client". ids stay STRINGS. Seeded from SSR.

import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useMe } from '@/hooks/useMe.query.client';
import { useLogThread } from '@/hooks/useLogThread.query.client';
import { useDeleteLog } from '@/hooks/useDeleteLog.query.client';
import { LogAvatar } from '@/components/log/LogAvatar';
import { LogCardBody } from '@/components/log/LogCardBody';
import { toUsernameSegment } from '@/utils/blog-author';
import { cn } from '@/lib/utils';
import type { TLog, TLogThreadResponse } from '@repo/types';

type Props = {
    username: string;
    logId: string; // focus node id
    initialData?: TLogThreadResponse;
};

// The vertical thread line, centered in the w-9 (36px) avatar gutter. Content
// sits gap-3 (12px) to the gutter's right, so "more" buttons align at ml-12.
const THREAD_LINE = 'w-0.5 bg-primary/20';

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

    // One threaded row: [avatar gutter with line segments] [content]. lineAbove
    // connects up to the previous avatar; lineBelow continues down to the next.
    const renderRow = (
        log: TLog,
        size: number,
        lineAbove: boolean,
        lineBelow: boolean
    ) => (
        <div
            className="flex cursor-pointer gap-3"
            onClick={() => openReply(log)}
        >
            <div className="flex w-9 flex-col items-center">
                {lineAbove ? <span className={cn('h-2', THREAD_LINE)} /> : null}
                <LogAvatar
                    name={log.authorName}
                    avatarUrl={log.authorAvatarUrl}
                    deleted={log.isDeleted}
                    size={size}
                />
                {lineBelow ? (
                    <span className={cn('mt-1 grow', THREAD_LINE)} />
                ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-3">
                <LogCardBody
                    log={log}
                    replyingTo={parentHandle(log)}
                    isAuthor={isAuthor(log)}
                    canDelete={canDelete(log)}
                    onDelete={() => deleteLog.mutate({ logId: log.id })}
                />
            </div>
        </div>
    );

    // "Show replies" affordance (aligned under the content column) for a reply
    // whose replies aren't rendered here — clicking refocuses on it.
    const renderMore = (log: TLog, label: string) => (
        <button
            type="button"
            onClick={() => openReply(log)}
            className={cn(
                'mb-2 ml-12 flex items-center gap-1 text-xs font-medium',
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
                        const hasReplies = group.replies.length > 0;
                        return (
                            <li key={group.node.id}>
                                {renderRow(group.node, 36, false, hasReplies)}
                                {group.replies.map((reply, i) => (
                                    <Fragment key={reply.id}>
                                        {renderRow(
                                            reply,
                                            28,
                                            true,
                                            i < group.replies.length - 1 ||
                                                !!group.node.hasMoreReplies
                                        )}
                                        {reply.hasMoreReplies
                                            ? renderMore(reply, '답글 보기')
                                            : null}
                                    </Fragment>
                                ))}
                                {group.node.hasMoreReplies
                                    ? renderMore(group.node, '답글 더 보기')
                                    : null}
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
