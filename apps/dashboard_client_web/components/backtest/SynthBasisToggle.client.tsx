'use client';

// components/backtest/SynthBasisToggle.client.tsx
// Purpose: switch the results section between the real-only headline (pinned to
// realInception) and the selected-range synthetic-inclusive pass (honours the
// chosen `from`). Only mounted for single-method synth (reg/str). Extracted from
// BacktestClient (LOC cleanup), mirrors the inline chart/table view toggle.

export type SynthBasis = 'real' | 'full';

interface SynthBasisToggleProps {
    basis: SynthBasis;
    onChange: (basis: SynthBasis) => void;
}

const OPTIONS: [SynthBasis, string][] = [
    ['real', '실제 데이터'],
    ['full', '합성 포함 (선택 범위)'],
];

export default function SynthBasisToggle({
    basis,
    onChange,
}: SynthBasisToggleProps) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">기준:</span>
            <div className="flex items-center gap-1 rounded-md border p-0.5">
                {OPTIONS.map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onChange(value)}
                        className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                            basis === value
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}
