// Phase P STEP 2 (P9) — byTicker endpoint shape tests (no real DB).
//
// Covers:
//   1. Invalid ticker → { success: true, data: null } (no DB hit)
//   2. Presence-guard (both absent) → { success: true, data: null }
//   3. Unknown ticker (both queries empty) → { success: true, data: null }
//   4. Happy path — ranking history + holders → shape assertions
//   5. Cache-Control header is set
//   6. Holders include weightPct/deltaWeightPct/isNew when delta view present
//   7. Price history happy path (market_history present)
//   8. market_history absent → priceHistory []
//
// Pool is mocked so these run without Postgres.

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { router as byTickerRouter } from '../../src/controllers/securities/byTicker';

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
    params: Record<string, string>
): Promise<CapturedResponse> {
    const route = routeByPath(byTickerRouter, '/:ticker/by-ticker');
    if (!route) throw new Error('/:ticker/by-ticker route not registered');
    const { res, handler } = mockRes();
    await lastHandle(route)({ params, query: {} }, handler);
    return res;
}

beforeEach(() => mockQuery.mockReset());

describe('byTicker route registration', () => {
    it('registers GET /:ticker/by-ticker', () => {
        const route = routeByPath(byTickerRouter, '/:ticker/by-ticker');
        expect(route).toBeDefined();
        expect(route!.methods.get).toBe(true);
    });
});

describe('GET /:ticker/by-ticker — input validation', () => {
    it('rejects a ticker with invalid chars without hitting DB', async () => {
        const result = await invoke({ ticker: 'SP Y$!' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects an empty string without hitting DB', async () => {
        const result = await invoke({ ticker: '' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('GET /:ticker/by-ticker — presence guard', () => {
    it('returns data:null when both tables are absent', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ has_holdings: false, has_rankings: false }],
        });
        const result = await invoke({ ticker: 'SPY' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });
});

describe('GET /:ticker/by-ticker — unknown ticker', () => {
    it('returns data:null when both queries return empty rows', async () => {
        // Probe: both present
        mockQuery.mockResolvedValueOnce({
            rows: [{ has_holdings: true, has_rankings: true }],
        });
        // Query A: no ranking rows
        mockQuery.mockResolvedValueOnce({ rows: [] });
        // Query B: no holder rows
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await invoke({ ticker: 'UNKNOWN' });
        expect(result.payload).toEqual({ success: true, data: null });
        expect(mockQuery).toHaveBeenCalledTimes(3);
    });
});

describe('GET /:ticker/by-ticker — happy path', () => {
    it('returns envelope with rankingHistory and holders', async () => {
        const period = new Date('2026-03-31');
        const asOf = new Date('2026-06-27');

        // Probe: both present
        mockQuery.mockResolvedValueOnce({
            rows: [{ has_holdings: true, has_rankings: true }],
        });
        // Query A: one ranking row
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    as_of: asOf,
                    scope: 'global',
                    rank: 3,
                    market_cap: '3200000000000',
                },
            ],
        });
        // Query B: one holder row
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cik: '0001067983',
                    label: 'Berkshire Hathaway',
                    is_active_manager: true,
                    value_usd: '40000000000',
                    period_of_report: period,
                    sector: 'Technology',
                    cusip: null,
                },
            ],
        });
        // getHolderWeights: resolveCusips → no cusip mapped → returns empty early
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await invoke({ ticker: 'AAPL' });
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };

        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({
            ticker: 'AAPL',
            sector: 'Technology',
            periodOfReport: '2026-03-31',
        });

        const history = body.data.rankingHistory as Array<
            Record<string, unknown>
        >;
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({
            asOf: '2026-06-27',
            scope: 'global',
            rank: 3,
            marketCap: 3200000000000,
        });

        const holders = body.data.holders as Array<Record<string, unknown>>;
        expect(holders).toHaveLength(1);
        expect(holders[0]).toMatchObject({
            cik: '0001067983',
            label: 'Berkshire Hathaway',
            isActiveManager: true,
            valueUsd: 40000000000,
            weightPct: null,
            deltaWeightPct: null,
            isNew: false,
        });

        // priceHistory absent (hasMarketHistory=false from probe mock)
        expect(body.data.priceHistory).toEqual([]);

        // probe + qA + qB holders + resolveCusips(empty → no weight queries)
        expect(mockQuery).toHaveBeenCalledTimes(4);
    });

    it('returns data with null sector and null periodOfReport when only rankings exist', async () => {
        const asOf = new Date('2026-06-27');

        // Probe: rankings present, holdings absent
        mockQuery.mockResolvedValueOnce({
            rows: [{ has_holdings: false, has_rankings: true }],
        });
        // Query A: one ranking row
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    as_of: asOf,
                    scope: 'global',
                    rank: 1,
                    market_cap: '3500000000000',
                },
            ],
        });

        const result = await invoke({ ticker: 'AAPL' });
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };

        expect(body.success).toBe(true);
        expect(body.data).toMatchObject({
            ticker: 'AAPL',
            sector: null,
            periodOfReport: null,
            holders: [],
        });

        const history = body.data.rankingHistory as Array<
            Record<string, unknown>
        >;
        expect(history).toHaveLength(1);
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });
});

