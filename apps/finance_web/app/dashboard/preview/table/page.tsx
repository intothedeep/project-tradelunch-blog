import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
} from '@/components/ui/table';
import { MOCK_DASHBOARD_SNAPSHOT } from '@/apis/getDashboardSnapshot.mock.api';
import type { IDashboardItem, IStockItem } from '@/types/dashboard';

function formatValue(value: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    }).format(value);
}

function formatPercent(percent: number): string {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
}

function ChangeCell({ change }: { change: IDashboardItem['change'] }) {
    const isPositive = change.percent >= 0;
    const color = isPositive ? 'text-green-600' : 'text-red-600';
    const Arrow = isPositive ? TrendingUp : TrendingDown;

    return (
        <span className={cn('flex items-center gap-1 font-medium', color)}>
            <Arrow
                className="h-3 w-3 shrink-0"
                aria-hidden="true"
            />
            {formatPercent(change.percent)}
        </span>
    );
}

function CategoryTable({
    heading,
    items,
}: {
    heading: string;
    items: (IDashboardItem | IStockItem)[];
}) {
    return (
        <section className="mb-8">
            <h2 className="text-base font-semibold mb-3">{heading}</h2>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Change %</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRow key={item.label}>
                            <TableCell>{item.label}</TableCell>
                            <TableCell className="text-right tabular-nums">
                                {formatValue(item.value)}
                            </TableCell>
                            <TableCell className="text-right">
                                <ChangeCell change={item.change} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </section>
    );
}

export default function TablePreviewPage() {
    const snap = MOCK_DASHBOARD_SNAPSHOT;

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight mb-6">
                Dashboard preview — Table (Variant B)
            </h1>

            <CategoryTable
                heading="FX"
                items={snap.fx.items}
            />
            <CategoryTable
                heading="Crypto"
                items={snap.crypto.items}
            />
            <CategoryTable
                heading="Indices"
                items={snap.indices.items}
            />
            <CategoryTable
                heading="Interest Rates"
                items={snap.rates.items}
            />
            <CategoryTable
                heading="Stocks"
                items={snap.stocks.items}
            />
        </main>
    );
}
