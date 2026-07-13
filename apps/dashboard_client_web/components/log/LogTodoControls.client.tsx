'use client';

// components/log/LogTodoControls.client.tsx
// Purpose: owner-only per-card todo controls:
//   1. Done toggle — one-tap optimistic mark-done / reopen.
//   2. Due-date picker — native <input type="date"> to set / change / clear the
//      due date; clears the todo entirely when the input is cleared.
// Renders NOTHING for non-owners (caller must gate on isOwner).
// Constraints: "use client". Calls useUpdateLogTodo. id stays STRING.

import { useState } from 'react';
import { useUpdateLogTodo } from '@/hooks/useUpdateLogTodo.query.client';
import { cn } from '@/lib/utils';
import type { TLog } from '@repo/types';

type Props = {
    log: TLog;
    username: string; // profile owner's username (for query key)
};

// Convert an ISO string or null/undefined → HTML date value (YYYY-MM-DD).
function toDateValue(isoOrNull?: string | null): string {
    if (!isoOrNull) return '';
    return isoOrNull.slice(0, 10);
}

export function LogTodoControls({ log, username }: Props) {
    const updateTodo = useUpdateLogTodo(username);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const isDone = log.todoStatus === 'done';
    const hasTodo = log.dueAt != null;

    function handleDoneToggle() {
        updateTodo.mutate({
            logId: log.id,
            update: { done: !isDone },
        });
    }

    function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
        const val = e.target.value; // '' = clear; 'YYYY-MM-DD' = set
        updateTodo.mutate({
            logId: log.id,
            update: { dueAt: val === '' ? null : `${val}T23:59:59.000Z` },
        });
        setShowDatePicker(false);
    }

    const isPending = updateTodo.isPending;

    return (
        <div className="mt-1 flex flex-wrap items-center gap-2">
            {hasTodo && (
                <button
                    type="button"
                    onClick={handleDoneToggle}
                    disabled={isPending}
                    className={cn(
                        'rounded border px-2 py-0.5 text-[10px] font-medium transition-colors',
                        isDone
                            ? 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300'
                            : 'border-primary/30 text-primary/60 hover:bg-primary/5',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                    aria-label={isDone ? 'Reopen todo' : 'Mark as done'}
                >
                    {isDone ? '↩ Reopen' : '✓ Done'}
                </button>
            )}

            <button
                type="button"
                onClick={() => setShowDatePicker((v) => !v)}
                disabled={isPending}
                className={cn(
                    'rounded border border-primary/20 px-2 py-0.5 text-[10px] text-primary/50',
                    'hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50'
                )}
                aria-label={
                    hasTodo ? 'Change due date' : 'Set as todo with due date'
                }
            >
                {hasTodo ? `Due: ${toDateValue(log.dueAt)}` : '＋ Set due date'}
            </button>

            {showDatePicker && (
                <input
                    type="date"
                    defaultValue={toDateValue(log.dueAt)}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={handleDateChange}
                    className={cn(
                        'rounded border border-primary/30 bg-background px-1 py-0.5',
                        'text-xs text-primary outline-none focus:border-primary'
                    )}
                    aria-label="Due date"
                />
            )}
        </div>
    );
}
