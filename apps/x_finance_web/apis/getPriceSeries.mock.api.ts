// apis/getPriceSeries.mock.api.ts
// Purpose: deterministic synthetic price-series fixture for /backtest/preview.
// Provides JEPQ (monthly dividends, ~$0.40/share each 20th), QQQ, and QLD
// (2-for-1 stock split 2023-09-15). No Math.random() — LCG walk, SSR-stable.
// Date range: 2022-05-17 (JEPQ inception) → 2024-12-31.

import type {
    TPriceSeriesResponse,
    TPriceSeriesBar,
} from './getPriceSeries.api';

// ─── Date helpers ─────────────────────────────────────────────────────────────

const START_MS = Date.UTC(2022, 4, 17); // 2022-05-17
const END_MS = Date.UTC(2024, 11, 31); // 2024-12-31
const MS_DAY = 86_400_000;

/** All weekdays (Mon–Fri) between START and END inclusive. */
function buildWeekdays(): string[] {
    const dates: string[] = [];
    for (let ms = START_MS; ms <= END_MS; ms += MS_DAY) {
        const d = new Date(ms);
        const dow = d.getUTCDay(); // 0=Sun, 6=Sat
        if (dow !== 0 && dow !== 6) {
            dates.push(d.toISOString().slice(0, 10));
        }
    }
    return dates;
}

const DATES = buildWeekdays(); // ~653 trading days

// ─── LCG ─────────────────────────────────────────────────────────────────────

function lcgStep(seed: number): { next: number; drift: number } {
    const next = (seed * 1664525 + 1013904223) & 0x7fffffff;
    const drift = ((next % 2001) - 1000) / 20000; // ±5%
    return { next, drift };
}

// ─── Price builder ────────────────────────────────────────────────────────────

interface BarSpec {
    seed: number;
    startPrice: number;
    /** Return non-zero dividend for this date string, else 0. */
    dividendFn: (date: string) => number;
    /** Return split ratio for this date string, else 0. */
    splitFn: (date: string) => number;
}

function buildSeries({
    seed,
    startPrice,
    dividendFn,
    splitFn,
}: BarSpec): TPriceSeriesBar[] {
    let price = startPrice;
    let s = seed;
    const bars: TPriceSeriesBar[] = [];

    for (const date of DATES) {
        const { next, drift } = lcgStep(s);
        s = next;
        price = Math.abs(price * (1 + drift));

        bars.push({
            date,
            close: parseFloat(price.toFixed(2)),
            dividends: dividendFn(date),
            stockSplits: splitFn(date),
        });
    }

    return bars;
}

// ─── Per-label specs ──────────────────────────────────────────────────────────

// JEPQ pays ~$0.40–$0.55/share on the 20th of each month (or nearest weekday).
// Fixed amounts per month for determinism.
const JEPQ_DIV_SCHEDULE: Record<string, number> = {
    '2022-05-20': 0.3182,
    '2022-06-20': 0.4124,
    '2022-07-20': 0.4397,
    '2022-08-19': 0.4218, // 20th = Sat → Friday
    '2022-09-20': 0.3965,
    '2022-10-20': 0.4731,
    '2022-11-18': 0.4512, // 20th = Sun → Friday
    '2022-12-20': 0.5103,
    '2023-01-20': 0.489,
    '2023-02-17': 0.4602, // President's Day week
    '2023-03-20': 0.4445,
    '2023-04-20': 0.4321,
    '2023-05-19': 0.4578, // 20th = Sat → Friday
    '2023-06-20': 0.4234,
    '2023-07-20': 0.4817,
    '2023-08-18': 0.4963, // 20th = Sun → Friday
    '2023-09-20': 0.5142,
    '2023-10-20': 0.5327,
    '2023-11-17': 0.5019, // 20th = Mon but near holiday → Friday
    '2023-12-20': 0.5608,
    '2024-01-19': 0.5274, // MLK week
    '2024-02-20': 0.5033,
    '2024-03-20': 0.5412,
    '2024-04-19': 0.5581, // 20th = Sat → Friday
    '2024-05-20': 0.5723,
    '2024-06-20': 0.5845,
    '2024-07-19': 0.5997, // 20th = Sat → Friday
    '2024-08-20': 0.6124,
    '2024-09-20': 0.6031,
    '2024-10-18': 0.6248, // 20th = Sun → Friday
    '2024-11-20': 0.6105,
    '2024-12-20': 0.6319,
};

// QLD 2-for-1 split on 2023-09-15 (synthetic; mirrors known QLD split cadence).
const QLD_SPLIT_DATE = '2023-09-15';

// ─── Assemble fixture ─────────────────────────────────────────────────────────

export const MOCK_PRICE_SERIES: TPriceSeriesResponse = {
    series: {
        JEPQ: buildSeries({
            seed: 0xbeef_1234,
            startPrice: 50.42,
            dividendFn: (date) => JEPQ_DIV_SCHEDULE[date] ?? 0,
            splitFn: () => 0,
        }),
        QQQ: buildSeries({
            seed: 0xdead_cafe,
            startPrice: 320.18,
            dividendFn: () => 0,
            splitFn: () => 0,
        }),
        QLD: buildSeries({
            seed: 0xf00d_4321,
            startPrice: 44.76,
            dividendFn: () => 0,
            splitFn: (date) => (date === QLD_SPLIT_DATE ? 2 : 0),
        }),
    },
};

/** Drop-in replacement for getPriceSeries in preview/test contexts. */
export function getMockPriceSeries(): TPriceSeriesResponse {
    return MOCK_PRICE_SERIES;
}
