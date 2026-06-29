'use client';

// Purpose: <lg reachability for the per-user context (H5.5 Q1). A collapsible
// disclosure shown at the top of /blog/@username on narrow viewports (the
// BlogShell already gates this slot with `lg:hidden`). A button toggles a panel
// containing the SAME per-user content — passed in as `children` (a server-
// rendered <UserContextRail/>) because a server component cannot be imported
// into a client component. So a <lg visitor can still browse the author's
// categories/tags/profile — it must NOT silently disappear.
// Side effects: local open/close state only.

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const UserContextSheet = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const panelId = useId();
    const t = useTranslations('blog');

    return (
        <section className="border-b border-border bg-background p-3">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
            >
                <span>{t('rail.aboutBlog')}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 shrink-0 transition-transform',
                        isOpen ? 'rotate-0' : '-rotate-90'
                    )}
                />
            </button>
            <div
                id={panelId}
                hidden={!isOpen}
                className="pt-3"
            >
                {children}
            </div>
        </section>
    );
};

export default UserContextSheet;
