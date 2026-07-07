// utils/backtest/url-codec-rebalance.ts
// Purpose: encode/decode the rb= RebalancePolicy query param.
// Grammar:
//   rb= <freq> : <bandKind><bandPct> [; g:<id>@<targetPct>[w] ...] [; <trigger> ...]
//
//   <freq>     = never | bar | monthly | quarterly | yearly
//   <bandKind> = a (absolute) | r (relative)
//   <bandPct>  = numeric, e.g. 5 means 5%
//
//   Group token:    g:<id>@<targetPct>          → rebalanceWithin=false (default)
//                   g:<id>@<targetPct>w          → rebalanceWithin=true
//
//   Trigger tokens (after freq:band and optional groups):
//     tp:<label>:<gainPct>                     → takeProfit, reset=bearTrough (default)
//     tp:<label>:<gainPct>:<reset>             → reset ∈ w|ob|of|bt
//     bd:<label>:<dropPct>                     → buyDip, reset=bearTrough (default)
//     bd:<label>:<dropPct>:<reset>             → reset ∈ w|ob|of|bt
//     wc:<label>:<pct>                         → weightCap
//     wf:<label>:<pct>                         → weightFloor
//
//   Delimiters: outer list=';', internal fields=':'.
//   rb= ABSENT ⇒ rebalance undefined.

import type {
    RebalancePolicy,
    RebalanceTrigger,
    AssetGroup,
    ExtremaReset,
} from '@/types/backtest';

const VALID_FREQS_RB = new Set([
    'never',
    'bar',
    'monthly',
    'quarterly',
    'yearly',
]);

const RESET_ENCODE: Record<ExtremaReset, string> = {
    bearTrough: 'bt',
    window: 'w',
    onBuy: 'ob',
    onFire: 'of',
};
const RESET_DECODE: Record<string, ExtremaReset> = {
    bt: 'bearTrough',
    w: 'window',
    ob: 'onBuy',
    of: 'onFire',
};

function decodeReset(raw: string | undefined): ExtremaReset {
    if (raw === undefined) return 'bearTrough';
    const r = RESET_DECODE[raw];
    return r ?? 'bearTrough';
}

function encodeBandKind(kind: 'absolute' | 'relative'): string {
    return kind === 'absolute' ? 'a' : 'r';
}

function decodeBandKind(c: string): 'absolute' | 'relative' | null {
    if (c === 'a') return 'absolute';
    if (c === 'r') return 'relative';
    return null;
}

function encodeGroup(g: AssetGroup): string {
    const w = g.rebalanceWithin ? 'w' : '';
    return `g:${g.id}@${g.targetPct}${w}`;
}

function decodeGroup(token: string): AssetGroup | null {
    // token = "g:<id>@<targetPct>[w]"
    try {
        const body = token.slice(2); // strip "g:"
        const atIdx = body.lastIndexOf('@');
        if (atIdx < 0) return null;
        const id = body.slice(0, atIdx);
        let rest = body.slice(atIdx + 1);
        const rebalanceWithin = rest.endsWith('w');
        if (rebalanceWithin) rest = rest.slice(0, -1);
        const targetPct = Number(rest);
        if (!id || !isFinite(targetPct)) return null;
        const g: AssetGroup = { id, targetPct };
        if (rebalanceWithin) g.rebalanceWithin = true;
        return g;
    } catch {
        return null;
    }
}

function encodeTrigger(t: RebalanceTrigger): string | null {
    if (t.kind === 'driftBand') return null; // implicit in band head — skip
    if (t.kind === 'takeProfit') {
        const r = t.reset ?? 'bearTrough';
        return `tp:${t.label}:${t.gainPct}:${RESET_ENCODE[r]}`;
    }
    if (t.kind === 'buyDip') {
        const r = t.reset ?? 'bearTrough';
        return `bd:${t.label}:${t.dropPct}:${RESET_ENCODE[r]}`;
    }
    if (t.kind === 'weightCap') return `wc:${t.label}:${t.pct}`;
    if (t.kind === 'weightFloor') return `wf:${t.label}:${t.pct}`;
    return null;
}

