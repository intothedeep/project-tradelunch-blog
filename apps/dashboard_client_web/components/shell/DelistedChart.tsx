// Decorative 404 illustration: a price chart that rallies, then the page gets
// "delisted" and the last candle falls through the floor. Pure SVG + CSS so it
// renders on the server with no JS; colors come from theme tokens.

type Candle = { open: number; close: number; high: number; low: number };

// y grows downward (SVG space); lower number = higher price.
const CANDLES: Candle[] = [
    { open: 150, close: 138, high: 132, low: 156 },
    { open: 138, close: 142, high: 130, low: 148 },
    { open: 142, close: 120, high: 114, low: 146 },
    { open: 120, close: 108, high: 100, low: 126 },
    { open: 108, close: 116, high: 102, low: 122 },
    { open: 116, close: 92, high: 84, low: 120 },
    { open: 92, close: 78, high: 70, low: 98 },
    { open: 78, close: 88, high: 72, low: 94 },
];

const X0 = 40;
const STEP = 34;
const BODY = 16;

export function DelistedChart() {
    const lastX = X0 + CANDLES.length * STEP;
    const trend = CANDLES.map(
        (c, i) => `${i === 0 ? 'M' : 'L'}${X0 + i * STEP + BODY / 2},${c.close}`
    ).join(' ');

    return (
        <svg
            viewBox="0 0 420 240"
            role="img"
            aria-label="A price chart that rises, then crashes off the bottom: page delisted"
            className="delisted-chart w-full max-w-md text-primary"
        >
            <style>{`
                .delisted-chart .trend { stroke-dasharray: 600; stroke-dashoffset: 600; animation: dc-draw 1.6s ease-out forwards; }
                .delisted-chart .candle { opacity: 0; animation: dc-pop .3s ease-out forwards; }
                .delisted-chart .crash { animation: dc-fall 2.4s cubic-bezier(.55,0,1,.45) 1.6s infinite; }
                .delisted-chart .crash-line { stroke-dasharray: 4 4; animation: dc-dash .6s linear infinite; }
                .delisted-chart .tick { animation: dc-blink 1s step-end infinite; }
                @keyframes dc-draw { to { stroke-dashoffset: 0; } }
                @keyframes dc-pop { to { opacity: 1; } }
                @keyframes dc-fall {
                    0%, 15% { transform: translateY(0); opacity: 1; }
                    80% { transform: translateY(150px); opacity: 0; }
                    100% { transform: translateY(150px); opacity: 0; }
                }
                @keyframes dc-dash { to { stroke-dashoffset: -8; } }
                @keyframes dc-blink { 50% { opacity: 0; } }
                @media (prefers-reduced-motion: reduce) {
                    .delisted-chart * { animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important; }
                }
            `}</style>

            {/* grid */}
            <g
                stroke="currentColor"
                strokeOpacity="0.12"
            >
                {[60, 100, 140, 180].map((y) => (
                    <line
                        key={y}
                        x1="24"
                        x2="400"
                        y1={y}
                        y2={y}
                    />
                ))}
            </g>

            {/* ticker header */}
            <g
                fontFamily="inherit"
                fontSize="11"
                fill="currentColor"
            >
                <text
                    x="24"
                    y="26"
                    fontWeight="700"
                >
                    $PAGE
                </text>
                <text
                    x="70"
                    y="26"
                    className="fill-destructive"
                >
                    ▼ -100.00%
                </text>
                <text
                    x="400"
                    y="26"
                    textAnchor="end"
                    opacity="0.6"
                >
                    HTTP·404
                </text>
            </g>

            {/* candles */}
            {CANDLES.map((c, i) => {
                const x = X0 + i * STEP;
                const up = c.close < c.open;
                const top = Math.min(c.open, c.close);
                const h = Math.max(Math.abs(c.open - c.close), 2);
                return (
                    <g
                        key={i}
                        className={`candle ${up ? '' : 'fill-destructive stroke-destructive'}`}
                        style={{ animationDelay: `${i * 0.12}s` }}
                        fill={up ? 'currentColor' : undefined}
                        stroke={up ? 'currentColor' : undefined}
                    >
                        <line
                            x1={x + BODY / 2}
                            x2={x + BODY / 2}
                            y1={c.high}
                            y2={c.low}
                            strokeWidth="1.5"
                        />
                        <rect
                            x={x}
                            y={top}
                            width={BODY}
                            height={h}
                            rx="1"
                        />
                    </g>
                );
            })}

            <path
                className="trend"
                d={trend}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.5"
                strokeWidth="1.5"
            />

            {/* the missing candle: where this page used to trade */}
            <line
                className="crash-line stroke-destructive"
                x1={lastX + BODY / 2}
                x2={lastX + BODY / 2}
                y1="88"
                y2="210"
                strokeWidth="1.5"
            />
            <g className="crash fill-destructive">
                <rect
                    x={lastX}
                    y="88"
                    width={BODY}
                    height="44"
                    rx="1"
                />
            </g>

            {/* floor */}
            <line
                x1="24"
                x2="400"
                y1="210"
                y2="210"
                stroke="currentColor"
                strokeOpacity="0.4"
            />
            <text
                x={lastX + BODY + 10}
                y="206"
                fontSize="10"
                className="fill-destructive"
            >
                delisted
            </text>
            <rect
                className="tick"
                x={lastX + BODY + 60}
                y="197"
                width="6"
                height="11"
                fill="currentColor"
            />
        </svg>
    );
}
