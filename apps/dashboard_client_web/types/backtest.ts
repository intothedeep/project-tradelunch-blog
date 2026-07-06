// types/backtest.ts
// Purpose: domain types for the asset backtest pure engine (Phase X, X.6).
// No runtime logic — type declarations only.

export interface PricePoint {
    date: string; // 'YYYY-MM-DD', ascending
    close: number;
    dividends: number;
    stockSplits: number;
}

export interface Holding {
    label: string;
    weightPct: number; // 0–100
    drip: boolean; // per-asset dividend reinvestment toggle
}

export interface BacktestInput {
    budget: number; // initial lump-sum, USD
    holdings: Holding[];
    seriesByLabel: Record<string, PricePoint[]>; // label → sorted ascending
    range: { from: string; to: string }; // 'YYYY-MM-DD'
    seed: number; // deterministic Monte Carlo seed (store in URL-state)
    riskFreeRate: number; // annual fraction, e.g. 0.045
}

export interface BacktestMetrics {
    finalValue: number;
    totalReturnPct: number; // fraction, e.g. 0.35 = +35%
    cagr: number; // annual fraction
    maxDrawdown: number; // negative fraction, e.g. -0.35
    volatility: number; // annualised stdev of daily returns
    sharpe: number | null; // null when volatility = 0 (guard divide-by-zero)
    cumulativeDividends: number; // total cash dividends received (DRIP value included)
}

export interface DividendEvent {
    date: string;
    label: string;
    perShare: number; // yfinance per-share amount
    cash: number; // actual cash received; 0 if reinvested via DRIP
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
}