function decodeTrigger(
    token: string,
    knownLabels: Set<string>
): RebalanceTrigger | null {
    try {
        const segs = token.split(':');
        const kind = segs[0];
        const seg1 = segs[1];
        const seg2 = segs[2];
        const seg3 = segs[3];

        if (kind === 'tp') {
            if (!seg1 || seg2 === undefined) return null;
            const gainPct = Number(seg2);
            if (!isFinite(gainPct)) return null;
            if (knownLabels.size > 0 && !knownLabels.has(seg1)) return null;
            return {
                kind: 'takeProfit',
                label: seg1,
                gainPct,
                reset: decodeReset(seg3),
            };
        }
        if (kind === 'bd') {
            if (!seg1 || seg2 === undefined) return null;
            const dropPct = Number(seg2);
            if (!isFinite(dropPct)) return null;
            if (knownLabels.size > 0 && !knownLabels.has(seg1)) return null;
            return {
                kind: 'buyDip',
                label: seg1,
                dropPct,
                reset: decodeReset(seg3),
            };
        }
        if (kind === 'wc') {
            if (!seg1 || seg2 === undefined) return null;
            const pct = Number(seg2);
            if (!isFinite(pct)) return null;
            if (knownLabels.size > 0 && !knownLabels.has(seg1)) return null;
            return { kind: 'weightCap', label: seg1, pct };
        }
        if (kind === 'wf') {
            if (!seg1 || seg2 === undefined) return null;
            const pct = Number(seg2);
            if (!isFinite(pct)) return null;
            if (knownLabels.size > 0 && !knownLabels.has(seg1)) return null;
            return { kind: 'weightFloor', label: seg1, pct };
        }
        return null; // unknown prefix → skip
    } catch {
        return null;
    }
}

export function encodeRebalance(policy: RebalancePolicy): string {
    const bandKind = encodeBandKind(policy.band.kind);
    const head = `${policy.freq}:${bandKind}${policy.band.pct}`;

    const groupTokens = policy.groups.map(encodeGroup);
    const triggerTokens = (policy.triggers ?? [])
        .map(encodeTrigger)
        .filter((t): t is string => t !== null);

    const all = [head, ...groupTokens, ...triggerTokens];
    return all.join(';');
}

export function decodeRebalance(
    raw: string | null,
    knownLabels: Set<string> = new Set()
): RebalancePolicy | undefined {
    if (!raw) return undefined;
    try {
        const tokens = raw.split(';');

        // First token: "<freq>:<bandKind><bandPct>"
        const head = tokens[0];
        if (!head) return undefined;
        const colonIdx = head.indexOf(':');
        if (colonIdx < 0) return undefined;

        const freq = head.slice(0, colonIdx);
        if (!VALID_FREQS_RB.has(freq)) return undefined;

        const bandStr = head.slice(colonIdx + 1);
        if (bandStr.length < 2) return undefined;
        const bandKindChar = bandStr[0];
        if (!bandKindChar) return undefined;
        const bandKind = decodeBandKind(bandKindChar);
        if (!bandKind) return undefined;
        const bandPct = Number(bandStr.slice(1));
        if (!isFinite(bandPct)) return undefined;

        const groups: AssetGroup[] = [];
        const triggers: RebalanceTrigger[] = [];

        for (let i = 1; i < tokens.length; i++) {
            const tok = tokens[i];
            if (!tok) continue;
            if (tok.startsWith('g:')) {
                const g = decodeGroup(tok);
                if (g) groups.push(g);
            } else {
                const t = decodeTrigger(tok, knownLabels);
                if (t) triggers.push(t);
            }
        }

        const policy: RebalancePolicy = {
            freq: freq as RebalancePolicy['freq'],
            band: { kind: bandKind, pct: bandPct },
            groups,
        };
        if (triggers.length > 0) policy.triggers = triggers;
        return policy;
    } catch {
        return undefined;
    }
}
