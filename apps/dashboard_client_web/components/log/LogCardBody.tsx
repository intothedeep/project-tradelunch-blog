// components/log/LogCardBody.tsx
// Purpose: the CONTENT half of a log row (header: @name · Author · time · delete;
//   then the body with an optional muted "@parent" reply prefix).
//   When isOwner=true: renders LogTodoBadge (status chip) and LogTodoControls
//   (done toggle + date picker) — both are no-ops when todoStatus is absent.
// Constraints: No "use client". Tailwind + cn only. LogTodoControls is lazy-imported
//   as a client boundary; LogTodoBadge is pure.

import { cn } from '@/lib/utils';
import { LogTodoBadge } from '@/components/log/LogTodoBadge';
import type { TLog } from '@repo/types';

// Lazy-import LogTodoControls as a client component so this file stays server-safe.
// Using a dynamic-import pattern is overkill for a small component; instead we just
// accept the "use client" boundary propagation: any page that renders LogCardBody
// with isOwner=true will already be in a client subtree (LogStream.client, etc.).
// We import directly — the file has "use client" so the boundary is correctly placed.
import { LogTodoControls } from '@/components/log/LogTodoControls.client';

type Props = {
    log: TLog;
    canDelete?: boolean;
    onDelete?: () => void;
    replyingTo?: string;
    isAuthor?: boolean;
    /** When true the viewer is the profile owner — show todo badge + controls. */
    isOwner?: boolean;
    /** Profile owner's username — forwarded to LogTodoControls for query key. */
    username?: string;
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
    isOwner = false,
    username,
}: Props) {
    // Show todo UI only when: owner AND log is not deleted AND todoStatus is present
    // (todoStatus absent = not a todo, or migration not applied yet → graceful no-op).
    const showTodoBadge = isOwner && !log.isDeleted && log.todoStatus != null;
    const showTodoControls = isOwner && !log.isDeleted && !!username;

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
                {showTodoBadge && <LogTodoBadge todoStatus={log.todoStatus} />}
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
            {showTodoControls && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                >
                    <LogTodoControls
                        log={log}
                        username={username}
                    />
                </div>
            )}
        </div>
    );
}
