// components/funds/FundNavDrawer.client.tsx
// Purpose: mobile-only fund navigation. Renders a trigger button that opens a
//   left-side Sheet holding the fund list. Desktop keeps the static sidebar.
// Constraints: client component — owns Sheet open/close state only.
//   The fund list itself is passed as `children` so it stays server-rendered.
// Side effects: none (navigation happens via <Link> inside children).

'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';

interface FundNavDrawerProps {
    // The active fund label, shown on the trigger for orientation.
    activeLabel: string;
    // Server-rendered FundList.
    children: React.ReactNode;
}

export default function FundNavDrawer({
    activeLabel,
    children,
}: FundNavDrawerProps) {
    const [open, setOpen] = useState(false);

    return (
        <Sheet
            open={open}
            onOpenChange={setOpen}
        >
            <SheetTrigger asChild>
                <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/60"
                >
                    <Menu className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{activeLabel}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        Funds
                    </span>
                </button>
            </SheetTrigger>
            <SheetContent
                side="left"
                className="w-80 max-w-[85vw] overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>Funds</SheetTitle>
                </SheetHeader>
                {/* Tapping any fund link navigates and closes the drawer. */}
                <div
                    className="px-2 pb-4"
                    onClick={() => setOpen(false)}
                >
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    );
}
