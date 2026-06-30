// utils/quarterLabel.test.ts
// Purpose: verify quarterLabel mapping and sort order are stable.

import { describe, it, expect } from 'vitest';
import { quarterLabel, sortPeriodsNewestFirst } from '@/utils/quarterLabel';

describe('quarterLabel', () => {
    it('maps 03-31 → Q1', () => {
        expect(quarterLabel('2024-03-31')).toBe('2024 Q1');
    });

    it('maps 06-30 → Q2', () => {
        expect(quarterLabel('2024-06-30')).toBe('2024 Q2');
    });

    it('maps 09-30 → Q3', () => {
        expect(quarterLabel('2024-09-30')).toBe('2024 Q3');
    });

    it('maps 12-31 → Q4', () => {
        expect(quarterLabel('2024-12-31')).toBe('2024 Q4');
    });

    it('returns QX for unknown month', () => {
        expect(quarterLabel('2024-07-15')).toBe('2024 QX');
    });

    it('returns input unchanged when no dash separator present', () => {
        // A string with no '-' produces parts.length < 2 → returns as-is.
        expect(quarterLabel('nodashhere')).toBe('nodashhere');
    });
});

describe('sortPeriodsNewestFirst', () => {
    it('sorts newest first', () => {
        const input = ['2024-03-31', '2024-12-31', '2024-06-30', '2024-09-30'];
        expect(sortPeriodsNewestFirst(input)).toEqual([
            '2024-12-31',
            '2024-09-30',
            '2024-06-30',
            '2024-03-31',
        ]);
    });

    it('sorts across years', () => {
        const input = ['2023-12-31', '2024-12-31', '2024-03-31'];
        expect(sortPeriodsNewestFirst(input)).toEqual([
            '2024-12-31',
            '2024-03-31',
            '2023-12-31',
        ]);
    });

    it('does not mutate input', () => {
        const input = ['2024-03-31', '2024-12-31'];
        const original = [...input];
        sortPeriodsNewestFirst(input);
        expect(input).toEqual(original);
    });

    it('handles empty array', () => {
        expect(sortPeriodsNewestFirst([])).toEqual([]);
    });
});
