'use client'

import { useAtom } from 'jotai'
import { cn } from '@/lib/utils'
import { selectedRangeAtom, type ChartRange } from '@/store/dashboard.atom'

const RANGES: readonly ChartRange[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All']

interface Props {
  lastDate: string
}

export default function ChartTimescale({ lastDate }: Props) {
  const [selectedRange, setSelectedRange] = useAtom(selectedRangeAtom)

  return (
    <div className="flex items-center px-3 py-1 bg-white dark:bg-[#1e222d] border-t border-[#e0e3eb] dark:border-[#2a2e39]">
      <div className="flex items-center gap-0.5">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setSelectedRange(r)}
            className={cn(
              'px-2 py-0.5 text-xs rounded',
              r === selectedRange
                ? 'bg-[#2962ff] text-white font-semibold'
                : 'text-[#787b86] hover:text-[#131722] dark:hover:text-[#d1d4dc] hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2 text-xs text-[#787b86]">
        <span>(UTC-5)</span>
        <span>{lastDate}</span>
      </div>
    </div>
  )
}
