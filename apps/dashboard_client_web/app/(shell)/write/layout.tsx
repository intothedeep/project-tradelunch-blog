// Write screens wear the shared left rail from (shell) (owner, 2026-10-14).
// Main stays full width: the markdown editor brings its own layout.
export default function WriteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <main className="flex min-w-0 flex-1 flex-col">{children}</main>;
}
