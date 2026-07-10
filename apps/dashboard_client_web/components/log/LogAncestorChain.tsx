// components/log/LogAncestorChain.tsx
// Purpose: renders the flat ancestor chain root→parent above the focus node.
//   Deleted ancestors are masked to "[deleted]" but are PRESENT (chain intact).
//   No indentation — flat display per spec.
// Constraints: Server Component (no "use client"). Pure display.

import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

type Props = {
    ancestors: TLog[];
};

export function LogAncestorChain({ ancestors }: Props) {
    if (ancestors.length === 0) return null;

    return (
        <ol
            aria-label="Ancestor chain"
            className="mb-2 space-y-1 border-l border-primary/20 pl-3"
        >
            {ancestors.map((ancestor) => (
                <li key={ancestor.id}>
                    <div className="flex items-start gap-2">
                        {!ancestor.isDeleted && ancestor.authorName ? (
                            <span className="shrink-0 text-xs font-semibold text-primary/70">
                                @{ancestor.authorName}
                            </span>
                        ) : null}
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
            ))}
        </ol>
    );
}