describe('GET /:ticker/by-ticker — weight/delta derivation', () => {
    // Query sequence when holders exist: probe, [qA], qB holders, resolveCusips,
    // then WEIGHT_LATEST + WEIGHT_PREV (Promise.all). weightPct = cusip_value*100/
    // total_value; deltaWeightPct = weightLatest − weightPrev; isNew = prev held none.
    it('derives weightPct/deltaWeightPct from sec_holdings aggregates', async () => {
        const period = new Date('2026-03-31');

        // Probe (has_holdings true; hasRankings false → no qA)
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_holdings: true,
                    has_rankings: false,
                    has_market_history: false,
                },
            ],
        });
        // Query B: holder row
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cik: '0001067983',
                    label: 'Berkshire Hathaway',
                    is_active_manager: true,
                    value_usd: '40000000000',
                    period_of_report: period,
                    sector: 'Technology',
                    cusip: '037833100',
                },
            ],
        });
        // resolveCusips
        mockQuery.mockResolvedValueOnce({ rows: [{ cusip: '037833100' }] });
        // WEIGHT_LATEST: 123456/1000000*100 = 12.3456%
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cik: '0001067983',
                    total_value: '1000000',
                    cusip_value: '123456',
                },
            ],
        });
        // WEIGHT_PREV: 135756/1000000*100 = 13.5756% → delta = 12.3456 − 13.5756 = −1.23
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cik: '0001067983',
                    total_value: '1000000',
                    cusip_value: '135756',
                },
            ],
        });

        const result = await invoke({ ticker: 'AAPL' });
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };

        expect(body.success).toBe(true);
        const holders = body.data.holders as Array<Record<string, unknown>>;
        expect(holders).toHaveLength(1);
        expect(holders[0].weightPct).toBeCloseTo(12.3456);
        expect(holders[0].deltaWeightPct).toBeCloseTo(-1.23);
        expect(holders[0].isNew).toBe(false);
        // probe + qB + resolveCusips + WEIGHT_LATEST + WEIGHT_PREV
        expect(mockQuery).toHaveBeenCalledTimes(5);
    });

    it('marks isNew=true when the fund held none of the cusip in the prior period', async () => {
        const period = new Date('2026-03-31');

        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_holdings: true,
                    has_rankings: false,
                    has_market_history: false,
                },
            ],
        });
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cik: '0001350694',
                    label: 'Bridgewater Associates',
                    is_active_manager: true,
                    value_usd: '5000000000',
                    period_of_report: period,
                    sector: 'Technology',
                    cusip: '037833100',
                },
            ],
        });
        mockQuery.mockResolvedValueOnce({ rows: [{ cusip: '037833100' }] });
        // WEIGHT_LATEST: 3.5%
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cik: '0001350694',
                    total_value: '1000000',
                    cusip_value: '35000',
                },
            ],
        });
        // WEIGHT_PREV: filed prev but held none of the cusip → cusip_value null
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    cik: '0001350694',
                    total_value: '2000000',
                    cusip_value: null,
                },
            ],
        });

        const result = await invoke({ ticker: 'AAPL' });
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        const holders = body.data.holders as Array<Record<string, unknown>>;
        expect(holders[0].isNew).toBe(true);
        // new position: delta = weightLatest − 0 = full current weight (3.5%)
        expect(holders[0].deltaWeightPct).toBeCloseTo(3.5);
    });
});

