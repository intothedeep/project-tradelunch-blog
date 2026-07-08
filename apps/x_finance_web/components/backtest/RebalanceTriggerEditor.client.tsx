'use client';

// components/backtest/RebalanceTriggerEditor.client.tsx
// Purpose: trigger rows editor for RebalancePolicyPanel — weightCap/Floor (primary)
// and takeProfit/buyDip (advanced, behind sub-collapsible).

import { useState } from 'react';
import type { RebalanceTrigger } from '@/types/backtest';

interface RebalanceTriggerEditorProps {
    triggers: RebalanceTrigger[];
    labels: string[];
    onChange: (triggers: RebalanceTrigger[]) => void;
}

export default function RebalanceTriggerEditor({
    triggers,
    labels,
    onChange,
}: RebalanceTriggerEditorProps) {
    const [showAdv, setShowAdv] = useState(false);

    const primaryTriggers = triggers.filter(
        (t) => t.kind === 'weightCap' || t.kind === 'weightFloor'
    );
    const advTriggers = triggers.filter(
        (t) => t.kind === 'takeProfit' || t.kind === 'buyDip'
    );

    function update(idx: number, patch: Partial<RebalanceTrigger>) {
        const next = triggers.map((t, i) =>
            i === idx ? ({ ...t, ...patch } as RebalanceTrigger) : t
        );
        onChange(next);
    }

    function remove(idx: number) {
        onChange(triggers.filter((_, i) => i !== idx));
    }

    function addWeightCap() {
        const label = labels[0] ?? '';
        onChange([...triggers, { kind: 'weightCap', label, pct: 60 }]);
    }

    function addTakeProfit() {
        const label = labels[0] ?? '';
        onChange([
            ...triggers,
            { kind: 'takeProfit', label, gainPct: 20, reset: 'bearTrough' },
        ]);
    }

    function addBuyDip() {
        const label = labels[0] ?? '';
        onChange([
            ...triggers,
            { kind: 'buyDip', label, dropPct: 15, reset: 'bearTrough' },
        ]);
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Primary: weightCap / weightFloor */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium">비중 한도 트리거</span>
                {labels.length > 0 && (
                    <button
                        type="button"
                        onClick={addWeightCap}
                        className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
                    >
                        + 추가
                    </button>
                )}
            </div>
            {primaryTriggers.map((t) => {
                const idx = triggers.indexOf(t);
                if (t.kind !== 'weightCap' && t.kind !== 'weightFloor')
                    return null;
                return (
                    <div
                        key={idx}
                        className="flex flex-wrap items-center gap-2 text-xs"
                    >
                        <select
                            value={t.kind}
                            onChange={(e) =>
                                update(idx, {
                                    kind: e.target.value as
                                        | 'weightCap'
                                        | 'weightFloor',
                                })
                            }
                            className="rounded border border-border bg-background px-1 py-0.5 text-xs focus:outline-none"
                        >
                            <option value="weightCap">상한 cap</option>
                            <option value="weightFloor">하한 floor</option>
                        </select>
                        <select
                            value={t.label}
                            onChange={(e) =>
                                update(idx, { label: e.target.value })
                            }
                            className="rounded border border-border bg-background px-1 py-0.5 text-xs font-mono focus:outline-none"
                        >
                            {labels.map((l) => (
                                <option
                                    key={l}
                                    value={l}
                                >
                                    {l}
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min={1}
                            max={99}
                            step={1}
                            value={t.pct}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (isFinite(v)) update(idx, { pct: v });
                            }}
                            className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs tabular-nums focus:outline-none"
                        />
                        <span className="text-muted-foreground">%</span>
                        <button
                            type="button"
                            onClick={() => remove(idx)}
                            className="ml-1 text-muted-foreground hover:text-destructive"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}

            {/* Advanced: takeProfit / buyDip */}
            <button
                type="button"
                onClick={() => setShowAdv((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <span>{showAdv ? '▼' : '▶'}</span>
                고급 트리거 (익절 / 저점매수)
                {advTriggers.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-primary">
                        {advTriggers.length}
                    </span>
                )}
            </button>
            {showAdv && (
                <div className="flex flex-col gap-2 border-l-2 border-border pl-3">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={addTakeProfit}
                            disabled={labels.length === 0}
                            className="rounded border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
                        >
                            + 익절
                        </button>
                        <button
                            type="button"
                            onClick={addBuyDip}
                            disabled={labels.length === 0}
                            className="rounded border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
                        >
                            + 저점매수
                        </button>
                    </div>
                    {advTriggers.map((t) => {
                        const idx = triggers.indexOf(t);
                        if (t.kind === 'takeProfit') {
                            return (
                                <div
                                    key={idx}
                                    className="flex flex-wrap items-center gap-2 text-xs"
                                >
                                    <span className="font-mono text-muted-foreground">
                                        익절
                                    </span>
                                    <select
                                        value={t.label}
                                        onChange={(e) =>
                                            update(idx, {
                                                label: e.target.value,
                                            })
                                        }
                                        className="rounded border border-border bg-background px-1 py-0.5 text-xs font-mono focus:outline-none"
                                    >
                                        {labels.map((l) => (
                                            <option
                                                key={l}
                                                value={l}
                                            >
                                                {l}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min={1}
                                        max={500}
                                        step={1}
                                        value={t.gainPct}
                                        onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (isFinite(v))
                                                update(idx, { gainPct: v });
                                        }}
                                        className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs tabular-nums focus:outline-none"
                                    />
                                    <span className="text-muted-foreground">
                                        % 상승 시
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => remove(idx)}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        }
                        if (t.kind === 'buyDip') {
                            return (
                                <div
                                    key={idx}
                                    className="flex flex-wrap items-center gap-2 text-xs"
                                >
                                    <span className="font-mono text-muted-foreground">
                                        저점
                                    </span>
                                    <select
                                        value={t.label}
                                        onChange={(e) =>
                                            update(idx, {
                                                label: e.target.value,
                                            })
                                        }
                                        className="rounded border border-border bg-background px-1 py-0.5 text-xs font-mono focus:outline-none"
                                    >
                                        {labels.map((l) => (
                                            <option
                                                key={l}
                                                value={l}
                                            >
                                                {l}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        step={1}
                                        value={t.dropPct}
                                        onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (isFinite(v))
                                                update(idx, { dropPct: v });
                                        }}
                                        className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs tabular-nums focus:outline-none"
                                    />
                                    <span className="text-muted-foreground">
                                        % 하락 시
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => remove(idx)}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            )}
        </div>
    );
}
