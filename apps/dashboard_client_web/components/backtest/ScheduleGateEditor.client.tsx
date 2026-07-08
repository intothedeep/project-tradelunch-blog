'use client';

// components/backtest/ScheduleGateEditor.client.tsx
// Purpose: UI editor for the ScheduleGate — 2-axis model (checkAt × executeAt).
// Mirrors RebalanceTriggerEditor structure.

import type { ScheduleGate, ScheduleGateCondition } from '@/types/backtest';

interface ScheduleGateEditorProps {
    scheduleGate: ScheduleGate | undefined;
    labels: string[];
    onChange: (g: ScheduleGate | undefined) => void;
}

const CHECK_AT_OPTIONS: { value: ScheduleGate['checkAt']; label: string }[] = [
    { value: 'schedule', label: '예약일에만' },
    { value: 'always', label: '상시(매 바)' },
];

const EXECUTE_AT_OPTIONS: {
    value: ScheduleGate['executeAt'];
    label: string;
}[] = [
    { value: 'immediate', label: '즉시' },
    { value: 'nextSchedule', label: '다음 예약일' },
];

const DIR_OPTIONS: { value: ScheduleGateCondition['dir']; label: string }[] = [
    { value: '>=', label: '>=' },
    { value: '<=', label: '<=' },
];

export default function ScheduleGateEditor({
    scheduleGate,
    labels,
    onChange,
}: ScheduleGateEditorProps) {
    const enabled = scheduleGate !== undefined;

    function handleToggle() {
        if (enabled) {
            onChange(undefined);
        } else {
            onChange({
                checkAt: 'schedule',
                executeAt: 'immediate',
                conditions: [{ label: labels[0] ?? '', pct: 60, dir: '>=' }],
            });
        }
    }

    function updateAxis<K extends 'checkAt' | 'executeAt'>(
        key: K,
        value: ScheduleGate[K]
    ) {
        if (!scheduleGate) return;
        onChange({ ...scheduleGate, [key]: value });
    }

    function updateCondition(
        idx: number,
        patch: Partial<ScheduleGateCondition>
    ) {
        if (!scheduleGate) return;
        onChange({
            ...scheduleGate,
            conditions: scheduleGate.conditions.map((c, i) =>
                i === idx ? { ...c, ...patch } : c
            ),
        });
    }

    function addCondition() {
        if (!scheduleGate) return;
        onChange({
            ...scheduleGate,
            conditions: [
                ...scheduleGate.conditions,
                { label: labels[0] ?? '', pct: 60, dir: '>=' },
            ],
        });
    }

    function removeCondition(idx: number) {
        if (!scheduleGate) return;
        onChange({
            ...scheduleGate,
            conditions: scheduleGate.conditions.filter((_, i) => i !== idx),
        });
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <input
                    id="sg-toggle"
                    type="checkbox"
                    checked={enabled}
                    onChange={handleToggle}
                    className="h-3 w-3 cursor-pointer"
                />
                <label
                    htmlFor="sg-toggle"
                    className="cursor-pointer select-none text-xs font-medium"
                >
                    스케줄 조건 리밸런싱 사용
                </label>
            </div>

            {enabled && scheduleGate && (
                <div className="flex flex-col gap-2 border-l-2 border-border pl-3">
                    {/* Axis selectors */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            측정 시점
                        </span>
                        <select
                            value={scheduleGate.checkAt}
                            onChange={(e) =>
                                updateAxis(
                                    'checkAt',
                                    e.target.value as ScheduleGate['checkAt']
                                )
                            }
                            className="w-fit rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label="측정 시점"
                        >
                            {CHECK_AT_OPTIONS.map((opt) => (
                                <option
                                    key={opt.value}
                                    value={opt.value}
                                >
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <span className="text-xs text-muted-foreground">
                            실행 시점
                        </span>
                        <select
                            value={scheduleGate.executeAt}
                            onChange={(e) =>
                                updateAxis(
                                    'executeAt',
                                    e.target.value as ScheduleGate['executeAt']
                                )
                            }
                            className="w-fit rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label="실행 시점"
                        >
                            {EXECUTE_AT_OPTIONS.map((opt) => (
                                <option
                                    key={opt.value}
                                    value={opt.value}
                                >
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Condition rows */}
                    {scheduleGate.conditions.map((cond, idx) => (
                        <div
                            key={idx}
                            className="flex flex-wrap items-center gap-2 text-xs"
                        >
                            <select
                                value={cond.label}
                                onChange={(e) =>
                                    updateCondition(idx, {
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
                            <select
                                value={cond.dir}
                                onChange={(e) =>
                                    updateCondition(idx, {
                                        dir: e.target
                                            .value as ScheduleGateCondition['dir'],
                                    })
                                }
                                className="rounded border border-border bg-background px-1 py-0.5 text-xs focus:outline-none"
                            >
                                {DIR_OPTIONS.map((opt) => (
                                    <option
                                        key={opt.value}
                                        value={opt.value}
                                    >
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min={1}
                                max={99}
                                step={1}
                                value={cond.pct}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    if (isFinite(v))
                                        updateCondition(idx, { pct: v });
                                }}
                                className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs tabular-nums focus:outline-none"
                            />
                            <span className="text-muted-foreground">%</span>
                            <button
                                type="button"
                                onClick={() => removeCondition(idx)}
                                className="ml-1 text-muted-foreground hover:text-destructive"
                                aria-label="Remove condition"
                            >
                                ✕
                            </button>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={addCondition}
                        disabled={labels.length === 0}
                        className="w-fit rounded border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
                    >
                        + 추가
                    </button>
                </div>
            )}
        </div>
    );
}
