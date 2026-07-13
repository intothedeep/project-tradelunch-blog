'use client';

// components/log/LogTodoTabs.client.tsx
// Purpose: owner-only filter tabs (All | Todo | Done | Overdue) with count badges
//   and per-tab infinite-scroll list via useLogTodos.
//   Renders NOTHING when the viewer is not the stream owner.
// Constraints: "use client". id/cursor stay STRINGS. Uses LogCard for display.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLogTodos } from '@/hooks/useLogTodos.query.client';
import { useDeleteLog } from '@/hooks/useDeleteLog.query.client';
import { LogCard } from '@/components/log/LogCard';
import { toUsernameSegment } from '@/utils/blog-author';
import { cn } from '@/lib/utils';
import type { TLogTodoStatus } from '@/apis/get-log-todos.api';

type Props = {
    username: string;
};

type TTab = { status: TLogTodoStatus; label: string };

const TABS: TTab[] = [
    { status: 'all', label: 'All' },
    { status: 'todo', label: 'Todo' },
    { status: 'overdue', label: 'Overdue' },
    { status: 'done', label: 'Done' },
];

const EMPTY_MSG: Record<TLogTodoStatus, string> = {
    all: 'No todos yet. Set a due date on a log entry to track it here.',
    todo: 'No open todos.',
    overdue: 'No overdue items.',
    done: 'Nothing done yet.',
};

function CountBadge({ n }: { n: number }) {
    if (n === 0) return null;
    return (
        <span className="ml-1 inline-block rounded-full bg-primary/15 px-1.5 text-[10px] leading-4 text-primary/70">
            {n}
        </span>
    );
}

export function LogTodoTabs({ username }: Props) {
    const [activeStatus, setActiveStatus] = useState<TLogTodoStatus>('all');
    const router = useRouter();

    const {
        items,
        counts,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useLogTodos(username, activeStatus);

    const deleteLog = useDeleteLog(username);

    function countFor(status: TLogTodoStatus): number {
        if (status === 'all') return counts.todo + counts.overdue + counts.done;
        if (status === 'todo') return counts.todo;
        if (status === 'overdue') return counts.overdue;
        if (status === 'done') return counts.done;
        return 0;
    }

    return (
        <section
            aria-label="Todo log entries"
            className="mt-6"
        >
            <div className="mb-3 border-b border-primary/10">
                <div
                    role="tablist"
                    aria-label="Filter todos"
                    className="flex gap-0"
                >
                    {TABS.map(({ status, label }) => (
                        <button
                            key={status}
                            role="tab"
                            aria-selected={activeStatus === status}
                            type="button"
                            onClick={() => setActiveStatus(status)}
                            className={cn(
                                'px-3 py-2 text-xs font-medium transition-colors',
                                'border-b-2 -mb-px',
                                activeStatus === status
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-primary/50 hover:text-primary/80'
                            )}
                        >
                            {label}
                            <CountBadge n={countFor(status)} />
                        </button>
                    ))}
                </div>
            </div>

            {isError && (
                <p
                    role="alert"
                    className="text-sm text-destructive"
                >
                    Failed to load todos.
                </p>
            )}

            {isLoading && <p className="text-sm text-primary/40">Loading…</p>}

            {!isLoading && !isError && items.length === 0 && (
                <p className="text-sm text-primary/50">
                    {EMPTY_MSG[activeStatus]}
                </p>
            )}

            {items.length > 0 && (
                <ul role="list">
                    {items.map((log) => (
                        <li
                            key={log.id}
                            className="cursor-pointer"
                            onClick={() =>
                                router.push(
                                    `/log/${toUsernameSegment(username)}/${log.id}`
                                )
                            }
                        >
                            <LogCard
                                log={log}
                                canDelete
                                onDelete={() =>
                                    deleteLog.mutate({ logId: log.id })
                                }
                                isOwner
                            />
                        </li>
                    ))}
                </ul>
            )}

            {hasNextPage && (
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
            )}
        </section>
    );
}
