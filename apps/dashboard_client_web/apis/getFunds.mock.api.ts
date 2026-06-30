// apis/getFunds.mock.api.ts
// Purpose: fixture data for the /funds/preview route — realistic 13F holdings
//   for Berkshire Hathaway and BlackRock so the preview == production layout.
//   Also exports MOCK_RANK_FLOW for the rank-flow preview (≥2 fabricated quarters).
//   NO network calls. Imported by the preview page directly.
// Invariant: weights within each fund sum to ~100; valueUsd realistic ($1B–$100B).
// Side effects: none (pure data exports).

import type { Fund, FundHoldings } from '@/types/funds';
import type { RankFlow } from '@/types/rankFlow';

const PERIOD = '2024-12-31';
const PERIOD_Q3 = '2024-09-30';

export const MOCK_FUNDS: Fund[] = [
    {
        cik: '0001067983',
        label: 'Berkshire Hathaway Inc.',
        periodOfReport: PERIOD,
        holdingsCount: 8,
    },
    {
        cik: '0001086364',
        label: 'BlackRock Inc.',
        periodOfReport: PERIOD,
        holdingsCount: 8,
    },
];

const BERKSHIRE_HOLDINGS: FundHoldings = {
    cik: '0001067983',
    label: 'Berkshire Hathaway Inc.',
    periodOfReport: PERIOD,
    holdings: [
        {
            cusip: '037833100',
            nameOfIssuer: 'Apple Inc.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 300_000_000,
            prnType: 'SH',
            valueUsd: 55_800_000_000,
            putCall: '',
            weightPct: 28.5,
        },
        {
            cusip: '404280406',
            nameOfIssuer: 'HSBC Holdings PLC',
            titleOfClass: 'ADR',
            ticker: null,
            shares: 96_000_000,
            prnType: 'SH',
            valueUsd: 4_200_000_000,
            putCall: '',
            weightPct: 2.15,
        },
        {
            cusip: '808513105',
            nameOfIssuer: 'Chevron Corp.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 118_000_000,
            prnType: 'SH',
            valueUsd: 18_000_000_000,
            putCall: '',
            weightPct: 9.2,
        },
        {
            cusip: '459200101',
            nameOfIssuer: 'American Express Co.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 151_000_000,
            prnType: 'SH',
            valueUsd: 28_000_000_000,
            putCall: '',
            weightPct: 14.3,
        },
        {
            cusip: '084670702',
            nameOfIssuer: 'Bank of America Corp.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 1_032_000_000,
            prnType: 'SH',
            valueUsd: 40_000_000_000,
            putCall: '',
            weightPct: 20.4,
        },
        {
            cusip: '922908363',
            nameOfIssuer: 'VeriSign Inc.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 12_800_000,
            prnType: 'SH',
            valueUsd: 2_400_000_000,
            putCall: '',
            weightPct: 1.23,
        },
        {
            cusip: '15135B101',
            nameOfIssuer: 'Chubb Ltd.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 26_600_000,
            prnType: 'SH',
            valueUsd: 7_800_000_000,
            putCall: '',
            weightPct: 3.99,
        },
        {
            cusip: '78378X107',
            nameOfIssuer: 'S&P Global Inc.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 5_500_000,
            prnType: 'SH',
            valueUsd: 2_400_000_000,
            putCall: '',
            weightPct: 1.23,
        },
    ],
};

const BLACKROCK_HOLDINGS: FundHoldings = {
    cik: '0001086364',
    label: 'BlackRock Inc.',
    periodOfReport: PERIOD,
    holdings: [
        {
            cusip: '594918104',
            nameOfIssuer: 'Microsoft Corp.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 520_000_000,
            prnType: 'SH',
            valueUsd: 195_000_000_000,
            putCall: '',
            weightPct: 22.1,
        },
        {
            cusip: '037833100',
            nameOfIssuer: 'Apple Inc.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 900_000_000,
            prnType: 'SH',
            valueUsd: 167_000_000_000,
            putCall: '',
            weightPct: 18.9,
        },
        {
            cusip: '023135106',
            nameOfIssuer: 'Amazon.com Inc.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 630_000_000,
            prnType: 'SH',
            valueUsd: 112_000_000_000,
            putCall: '',
            weightPct: 12.7,
        },
        {
            cusip: '02079K305',
            nameOfIssuer: 'Alphabet Inc.',
            titleOfClass: 'CL A COM',
            ticker: null,
            shares: 445_000_000,
            prnType: 'SH',
            valueUsd: 79_000_000_000,
            putCall: '',
            weightPct: 8.95,
        },
        {
            cusip: '67066G104',
            nameOfIssuer: 'NVIDIA Corp.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 790_000_000,
            prnType: 'SH',
            valueUsd: 98_000_000_000,
            putCall: '',
            weightPct: 11.1,
        },
        {
            cusip: '67066G104',
            nameOfIssuer: 'NVIDIA Corp.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 5_000_000,
            prnType: 'SH',
            valueUsd: 620_000_000,
            putCall: 'PUT',
            weightPct: 0.07,
        },
        {
            cusip: '46090E103',
            nameOfIssuer: 'JPMorgan Chase & Co.',
            titleOfClass: 'COM',
            ticker: null,
            shares: 148_000_000,
            prnType: 'SH',
            valueUsd: 28_500_000_000,
            putCall: '',
            weightPct: 3.23,
        },
        {
            cusip: '58155Q103',
            nameOfIssuer: 'Meta Platforms Inc.',
            titleOfClass: 'CL A COM',
            ticker: null,
            shares: 128_000_000,
            prnType: 'SH',
            valueUsd: 71_000_000_000,
            putCall: '',
            weightPct: 8.04,
        },
    ],
};

