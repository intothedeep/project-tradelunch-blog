'use client';

// components/log/LogLikeButton.client.tsx
// Purpose: heart + count like button for a single Log entry.
//   Feature-dormant safe: renders NOTHING when likeCount is undefined
//   (migration 0024 not yet applied → server omits the field → no crash).
//   Signed-out tap → /sign-in?redirect_url=current path (no state change).
//   Signed-in tap → optimistic toggle via useLogLike.
// Constraints: "use client". logId stays STRING. Count shown only when ≥1.

import { Heart } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLogLike } from '@/hooks/useLogLike.query.client';

type Props = {
    logId: string;
    likeCount: number;
    viewerLiked: boolean;
    /** Profile username for per-user stream cache invalidation (optional). */
    username?: string;
    /** Thread root logId for thread cache invalidation (optional). */
    threadId?: string;
};

export function LogLikeButton({
    logId,
    likeCount,
    viewerLiked,
    username,
    threadId,
}: Props) {
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { mutate, isPending } = useLogLike({ username, threadId });

    function handleClick(e: React.MouseEvent) {
        // Prevent event from bubbling to a clickable card/list-item wrapper.
        e.stopPropagation();

        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push(
                `/sign-in?redirect_url=${encodeURIComponent(pathname)}`
            );
            return;
        }
        if (isPending) return;

        mutate({ logId, username, threadId });
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={viewerLiked}
            aria-label={viewerLiked ? 'Unlike log entry' : 'Like log entry'}
            className={cn(
                'flex items-center gap-1 text-xs transition-colors',
                viewerLiked
                    ? 'text-rose-500'
                    : 'text-primary/40 hover:text-rose-400',
                'disabled:cursor-not-allowed disabled:opacity-50'
            )}
            disabled={isPending}
        >
            <Heart
                size={13}
                fill={viewerLiked ? 'currentColor' : 'none'}
                strokeWidth={2}
            />
            {likeCount >= 1 ? (
                <span aria-live="polite">{likeCount}</span>
            ) : null}
        </button>
    );
}
