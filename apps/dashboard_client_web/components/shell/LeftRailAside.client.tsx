'use client';

// Purpose: the left-rail OUTER container (the width-bearing <aside>). The width
// is driven by CSS from `<html data-rail>` (set before paint by the inline script
// in the root layout, and by the atom's write path on toggle), so the server
// HTML is identical for every visitor and the cached anonymous page never
// carries one reader's width. `overflow-hidden` while collapsed clips the
// expanded markup that SSR and the first client render still contain.
// Side effects: none.

import { cn } from '@/lib/utils';

export const LeftRailAside = ({ children }: { children: React.ReactNode }) => (
    <aside
        className={cn(
            'hidden w-64 shrink-0 border-r-2 border-primary transition-[width] duration-200 md:block',
            'in-data-[rail=collapsed]:w-14 in-data-[rail=collapsed]:overflow-hidden'
        )}
    >
        {children}
    </aside>
);

export default LeftRailAside;
