// components/symbols/PoliticianDisclaimer.tsx
// Purpose: Shared STOCK Act disclaimer + coverage footnote copy. Rendered as a
//   Server Component (no interactivity). Used by ScreenerTable and the screener
//   page footer so the exact legal copy stays in one place.
// Invariants: no props; static copy only. Always visible — not tooltip-only.
// Side effects: none.

export function PoliticianDisclaimer() {
    return (
        <div className="mt-3 space-y-1">
            <p className="text-xs leading-relaxed text-muted-foreground">
                Disclosed under the STOCK Act. Trades are reported 30&ndash;90+
                days after they occur &mdash; these are past disclosures, not
                current positions or live trades. Amounts are broad ranges.
                Shown for transparency &mdash; not investment advice, and not a
                claim these trades outperform.
            </p>
            <p className="text-xs text-muted-foreground">
                U.S. House + Senate + executive-branch (OGE&nbsp;278-T) filers.
                Diversified mutual funds, U.S. Treasuries, and real estate are
                disclosure-exempt.
            </p>
        </div>
    );
}
