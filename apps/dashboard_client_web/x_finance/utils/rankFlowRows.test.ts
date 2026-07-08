// utils/rankFlowRows.test.ts
// Purpose: verify quarter ordering, cell lookup, column ordering,
//   and reference-sort helpers.

import { describe, it, expect } from 'vitest';
import {
    getOrderedPeriods,
    getCell,
    orderColumnByRank,
    sortRowsByReference,
} from '@/utils/rankFlowRows';
import type { RankFlowRow } from '@/types/rankFlow';

const PERIODS = [
    {
        periodOfReport: '2024-03-31',
        totalValueUsd: 1e9,
        remainingCount: 5,
        remainingWeightPct: 3,
    },
    {
        periodOfReport: '2024-12-31',
        totalValueUsd: 2e9,
        remainingCount: 4,
        remainingWeightPct: 2,
    },
    {
        periodOfReport: '2024-06-30',
        totalValueUsd: 1.5e9,
        remainingCount: 6,
        remainingWeightPct: 4,
    },
    {
        periodOfReport: '2024-09-30',
        totalValueUsd: 1.8e9,
        remainingCount: 3,
        remainingWeightPct: 2,
    },
];

describe('getOrderedPeriods', () => {
    it('returns periods newest-first', () => {
        expect(getOrderedPeriods(PERIODS)).toEqual([
            '2024-12-31',
            '2024-09-30',
            '2024-06-30',
            '2024-03-31',
        ]);
    });

    it('respects maxQuarters cap', () => {
        expect(getOrderedPeriods(PERIODS, 2)).toHaveLength(2);
        expect(getOrderedPeriods(PERIODS, 2)[0]).toBe('2024-12-31');
    });

    it('handles empty array', () => {
        expect(getOrderedPeriods([])).toEqual([]);
    });
});

