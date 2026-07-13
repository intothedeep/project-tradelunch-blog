'use client';

// components/log/LogFeedTabs.client.tsx
// Purpose: All | Following tab switcher on the /log global feed.
//   "Following" tab is visible only to signed-in viewers (useAuth gate).
//   "All" tab always renders LogGlobalStream (unchanged behaviour).
//   "Following" tab renders LogTimeline with two empty states:
//     A — items=[] (no logs → likely following nobody) → Korean prompt + link to All.
//     B — isError (503 dormant / network) → neutral "새 로그가 없습니다" message.
// Constraints: "use client". Small composable component; does NOT disturb LogGlobalStream.

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { LogGlobalStream } from '@/components/log/LogGlobalStream.client';
import { useLogTimeline } from '@/hooks/useLogTimeline.query.client';
import { useRouter } from 'next/navigation';
import { LogCard } from '@/components/log/LogCard';
import { toUsernameSegment } from '@/utils/blog-author';
import type { TLog, TLogStreamResponse } from '@repo/types';

type Tab = 'all' | 'following';

type Props = {
    initialData?: TLogStreamResponse;
};

function FollowingFeed() {
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

    if (isError) {
        // Feature dormant (503) or network error — neutral message.
        return (
            <p className="py-10 text-center text-sm text-primary/50">
                새 로그가 없습니다.
            </p>
        );
    }

    if (items.length === 0) {
        // Empty state A: following nobody (or following but zero logs).
        return (
            <div className="py-10 text-center">
                <p className="mb-2 text-sm text-primary/60">
                    아직 팔로우한 사용자가 없습니다.
                </p>
                <button
                    type="button"
                    onClick={() => router.push('/log')}
                    className="text-xs text-primary/50 underline underline-offset-2 hover:text-primary"
                >
                    전체 피드 보기
                </button>
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

export function LogFeedTabs({ initialData }: Props) {
    const { isLoaded, isSignedIn } = useAuth();
    const [tab, setTab] = useState<Tab>('all');

    const showFollowingTab = isLoaded && isSignedIn === true;

    return (
        <div>
            {showFollowingTab && (
                <div className="mb-4 flex gap-0 border-b border-primary/10">
                    <TabButton
                        active={tab === 'all'}
                        onClick={() => setTab('all')}
                    >
                        전체
                    </TabButton>
                    <TabButton
                        active={tab === 'following'}
                        onClick={() => setTab('following')}
                    >
                        팔로잉
                    </TabButton>
                </div>
            )}

            {tab === 'all' || !showFollowingTab ? (
                <LogGlobalStream initialData={initialData} />
            ) : (
                <FollowingFeed />
            )}
        </div>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                active
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-primary/50 hover:text-primary/80'
            )}
        >
            {children}
        </button>
    );
}
