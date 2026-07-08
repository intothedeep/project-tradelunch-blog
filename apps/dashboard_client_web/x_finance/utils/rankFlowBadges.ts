// utils/rankFlowBadges.ts
// Purpose: derive per-cell rank-flow badges (NEW / EXIT / ▲▼ / Δweight) for one
//   RankFlowRow, comparing each period to the ADJACENT OLDER period shown.
// Invariant: periodKeys are NEWEST-FIRST (mirrors RankFlow.periods order). The
//   oldest shown column has no visible prior, so its badges are suppressed —
//   never render "NEW" for the first column (prior is unknown, not absent).
// Side effects: none (pure).

import type { RankFlowCell, RankFlowRow } from '@/types/rankFlow';

export interface CellBadge {
    isNew: boolean; // held now, absent in the prior (older) shown quarter
    isExit: boolean; // absent now, held in the prior (older) shown quarter
    rankDelta: number | null; // prior.rank - cur.rank (>0 = moved UP), null if either side missing
    weightDelta: number | null; // cur.weightPct - prior.weightPct, null if either side missing
}

const EMPTY: CellBadge = {
    isNew: false,
    isExit: false,
    rankDelta: null,
    weightDelta: null,
};

/**
 * Compute a CellBadge per period key for a single row.
 *
 * @param row        the rank-flow row (cusip + per-period cells).
 * @param periodKeys period keys NEWEST-FIRST (RankFlow.periods.map(p => p.periodOfReport)).
 * @returns          map periodKey -> CellBadge. The oldest key maps to EMPTY.
 */
export function deriveCellBadges(
    row: RankFlowRow,
    periodKeys: string[]
): Record<string, CellBadge> {
    const out: Record<string, CellBadge> = {};
    for (const [i, key] of periodKeys.entries()) {
        const cur: RankFlowCell | null = row.cells[key] ?? null;
        const priorKey = periodKeys[i + 1]; // older column (newest-first order)
        if (priorKey === undefined) {
            // Oldest shown column: prior is unknown, not absent — suppress badges.
            out[key] = EMPTY;
            continue;
        }
        const prior: RankFlowCell | null = row.cells[priorKey] ?? null;
        out[key] = {
            isNew: cur !== null && prior === null,
            isExit: cur === null && prior !== null,
            rankDelta: cur && prior ? prior.rank - cur.rank : null,
            weightDelta: cur && prior ? cur.weightPct - prior.weightPct : null,
        };
    }
    return out;
}
