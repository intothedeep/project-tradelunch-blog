'use client';

// components/backtest/HoldingAdvancedControls.client.tsx
// Purpose: per-holding optional fields (X2.12) — canSell toggle, sellPriority,
// groupId assignment. Rendered inside WeightSliders per holding row.
// Only emits defined fields when non-default; untouched holdings remain unchanged.

import type { Holding } from '@/types/backtest';

interface HoldingAdvancedControlsProps {
    holding: Holding;
    /** IDs of currently defined asset groups (for the group selector). */
    groupIds: string[];
    onChange: (patch: Partial<Holding>) => void;
}

export default function HoldingAdvancedControls({
    holding,
    groupIds,
    onChange,
}: HoldingAdvancedControlsProps) {
    const canSell = holding.canSell !== false; // undefined treated as true (can sell)
    const sellPriority = holding.sellPriority;
    const groupId = holding.groupId;

    function handleCanSellToggle() {
        // Toggle: true/undefined → false, false → undefined (remove the field)
        onChange({ canSell: canSell ? false : undefined });
    }

    function handlePriorityChange(raw: string) {
        const v = Number(raw);
        if (raw === '' || !isFinite(v) || v < 0) {
            onChange({ sellPriority: undefined });
        } else {
            onChange({ sellPriority: Math.round(v) });
        }
    }

    function handleGroupChange(val: string) {
        onChange({ groupId: val === '' ? undefined : val });
    }

    return (
        <div className="flex flex-wrap items-center gap-2 text-xs pl-2 pt-1 border-t border-border/50">
            {/* canSell toggle — lock icon */}
            <button
                type="button"
                onClick={handleCanSellToggle}
                title={
                    canSell
                        ? '매도 허용 (클릭하면 잠금)'
                        : '매도 잠금 (클릭하면 해제)'
                }
                aria-label={
                    canSell
                        ? 'Selling allowed — click to lock'
                        : 'Selling locked — click to unlock'
                }
                className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 transition-colors hover:bg-accent"
            >
                <span>{canSell ? '🔓' : '🔒'}</span>
                <span className="text-muted-foreground">
                    {canSell ? '매도OK' : '매도잠금'}
                </span>
            </button>

            {/* sellPriority — only visible if canSell is true */}
            {canSell && (
                <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">청산순위</span>
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={sellPriority ?? ''}
                        onChange={(e) => handlePriorityChange(e.target.value)}
                        placeholder="—"
                        className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                        aria-label={`${holding.label} sell priority`}
                    />
                </div>
            )}

            {/* groupId assignment */}
            <div className="flex items-center gap-1">
                <span className="text-muted-foreground">그룹</span>
                <select
                    value={groupId ?? ''}
                    onChange={(e) => handleGroupChange(e.target.value)}
                    aria-label={`${holding.label} group assignment`}
                    className="rounded border border-border bg-background px-1 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    <option value="">없음</option>
                    {groupIds.map((id) => (
                        <option
                            key={id}
                            value={id}
                        >
                            {id}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
