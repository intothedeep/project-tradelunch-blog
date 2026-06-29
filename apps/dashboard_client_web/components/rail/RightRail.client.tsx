'use client';

// Purpose: thin styled wrapper providing consistent right-rail chrome/spacing.
// Route context is supplied by each layout as `children` (the `(feed)` layout
// passes the global recents widget; the `[username]` layout passes the per-user
// context rail) — this wrapper itself is route-agnostic.
// Side effects: none.

export const RightRail = ({ children }: { children: React.ReactNode }) => {
    return <div className="flex h-full flex-col gap-4 p-3">{children}</div>;
};

export default RightRail;
