// components/write/EditorToolbar.client.tsx
// Purpose: presentational chrome for the authoring surface — title, status,
// labeled description, and the save/delete actions. Wraps the editor body
// (metadata fields + textarea + preview grid) passed as children to preserve
// order. Body images are added via paste/drop in the editor itself, so there is
// no image-insert control here.
// Constraints: client-only. Stateless; every value and callback arrives via
// props. No persistence or upload orchestration here.

'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { TPostStatus } from '@repo/types';

const STATUS_OPTIONS: TPostStatus[] = ['draft', 'private', 'public'];

type EditorToolbarProps = {
    title: string;
    onTitleChange: (value: string) => void;
    status: TPostStatus;
    onStatusChange: (value: TPostStatus) => void;
    description: string;
    onDescriptionChange: (value: string) => void;
    onSave: () => void;
    isSaving: boolean;
    canSave: boolean;
    onDelete: () => void;
    isDeleting: boolean;
    // Autofocus the title input on mount. Only enabled for a brand-new post so
    // editing an existing post does not yank focus after the seed lands.
    autoFocusTitle?: boolean;
    children: ReactNode;
};

export function EditorToolbar({
    title,
    onTitleChange,
    status,
    onStatusChange,
    description,
    onDescriptionChange,
    onSave,
    isSaving,
    canSave,
    onDelete,
    isDeleting,
    autoFocusTitle,
    children,
}: EditorToolbarProps) {
    const t = useTranslations('write');
    return (
        <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                    aria-label={t('a11y.title')}
                    autoFocus={autoFocusTitle}
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder={t('editor.titlePlaceholder')}
                    aria-describedby={
                        canSave ? undefined : 'title-required-hint'
                    }
                    className="flex-1 border-2 border-primary/50 bg-transparent px-3 py-2 text-lg outline-none focus:border-primary"
                />
                <select
                    aria-label={t('a11y.status')}
                    value={status}
                    onChange={(e) =>
                        onStatusChange(e.target.value as TPostStatus)
                    }
                    className="border-2 border-primary/50 bg-transparent px-2 py-2 text-sm outline-none focus:border-primary"
                >
                    {STATUS_OPTIONS.map((s) => (
                        <option
                            key={s}
                            value={s}
                        >
                            {t(`status.${s}`)}
                        </option>
                    ))}
                </select>
            </div>

            {!canSave && (
                <p
                    id="title-required-hint"
                    className="mb-3 font-mono text-xs text-muted-foreground"
                >
                    {t('toolbar.titleRequired')}
                </p>
            )}

            <div className="mb-3">
                <label
                    htmlFor="post-description"
                    className="block text-[0.65rem] uppercase tracking-wider text-muted-foreground"
                >
                    {t('editor.descriptionLabel')}
                </label>
                <input
                    id="post-description"
                    aria-label={t('a11y.description')}
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    placeholder={t('editor.descriptionPlaceholder')}
                    className="mt-1 w-full border-2 border-primary/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                />
            </div>

            {children}

            <div className="mt-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || !canSave}
                    className={cn(
                        'border-2 border-primary px-4 py-2 text-sm transition-colors',
                        'hover:bg-primary hover:text-primary-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                >
                    {isSaving ? t('toolbar.saving') : t('toolbar.save')}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={isDeleting}
                    className={cn(
                        'border-2 border-destructive px-4 py-2 text-sm text-destructive transition-colors',
                        'hover:bg-destructive hover:text-white',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                >
                    {isDeleting ? t('toolbar.deleting') : t('toolbar.delete')}
                </button>
            </div>
        </>
    );
}
