'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useTheme } from 'next-themes';
import { X } from 'lucide-react';
import {
    selectedIntervalAtom,
    selectedLabelAtom,
    selectedRangeAtom,
} from '@/store/dashboard.atom';
import type { IOHLCPoint } from '@/types/history';
import { computeMA } from '@/utils/computeMA';
import { computeRSI } from '@/utils/computeRSI';
import { computeMACD } from '@/utils/computeMACD';
import { computeIchimoku } from '@/utils/computeIchimoku';
import { generateIntervalCandles } from '@/utils/generateIntervalCandles';
import { formatCandleTime } from '@/utils/chart-format';
import { TV_DARK, TV_LIGHT, type ChartPalette } from '@/lib/chart-theme';
import ChartHeader from '@/components/dashboard/ChartHeader.client';
import ChartTimescale from '@/components/dashboard/ChartTimescale.client';
import ChartConfigMenu from '@/components/dashboard/ChartConfigMenu.client';
import ChartLegend from '@/components/dashboard/ChartLegend.client';
import ChartDrawToolbar from '@/components/dashboard/ChartDrawToolbar.client';
import { useTradingViewChart } from '@/hooks/useTradingViewChart.hook';
import { useChartDrawings } from '@/hooks/useChartDrawings.hook';
import { useDashboardHistory } from '@/hooks/useDashboardSnapshot.query.client';
import type { MAPeriod, MAVisibility, IndicatorState } from '@/types/dashboard';

interface Props {
    className?: string;
}

