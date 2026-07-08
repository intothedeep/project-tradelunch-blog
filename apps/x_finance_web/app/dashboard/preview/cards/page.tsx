import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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

function ItemCard({ item }: { item: IDashboardItem | IStockItem }) {
    const isPositive = item.change.percent >= 0;
    const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
    const Arrow = isPositive ? TrendingUp : TrendingDown;

    return (
        <div className="rounded-lg border bg-card p-3 flex flex-col gap-1 min-w-0">
            <span className="text-xs text-muted-foreground truncate">
                {item.label}
            </span>
            <span className="text-lg font-semibold tabular-nums truncate">
                {formatValue(item.value)}
            </span>
            <span
                className={cn(
                    'flex items-center gap-1 text-xs font-medium',
                    changeColor
                )}
            >
                <Arrow
                    className="h-3 w-3 shrink-0"
                    aria-hidden="true"
                />
                {formatPercent(item.change.percent)}
            </span>
        </div>
    );
}

function CategorySection({
    heading,
    items,
}: {
    heading: string;
    items: (IDashboardItem | IStockItem)[];
}) {
    return (
        <section className="mb-8">
            <h2 className="text-base font-semibold mb-3">{heading}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {items.map((item) => (
                    <ItemCard
                        key={item.label}
                        item={item}
                    />
                ))}
            </div>
        </section>
    );
}

export default function CardsPreviewPage() {
    const snap = MOCK_DASHBOARD_SNAPSHOT;

    return (
        <main className="p-4 md:p-8 max-w-screen-xl mx-auto">
            <h1 className="text-2xl font-bold tracking-tight mb-6">
                Dashboard preview — Cards (Variant A)
            </h1>

            <CategorySection
                heading="FX"
                items={snap.fx.items}
            />
            <CategorySection
                heading="Crypto"
                items={snap.crypto.items}
            />
            <CategorySection
                heading="Indices"
                items={snap.indices.items}
            />
            <CategorySection
                heading="Interest Rates"
                items={snap.rates.items}
            />
            <CategorySection
                heading="Stocks"
                items={snap.stocks.items}
            />
        </main>
    );
}
