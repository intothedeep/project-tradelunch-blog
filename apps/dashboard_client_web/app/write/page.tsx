import { MarkdownEditor } from '@/components/write/MarkdownEditor.client';

// New-post route. Thin Server Component shell → client editor with no postId.
export default function WriteNewPage() {
    return <MarkdownEditor postId={null} />;
}
