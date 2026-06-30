// components/funds/HoldingsTable.tsx
// Purpose: server-rendered table of 13F holdings for a single fund.
//   Columns: Issuer, CUSIP, Class, Ticker, Shares, Value (USD), Weight (%).
//   PUT/CALL options get a distinct badge when putCall is non-empty.
// Constraints: server component — no client hooks. Uses shadcn table + badge.
// Side effects: none.

import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatUsd } from '@/utils/formatUsd';
import type { Holding } from '@/types/funds';

interface HoldingsTableProps {
    holdings: Holding[];
}

function PutCallBadge({ putCall }: { putCall: string }) {
    if (!putCall) return null;
    const isPut = putCall.toUpperCase() === 'PUT';
    return (
        <Badge
            variant={isPut ? 'destructive' : 'default'}
            className="ml-1 text-xs"
        >
            {putCall.toUpperCase()}
        </Badge>
    );
}

function formatShares(holding: Holding): string {
    if (holding.shares === null) return '—';
    const formatted = new Intl.NumberFormat('en-US').format(holding.shares);
    return holding.prnType ? `${formatted} ${holding.prnType}` : formatted;
}

export default function HoldingsTable({ holdings }: HoldingsTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Issuer</TableHead>
                    <TableHead>CUSIP</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {holdings.map((holding) => (
                    <TableRow
                        key={`${holding.cusip}-${holding.putCall}-${holding.prnType}`}
                    >
                        <TableCell className="font-medium">
                            {holding.nameOfIssuer}
                            <PutCallBadge putCall={holding.putCall} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                            {holding.cusip}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                            {holding.titleOfClass ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                            {holding.ticker ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                            {formatShares(holding)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                            {formatUsd(holding.valueUsd)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                            {holding.weightPct.toFixed(2)}%
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
