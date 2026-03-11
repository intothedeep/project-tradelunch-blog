'use client';

import { useCallback, useRef, useState, useEffect } from 'react';

interface Size {
    width: number;
    height: number;
}

/**
 * Hook that tracks the size of a DOM element using ResizeObserver.
 *
 * Returns:
 *   [ref, size] — attach ref to the element you want to measure
 *
 * Example:
 *   const [ref, { width, height }] = useElementSize<HTMLDivElement>();
 *   return <div ref={ref}>Width: {width}</div>
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>(): [
    (node: T | null) => void,
    Size,
] {
    const [size, setSize] = useState<Size>({ width: 0, height: 0 });
    const observerRef = useRef<ResizeObserver | null>(null);
    const nodeRef = useRef<T | null>(null);

    const ref = useCallback((node: T | null) => {
        // Clean up previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }

        if (node) {
            nodeRef.current = node;
            // Initial measurement
            setSize({
                width: node.offsetWidth,
                height: node.offsetHeight,
            });

            // Observe future changes
            observerRef.current = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry) {
                    setSize({
                        width: entry.contentRect.width,
                        height: entry.contentRect.height,
                    });
                }
            });
            observerRef.current.observe(node);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    return [ref, size];
}
