'use client';

// components/log/FollowButton.client.tsx
// Purpose: follow/unfollow toggle on the /log/[username] stream header.
//   Shown ONLY to signed-in viewers who are NOT the profile owner.
//   Self view → no button (caller gates with isOwner).
//   Signed-out → not rendered (caller gates with isSignedIn or hides section).
//   Feature-dormant safe: 503 from backend is caught → rolls back + subtle toast-
//   free inline error (non-blocking); no throw propagation.
// Constraints: "use client". Never mutate unless isSignedIn.

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useFollow, followStateQueryKey } from '@/hooks/useFollow.query.client';

type Props = {
    targetUsername: string;
    /** Initial following state (from server or parent query). */
    initialFollowing: boolean;
    /** Initial follower count. */
    initialFollowerCount: number;
};

export function FollowButton({
    targetUsername,
    initialFollowing,
    initialFollowerCount,
}: Props) {
    const { isLoaded, isSignedIn } = useAuth();
    const queryClient = useQueryClient();

    // Seed the query cache with the initial server values once on mount.
    useEffect(() => {
        const key = followStateQueryKey(targetUsername);
        const existing = queryClient.getQueryData(key);
        if (!existing) {
            queryClient.setQueryData(key, {
                following: initialFollowing,
                followerCount: initialFollowerCount,
                followeeCount: 0,
            });
        }
    }, [targetUsername, initialFollowing, initialFollowerCount, queryClient]);

    const { mutate, isPending } = useFollow(targetUsername);
    const [mutationError, setMutationError] = useState<string | null>(null);

    // Read optimistic state from cache (updated by useFollow onMutate).
    const cached = queryClient.getQueryData<{
        following: boolean;
        followerCount: number;
    }>(followStateQueryKey(targetUsername));

    const following = cached?.following ?? initialFollowing;
    const followerCount = cached?.followerCount ?? initialFollowerCount;

    if (!isLoaded || !isSignedIn) return null;

    function handleClick() {
        if (isPending) return;
        setMutationError(null);
        mutate(undefined, {
            onError: () => {
                setMutationError('팔로우 변경에 실패했습니다.');
            },
        });
    }

    return (
        <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2">
                <span className="text-xs text-primary/50">
                    팔로워 {followerCount}
                </span>
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={isPending}
                    aria-pressed={following}
                    aria-label={
                        following
                            ? `${targetUsername} 언팔로우`
                            : `${targetUsername} 팔로우`
                    }
                    className={cn(
                        'rounded border px-3 py-1 text-xs font-medium transition-colors',
                        following
                            ? 'border-primary/40 bg-primary/10 text-primary/70 hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive'
                            : 'border-primary/40 text-primary/70 hover:bg-primary/10',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                >
                    {isPending ? '…' : following ? '팔로잉' : '팔로우'}
                </button>
            </div>
            {mutationError ? (
                <p
                    role="alert"
                    className="text-[10px] text-destructive/70"
                >
                    {mutationError}
                </p>
            ) : null}
        </div>
    );
}
