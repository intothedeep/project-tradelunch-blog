// components/write/MarkdownEditor.client.tsx
// Purpose: authoring surface — title + markdown body with a live preview, a
// status selector, image upload, autosave-as-draft, and explicit save/delete.
// Constraints: client-only. Seeds once from useEditorSeed; all persistence is
// delegated to the query hooks (no direct fetching here).

'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { EditorPreview } from '@/components/write/EditorPreview.client';
import { MdEditor } from '@/components/write/MdEditor.client';
import { PostSettings } from '@/components/write/PostSettings.client';
import { CategoryCascader } from '@/components/write/CategoryCascader.client';
import { TagInput } from '@/components/write/TagInput.client';
import { EditorToolbar } from '@/components/write/EditorToolbar.client';
import { AutosaveIndicator } from '@/components/write/AutosaveIndicator.client';

import { useEditorSeed } from '@/hooks/useEditorSeed.hook';
import { useDraftAutosave } from '@/hooks/useDraftAutosave.hook';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard.hook';
import { useImageUpload } from '@/hooks/useImageUpload.hook';
import { useComposition } from '@/hooks/useComposition.hook';
import { useCreatePost } from '@/hooks/useCreatePost.query.client';
import { useUpdatePost } from '@/hooks/useUpdatePost.query.client';
import { useDeletePost } from '@/hooks/useDeletePost.query.client';
import { useEditorHandlers } from '@/hooks/useEditorHandlers.hook';

import { cn } from '@/lib/utils';
import type { TPostInput, TPostStatus } from '@repo/types';

// Status values the editor can represent. Legacy/out-of-set values (e.g.
// 'follower') must be coerced on seed so the controlled <select> always has a
// matching option and does not silently rewrite status on the next save.
const ALLOWED_SEED_STATUS = new Set<TPostStatus>([
    'draft',
    'private',
    'public',
]);

