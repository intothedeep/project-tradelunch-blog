// components/log/LogCard.tsx
// Purpose: a single log entry for the FLAT surfaces (global feed, per-user stream)
//   — avatar on the left + LogCardBody. The threaded focus view does NOT use this;
//   it composes LogAvatar + LogCardBody itself to draw connecting thread-lines.
// Constraints: pure display. Tailwind + cn only. No "use client".
//   isOwner is forwarded so LogCardBody can show todo badge + controls (owner only).
//   threadId is forwarded for LogLikeButton thread cache invalidation (thread view).

import { LogAvatar } from '@/components/log/LogAvatar';
import { LogCardBody } from '@/components/log/LogCardBody';
import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

type Props = {
    log: TLog;
    canDelete?: boolean;
    onDelete?: () => void;
    replyingTo?: string;
    isAuthor?: boolean;
    avatarSize?: number;
    /** Pass true when the viewer IS the profile owner — enables todo badge + controls. */
    isOwner?: boolean;
    /** Profile username — needed by LogTodoControls + LogLikeButton to key the query cache. */
    username?: string;
    /** Thread root logId — forwarded to LogLikeButton for thread cache invalidation. */
    threadId?: string;
};

export function LogCard({
    log,
    canDelete,
    onDelete,
    replyingTo,
    isAuthor,
    avatarSize = 36,
    isOwner = false,
    username,
    threadId,
}: Props) {
    return (
        <article
            className={cn(
                'flex gap-3 border-b border-primary/10 py-3',
                log.isDeleted && 'opacity-60'
            )}
        >
            <LogAvatar
                name={log.authorName}
                avatarUrl={log.authorAvatarUrl}
                deleted={log.isDeleted}
                size={avatarSize}
            />
            <LogCardBody
                log={log}
                canDelete={canDelete}
                onDelete={onDelete}
                replyingTo={replyingTo}
                isAuthor={isAuthor}
                isOwner={isOwner}
                username={username}
                threadId={threadId}
            />
        </article>
    );
}
