// components/write/ThumbnailPicker.client.tsx
// Purpose: presentational thumbnail control for the post-settings panel — pick
// an image (via a hidden file input wired to the editor's existing image
// upload), preview the chosen thumbnail, and clear it.
// Constraints: client-only, stateless. The thumbnail URL and every callback
// arrive via props; no upload orchestration or persistence happens here (the
// parent reuses useImageUpload to turn the picked file into a public URL).

'use client';

import { useRef, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface ThumbnailPickerProps {
    thumbnailUrl: string | null;
    onPick: (e: ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    isUploading: boolean;
    isStorageDisabled: boolean;
    error: string | null;
}

export function ThumbnailPicker({
    thumbnailUrl,
    onPick,
    onClear,
    isUploading,
    isStorageDisabled,
    error,
}: ThumbnailPickerProps) {
    const t = useTranslations('write');
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="mt-3">
            <label className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {t('settings.thumbnailLabel')}
            </label>

            {/* Author thumbnails are arbitrary remote URLs; next/image remote
                config is out of scope for this in-editor preview. */}
            {thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={thumbnailUrl}
                    alt={t('a11y.thumbnailPreview')}
                    className="mt-2 h-32 w-full border-2 border-primary/50 object-cover"
                />
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={isUploading || isStorageDisabled}
                    className={cn(
                        'border-2 border-primary px-3 py-1 transition-colors',
                        'hover:bg-primary hover:text-primary-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                >
                    {isUploading
                        ? t('settings.thumbnailUploading')
                        : thumbnailUrl
                          ? t('settings.thumbnailReplace')
                          : t('settings.thumbnailPick')}
                </button>
                {thumbnailUrl && !isUploading && (
                    <button
                        type="button"
                        onClick={onClear}
                        className={cn(
                            'border-2 border-destructive px-3 py-1 text-destructive transition-colors',
                            'hover:bg-destructive hover:text-white'
                        )}
                    >
                        {t('settings.thumbnailClear')}
                    </button>
                )}
                {isStorageDisabled && (
                    <span className="text-muted-foreground">
                        {t('toolbar.storageDisabled')}
                    </span>
                )}
                {error && !isStorageDisabled && (
                    <span
                        role="alert"
                        className="text-destructive"
                    >
                        {error}
                    </span>
                )}
            </div>

            <p className="mt-1 text-[0.65rem] text-muted-foreground">
                {t('settings.thumbnailHint')}
            </p>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onPick}
            />
        </div>
    );
}
