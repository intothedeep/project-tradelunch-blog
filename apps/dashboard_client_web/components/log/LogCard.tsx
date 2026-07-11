// components/log/LogCard.tsx
// Purpose: renders a single log entry. Tombstoned entries render "[deleted]"
//   with no author. Provides delete affordance when caller passes canDelete.
// Constraints: pure display — no mutations. Uses only Tailwind + cn. No "use client".

import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

type Props = {
    log: TLog;
    canDelete?: boolean;
    onDelete?: () => void;
    // Parent author's handle (e.g. "taeklim") — rendered as a muted "@name"
    // prefix before the body so the reply target is visible ("@name content").
    replyingTo?: string;
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

export function LogCard({ log, canDelete, onDelete, replyingTo }: Props) {
    return (
        <article
            className={cn(
                'border-b border-primary/10 py-3',
                log.isDeleted && 'opacity-60'
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    {!log.isDeleted && log.authorName ? (
                        <span className="text-xs font-semibold text-primary/80">
                            @{log.authorName}
                        </span>
                    ) : null}
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
                <div className="flex shrink-0 items-center gap-2">
                    <time
                        dateTime={log.createdAt}
                        className="text-xs text-primary/40"
                    >
                        {formatRelative(log.createdAt)}
                    </time>
                    {canDelete && !log.isDeleted && onDelete ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                // Don't let delete bubble to a clickable card
                                // wrapper (refocus navigation).
                                e.stopPropagation();
                                onDelete();
                            }}
                            className={cn(
                                'text-xs text-destructive/70 hover:text-destructive',
                                'transition-colors'
                            )}
                            aria-label="Delete log entry"
                        >
                            Delete
                        </button>
                    ) : null}
                </div>
            </div>
        </article>
    );
}
