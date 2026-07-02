// __tests__/helpers/politicianHolderShares.test.ts
// Purpose: unit tests for getPoliticianHolderShares and getFilerTickerShares.
// Pool is mocked — no Postgres required.
// Covers: share computation, rank from DB, ties, null total, empty input.

const mockQuery = jest.fn();

jest.mock('../../src/database', () => ({
    pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import {
    getPoliticianHolderShares,
    getFilerTickerShares,
} from '../../src/helpers/politicianHolderShares';

beforeEach(() => mockQuery.mockReset());

// ---------------------------------------------------------------------------
// getPoliticianHolderShares
// ---------------------------------------------------------------------------

describe('getPoliticianHolderShares — empty input', () => {
    it('returns empty map without hitting DB when filerIds is empty', async () => {
        const result = await getPoliticianHolderShares('AAPL', []);
        expect(result.size).toBe(0);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('getPoliticianHolderShares — share math', () => {
    it('computes sharePctOfFilerVolume as (ticker_value / total) × 100', async () => {
        // total for filer_a = 200_000, ticker_value for AAPL = 50_000 → 25%
        mockQuery
            .mockResolvedValueOnce({ rows: [{ filer_id: 'filer_a', total_value: '200000' }] })  // TOTAL
            .mockResolvedValueOnce({ rows: [{ filer_id: 'filer_a', ticker: 'AAPL', rank_in_filer: '2', total_ticker_count: '5', ticker_value: '50000' }] }); // RANK

        const map = await getPoliticianHolderShares('AAPL', ['filer_a']);
        const result = map.get('filer_a')!;
        expect(result.sharePctOfFilerVolume).toBeCloseTo(25);
        expect(result.rankInFilerVolume).toBe(2);
        expect(result.totalTickerCount).toBe(5);
    });

    it('returns sharePct null when total is 0 (avoid divide-by-zero)', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ filer_id: 'filer_a', total_value: '0' }] })
            .mockResolvedValueOnce({ rows: [{ filer_id: 'filer_a', ticker: 'AAPL', rank_in_filer: '1', total_ticker_count: '1', ticker_value: '0' }] });

        const map = await getPoliticianHolderShares('AAPL', ['filer_a']);
        expect(map.get('filer_a')!.sharePctOfFilerVolume).toBeNull();
    });

    it('returns null fields when filer has no row in RANK query (not in this ticker)', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ filer_id: 'filer_b', total_value: '100000' }] })
            .mockResolvedValueOnce({ rows: [] }); // no row for filer_b on this ticker

        const map = await getPoliticianHolderShares('MSFT', ['filer_b']);
        const r = map.get('filer_b')!;
        expect(r.sharePctOfFilerVolume).toBeNull();
        expect(r.rankInFilerVolume).toBeNull();
        expect(r.totalTickerCount).toBeNull();
    });
});

describe('getPoliticianHolderShares — multiple filers', () => {
    it('handles two filers with different shares', async () => {
        // filer_a: total 400_000, AAPL 100_000 → 25%; rank 2 of 6
        // filer_b: total 100_000, AAPL 80_000  → 80%; rank 1 of 3
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    { filer_id: 'filer_a', total_value: '400000' },
                    { filer_id: 'filer_b', total_value: '100000' },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { filer_id: 'filer_a', ticker: 'AAPL', rank_in_filer: '2', total_ticker_count: '6', ticker_value: '100000' },
                    { filer_id: 'filer_b', ticker: 'AAPL', rank_in_filer: '1', total_ticker_count: '3', ticker_value: '80000' },
                ],
            });

        const map = await getPoliticianHolderShares('AAPL', ['filer_a', 'filer_b']);
        expect(map.get('filer_a')!.sharePctOfFilerVolume).toBeCloseTo(25);
        expect(map.get('filer_b')!.sharePctOfFilerVolume).toBeCloseTo(80);
        expect(map.get('filer_a')!.rankInFilerVolume).toBe(2);
        expect(map.get('filer_b')!.rankInFilerVolume).toBe(1);
    });
});

describe('getPoliticianHolderShares — rank determinism on ties', () => {
    it('accepts two filers with the same rank (ties allowed by RANK())', async () => {
        // Both filers hold AAPL as rank 1 within their own traded tickers.
        // RANK() per-filer partition is independent — same rank across filers is valid.
        mockQuery
            .mockResolvedValueOnce({
                rows: [
                    { filer_id: 'filer_x', total_value: '50000' },
                    { filer_id: 'filer_y', total_value: '60000' },
                ],
            })
            .mockResolvedValueOnce({
                rows: [
                    { filer_id: 'filer_x', ticker: 'AAPL', rank_in_filer: '1', total_ticker_count: '2', ticker_value: '50000' },
                    { filer_id: 'filer_y', ticker: 'AAPL', rank_in_filer: '1', total_ticker_count: '4', ticker_value: '60000' },
                ],
            });

        const map = await getPoliticianHolderShares('AAPL', ['filer_x', 'filer_y']);
        expect(map.get('filer_x')!.rankInFilerVolume).toBe(1);
        expect(map.get('filer_y')!.rankInFilerVolume).toBe(1);
        expect(map.get('filer_x')!.sharePctOfFilerVolume).toBeCloseTo(100);
        expect(map.get('filer_y')!.sharePctOfFilerVolume).toBeCloseTo(100);
    });
});

// ---------------------------------------------------------------------------
// getFilerTickerShares
// ---------------------------------------------------------------------------

describe('getFilerTickerShares — all tickers for one filer', () => {
    it('returns a Map keyed by ticker', async () => {
        // total = 300_000; AAPL 200_000 (rank 1), MSFT 100_000 (rank 2)
        mockQuery
            .mockResolvedValueOnce({ rows: [{ filer_id: 'filer_a', total_value: '300000' }] })
            .mockResolvedValueOnce({
                rows: [
                    { filer_id: 'filer_a', ticker: 'AAPL', rank_in_filer: '1', total_ticker_count: '2', ticker_value: '200000' },
                    { filer_id: 'filer_a', ticker: 'MSFT', rank_in_filer: '2', total_ticker_count: '2', ticker_value: '100000' },
                ],
            });

        const map = await getFilerTickerShares('filer_a');
        expect(map.size).toBe(2);
        expect(map.get('AAPL')!.rankInFilerVolume).toBe(1);
        expect(map.get('AAPL')!.sharePctOfFilerVolume).toBeCloseTo(66.67);
        expect(map.get('MSFT')!.rankInFilerVolume).toBe(2);
        expect(map.get('MSFT')!.sharePctOfFilerVolume).toBeCloseTo(33.33);
        expect(map.get('AAPL')!.totalTickerCount).toBe(2);
    });

    it('returns empty map when filer has no trades', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        const map = await getFilerTickerShares('ghost_filer');
        expect(map.size).toBe(0);
    });
});
