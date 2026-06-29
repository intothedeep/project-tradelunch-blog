'use client';

// Purpose: a generic collapsible section for the left rail (e.g. "Popular tags").
// The header is a button toggling an open/close boolean; the content region is
// wired to the button via aria-controls / aria-expanded for screen readers.
// Side effects: local open state only (no persistence — rail collapse lives in
// the layout atom, this is just a per-section disclosure).

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RailSection = ({
    title,
    children,
    defaultOpen = true,
}: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const contentId = useId();

    return (
        <section className="flex flex-col">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent/50"
            >
                <span>{title}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 transition-transform',
                        isOpen ? 'rotate-0' : '-rotate-90'
                    )}
                />
            </button>
            <div
                id={contentId}
                hidden={!isOpen}
                className="px-3 pb-2 pt-1"
            >
                {children}
            </div>
        </section>
    );
};

export default RailSection;
