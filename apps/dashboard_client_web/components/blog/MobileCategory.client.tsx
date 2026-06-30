'use client';

// Purpose: collapsible category section for narrow viewports (<lg), where the
// right rail (which holds the desktop CategorySidebar) is hidden. Mirrors
// MobileToc's Collapsible shell — collapsed by default, chevron trigger — so the
// post-list page gets the same "Contents"-style accordion the post-detail page
// uses for its TOC. The body (the category tree) is passed in as children so the
// server can fetch it; this component only owns the open/close chrome.
// Side effects: local open/close state only.

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    children: React.ReactNode;
};

export const MobileCategory = ({ title, children }: Props) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="mb-3"
        >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/50">
                <span>{title}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 transition-transform',
                        isOpen ? 'rotate-0' : '-rotate-90'
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent>{children}</CollapsibleContent>
        </Collapsible>
    );
};

export default MobileCategory;
