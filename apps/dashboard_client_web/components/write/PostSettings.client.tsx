// components/write/PostSettings.client.tsx
// Purpose: post metadata fields for the editor — an editable slug (empty =
// auto-generated from title on save) and a thumbnail picker — listed inline
// below the title. Slots extra controls (e.g. a post-publish "view live" link)
// via children.
// Constraints: client-only, presentational. Holds no state; slug + thumbnail
// values are controlled props lifted to MarkdownEditor.

'use client';

import { type ChangeEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
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

    return (
        <div className="mb-3 font-mono">
            <label
                htmlFor="post-slug"
                className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground"
            >
                {t('settings.slugLabel')}
            </label>
            <input
                id="post-slug"
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
    );
}