export default function ChartPanel({ className }: Props) {
    const selectedLabel = useAtomValue(selectedLabelAtom);
    const selectedRange = useAtomValue(selectedRangeAtom);
    const selectedInterval = useAtomValue(selectedIntervalAtom);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartCanvasRef = useRef<HTMLDivElement>(null);
    const gearRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [maVisible, setMaVisible] = useState<MAVisibility>({
        5: false,
        20: false,
        50: false,
        100: false,
        200: false,
    });
    const [rsiVisible, setRsiVisible] = useState(false);
    const [macdVisible, setMacdVisible] = useState(false);
    const [ichimokuVisible, setIchimokuVisible] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => setMounted(true), []);

    // lightweight-charts v5 schedules internal rAFs that can fire after
    // chart.remove() during React strict-mode unmount cycles. The thrown
    // "Object is disposed" comes from fancy-canvas reading sizes on a
    // disposed canvas binding — there's no API to cancel that rAF from
    // outside. Suppress at the window level for the lifetime of this panel.
    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            const msg = event.message ?? '';
            const src = event.filename ?? '';
            if (
                msg.includes('Object is disposed') &&
                (src.includes('fancy-canvas') ||
                    src.includes('lightweight-charts'))
            ) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };
        window.addEventListener('error', onError);
        return () => window.removeEventListener('error', onError);
    }, []);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                gearRef.current?.contains(target) ||
                menuRef.current?.contains(target)
            )
                return;
            setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const palette: ChartPalette =
        resolvedTheme === 'light' ? TV_LIGHT : TV_DARK;

    // History is always fetched at '1d'; W/M/intraday are derived client-side
    // via generateIntervalCandles. Gated by mounted + selectedLabel.
    const historyQuery = useDashboardHistory({
        label: selectedLabel,
        interval: '1d',
        enabled: mounted,
    });

    const candles = useMemo<IOHLCPoint[]>(() => {
        if (selectedLabel === null) return [];
        const res = historyQuery.data;
        const baseDaily = res?.ok && res.data ? res.data.candles : [];
        return generateIntervalCandles(
            selectedLabel,
            selectedInterval,
            baseDaily
        );
    }, [selectedLabel, selectedInterval, historyQuery.data]);

    const maArrays = useMemo(
        () => ({
            5: computeMA(
                candles.map((c) => c.close),
                5
            ),
            20: computeMA(
                candles.map((c) => c.close),
                20
            ),
            50: computeMA(
                candles.map((c) => c.close),
                50
            ),
            100: computeMA(
                candles.map((c) => c.close),
                100
            ),
            200: computeMA(
                candles.map((c) => c.close),
                200
            ),
        }),
        [candles]
    );

    const rsiArr = useMemo(
        () =>
            computeRSI(
                candles.map((c) => c.close),
                14
            ),
        [candles]
    );
    const macdResult = useMemo(
        () =>
            computeMACD(
                candles.map((c) => c.close),
                12,
                26,
                9
            ),
        [candles]
    );
    const ichimoku = useMemo(() => computeIchimoku(candles), [candles]);

    const toggleMA = (p: MAPeriod) =>
        setMaVisible((prev) => ({ ...prev, [p]: !prev[p] }));
    const toggleRSI = () => setRsiVisible((v) => !v);
    const toggleMACD = () => setMacdVisible((v) => !v);
    const toggleIchimoku = () => setIchimokuVisible((v) => !v);

    const indicators = useMemo<IndicatorState>(
        () => ({
            maArrays,
            rsiArr,
            macdResult,
            ichimoku,
            maVisible,
            rsiVisible,
            macdVisible,
            ichimokuVisible,
        }),
        [
            maArrays,
            rsiArr,
            macdResult,
            ichimoku,
            maVisible,
            rsiVisible,
            macdVisible,
            ichimokuVisible,
        ]
    );

    const { hoverIndex, paneRects, chartRef, candleSeriesRef, chartReady } =
        useTradingViewChart({
            containerRef: chartCanvasRef,
            candles,
            indicators,
            palette,
            selectedRange,
            enabled: mounted,
        });

    useChartDrawings({
        chartRef,
        candleSeriesRef,
        chartReady,
        candles,
        label: selectedLabel,
        interval: selectedInterval,
        enabled: mounted,
        haloColor: palette.candleUp,
    });

    if (selectedLabel === null) {
        return (
            <div className="flex items-center justify-center h-full text-sm bg-white dark:bg-[#131722] text-[#787b86]">
                Select an item from the watchlist
            </div>
        );
    }

    if (historyQuery.isPending) {
        return (
            <div className="flex items-center justify-center h-full text-sm bg-white dark:bg-[#131722] text-[#787b86]">
                Loading chart…
            </div>
        );
    }

    // Label is selected but the backend returned no candles (error, unknown
    // label, or a symbol Yahoo doesn't cover — e.g. KOSPI/KOSDAQ). Honest empty
    // state rather than reusing the "select an item" copy.
    if (candles.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-sm bg-white dark:bg-[#131722] text-[#787b86]">
                No chart data available for {selectedLabel}
            </div>
        );
    }

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const lastClose = last?.close ?? 0;
    const prevClose = prev?.close ?? lastClose;
    const change = lastClose - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
    const lastTimeLabel = last !== undefined ? formatCandleTime(last.time) : '';

    const displayIdx = hoverIndex ?? candles.length - 1;
    const displayCandle = candles[displayIdx] ?? null;

    return (
        <div
            className={`flex flex-col h-full bg-white dark:bg-[#131722] ${className ?? ''}`}
        >
            <ChartHeader
                label={selectedLabel}
                lastClose={lastClose}
                change={change}
                changePercent={changePercent}
                menuOpen={menuOpen}
                onToggleMenu={() => setMenuOpen((v) => !v)}
                gearRef={gearRef}
            />
            <div className="flex flex-1 min-h-0">
                <ChartDrawToolbar
                    label={selectedLabel}
                    interval={selectedInterval}
                />
                <div
                    ref={chartContainerRef}
                    className="relative flex-1 min-h-0"
                >
                    <div
                        ref={chartCanvasRef}
                        className="absolute inset-0"
                    />
                    {displayCandle !== null && (
                        <ChartLegend
                            candle={displayCandle}
                            indicators={indicators}
                            idx={displayIdx}
                            palette={palette}
                        />
                    )}
                    {rsiVisible && paneRects.rsi && (
                        <button
                            type="button"
                            onClick={toggleRSI}
                            aria-label="Close RSI"
                            className="absolute right-1 z-20 inline-flex items-center justify-center w-5 h-5 rounded bg-white/80 dark:bg-[#1e222d]/80 text-[#787b86] hover:text-[#131722] dark:hover:text-[#d1d4dc] hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
                            style={{ top: paneRects.rsi.top + 4 }}
                        >
                            <X size={12} />
                        </button>
                    )}
                    {macdVisible && paneRects.macd && (
                        <button
                            type="button"
                            onClick={toggleMACD}
                            aria-label="Close MACD"
                            className="absolute right-1 z-20 inline-flex items-center justify-center w-5 h-5 rounded bg-white/80 dark:bg-[#1e222d]/80 text-[#787b86] hover:text-[#131722] dark:hover:text-[#d1d4dc] hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
                            style={{ top: paneRects.macd.top + 4 }}
                        >
                            <X size={12} />
                        </button>
                    )}
                    {menuOpen && (
                        <ChartConfigMenu
                            containerRef={chartContainerRef}
                            outerRef={menuRef}
                            palette={palette}
                            maVisible={maVisible}
                            rsiVisible={rsiVisible}
                            macdVisible={macdVisible}
                            ichimokuVisible={ichimokuVisible}
                            onToggleMA={toggleMA}
                            onToggleRSI={toggleRSI}
                            onToggleMACD={toggleMACD}
                            onToggleIchimoku={toggleIchimoku}
                            onClose={() => setMenuOpen(false)}
                            initialPos={{ x: 16, y: 50 }}
                        />
                    )}
                </div>
            </div>
            <ChartTimescale lastDate={lastTimeLabel} />
        </div>
    );
}
