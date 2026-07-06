'use client';

// components/backtest/RebalancePolicyPanel.client.tsx
// Purpose: UI for RebalancePolicy — freq, band, groups editor, triggers (delegated).
// Progressive disclosure: weight-ratio path (driftBand/weightCap) is primary/simple.
// Default policy = OFF (freq:'never'). Calls onChange only on explicit user action.

import { cn } from '@/lib/utils';
import type {
    RebalancePolicy,
    AssetGroup,
    RebalanceTrigger,
} from '@/types/backtest';
import RebalanceTriggerEditor from './RebalanceTriggerEditor.client';

interface RebalancePolicyPanelProps {
    policy: RebalancePolicy | undefined;
    labels: string[];
    onChange: (policy: RebalancePolicy | undefined) => void;
}

const FREQ_OPTIONS: { value: RebalancePolicy['freq']; label: string }[] = [
    { value: 'monthly', label: '월별' },
    { value: 'quarterly', label: '분기별' },
    { value: 'yearly', label: '연간' },
    { value: 'bar', label: '매일' },
];

const DEFAULT_POLICY: RebalancePolicy = {
    freq: 'quarterly',
    band: { kind: 'relative', pct: 5 },
    groups: [],
};

export default function RebalancePolicyPanel({
    policy,
    labels,
    onChange,
}: RebalancePolicyPanelProps) {
    const enabled = policy !== undefined && policy.freq !== 'never';

    function handleToggle() {
        onChange(enabled ? undefined : DEFAULT_POLICY);
    }

    if (!enabled) {
        return (
            <div className="flex items-center gap-2">
                <input
                    id="rb-toggle"
                    type="checkbox"
                    checked={false}
                    onChange={handleToggle}
                    className="h-4 w-4 cursor-pointer"
                />
                <label
                    htmlFor="rb-toggle"
                    className="text-sm font-medium cursor-pointer select-none"
                >
                    리밸런싱 (Rebalancing)
                </label>
            </div>
        );
    }

    const rb = policy!;

    function update(patch: Partial<RebalancePolicy>) {
        onChange({ ...rb, ...patch });
    }

    function updateBand(patch: Partial<RebalancePolicy['band']>) {
        update({ band: { ...rb.band, ...patch } });
    }

    function addGroup() {
        const id = `G${rb.groups.length + 1}`;
        const existing = rb.groups.reduce((s, g) => s + g.targetPct, 0);
        const remaining = Math.max(0, 100 - existing);
        update({ groups: [...rb.groups, { id, targetPct: remaining }] });
    }

    function updateGroup(idx: number, patch: Partial<AssetGroup>) {
        update({
            groups: rb.groups.map((g, i) =>
                i === idx ? { ...g, ...patch } : g
            ),
        });
    }

    function removeGroup(idx: number) {
        update({ groups: rb.groups.filter((_, i) => i !== idx) });
    }

    function handleTriggersChange(triggers: RebalanceTrigger[]) {
        update({ triggers: triggers.length > 0 ? triggers : undefined });
    }

    const groupSum = rb.groups.reduce((s, g) => s + g.targetPct, 0);

    return (
        <div className="flex flex-col gap-3">
            {/* Toggle + freq */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <input
                        id="rb-toggle"
                        type="checkbox"
                        checked={true}
                        onChange={handleToggle}
                        className="h-4 w-4 cursor-pointer"
                    />
                    <label
                        htmlFor="rb-toggle"
                        className="text-sm font-medium cursor-pointer select-none"
                    >
                        리밸런싱 (Rebalancing)
                    </label>
                </div>
                <div
                    className="flex gap-1"
                    role="group"
                    aria-label="Rebalance frequency"
                >
                    {FREQ_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => update({ freq: opt.value })}
                            className={cn(
                                'rounded px-2.5 py-1 text-xs border transition-colors',
                                rb.freq === opt.value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'border-border hover:bg-muted'
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Band (drift threshold) */}
            <div className="flex flex-wrap items-center gap-2 pl-6">
                <span className="text-xs text-muted-foreground">
                    허용 오차:
                </span>
                <select
                    value={rb.band.kind}
                    onChange={(e) =>
                        updateBand({
                            kind: e.target.value as 'absolute' | 'relative',
                        })
                    }
                    className="rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Band kind"
                >
                    <option value="relative">상대 %</option>
                    <option value="absolute">절대 %p</option>
                </select>
                <input
                    type="number"
                    min={0.1}
                    max={50}
                    step={0.5}
                    value={rb.band.pct}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (isFinite(v) && v > 0) updateBand({ pct: v });
                    }}
                    className="w-16 rounded border border-border bg-background px-2 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Band threshold %"
                />
                <span className="text-xs text-muted-foreground">%</span>
            </div>

            {/* Triggers (delegated) */}
            <div className="pl-6">
                <RebalanceTriggerEditor
                    triggers={rb.triggers ?? []}
                    labels={labels}
                    onChange={handleTriggersChange}
                />
            </div>

            {/* Groups editor */}
            <div className="flex flex-col gap-2 pl-6">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                        자산 그룹
                        {rb.groups.length > 0 && (
                            <span
                                className={cn(
                                    'ml-1',
                                    groupSum !== 100
                                        ? 'text-destructive'
                                        : 'text-green-600 dark:text-green-400'
                                )}
                            >
                                ({groupSum}%)
                            </span>
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={addGroup}
                        className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
                    >
                        + 그룹 추가
                    </button>
                </div>
                {rb.groups.map((g, i) => (
                    <div
                        key={i}
                        className="flex flex-wrap items-center gap-2 text-xs"
                    >
                        <input
                            type="text"
                            value={g.id}
                            onChange={(e) =>
                                updateGroup(i, { id: e.target.value })
                            }
                            className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs font-mono focus:outline-none"
                            aria-label="Group ID"
                            placeholder="ID"
                        />
                        <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={g.targetPct}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (isFinite(v))
                                    updateGroup(i, { targetPct: v });
                            }}
                            className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs tabular-nums focus:outline-none"
                            aria-label="Group target %"
                        />
                        <span className="text-muted-foreground">%</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={g.rebalanceWithin ?? false}
                                onChange={(e) =>
                                    updateGroup(i, {
                                        rebalanceWithin: e.target.checked,
                                    })
                                }
                                className="h-3 w-3"
                            />
                            <span className="text-muted-foreground">
                                내부 리밸
                            </span>
                        </label>
                        <button
                            type="button"
                            onClick={() => removeGroup(i)}
                            className="ml-1 text-muted-foreground hover:text-destructive"
                            aria-label="Remove group"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
