import pytest

from collector.transform.cusip_resolve import (
    ResolvedSecurity,
    dedupe_cusips,
    normalize_ticker,
    parse_figi_mapping,
)


# --- normalize_ticker ---------------------------------------------------------

def test_normalize_ticker_converts_share_class_slash_to_dash():
    assert normalize_ticker("BRK/B") == "BRK-B"


def test_normalize_ticker_uppercases_and_strips():
    assert normalize_ticker("  aapl ") == "AAPL"


def test_normalize_ticker_none_and_blank_return_none():
    assert normalize_ticker(None) is None
    assert normalize_ticker("   ") is None


# --- dedupe_cusips ------------------------------------------------------------

def test_dedupe_preserves_first_seen_order():
    assert dedupe_cusips(["037833100", "594918104", "037833100"]) == [
        "037833100",
        "594918104",
    ]


def test_dedupe_drops_blank_and_strips():
    assert dedupe_cusips([" 037833100 ", "", "037833100"]) == ["037833100"]


# --- parse_figi_mapping -------------------------------------------------------

def test_parse_maps_exact_match_and_normalizes_ticker():
    cusips = ["084670702"]
    response = [{"data": [{"ticker": "BRK/B", "name": "BERKSHIRE HATHAWAY INC-CL B"}]}]
    rows = parse_figi_mapping(cusips, response)
    assert rows == [
        ResolvedSecurity(
            cusip="084670702",
            ticker="BRK-B",
            name="BERKSHIRE HATHAWAY INC-CL B",
            confidence="exact",
        )
    ]


def test_parse_warning_entry_is_unresolved():
    rows = parse_figi_mapping(["999999999"], [{"warning": "No identifier found."}])
    assert rows[0].ticker is None
    assert rows[0].confidence == "unresolved"


def test_parse_empty_data_is_unresolved():
    rows = parse_figi_mapping(["037833100"], [{"data": []}])
    assert rows[0].ticker is None
    assert rows[0].confidence == "unresolved"


def test_parse_first_match_wins_when_multiple():
    response = [{"data": [{"ticker": "AAPL"}, {"ticker": "AAPL34"}]}]
    rows = parse_figi_mapping(["037833100"], response)
    assert rows[0].ticker == "AAPL"


def test_parse_length_mismatch_raises():
    with pytest.raises(ValueError):
        parse_figi_mapping(["037833100", "594918104"], [{"data": []}])


def test_parse_preserves_cusip_alignment_across_mixed_results():
    cusips = ["037833100", "999999999", "594918104"]
    response = [
        {"data": [{"ticker": "AAPL", "name": "APPLE INC"}]},
        {"warning": "No identifier found."},
        {"data": [{"ticker": "MSFT", "name": "MICROSOFT CORP"}]},
    ]
    rows = parse_figi_mapping(cusips, response)
    assert [(r.cusip, r.ticker) for r in rows] == [
        ("037833100", "AAPL"),
        ("999999999", None),
        ("594918104", "MSFT"),
    ]
