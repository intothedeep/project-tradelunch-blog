// components/write/PostSettings.client.tsx
// Purpose: collapsible "post settings" panel for the editor. Holds an editable
// slug field (empty = auto-generated from title on save) and slots extra
// controls (e.g. a post-publish "view live" link) via children.
// Constraints: client-only, presentational. Owns only its open/closed flag; the
// slug value is a controlled prop lifted to MarkdownEditor.

'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface PostSettingsProps {
    slug: string;
    onSlugChange: (slug: string) => void;
    children?: ReactNode;
}

export function PostSettings({
    slug,
    onSlugChange,
    children,
}: PostSettingsProps) {
    const t = useTranslations('write');
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="mb-3 border-2 border-primary/50 font-mono">
            <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((v) => !v)}
                className="flex w-full items-center justify-between bg-transparent p-2 text-xs uppercase tracking-wider text-foreground transition-colors hover:text-primary"
            >
                <span>{t('settings.title')}</span>
                <span aria-hidden>{isOpen ? '▾' : '▸'}</span>
            </button>
            <div
                className={cn(
                    'border-t-2 border-primary/50 p-3',
                    !isOpen && 'hidden'
                )}
            >
                <label className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    {t('settings.slugLabel')}
                </label>
                <input
                    aria-label={t('a11y.slug')}
                    value={slug}
                    onChange={(e) => onSlugChange(e.target.value)}
                    placeholder={t('settings.slugPlaceholder')}
                    className="mt-1 w-full border-2 border-primary/50 bg-transparent p-2 text-sm outline-none focus:border-primary"
                />
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                    {t('settings.slugHint')}
                </p>
                {children}
            </div>
        </div>
    );
}
