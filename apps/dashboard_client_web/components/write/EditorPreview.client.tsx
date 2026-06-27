// components/write/EditorPreview.client.tsx
// Purpose: debounced live preview pane for the markdown editor. Defers the
// expensive GFM/KaTeX/Prism render until typing pauses, so the preview does
// not re-render per keystroke.
// Constraints: client-only; presentational. Holds a single debounced mirror of
// `content`; the only side effect is the debounce timer, cleaned up on unmount.
// While `isComposing` (IME) is true the flush is held so a partial Hangul
// jamo is not rendered; it flushes once composition ends.

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer.server';

const DEBOUNCE_MS = 180;

export function EditorPreview({
    content,
    isComposing = false,
}: {
    content: string;
    isComposing?: boolean;
}) {
    const t = useTranslations('write');
    const [debouncedContent, setDebouncedContent] = useState(content);

    useEffect(() => {
        if (isComposing) return;
        const timer = setTimeout(
            () => setDebouncedContent(content),
            DEBOUNCE_MS
        );
        return () => clearTimeout(timer);
    }, [content, isComposing]);

    return (
        <div
            aria-label={t('a11y.preview')}
            className="prose-area min-h-[60vh] overflow-auto border-2 border-primary/30 p-3"
        >
            <MarkdownRenderer content={debouncedContent} />
        </div>
    );
}
