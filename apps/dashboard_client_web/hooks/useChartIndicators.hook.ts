'use client';

// Purpose: Manages indicator toggle state and computes memoized indicator
// arrays from raw candles. Single responsibility: indicator state + derived
// data. No chart interaction, no DOM refs.

import { useMemo, useState } from 'react';
import type { IOHLCPoint } from '@/types/history';
import type {
    MAVisibility,
    MAArrays,
    MAPeriod,
    MACDResult,
    IchimokuResult,
    IndicatorState,
} from '@/types/dashboard';
import { computeMA } from '@/utils/computeMA';
import { computeRSI } from '@/utils/computeRSI';
import { computeMACD } from '@/utils/computeMACD';
import { computeIchimoku } from '@/utils/computeIchimoku';

interface ChartIndicatorsReturn {
    indicators: IndicatorState;
    maVisible: MAVisibility;
    rsiVisible: boolean;
    macdVisible: boolean;
    ichimokuVisible: boolean;
    toggleMA: (p: MAPeriod) => void;
    toggleRSI: () => void;
    toggleMACD: () => void;
    toggleIchimoku: () => void;
}

export function useChartIndicators(
    candles: IOHLCPoint[]
): ChartIndicatorsReturn {
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

    const maArrays = useMemo<MAArrays>(
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

    const rsiArr = useMemo<(number | null)[]>(
        () =>
            computeRSI(
                candles.map((c) => c.close),
                14
            ),
        [candles]
    );

    const macdResult = useMemo<MACDResult>(
        () =>
            computeMACD(
                candles.map((c) => c.close),
                12,
                26,
                9
            ),
        [candles]
    );

    const ichimoku = useMemo<IchimokuResult>(
        () => computeIchimoku(candles),
        [candles]
    );

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

    const toggleMA = (p: MAPeriod) =>
        setMaVisible((prev) => ({ ...prev, [p]: !prev[p] }));
    const toggleRSI = () => setRsiVisible((v) => !v);
    const toggleMACD = () => setMacdVisible((v) => !v);
    const toggleIchimoku = () => setIchimokuVisible((v) => !v);

    return {
        indicators,
        maVisible,
        rsiVisible,
        macdVisible,
        ichimokuVisible,
        toggleMA,
        toggleRSI,
        toggleMACD,
        toggleIchimoku,
    };
}
