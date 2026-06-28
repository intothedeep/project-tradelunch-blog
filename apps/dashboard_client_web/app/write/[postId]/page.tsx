import { MarkdownEditor } from '@/components/write/MarkdownEditor.client';

// Edit route. The post id is a Postgres BIGINT that can exceed JS's safe
// integer range, so it is kept as a STRING (never Number()/parseInt — that
// rounds the id and the by-id lookup then misses, emptying the editor). A
// non-digit id collapses to a new-post editor (postId null).
export default async function WriteEditPage({
    params,
}: {
    params: Promise<{ postId: string }>;
}) {
    const { postId } = await params;
    const id = /^\d+$/.test(postId) ? postId : null;
    return <MarkdownEditor postId={id} />;
}
