'use client'

import type { IOHLCPoint } from '@/types/history'
import type { ChartPalette } from '@/lib/chart-theme'
import { formatPrice, formatVolume, formatOscillator, formatCandleTime } from '@/utils/chart-format'
import { MA_PERIODS } from '@/types/dashboard'
import type { IndicatorState } from '@/types/dashboard'

interface Props {
  candle: IOHLCPoint
  indicators: IndicatorState
  idx: number
  palette: ChartPalette
}

export default function ChartLegend({ candle, indicators, idx, palette }: Props) {
  const { maArrays, rsiArr, macdResult, maVisible, rsiVisible, macdVisible } = indicators
  const isUp = candle.close >= candle.open
  const valueColor = isUp ? palette.candleUp : palette.candleDown
  const labelColor = palette.textSecondary
  const ohlc: Array<[string, string]> = [
    ['O', formatPrice(candle.open)],
    ['H', formatPrice(candle.high)],
    ['L', formatPrice(candle.low)],
    ['C', formatPrice(candle.close)],
    ['Vol', formatVolume(candle.volume)],
  ]
  const maColors: Record<(typeof MA_PERIODS)[number], string> = {
    5: palette.ma5, 20: palette.ma20, 50: palette.ma50, 100: palette.ma100, 200: palette.ma200,
  }
  const rsiAt = rsiArr[idx] ?? null
  const macdAt = macdResult.macd[idx] ?? null
  const signalAt = macdResult.signal[idx] ?? null
  const histAt = macdResult.histogram[idx] ?? null

  return (
    <div
      className="absolute top-2 left-2 z-10 flex flex-col gap-0.5 px-2 py-1 rounded text-[11px] font-mono pointer-events-none select-none"
      style={{ background: palette.bg + 'cc' }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {ohlc.map(([k, v]) => (
          <span key={k} className="tabular-nums">
            <span style={{ color: labelColor }}>{k}</span>{' '}
            <span style={{ color: valueColor }}>{v}</span>
          </span>
        ))}
        <span className="tabular-nums" style={{ color: labelColor }}>{formatCandleTime(candle.time)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {MA_PERIODS.map((p) => {
          const v = maArrays[p][idx]
          const isOn = maVisible[p]
          const text = v !== null && v !== undefined ? formatPrice(v) : '—'
          return (
            <span
              key={p}
              className="tabular-nums"
              style={{ color: isOn ? maColors[p] : labelColor, opacity: isOn ? 1 : 0.5 }}
            >
              MA{p} {text}
            </span>
          )
        })}
      </div>
      {(rsiVisible || macdVisible) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {rsiVisible && (
            <span className="tabular-nums" style={{ color: palette.rsi }}>
              RSI(14) {rsiAt !== null ? formatOscillator(rsiAt) : '—'}
            </span>
          )}
          {macdVisible && (
            <>
              <span className="tabular-nums" style={{ color: palette.macd }}>
                MACD {macdAt !== null ? formatOscillator(macdAt) : '—'}
              </span>
              <span className="tabular-nums" style={{ color: palette.macdSignal }}>
                Signal {signalAt !== null ? formatOscillator(signalAt) : '—'}
              </span>
              <span
                className="tabular-nums"
                style={{ color: histAt !== null && histAt >= 0 ? palette.candleUp : palette.candleDown }}
              >
                Hist {histAt !== null ? formatOscillator(histAt) : '—'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
