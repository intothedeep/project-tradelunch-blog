// components/log/LogAncestorChain.tsx
// Purpose: renders the flat ancestor chain root→parent above the focus node,
//   Threads-style — a small avatar + author per row, a connecting thread line
//   down the gutter, and an "Author" chip on the thread's original poster (the
//   root = ancestors[0]). Deleted ancestors are masked to "[deleted]" but PRESENT.
// Constraints: Server Component (no "use client"). Pure display.

import { LogAvatar } from '@/components/log/LogAvatar';
import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

type Props = {
    ancestors: TLog[];
};

export function LogAncestorChain({ ancestors }: Props) {
    if (ancestors.length === 0) return null;

    // The root of the whole thread (original poster) is the first ancestor.
    const rootAuthor = ancestors[0]?.authorUsername;

    return (
        <ol
            aria-label="Ancestor chain"
            className="mb-2 border-l-2 border-primary/15 pl-2"
        >
            {ancestors.map((ancestor) => {
                const isAuthor =
                    !!ancestor.authorUsername &&
                    ancestor.authorUsername === rootAuthor;
                return (
                    <li
                        key={ancestor.id}
                        className="flex items-start gap-2 py-1"
                    >
                        <LogAvatar
                            name={ancestor.authorName}
                            avatarUrl={ancestor.authorAvatarUrl}
                            deleted={ancestor.isDeleted}
                            size={22}
                        />
                        <div className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 text-xs">
                                {!ancestor.isDeleted && ancestor.authorName ? (
                                    <span className="font-semibold text-primary/70">
                                        @{ancestor.authorName}
                                    </span>
                                ) : (
                                    <span className="text-primary/40">
                                        [deleted]
                                    </span>
                                )}
                                {isAuthor && !ancestor.isDeleted ? (
                                    <span className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary/60">
                                        Author
                                    </span>
                                ) : null}
                            </span>
                            <p
                                className={cn(
                                    'text-xs text-primary/60',
                                    ancestor.isDeleted && 'italic opacity-50'
                                )}
                            >
                                {ancestor.body}
                            </p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
