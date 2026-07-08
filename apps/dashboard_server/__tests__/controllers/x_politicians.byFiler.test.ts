// __tests__/controllers/politicians.byFiler.test.ts
// Purpose: unit tests for GET /api/politicians/:filerId (Q6.2).
// Pool is mocked — no Postgres required.
// Covers:
//   1. Invalid filerId slug → { data: null } (no DB hit)
//   2. Presence-guard: registry absent → { data: null }
//   3. Unknown filerId (no registry row) → { data: null }
//   4. Happy path: filer + tickers + timeline shape
//   5. Timeline volume-guard: <2 distinct quarters → timeline: []
//   6. Cache-Control header set
//   7. Ticker holders view absent → tickers: []
//   8. Timeline view absent → timeline: []

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { router as politiciansRouter } from '../../src/controllers/politicians/politicians';

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
    const handler = {
        status(code: number) {
            captured.status = code;
            return handler;
        },
        json(payload: unknown) {
            captured.payload = payload;
            return handler;
        },
        set(key: string, value: string) {
            captured.headers[key] = value;
            return handler;
        },
    };
    return { res: captured, handler };
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

async function invoke(filerId: string): Promise<CapturedResponse> {
    const route = routeByPath(politiciansRouter, '/:filerId');
    if (!route) throw new Error('/:filerId route not registered');
    const { res, handler } = mockRes();
    await lastHandle(route)({ params: { filerId }, query: {} }, handler);
    return res;
}

beforeEach(() => mockQuery.mockReset());

// Presence probe: registry present, both views present.
function allPresent() {
    mockQuery.mockResolvedValueOnce({
        rows: [
            {
                has_registry: true,
                has_ticker_holders: true,
                has_timeline: true,
            },
        ],
    });
}

// Presence probe: only registry present.
function registryOnly() {
    mockQuery.mockResolvedValueOnce({
        rows: [
            {
                has_registry: true,
                has_ticker_holders: false,
                has_timeline: false,
            },
        ],
    });
}

const SAMPLE_FILER_ROW = {
    filer_id: 'nancy_pelosi',
    filer_name: 'Nancy Pelosi',
    party: 'D',
    chamber: 'house',
    state: 'CA',
    office: 'Representative',
    photo_url: null,
    trade_count: 12,
    purchases: 8,
    sales: 4,
    late_filings: 1,
    est_volume: '5000000',
};

describe('politicians route registration', () => {
    it('registers GET /:filerId', () => {
        const route = routeByPath(politiciansRouter, '/:filerId');
        expect(route).toBeDefined();
        expect(route!.methods.get).toBe(true);
    });
});

describe('GET /:filerId — input validation', () => {
    it('rejects filerId with uppercase without hitting DB', async () => {
        const result = await invoke('Nancy_Pelosi');
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects filerId with spaces without hitting DB', async () => {
        const result = await invoke('nancy pelosi');
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects empty filerId without hitting DB', async () => {
        const result = await invoke('');
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('accepts valid slug (lowercase, digits, underscore)', async () => {
        // Presence probe: registry absent → stops here
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_registry: false,
                    has_ticker_holders: false,
                    has_timeline: false,
                },
            ],
        });
        const result = await invoke('nancy_pelosi_123');
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(result.payload).toEqual({ success: true, data: null });
    });
});

describe('GET /:filerId — presence guard', () => {
    it('returns data:null when politician_registry is absent', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_registry: false,
                    has_ticker_holders: false,
                    has_timeline: false,
                },
            ],
        });
        const result = await invoke('nancy_pelosi');
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });
});

describe('GET /:filerId — unknown filer', () => {
    it('returns data:null when filer not in registry', async () => {
        allPresent();
        // Query A: empty
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await invoke('ghost_politician');
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });
});

