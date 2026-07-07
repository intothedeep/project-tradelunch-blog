'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import { type ChartPalette } from '@/lib/chart-theme';
import { MA_PERIODS } from '@/types/dashboard';
import type { MAPeriod, MAVisibility } from '@/types/dashboard';

interface Props {
    containerRef: RefObject<HTMLDivElement | null>;
    outerRef?: RefObject<HTMLDivElement | null>;
    palette: ChartPalette;
    maVisible: MAVisibility;
    rsiVisible: boolean;
    macdVisible: boolean;
    ichimokuVisible: boolean;
    onToggleMA: (p: MAPeriod) => void;
    onToggleRSI: () => void;
    onToggleMACD: () => void;
    onToggleIchimoku: () => void;
    onClose: () => void;
    initialPos: { x: number; y: number };
}

export default function ChartConfigMenu({
    containerRef,
    outerRef,
    palette,
    maVisible,
    rsiVisible,
    macdVisible,
    ichimokuVisible,
    onToggleMA,
    onToggleRSI,
    onToggleMACD,
    onToggleIchimoku,
    onClose,
    initialPos,
}: Props) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState(initialPos);

    const maColors: Record<MAPeriod, string> = {
        5: palette.ma5,
        20: palette.ma20,
        50: palette.ma50,
        100: palette.ma100,
        200: palette.ma200,
    };

    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const startPosX = pos.x;
        const startPosY = pos.y;

        const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startMouseX;
            const dy = ev.clientY - startMouseY;
            let nextX = startPosX + dx;
            let nextY = startPosY + dy;
            const container = containerRef.current;
            const menu = menuRef.current;
            if (container && menu) {
                const maxX = container.clientWidth - menu.offsetWidth;
                const maxY = container.clientHeight - menu.offsetHeight;
                nextX = Math.max(0, Math.min(maxX, nextX));
                nextY = Math.max(0, Math.min(maxY, nextY));
            }
            setPos({ x: nextX, y: nextY });
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    useEffect(() => {
        const container = containerRef.current;
        const menu = menuRef.current;
        if (!container || !menu) return;
        const maxX = Math.max(0, container.clientWidth - menu.offsetWidth);
        const maxY = Math.max(0, container.clientHeight - menu.offsetHeight);
        setPos((prev) => ({
            x: Math.max(0, Math.min(maxX, prev.x)),
            y: Math.max(0, Math.min(maxY, prev.y)),
        }));
    }, [containerRef]);

    const callbackRef = (node: HTMLDivElement | null) => {
        (menuRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
        if (outerRef) {
            (
                outerRef as React.MutableRefObject<HTMLDivElement | null>
            ).current = node;
        }
    };

    return (
        <div
            ref={callbackRef}
            className="absolute z-30 rounded shadow-lg border text-[11px] font-mono select-none"
            style={{
                left: pos.x,
                top: pos.y,
                background: palette.bg,
                borderColor: palette.gridLine,
                color: palette.textPrimary,
            }}
        >
            <div
                onMouseDown={handleDragStart}
                className="flex items-center gap-1 px-2 py-1 border-b cursor-move"
                style={{
                    borderColor: palette.gridLine,
                    color: palette.textSecondary,
                }}
            >
                <GripHorizontal size={12} />
                <span className="uppercase tracking-wide">Indicators</span>
                <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto hover:text-current opacity-70 hover:opacity-100"
                    aria-label="Close"
                >
                    <X size={12} />
                </button>
            </div>
            <div
                className="px-2 py-1 border-b"
                style={{
                    borderColor: palette.gridLine,
                    color: palette.textSecondary,
                }}
            >
                MOVING AVERAGES
            </div>
            <div className="flex flex-col">
                {MA_PERIODS.map((p) => (
                    <label
                        key={p}
                        className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                    >
                        <input
                            type="checkbox"
                            checked={maVisible[p]}
                            onChange={() => onToggleMA(p)}
                            className="cursor-pointer"
                        />
                        <span
                            className="inline-block w-3 h-0.5"
                            style={{ backgroundColor: maColors[p] }}
                        />
                        <span style={{ color: maColors[p] }}>MA{p}</span>
                    </label>
                ))}
            </div>
            <div
                className="px-2 py-1 border-y"
                style={{
                    borderColor: palette.gridLine,
                    color: palette.textSecondary,
                }}
            >
                OSCILLATORS
            </div>
            <div className="flex flex-col">
                <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05]">
                    <input
                        type="checkbox"
                        checked={rsiVisible}
                        onChange={onToggleRSI}
                        className="cursor-pointer"
                    />
                    <span
                        className="inline-block w-3 h-0.5"
                        style={{ backgroundColor: palette.rsi }}
                    />
                    <span style={{ color: palette.rsi }}>RSI(14)</span>
                </label>
                <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05]">
                    <input
                        type="checkbox"
                        checked={macdVisible}
                        onChange={onToggleMACD}
                        className="cursor-pointer"
                    />
                    <span
                        className="inline-block w-3 h-0.5"
                        style={{ backgroundColor: palette.macd }}
                    />
                    <span style={{ color: palette.macd }}>MACD(12,26,9)</span>
                </label>
            </div>
            <div
                className="px-2 py-1 border-y"
                style={{
                    borderColor: palette.gridLine,
                    color: palette.textSecondary,
                }}
            >
                OVERLAYS
            </div>
            <div className="flex flex-col">
                <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05]">
                    <input
                        type="checkbox"
                        checked={ichimokuVisible}
                        onChange={onToggleIchimoku}
                        className="cursor-pointer"
                    />
                    <span className="inline-flex items-center gap-px">
                        <span
                            className="inline-block w-1.5 h-0.5"
                            style={{ backgroundColor: palette.ichimokuTenkan }}
                        />
                        <span
                            className="inline-block w-1.5 h-0.5"
                            style={{ backgroundColor: palette.ichimokuKijun }}
                        />
                        <span
                            className="inline-block w-1.5 h-0.5"
                            style={{ backgroundColor: palette.ichimokuSpanA }}
                        />
                        <span
                            className="inline-block w-1.5 h-0.5"
                            style={{ backgroundColor: palette.ichimokuSpanB }}
                        />
                    </span>
                    <span style={{ color: palette.textPrimary }}>
                        Ichimoku(9,26,52)
                    </span>
                </label>
            </div>
        </div>
    );
}
