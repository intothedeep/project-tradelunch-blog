// components/write/AutosaveIndicator.client.tsx
// Purpose: compact, presentational autosave-status affordance for the editor.
// Mirrors the status returned by useDraftAutosave into a single inline badge.
// Constraints: client-only, stateless. a11y: non-error states announce via a
// polite role="status" region; the error state escalates to an assertive
// role="alert". No persistence or timers here beyond deriving a relative label.

'use client';

import { cn } from '@/lib/utils';
import type { TAutosaveStatus } from '@/hooks/useDraftAutosave.hook';

type AutosaveIndicatorProps = {
    status: TAutosaveStatus;
    lastSavedAt: number | null;
    onRetry: () => void;
};

// Minimal relative-time label; no deps. Bucketed to the precision the UI needs.
const formatRelative = (timestamp: number | null): string => {
    if (timestamp == null) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
};

const BADGE_CLASS =
    'inline-flex items-center gap-2 border-2 px-2 py-1 text-xs font-mono';

export function AutosaveIndicator({
    status,
    lastSavedAt,
    onRetry,
}: AutosaveIndicatorProps) {
    if (status === 'idle') return null;

    if (status === 'error') {
        return (
            <div
                role="alert"
                aria-live="assertive"
                className={cn(
                    BADGE_CLASS,
                    'border-destructive text-destructive'
                )}
            >
                FAILED TO SAVE
                <button
                    type="button"
                    onClick={onRetry}
                    className={cn(
                        'border-2 border-destructive px-2 py-0.5 transition-colors',
                        'hover:bg-destructive hover:text-white'
                    )}
                >
                    RETRY
                </button>
            </div>
        );
    }

    const label =
        status === 'saving'
            ? 'SAVING…'
            : status === 'saved'
              ? `SAVED · ${formatRelative(lastSavedAt)}`
              : 'UNSAVED CHANGES';

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                BADGE_CLASS,
                'border-primary/40 text-muted-foreground'
            )}
        >
            {label}
        </div>
    );
}
