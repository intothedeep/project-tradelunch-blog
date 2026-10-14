'use client';

// Purpose: in-article collapsible Table of Contents for narrow viewports (<lg).
// Reads the post TOC published by TocPublisher (tocItemsAtom) and wraps the
// existing TableOfContents list in a Radix Collapsible — collapsed by default —
// so the headings sit under the byline without dominating the reading column.
// Empty guard: renders null when there are no headings (mirrors TableOfContents),
// so the whole block collapses to nothing on heading-less posts. The mount site
// (PostContentCard) gates it with `lg:hidden`; the >=lg right-rail TOC is
// unaffected.
// Side effects: local open/close state only.

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { ChevronDown } from 'lucide-react';
import { tocItemsAtom } from '@/store/toc.atom';
import { TableOfContents } from '@/components/blog/TableOfContents.client';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export const MobileToc = () => {
    const items = useAtomValue(tocItemsAtom);
    const [isOpen, setIsOpen] = useState(false);

    // Empty guard: no headings → render nothing (no trigger, no shell).
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="mb-3"
        >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-none border border-primary bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/50">
                <span className="flex items-center gap-2 font-mono text-primary">
                    <span>&gt;</span> TABLE OF CONTENTS
                </span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 transition-transform',
                        isOpen ? 'rotate-0' : '-rotate-90'
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="border border-t-0 border-primary bg-card">
                <TableOfContents
                    items={items}
                    bare
                />
            </CollapsibleContent>
        </Collapsible>
    );
};

export default MobileToc;
