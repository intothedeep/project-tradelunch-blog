// __tests__/controllers/securities.screen.test.ts
// Phase P STEP 3 (P10) — screener endpoint shape tests (no real DB).
//
// Covers:
//   1. Absence guard (hasConsensus=false) → { success: true, data: null }
//   2. Happy path — envelope shape, score ordering, deferred component nulls
//   3. clampParam behaviour via query string extremes
//   4. As-of path (has_consensus_asof=true, migration 0035):
//      - SQL targets v_sec_consensus_asof
//      - period_of_report = $1 filter is OMITTED
//      - param array starts with [minActiveHolders] (no period string)
//      - rank filter uses $2 (not $3) when applyRankFilter is true
//      - response carries asOf field; legacy path does NOT
//   5. Legacy back-compat (has_consensus_asof=false): existing behaviour unchanged
//
// NOTE: The actual SQL filing_date SEMANTIC (staggered-filing count, future-filing
// exclusion) cannot be unit-tested against the mocked pool — it is proven by the
// view SQL in 0035_sec_consensus_asof.sql + design review. Validate post-apply with
// the manual verification queries provided in the implementation report.
//
// The pool is mocked so these run without Postgres.

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { router as screenRouter } from '../../src/controllers/securities/screen';

type CapturedResponse = {
    status: number;
    payload: unknown;
    headers: Record<string, string>;
};

function mockRes(): { res: CapturedResponse; handler: object } {
    const captured: CapturedResponse = {
        status: 200,
        payload: undefined,
        headers: {},
    };
    const res = {
        status(code: number) {
            captured.status = code;
            return res;
        },
        json(payload: unknown) {
            captured.payload = payload;
            return res;
        },
        set(key: string, value: string) {
            captured.headers[key] = value;
            return res;
        },
    };
    return { res: captured, handler: res };
}

type AnyRoute = {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: unknown }[];
};

function routeByPath(
    r: { stack: { route?: AnyRoute }[] },
    path: string
): AnyRoute | undefined {
    return r.stack
        .filter((l) => !!l.route)
        .map((l) => l.route as AnyRoute)
        .find((rt) => rt.path === path);
}

function lastHandle(
    route: AnyRoute
): (req: unknown, res: unknown) => Promise<void> {
    return route.stack[route.stack.length - 1].handle as (
        req: unknown,
        res: unknown
    ) => Promise<void>;
}

async function invoke(
    query: Record<string, string> = {}
): Promise<CapturedResponse> {
    const route = routeByPath(screenRouter, '/screen');
    if (!route) throw new Error('/screen route not registered');
    const { res, handler } = mockRes();
    await lastHandle(route)({ params: {}, query }, handler);
    return res;
}

beforeEach(() => mockQuery.mockReset());

// --- Route registration ---

describe('screen route registration', () => {
    it('registers GET /screen', () => {
        const route = routeByPath(screenRouter, '/screen');
        expect(route).toBeDefined();
        expect(route!.methods.get).toBe(true);
    });
});

// --- Absence guard ---

describe('GET /screen — view-absence guard', () => {
    it('returns data:null when v_sec_consensus is absent', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_consensus: false,
                    has_secmap: false,
                    has_rankings: false,
                },
            ],
        });
        const result = await invoke();
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('returns data:null when period query returns empty', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { has_consensus: true, has_secmap: false, has_rankings: false },
            ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] }); // active count
        mockQuery.mockResolvedValueOnce({ rows: [{ period: null }] }); // no period
        const result = await invoke();
        expect(result.payload).toEqual({ success: true, data: null });
    });
});

// --- Happy path ---

