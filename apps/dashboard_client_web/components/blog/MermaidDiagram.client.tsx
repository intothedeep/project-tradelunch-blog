'use client';

import { useEffect, useId, useRef, useState } from 'react';

// Renders a ```mermaid block as an SVG. The library is imported dynamically
// inside the effect so it is downloaded only on pages that contain a diagram
// and never runs on the server. SSR, no-JS and failed renders all show the
// original source in a <pre>, which keeps the server HTML deterministic for
// the Cloudflare edge cache.
export const MermaidDiagram = ({ source }: { source: string }) => {
    // useId returns ":r1:"; mermaid uses the id in a CSS selector, so strip
    // the colons.
    const diagramId = `mermaid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const containerRef = useRef<HTMLDivElement>(null);
    const [hasRendered, setHasRendered] = useState(false);

    useEffect(() => {
        let isCancelled = false;

        const renderDiagram = async () => {
            try {
                const { default: mermaid } = await import('mermaid');
                const isDark =
                    document.documentElement.classList.contains('dark');
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'strict',
                    theme: isDark ? 'dark' : 'default',
                });
                const { svg } = await mermaid.render(diagramId, source);
                if (isCancelled || !containerRef.current) return;
                containerRef.current.innerHTML = svg;
                setHasRendered(true);
            } catch (error) {
                // Keep the source <pre> visible; a bad diagram must not break the post.
                console.warn('mermaid render failed', error);
                setHasRendered(false);
            }
        };
        void renderDiagram();

        return () => {
            isCancelled = true;
        };
    }, [source, diagramId]);

    return (
        <div className="my-3 overflow-x-auto flex justify-center">
            <div
                ref={containerRef}
                hidden={!hasRendered}
            />
            {!hasRendered && (
                <pre className="text-sm p-4 bg-muted overflow-x-auto w-full">
                    <code>{source}</code>
                </pre>
            )}
        </div>
    );
};
