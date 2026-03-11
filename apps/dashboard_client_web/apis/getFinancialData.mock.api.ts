// apis/getFinancialData.mock.api.ts

// ─── Individual Item Types ───────────────────────────────────────────

export interface ICurrencyData {
    pair: string;
    rate: number;
    change: number;
    sparkline: number[];
}

export interface ICommodityData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    sparkline: number[];
}

export interface IStockData {
    ticker: string;
    name: string;
    price: number;
    change: number;
    volume: string;
}

export interface IStockGroup {
    groupName: string;
    stocks: IStockData[];
}

export interface ICompany13F {
    companyName: string;
    cik: string;
    reportDate: string;
    holdings: {
        ticker: string;
        shares: number;
        marketValue: string;
        percentage: number;
    }[];
}

export interface IInterestRate {
    country: string;
    rate: number;
    change: number;
}

export interface ITreasuryYield {
    maturity: string;
    yield: number;
    change: number;
}

// ─── Dashboard Aggregate ─────────────────────────────────────────────

export interface IFinancialDashboardData {
    currencies: ICurrencyData[];
    commodities: ICommodityData[];
    stocks: IStockData[];
    stockGroups: IStockGroup[];
    companies13F: ICompany13F[];
    interestRates: IInterestRate[];
    treasuries: ITreasuryYield[];
}

// ─── Mock Sparkline Helper ───────────────────────────────────────────

function mockSparkline(base: number, points = 20): number[] {
    const data: number[] = [];
    let val = base;
    for (let i = 0; i < points; i++) {
        val += (Math.random() - 0.5) * base * 0.01;
        data.push(parseFloat(val.toFixed(2)));
    }
    return data;
}

// ─── Mock Data ───────────────────────────────────────────────────────

export async function getFinancialMockData(): Promise<IFinancialDashboardData> {
    await new Promise((resolve) => setTimeout(resolve, 400));

    return {
        currencies: [
            { pair: 'USD/KRW', rate: 1350.5, change: 0.12, sparkline: mockSparkline(1350) },
            { pair: 'USD/EUR', rate: 0.92, change: -0.05, sparkline: mockSparkline(0.92) },
            { pair: 'USD/JPY', rate: 151.2, change: 0.3, sparkline: mockSparkline(151) },
            { pair: 'USD/CNY', rate: 7.24, change: -0.02, sparkline: mockSparkline(7.24) },
        ],
        commodities: [
            { symbol: 'XAU', name: 'Gold', price: 2350.4, change: 0.45, sparkline: mockSparkline(2350) },
            { symbol: 'XAG', name: 'Silver', price: 28.15, change: 1.2, sparkline: mockSparkline(28) },
            { symbol: 'CL', name: 'Crude Oil (WTI)', price: 82.3, change: -0.6, sparkline: mockSparkline(82) },
        ],
        stocks: [
            { ticker: 'AAPL', name: 'Apple Inc.', price: 178.5, change: 0.85, volume: '52.3M' },
            { ticker: 'MSFT', name: 'Microsoft Corp.', price: 420.1, change: -0.32, volume: '28.1M' },
            { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 875.3, change: 2.15, volume: '41.7M' },
            { ticker: 'SPY', name: 'S&P 500 ETF', price: 512.8, change: 0.12, volume: '68.9M' },
            { ticker: 'QQQ', name: 'Nasdaq 100 ETF', price: 438.6, change: 0.45, volume: '35.2M' },
        ],
        stockGroups: [
            {
                groupName: 'FAANG+',
                stocks: [
                    { ticker: 'AAPL', name: 'Apple', price: 178.5, change: 0.85, volume: '52.3M' },
                    { ticker: 'AMZN', name: 'Amazon', price: 178.2, change: -0.4, volume: '30.1M' },
                    { ticker: 'GOOGL', name: 'Alphabet', price: 141.8, change: 0.32, volume: '22.5M' },
                    { ticker: 'META', name: 'Meta', price: 485.1, change: 1.1, volume: '18.8M' },
                    { ticker: 'NFLX', name: 'Netflix', price: 605.3, change: -0.2, volume: '5.1M' },
                ],
            },
        ],
        companies13F: [
            {
                companyName: 'BlackRock',
                cik: '0001364742',
                reportDate: '2024-Q4',
                holdings: [
                    { ticker: 'AAPL', shares: 164_000_000, marketValue: '$29.3B', percentage: 5.2 },
                    { ticker: 'MSFT', shares: 98_000_000, marketValue: '$41.2B', percentage: 7.3 },
                    { ticker: 'NVDA', shares: 52_000_000, marketValue: '$45.5B', percentage: 8.1 },
                    { ticker: 'AMZN', shares: 61_000_000, marketValue: '$10.9B', percentage: 1.9 },
                ],
            },
            {
                companyName: 'Berkshire Hathaway',
                cik: '0001067983',
                reportDate: '2024-Q4',
                holdings: [
                    { ticker: 'AAPL', shares: 905_000_000, marketValue: '$161.5B', percentage: 49.3 },
                    { ticker: 'BAC', shares: 1_032_000_000, marketValue: '$34.8B', percentage: 10.6 },
                    { ticker: 'AXP', shares: 151_000_000, marketValue: '$28.4B', percentage: 8.7 },
                    { ticker: 'KO', shares: 400_000_000, marketValue: '$23.6B', percentage: 7.2 },
                    { ticker: 'CVX', shares: 118_000_000, marketValue: '$18.5B', percentage: 5.7 },
                ],
            },
        ],
        interestRates: [
            { country: 'United States', rate: 5.5, change: 0 },
            { country: 'Eurozone', rate: 4.5, change: 0 },
            { country: 'UK', rate: 5.25, change: 0 },
            { country: 'Japan', rate: 0.1, change: 0.1 },
            { country: 'South Korea', rate: 3.5, change: 0 },
        ],
        treasuries: [
            { maturity: '2Y', yield: 4.85, change: 0.02 },
            { maturity: '5Y', yield: 4.5, change: -0.01 },
            { maturity: '10Y', yield: 4.4, change: -0.03 },
            { maturity: '30Y', yield: 4.55, change: -0.02 },
        ],
    };
}
