// components/backtest/DividendTable.tsx
// Purpose: per-payout dividend schedule table + per-asset totals.
// Shows "no dividends in range" when the schedule is empty.

import type { DividendSummary } from '@/types/backtest';

interface DividendTableProps {
    dividends: DividendSummary;
}

function fmt$(v: number): string {
    return v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    });
}

export default function DividendTable({ dividends }: DividendTableProps) {
    const { schedule, byLabel, total } = dividends;

    if (schedule.length === 0) {
        return (
            <section aria-label="Dividend schedule">
                <h2 className="text-sm font-semibold mb-2">Dividends</h2>
                <p className="text-sm text-muted-foreground">
                    No dividends recorded in this date range.
                </p>
            </section>
        );
    }

    const labels = Object.keys(byLabel);

    return (
        <section aria-label="Dividend schedule">
            <h2 className="text-sm font-semibold mb-2">
                Dividends — Total {fmt$(total)}
            </h2>

            {/* Per-asset totals */}
            <div className="mb-3 flex flex-wrap gap-3">
                {labels.map((lbl) => (
                    <span
                        key={lbl}
                        className="text-xs rounded border px-2 py-1 font-mono"
                    >
                        {lbl}: {fmt$(byLabel[lbl] ?? 0)}
                    </span>
                ))}
            </div>

            {/* Schedule table */}
            <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Asset</th>
                            <th className="px-3 py-2 text-right">Per Share</th>
                            <th className="px-3 py-2 text-right">Cash</th>
                            <th className="px-3 py-2 text-left">Mode</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schedule.map((ev, i) => (
                            <tr
                                key={i}
                                className="border-t"
                            >
                                <td className="px-3 py-1.5 font-mono">
                                    {ev.date}
                                </td>
                                <td className="px-3 py-1.5 font-mono">
                                    {ev.label}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                    {fmt$(ev.perShare)}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                    {ev.cash > 0 ? fmt$(ev.cash) : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-xs text-muted-foreground">
                                    {ev.cash === 0 ? 'DRIP' : 'Cash'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
