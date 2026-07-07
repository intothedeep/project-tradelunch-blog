// utils/backtest/universe.ts
// Purpose: curated buyable universe for the backtest asset picker.
// Only instruments collectable by the stock_collector (yfinance) are listed.
// FX rates, spot indices, futures are excluded — not directly purchasable.

export interface UniverseAsset {
    label: string;
    name: string;
    isLeveraged: boolean;
    category: 'etf' | 'stock';
}

export const BUYABLE_UNIVERSE: UniverseAsset[] = [
    // ── ETFs ─────────────────────────────────────────────────────────────────
    {
        label: 'QQQ',
        name: 'Invesco QQQ (NASDAQ 100)',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'QQQM',
        name: 'Invesco QQQM (NASDAQ 100 mini)',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'QLD',
        name: 'ProShares Ultra QQQ (2× NASDAQ)',
        isLeveraged: true,
        category: 'etf',
    },
    {
        label: 'TQQQ',
        name: 'ProShares UltraPro QQQ (3× NASDAQ)',
        isLeveraged: true,
        category: 'etf',
    },
    {
        label: 'SPY',
        name: 'SPDR S&P 500 ETF',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'VOO',
        name: 'Vanguard S&P 500 ETF',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'VOOG',
        name: 'Vanguard S&P 500 Growth ETF',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'SCHD',
        name: 'Schwab U.S. Dividend Equity ETF',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'JEPQ',
        name: 'JPMorgan NASDAQ Equity Premium',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'SGOV',
        name: 'iShares 0-3 Month Treasury Bond',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'SHY',
        name: 'iShares 1-3 Year Treasury Bond',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'IEF',
        name: 'iShares 7-10 Year Treasury Bond',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'TLT',
        name: 'iShares 20+ Year Treasury Bond',
        isLeveraged: false,
        category: 'etf',
    },
    {
        label: 'SOXL',
        name: 'Direxion Daily Semiconductors 3×',
        isLeveraged: true,
        category: 'etf',
    },
    {
        label: 'IBIT',
        name: 'iShares Bitcoin Trust ETF',
        isLeveraged: false,
        category: 'etf',
    },
    // ── Notable stocks ────────────────────────────────────────────────────────
    {
        label: 'AAPL',
        name: 'Apple Inc.',
        isLeveraged: false,
        category: 'stock',
    },
    {
        label: 'NVDA',
        name: 'NVIDIA Corporation',
        isLeveraged: false,
        category: 'stock',
    },
    {
        label: 'TSLA',
        name: 'Tesla Inc.',
        isLeveraged: false,
        category: 'stock',
    },
    {
        label: 'GOOG',
        name: 'Alphabet Inc. (Class C)',
        isLeveraged: false,
        category: 'stock',
    },
    {
        label: 'MSTR',
        name: 'MicroStrategy (Strategy Inc.)',
        isLeveraged: false,
        category: 'stock',
    },
    {
        label: 'COIN',
        name: 'Coinbase Global Inc.',
        isLeveraged: false,
        category: 'stock',
    },
    {
        label: 'SOFI',
        name: 'SoFi Technologies Inc.',
        isLeveraged: false,
        category: 'stock',
    },
];

export const LEVERAGED_LABELS = new Set(
    BUYABLE_UNIVERSE.filter((a) => a.isLeveraged).map((a) => a.label)
);
