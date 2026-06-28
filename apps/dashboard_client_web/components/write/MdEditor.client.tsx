// components/write/MdEditor.client.tsx
// Purpose: thin client-only wrapper around @uiw/react-md-editor.
// Constraints: the underlying editor touches browser globals at module load, so
// it must be loaded with ssr:false (next/dynamic). CSS is imported here, which
// the App Router permits at the component level. We deliberately render in
// `preview="edit"` mode: the live preview is owned by EditorPreview using the
// project's own react-markdown pipeline (GFM/KaTeX/Prism), so this surface is
// just a syntax-highlighted source editor with a formatting toolbar.

'use client';

import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import { useTheme } from 'next-themes';
import type { MDEditorProps } from '@uiw/react-md-editor';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

export function MdEditor(props: MDEditorProps) {
    // Bind the editor's color mode to the app's resolved theme rather than the
    // OS. The editor's CSS otherwise falls back to `prefers-color-scheme`, which
    // diverges from next-themes' class-based `.dark` toggle the moment a user
    // overrides the OS. `resolvedTheme` collapses 'system' to the actual value;
    // safe to read here because MDEditor is client-only (ssr:false).
    const { resolvedTheme } = useTheme();
    return (
        <MDEditor
            data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}
            preview="edit"
            visibleDragbar={false}
            {...props}
        />
    );
}
