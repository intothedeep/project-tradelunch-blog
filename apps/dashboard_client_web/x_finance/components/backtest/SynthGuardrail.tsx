// components/backtest/SynthGuardrail.tsx
// Purpose: shared SYNTHETIC guardrail — ONE canonical banner ensures every
// synthetic render path carries the identical non-dismissible warning label.
// A method can't bypass the label because it flows through this component.
// Pure server component; no interactivity.

import type { SynthPassMeta } from '@/utils/backtest/synth-passes';

interface SynthBannerProps {
    /** Active method — determines supplemental copy. */
    method: 'reg' | 'str' | 'cmp';
    /** Primary (or only) method meta — provides realInception + hasProxy. */
    meta: SynthPassMeta;
    /** Secondary meta (cmp only) — merges hasProxy from both methods. */
    secondaryMeta?: SynthPassMeta;
    className?: string;
}

/**
 * Non-dismissible SYNTHETIC warning banner.
 * Usage:
 *   - ResultChart: rendered above the chart whenever synthMeta is present.
 *   - ComparisonPanel: rendered once above both modeled columns.
 */
export function SynthBanner({
    method,
    meta,
    secondaryMeta,
    className,
}: SynthBannerProps) {
    const hasProxy = meta.hasProxy === true || secondaryMeta?.hasProxy === true;
    return (
        <div
            role="alert"
            className={`rounded border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 flex flex-col gap-0.5 ${className ?? ''}`}
        >
            <span>
                SYNTHETIC — modeled, not real &nbsp;/&nbsp; 합성 — 실제 데이터
                아님 ({meta.realInception} 이전은 모델 추정치)
            </span>
            {method === 'cmp' && (
                <span className="font-normal text-[11px] opacity-80">
                    M1 Regression + M2 Structural — 모델 불확실성 범위 표시
                    (평균 금지)
                </span>
            )}
            {hasProxy && (
                <span className="font-normal text-[11px] text-amber-600/80 dark:text-amber-500/80">
                    ⚠ 2001년 이전 구간: VXN 미존재 → k·VIX 프록시 사용 (proxied
                    vol, pre-2001)
                </span>
            )}
        </div>
    );
}
