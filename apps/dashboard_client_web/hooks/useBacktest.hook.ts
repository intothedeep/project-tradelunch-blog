'use client';

// hooks/useBacktest.hook.ts
// Purpose: thin wrapper that runs the pure backtest engine inside useMemo.
// Callers get a deterministic BacktestResult whenever inputs change.
// runBacktest is CPU-synchronous (~1ms for <1,000 bars); no async needed.
// `ready` must be true (seed persisted to URL) before the engine runs, so
// that the Monte Carlo fan is reproducible on page reload.

import { useMemo } from 'react';
import { runBacktest } from '@/utils/backtest/engine';
import type { BacktestInput, BacktestResult } from '@/types/backtest';

export function useBacktest(
    input: BacktestInput | null,
    ready: boolean
): BacktestResult | null {
    return useMemo(() => {
        if (!ready || !input) return null;
        if (input.holdings.length === 0) return null;
        if (Object.keys(input.seriesByLabel).length === 0) return null;
        return runBacktest(input);
    }, [input, ready]);
}
