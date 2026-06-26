// components/write/MarkdownEditor.client.tsx
// Purpose: authoring surface — title + markdown body with a live preview, a
// status selector, image upload, autosave-as-draft, and explicit save/delete.
// Constraints: client-only. Seeds once from useEditorSeed; all persistence is
// delegated to the query hooks (no direct fetching here).

'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';
import { useEditorSeed } from '@/hooks/useEditorSeed.hook';
import { useDraftAutosave } from '@/hooks/useDraftAutosave.hook';
import { useImageUpload } from '@/hooks/useImageUpload.hook';
import { useCreatePost } from '@/hooks/useCreatePost.query.client';
import { useUpdatePost } from '@/hooks/useUpdatePost.query.client';
import { useDeletePost } from '@/hooks/useDeletePost.query.client';
import { cn } from '@/lib/utils';
import type { TPostInput, TPostStatus } from '@repo/types';

const STATUS_OPTIONS: TPostStatus[] = ['draft', 'private', 'follower', 'public'];

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
        setStatus(seed.initial.status ?? 'draft');
        setIsSeeded(true);
    }, [isSeeded, seed.isLoading, seed.initial]);

    const draftInput: TPostInput = {
        title,
        content,
        description,
        status: 'draft',
    };
    useDraftAutosave(postId, draftInput, isSeeded);

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
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                    aria-label="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="TITLE"
                    className="flex-1 border-2 border-primary/50 bg-transparent px-3 py-2 text-lg outline-none focus:border-primary"
                />
                <select
                    aria-label="status"
                    value={status}
                    onChange={(e) =>
                        setStatus(e.target.value as TPostStatus)
                    }
                    className="border-2 border-primary/50 bg-transparent px-2 py-2 text-sm outline-none focus:border-primary"
                >
                    {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
            </div>

            <input
                aria-label="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="DESCRIPTION (optional)"
                className="mb-3 w-full border-2 border-primary/50 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
            />

            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={image.isUploading || image.isStorageDisabled}
                    className={cn(
                        'border-2 border-primary px-3 py-1 transition-colors',
                        'hover:bg-primary hover:text-primary-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                >
                    {image.isUploading ? 'UPLOADING...' : 'INSERT IMAGE'}
                </button>
                {image.isStorageDisabled && (
                    <span className="text-muted-foreground">
                        이미지 저장소가 설정되지 않아 업로드가 비활성화되었습니다.
                    </span>
                )}
                {image.error && !image.isStorageDisabled && (
                    <span role="alert" className="text-destructive">
                        {image.error}
                    </span>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleImagePick}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <textarea
                    ref={textareaRef}
                    aria-label="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="# write markdown here"
                    className="min-h-[60vh] w-full resize-y border-2 border-primary/50 bg-transparent p-3 text-sm outline-none focus:border-primary"
                />
                <div className="prose-area min-h-[60vh] overflow-auto border-2 border-primary/30 p-3">
                    <MarkdownRenderer content={content} />
                </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !title.trim()}
                    className={cn(
                        'border-2 border-primary px-4 py-2 text-sm transition-colors',
                        'hover:bg-primary hover:text-primary-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                >
                    {isSaving ? 'SAVING...' : 'SAVE'}
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deletePost.isPending}
                    className={cn(
                        'border-2 border-destructive px-4 py-2 text-sm text-destructive transition-colors',
                        'hover:bg-destructive hover:text-white',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                >
                    {deletePost.isPending ? 'DELETING...' : 'DELETE'}
                </button>
            </div>
        </div>
    );
}
