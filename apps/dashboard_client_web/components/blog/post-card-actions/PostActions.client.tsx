'use client';

// Purpose: responsive container for a post's action buttons (Share/Save/Like/
//   owner Edit). Inline horizontal row on desktop; collapsed into a single
//   "more" dropdown on mobile (< md / 768px) to avoid header overflow.
//   `forceDropdown` opts a caller into the collapsed dropdown at every viewport
//   (used on the single-post header, which always prefers the compact menu).
// Invariants: children are rendered EXACTLY ONCE (inline OR dropdown) so
//   stateful actions like LikeButton keep a single state instance. Action
//   buttons keep their own onClick — children are placed directly in the
//   dropdown content, never wrapped in DropdownMenuItem (which would hijack
//   the click).
// Constraints: before hydration isMobile is false → desktop default renders,
//   keeping SSR markup identical to the inline row. When forceDropdown is set,
//   SSR and client both render the dropdown, so markup stays consistent.
//   Trigger sits at z-10 so it stays above the card's overlay nav Link.
// Side effects: none beyond local dropdown open/close state (Radix).

import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile.hook';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
    children: React.ReactNode;
    className?: string;
    forceDropdown?: boolean;
    // Always render the inline row, even on mobile (overrides the isMobile
    // collapse). Used by the card engagement footer, which is a full-width row
    // with room for every action — no need to hide them behind a "more" menu.
    forceInline?: boolean;
};

export const PostActions: React.FC<Props> = ({
    children,
    className,
    forceDropdown = false,
    forceInline = false,
}) => {
    const isMobile = useIsMobile();
    const collapsed = forceInline ? false : forceDropdown || isMobile;

    if (!collapsed) {
        return (
            <div className={cn('flex items-center gap-2 shrink-0', className)}>
                {children}
            </div>
        );
    }

    return (
        <div className={cn('shrink-0', className)}>
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label="Post actions"
                    className={cn(
                        'relative z-10',
                        'flex items-center justify-center',
                        'py-2 px-3',
                        'transition-colors border border-primary/30',
                        'text-xs font-semibold',
                        'hover:border-primary hover:bg-primary hover:text-primary-foreground'
                    )}
                >
                    <MoreHorizontal size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="flex flex-col gap-1"
                >
                    {children}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
