// components/rankings/RankingsTable.tsx
// Purpose: server-rendered table for one weekly ranking slice (global or a
//   single sector). Columns: rank, symbol, sector (global scope only), market cap.
// Constraints: server component — no client hooks. Pure presentation.
// Side effects: none.

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { RankingEntry, RankingScope } from '@/types/rankings';

interface RankingsTableProps {
    rows: RankingEntry[];
    scope: RankingScope;
}

// Pure: compact USD market-cap label ($1.23T / $45.6B / $789M). Null → em dash.
function formatMarketCap(value: number | null): string {
    if (value === null) return '—';
    const abs = Math.abs(value);
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toLocaleString()}`;
}

export default function RankingsTable({ rows, scope }: RankingsTableProps) {
    const showSector = scope === 'global';

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Symbol</TableHead>
                    {showSector && <TableHead>Sector</TableHead>}
                    <TableHead className="text-right">Market Cap</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow key={`${row.rank}-${row.symbol}`}>
                        <TableCell className="text-muted-foreground tabular-nums">
                            {row.rank}
                        </TableCell>
                        <TableCell>
                            <span className="block font-medium font-mono">
                                {row.symbol}
                            </span>
                            {row.name && row.name !== row.symbol && (
                                <span className="block truncate text-xs text-muted-foreground">
                                    {row.name}
                                </span>
                            )}
                        </TableCell>
                        {showSector && (
                            <TableCell className="text-muted-foreground">
                                {row.sector ?? '—'}
                            </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums">
                            {formatMarketCap(row.marketCap)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