describe('GET /screen — happy path', () => {
    const period = '2026-03-31';

    function mockHappyPath(
        candidateRows: Array<{
            cusip: string;
            name_of_issuer: string;
            holder_count_active: string;
            holder_count_total: string;
            ticker: string | null;
            rank: number | null;
            market_cap: string | null;
        }>
    ): void {
        // 1. probePresence
        mockQuery.mockResolvedValueOnce({
            rows: [
                { has_consensus: true, has_secmap: true, has_rankings: true },
            ],
        });
        // 2. active fund count
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        // 3. latest period
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        // 4. candidates
        mockQuery.mockResolvedValueOnce({ rows: candidateRows });
    }

    it('returns envelope with periodOfReport, totalActiveFunds, candidates', async () => {
        mockHappyPath([
            {
                cusip: '037833100',
                name_of_issuer: 'APPLE INC',
                holder_count_active: '3',
                holder_count_total: '4',
                ticker: 'AAPL',
                rank: 1,
                market_cap: '3000000000000',
            },
        ]);
        const result = await invoke();
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({
            periodOfReport: '2026-03-31',
            totalActiveFunds: 3,
        });
        const candidates = body.data.candidates as Array<
            Record<string, unknown>
        >;
        expect(candidates).toHaveLength(1);
        expect(candidates[0]).toMatchObject({
            cusip: '037833100',
            name: 'APPLE INC',
            ticker: 'AAPL',
            rank: 1,
            holderCountActive: 3,
            holderCountTotal: 4,
        });
    });

    it('score components include consensus, capTier, and null deferred terms', async () => {
        mockHappyPath([
            {
                cusip: '037833100',
                name_of_issuer: 'APPLE INC',
                holder_count_active: '3',
                holder_count_total: '3',
                ticker: 'AAPL',
                rank: 1,
                market_cap: null,
            },
        ]);
        const result = await invoke();
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        const candidates = body.data.candidates as Array<
            Record<string, unknown>
        >;
        const comp = candidates[0].components as Record<string, unknown>;
        expect(comp.consensus).toBeCloseTo(1);
        expect(comp.capTier).toBe(1);
        expect(comp.momentum).toBeNull();
        expect(comp.lowVol).toBeNull();
        // score = 0.4*1 + 0.2*1 = 0.6
        expect(candidates[0].score).toBeCloseTo(0.6);
    });

    it('sorts candidates by score DESC then holderCountActive DESC', async () => {
        mockHappyPath([
            // Low score: 1 active, rank null → 0.4*(1/3)+0.2*0 ≈ 0.133
            {
                cusip: 'BBBBBBBBB',
                name_of_issuer: 'B Corp',
                holder_count_active: '1',
                holder_count_total: '2',
                ticker: null,
                rank: null,
                market_cap: null,
            },
            // High score: 3 active, rank 5 → 0.4*1+0.2*1 = 0.6
            {
                cusip: 'AAAAAAAAA',
                name_of_issuer: 'A Corp',
                holder_count_active: '3',
                holder_count_total: '4',
                ticker: 'AAAA',
                rank: 5,
                market_cap: '1000000000',
            },
        ]);
        const result = await invoke();
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        const candidates = body.data.candidates as Array<
            Record<string, unknown>
        >;
        // A Corp should come first (higher score)
        expect(candidates[0].cusip).toBe('AAAAAAAAA');
        expect(candidates[1].cusip).toBe('BBBBBBBBB');
    });

    it('sets the shared funds cache header', async () => {
        mockHappyPath([]);
        const result = await invoke();
        expect(result.headers['Cache-Control']).toBe(
            'public, s-maxage=86400, stale-while-revalidate=604800'
        );
    });

    it('populates momentum/lowVol when market_history is present', async () => {
        // 1. probePresence — market_history present
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_consensus: true,
                    has_secmap: true,
                    has_rankings: true,
                    has_market_history: true,
                },
            ],
        });
        // 2. active fund count
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        // 3. latest period
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        // 4. candidates — two resolved tickers so percentileRank has a cross-section
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cusip: 'C1',
                    name_of_issuer: 'Hi Mom',
                    holder_count_active: '3',
                    holder_count_total: '3',
                    ticker: 'HIMO',
                    rank: 1,
                    market_cap: null,
                },
                {
                    cusip: 'C2',
                    name_of_issuer: 'Lo Mom',
                    holder_count_active: '3',
                    holder_count_total: '3',
                    ticker: 'LOMO',
                    rank: 1,
                    market_cap: null,
                },
            ],
        });
        // 5. price history — HIMO strong uptrend, LOMO flat (>=253 bars each)
        const priceRows: Array<{ label: string; close: string }> = [];
        for (let i = 0; i < 260; i++)
            priceRows.push({ label: 'HIMO', close: String(100 + i) });
        for (let i = 0; i < 260; i++)
            priceRows.push({ label: 'LOMO', close: '100' });
        mockQuery.mockResolvedValueOnce({ rows: priceRows });

        const result = await invoke();
        expect(mockQuery).toHaveBeenCalledTimes(5);
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        const candidates = body.data.candidates as Array<
            Record<string, unknown>
        >;
        const byCusip = Object.fromEntries(candidates.map((c) => [c.cusip, c]));
        const hi = byCusip.C1.components as Record<string, unknown>;
        const lo = byCusip.C2.components as Record<string, unknown>;
        // HIMO has higher momentum (uptrend) → percentile 1; LOMO → 0.
        expect(hi.momentum).toBe(1);
        expect(lo.momentum).toBe(0);
        // Flat LOMO has lower vol → higher lowVol percentile (1) than HIMO (0).
        expect(lo.lowVol).toBe(1);
        expect(hi.lowVol).toBe(0);
    });

    it('ranks a price-signal-complete candidate above a higher-scored consensus-only one', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_consensus: true,
                    has_secmap: true,
                    has_rankings: true,
                    has_market_history: true,
                },
            ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        // PARTIAL (no ticker → no price): full consensus → score 0.4.
        // FULL (has price): weaker consensus (1/3) but carries momentum/lowVol.
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cusip: 'PART',
                    name_of_issuer: 'Partial Co',
                    holder_count_active: '3',
                    holder_count_total: '3',
                    ticker: null,
                    rank: null,
                    market_cap: null,
                },
                {
                    cusip: 'FULL',
                    name_of_issuer: 'Full Co',
                    holder_count_active: '1',
                    holder_count_total: '3',
                    ticker: 'FULL',
                    rank: null,
                    market_cap: null,
                },
            ],
        });
        const priceRows: Array<{ label: string; close: string }> = [];
        for (let i = 0; i < 260; i++)
            priceRows.push({ label: 'FULL', close: String(100 + i) });
        mockQuery.mockResolvedValueOnce({ rows: priceRows });

        const result = await invoke();
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        const candidates = body.data.candidates as Array<
            Record<string, unknown>
        >;
        // FULL is the lower-scored candidate but leads on the price-signal tier.
        expect(candidates[0].cusip).toBe('FULL');
        expect(candidates[0].hasPriceSignals).toBe(true);
        expect(candidates[1].cusip).toBe('PART');
        expect(candidates[1].hasPriceSignals).toBe(false);
        expect(candidates[0].score as number).toBeLessThan(
            candidates[1].score as number
        );
    });
});

