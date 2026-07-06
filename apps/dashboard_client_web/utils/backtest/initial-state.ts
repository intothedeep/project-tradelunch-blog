// utils/backtest/initial-state.ts
// Purpose: build the initial shares/cash/contributionDates/xirrFlows state
//          for the engine date-walk. Extracted from engine.ts (X2.3 refactor).
// Invariant: pure function — no I/O, no side effects beyond the returned Maps.

import type { ContributionPlan, Holding, PricePoint } from '@/types/backtest';
import { buildContributionDates } from './contributions';
import { investCash } from './invest';

export interface InitialState {
    shares: Map<string, number>;
    initialAlloc: Map<string, number>;
    cash: number;
    totalContributed: number;
    contributionDates: Set<string>;
    xirrFlows: { date: string; amount: number }[];
}

/**
 * Build the initial mutable state for the backtest date-walk.
 *
 * Performs the lump-sum buy at globalFrom (when budget > 0) and computes the
 * DCA contribution date schedule. Returns all mutable bookkeeping the walk
 * needs in a single value — no mutation escapes this function except via the
 * returned Maps (shares, initialAlloc), which the caller owns.
 */
export function buildInitialState(
    budget: number,
    holdings: Holding[],
    dateIndexes: Map<string, Map<string, PricePoint>>,
    sortedDates: string[],
    globalFrom: string,
    globalTo: string,
    contribution: ContributionPlan | undefined
): InitialState {
    const shares = new Map<string, number>();
    const initialAlloc = new Map<string, number>();
    for (const h of holdings) {
        shares.set(h.label, 0);
        initialAlloc.set(h.label, 0);
    }

    let cash = 0;
    let totalContributed = 0;

    // Lump-sum allocation at globalFrom (skipped for pure-DCA where budget = 0).
    if (budget > 0) {
        cash = investCash(globalFrom, budget, holdings, dateIndexes, shares);
        for (const h of holdings) {
            const alloc = budget * (h.weightPct / 100);
            const bar = dateIndexes.get(h.label)?.get(globalFrom);
            if (bar && bar.close > 0) initialAlloc.set(h.label, alloc);
        }
        totalContributed = budget;
    }

    // Contribution schedule (empty Set when no DCA plan).
    const contributionDates = contribution
        ? new Set(
              buildContributionDates(
                  sortedDates,
                  globalFrom,
                  globalTo,
                  contribution.freq,
                  budget === 0 // includeStart: true only for pure-DCA
              )
          )
        : new Set<string>();

    // XIRR flows (investor perspective: outflows negative, final value positive).
    const xirrFlows: { date: string; amount: number }[] = [];
    if (budget > 0) xirrFlows.push({ date: globalFrom, amount: -budget });

    return {
        shares,
        initialAlloc,
        cash,
        totalContributed,
        contributionDates,
        xirrFlows,
    };
}
