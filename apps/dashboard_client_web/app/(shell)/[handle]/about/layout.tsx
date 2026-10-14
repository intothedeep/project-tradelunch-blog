// The owner's About page wears the global left rail from the `(shell)` layout.
// It deliberately does NOT use ContentFrame: that caps its main column at
// max-w-3xl, but the portfolio (TerminalProfile) is a wide, multi-column layout
// that brings its own `container`, so main here is full-width. The top bar comes
// from the root layout (CustomNavigation); the right rail is intentionally omitted.
export default function AboutLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <main className="flex min-w-0 flex-1 flex-col">{children}</main>;
}
