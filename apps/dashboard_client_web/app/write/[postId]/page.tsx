import { MarkdownEditor } from '@/components/write/MarkdownEditor.client';

// Edit route. Parses the numeric post id from the path and seeds the editor;
// a non-numeric id collapses to a new-post editor (postId null).
export default async function WriteEditPage({
    params,
}: {
    params: Promise<{ postId: string }>;
}) {
    const { postId } = await params;
    const parsed = Number(postId);
    const id = Number.isInteger(parsed) ? parsed : null;
    return <MarkdownEditor postId={id} />;
}
