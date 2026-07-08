// utils/quarterLabel.ts
// Purpose: derives a human-readable quarter label from a period_of_report date.
// Invariant: pure function — deterministic, no side effects.
//   Input format: 'YYYY-MM-DD' (ISO date string from 13F filing).
//   MM mapping: 03→Q1, 06→Q2, 09→Q3, 12→Q4.
//   Unknown month returns 'QX' as a safe fallback — never throws.
// Side effects: none.

const MONTH_TO_QUARTER: Record<string, string> = {
    '03': 'Q1',
    '06': 'Q2',
    '09': 'Q3',
    '12': 'Q4',
};

/**
 * Returns a compact quarter label for a period_of_report date.
 * Example: '2024-09-30' → '2024 Q3'
 */
export function quarterLabel(periodOfReport: string): string {
    // Expected format: YYYY-MM-DD
    const parts = periodOfReport.split('-');
    if (parts.length < 2) return periodOfReport;
    const year = parts[0] ?? '';
    const month = parts[1] ?? '';
    const quarter = MONTH_TO_QUARTER[month] ?? 'QX';
    return `${year} ${quarter}`;
}

/**
 * Sorts period strings (YYYY-MM-DD) newest-first.
 * Pure comparator — safe for Array.prototype.sort.
 */
export function sortPeriodsNewestFirst(periods: string[]): string[] {
    return [...periods].sort((a, b) => b.localeCompare(a));
}