describe('GET /:ticker/by-ticker — price history', () => {
    it('returns ascending priceHistory when market_history is present', async () => {
        // Probe: only market_history present
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_holdings: false,
                    has_rankings: false,
                    has_delta: false,
                    has_market_history: true,
                },
            ],
        });
        // Query C: 3 rows returned DESC (controller reverses them)
        mockQuery.mockResolvedValueOnce({
            rows: [
                { bar_time: new Date('2026-06-27'), close: '213.50' },
                { bar_time: new Date('2026-06-26'), close: '211.00' },
                { bar_time: new Date('2026-06-25'), close: '209.00' },
            ],
        });

        const result = await invoke({ ticker: 'AAPL' });
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };

        expect(body.success).toBe(true);
        const ph = body.data.priceHistory as Array<{
            t: string;
            close: number;
        }>;
        expect(ph).toHaveLength(3);
        // After reverse: ascending — 2026-06-25 first, 2026-06-27 last
        expect(ph[0].t).toBe('2026-06-25');
        expect(ph[0].close).toBeCloseTo(209.0);
        expect(ph[2].t).toBe('2026-06-27');
        expect(ph[2].close).toBeCloseTo(213.5);
        // 2 calls: probe + qC
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('returns priceHistory:[] when market_history is absent from presence probe', async () => {
        // Probe: rankings only, no market_history
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_holdings: false,
                    has_rankings: true,
                    has_delta: false,
                    has_market_history: false,
                },
            ],
        });
        // Query A: one ranking row
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    as_of: new Date('2026-06-27'),
                    scope: 'global',
                    rank: 1,
                    market_cap: '3000000000000',
                },
            ],
        });

        const result = await invoke({ ticker: 'AAPL' });
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        expect(body.success).toBe(true);
        expect(body.data.priceHistory).toEqual([]);
        // 2 calls: probe + qA (no qC)
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('returns priceHistory:[] when market_history table is present but has no rows for ticker', async () => {
        // Probe: market_history present
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    has_holdings: false,
                    has_rankings: true,
                    has_delta: false,
                    has_market_history: true,
                },
            ],
        });
        // Query A: one ranking row
        mockQuery.mockResolvedValueOnce({
            rows: [
                {
                    as_of: new Date('2026-06-27'),
                    scope: 'global',
                    rank: 5,
                    market_cap: '500000000000',
                },
            ],
        });
        // Query C: empty
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await invoke({ ticker: 'MSFT' });
        const body = result.payload as {
            success: boolean;
            data: Record<string, unknown>;
        };
        expect(body.success).toBe(true);
        expect(body.data.priceHistory).toEqual([]);
        expect(mockQuery).toHaveBeenCalledTimes(3);
    });
});

describe('GET /:ticker/by-ticker — Cache-Control', () => {
    it('sets the shared funds cache header on invalid ticker', async () => {
        const result = await invoke({ ticker: 'bad ticker!' });
        expect(result.headers['Cache-Control']).toBe(
            'public, s-maxage=86400, stale-while-revalidate=604800'
        );
    });
});
