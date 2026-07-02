import { describe, it, expect } from 'vitest';

import { deriveCellBadges } from '@/utils/rankFlowBadges';
import type { RankFlowRow } from '@/types/rankFlow';

// periodKeys are newest-first, matching RankFlow.periods order.
const KEYS = ['2026-03-31', '2025-12-31', '2025-09-30'];

function cell(rank: number, weightPct: number) {
    return { rank, weightPct, valueUsd: rank * 1000 };
}

describe('deriveCellBadges', () => {
    it('flags NEW when held now but absent in the prior (older) column', () => {
        const row: RankFlowRow = {
            cusip: 'A',
            label: 'A',
            cells: { '2026-03-31': cell(1, 10), '2025-12-31': null, '2025-09-30': null },
        };
        const badges = deriveCellBadges(row, KEYS);
        expect(badges['2026-03-31']!.isNew).toBe(true);
        expect(badges['2026-03-31']!.isExit).toBe(false);
    });

    it('flags EXIT when absent now but held in the prior column', () => {
        const row: RankFlowRow = {
            cusip: 'A',
            label: 'A',
            cells: { '2026-03-31': null, '2025-12-31': cell(2, 5), '2025-09-30': cell(2, 5) },
        };
        const badges = deriveCellBadges(row, KEYS);
        expect(badges['2026-03-31']!.isExit).toBe(true);
        expect(badges['2026-03-31']!.isNew).toBe(false);
    });

    it('computes rankDelta (>0 = moved up) and weightDelta', () => {
        const row: RankFlowRow = {
            cusip: 'A',
            label: 'A',
            cells: { '2026-03-31': cell(1, 12), '2025-12-31': cell(3, 8), '2025-09-30': cell(3, 8) },
        };
        const badges = deriveCellBadges(row, KEYS);
        expect(badges['2026-03-31']!.rankDelta).toBe(2); // 3 - 1 = up 2
        expect(badges['2026-03-31']!.weightDelta).toBeCloseTo(4); // 12 - 8
    });

    it('suppresses badges on the OLDEST shown column (prior unknown)', () => {
        const row: RankFlowRow = {
            cusip: 'A',
            label: 'A',
            cells: { '2026-03-31': cell(1, 10), '2025-12-31': cell(1, 10), '2025-09-30': cell(1, 10) },
        };
        const badges = deriveCellBadges(row, KEYS);
        expect(badges['2025-09-30']).toEqual({
            isNew: false,
            isExit: false,
            rankDelta: null,
            weightDelta: null,
        });
    });

    it('null on both sides yields null deltas, no NEW/EXIT', () => {
        const row: RankFlowRow = {
            cusip: 'A',
            label: 'A',
            cells: { '2026-03-31': null, '2025-12-31': null, '2025-09-30': null },
        };
        const badges = deriveCellBadges(row, KEYS);
        expect(badges['2026-03-31']).toEqual({
            isNew: false,
            isExit: false,
            rankDelta: null,
            weightDelta: null,
        });
    });

    it('single-column input suppresses all badges', () => {
        const row: RankFlowRow = { cusip: 'A', label: 'A', cells: { '2026-03-31': cell(1, 10) } };
        const badges = deriveCellBadges(row, ['2026-03-31']);
        expect(badges['2026-03-31']).toEqual(EMPTY_EXPECT);
    });
});

const EMPTY_EXPECT = { isNew: false, isExit: false, rankDelta: null, weightDelta: null };
