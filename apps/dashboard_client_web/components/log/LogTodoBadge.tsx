// components/log/LogTodoBadge.tsx
// Purpose: renders a small status chip for a log entry's todo state.
//   Renders NOTHING when todoStatus is absent (field not set = not a todo, or
//   viewer is not the owner).
// Constraints: pure display. Tailwind + cn only. No "use client". No side effects.

import { cn } from '@/lib/utils';
import type { TLogTodoStatus } from '@repo/types';

type Props = {
    todoStatus?: TLogTodoStatus;
};

const LABEL: Record<TLogTodoStatus, string> = {
    todo: 'Todo',
    done: 'Done',
    overdue: 'Overdue',
};

const STYLE: Record<TLogTodoStatus, string> = {
    todo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export function LogTodoBadge({ todoStatus }: Props) {
    if (!todoStatus) return null;

    return (
        <span
            className={cn(
                'inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                STYLE[todoStatus]
            )}
            aria-label={`Todo status: ${LABEL[todoStatus]}`}
        >
            {LABEL[todoStatus]}
        </span>
    );
}
