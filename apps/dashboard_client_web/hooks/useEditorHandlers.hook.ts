'use client';

// useEditorHandlers: encapsulates image-upload event handlers and save/delete
// logic for MarkdownEditor. Requires component state setters and mutation hooks
// as arguments — no hidden global state.

import {
    useRef,
    type ChangeEvent,
    type ClipboardEvent,
    type DragEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setPostStatusAction } from '@/app/actions/postPublish.action';
import type { TPostInput, TPostStatus } from '@repo/types';

type ImageUploadHook = {
    upload: (file: File) => Promise<string | null>;
};

type MutationHook<TInput, TResult> = {
    mutateAsync: (input: TInput) => Promise<TResult>;
    isPending: boolean;
};

type UseEditorHandlersArgs = {
    postId: string | null;
    title: string;
    content: string;
    description: string;
    status: TPostStatus;
    categoryId: string | null;
    tags: string[];
    slug: string;
    thumbnailUrl: string | null;
    username: string | undefined;
    editorContainerRef: React.RefObject<HTMLDivElement | null>;
    setContent: React.Dispatch<React.SetStateAction<string>>;
    setThumbnailUrl: React.Dispatch<React.SetStateAction<string | null>>;
    setCategoryError: React.Dispatch<React.SetStateAction<string | null>>;
    setLiveSlug: React.Dispatch<React.SetStateAction<string | null>>;
    isComposingRef: React.RefObject<boolean>;
    image: ImageUploadHook;
    thumbnail: ImageUploadHook;
    createPost: MutationHook<TPostInput, { id: string; slug: string }>;
    updatePost: MutationHook<
        { postId: string; input: TPostInput },
        { id: string; slug: string }
    >;
    deletePost: MutationHook<{ postId: string; username: string }, unknown>;
};

/** Pick image files from a FileList; returns empty array for non-image items. */
export function pickImageFiles(list: FileList | null | undefined): File[] {
    return list
        ? Array.from(list).filter((f) => f.type.startsWith('image/'))
        : [];
}

export function useEditorHandlers({
    postId,
    title,
    content,
    description,
    status,
    categoryId,
    tags,
    slug,
    thumbnailUrl,
    username,
    editorContainerRef,
    setContent,
    setThumbnailUrl,
    setCategoryError,
    setLiveSlug,
    isComposingRef,
    image,
    thumbnail,
    createPost,
    updatePost,
    deletePost,
}: UseEditorHandlersArgs) {
    const router = useRouter();
    const t = useTranslations('write');
    const uploadSeqRef = useRef(0);

    const insertAtCursor = (text: string) => {
        const ta =
            editorContainerRef.current?.querySelector('textarea') ?? null;
        if (!ta) {
            setContent((c) => c + text);
            return;
        }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        setContent((c) => c.slice(0, start) + text + c.slice(end));
        // While the IME is composing it owns the caret; mutating the selection
        // here would duplicate the trailing jamo and jump the cursor.
        if (isComposingRef.current) return;
        requestAnimationFrame(() => {
            ta.focus();
            const pos = start + text.length;
            ta.setSelectionRange(pos, pos);
        });
    };

    // Upload one image file via the shared pipeline and swap a placeholder for
    // the final markdown. Placeholder keeps the editor responsive during upload.
    const uploadImageFile = async (file: File) => {
        const token = `![uploading-${++uploadSeqRef.current}]()`;
        insertAtCursor(token);
        const url = await image.upload(file);
        setContent((c) =>
            c.replace(token, url ? `![${file.name}](${url})` : '')
        );
    };

    // Intercept image paste in the editor, upload each file sequentially.
    const handleImagePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const files = pickImageFiles(e.clipboardData?.files);
        if (files.length === 0) return;
        e.preventDefault();
        void files.reduce(
            (chain, file) => chain.then(() => uploadImageFile(file)),
            Promise.resolve()
        );
    };

    const handleImageDrop = (e: DragEvent<HTMLTextAreaElement>) => {
        const files = pickImageFiles(e.dataTransfer?.files);
        if (files.length === 0) return;
        e.preventDefault();
        void files.reduce(
            (chain, file) => chain.then(() => uploadImageFile(file)),
            Promise.resolve()
        );
    };

    // Reuse the image-upload pipeline for the thumbnail.
    const handleThumbnailPick = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const url = await thumbnail.upload(file);
        if (url) setThumbnailUrl(url);
    };

    const handleClearThumbnail = () => setThumbnailUrl(null);

    const handleSave = async () => {
        // Block publish without category; surface client-side.
        if (status !== 'draft' && !categoryId) {
            setCategoryError(t('category.publishRequired'));
            return;
        }
        setCategoryError(null);
        if (
            status === 'public' &&
            !window.confirm(t('editor.publishConfirm'))
        ) {
            return;
        }
        const input: TPostInput = {
            title,
            content,
            description,
            status,
            categoryId,
            tags,
            slug: slug.trim() || undefined,
            thumbnailUrl,
        };
        const saved =
            postId == null
                ? await createPost.mutateAsync(input)
                : await updatePost.mutateAsync({ postId, input });
        if (status === 'public') setLiveSlug(saved.slug);
        // Re-assert status via Server Action to revalidate the cached feed.
        if (status !== 'draft' && username) {
            await setPostStatusAction(saved.id, status, username);
        }
        // router.replace is a soft URL swap — no remount, textarea keeps focus.
        if (postId == null) router.replace(`/write/${saved.id}`);
    };

    const handleDelete = async () => {
        if (postId == null) {
            router.push('/blog');
            return;
        }
        if (!window.confirm(t('editor.deleteConfirm'))) return;
        await deletePost.mutateAsync({
            postId,
            username: username ?? '',
        });
        router.push('/blog');
    };

    return {
        handleImagePaste,
        handleImageDrop,
        handleThumbnailPick,
        handleClearThumbnail,
        handleSave,
        handleDelete,
    };
}
