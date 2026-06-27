// components/write/EditorPreview.client.tsx
// Purpose: debounced live preview pane for the markdown editor. Defers the
// expensive GFM/KaTeX/Prism render until typing pauses, so the preview does
// not re-render per keystroke.
// Constraints: client-only; presentational. Holds a single debounced mirror of
// `content`; the only side effect is the debounce timer, cleaned up on unmount.

'use client';

import { useEffect, useState } from 'react';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';

const DEBOUNCE_MS = 180;

export function EditorPreview({ content }: { content: string }) {
    const [debouncedContent, setDebouncedContent] = useState(content);

    useEffect(() => {
        const timer = setTimeout(
            () => setDebouncedContent(content),
            DEBOUNCE_MS
        );
        return () => clearTimeout(timer);
    }, [content]);

    return (
        <div
            aria-label="preview"
            className="prose-area min-h-[60vh] overflow-auto border-2 border-primary/30 p-3"
        >
            <MarkdownRenderer content={debouncedContent} />
        </div>
    );
}
