// utils/backtest/url-codec.ts
// Purpose: pure encode/decode for backtest URL query params (X2.11 codec wave).
// Discipline: never throw — all parse paths try/catch → default/null.
// Backward-compat: existing 3-field assets= tokens decode byte-identical to pre-X2.
//
// Grammar (assets= per holding):
//   LABEL:weight:route[:canSell[:sellPriority[:groupId[:groupWeightPct]]]][:d<dcaPct>][:v<divPct>]
//   Positional fields 0–6 (seg index); keyed suffixes (:dN / :vN) appear AFTER index 6.
//   When keyed tokens are present the full 4-slot positional tail is always emitted first
//   (no trailing-'-' trim) so keyed tokens always sit at seg index >= 7.
//   Re-encoding a legacy holding without dcaPct/divPct emits NO d/v tokens (no URL bloat).
//
// Grammar (dca=):
//   <amount>:<freq>[:<routeKind>[:<routeTarget>]]
//   routeKind = 'asset' | 'dw' (byDcaWeight); absent/byWeight emitted as absent.
//
// Grammar (drw=):
//   '1' → dividendReinvestByWeight=true; absent → false.

import type {
    Holding,
    ContributionPlan,
    ContributionFreq,
    DividendRoute,
} from '@/types/backtest';

// Re-export rebalance codec so callers import from a single module.
export {
    encodeRebalance,
    decodeRebalance,
} from '@/utils/backtest/url-codec-rebalance';

// ── Dividend route (holdings field 3) ────────────────────────────────────────

export function decodeRoute(dStr: string | undefined): DividendRoute {
    if (dStr === '1' || dStr === 'same') return { kind: 'same' };
    if (dStr === '0' || dStr === 'cash' || dStr === undefined)
        return { kind: 'cash' };
    return { kind: 'asset', target: dStr };
}

export function encodeDividendRoute(h: Holding): string {
    const route: DividendRoute =
        h.dividendRoute !== undefined
            ? h.dividendRoute
            : h.drip === true
              ? { kind: 'same' }
              : { kind: 'cash' };
    if (route.kind === 'same') return 'same';
    if (route.kind === 'cash') return 'cash';
    return route.target;
}

// ── Holdings codec (assets=) ──────────────────────────────────────────────────
// Format: LABEL:weight:route[:canSell[:sellPriority[:groupId[:groupWeightPct]]]][:d<dcaPct>][:v<divPct>]
// Trailing optional fields only emitted when non-default (no URL bloat).
// canSell encoded as 'L' (locked=false) or omitted (undefined/true).
// dcaPct emitted as :dN (e.g. :d30); divPct emitted as :vN (e.g. :v25).
//
// Key invariant: when dcaPct or divPct is present, the FULL 4-slot positional
// tail (segs 3–6) is always emitted without trailing-'-' trimming. This
// guarantees keyed tokens always start at seg index >= 7, so a free-text
// groupId like 'd5' or 'v2' is never confused with a keyed token.

function encodeHoldingTail(h: Holding): string {
    const hasCanSell = h.canSell === false;
    const hasPriority = h.sellPriority !== undefined;
    const hasGroupId = h.groupId !== undefined;
    const hasGroupWt = h.groupWeightPct !== undefined;
    const hasDcaPct = h.dcaPct !== undefined;
    const hasDivPct = h.divPct !== undefined;

    const hasKeyed = hasDcaPct || hasDivPct;

    // Positional tail (segs 3–6)
    let positionalTail = '';
    const hasPositional = hasCanSell || hasPriority || hasGroupId || hasGroupWt;

    if (hasPositional || hasKeyed) {
        const canSellToken = h.canSell === false ? 'L' : '-';
        const priorityToken = hasPriority ? String(h.sellPriority) : '-';
        const groupIdToken = hasGroupId ? h.groupId! : '-';
        const groupWtToken = hasGroupWt ? String(h.groupWeightPct) : '-';

        const parts = [canSellToken, priorityToken, groupIdToken, groupWtToken];

        if (hasKeyed) {
            // When keyed tokens follow, emit all 4 slots without trim so keyed
            // tokens always land at seg index >= 7 (prevents groupId collisions).
            positionalTail = ':' + parts.join(':');
        } else {
            // Legacy: trim trailing '-' to keep URLs compact (no keyed tokens).
            while (parts.length > 0 && parts[parts.length - 1] === '-') {
                parts.pop();
            }
            positionalTail = parts.length > 0 ? ':' + parts.join(':') : '';
        }
    }

    // Keyed suffix tokens (after positional, always at seg index >= 7)
    const keyedParts: string[] = [];
    if (hasDcaPct) keyedParts.push(`d${h.dcaPct}`);
    if (hasDivPct) keyedParts.push(`v${h.divPct}`);
    const keyedTail = keyedParts.length > 0 ? ':' + keyedParts.join(':') : '';

    return positionalTail + keyedTail;
}

export function encodeHoldings(holdings: Holding[]): string {
    return holdings
        .map((h) => {
            const base = `${h.label}:${h.weightPct}:${encodeDividendRoute(h)}`;
            return base + encodeHoldingTail(h);
        })
        .join(',');
}

