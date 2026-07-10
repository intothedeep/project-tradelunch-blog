'use client';

// components/log/LogStream.client.tsx
// Purpose: infinite-scroll list of top-level log entries for a user's /log page.
//   Seeded from server-fetched first page; subsequent pages via "Load more".
//   Clicking an entry navigates to its focus view (/log/[username]/[logId]).
//   Delete affordance shown for entry author OR profile owner OR admin.
// Constraints: "use client". ids stay STRINGS.

import { useRouter } from 'next/navigation';
import { useMe } from '@/hooks/useMe.query.client';
import { useLogStream } from '@/hooks/useLogStream.query.client';
import { useDeleteLog } from '@/hooks/useDeleteLog.query.client';
import { LogCard } from '@/components/log/LogCard';
import { cn } from '@/lib/utils';
import type { TLog, TLogStreamResponse } from '@repo/types';

type Props = {
    username: string;
    initialData?: TLogStreamResponse;
};

export function LogStream({ username, initialData }: Props) {
    const router = useRouter();
    const { data: me } = useMe();

    const { items, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useLogStream(username, initialData);

    const deleteLog = useDeleteLog(username);

    function canDelete(log: TLog): boolean {
        if (!me) return false;
        if (me.isAdmin) return true;
        if (me.username === username) return true; // profile owner
        return log.authorName !== undefined && me.username === log.authorName;
    }

    if (isError) {
        return (
            <p
                role="alert"
                className="text-sm text-destructive"
            >
                Failed to load log entries.
            </p>
        );
    }

    if (items.length === 0) {
        return <p className="text-sm text-primary/50">No log entries yet.</p>;
    }

    return (
        <section aria-label="Log stream">
            <ul role="list">
                {items.map((log) => (
                    <li
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() =>
                            router.push(
                                `/log/${encodeURIComponent(username)}/${log.id}`
                            )
                        }
                    >
                        <LogCard
                            log={log}
                            canDelete={canDelete(log)}
                            onDelete={() => deleteLog.mutate({ logId: log.id })}
                        />
                    </li>
                ))}
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
