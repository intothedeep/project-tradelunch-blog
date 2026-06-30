"""Tests for collector.config.funds_loader (pure functions only, no network/DB)."""

import pytest

from collector.config.funds_loader import load_funds, parse_funds
from collector.schema.rows import FundEntry


# --- parse_funds: valid inputs ------------------------------------------------


def test_parse_funds_returns_fund_entries():
    data = {
        "funds": [
            {"cik": "0001067983", "label": "Berkshire Hathaway"},
            {"cik": "0001364742", "label": "BlackRock"},
        ]
    }
    entries = parse_funds(data)
    assert len(entries) == 2
    assert all(isinstance(e, FundEntry) for e in entries)


def test_parse_funds_zero_pads_short_cik():
    data = {"funds": [{"cik": "1067983", "label": "Berkshire Hathaway"}]}
    entries = parse_funds(data)
    assert entries[0].cik == "0001067983"


def test_parse_funds_already_padded_cik_unchanged():
    data = {"funds": [{"cik": "0001067983", "label": "Berkshire Hathaway"}]}
    entries = parse_funds(data)
    assert entries[0].cik == "0001067983"


def test_parse_funds_single_digit_cik_pads_to_ten():
    data = {"funds": [{"cik": "1", "label": "Tiny Fund"}]}
    entries = parse_funds(data)
    assert entries[0].cik == "0000000001"


def test_parse_funds_preserves_label():
    data = {"funds": [{"cik": "0001067983", "label": "Berkshire Hathaway"}]}
    entries = parse_funds(data)
    assert entries[0].label == "Berkshire Hathaway"


def test_parse_funds_empty_list_returns_empty():
    data = {"funds": []}
    entries = parse_funds(data)
    assert entries == []


# --- parse_funds: invalid inputs ---------------------------------------------


def test_parse_funds_missing_label_raises():
    data = {"funds": [{"cik": "0001067983"}]}
    with pytest.raises(ValueError, match="missing cik or label"):
        parse_funds(data)


def test_parse_funds_missing_cik_raises():
    data = {"funds": [{"label": "No CIK Fund"}]}
    with pytest.raises(ValueError, match="missing cik or label"):
        parse_funds(data)


def test_parse_funds_non_digit_cik_raises():
    data = {"funds": [{"cik": "ABCD123456", "label": "Bad Fund"}]}
    with pytest.raises(ValueError, match="digits only"):
        parse_funds(data)


def test_parse_funds_cik_with_spaces_non_digit_raises():
    data = {"funds": [{"cik": "1234 5678", "label": "Spaced Fund"}]}
    with pytest.raises(ValueError, match="digits only"):
        parse_funds(data)


def test_parse_funds_cik_longer_than_10_digits_raises():
    data = {"funds": [{"cik": "12345678901", "label": "Too Long Fund"}]}
    with pytest.raises(ValueError, match="longer than 10 digits"):
        parse_funds(data)


def test_parse_funds_duplicate_cik_raises():
    data = {
        "funds": [
            {"cik": "0001067983", "label": "Fund A"},
            {"cik": "1067983", "label": "Fund B"},  # same after padding
        ]
    }
    with pytest.raises(ValueError, match="duplicate cik"):
        parse_funds(data)


def test_parse_funds_duplicate_label_raises():
    data = {
        "funds": [
            {"cik": "0001067983", "label": "Same Name"},
            {"cik": "0001364742", "label": "Same Name"},
        ]
    }
    with pytest.raises(ValueError, match="duplicate label"):
        parse_funds(data)


def test_parse_funds_missing_funds_key_raises():
    with pytest.raises(ValueError, match="'funds' key"):
        parse_funds({"other": []})


def test_parse_funds_not_a_dict_raises():
    with pytest.raises(ValueError):
        parse_funds(["cik", "label"])


# --- load_funds: real file ----------------------------------------------------


def test_load_funds_real_file_returns_six_entries():
    entries = load_funds()
    assert len(entries) == 6


def test_load_funds_real_file_all_ciks_10_chars():
    entries = load_funds()
    for e in entries:
        assert len(e.cik) == 10, f"cik {e.cik!r} is not 10 chars"
        assert e.cik.isdigit(), f"cik {e.cik!r} is not all digits"


def test_load_funds_berkshire_present():
    entries = load_funds()
    ciks = {e.cik for e in entries}
    assert "0001067983" in ciks


def test_load_funds_labels_unique():
    entries = load_funds()
    labels = [e.label for e in entries]
    assert len(labels) == len(set(labels))


def test_load_funds_ciks_unique():
    entries = load_funds()
    ciks = [e.cik for e in entries]
    assert len(ciks) == len(set(ciks))
