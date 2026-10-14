// Same as About: the global left rail comes from the `(shell)` layout, and no
// ContentFrame (its max-w-3xl cap would squeeze the A4 resume and ResumeTOC).
// Main is full-width and min-w-0 so the page's own `container` shrinks beside
// the rail instead of overflowing.
export default function ResumeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <main className="flex min-w-0 flex-1 flex-col">{children}</main>;
}
