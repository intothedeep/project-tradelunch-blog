// components/write/PostSettings.client.tsx
// Purpose: collapsible "post settings" panel for the editor. Holds an editable
// slug field (empty = auto-generated from title on save), a thumbnail picker,
// and slots extra controls (e.g. a post-publish "view live" link) via children.
// Constraints: client-only, presentational. Owns only its open/closed flag; the
// slug + thumbnail values are controlled props lifted to MarkdownEditor.

'use client';

import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { ThumbnailPicker } from '@/components/write/ThumbnailPicker.client';

interface PostSettingsProps {
    slug: string;
    onSlugChange: (slug: string) => void;
    thumbnailUrl: string | null;
    onPickThumbnail: (e: ChangeEvent<HTMLInputElement>) => void;
    onClearThumbnail: () => void;
    isThumbnailUploading: boolean;
    isStorageDisabled: boolean;
    thumbnailError: string | null;
    children?: ReactNode;
}

export function PostSettings({
    slug,
    onSlugChange,
    thumbnailUrl,
    onPickThumbnail,
    onClearThumbnail,
    isThumbnailUploading,
    isStorageDisabled,
    thumbnailError,
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
                <ThumbnailPicker
                    thumbnailUrl={thumbnailUrl}
                    onPick={onPickThumbnail}
                    onClear={onClearThumbnail}
                    isUploading={isThumbnailUploading}
                    isStorageDisabled={isStorageDisabled}
                    error={thumbnailError}
                />
                {children}
            </div>
        </div>
    );
}