// --- Clamp behaviour ---

describe('GET /screen — clamp params', () => {
    it('makes 4 DB calls for a valid request (no early exit)', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                { has_consensus: true, has_secmap: false, has_rankings: false },
            ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ period: '2026-03-31' }] });
        mockQuery.mockResolvedValueOnce({ rows: [] });

        // Out-of-range limit is clamped, not rejected
        await invoke({ limit: '9999' });
        expect(mockQuery).toHaveBeenCalledTimes(4);
    });

    it('returns data:null on unexpected DB error (never 500)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('connection refused'));
        const result = await invoke();
        expect(result.payload).toEqual({ success: true, data: null });
        expect(result.status).toBe(200);
    });
});

// --- As-of path (migration 0035 applied) ---

describe('GET /screen — as-of path (has_consensus_asof=true)', () => {
    const period = '2026-03-31';

    function mockAsofPath(
        opts: {
            hasSecmap?: boolean;
            hasRankings?: boolean;
            candidateRows?: unknown[];
            minActiveHolders?: string;
            maxRank?: string;
        } = {}
    ): void {
        const {
            hasSecmap = false,
            hasRankings = false,
            candidateRows = [],
            minActiveHolders,
            maxRank,
        } = opts;
        // 1. probePresence — as-of view is present
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_consensus: true,
                    has_consensus_asof: true,
                    has_secmap: hasSecmap,
                    has_rankings: hasRankings,
                },
            ],
        });
        // 2. active fund count
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        // 3. period from v_sec_consensus_asof
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        // 4. candidates
        mockQuery.mockResolvedValueOnce({ rows: candidateRows });
        void minActiveHolders;
        void maxRank; // consumed via invoke() query string
    }

    it('period query targets v_sec_consensus_asof (SELECT MAX(max_period))', async () => {
        mockAsofPath();
        await invoke();

        // Call index 2 = period query
        const [periodSql] = mockQuery.mock.calls[2] as [string];
        expect(periodSql).toContain('v_sec_consensus_asof');
        expect(periodSql).toContain('MAX(max_period)');
    });

    it('candidate SQL targets v_sec_consensus_asof and omits period_of_report filter', async () => {
        mockAsofPath();
        await invoke();

        // Call index 3 = candidates query
        const [candidateSql] = mockQuery.mock.calls[3] as [string];
        expect(candidateSql).toContain('v_sec_consensus_asof');
        expect(candidateSql).not.toContain('period_of_report = $1');
    });

    it('param array starts with minActiveHolders only (no period string)', async () => {
        mockAsofPath();
        await invoke(); // default minActiveHolders=2

        const [, candidateParams] = mockQuery.mock.calls[3] as [
            string,
            unknown[],
        ];
        // First (and only) param is minActiveHolders=2 (number)
        expect(candidateParams).toHaveLength(1);
        expect(candidateParams[0]).toBe(2);
    });

    it('holder_count_active filter uses $1 (not $2) in as-of path', async () => {
        mockAsofPath();
        await invoke({ minActiveHolders: '3' });

        const [candidateSql, candidateParams] = mockQuery.mock.calls[3] as [
            string,
            unknown[],
        ];
        expect(candidateSql).toContain('$1');
        // No $2 when there is no rank filter
        expect(candidateSql).not.toMatch(/\$2/);
        expect(candidateParams[0]).toBe(3);
    });

    it('rank filter uses $2 (not $3) when maxRank is active in as-of path', async () => {
        mockAsofPath({ hasSecmap: true, hasRankings: true });
        await invoke({ maxRank: '100' });

        const [candidateSql, candidateParams] = mockQuery.mock.calls[3] as [
            string,
            unknown[],
        ];
        // $1 = minActiveHolders, $2 = maxRank (no period $1 in as-of path)
        expect(candidateSql).toContain('$2');
        expect(candidateSql).not.toMatch(/\$3/);
        expect(candidateParams).toHaveLength(2);
        expect(candidateParams[0]).toBe(2); // minActiveHolders default
        expect(candidateParams[1]).toBe(100); // maxRank
    });

    it('response includes asOf field (YYYY-MM-DD) in as-of path', async () => {
        mockAsofPath();
        const result = await invoke();

        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        expect(body.success).toBe(true);
        expect(body.data).toHaveProperty('asOf');
        // asOf is today in YYYY-MM-DD format
        const asOf = body.data.asOf as string;
        expect(asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(body.data.periodOfReport).toBe('2026-03-31');
    });
});

