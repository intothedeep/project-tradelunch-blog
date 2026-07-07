'use client';

// components/backtest/DividendRouteSelect.client.tsx
// Purpose: per-asset dividend routing selector (XE.2 replacement for DripToggle).
// Options: "Reinvest (same)" / "Cash" / one entry per other selected asset.
// Replaces DripToggle (boolean) with a three-way routing control.

import type { DividendRoute, Holding } from '@/types/backtest';

interface DividendRouteSelectProps {
    label: string;
    route: DividendRoute;
    /** Other holdings in the portfolio (excluding this asset). */
    otherHoldings: Holding[];
    onChange: (label: string, route: DividendRoute) => void;
}

function routeToValue(route: DividendRoute): string {
    if (route.kind === 'same') return 'same';
    if (route.kind === 'cash') return 'cash';
    return route.target;
}

function valueToRoute(val: string): DividendRoute {
    if (val === 'same') return { kind: 'same' };
    if (val === 'cash') return { kind: 'cash' };
    return { kind: 'asset', target: val };
}

export default function DividendRouteSelect({
    label,
    route,
    otherHoldings,
    onChange,
}: DividendRouteSelectProps) {
    function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        onChange(label, valueToRoute(e.target.value));
    }

    return (
        <select
            value={routeToValue(route)}
            onChange={handleChange}
            aria-label={`${label} dividend routing`}
            title="Dividend routing — where dividends are reinvested"
            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
            <option value="same">DRIP (self)</option>
            <option value="cash">Cash</option>
            {otherHoldings.map((h) => (
                <option
                    key={h.label}
                    value={h.label}
                >
                    → {h.label}
                </option>
            ))}
        </select>
    );
}
