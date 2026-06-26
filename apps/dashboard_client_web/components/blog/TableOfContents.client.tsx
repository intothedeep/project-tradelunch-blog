'use client';

import { useEffect, useState } from 'react';
import type { TTocItem } from '@/utils/markdown/toc.types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TableOfContentsProps {
    items: TTocItem[];
    className?: string;
}

// Mapping for indentation based on heading depth
const depthIndent: Record<number, string> = {
    1: 'pl-0',
    2: 'pl-3',
    3: 'pl-6',
    4: 'pl-9',
    5: 'pl-12',
    6: 'pl-15',
};

/**
 * Client-rendered Table of Contents component.
 * Highlights active section based on URL hash.
 * Styled to match CategorySidebar design.
 */
export const TableOfContents = ({ items, className }: TableOfContentsProps) => {
    const [activeSlug, setActiveSlug] = useState<string>('');

    // Listen for hash changes and set initial hash
    useEffect(() => {
        const updateHash = () => {
            const hash = window.location.hash.slice(1); // Remove #
            setActiveSlug(hash);
        };

        // Set initial hash
        updateHash();

        // Listen for hash changes
        window.addEventListener('hashchange', updateHash);
        return () => window.removeEventListener('hashchange', updateHash);
    }, []);

    if (!items || items.length === 0) {
        return null;
    }

    return (
        <Card className={cn('bg-card border-primary my-4', className)}>
            <CardHeader className="p-3 sm:p-4 border-b border-primary/30">
                <CardTitle className="text-primary flex items-center gap-2 text-sm sm:text-base font-mono">
                    <span>&gt;</span> TABLE OF CONTENTS
                </CardTitle>
            </CardHeader>

            <CardContent className="px-2 py-2">
                <ul className="space-y-0.5">
                    {items.map((item, index) => {
                        const isActive = activeSlug === item.slug;
                        return (
                            <li
                                key={`${item.slug}-${index}`}
                                className={cn(
                                    depthIndent[item.depth] || 'pl-0'
                                )}
                            >
                                <a
                                    href={`#${item.slug}`}
                                    className={cn(
                                        'block py-0.5 text-xs font-mono',
                                        'transition-colors duration-150',
                                        'hover:underline underline-offset-2',
                                        isActive
                                            ? 'text-primary font-semibold'
                                            : 'text-foreground hover:text-primary'
                                    )}
                                >
                                    {item.text}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
        </Card>
    );
};

export default TableOfContents;