describe('getCell', () => {
    const row: RankFlowRow = {
        cusip: '037833100',
        label: 'Apple Inc.',
        cells: {
            '2024-12-31': {
                rank: 1,
                weightPct: 28.5,
                valueUsd: 55_800_000_000,
            },
            '2024-09-30': null,
        },
    };

    it('returns cell data for present period', () => {
        expect(getCell(row, '2024-12-31')).toEqual({
            rank: 1,
            weightPct: 28.5,
            valueUsd: 55_800_000_000,
        });
    });

    it('returns null for an explicitly null cell', () => {
        expect(getCell(row, '2024-09-30')).toBeNull();
    });

    it('returns null for a missing period', () => {
        expect(getCell(row, '2024-03-31')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Fixtures for new helpers
// ---------------------------------------------------------------------------

const P1 = '2024-12-31';
const P2 = '2024-09-30';
const P3 = '2024-06-30';

const ROWS: RankFlowRow[] = [
    {
        cusip: 'AAA',
        label: 'Alpha Corp',
        cells: {
            [P1]: { rank: 3, weightPct: 10, valueUsd: 1e9 },
            [P2]: { rank: 1, weightPct: 20, valueUsd: 2e9 },
            [P3]: { rank: 2, weightPct: 15, valueUsd: 1.5e9 },
        },
    },
    {
        cusip: 'BBB',
        label: 'Beta Inc',
        cells: {
            [P1]: { rank: 1, weightPct: 25, valueUsd: 3e9 },
            [P2]: { rank: 2, weightPct: 18, valueUsd: 1.8e9 },
            [P3]: null, // not held in P3
        },
    },
    {
        cusip: 'CCC',
        label: 'Gamma Ltd',
        cells: {
            [P1]: { rank: 2, weightPct: 15, valueUsd: 2e9 },
            [P2]: { rank: 3, weightPct: 12, valueUsd: 1.2e9 },
            [P3]: { rank: 1, weightPct: 22, valueUsd: 2.2e9 },
        },
    },
    {
        cusip: 'DDD',
        label: 'Delta Co',
        cells: {
            [P1]: null, // not held in P1
            [P2]: null, // not held in P2
            [P3]: { rank: 3, weightPct: 8, valueUsd: 8e8 },
        },
    },
];

describe('orderColumnByRank', () => {
    it('returns only held rows sorted by rank asc', () => {
        const result = orderColumnByRank(ROWS, P1);
        // BBB=#1, CCC=#2, AAA=#3; DDD is null → excluded
        expect(result.map((r) => r.cusip)).toEqual(['BBB', 'CCC', 'AAA']);
    });

    it('sorts correctly for P2', () => {
        const result = orderColumnByRank(ROWS, P2);
        // AAA=#1, BBB=#2, CCC=#3; DDD null → excluded
        expect(result.map((r) => r.cusip)).toEqual(['AAA', 'BBB', 'CCC']);
    });

    it('excludes null cells — only P3 holders appear', () => {
        const result = orderColumnByRank(ROWS, P3);
        // CCC=#1, AAA=#2, DDD=#3; BBB null → excluded
        expect(result.map((r) => r.cusip)).toEqual(['CCC', 'AAA', 'DDD']);
    });

    it('does not mutate the original rows array', () => {
        const copy = [...ROWS];
        orderColumnByRank(ROWS, P1);
        expect(ROWS).toEqual(copy);
    });
});

describe('sortRowsByReference', () => {
    it('sorts held rows by ref rank asc, unheld pushed to bottom', () => {
        const result = sortRowsByReference(ROWS, P1);
        const cusips = result.map((r) => r.cusip);
        // Held in P1: BBB=#1, CCC=#2, AAA=#3
        // Unheld in P1: DDD (best rank P3=#3)
        expect(cusips).toEqual(['BBB', 'CCC', 'AAA', 'DDD']);
    });

    it('unheld rows sorted by best rank across periods', () => {
        // Use P3 as ref: AAA=#2, CCC=#1, DDD=#3 held; BBB unheld (best=P1#1=1, P2#2=2)
        const result = sortRowsByReference(ROWS, P3);
        const cusips = result.map((r) => r.cusip);
        // Held in P3: CCC=#1, AAA=#2, DDD=#3
        // Unheld: BBB (best rank = 1 from P1)
        expect(cusips).toEqual(['CCC', 'AAA', 'DDD', 'BBB']);
    });

    it('tie-break on cusip when best ranks are equal', () => {
        const tied: RankFlowRow[] = [
            {
                cusip: 'ZZZ',
                label: 'Zeta',
                cells: {
                    [P1]: null,
                    [P2]: { rank: 3, weightPct: 5, valueUsd: 5e8 },
                },
            },
            {
                cusip: 'AAA',
                label: 'Alpha',
                cells: {
                    [P1]: null,
                    [P2]: { rank: 3, weightPct: 5, valueUsd: 5e8 },
                },
            },
        ];
        const result = sortRowsByReference(tied, P1);
        // Both unheld in P1 with same best rank=3; tie-break by cusip lex
        expect(result.map((r) => r.cusip)).toEqual(['AAA', 'ZZZ']);
    });

    it('rows with no cells at all sort after rows with some cells', () => {
        const withEmpty: RankFlowRow[] = [
            {
                cusip: 'MMM',
                label: 'Empty',
                cells: { [P1]: null },
            },
            {
                cusip: 'NNN',
                label: 'HasSome',
                cells: {
                    [P1]: null,
                    [P2]: { rank: 2, weightPct: 8, valueUsd: 8e8 },
                },
            },
        ];
        const result = sortRowsByReference(withEmpty, P1);
        // NNN has bestRank=2 (finite), MMM has bestRank=Infinity
        expect(result.map((r) => r.cusip)).toEqual(['NNN', 'MMM']);
    });

    it('does not mutate the original rows array', () => {
        const copy = ROWS.map((r) => ({ ...r }));
        sortRowsByReference(ROWS, P1);
        expect(ROWS.map((r) => r.cusip)).toEqual(copy.map((r) => r.cusip));
    });
});
