'use client';

// Purpose: vertical drawing-tools strip placed left of the chart canvas.
// Cycles magnet mode off → loose → strong, supports clear-all and
// undo (last drawing on current label::interval).

import { useAtom, useSetAtom } from 'jotai';
import {
    MousePointer2,
    Minus,
    TrendingUp,
    MoveUpRight,
    Square,
    Magnet,
    Trash2,
    Undo2,
    Spline,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    activeDrawToolAtom,
    drawingsAtom,
    drawingsKey,
    inProgressDrawingAtom,
    magnetModeAtom,
    selectedDrawingIdAtom,
    type MagnetMode,
} from '@/store/drawings.atom';
import type { DrawingKind } from '@/lib/drawings/types';

const TOOLS: Array<{ kind: DrawingKind; label: string; Icon: typeof Minus }> = [
    { kind: 'horizontal_line', label: 'Horizontal line', Icon: Minus },
    { kind: 'vertical_line', label: 'Vertical line', Icon: Spline },
    { kind: 'trend_line', label: 'Trend line', Icon: TrendingUp },
    { kind: 'ray', label: 'Ray', Icon: MoveUpRight },
    { kind: 'parallel_channel', label: 'Parallel channel', Icon: Square },
    { kind: 'fib_retracement', label: 'Fibonacci retracement', Icon: Minus },
    { kind: 'fib_extension', label: 'Fibonacci extension', Icon: Minus },
];

const MAGNET_NEXT: Record<MagnetMode, MagnetMode> = {
    off: 'loose',
    loose: 'strong',
    strong: 'off',
};

const MAGNET_LABEL: Record<MagnetMode, string> = {
    off: 'Magnet: off',
    loose: 'Magnet: loose (snaps near OHLC)',
    strong: 'Magnet: strong (snaps to H/L)',
};

interface Props {
    label: string | null;
    interval: string;
}

export default function ChartDrawToolbar({ label, interval }: Props) {
    const [activeTool, setActiveTool] = useAtom(activeDrawToolAtom);
    const [magnet, setMagnet] = useAtom(magnetModeAtom);
    const [drawingsByKey, setDrawingsByKey] = useAtom(drawingsAtom);
    const setInProgress = useSetAtom(inProgressDrawingAtom);
    const setSelectedId = useSetAtom(selectedDrawingIdAtom);

    const key = label !== null ? drawingsKey(label, interval) : null;
    const drawings = key !== null ? (drawingsByKey[key] ?? []) : [];

    const selectTool = (kind: DrawingKind) => {
        setInProgress(null);
        setSelectedId(null);
        setActiveTool((prev) => (prev === kind ? null : kind));
    };

    const undo = () => {
        if (key === null) return;
        setDrawingsByKey((prev) => {
            const list = prev[key] ?? [];
            if (list.length === 0) return prev;
            return { ...prev, [key]: list.slice(0, -1) };
        });
        setSelectedId(null);
    };

    const clearAll = () => {
        if (key === null) return;
        setDrawingsByKey((prev) => ({ ...prev, [key]: [] }));
        setSelectedId(null);
        setInProgress(null);
        setActiveTool(null);
    };

    const btn = (active: boolean) =>
        cn(
            'inline-flex items-center justify-center w-8 h-8 rounded',
            active
                ? 'bg-[#2962ff] text-white'
                : 'text-[#787b86] hover:text-[#131722] dark:hover:text-[#d1d4dc] hover:bg-black/[0.06] dark:hover:bg-white/[0.06]'
        );

    return (
        <div className="flex flex-col items-center gap-1 w-10 py-2 bg-white dark:bg-[#1e222d] border-r border-[#e0e3eb] dark:border-[#2a2e39]">
            <button
                type="button"
                onClick={() => {
                    setActiveTool(null);
                    setInProgress(null);
                }}
                title="Pointer"
                aria-label="Pointer"
                aria-pressed={activeTool === null}
                className={btn(activeTool === null)}
            >
                <MousePointer2 size={14} />
            </button>
            <span className="block w-6 h-px bg-[#e0e3eb] dark:bg-[#2a2e39]" />
            {TOOLS.map(({ kind, label: tooltip, Icon }) => (
                <button
                    key={kind}
                    type="button"
                    onClick={() => selectTool(kind)}
                    title={tooltip}
                    aria-label={tooltip}
                    aria-pressed={activeTool === kind}
                    className={btn(activeTool === kind)}
                >
                    <Icon size={14} />
                </button>
            ))}
            <span className="block w-6 h-px bg-[#e0e3eb] dark:bg-[#2a2e39]" />
            <button
                type="button"
                onClick={() => setMagnet(MAGNET_NEXT[magnet])}
                title={MAGNET_LABEL[magnet]}
                aria-label={MAGNET_LABEL[magnet]}
                aria-pressed={magnet !== 'off'}
                className={btn(magnet !== 'off')}
                style={
                    magnet === 'strong'
                        ? { background: '#ef5350', color: 'white' }
                        : undefined
                }
            >
                <Magnet size={14} />
            </button>
            <span className="block w-6 h-px bg-[#e0e3eb] dark:bg-[#2a2e39]" />
            <button
                type="button"
                onClick={undo}
                disabled={drawings.length === 0}
                title="Undo last drawing"
                aria-label="Undo last drawing"
                className={cn(
                    btn(false),
                    drawings.length === 0 && 'opacity-30 cursor-not-allowed'
                )}
            >
                <Undo2 size={14} />
            </button>
            <button
                type="button"
                onClick={clearAll}
                disabled={drawings.length === 0}
                title="Clear all drawings"
                aria-label="Clear all drawings"
                className={cn(
                    btn(false),
                    drawings.length === 0 && 'opacity-30 cursor-not-allowed'
                )}
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}
