// components/write/AutosaveIndicator.client.tsx
// Purpose: compact, presentational autosave-status affordance for the editor.
// Mirrors the status returned by useDraftAutosave into a single inline badge.
// Constraints: client-only, stateless. a11y: non-error states announce via a
// polite role="status" region; the error state escalates to an assertive
// role="alert". No persistence or timers here beyond deriving a relative label.

'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { TAutosaveStatus } from '@/hooks/useDraftAutosave.hook';

type AutosaveIndicatorProps = {
    status: TAutosaveStatus;
    lastSavedAt: number | null;
    onRetry: () => void;
};

// Bucketed relative-time descriptor. Kept impure (Date.now) but at module scope
// so the i18n mapping in the component stays a pure render. Translation happens
// in the component via literal-key `t` calls.
type TRelativeBucket =
    | { kind: 'none' }
    | { kind: 'justNow' }
    | { kind: 'seconds'; seconds: number }
    | { kind: 'minutes'; minutes: number }
    | { kind: 'hours'; hours: number };

const toRelativeBucket = (timestamp: number | null): TRelativeBucket => {
    if (timestamp == null) return { kind: 'none' };
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 5) return { kind: 'justNow' };
    if (seconds < 60) return { kind: 'seconds', seconds };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { kind: 'minutes', minutes };
    const hours = Math.floor(minutes / 60);
    return { kind: 'hours', hours };
};

const BADGE_CLASS =
    'inline-flex items-center gap-2 border-2 px-2 py-1 text-xs font-mono';

export function AutosaveIndicator({
    status,
    lastSavedAt,
    onRetry,
}: AutosaveIndicatorProps) {
    const t = useTranslations('write');

    const relativeLabel = (bucket: TRelativeBucket): string => {
        switch (bucket.kind) {
            case 'none':
                return '';
            case 'justNow':
                return t('autosave.justNow');
            case 'seconds':
                return t('autosave.secondsAgo', { seconds: bucket.seconds });
            case 'minutes':
                return t('autosave.minutesAgo', { minutes: bucket.minutes });
            case 'hours':
                return t('autosave.hoursAgo', { hours: bucket.hours });
        }
    };

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
                {t('autosave.failed')}
                <button
                    type="button"
                    onClick={onRetry}
                    className={cn(
                        'border-2 border-destructive px-2 py-0.5 transition-colors',
                        'hover:bg-destructive hover:text-white'
                    )}
                >
                    {t('autosave.retry')}
                </button>
            </div>
        );
    }

    const label =
        status === 'saving'
            ? t('autosave.saving')
            : status === 'saved'
              ? t('autosave.saved', {
                    time: relativeLabel(toRelativeBucket(lastSavedAt)),
                })
              : t('autosave.unsaved');

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
