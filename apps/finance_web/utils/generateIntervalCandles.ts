// Purpose: derive mock candles per chart interval from the base daily history.
// - 'D' returns the base daily series as-is.
// - 'W' / 'M' aggregate daily candles into weekly / monthly OHLC buckets.
// - Sub-day intervals synthesize intraday candles with the same deterministic
//   LCG pattern used by the daily mock, ending at the latest known close so
//   the price is continuous across interval switches.

import type { IOHLCPoint } from '@/types/history';
import type { ChartInterval } from '@/store/dashboard.atom';

const INTRADAY_COUNT = 250;

const INTRADAY_SECONDS: Record<
    Exclude<ChartInterval, 'D' | 'W' | 'M'>,
    number
> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14_400,
};

function lcgStep(seed: number): {
    next: number;
    drift: number;
    jitter: number;
} {
    const next = (seed * 1664525 + 1013904223) & 0x7fffffff;
    const drift = ((next % 2001) - 1000) / 20000;
    const jitter = ((next >> 8) % 500) / 100000;
    return { next, drift, jitter };
}

function round6(n: number): number {
    return parseFloat(n.toPrecision(6));
}

function hashLabel(label: string): number {
    let h = 2166136261;
    for (let i = 0; i < label.length; i++) {
        h = (h ^ label.charCodeAt(i)) * 16777619;
        h = h & 0x7fffffff;
    }
    return h || 1;
}

function aggregate(
    candles: IOHLCPoint[],
    bucketKey: (time: string) => string
): IOHLCPoint[] {
    const buckets = new Map<string, IOHLCPoint[]>();
    for (const c of candles) {
        if (typeof c.time !== 'string') continue;
        const key = bucketKey(c.time);
        const list = buckets.get(key);
        if (list) list.push(c);
        else buckets.set(key, [c]);
    }
    const result: IOHLCPoint[] = [];
    for (const [key, group] of buckets) {
        const first = group[0];
        const last = group[group.length - 1];
        if (!first || !last) continue;
        let high = first.high;
        let low = first.low;
        let volume = 0;
        for (const c of group) {
            if (c.high > high) high = c.high;
            if (c.low < low) low = c.low;
            volume += c.volume;
        }
        result.push({
            time: key,
            open: first.open,
            high,
            low,
            close: last.close,
            volume,
        });
    }
    return result;
}

function weekKey(isoDate: string): string {
    const d = new Date(isoDate + 'T00:00:00Z');
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    const monday = new Date(d.getTime() - diff * 86_400_000);
    return monday.toISOString().slice(0, 10);
}

function monthKey(isoDate: string): string {
    return isoDate.slice(0, 7) + '-01';
}

function buildIntraday(
    label: string,
    intervalSec: number,
    endValue: number
): IOHLCPoint[] {
    let seed = hashLabel(label) ^ intervalSec;
    const offsetRatio = ((hashLabel(label) % 41) - 20) / 100;
    let price = endValue * (1 - offsetRatio);
    const nowSec = Math.floor(Date.UTC(2026, 4, 6, 16, 0, 0) / 1000);
    const startSec = nowSec - (INTRADAY_COUNT - 1) * intervalSec;

    const candles: IOHLCPoint[] = [];
    for (let i = 0; i < INTRADAY_COUNT; i++) {
        const { next, drift, jitter } = lcgStep(seed);
        seed = next;
        const open = round6(Math.abs(price));
        const close =
            i === INTRADAY_COUNT - 1
                ? endValue
                : round6(Math.abs(open * (1 + drift)));
        const bodyHigh = Math.max(open, close);
        const bodyLow = Math.min(open, close);
        const high = round6(bodyHigh * (1 + jitter));
        const low = round6(bodyLow * (1 - jitter));
        const volume = Math.floor(50_000 + ((next >> 4) % 250_000));
        candles.push({
            time: startSec + i * intervalSec,
            open,
            high,
            low,
            close,
            volume,
        });
        price = close;
    }
    return candles;
}

export function generateIntervalCandles(
    label: string,
    interval: ChartInterval,
    baseDaily: IOHLCPoint[]
): IOHLCPoint[] {
    if (interval === 'D') return baseDaily;
    if (interval === 'W') return aggregate(baseDaily, weekKey);
    if (interval === 'M') return aggregate(baseDaily, monthKey);
    const last = baseDaily[baseDaily.length - 1];
    const endValue = last?.close ?? 100;
    return buildIntraday(label, INTRADAY_SECONDS[interval], endValue);
}
