// utils/backtest/rebalance-schedule.test.ts
// Unit tests for isRebalanceDue (X2.4).

import { describe, expect, it } from 'vitest';
import { isRebalanceDue } from './rebalance-schedule';

describe('isRebalanceDue', () => {
    describe('never', () => {
        it('returns false regardless of dates', () => {
            expect(isRebalanceDue('never', null, '2024-01-02')).toBe(false);
            expect(isRebalanceDue('never', '2024-01-01', '2024-02-01')).toBe(
                false
            );
        });
    });

    describe('bar', () => {
        it('returns true always', () => {
            expect(isRebalanceDue('bar', null, '2024-01-02')).toBe(true);
            expect(isRebalanceDue('bar', '2024-01-01', '2024-01-02')).toBe(
                true
            );
        });
    });

    describe('monthly', () => {
        it('first bar (null prev) returns true', () => {
            expect(isRebalanceDue('monthly', null, '2024-01-15')).toBe(true);
        });

        it('same month returns false', () => {
            expect(isRebalanceDue('monthly', '2024-01-10', '2024-01-20')).toBe(
                false
            );
        });

        it('new month returns true', () => {
            expect(isRebalanceDue('monthly', '2024-01-31', '2024-02-01')).toBe(
                true
            );
        });

        it('new year (also new month) returns true', () => {
            expect(isRebalanceDue('monthly', '2023-12-29', '2024-01-02')).toBe(
                true
            );
        });

        it('deterministic', () => {
            const a = isRebalanceDue('monthly', '2024-03-15', '2024-04-01');
            const b = isRebalanceDue('monthly', '2024-03-15', '2024-04-01');
            expect(a).toBe(b);
        });
    });

    describe('quarterly', () => {
        it('first bar (null prev) returns true', () => {
            expect(isRebalanceDue('quarterly', null, '2024-01-02')).toBe(true);
        });

        it('same quarter returns false', () => {
            // Jan and Feb are both Q1
            expect(
                isRebalanceDue('quarterly', '2024-01-15', '2024-02-10')
            ).toBe(false);
        });

        it('new quarter returns true', () => {
            // Q1→Q2: Mar→Apr
            expect(
                isRebalanceDue('quarterly', '2024-03-29', '2024-04-01')
            ).toBe(true);
        });

        it('Q2→Q3 returns true', () => {
            expect(
                isRebalanceDue('quarterly', '2024-06-28', '2024-07-01')
            ).toBe(true);
        });

        it('Q3→Q4 returns true', () => {
            expect(
                isRebalanceDue('quarterly', '2024-09-30', '2024-10-01')
            ).toBe(true);
        });

        it('Q4→Q1 next year returns true', () => {
            expect(
                isRebalanceDue('quarterly', '2024-12-31', '2025-01-02')
            ).toBe(true);
        });
    });

    describe('yearly', () => {
        it('first bar (null prev) returns true', () => {
            expect(isRebalanceDue('yearly', null, '2024-01-02')).toBe(true);
        });

        it('same year returns false', () => {
            expect(isRebalanceDue('yearly', '2024-01-02', '2024-06-15')).toBe(
                false
            );
        });

        it('new year returns true', () => {
            expect(isRebalanceDue('yearly', '2024-12-31', '2025-01-02')).toBe(
                true
            );
        });
    });
});