describe('GET /:filerId — happy path', () => {
    it('returns filer + tickers + timeline with correct shape', async () => {
        allPresent();
        // Query A: filer row
        mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_FILER_ROW] });
        // Query B: ticker holders
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    ticker: 'NVDA',
                    disclosed_value_usd: '2000000',
                    trade_count: '7',
                    net_direction: 'buy_skew',
                    latest_disclosure: new Date('2026-03-15'),
                },
            ],
        });
        // getFilerTickerShares: TOTAL query
        mockQuery.mockResolvedValueOnce({
            rows: [{ filer_id: 'nancy_pelosi', total_value: '2000000' }],
        });
        // getFilerTickerShares: RANK query
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    filer_id: 'nancy_pelosi',
                    ticker: 'NVDA',
                    rank_in_filer: '1',
                    total_ticker_count: '1',
                    ticker_value: '2000000',
                },
            ],
        });
        // Query C: timeline — 2 distinct quarters
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    quarter: new Date('2025-10-01'),
                    ticker: 'NVDA',
                    net_value_usd: '500000',
                    direction: 'buy',
                },
                {
                    quarter: new Date('2026-01-01'),
                    ticker: 'NVDA',
                    net_value_usd: '-200000',
                    direction: 'sell',
                },
            ],
        });

        const result = await invoke('nancy_pelosi');
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };

        expect(body.success).toBe(true);
        const { filer, tickers, timeline } = body.data as {
            filer: Record<string, unknown>;
            tickers: Array<Record<string, unknown>>;
            timeline: Array<Record<string, unknown>>;
        };

        // Filer shape
        expect(filer.filerId).toBe('nancy_pelosi');
        expect(filer.filerName).toBe('Nancy Pelosi');
        expect(filer.party).toBe('D');
        expect(filer.chamber).toBe('house');
        expect(filer.estVolumeBand).toBe('>$1M');
        expect(filer.tradeCount).toBe(12);

        // Tickers shape
        expect(tickers).toHaveLength(1);
        expect(tickers[0].ticker).toBe('NVDA');
        expect(tickers[0].disclosedValueBand).toBe('>$1M');
        expect(tickers[0].sharePctOfFilerVolume).toBeCloseTo(100);
        expect(tickers[0].rankInFilerVolume).toBe(1);
        expect(tickers[0].totalTickerCount).toBe(1);
        expect(tickers[0].netDirection).toBe('buy_skew');
        expect(tickers[0].tradeCount).toBe(7);
        expect(tickers[0].latestDisclosure).toBe('2026-03-15');

        // Timeline shape (2 distinct quarters → populated)
        expect(timeline).toHaveLength(2);
        expect(timeline[0].quarter).toBe('2025-10-01');
        expect(timeline[0].ticker).toBe('NVDA');
        expect(timeline[0].netValueBand).toBe('$250K–$1M'); // abs(500_000)
        expect(timeline[0].direction).toBe('buy');
        expect(timeline[1].netValueBand).toBe('$50K–$250K'); // abs(-200_000) = 200_000
    });
});

describe('GET /:filerId — timeline volume guard', () => {
    it('returns timeline:[] when filer has <2 distinct quarters', async () => {
        allPresent();
        mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_FILER_ROW] });
        // No ticker holders
        mockQuery.mockResolvedValueOnce({ rows: [] });
        // Timeline: only 1 distinct quarter
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    quarter: new Date('2026-01-01'),
                    ticker: 'AAPL',
                    net_value_usd: '100000',
                    direction: 'buy',
                },
            ],
        });

        const result = await invoke('nancy_pelosi');
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        const { timeline } = body.data as { timeline: unknown[] };
        expect(timeline).toEqual([]);
    });
});

describe('GET /:filerId — partial presence (views absent)', () => {
    it('returns tickers:[] when v_politician_ticker_holders is absent', async () => {
        registryOnly(); // hasTickerHolders=false, hasTimeline=false
        mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_FILER_ROW] });
        // No ticker query, no timeline query

        const result = await invoke('nancy_pelosi');
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        expect(body.success).toBe(true);
        const { tickers, timeline } = body.data as {
            tickers: unknown[];
            timeline: unknown[];
        };
        expect(tickers).toEqual([]);
        expect(timeline).toEqual([]);
        // Calls: probe + filer row = 2 only
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });
});

describe('GET /:filerId — Cache-Control', () => {
    it('sets cache header even on invalid slug', async () => {
        const result = await invoke('INVALID SLUG!');
        expect(result.headers['Cache-Control']).toBe(
            'public, s-maxage=86400, stale-while-revalidate=604800'
        );
    });
});
