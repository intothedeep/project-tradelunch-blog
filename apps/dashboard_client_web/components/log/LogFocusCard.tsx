// components/log/LogFocusCard.tsx
// Purpose: renders the focused log node with full timestamp display.
//   Highlighted visually as the center of the thread view.
// Constraints: Server Component (no "use client"). Pure display.

import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

type Props = {
    log: TLog;
};

export function LogFocusCard({ log }: Props) {
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
                'border border-primary/30 p-4',
                log.isDeleted && 'opacity-60'
            )}
        >
            {!log.isDeleted && log.authorName ? (
                <p className="mb-1 text-sm font-semibold">@{log.authorName}</p>
            ) : null}
            <p
                className={cn(
                    'whitespace-pre-wrap break-words text-sm',
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
        </article>
    );
}
