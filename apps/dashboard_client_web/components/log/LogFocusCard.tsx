// components/log/LogFocusCard.tsx
// Purpose: renders the focused log node (center of the thread view) Threads-style
//   — avatar + author + "Author" chip, the body, and a full timestamp. Emphasized
//   with a border so it reads as the current focus.
// Constraints: Server Component (no "use client"). Pure display.

import { LogAvatar } from '@/components/log/LogAvatar';
import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

type Props = {
    log: TLog;
    // True when the focus author is the thread's original poster → "Author" chip.
    isAuthor?: boolean;
};

export function LogFocusCard({ log, isAuthor }: Props) {
    const date = new Date(log.createdAt);
    const formatted = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <article
            className={cn(
                'flex gap-3 border border-primary/30 p-4',
                log.isDeleted && 'opacity-60'
            )}
        >
            <LogAvatar
                name={log.authorName}
                avatarUrl={log.authorAvatarUrl}
                deleted={log.isDeleted}
                size={40}
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm">
                    {!log.isDeleted && log.authorName ? (
                        <span className="font-semibold">@{log.authorName}</span>
                    ) : (
                        <span className="text-primary/40">[deleted]</span>
                    )}
                    {isAuthor && !log.isDeleted ? (
                        <span className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary/60">
                            Author
                        </span>
                    ) : null}
                </div>
                <p
                    className={cn(
                        'mt-1 whitespace-pre-wrap break-words text-sm',
                        log.isDeleted && 'italic text-primary/40'
                    )}
                >
                    {log.body}
                </p>
                <time
                    dateTime={log.createdAt}
                    className="mt-2 block text-xs text-primary/40"
                >
                    {formatted}
                </time>
            </div>
        </article>
    );
}
