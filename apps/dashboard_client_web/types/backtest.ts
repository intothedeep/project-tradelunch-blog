// types/backtest.ts
// Purpose: domain types for the asset backtest pure engine (Phase X, X.6, X2).
// No runtime logic — type declarations only.

export type ContributionFreq = 'monthly' | 'yearly';

/**
 * Route for how a DCA contribution is invested.
 *   byWeight (default) — spread proportionally by holding weightPct (legacy behaviour).
 *   {kind:'asset',target} — ALL the cash goes to a single named label.
 */
export type ContributionRoute =
    | { kind: 'byWeight' }
    | { kind: 'asset'; target: string };

export interface ContributionPlan {
    amount: number; // USD per period
    freq: ContributionFreq;
    /** How the contribution cash is invested. Defaults to byWeight (backward-compat). */
    route?: ContributionRoute;
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
    // X2 rebalance fields — all optional so existing call sites compile unchanged
    canSell?: boolean;
    sellPriority?: number;
    groupId?: string;
    groupWeightPct?: number;
}

export interface BacktestInput {
    budget: number; // initial lump-sum, USD (0 for pure-DCA)
    holdings: Holding[];
    seriesByLabel: Record<string, PricePoint[]>; // label → sorted ascending
    range: { from: string; to: string }; // 'YYYY-MM-DD'
    seed: number; // deterministic Monte Carlo seed (store in URL-state)
    riskFreeRate: number; // annual fraction, e.g. 0.045
    contribution?: ContributionPlan; // undefined → lump-sum path unchanged
    rebalance?: RebalancePolicy; // X2 — absent = legacy no-rebalance behaviour
    /**
     * X2.18 — ad-hoc cash injections / withdrawals on specific dates.
     * amount > 0 = deposit; amount < 0 = withdrawal.
     * Absent ⇒ byte-identical output to pre-X2.18.
     */
    manualFlows?: { date: string; amount: number }[];
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
    /** X2 rebalance audit trail. Absent when no rebalance policy is active. */
    rebalance?: {
        events?: {
            date: string;
            trades: { label: string; deltaShares: number; deltaCash: number }[];
            turnover: number;
        }[];
        warnings?: string[];
    };
    /**
     * X2.17a — per-holding market-value snapshot aligned to the timeline.
     * label → shares×close on that date. Cash is excluded (use timeline[i].value
     * minus sum of values to recover cash).
     * Always emitted (populated every bar). Existing tests check only the fields
     * they know about — this is additive.
     */
    perHoldingValues?: { date: string; values: Record<string, number> }[];
}

// ── X2 rebalance types ────────────────────────────────────────────────────────

/**
 * How to reset the extrema reference price after a rebalance event.
 *   bearTrough — reset to the lowest trough price seen during the bear window
 *   window     — reset to the current price (start a new tracking window)
 *   onBuy      — reset on the bar when a buy trade fires
 *   onFire     — reset on any trigger fire (buy or sell)
 */
export type ExtremaReset = 'bearTrough' | 'window' | 'onBuy' | 'onFire';

/** Discriminated union of trigger kinds that can fire a rebalance. */
export type RebalanceTrigger =
    | {
          kind: 'driftBand';
          band: { kind: 'absolute' | 'relative'; pct: number };
      }
    | {
          kind: 'takeProfit';
          label: string;
          gainPct: number;
          reset?: ExtremaReset;
          bearThresholdPct?: number;
      }
    | {
          kind: 'buyDip';
          label: string;
          dropPct: number;
          reset?: ExtremaReset;
      }
    | {
          kind: 'weightCap';
          label: string;
          pct: number;
      }
    | {
          kind: 'weightFloor';
          label: string;
          pct: number;
      };

/** A named group of assets that share a target portfolio weight. */
export interface AssetGroup {
    id: string;
    targetPct: number;
    rebalanceWithin?: boolean;
}

/** Top-level rebalance policy attached to a BacktestInput. */
export interface RebalancePolicy {
    freq: 'never' | 'bar' | 'monthly' | 'quarterly' | 'yearly';
    band: { kind: 'absolute' | 'relative'; pct: number };
    groups: AssetGroup[];
    triggers?: RebalanceTrigger[];
}

/** Per-asset tracking state for extrema and bear-market detection. */
export interface AssetRunState {
    trough: number;
    peak: number;
    lastBuyPrice: number;
    inBear: boolean;
}

/** Mutable rebalance bookkeeping threaded through the date-walk. */
export type RebalanceState = {
    assets: Map<string, AssetRunState>;
    lastRebalanceDate: string | null;
    /** Accumulated rebalance events (appended by rebalanceIfDue). */
    events: {
        date: string;
        trades: { label: string; deltaShares: number; deltaCash: number }[];
        turnover: number;
    }[];
    /** Warning strings for skipped actions (e.g. canSell===false trim). */
    warnings: string[];
};
