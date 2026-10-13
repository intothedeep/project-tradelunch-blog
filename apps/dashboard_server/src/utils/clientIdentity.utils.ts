// Purpose: pure helpers that identify who sent a request (client IP, SSR key).
// Why: Express sits behind Cloudflare -> cloudflared -> 127.0.0.1, with no
//   `trust proxy`, so `req.ip` is always loopback. Cloudflare overwrites
//   `cf-connecting-ip` at the edge, so the header is the real client IP as
//   long as :4000 is not reachable from the internet (traffic.design.md 7.4.3).
import { timingSafeEqual } from 'crypto';

// Longest valid textual IP is 45 chars; the cap bounds what a garbage header
// can cost as a Map key.
const MAX_IP_LENGTH = 45;

export function getClientIp(
    cfConnectingIp: string | string[] | undefined,
    fallbackIp: string | undefined
): string {
    const header = Array.isArray(cfConnectingIp)
        ? cfConnectingIp[0]
        : cfConnectingIp;
    return (header || fallbackIp || 'unknown').slice(0, MAX_IP_LENGTH);
}

// Timing-safe compare on equal-length buffers (no timing leak of the secret).
export function isMatchingKey(
    provided: string | undefined,
    expected: string | undefined
): boolean {
    if (!provided || !expected) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}
