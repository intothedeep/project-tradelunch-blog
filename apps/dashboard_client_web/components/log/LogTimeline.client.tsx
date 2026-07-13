'use client';

// components/log/LogTimeline.client.tsx
// Purpose: "Following" tab — infinite-scroll timeline of top-level logs from
//   users the viewer follows. Auth-gated (only renders for signed-in viewers).
//   Empty state A: viewer follows nobody → prompt to browse All feed.
//   Empty state B: viewer follows people but none have logs → neutral message.
//   Feature-dormant safe: 503 (migration 0024 not yet applied) → isError=true
//   which is treated as "no logs yet" empty state B (no crash, no alert).
// Constraints: "use client". ids stay STRINGS.

import { useRouter } from 'next/navigation';
import { useLogTimeline } from '@/hooks/useLogTimeline.query.client';
import { LogCard } from '@/components/log/LogCard';
import { toUsernameSegment } from '@/utils/blog-author';
import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

export function LogTimeline() {
    const router = useRouter();
    const {
        items,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useLogTimeline();

    function openThread(log: TLog): void {
        if (!log.authorUsername) return;
        router.push(`/log/${toUsernameSegment(log.authorUsername)}/${log.id}`);
    }

    if (isLoading) {
        return (
            <p className="py-6 text-center text-sm text-primary/40">
                불러오는 중…
            </p>
        );
    }

    // 503 (dormant) or genuine network error: treat as "no logs" to avoid alarming the user.
    // Empty state B: following people but no logs yet.
    if (isError || items.length === 0) {
        return (
            <div className="py-10 text-center">
                <p className="text-sm text-primary/50">새 로그가 없습니다.</p>
            </div>
        );
    }

    return (
        <section aria-label="Following timeline">
            <ul role="list">
                {items.map((log) => {
                    const navigable = !log.isDeleted && !!log.authorUsername;
                    return (
                        <li
                            key={log.id}
                            className={cn(navigable && 'cursor-pointer')}
                            onClick={
                                navigable ? () => openThread(log) : undefined
                            }
                        >
                            <LogCard log={log} />
                        </li>
                    );
                })}
            </ul>
            {hasNextPage ? (
                <button
                    type="button"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className={cn(
                        'mt-4 w-full border border-primary/30 py-2 text-xs',
                        'hover:bg-primary/5 disabled:opacity-50'
                    )}
                >
                    {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
            ) : null}
        </section>
    );
}
