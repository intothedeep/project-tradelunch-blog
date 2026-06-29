from datetime import datetime, timedelta, timezone

from collector.ranking.fundamentals import (
    SECTOR_MAX_AGE,
    SHARES_MAX_AGE,
    derive_market_cap,
    is_stale,
    plan_refresh,
)
from collector.schema.rows import FundamentalsRow

NOW = datetime(2026, 6, 29, tzinfo=timezone.utc)


def test_is_stale_none_is_stale():
    assert is_stale(None, NOW, SHARES_MAX_AGE) is True


def test_is_stale_fresh_vs_old():
    fresh = NOW - timedelta(days=10)
    old = NOW - timedelta(days=40)
    assert is_stale(fresh, NOW, SHARES_MAX_AGE) is False
    assert is_stale(old, NOW, SHARES_MAX_AGE) is True


def test_derive_market_cap():
    assert derive_market_cap(10.0, 2.5) == 25.0
    assert derive_market_cap(None, 2.5) is None
    assert derive_market_cap(10.0, None) is None


def test_plan_refresh_missing_symbol_needs_both():
    plan = plan_refresh(["AAA"], {}, NOW)
    assert plan.shares == ("AAA",) and plan.sector == ("AAA",)


def test_plan_refresh_warm_cache_skips_both():
    cached = {
        "AAA": FundamentalsRow(
            "AAA", shares_outstanding=100.0, sector="Tech",
            shares_refreshed_at=NOW - timedelta(days=5),
            sector_refreshed_at=NOW - timedelta(days=5),
        )
    }
    plan = plan_refresh(["AAA"], cached, NOW)
    assert plan.shares == () and plan.sector == ()


def test_plan_refresh_shares_stale_sector_fresh():
    # shares aged past 30d, sector still within 90d -> only shares refetched
    cached = {
        "AAA": FundamentalsRow(
            "AAA", shares_outstanding=100.0, sector="Tech",
            shares_refreshed_at=NOW - SHARES_MAX_AGE,
            sector_refreshed_at=NOW - timedelta(days=45),
        )
    }
    plan = plan_refresh(["AAA"], cached, NOW)
    assert plan.shares == ("AAA",) and plan.sector == ()


def test_plan_refresh_sector_quarterly_boundary():
    cached = {
        "AAA": FundamentalsRow(
            "AAA", shares_outstanding=100.0, sector="Tech",
            shares_refreshed_at=NOW - timedelta(days=1),
            sector_refreshed_at=NOW - SECTOR_MAX_AGE,
        )
    }
    plan = plan_refresh(["AAA"], cached, NOW)
    assert plan.shares == () and plan.sector == ("AAA",)
