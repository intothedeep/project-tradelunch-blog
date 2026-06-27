// components/write/MarkdownEditor.client.tsx
// Purpose: authoring surface — title + markdown body with a live preview, a
// status selector, image upload, autosave-as-draft, and explicit save/delete.
// Constraints: client-only. Seeds once from useEditorSeed; all persistence is
// delegated to the query hooks (no direct fetching here).

'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { EditorPreview } from '@/components/write/EditorPreview.client';
import { EditorToolbar } from '@/components/write/EditorToolbar.client';
import { AutosaveIndicator } from '@/components/write/AutosaveIndicator.client';
import { useEditorSeed } from '@/hooks/useEditorSeed.hook';
import { useDraftAutosave } from '@/hooks/useDraftAutosave.hook';
import { useImageUpload } from '@/hooks/useImageUpload.hook';
import { useCreatePost } from '@/hooks/useCreatePost.query.client';
import { useUpdatePost } from '@/hooks/useUpdatePost.query.client';
import { useDeletePost } from '@/hooks/useDeletePost.query.client';
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
    const seed = useEditorSeed(postId);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<TPostStatus>('draft');
    const [isSeeded, setIsSeeded] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const image = useImageUpload();
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

    const insertAtCursor = (text: string) => {
        const ta = textareaRef.current;
        if (!ta) {
            setContent((c) => c + text);
            return;
        }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        setContent((c) => c.slice(0, start) + text + c.slice(end));
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
        const input: TPostInput = { title, content, description, status };
        if (postId == null) {
            const created = await createPost.mutateAsync(input);
            router.replace(`/write/${created.id}`);
            return;
        }
        await updatePost.mutateAsync({ postId, input });
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
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <textarea
                        ref={textareaRef}
                        aria-label="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="# write markdown here"
                        className="min-h-[60vh] w-full resize-y border-2 border-primary/50 bg-transparent p-3 text-sm outline-none focus:border-primary"
                    />
                    <EditorPreview content={content} />
                </div>
            </EditorToolbar>
        </div>
    );
}
