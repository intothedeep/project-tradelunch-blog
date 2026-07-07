'use client';

// Purpose: Renders the RSI and MACD close (X) buttons overlaid on the chart
// canvas. Positioned absolutely using pane rect measurements from the hook.
// No state; pure presentational component.

import { X } from 'lucide-react';
import type { IndicatorPaneRects } from '@/hooks/useTradingViewChart.hook';

interface Props {
    rsiVisible: boolean;
    macdVisible: boolean;
    paneRects: IndicatorPaneRects;
    onCloseRsi: () => void;
    onCloseMacd: () => void;
}

export default function ChartIndicatorCloseButtons({
    rsiVisible,
    macdVisible,
    paneRects,
    onCloseRsi,
    onCloseMacd,
}: Props) {
    return (
        <>
            {rsiVisible && paneRects.rsi && (
                <button
                    type="button"
                    onClick={onCloseRsi}
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
                    onClick={onCloseMacd}
                    aria-label="Close MACD"
                    className="absolute right-1 z-20 inline-flex items-center justify-center w-5 h-5 rounded bg-white/80 dark:bg-[#1e222d]/80 text-[#787b86] hover:text-[#131722] dark:hover:text-[#d1d4dc] hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
                    style={{ top: paneRects.macd.top + 4 }}
                >
                    <X size={12} />
                </button>
            )}
        </>
    );
}
