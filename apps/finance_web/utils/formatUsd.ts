// utils/formatUsd.ts
// Purpose: compact USD formatter for large monetary values (fund holdings).
// Invariant: pure function — deterministic, no side effects, no hidden state.
//   Thresholds: ≥1B → "$X.XXB", ≥1M → "$X.XM", else full Intl format.
//   Zero returns "$0".

const BILLION = 1_000_000_000;
const MILLION = 1_000_000;

/**
 * Formats a USD value compactly.
 * Examples: 1.23e9 → "$1.23B", 4.56e7 → "$45.6M", 12345 → "$12,345", 0 → "$0"
 */
export function formatUsd(value: number): string {
    if (value === 0) return '$0';

    if (Math.abs(value) >= BILLION) {
        const billions = value / BILLION;
        return `$${billions.toFixed(2)}B`;
    }

    if (Math.abs(value) >= MILLION) {
        const millions = value / MILLION;
        return `$${millions.toFixed(1)}M`;
    }

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}
