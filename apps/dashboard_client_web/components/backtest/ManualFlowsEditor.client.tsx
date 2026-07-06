'use client';

// components/backtest/ManualFlowsEditor.client.tsx
// Purpose: list editor for ad-hoc manual cash flows (X2.19-ui).
// Each row: {date, amount} — amount < 0 = withdrawal.
// In-table inline editing is DEFERRED — add/remove only.

import { useState } from 'react';
import type { ChangeEvent } from 'react';

interface ManualFlow {
    date: string;
    amount: number;
}

interface ManualFlowsEditorProps {
    flows: ManualFlow[] | undefined;
    onChange: (flows: ManualFlow[] | undefined) => void;
}

const today = new Date().toISOString().slice(0, 10);

export default function ManualFlowsEditor({
    flows,
    onChange,
}: ManualFlowsEditorProps) {
    const enabled = flows !== undefined;

    // Local draft for new-row entry
    const [draftDate, setDraftDate] = useState(today);
    const [draftAmount, setDraftAmount] = useState<string>('1000');

    function handleToggle() {
        if (enabled) {
            onChange(undefined);
        } else {
            onChange([]);
        }
    }

    function handleAdd() {
        const amount = Number(draftAmount);
        if (!isFinite(amount) || amount === 0) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate)) return;
        const next = [...(flows ?? []), { date: draftDate, amount }];
        // Sort ascending by date
        next.sort((a, b) => a.date.localeCompare(b.date));
        onChange(next.length > 0 ? next : undefined);
    }

    function handleRemove(idx: number) {
        const next = (flows ?? []).filter((_, i) => i !== idx);
        onChange(next.length > 0 ? next : undefined);
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <input
                    id="mf-toggle"
                    type="checkbox"
                    checked={enabled}
                    onChange={handleToggle}
                    className="h-4 w-4 cursor-pointer"
                />
                <label
                    htmlFor="mf-toggle"
                    className="text-sm font-medium cursor-pointer select-none"
                >
                    수동 현금흐름 (Manual Cash Flow)
                </label>
            </div>

            {enabled && (
                <div className="flex flex-col gap-2 pl-6">
                    {/* Existing rows */}
                    {(flows ?? []).length > 0 && (
                        <div className="flex flex-col gap-1">
                            {(flows ?? []).map((f, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 text-xs font-mono"
                                >
                                    <span className="text-muted-foreground w-24">
                                        {f.date}
                                    </span>
                                    <span
                                        className={
                                            f.amount >= 0
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-destructive'
                                        }
                                    >
                                        {f.amount >= 0 ? '+' : ''}
                                        {f.amount.toLocaleString()}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(i)}
                                        className="ml-auto text-muted-foreground hover:text-destructive"
                                        aria-label={`Remove flow ${f.date}`}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add-row form */}
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="date"
                            value={draftDate}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setDraftDate(e.target.value)
                            }
                            className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            aria-label="Flow date"
                        />
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                                $
                            </span>
                            <input
                                type="number"
                                step={100}
                                value={draftAmount}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    setDraftAmount(e.target.value)
                                }
                                className="w-28 rounded border border-border bg-background px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                                aria-label="Flow amount (negative = withdrawal)"
                                placeholder="-500 = 출금"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAdd}
                            className="rounded border border-border px-3 py-1 text-xs hover:bg-accent"
                        >
                            추가
                        </button>
                        <span className="text-xs text-muted-foreground">
                            음수 = 출금
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
