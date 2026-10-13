// Purpose: pure fixed-window counter + IP key normalisation for the Express
//   rate-limit backstop (traffic.design.md 7.4.3). No I/O; the clock is passed in.
// Memory: one Map<string, number> per bucket. The "already warned" state is
//   encoded in the count itself (count === limit + 1 is the first exceed), so
//   no second structure exists. The whole Map is dropped when the window rolls.
import { isIPv6 } from 'net';

// IPv6 users get a /64 (the smallest allocation to one subscriber); keying on
// the full address would let one host rotate through 2^64 addresses.
export function toRateLimitKey(ip: string): string {
    const lower = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return mapped[1];
    if (!isIPv6(lower)) return lower;

    const [head, tail] = lower.split('::');
    const headGroups = head ? head.split(':') : [];
    const tailGroups = tail ? tail.split(':') : [];
    const fill =
        tail === undefined ? 0 : 8 - headGroups.length - tailGroups.length;
    const groups = [...headGroups, ...Array(fill).fill('0'), ...tailGroups];
    return groups
        .slice(0, 4)
        .map((g) => g.replace(/^0+(?=.)/, ''))
        .join(':');
}

export type TRateHit =
    | { tracked: false; isCapFirstReached: boolean }
    | {
          tracked: true;
          count: number;
          isExceeded: boolean;
          isFirstExceed: boolean;
          retryAfterSec: number;
      };

export type TRateCounter = {
    hit: (bucket: string, key: string, limit: number, now: number) => TRateHit;
};

export function createRateCounter(
    windowMs: number,
    maxKeysPerBucket: number
): TRateCounter {
    let windowStart = 0;
    let buckets = new Map<string, Map<string, number>>();
    let isCapWarned = false;

    return {
        hit(bucket, key, limit, now) {
            if (now - windowStart >= windowMs) {
                windowStart = now;
                buckets = new Map();
                isCapWarned = false;
            }
            let counts = buckets.get(bucket);
            if (!counts) {
                counts = new Map();
                buckets.set(bucket, counts);
            }
            const previous = counts.get(key);
            if (previous === undefined && counts.size >= maxKeysPerBucket) {
                // fail-open: a flood of new keys must not become a memory flood
                const isCapFirstReached = !isCapWarned;
                isCapWarned = true;
                return { tracked: false, isCapFirstReached };
            }
            const count = (previous ?? 0) + 1;
            counts.set(key, count);
            return {
                tracked: true,
                count,
                isExceeded: count > limit,
                isFirstExceed: count === limit + 1,
                retryAfterSec: Math.max(
                    1,
                    Math.ceil((windowStart + windowMs - now) / 1000)
                ),
            };
        },
    };
}