export function MarkdownEditor({ postId }: { postId: string | null }) {
    const { user } = useUser();
    const seed = useEditorSeed(postId);
    const t = useTranslations('write');

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<TPostStatus>('draft');
    const [slug, setSlug] = useState('');
    // Author-chosen thumbnail public URL (reuses the image-upload pipeline).
    // Null = no thumbnail. Persisted on explicit Save via TPostInput.thumbnailUrl.
    // Autosave deliberately omits it (see draftInput below).
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    // Single leaf category id (string; BIGINT-safe). Null = unset; required to publish.
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    // Inline error shown when a publish save is attempted with no category.
    const [categoryError, setCategoryError] = useState<string | null>(null);
    // Slug of the most recent successful public save, used to surface a "view live" link.
    const [liveSlug, setLiveSlug] = useState<string | null>(null);
    const [isSeeded, setIsSeeded] = useState(false);
    // Mobile-only pane toggle. CSS handles the breakpoint to avoid a JS-measured flash.
    const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');

    // Ref to the column wrapping the editor. Used for cursor-aware image insertion
    // via querySelector rather than depending on a dynamic-import component ref.
    const editorContainerRef = useRef<HTMLDivElement>(null);

    const image = useImageUpload();
    const thumbnail = useImageUpload();
    const composition = useComposition();
    const createPost = useCreatePost();
    const updatePost = useUpdatePost();
    const deletePost = useDeletePost();

    // Seed exactly once, after the seed query settles.
    useEffect(() => {
        if (isSeeded || seed.isLoading || !seed.initial) return;
        setTitle(seed.initial.title);
        setContent(seed.initial.content ?? '');
        setDescription(seed.initial.description ?? '');
        setSlug(seed.initial.slug ?? '');
        const seededStatus = seed.initial.status ?? 'draft';
        setStatus(
            ALLOWED_SEED_STATUS.has(seededStatus) ? seededStatus : 'private'
        );
        setThumbnailUrl(seed.thumbnailUrl);
        setCategoryId(seed.initial.categoryId ?? null);
        setTags(seed.initial.tags ?? []);
        setIsSeeded(true);
    }, [isSeeded, seed.isLoading, seed.initial, seed.thumbnailUrl]);

    // Autosave payload. Deliberately OMITS thumbnailUrl: thumbnail is a
    // low-frequency deliberate choice persisted on explicit Save only.
    const draftInput: TPostInput = {
        title,
        content,
        description,
        status,
        categoryId,
        tags,
    };
    const autosave = useDraftAutosave(postId, draftInput, isSeeded);

    // Warn on hard unload (tab close / refresh) while edits are pending.
    const isDirty =
        autosave.status === 'unsaved' || autosave.status === 'saving';
    useUnsavedGuard(isDirty);

    const {
        handleImagePaste,
        handleImageDrop,
        handleThumbnailPick,
        handleClearThumbnail,
        handleSave,
        handleDelete,
    } = useEditorHandlers({
        postId,
        title,
        content,
        description,
        status,
        categoryId,
        tags,
        slug,
        thumbnailUrl,
        username: user?.username ?? undefined,
        editorContainerRef,
        setContent,
        setThumbnailUrl,
        setCategoryError,
        setLiveSlug,
        isComposingRef: composition.isComposingRef,
        image,
        thumbnail,
        createPost,
        updatePost,
        deletePost,
    });

    if (postId != null && !isSeeded && !seed.initial && !seed.isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center font-mono text-sm text-muted-foreground">
                {t('editor.notFound')}
            </div>
        );
    }

    const isSaving = createPost.isPending || updatePost.isPending;

    return (
        <div className="mx-auto w-full max-w-6xl p-4 font-mono">
            <div className="mb-2 flex min-h-[1.75rem] justify-end">
                <AutosaveIndicator
                    status={autosave.status}
                    lastSavedAt={autosave.lastSavedAt}
                    onRetry={autosave.retry}
                />
            </div>
            <EditorToolbar
                title={title}
                onTitleChange={setTitle}
                status={status}
                onStatusChange={setStatus}
                description={description}
                onDescriptionChange={setDescription}
                onSave={handleSave}
                isSaving={isSaving}
                canSave={!!title.trim()}
                onDelete={handleDelete}
                isDeleting={deletePost.isPending}
                autoFocusTitle={postId == null}
            >
                <PostSettings
                    slug={slug}
                    onSlugChange={setSlug}
                    thumbnailUrl={thumbnailUrl}
                    onPickThumbnail={handleThumbnailPick}
                    onClearThumbnail={handleClearThumbnail}
                    isThumbnailUploading={thumbnail.isUploading}
                    isStorageDisabled={thumbnail.isStorageDisabled}
                    thumbnailError={thumbnail.error}
                    categorySlot={
                        <>
                            <CategoryCascader
                                username={user?.username ?? null}
                                value={categoryId}
                                onChange={(id) => {
                                    setCategoryId(id);
                                    if (id) setCategoryError(null);
                                }}
                            />
                            {categoryError && (
                                <p
                                    role="alert"
                                    className="mt-1 text-xs text-destructive"
                                >
                                    {categoryError}
                                </p>
                            )}
                        </>
                    }
                    tagsSlot={
                        <TagInput
                            value={tags}
                            onChange={setTags}
                        />
                    }
                >
                    {status === 'public' && user?.username && liveSlug && (
                        <Link
                            href={`/blog/@${user.username}/${liveSlug}`}
                            target="_blank"
                            className="mt-3 inline-block text-xs uppercase tracking-wider text-primary underline-offset-4 hover:underline"
                        >
                            {t('editor.viewLive')}
                        </Link>
                    )}
                </PostSettings>
                <div
                    role="tablist"
                    aria-label={t('a11y.editorView')}
                    className="mb-3 flex gap-2 md:hidden"
                >
                    {(['write', 'preview'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            role="tab"
                            aria-selected={viewMode === mode}
                            onClick={() => setViewMode(mode)}
                            className={cn(
                                'flex-1 border-2 border-primary/50 p-2 text-xs uppercase tracking-wider transition-colors hover:border-primary',
                                viewMode === mode
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-transparent text-foreground'
                            )}
                        >
                            {mode === 'write'
                                ? t('editor.tabWrite')
                                : t('editor.tabPreview')}
                        </button>
                    ))}
                </div>
                <div
                    className="mb-2 flex flex-wrap items-center gap-2 text-xs"
                    aria-live="polite"
                >
                    <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                        {t('editor.imageHint')}
                    </span>
                    {image.isUploading && (
                        <span className="text-muted-foreground">
                            {t('toolbar.uploading')}
                        </span>
                    )}
                    {image.isStorageDisabled && (
                        <span className="text-muted-foreground">
                            {t('toolbar.storageDisabled')}
                        </span>
                    )}
                    {image.error && !image.isStorageDisabled && (
                        <span
                            role="alert"
                            className="text-destructive"
                        >
                            {image.error}
                        </span>
                    )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div
                        ref={editorContainerRef}
                        className={cn(
                            viewMode === 'write' ? 'block' : 'hidden',
                            // Mobile: fixed 60vh. md+: h-full lets the grid row's stretch
                            // size the editor cell to the preview cell's height.
                            'h-[60vh] md:block md:h-full'
                        )}
                    >
                        <MdEditor
                            value={content}
                            onChange={(v) => setContent(v ?? '')}
                            height="100%"
                            textareaProps={{
                                'aria-label': t('a11y.content'),
                                placeholder: t('editor.contentPlaceholder'),
                                onCompositionStart:
                                    composition.onCompositionStart,
                                onCompositionEnd: composition.onCompositionEnd,
                                onPaste: handleImagePaste,
                                onDrop: handleImageDrop,
                            }}
                        />
                    </div>
                    <div
                        className={cn(
                            viewMode === 'preview' ? 'block' : 'hidden',
                            'md:block'
                        )}
                    >
                        <EditorPreview
                            content={content}
                            isComposing={composition.isComposing}
                        />
                    </div>
                </div>
            </EditorToolbar>
        </div>
    );
}
