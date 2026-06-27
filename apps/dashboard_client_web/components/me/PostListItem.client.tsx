// components/me/PostListItem.client.tsx
// Purpose: one draft row — title + relative updated time, linking to its editor.
// Constraints: client-only (renders a relative time computed from the client
// clock). Pure presentational; receives an already-shaped draft summary.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { TDraftSummary } from '@repo/types';

// Minimal relative-time formatter (no external deps). Past timestamps only.
function formatRelativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
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
            <span className="truncate text-sm">
                {draft.title.trim() || t('drafts.untitled')}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(draft.updatedAt)}
            </span>
        </Link>
    );
}
