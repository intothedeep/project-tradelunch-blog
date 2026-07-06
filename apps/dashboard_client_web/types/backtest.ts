// types/backtest.ts
// Purpose: domain types for the asset backtest pure engine (Phase X, X.6).
// No runtime logic — type declarations only.

export type ContributionFreq = 'monthly' | 'yearly';

export interface ContributionPlan {
    amount: number; // USD per period
    freq: ContributionFreq;
}

export interface PricePoint {
    date: string; // 'YYYY-MM-DD', ascending
    close: number; // SPLIT-ADJUSTED close (Yahoo adjusts OHLC for splits at source)
    dividends: number; // RAW per-share cash dividend as paid (NOT baked into close);
    // engine rebases it onto the split-adjusted basis (see splitAdjustDividends)
    stockSplits: number; // split ratio on this bar; used only to rebase dividends
}

/**
 * Where to route dividend proceeds for a given holding.
 *   'same'  — reinvest into the same asset (classic DRIP)
 *   'cash'  — accumulate as cash
 *   'asset' — reinvest into a different selected asset (e.g. JEPQ → VOO)
 */
export type DividendRoute =
    | { kind: 'same' }
    | { kind: 'cash' }
    | { kind: 'asset'; target: string };

export interface Holding {
    label: string;
    weightPct: number; // 0–100
    /** @deprecated Use dividendRoute instead. Kept for legacy URL decode only. */
    drip?: boolean;
    /** Explicit routing descriptor. Takes precedence over drip. Defaults to cash. */
    dividendRoute?: DividendRoute;
}

export interface BacktestInput {
    budget: number; // initial lump-sum, USD (0 for pure-DCA)
    holdings: Holding[];
    seriesByLabel: Record<string, PricePoint[]>; // label → sorted ascending
    range: { from: string; to: string }; // 'YYYY-MM-DD'
    seed: number; // deterministic Monte Carlo seed (store in URL-state)
    riskFreeRate: number; // annual fraction, e.g. 0.045
    contribution?: ContributionPlan; // undefined → lump-sum path unchanged
}

export interface BacktestMetrics {
    finalValue: number;
    totalReturnPct: number; // (finalValue − totalContributed) / totalContributed
    cagr: number; // annual fraction (time-weighted)
    maxDrawdown: number; // negative fraction, e.g. -0.35
    volatility: number; // annualised stdev of daily returns (flow-corrected)
    sharpe: number | null; // null when volatility = 0 (guard divide-by-zero)
    cumulativeDividends: number; // total cash dividends received (DRIP value included)
    totalContributed: number; // budget + Σ contributions; lump-only ⇒ equals budget
    moneyWeightedReturn: number | null; // XIRR; null when no contributions
}

export interface DividendEvent {
    date: string;
    label: string; // source asset (dividend attributed here regardless of route)
    perShare: number; // yfinance per-share amount
    cash: number; // actual cash received; 0 if reinvested (DRIP or cross-asset)
    /** Where the proceeds went. 'cash' | '<target label>' | undefined (same-asset). */
    routedTo?: string;
}

export interface DividendSummary {
    byLabel: Record<string, number>; // total dividend value per label
    total: number;
    schedule: DividendEvent[];
}

export interface ProjectionResult {
    cagrCurve: { date: string; value: number }[]; // monthly, 10y forward
    monteCarlo: { date: string; p10: number; p50: number; p90: number }[]; // monthly, 10y
    income: {
        annualYieldPct: number; // realised distribution yield, annualised
        projectedAnnualCash: number;
        projectedMonthlyCash: number;
    };
}

export interface PerHoldingResult {
    label: string;
    shares: number; // final share count (post-split, post-DRIP)
    finalValue: number;
    totalReturnPct: number; // fraction relative to allocated budget
    dividendsReceived: number; // total dividend value (cash + DRIP reinvested)
}

export interface BacktestResult {
    timeline: { date: string; value: number }[];
    metrics: BacktestMetrics;
    perHolding: PerHoldingResult[];
    dividends: DividendSummary;
    projection: ProjectionResult;
    /** Net external inflow per date (DCA contributions). Absent for lump-sum. */
    flowsByDate?: Record<string, number>;
}
