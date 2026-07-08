"""Tests for collector.transform.politician_parse (pure functions only, no I/O).

Fixture: __tests__/kadoa_trades_sample.json (40 real kadoa records).
Covers:
  * all 40 records parse without error
  * transaction_type mapping edges (Purchase, Sale (Full), Sale (Partial), Exchange)
  * owner mapping edges (Self, SP, Spouse, JT, Joint, Child, DC, None)
  * asset_type mapping (equity codes, bond codes, option codes, other/unknown)
  * null ticker preserved as None; BRK.B -> BRK-B normalization
  * geometric-mean value_estimate correctness; None when bounds missing
  * executive 278-T row parsed (branch='executive', filing_type='278-T')
  * registry dedup: distinct filer_ids only
  * filer_id guard: records with null/empty filer_id are skipped entirely
    (no trade row, no registry row) — prevents FK violation on upsert batch
  * parse_filers: all 20 filers.json records map to PoliticianRow; est_volume rounded;
    photo_url carried; records without id are skipped
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from collector.transform.politician_parse import (
    _geometric_mean,
    _normalize_asset_type,
    _normalize_owner,
    _normalize_ticker,
    _normalize_transaction_type,
    parse_filers,
    parse_trades,
)

# ---------------------------------------------------------------------------
# Fixture loading
# ---------------------------------------------------------------------------

_FIXTURE_PATH = Path(__file__).parent / "kadoa_trades_sample.json"


@pytest.fixture(scope="module")
def sample_records() -> list[dict]:
    return json.loads(_FIXTURE_PATH.read_text())


@pytest.fixture(scope="module")
def parsed(sample_records):
    trades, registry = parse_trades(sample_records)
    return trades, registry


# ---------------------------------------------------------------------------
# Fixture integrity
# ---------------------------------------------------------------------------


def test_fixture_has_40_records(sample_records):
    assert len(sample_records) == 40


def test_all_40_parse(parsed):
    trades, _ = parsed
    assert len(trades) == 40


# ---------------------------------------------------------------------------
# Registry dedup
# ---------------------------------------------------------------------------


def test_registry_dedup(parsed):
    trades, registry = parsed
    filer_ids_in_trades = {t.filer_id for t in trades}
    registry_ids = {r.filer_id for r in registry}
    # Every trade filer_id must appear in registry
    assert filer_ids_in_trades == registry_ids
    # No duplicates
    assert len(registry) == len(registry_ids)


# ---------------------------------------------------------------------------
# transaction_type mapping edges
# ---------------------------------------------------------------------------


def test_transaction_type_purchase():
    assert _normalize_transaction_type("Purchase") == "buy"


def test_transaction_type_sale_full():
    assert _normalize_transaction_type("Sale (Full)") == "sell"


def test_transaction_type_sale_partial():
    assert _normalize_transaction_type("Sale (Partial)") == "sell"


def test_transaction_type_exchange():
    assert _normalize_transaction_type("Exchange") == "exchange"


def test_transaction_type_unknown_fallback():
    # Unknown strings fall back to 'exchange' (conservative)
    assert _normalize_transaction_type("Transfer") == "exchange"


def test_transaction_type_none_fallback():
    assert _normalize_transaction_type(None) == "exchange"


def test_parsed_transaction_types_valid(parsed):
    trades, _ = parsed
    valid = {"buy", "sell", "exchange"}
    assert all(t.transaction_type in valid for t in trades)


def test_exchange_trade_present_in_fixture(parsed):
    trades, _ = parsed
    exchanges = [t for t in trades if t.transaction_type == "exchange"]
    assert len(exchanges) >= 1, "fixture should contain at least one Exchange row"


# ---------------------------------------------------------------------------
# owner mapping edges
# ---------------------------------------------------------------------------


def test_owner_self():
    assert _normalize_owner("Self") == "self"


def test_owner_sp():
    assert _normalize_owner("SP") == "spouse"


def test_owner_spouse():
    assert _normalize_owner("Spouse") == "spouse"


def test_owner_jt():
    assert _normalize_owner("JT") == "joint"


def test_owner_joint():
    assert _normalize_owner("Joint") == "joint"


def test_owner_child():
    assert _normalize_owner("Child") == "dependent"


def test_owner_dc():
    assert _normalize_owner("DC") == "dependent"


def test_owner_none():
    assert _normalize_owner(None) is None


def test_owner_unknown_returns_none():
    # Unknown owner codes map to None (not preserved)
    assert _normalize_owner("Unknown") is None


def test_parsed_owner_values(parsed):
    trades, _ = parsed
    valid = {"self", "spouse", "joint", "dependent", None}
    assert all(t.filer_owner in valid for t in trades)


# ---------------------------------------------------------------------------
# asset_type mapping
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("code", ["CS", "PS", "ST", "Stock", "Non-Public Stock"])
def test_equity_codes(code):
    assert _normalize_asset_type(code) == "equity"


@pytest.mark.parametrize("code", ["GS", "Corporate Bond", "Municipal Security"])
def test_bond_codes(code):
    assert _normalize_asset_type(code) == "bond"


@pytest.mark.parametrize("code", ["OP", "OL"])
def test_option_codes(code):
    assert _normalize_asset_type(code) == "option"


def test_other_fallback():
    assert _normalize_asset_type("HN") == "other"
    assert _normalize_asset_type("OT") == "other"
    assert _normalize_asset_type(None) == "other"


def test_parsed_asset_types_valid(parsed):
    trades, _ = parsed
    valid = {"equity", "bond", "option", "other"}
    assert all(t.asset_type in valid for t in trades)


# ---------------------------------------------------------------------------
# Ticker normalization
# ---------------------------------------------------------------------------


def test_ticker_normalize_uppercase():
    assert _normalize_ticker("goog") == "GOOG"


def test_ticker_normalize_dot_to_dash():
    assert _normalize_ticker("BRK.B") == "BRK-B"


def test_ticker_none_returns_none():
    assert _normalize_ticker(None) is None


def test_ticker_empty_returns_none():
    assert _normalize_ticker("") is None
    assert _normalize_ticker("   ") is None


def test_brk_b_in_fixture(parsed):
    """Fixture contains BRK.B — must survive as BRK-B after normalization."""
    trades, _ = parsed
    tickers = {t.ticker for t in trades if t.ticker is not None}
    assert "BRK-B" in tickers


def test_null_tickers_preserved(parsed):
    trades, _ = parsed
    null_count = sum(1 for t in trades if t.ticker is None)
    assert null_count > 0, "fixture should have records with null ticker"


# ---------------------------------------------------------------------------
# Geometric-mean value_estimate
# ---------------------------------------------------------------------------


def test_geometric_mean_basic():
    # sqrt(1001 * 15000) = sqrt(15_015_000) ≈ 3875.05 -> round -> 3875
    expected = round(math.sqrt(1001 * 15000))
    assert _geometric_mean(1001, 15000) == expected


def test_geometric_mean_none_low():
    assert _geometric_mean(None, 15000) is None


def test_geometric_mean_none_high():
    assert _geometric_mean(1001, None) is None


def test_geometric_mean_zero_guard():
    assert _geometric_mean(0, 15000) is None


def test_parsed_value_estimate_correct(parsed):
    """All rows with both value_min/max set must have correct geometric mean."""
    trades, _ = parsed
    for t in trades:
        if t.value_min is not None and t.value_max is not None:
            expected = round(math.sqrt(t.value_min * t.value_max))
            assert t.value_estimate == expected, (
                f"external_id={t.external_id}: "
                f"expected {expected}, got {t.value_estimate}"
            )


# ---------------------------------------------------------------------------
# Executive 278-T row
# ---------------------------------------------------------------------------


def test_executive_278t_row(parsed):
    """Fixture contains one OGE executive 278-T record — must parse correctly."""
    trades, registry = parsed
    exec_trades = [t for t in trades if t.filing_type == "278-T"]
    assert len(exec_trades) >= 1

    oge = exec_trades[0]
    assert oge.source_id == "oge_executive"

    # Registry entry for this filer must exist
    oge_filer_ids = {t.filer_id for t in exec_trades}
    registry_ids = {r.filer_id for r in registry}
    assert oge_filer_ids.issubset(registry_ids)

    # Branch should be 'executive'
    oge_registry = [r for r in registry if r.filer_id in oge_filer_ids]
    assert all(r.branch == "executive" for r in oge_registry)


# ---------------------------------------------------------------------------
# FIX 1 (H2): filer_id FK guard — records with null/empty filer_id are skipped
# ---------------------------------------------------------------------------

_BASE_VALID_REC: dict = {
    "id": "test-valid-001",
    "filing_date": "2026-01-15",
    "filer_id": "valid-filer",
    "filer_name": "Valid Filer",
    "transaction_type": "Purchase",
    "ticker": "AAPL",
    "amount_range_low": 1001,
    "amount_range_high": 15000,
}


def test_filer_id_null_skips_trade_row():
    """A record with filer_id: null must produce NO trade row and NO registry row."""
    rec = {**_BASE_VALID_REC, "id": "test-null-filer", "filer_id": None}
    trades, registry = parse_trades([rec])
    assert trades == [], "trade row must NOT be emitted when filer_id is null"
    assert registry == [], "registry row must NOT be emitted when filer_id is null"


def test_filer_id_empty_string_skips_trade_row():
    """A record with filer_id: '' must produce NO trade row and NO registry row."""
    rec = {**_BASE_VALID_REC, "id": "test-empty-filer", "filer_id": ""}
    trades, registry = parse_trades([rec])
    assert trades == [], "trade row must NOT be emitted when filer_id is empty string"
    assert registry == [], "registry row must NOT be emitted when filer_id is empty string"


def test_filer_id_null_does_not_affect_valid_siblings():
    """Null-filer record is dropped; sibling records with valid filer_id still parse."""
    bad = {**_BASE_VALID_REC, "id": "test-null-sibling", "filer_id": None}
    good = {**_BASE_VALID_REC, "id": "test-good-sibling", "filer_id": "real-filer"}
    trades, registry = parse_trades([bad, good])
    assert len(trades) == 1
    assert trades[0].external_id == "test-good-sibling"
    assert len(registry) == 1
    assert registry[0].filer_id == "real-filer"


# ---------------------------------------------------------------------------
# parse_filers (Q10.2) — kadoa_filers_sample.json (20 records)
# ---------------------------------------------------------------------------

_FILERS_FIXTURE_PATH = Path(__file__).parent / "kadoa_filers_sample.json"


@pytest.fixture(scope="module")
def filers_records() -> list[dict]:
    return json.loads(_FILERS_FIXTURE_PATH.read_text())


@pytest.fixture(scope="module")
def parsed_filers(filers_records):
    return parse_filers(filers_records)


def test_parse_filers_all_20_produce_rows(filers_records, parsed_filers):
    """All 20 records in filers_sample have valid id -> 20 PoliticianRow instances."""
    assert len(parsed_filers) == len(filers_records)
    assert len(parsed_filers) == 20


def test_parse_filers_filer_ids_unique(parsed_filers):
    ids = [r.filer_id for r in parsed_filers]
    assert len(ids) == len(set(ids)), "filer_id must be unique in parse_filers output"


def test_parse_filers_est_volume_rounded_to_int(filers_records, parsed_filers):
    """est_volume is float in JSON (e.g. 230290737.5); must be rounded to int."""
    for row, rec in zip(parsed_filers, filers_records):
        raw = rec.get("est_volume")
        if raw is not None:
            assert isinstance(row.est_volume, int), (
                f"{row.filer_id}: est_volume must be int, got {type(row.est_volume)}"
            )
            assert row.est_volume == int(round(raw)), (
                f"{row.filer_id}: expected {int(round(raw))}, got {row.est_volume}"
            )


def test_parse_filers_photo_url_carried(filers_records, parsed_filers):
    """photo_url is carried from filers.json when present."""
    for row, rec in zip(parsed_filers, filers_records):
        assert row.photo_url == rec.get("photo_url"), (
            f"{row.filer_id}: photo_url mismatch"
        )


def test_parse_filers_aggregate_fields_carried(filers_records, parsed_filers):
    """trade_count, purchases, sales, late_filings are carried as-is."""
    for row, rec in zip(parsed_filers, filers_records):
        assert row.trade_count == rec.get("trade_count")
        assert row.purchases == rec.get("purchases")
        assert row.sales == rec.get("sales")
        assert row.late_filings == rec.get("late_filings")


def test_parse_filers_source_is_kadoa(parsed_filers):
    assert all(r.source == "kadoa" for r in parsed_filers)


def test_parse_filers_skips_record_without_id():
    """Records missing 'id' are dropped; all others are kept."""
    records = [
        {"id": None, "full_name": "No ID"},
        {"id": "house_test", "full_name": "Test Rep", "branch": "congress"},
    ]
    rows = parse_filers(records)
    assert len(rows) == 1
    assert rows[0].filer_id == "house_test"