// --- Legacy back-compat (has_consensus_asof=false) ---

describe('GET /screen — legacy back-compat (has_consensus_asof=false)', () => {
    const period = '2026-03-31';

    it('candidate SQL targets v_sec_consensus with period_of_report = $1', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_consensus: true,
                    has_consensus_asof: false,
                    has_secmap: false,
                    has_rankings: false,
                },
            ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await invoke();

        const [candidateSql, candidateParams] = mockQuery.mock.calls[3] as [
            string,
            unknown[],
        ];
        expect(candidateSql).toContain('v_sec_consensus');
        expect(candidateSql).not.toContain('v_sec_consensus_asof');
        expect(candidateSql).toContain('period_of_report = $1');
        // First param is the period string, second is minActiveHolders
        expect(candidateParams[0]).toBe('2026-03-31');
        expect(candidateParams[1]).toBe(2);
    });

    it('rank filter uses $3 (not $2) in legacy path', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_consensus: true,
                    has_consensus_asof: false,
                    has_secmap: true,
                    has_rankings: true,
                },
            ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        mockQuery.mockResolvedValueOnce({ rows: [] });

        await invoke({ maxRank: '50' });

        const [candidateSql, candidateParams] = mockQuery.mock.calls[3] as [
            string,
            unknown[],
        ];
        expect(candidateSql).toContain('$3');
        expect(candidateParams).toHaveLength(3);
        expect(candidateParams[0]).toBe('2026-03-31'); // period
        expect(candidateParams[1]).toBe(2); // minActiveHolders
        expect(candidateParams[2]).toBe(50); // maxRank
    });

    it('response does NOT include asOf field in legacy path', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_consensus: true,
                    has_consensus_asof: false,
                    has_secmap: false,
                    has_rankings: false,
                },
            ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await invoke();
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        expect(body.data).not.toHaveProperty('asOf');
        expect(body.data.periodOfReport).toBe('2026-03-31');
    });

    it('undefined has_consensus_asof defaults to false (legacy path)', async () => {
        // Simulates older probe rows that do not include the has_consensus_asof column.
        mockQuery.mockResolvedValueOnce({
            rows: [
                { has_consensus: true, has_secmap: false, has_rankings: false },
            ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ total_active: '3' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ period }] });
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await invoke();
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        // Should degrade to legacy path without error
        expect(body.success).toBe(true);
        expect(body.data).not.toHaveProperty('asOf');

        const [candidateSql] = mockQuery.mock.calls[3] as [string];
        expect(candidateSql).toContain('v_sec_consensus');
        expect(candidateSql).not.toContain('v_sec_consensus_asof');
    });
});
