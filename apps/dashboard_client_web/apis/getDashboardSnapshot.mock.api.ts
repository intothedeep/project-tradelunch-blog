import type { IDashboardSnapshot } from '@/types/dashboard'

const AS_OF = '2026-05-06T09:00:00.000Z'

export const MOCK_DASHBOARD_SNAPSHOT: IDashboardSnapshot = {
  fetchedAt: AS_OF,

  fx: {
    meta: { asOf: AS_OF, revalidateSeconds: 60 },
    items: [
      { label: 'KRW/USD', value: 1374.50, change: { absolute: -5.20, percent: -0.38 } },
      { label: 'EUR/USD', value: 1.0812, change: { absolute: 0.0031, percent: 0.29 } },
    ],
  },

  crypto: {
    meta: { asOf: AS_OF, revalidateSeconds: 30 },
    items: [
      { label: 'BTC/USD', value: 96_420.00, change: { absolute: 1_250.00, percent: 1.31 } },
      { label: 'BTC/ETH', value: 27.84, change: { absolute: -0.42, percent: -1.49 } },
    ],
  },

  indices: {
    meta: { asOf: AS_OF, revalidateSeconds: 60 },
    items: [
      { label: 'KOSPI',     value: 2_612.35, change: { absolute: -18.42, percent: -0.70 } },
      { label: 'KOSDAQ',    value: 754.80,   change: { absolute: 3.25,   percent: 0.43 } },
      { label: 'NASDAQ',    value: 19_283.40, change: { absolute: 142.30, percent: 0.74 } },
      { label: 'S&P 500',   value: 5_567.19, change: { absolute: -12.08, percent: -0.22 } },
      { label: 'Dow Jones', value: 41_218.83, change: { absolute: 204.16, percent: 0.50 } },
    ],
  },

  rates: {
    meta: { asOf: AS_OF, revalidateSeconds: 86400 },
    items: [
      { label: 'Korea Call Rate', value: 2.75, change: { absolute: 0.00,  percent: 0.00 } },
      { label: 'US Fed Funds',    value: 4.50, change: { absolute: 0.00,  percent: 0.00 } },
      { label: 'Japan Call Rate', value: 0.50, change: { absolute: 0.00,  percent: 0.00 } },
    ],
  },

  stocks: {
    meta: { asOf: AS_OF, revalidateSeconds: 60 },
    items: [
      { label: 'Alphabet',  ticker: 'GOOGL',  exchange: 'US',  value: 178.42,  change: { absolute: 2.15,   percent: 1.22 } },
      { label: 'Tesla',     ticker: 'TSLA',   exchange: 'US',  value: 248.75,  change: { absolute: -6.30,  percent: -2.47 } },
      { label: 'Apple',     ticker: 'AAPL',   exchange: 'US',  value: 213.18,  change: { absolute: 1.08,   percent: 0.51 } },
      { label: 'Amazon',    ticker: 'AMZN',   exchange: 'US',  value: 199.64,  change: { absolute: -2.44,  percent: -1.21 } },
      { label: 'Meta',      ticker: 'META',   exchange: 'US',  value: 594.30,  change: { absolute: 8.72,   percent: 1.49 } },
      { label: 'NuScale',   ticker: 'SMR',    exchange: 'US',  value: 26.85,   change: { absolute: 0.95,   percent: 3.67 } },
      { label: 'TQQQ',      ticker: 'TQQQ',   exchange: 'US',  value: 62.40,   change: { absolute: -1.82,  percent: -2.83 } },
      { label: 'SOXL',      ticker: 'SOXL',   exchange: 'US',  value: 18.73,   change: { absolute: 0.44,   percent: 2.41 } },
      { label: 'Walmart',   ticker: 'WMT',    exchange: 'US',  value: 101.52,  change: { absolute: -0.28,  percent: -0.28 } },
      { label: 'NCSOFT',    ticker: '036570', exchange: 'KRX', value: 192_500, change: { absolute: -3_500, percent: -1.79 } },
    ],
  },
}

export default MOCK_DASHBOARD_SNAPSHOT
