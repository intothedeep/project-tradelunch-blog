'use client';

// Purpose: thin styled wrapper providing consistent right-rail chrome/spacing.
// Route context is supplied by each layout as `children` (the `(feed)` layout
// passes the global recents widget; the `[username]` layout passes the per-user
// context rail) — this wrapper itself is route-agnostic.
// Side effects: none.

export const RightRail = ({ children }: { children: React.ReactNode }) => {
    // pt-4 = the main column's p-4, so the rail's first box and the body start
    // on the same line (owner, 2026-10-14).
    return (
        <div className="flex h-full flex-col gap-4 px-3 pb-3 pt-4">
            {children}
        </div>
    );
};

export default RightRail;