export function decodeHoldings(raw: string | null): Holding[] | null {
    if (!raw) return null;
    try {
        const parts = raw.split(',');
        const holdings: Holding[] = [];
        for (const part of parts) {
            const segs = part.split(':');
            const label = segs[0];
            const wStr = segs[1];
            const dStr = segs[2];
            if (!label || wStr === undefined) return null;
            const weightPct = Number(wStr);
            if (!isFinite(weightPct) || weightPct < 0 || weightPct > 100)
                return null;

            const h: Holding = {
                label,
                weightPct,
                dividendRoute: decodeRoute(dStr),
            };

            // Positional tail parsed strictly by index — NO startsWith('d'/'v') guards.
            // A groupId like 'd5' or 'v2' is a valid positional value at seg[5].
            // Keyed tokens (:dN / :vN) are only scanned at seg index >= 7.
            const canSellSeg = segs[3];
            if (canSellSeg && canSellSeg !== '-') {
                h.canSell = canSellSeg === 'L' ? false : undefined;
            }
            const prioritySeg = segs[4];
            if (prioritySeg && prioritySeg !== '-') {
                const p = Number(prioritySeg);
                if (isFinite(p)) h.sellPriority = p;
            }
            const groupIdSeg = segs[5];
            if (groupIdSeg && groupIdSeg !== '-') {
                h.groupId = groupIdSeg;
            }
            const groupWtSeg = segs[6];
            if (groupWtSeg && groupWtSeg !== '-') {
                const gw = Number(groupWtSeg);
                if (isFinite(gw)) h.groupWeightPct = gw;
            }

            // Keyed suffix tokens: scan only segs at index >= 7.
            // Legacy strings (≤6 positional segs, no keyed tokens) are unaffected.
            for (let i = 7; i < segs.length; i++) {
                const seg = segs[i];
                if (!seg) continue;
                if (/^d\d+(\.\d+)?$/.test(seg)) {
                    const v = Number(seg.slice(1));
                    if (isFinite(v)) h.dcaPct = v;
                } else if (/^v\d+(\.\d+)?$/.test(seg)) {
                    const v = Number(seg.slice(1));
                    if (isFinite(v)) h.divPct = v;
                }
            }

            holdings.push(h);
        }
        return holdings.length > 0 ? holdings : null;
    } catch {
        return null;
    }
}

// ── Contribution codec (dca=) ─────────────────────────────────────────────────
// dca=<amount>:<freq>[:<routeKind>[:<routeTarget>]]
// routeKind: 'asset' (→ {kind:'asset',target:segs[3]}), 'dw' (→ {kind:'byDcaWeight'})
// byWeight (default) is omitted from the encoded string.

const VALID_FREQS = new Set<ContributionFreq>(['monthly', 'yearly']);

export function encodeContribution(plan: ContributionPlan): string {
    const base = `${plan.amount}:${plan.freq}`;
    if (!plan.route || plan.route.kind === 'byWeight') return base;
    if (plan.route.kind === 'byDcaWeight') return `${base}:dw`;
    return `${base}:asset:${plan.route.target}`;
}

export function decodeContribution(
    raw: string | null
): ContributionPlan | undefined {
    if (!raw) return undefined;
    const segs = raw.split(':');
    const amtStr = segs[0];
    const freqStr = segs[1];
    const amount = Number(amtStr ?? '');
    if (!isFinite(amount) || amount <= 0) return undefined;
    if (!freqStr || !VALID_FREQS.has(freqStr as ContributionFreq))
        return undefined;
    const plan: ContributionPlan = {
        amount,
        freq: freqStr as ContributionFreq,
    };
    const routeKind = segs[2];
    const routeTarget = segs[3];
    if (routeKind === 'dw') {
        plan.route = { kind: 'byDcaWeight' };
    } else if (routeKind === 'asset' && routeTarget) {
        plan.route = { kind: 'asset', target: routeTarget };
    }
    return plan;
}

// ── Manual flows codec (mf=) ──────────────────────────────────────────────────
// mf=YYYY-MM-DD:amount,YYYY-MM-DD:amount,...
// amount may be negative (withdrawal).

export function encodeManualFlows(
    flows: { date: string; amount: number }[]
): string {
    return flows.map((f) => `${f.date}:${f.amount}`).join(',');
}

export function decodeManualFlows(
    raw: string | null
): { date: string; amount: number }[] | undefined {
    if (!raw) return undefined;
    try {
        const result: { date: string; amount: number }[] = [];
        for (const part of raw.split(',')) {
            // date is YYYY-MM-DD (10 chars), then ':', then amount
            const colonIdx = part.indexOf(':');
            if (colonIdx < 0) continue;
            const date = part.slice(0, colonIdx);
            const amount = Number(part.slice(colonIdx + 1));
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
            if (!isFinite(amount)) continue;
            result.push({ date, amount });
        }
        return result.length > 0 ? result : undefined;
    } catch {
        return undefined;
    }
}

// ── dividendReinvestByWeight flag (drw=) ─────────────────────────────────────
// drw=1 → true; absent or any other value → false.

export function encodeDrw(value: boolean): string | null {
    return value ? '1' : null;
}

export function decodeDrw(raw: string | null): boolean {
    return raw === '1';
}
