// utils/backtest/dateAdd.ts
// Purpose: UTC-safe date arithmetic helpers shared by projection and contributions.
// Invariant: pure functions — deterministic, no I/O, no side effects.

/**
 * Returns a 'YYYY-MM-DD' string for `months` months after `date`.
 * Uses UTC to avoid daylight-saving cliff artifacts.
 */
export function addMonths(date: string, months: number): string {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
}

/**
 * Returns a 'YYYY-MM-DD' string for `years` years after `date`.
 */
export function addYears(date: string, years: number): string {
    return addMonths(date, years * 12);
}
