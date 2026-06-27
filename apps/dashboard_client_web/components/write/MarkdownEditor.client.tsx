// components/write/MarkdownEditor.client.tsx
// Purpose: authoring surface — title + markdown body with a live preview, a
// status selector, image upload, autosave-as-draft, and explicit save/delete.
// Constraints: client-only. Seeds once from useEditorSeed; all persistence is
// delegated to the query hooks (no direct fetching here).

'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { EditorPreview } from '@/components/write/EditorPreview.client';
import { PostSettings } from '@/components/write/PostSettings.client';
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

export function MarkdownEditor({ postId }: { postId: number | null }) {
    const router = useRouter();
    const { user } = useUser();
    const seed = useEditorSeed(postId);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<TPostStatus>('draft');
    const [slug, setSlug] = useState('');
    // Slug of the most recent successful public save, used to surface a
    // "view live" link. Null until a public save lands.
    const [liveSlug, setLiveSlug] = useState<string | null>(null);
    const [isSeeded, setIsSeeded] = useState(false);
    // Mobile-only pane toggle. At md+ both panes show via `md:block`, so this
    // state is irrelevant there; it only drives which single pane renders
    // below md. CSS handles the breakpoint to avoid a JS-measured flash.
    const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const image = useImageUpload();
    const composition = useComposition();
    const createPost = useCreatePost();
    const updatePost = useUpdatePost();
    const deletePost = useDeletePost();

    // Seed exactly once, after the seed query settles, so a late-arriving body
    // for an existing post is not clobbered by an empty initial value.
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
        setIsSeeded(true);
    }, [isSeeded, seed.isLoading, seed.initial]);

    const draftInput: TPostInput = {
        title,
        content,
        description,
        status,
    };
    const autosave = useDraftAutosave(postId, draftInput, isSeeded);

    // Warn on hard unload (tab close / refresh) while edits are pending. SPA
    // navigation is covered by flush-on-unmount inside useDraftAutosave.
    const isDirty =
        autosave.status === 'unsaved' || autosave.status === 'saving';
    useUnsavedGuard(isDirty);

    const insertAtCursor = (text: string) => {
        const ta = textareaRef.current;
        if (!ta) {
            setContent((c) => c + text);
            return;
        }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        setContent((c) => c.slice(0, start) + text + c.slice(end));
        // While the IME is composing it owns the caret; mutating the
        // selection here would duplicate the trailing jamo and jump the
        // cursor, so skip the manual caret set during composition.
        if (composition.isComposingRef.current) return;
        requestAnimationFrame(() => {
            ta.focus();
            const pos = start + text.length;
            ta.setSelectionRange(pos, pos);
        });
    };

    const handleImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const url = await image.upload(file);
        if (url) insertAtCursor(`![${file.name}](${url})`);
    };

    const handleSave = async () => {
        // Publishing is irreversible-feeling for the author: confirm before a
        // draft/private post becomes world-readable. Other statuses save silently.
        if (
            status === 'public' &&
            !window.confirm('이 글을 공개로 발행할까요? 모두에게 보입니다.')
        ) {
            return;
        }
        const input: TPostInput = {
            title,
            content,
            description,
            status,
            slug: slug.trim() || undefined,
        };
        const saved =
            postId == null
                ? await createPost.mutateAsync(input)
                : await updatePost.mutateAsync({ postId, input });
        if (status === 'public') setLiveSlug(saved.slug);
        // router.replace is a soft URL swap in the App Router: it updates the
        // route without remounting this client tree, so the textarea keeps its
        // focus/caret. No manual focus restoration is needed here.
        if (postId == null) router.replace(`/write/${saved.id}`);
    };

    const handleDelete = async () => {
        if (postId == null) {
            router.push('/blog');
            return;
        }
        if (!window.confirm('이 글을 삭제할까요?')) return;
        await deletePost.mutateAsync(postId);
        router.push('/blog');
    };

    if (postId != null && !isSeeded && !seed.initial && !seed.isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center font-mono text-sm text-muted-foreground">
                &gt; post not found
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
                onPickImage={handleImagePick}
                isUploading={image.isUploading}
                isStorageDisabled={image.isStorageDisabled}
                imageError={image.error}
                fileInputRef={fileInputRef}
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
                >
                    {status === 'public' && user?.username && liveSlug && (
                        <Link
                            href={`/blog/@${user.username}/${liveSlug}`}
                            target="_blank"
                            className="mt-3 inline-block text-xs uppercase tracking-wider text-primary underline-offset-4 hover:underline"
                        >
                            view live →
                        </Link>
                    )}
                </PostSettings>
                <div
                    role="tablist"
                    aria-label="editor view"
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
                            {mode}
                        </button>
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div
                        className={cn(
                            viewMode === 'write' ? 'block' : 'hidden',
                            'md:block'
                        )}
                    >
                        <textarea
                            ref={textareaRef}
                            aria-label="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onCompositionStart={composition.onCompositionStart}
                            onCompositionEnd={composition.onCompositionEnd}
                            placeholder="# write markdown here"
                            className="min-h-[60vh] w-full resize-y border-2 border-primary/50 bg-transparent p-3 text-sm outline-none focus:border-primary"
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
