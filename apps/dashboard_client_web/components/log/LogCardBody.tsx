// components/log/LogCardBody.tsx
// Purpose: the CONTENT half of a log row (header: @name · Author · time · delete;
//   then the body with an optional muted "@parent" reply prefix). Split out from
//   LogCard so the threaded view can own the avatar column + connecting lines
//   while reusing identical content markup.
// Constraints: pure display. Tailwind + cn only. No "use client".

import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

type Props = {
    log: TLog;
    canDelete?: boolean;
    onDelete?: () => void;
    replyingTo?: string;
    isAuthor?: boolean;
};

function formatRelative(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
}

export function LogCardBody({
    log,
    canDelete,
    onDelete,
    replyingTo,
    isAuthor,
}: Props) {
    return (
        <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs">
                {!log.isDeleted && log.authorName ? (
                    <span className="font-semibold text-primary/80">
                        @{log.authorName}
                    </span>
                ) : (
                    <span className="text-primary/40">[deleted]</span>
                )}
                {isAuthor && !log.isDeleted ? (
                    <span className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary/60">
                        Author
                    </span>
                ) : null}
                <span className="text-primary/30">·</span>
                <time
                    dateTime={log.createdAt}
                    className="text-primary/40"
                >
                    {formatRelative(log.createdAt)}
                </time>
                <span className="flex-1" />
                {canDelete && !log.isDeleted && onDelete ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            // Don't bubble to a clickable wrapper (refocus).
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="text-destructive/70 transition-colors hover:text-destructive"
                        aria-label="Delete log entry"
                    >
                        Delete
                    </button>
                ) : null}
            </div>
            <p
                className={cn(
                    'mt-0.5 whitespace-pre-wrap break-words text-sm',
                    log.isDeleted && 'italic text-primary/40'
                )}
            >
                {replyingTo && !log.isDeleted ? (
                    <span className="font-medium text-primary/50">
                        @{replyingTo}{' '}
                    </span>
                ) : null}
                {log.body}
            </p>
        </div>
    );
}
