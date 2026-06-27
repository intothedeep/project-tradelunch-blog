'use client';

// Purpose: per-post Like control — Phase E LIVE persistence. A like is a PUBLIC
//   approval signal: the button shows the aggregate likeCount + the viewer's
//   own liked state.
// Invariants: sits above any overlay nav link (relative z-10) so clicking it
//   toggles the like and NEVER navigates. Signed-in click → OPTIMISTIC flip
//   reconciled to the server result, rolled back on error; signed-out click →
//   /sign-in?redirect_url=<current path>.
// Constraints: post id is a STRING (Snowflake) — never Number()/parseInt. Heart
//   is filled when liked, outline otherwise.
//   The viewer's LIKED state is read from the shared ['viewer-likes'] query
//   (useViewerLikes), NOT from the server-rendered initialLiked: the SSR post
//   read is cacheable/anonymous so its viewerLiked is always false — relying on
//   it made a like vanish on refresh. initialLiked is only the pre-hydration
//   fallback (signed-out / query not yet loaded). The COUNT is a public
//   aggregate, so it stays local state seeded from initialLikeCount.
// Side effects: delegated to useToggleLike (network + cache) / router navigation.

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useToggleLike } from '@/hooks/useToggleLike.query.client';
import { useViewerLikes } from '@/hooks/useViewerLikes.query.client';

type Props = {
    postId: string;
    initialLiked: boolean;
    initialLikeCount: number;
};

export const LikeButton: React.FC<Props> = ({
    postId,
    initialLiked,
    initialLikeCount,
}) => {
    const { isLoaded, isSignedIn } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const toggle = useToggleLike();
    const { data: likedSet } = useViewerLikes();

    // Liked state is authoritative from the shared viewer-likes cache (which the
    // toggle mutation flips optimistically); fall back to the SSR seed only
    // until that query resolves.
    const liked = likedSet?.has(postId) ?? initialLiked;
    const [likeCount, setLikeCount] = useState(initialLikeCount);

    const handleClick = () => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push(
                `/sign-in?redirect_url=${encodeURIComponent(pathname)}`
            );
            return;
        }
        if (toggle.isPending) return;

        // Optimistic COUNT flip; the liked set is flipped by the hook. Reconcile
        // the count to the server's authoritative value, roll back on error.
        const prevCount = likeCount;
        setLikeCount(prevCount + (liked ? -1 : 1));

        toggle.mutate(
            { postId },
            {
                onSuccess: (data) => {
                    setLikeCount(data.likeCount);
                },
                onError: () => {
                    setLikeCount(prevCount);
                },
            }
        );
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike post' : 'Like post'}
            className={cn(
                'relative z-10',
                'flex items-center justify-center gap-2',
                'py-2 px-3',
                'transition-colors border border-primary/30',
                'text-xs font-semibold',
                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
            )}
        >
            <Heart
                size={16}
                fill={liked ? 'currentColor' : 'none'}
            />
            <span aria-live="polite">{liked ? 'LIKED' : 'LIKE'}</span>
            <span>{likeCount}</span>
        </button>
    );
};
