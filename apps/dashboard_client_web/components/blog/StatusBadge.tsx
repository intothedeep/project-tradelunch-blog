// Purpose: owner-facing visibility badge shown alongside post titles.
// Only non-public statuses render anything — public posts are unmarked.
// This component is safe to use in both Server and Client Components.

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    status?: string;
    className?: string;
};

export function StatusBadge({ status, className }: Props) {
    if (!status || status === 'public') return null;

    if (status === 'private') {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
                    'border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    className
                )}
            >
                <Lock size={10} />
                Private
            </span>
        );
    }

    if (status === 'draft') {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
                    'border-muted-foreground/40 bg-muted text-muted-foreground',
                    className
                )}
            >
                Draft
            </span>
        );
    }

    // follower or any future status — generic pill
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
                'border-primary/40 bg-primary/5 text-primary',
                className
            )}
        >
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
}
