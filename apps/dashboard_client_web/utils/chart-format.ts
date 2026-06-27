import type { IOHLCPoint } from '@/types/history';
import type { ChartRange } from '@/store/dashboard.atom';

export function formatPrice(v: number): string {
    if (v >= 1000)
        return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (v >= 1) return v.toFixed(2);
    return v.toPrecision(5);
}

export function formatVolume(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
}

export function formatOscillator(v: number): string {
    if (Math.abs(v) >= 100) return v.toFixed(1);
    return v.toFixed(2);
}

export function formatCandleTime(time: string | number): string {
    if (typeof time === 'string') return time;
    const d = new Date(time * 1000);
    const date = d.toISOString().slice(0, 10);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${date} ${hh}:${mm}`;
}

export function visibleStartIdx(
    range: ChartRange,
    candles: IOHLCPoint[]
): number {
    const total = candles.length;
    if (total === 0) return 0;
    switch (range) {
        case '1D':
            return total - 1;
        case '5D':
            return Math.max(0, total - 5);
        case '1M':
            return Math.max(0, total - 30);
        case '3M':
            return Math.max(0, total - 90);
        case '6M':
            return Math.max(0, total - 180);
        case '1Y':
            return Math.max(0, total - 365);
        case '5Y':
            return Math.max(0, total - 365 * 5);
        case 'All':
            return 0;
        case 'YTD': {
            const lastTime = candles[total - 1]?.time;
            if (typeof lastTime !== 'string') return 0;
            const yearStart = `${lastTime.slice(0, 4)}-01-01`;
            const idx = candles.findIndex(
                (c) => typeof c.time === 'string' && c.time >= yearStart
            );
            return idx >= 0 ? idx : 0;
        }
    }
}
