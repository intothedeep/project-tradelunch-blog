'use client';

// Purpose: a single GLOBAL popular-tag link for the rail 'nav' mode. Splits out
// of the (server) TagCloud purely so it can read the current pathname and
// highlight the active tag — the selected tag lives in the URL path
// (/tags/<tag>), not a search param. Active styling reuses the existing
// active-chip theme (border-primary + text-primary), matching FilterChip.
// Side effects: none (URL navigation is delegated to next/link).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Props = {
    tag: string;
    count: number;
};

const BASE =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors';
const INACTIVE = 'border border-border text-foreground hover:bg-accent/50';
const ACTIVE = 'border border-primary font-semibold text-primary';

export const NavTagLink: React.FC<Props> = ({ tag, count }) => {
    const href = `/tags/${encodeURIComponent(tag)}`;
    const pathname = usePathname();
    // Compare decoded values — usePathname() may return the segment either
    // encoded or decoded depending on the chars, so normalize before matching.
    const activeTag = decodeURIComponent(pathname.split('/')[2] ?? '');
    const isActive = pathname.startsWith('/tags/') && activeTag === tag;

    return (
        <Link
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(BASE, isActive ? ACTIVE : INACTIVE)}
        >
            <span className="truncate">{tag}</span>
            <span className="text-muted-foreground">{count}</span>
        </Link>
    );
};

export default NavTagLink;
