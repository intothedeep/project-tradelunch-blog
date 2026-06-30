// utils/rankFlowRows.test.ts
// Purpose: verify quarter ordering and cell lookup helpers.

import { describe, it, expect } from 'vitest';
import { getOrderedPeriods, getCell } from '@/utils/rankFlowRows';
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
