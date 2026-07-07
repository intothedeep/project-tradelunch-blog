// components/backtest/BudgetInput.tsx
// Purpose: positive-only dollar budget input for the backtest.
// Invalid (non-positive, NaN) value disables the run button via `isValid` prop callback.

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface BudgetInputProps {
    value: number;
    onChange: (value: number, isValid: boolean) => void;
    disabled?: boolean;
}

export default function BudgetInput({
    value,
    onChange,
    disabled,
}: BudgetInputProps) {
    const id = useId();
    const [raw, setRaw] = useState(() => value.toLocaleString('en-US'));

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const text = e.target.value;
        setRaw(text);
        // Strip commas/$ for parsing
        const numeric = Number(text.replace(/[,$]/g, '').trim());
        const valid = isFinite(numeric) && numeric > 0;
        onChange(valid ? numeric : 0, valid);
    }

    function handleBlur() {
        // Re-format on blur if valid
        const numeric = Number(raw.replace(/[,$]/g, '').trim());
        if (isFinite(numeric) && numeric > 0) {
            setRaw(numeric.toLocaleString('en-US'));
            onChange(numeric, true);
        }
    }

    const isValid = (() => {
        const numeric = Number(raw.replace(/[,$]/g, '').trim());
        return isFinite(numeric) && numeric > 0;
    })();

    return (
        <div className="flex flex-col gap-1">
            <label
                htmlFor={id}
                className="text-sm font-medium"
            >
                Initial Budget
            </label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                </span>
                <input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    value={raw}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={disabled}
                    className={cn(
                        'w-full rounded-md border bg-background px-8 py-2 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-ring',
                        !isValid && 'border-destructive',
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    aria-invalid={!isValid}
                />
            </div>
            {!isValid && (
                <p className="text-xs text-destructive">
                    Enter a positive dollar amount.
                </p>
            )}
        </div>
    );
}
