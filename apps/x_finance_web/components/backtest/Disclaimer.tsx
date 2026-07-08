// components/backtest/Disclaimer.tsx
// Purpose: always-visible legal disclaimer. Shown on every backtest surface.
// en/ko text is inlined here since the messages/ files only have a ping/pong
// entry and a full i18n setup for a single string is disproportionate overhead.

interface DisclaimerProps {
    locale?: string;
}

const TEXT = {
    en: 'Past performance does not guarantee future results. This tool is for personal research and educational purposes only — not investment advice.',
    ko: '과거 성과는 미래 결과를 보장하지 않습니다. 이 도구는 개인 리서치 및 교육 목적으로만 제공되며 투자 조언이 아닙니다.',
};

export default function Disclaimer({ locale }: DisclaimerProps) {
    const text = locale === 'ko' ? TEXT.ko : TEXT.en;

    return (
        <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
            ⚠ {text}
        </p>
    );
}
