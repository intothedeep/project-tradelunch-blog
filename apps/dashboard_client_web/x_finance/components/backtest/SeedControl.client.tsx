'use client';

// components/backtest/SeedControl.client.tsx
// Purpose: seed input for Monte Carlo reproducibility.
//   - Manual number input (blur / Enter → apply; invalid → keep prior)
//   - Preset chips [1, 42, 2024, 7, 777]
//   - 🎲 Randomize button — ONLY path that generates a new random seed
// Constraints: non-integer / negative / ≥ 2^32 → rejected (prior seed kept).

import { useState } from 'react';
import {
    generateSeed,
    isValidSeed,
    MAX_SEED,
} from '@/hooks/useBacktestUrl.hook';
import { cn } from '@/lib/utils';

interface SeedControlProps {
    seed: number;
    onChange: (v: number) => void;
}

const PRESETS = [1, 42, 2024, 7, 777] as const;

export default function SeedControl({ seed, onChange }: SeedControlProps) {
    // Local input text — allows transient invalid states while the user types.
    const [inputText, setInputText] = useState<string>(String(seed));

    // Synced display value (used when reverting invalid input).
    const syncedText = String(seed);

    function commitInput(raw: string): void {
        const trimmed = raw.trim();
        const n = Number(trimmed);
        if (trimmed === '' || !isValidSeed(n)) {
            // Reject — revert display to current seed.
            setInputText(syncedText);
            return;
        }
        onChange(n);
        setInputText(String(n));
    }

    function handlePreset(preset: number): void {
        onChange(preset);
        setInputText(String(preset));
    }

    function handleRandomize(): void {
        const next = generateSeed();
        onChange(next);
        setInputText(String(next));
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
                <label
                    htmlFor="seed-input"
                    className="text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                    MC Seed
                </label>

                {/* Manual seed input */}
                <input
                    id="seed-input"
                    type="number"
                    min={0}
                    max={MAX_SEED - 1}
                    step={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onBlur={(e) => commitInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            commitInput((e.target as HTMLInputElement).value);
                        }
                    }}
                    className={cn(
                        'w-28 rounded border border-input bg-background px-2 py-1',
                        'text-xs focus:outline-none focus:ring-1 focus:ring-ring'
                    )}
                    aria-label="Monte Carlo seed"
                />

                {/* Preset chips */}
                <div className="flex gap-1 flex-wrap">
                    {PRESETS.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => handlePreset(p)}
                            className={cn(
                                'rounded px-2 py-0.5 text-xs border transition-colors',
                                seed === p
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            )}
                            aria-pressed={seed === p}
                            aria-label={`Set seed to ${p}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>

                {/* Randomize — sole source of new random seeds */}
                <button
                    type="button"
                    onClick={handleRandomize}
                    className={cn(
                        'rounded border border-input bg-background px-2 py-0.5',
                        'text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        'transition-colors'
                    )}
                    aria-label="Randomize Monte Carlo seed"
                >
                    🎲 Randomize
                </button>
            </div>

            {/* Reproducibility hint */}
            <p className="text-[11px] text-muted-foreground leading-tight">
                Same seed → identical Monte Carlo fan. Share the URL to
                reproduce the exact projection.
            </p>
        </div>
    );
}
