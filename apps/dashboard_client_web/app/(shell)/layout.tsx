import { RailFrame } from '@/components/shell/RailFrame.server';

// Route group `(shell)` (no URL segment): every screen with the global left
// rail renders it here once, so moving between them keeps the rail mounted.
// Deliberately no loading.tsx or not-found.tsx here: either would wrap every
// child segment, and a 404 must reach the root not-found.tsx (no rail).
export default function ShellLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <RailFrame>{children}</RailFrame>;
}
