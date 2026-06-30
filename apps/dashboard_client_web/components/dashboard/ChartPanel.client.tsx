'use client';

// Budget: ≤210 LOC (post-extraction floor; global limit ≤300). Indicator state → useChartIndicators; menu state →
// useChartPanelMenu; derived header values → deriveChartHeader; RSI/MACD
// close buttons → ChartIndicatorCloseButtons.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useTheme } from 'next-themes';
import {
    selectedIntervalAtom,
    selectedLabelAtom,
    selectedRangeAtom,
} from '@/store/dashboard.atom';
import type { IOHLCPoint } from '@/types/history';
import { generateIntervalCandles } from '@/utils/generateIntervalCandles';
import { TV_DARK, TV_LIGHT, type ChartPalette } from '@/lib/chart-theme';
import { deriveChartHeader } from '@/utils/chart-panel-derive';
import ChartHeader from '@/components/dashboard/ChartHeader.client';
import ChartTimescale from '@/components/dashboard/ChartTimescale.client';
import ChartConfigMenu from '@/components/dashboard/ChartConfigMenu.client';
import ChartLegend from '@/components/dashboard/ChartLegend.client';
import ChartDrawToolbar from '@/components/dashboard/ChartDrawToolbar.client';
import ChartIndicatorCloseButtons from '@/components/dashboard/ChartIndicatorCloseButtons.client';
import { useTradingViewChart } from '@/hooks/useTradingViewChart.hook';
import { useChartDrawings } from '@/hooks/useChartDrawings.hook';
import { useDashboardHistory } from '@/hooks/useDashboardSnapshot.query.client';
import { useChartIndicators } from '@/hooks/useChartIndicators.hook';
import { useChartPanelMenu } from '@/hooks/useChartPanelMenu.hook';

interface Props {
    className?: string;
}

export default function ChartPanel({ className }: Props) {
    const selectedLabel = useAtomValue(selectedLabelAtom);
    const selectedRange = useAtomValue(selectedRangeAtom);
    const selectedInterval = useAtomValue(selectedIntervalAtom);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartCanvasRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const { menuOpen, setMenuOpen, gearRef, menuRef } = useChartPanelMenu();

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

    const {
        indicators,
        maVisible,
        rsiVisible,
        macdVisible,
        ichimokuVisible,
        toggleMA,
        toggleRSI,
        toggleMACD,
        toggleIchimoku,
    } = useChartIndicators(candles);

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

    const {
        lastClose,
        change,
        changePercent,
        lastTimeLabel,
        displayIdx,
        displayCandle,
    } = deriveChartHeader(candles, hoverIndex);

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
                    <ChartIndicatorCloseButtons
                        rsiVisible={rsiVisible}
                        macdVisible={macdVisible}
                        paneRects={paneRects}
                        onCloseRsi={toggleRSI}
                        onCloseMacd={toggleMACD}
                    />
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
