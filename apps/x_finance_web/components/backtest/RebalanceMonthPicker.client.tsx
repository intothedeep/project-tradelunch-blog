'use client';

// components/backtest/RebalanceMonthPicker.client.tsx
// Purpose: checkbox grid for selecting calendar months to rebalance on (freq='custom').

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

interface RebalanceMonthPickerProps {
    months: number[];
    onChange: (m: number[]) => void;
}

export default function RebalanceMonthPicker({
    months,
    onChange,
}: RebalanceMonthPickerProps) {
    const selected = new Set(months);
    const allSelected = selected.size === 12;

    function toggle(m: number) {
        const next = new Set(selected);
        if (next.has(m)) next.delete(m);
        else next.add(m);
        onChange(Array.from(next).sort((a, b) => a - b));
    }

    function toggleAll() {
        if (allSelected) onChange([]);
        else onChange([...ALL_MONTHS]);
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                    리밸런싱 월:
                </span>
                <button
                    type="button"
                    onClick={toggleAll}
                    className="rounded border px-2 py-0.5 text-xs hover:bg-accent"
                >
                    {allSelected ? '전체 해제' : '전체'}
                </button>
            </div>
            <div className="flex flex-wrap gap-1">
                {ALL_MONTHS.map((m) => (
                    <label
                        key={m}
                        className="flex cursor-pointer items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-xs hover:bg-muted"
                    >
                        <input
                            type="checkbox"
                            checked={selected.has(m)}
                            onChange={() => toggle(m)}
                            className="h-3 w-3"
                        />
                        <span>{m}월</span>
                    </label>
                ))}
            </div>
        </div>
    );
}
