from datetime import date

from collector.ranking.screen import MarketCapObs, rank

AS_OF = date(2026, 6, 28)


def test_global_ranks_all_by_market_cap_desc():
    obs = [
        MarketCapObs("AAA", "Tech", 100.0),
        MarketCapObs("BBB", "Tech", 300.0),
        MarketCapObs("CCC", "Energy", 200.0),
    ]
    rows = [r for r in rank(obs, AS_OF) if r.scope == "global"]
    assert [(r.symbol, r.rank) for r in rows] == [("BBB", 1), ("CCC", 2), ("AAA", 3)]


def test_per_sector_ranks_within_sector():
    obs = [
        MarketCapObs("AAA", "Tech", 100.0),
        MarketCapObs("BBB", "Tech", 300.0),
        MarketCapObs("CCC", "Energy", 200.0),
    ]
    sector = {(r.symbol): r.rank for r in rank(obs, AS_OF) if r.scope == "sector"}
    assert sector["BBB"] == 1 and sector["AAA"] == 2  # Tech
    assert sector["CCC"] == 1  # Energy (only one)


def test_missing_market_cap_sorts_last_but_is_recorded():
    obs = [MarketCapObs("AAA", "Tech", None), MarketCapObs("BBB", "Tech", 50.0)]
    g = {r.symbol: r.rank for r in rank(obs, AS_OF) if r.scope == "global"}
    assert g["BBB"] == 1 and g["AAA"] == 2  # all recorded; None last


def test_tie_breaks_on_symbol_ascending():
    obs = [MarketCapObs("ZZZ", "T", 100.0), MarketCapObs("AAA", "T", 100.0)]
    g = [r.symbol for r in rank(obs, AS_OF) if r.scope == "global"]
    assert g == ["AAA", "ZZZ"]


def test_symbol_without_sector_skipped_in_sector_scope_only():
    obs = [MarketCapObs("AAA", None, 100.0)]
    rows = rank(obs, AS_OF)
    assert any(r.scope == "global" for r in rows)
    assert not any(r.scope == "sector" for r in rows)
