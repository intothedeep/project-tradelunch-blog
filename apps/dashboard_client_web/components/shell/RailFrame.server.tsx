import { LeftRailAside } from '@/components/shell/LeftRailAside.client';
import { LeftRailContainer } from '@/components/rail/LeftRailContainer.server';

// Purpose: the one place the global left rail renders, called from the
// `(shell)` route-group layout. Children are the page column(s) beside the
// rail: ContentFrame (main + optional right rail) or a bare full-width <main>.
// Reads no request data: the rail width comes from `<html data-rail>` via CSS.
export const RailFrame = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen flex-col bg-background font-mono">
        <div className="flex w-full flex-1">
            <LeftRailAside>
                <LeftRailContainer />
            </LeftRailAside>
            {children}
        </div>
    </div>
);

export default RailFrame;
