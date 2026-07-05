// components/me/PostListItem.client.tsx
// Purpose: one draft/private row — title + relative updated time, linking to its editor.
// Constraints: client-only (renders a relative time computed from the client
// clock). Pure presentational; receives an already-shaped draft summary.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/blog/StatusBadge';
import type { TDraftSummary } from '@repo/types';

// Localised relative-time formatter (no external deps). Past timestamps only.
// Reuses the autosave.* relative-time keys so the wording stays consistent
// across the editor and the drafts list. `t` is bound to the 'write' namespace.
type WriteTranslator = ReturnType<typeof useTranslations<'write'>>;

function formatRelativeTime(iso: string, t: WriteTranslator): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return t('autosave.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('autosave.minutesAgo', { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('autosave.hoursAgo', { hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('autosave.daysAgo', { days });
    const months = Math.floor(days / 30);
    if (months < 12) return t('autosave.monthsAgo', { months });
    return t('autosave.yearsAgo', { years: Math.floor(months / 12) });
}

export function PostListItem({ draft }: { draft: TDraftSummary }) {
    const t = useTranslations('write');
    return (
        <Link
            href={`/write/${draft.id}`}
            className={cn(
                'flex items-center justify-between gap-4 border-2 border-primary/30 px-3 py-2 transition-colors',
                'hover:border-primary hover:bg-primary hover:text-primary-foreground'
            )}
        >
            <span className="flex items-center gap-2 truncate text-sm">
                <StatusBadge status={draft.status} />
                {draft.title.trim() || t('drafts.untitled')}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(draft.updatedAt, t)}
            </span>
        </Link>
    );
}
