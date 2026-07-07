'use client';

// components/backtest/SynthControls.client.tsx
// Purpose: synthetic history controls — toggle, base-asset select, method
// selector. Extracted from BacktestControls (LOC cleanup, Wave-C X2-P2b).
// Behaviour is byte-identical to the inline block it replaces.
// Admin-gated upstream; only mounted when an eligible holding is present.

import type { Holding } from '@/types/backtest';
import type { SynthUrlState } from '@/hooks/useBacktestUrl.hook';

// Short assets eligible for synthetic history (v1: JEPQ only).
const SYNTH_ELIGIBLE = new Set(['JEPQ']);

const SYNTH_BASE_OPTIONS: { value: string; label: string }[] = [
    { value: 'QQQ', label: 'QQQ' },
    { value: 'SPY', label: 'SPY' },
    { value: '^IXIC', label: 'NASDAQ Composite (^IXIC)' },
    { value: '^NDX', label: 'NASDAQ 100 (^NDX)' },
    {
        value: 'QLD',
        label: 'QLD (validation only — 2× leverage, opposite profile)',
    },
    {
        value: 'TQQQ',
        label: 'TQQQ (validation only — 2× leverage, opposite profile)',
    },
];

interface SynthControlsProps {
    holdings: Holding[];
    synth: SynthUrlState | undefined;
    setSynth: (s: SynthUrlState | undefined) => void;
}

export default function SynthControls({
    holdings,
    synth,
    setSynth,
}: SynthControlsProps) {
    const eligibleLabel = holdings.find((h) =>
        SYNTH_ELIGIBLE.has(h.label)
    )?.label;
    if (!eligibleLabel) return null;

    const synthActive = synth?.shortLabel === eligibleLabel;
    const synthBase = synthActive ? synth!.base : 'QQQ';

    function handleToggle() {
        if (synthActive) {
            setSynth(undefined);
        } else {
            setSynth({
                shortLabel: eligibleLabel!,
                base: synthBase,
                method: 'reg',
            });
        }
    }

    function handleBaseChange(base: string) {
        if (!synth) return;
        setSynth({ shortLabel: eligibleLabel!, base, method: synth.method });
    }

    function handleMethodChange(method: 'reg' | 'str' | 'cmp') {
        if (!synth) return;
        setSynth({ shortLabel: eligibleLabel!, base: synthBase, method });
    }

    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                합성 과거 (Synthetic History)
            </span>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                    type="checkbox"
                    checked={synthActive}
                    onChange={handleToggle}
                    className="h-3.5 w-3.5"
                />
                <span>{eligibleLabel} 합성 과거 활성화</span>
            </label>
            {synthActive && (
                <>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 shrink-0">
                            베이스
                        </span>
                        <select
                            value={synthBase}
                            onChange={(e) => handleBaseChange(e.target.value)}
                            className="text-xs rounded border bg-background px-2 py-1 flex-1 min-w-0"
                        >
                            {SYNTH_BASE_OPTIONS.map((o) => (
                                <option
                                    key={o.value}
                                    value={o.value}
                                >
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 shrink-0">
                            방법
                        </span>
                        <select
                            value={synth!.method}
                            onChange={(e) =>
                                handleMethodChange(
                                    e.target.value as 'reg' | 'str' | 'cmp'
                                )
                            }
                            className="text-xs rounded border bg-background px-2 py-1 flex-1 min-w-0"
                        >
                            <option value="reg">Regression</option>
                            <option value="str">Structural</option>
                            <option value="cmp">Compare</option>
                        </select>
                    </div>
                </>
            )}
        </div>
    );
}
