'use client';

// Purpose: per-card Save (favorite) control — Phase 2 LIVE persistence.
// Invariants: sits above the overlay nav link (relative z-10) so clicking it
//   toggles the favorite and NEVER navigates. Signed-in click → optimistic
//   toggle; signed-out click → /sign-in?redirect_url=<current blog path>.
// Constraints: post id is a STRING (Snowflake) — never Number()/parseInt. Star
//   is filled when favorited, outline otherwise.
// Side effects: delegated to useToggleFavorite (network) / router navigation.

import { Star } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useFavorites } from '@/hooks/useFavorites.query.client';
import { useToggleFavorite } from '@/hooks/useToggleFavorite.query.client';

type Props = {
    postId: string;
};

export const SaveButton: React.FC<Props> = ({ postId }) => {
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { data: favorites } = useFavorites();
    const toggle = useToggleFavorite();

    const isFavorited = favorites?.has(postId) ?? false;

    const handleClick = () => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push(
                `/sign-in?redirect_url=${encodeURIComponent(pathname)}`
            );
            return;
        }
        toggle.mutate({ postId, isFavorited });
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={isFavorited}
            aria-label={isFavorited ? 'Unsave post' : 'Save post'}
            className={cn(
                'relative z-10',
                'flex items-center justify-center gap-2',
                'py-2 px-3',
                'transition-colors border border-primary/30',
                'text-xs font-semibold',
                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
            )}
        >
            <Star
                size={16}
                fill={isFavorited ? 'currentColor' : 'none'}
            />
            <span aria-live="polite">{isFavorited ? 'SAVED' : 'SAVE'}</span>
        </button>
    );
};
