// components/write/PostSettings.client.tsx
// Purpose: post metadata fields for the editor — slug, thumbnail picker, and
// (via slots) the category cascader + tag editor — grouped in a collapsible
// "Post settings" area (Layout A) to save vertical space. Slots extra controls
// (e.g. a post-publish "view live" link) via children.
// Constraints: client-only, presentational. Holds no business state; slug +
// thumbnail are controlled props, category/tags are rendered slots, all lifted
// to MarkdownEditor. The collapsible's open/closed is transient Radix UI state.

'use client';

import { type ChangeEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
    categorySlot?: ReactNode;
    tagsSlot?: ReactNode;
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
    categorySlot,
    tagsSlot,
    children,
}: PostSettingsProps) {
    const t = useTranslations('write');

    return (
        <Collapsible
            defaultOpen
            className="mb-3 font-mono"
        >
            <CollapsibleTrigger className="group flex w-full items-center justify-between border-2 border-primary/50 p-2 text-[0.65rem] uppercase tracking-wider text-muted-foreground outline-none hover:border-primary">
                {t('settings.sectionTitle')}
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-2 border-t-0 border-primary/50 p-3">
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
                {categorySlot && (
                    <div className="mt-3">
                        <span className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                            {t('category.label')}
                        </span>
                        <div className="mt-1">{categorySlot}</div>
                    </div>
                )}
                {tagsSlot && <div className="mt-3">{tagsSlot}</div>}
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}
