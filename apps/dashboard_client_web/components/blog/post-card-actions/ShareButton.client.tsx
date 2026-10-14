'use client';

// Purpose: per-card Share control (live). Sits above the overlay nav link.
// Invariants: clicking shares/copies only — never navigates.
// Constraints: no username/slug → silent no-share (no @undefined URL).
// Side effects: delegated to useSharePost (Web Share / clipboard).

import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSharePost } from '@/hooks/useSharePost.hook';

type Props = {
    username?: string;
    slug?: string;
    title?: string;
};

export const ShareButton: React.FC<Props> = ({ username, slug, title }) => {
    const { share, isCopied } = useSharePost({ username, slug, title });

    return (
        <button
            type="button"
            onClick={share}
            aria-label="Share post"
            className={cn(
                'relative z-10',
                'flex items-center justify-center gap-2',
                'py-2 px-3',
                'transition-colors border border-primary/30',
                'text-xs font-semibold',
                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
            )}
        >
            <Share2 size={16} />
            <span aria-live="polite">{isCopied ? 'COPIED' : 'SHARE'}</span>
        </button>
    );
};