export const MOCK_FUND_HOLDINGS: Record<string, FundHoldings> = {
    '0001067983': BERKSHIRE_HOLDINGS,
    '0001086364': BLACKROCK_HOLDINGS,
};

// Convenience export: the default fund shown in /funds/preview (Berkshire).
// Typed as FundHoldings (not FundHoldings|undefined) so preview pages avoid
// an index-access narrowing branch on a known-present fixture key.
export const PREVIEW_HOLDINGS: FundHoldings = BERKSHIRE_HOLDINGS;

// ---------------------------------------------------------------------------
// Rank-flow fixture — 2 fabricated quarters (Q4 2024 + Q3 2024) for Berkshire
// Used by /funds/preview to render the RankFlowTable with populated data.
// ---------------------------------------------------------------------------
export const MOCK_RANK_FLOW: RankFlow = {
    cik: '0001067983',
    periods: [
        {
            periodOfReport: PERIOD,
            totalValueUsd: 196_000_000_000,
            remainingCount: 35,
            remainingWeightPct: 18.63,
        },
        {
            periodOfReport: PERIOD_Q3,
            totalValueUsd: 198_000_000_000,
            remainingCount: 32,
            remainingWeightPct: 17.8,
        },
    ],
    rows: [
        {
            cusip: '084670702',
            label: 'Bank of America Corp.',
            cells: {
                [PERIOD]: {
                    rank: 1,
                    weightPct: 20.4,
                    valueUsd: 40_000_000_000,
                },
                [PERIOD_Q3]: {
                    rank: 1,
                    weightPct: 21.1,
                    valueUsd: 42_000_000_000,
                },
            },
        },
        {
            cusip: '037833100',
            label: 'Apple Inc.',
            cells: {
                [PERIOD]: {
                    rank: 2,
                    weightPct: 28.5,
                    valueUsd: 55_800_000_000,
                },
                [PERIOD_Q3]: {
                    rank: 2,
                    weightPct: 27.9,
                    valueUsd: 53_000_000_000,
                },
            },
        },
        {
            cusip: '459200101',
            label: 'American Express Co.',
            cells: {
                [PERIOD]: {
                    rank: 3,
                    weightPct: 14.3,
                    valueUsd: 28_000_000_000,
                },
                [PERIOD_Q3]: {
                    rank: 3,
                    weightPct: 13.8,
                    valueUsd: 27_500_000_000,
                },
            },
        },
        {
            cusip: '808513105',
            label: 'Chevron Corp.',
            cells: {
                [PERIOD]: { rank: 4, weightPct: 9.2, valueUsd: 18_000_000_000 },
                // Not held in Q3 — ghost cell
                [PERIOD_Q3]: null,
            },
        },
        {
            cusip: '15135B101',
            label: 'Chubb Ltd.',
            cells: {
                [PERIOD]: { rank: 5, weightPct: 3.99, valueUsd: 7_800_000_000 },
                [PERIOD_Q3]: {
                    rank: 4,
                    weightPct: 4.2,
                    valueUsd: 8_100_000_000,
                },
            },
        },
        {
            cusip: '404280406',
            label: 'HSBC Holdings PLC',
            cells: {
                [PERIOD]: { rank: 6, weightPct: 2.15, valueUsd: 4_200_000_000 },
                // Newly entered in Q4 only
                [PERIOD_Q3]: null,
            },
        },
        {
            cusip: '922908363',
            label: 'VeriSign Inc.',
            cells: {
                [PERIOD]: { rank: 7, weightPct: 1.23, valueUsd: 2_400_000_000 },
                [PERIOD_Q3]: {
                    rank: 6,
                    weightPct: 1.31,
                    valueUsd: 2_600_000_000,
                },
            },
        },
        {
            cusip: '78378X107',
            label: 'S&P Global Inc.',
            cells: {
                [PERIOD]: { rank: 8, weightPct: 1.23, valueUsd: 2_400_000_000 },
                [PERIOD_Q3]: {
                    rank: 7,
                    weightPct: 1.15,
                    valueUsd: 2_200_000_000,
                },
            },
        },
    ],
};
