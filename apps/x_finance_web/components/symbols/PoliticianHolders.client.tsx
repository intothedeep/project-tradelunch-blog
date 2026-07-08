// components/symbols/PoliticianHolders.client.tsx
// Purpose: Per-ticker table of politicians who disclosed PTR transactions (migration 0023).
// Invariants:
//   - PTR = transactions (STOCK Act disclosures), NEVER holdings or positions.
//   - Column headers use honest labels:
//       sharePctOfFilerVolume → "% of disclosed volume"
//       rankInFilerVolume     → "#N of M disclosed tickers"
//   - disclosedValueBand is a band string (e.g. "$50K–$250K") — rendered as-is,
//     NEVER parsed or presented as a precise dollar amount.
//   - Party/chamber chips are neutral (grey/outline), never red/green good/bad.
//   - NEVER renders: held / own / position / portfolio language.
//   - Renders nothing when politicianHolders is absent or empty.
//   - PoliticianDisclaimer always visible when the table is shown.
// Side effects: none (no fetch, no state).

'use client';

import Link from 'next/link';
import type { SymbolPoliticianHolder } from '@/types/symbolDetail';
import { PoliticianDisclaimer } from '@/components/symbols/PoliticianDisclaimer';

interface Props {
    politicianHolders: SymbolPoliticianHolder[];
}

function directionLabel(d: SymbolPoliticianHolder['netDirection']): string {
    if (d === 'buy_skew') return 'buy-skew';
    if (d === 'sell_skew') return 'sell-skew';
    return 'mixed';
}

function PartyChip({ party }: { party: string | null }) {
    if (!party) return null;
    return (
        <span className="ml-1 inline-flex items-center rounded border border-border px-1 py-0.5 text-[10px] text-muted-foreground">
            {party}
        </span>
    );
}

export function PoliticianHolders({ politicianHolders }: Props) {
    if (politicianHolders.length === 0) return null;

    return (
        <section aria-label="Politician transaction disclosures">
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground">
                            <th className="px-4 py-3 text-left font-medium">
                                Politician
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Disclosed&nbsp;amount
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                % of disclosed&nbsp;transaction&nbsp;volume
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Rank&nbsp;(disclosed&nbsp;tickers)
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Direction
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                                Latest&nbsp;disclosure
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {politicianHolders.map((h) => (
                            <tr
                                key={h.filerId}
                                className="border-b last:border-0 hover:bg-muted/30"
                            >
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/politicians/${h.filerId}`}
                                        className="font-medium underline-offset-4 hover:underline"
                                    >
                                        {h.filerName}
                                    </Link>
                                    <PartyChip party={h.party} />
                                    {h.chamber && (
                                        <span className="ml-1 inline-flex items-center rounded border border-border px-1 py-0.5 text-[10px] text-muted-foreground">
                                            {h.chamber}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {h.disclosedValueBand}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {h.sharePctOfFilerVolume !== null
                                        ? `${h.sharePctOfFilerVolume.toFixed(1)}%`
                                        : '—'}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {h.rankInFilerVolume !== null &&
                                    h.totalTickerCount !== null
                                        ? `#${h.rankInFilerVolume} of ${h.totalTickerCount}`
                                        : h.rankInFilerVolume !== null
                                          ? `#${h.rankInFilerVolume}`
                                          : '—'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                        {directionLabel(h.netDirection)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                    {h.latestDisclosure}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <PoliticianDisclaimer />
        </section>
    );
}
