// components/funds/FundList.tsx
// Purpose: server-rendered fund rail listing funds as navigation links.
//   Each row shows fund label, period of report, and holdings count.
//   The active fund (activeCik) is highlighted visually.
// Constraints: server component — no client hooks. Links to /funds/[cik].
// Side effects: none.

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Fund } from '@/types/funds';

interface FundListProps {
    funds: Fund[];
    activeCik?: string;
}

export default function FundList({ funds, activeCik }: FundListProps) {
    return (
        <nav aria-label="Fund list">
            <ul className="space-y-1">
                {funds.map((fund) => {
                    const isActive = fund.cik === activeCik;
                    return (
                        <li key={fund.cik}>
                            <Link
                                href={`/funds/${fund.cik}`}
                                className={cn(
                                    'block rounded-md px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-muted font-semibold text-foreground'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                )}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <span className="block truncate font-medium">
                                    {fund.label}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    {fund.periodOfReport} &middot;{' '}
                                    {fund.holdingsCount.toLocaleString()}{' '}
                                    holdings
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
