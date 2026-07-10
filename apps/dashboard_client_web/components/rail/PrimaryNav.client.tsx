'use client';

// Purpose: the left-rail primary navigation (Home / All posts / About / Resume /
// Write / Saved / My blog). Links come from usePrimaryNavLinks (which gates auth
// — Write/Saved/My blog hidden while signed out — and hides "My blog" when there
// is no resolved username). Active route is derived
// from usePathname and exposed via aria-current="page". When `collapsed`, only
// icons render (label moves to title/aria-label).
// Side effects: none beyond reading the current pathname + Clerk user.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    Home,
    Info,
    FileText,
    Newspaper,
    Compass,
    PenSquare,
    Bookmark,
    User,
    MessageSquare,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrimaryNavLinks } from '@/hooks/useNavLinks.hook';

const ICON_BY_KEY: Record<string, LucideIcon> = {
    home: Home,
    allPosts: Newspaper,
    log: MessageSquare,
    about: Info,
    resume: FileText,
    explore: Compass,
    write: PenSquare,
    saved: Bookmark,
    myBlog: User,
};

// Pure: a link is active when it is the exact path; for non-root links the
// active state also covers nested sub-paths (e.g. /me/saved/...). The two
// index-like routes ('/' and '/blog') match EXACT-only — otherwise '/blog'
// would light up on every '/blog/@author' page (which startsWith('/blog/')).
function isActivePath(pathname: string, href: string): boolean {
    if (href === '/' || href === '/blog') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
}

const ITEM_BASE =
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors';

export const PrimaryNav = ({ collapsed = false }: { collapsed?: boolean }) => {
    const pathname = usePathname();
    const links = usePrimaryNavLinks();
    const t = useTranslations('blog');

    return (
        <nav aria-label="Primary">
            <ul className="flex flex-col gap-1">
                {links.map((link) => {
                    const Icon = link.iconKey
                        ? ICON_BY_KEY[link.iconKey]
                        : undefined;
                    const label = link.labelKey ? t(link.labelKey) : link.title;

                    if (link.disabled) {
                        return (
                            <li key={link.href}>
                                <span
                                    aria-disabled="true"
                                    title={label}
                                    className={cn(
                                        ITEM_BASE,
                                        'cursor-not-allowed text-muted-foreground/50',
                                        collapsed && 'justify-center'
                                    )}
                                >
                                    {Icon ? (
                                        <Icon className="h-5 w-5 shrink-0" />
                                    ) : null}
                                    {!collapsed ? (
                                        <span className="truncate">
                                            {label}
                                        </span>
                                    ) : null}
                                </span>
                            </li>
                        );
                    }

                    const active = isActivePath(pathname, link.href);

                    return (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                aria-current={active ? 'page' : undefined}
                                aria-label={collapsed ? label : undefined}
                                title={collapsed ? label : undefined}
                                className={cn(
                                    ITEM_BASE,
                                    active
                                        ? 'bg-accent font-medium text-accent-foreground'
                                        : 'text-foreground hover:bg-accent/50',
                                    collapsed && 'justify-center'
                                )}
                            >
                                {Icon ? (
                                    <Icon className="h-5 w-5 shrink-0" />
                                ) : null}
                                {!collapsed ? (
                                    <span className="truncate">{label}</span>
                                ) : null}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};

export default PrimaryNav;
