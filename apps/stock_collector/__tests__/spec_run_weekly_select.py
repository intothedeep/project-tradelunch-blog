from datetime import date

from collector.entrypoints.run_weekly import (
    GLOBAL_TOP,
    SECTOR_TOP,
    select_tracked_symbols,
)
from collector.schema.rows import RankingRow

AS_OF = date(2026, 6, 28)


def _g(sym, rank):
    return RankingRow(AS_OF, sym, "global", rank, sector="T")


def _s(sym, rank):
    return RankingRow(AS_OF, sym, "sector", rank, sector="T")


def test_global_top_n_selected():
    rows = [_g(f"S{i}", i) for i in range(1, GLOBAL_TOP + 5)]
    chosen = select_tracked_symbols(rows)
    assert "S1" in chosen and f"S{GLOBAL_TOP}" in chosen
    assert f"S{GLOBAL_TOP + 1}" not in chosen


def test_sector_top_n_selected():
    rows = [_s(f"S{i}", i) for i in range(1, SECTOR_TOP + 5)]
    chosen = select_tracked_symbols(rows)
    assert f"S{SECTOR_TOP}" in chosen and f"S{SECTOR_TOP + 1}" not in chosen


def test_dedupe_across_scopes():
    rows = [_g("AAA", 1), _s("AAA", 1)]
    chosen = select_tracked_symbols(rows)
    assert list(chosen.keys()) == ["AAA"]
