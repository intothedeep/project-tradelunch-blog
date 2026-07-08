"""Tests for collector.transform.sec_parse (pure functions only, no network/DB).

All fixtures are hand-crafted inline — no file I/O, no network calls.
"""

from datetime import date

import pytest

from collector.transform.sec_parse import (
    FilingRef,
    RawHolding,
    aggregate_holdings,
    latest_13f,
    normalize_value,
    parse_infotable,
    parse_submissions,
    units_for_period,
)
from collector.schema.rows import HoldingRow


# --- parse_submissions --------------------------------------------------------

_SUBMISSIONS_FIXTURE: dict = {
    "filings": {
        "recent": {
            "accessionNumber": [
                "0001067983-23-000070",
                "0001067983-23-000040",
                "0001067983-22-000020",
                "0001067983-23-000010",
            ],
            "form": ["13F-HR", "13F-HR/A", "10-K", "4"],
            "filingDate": ["2023-08-14", "2023-05-15", "2023-02-22", "2023-01-10"],
            "reportDate": ["2023-06-30", "2023-03-31", "2022-12-31", ""],
            "primaryDocument": ["form13f.xml", "form13f.xml", "10k.htm", "form4.xml"],
        }
    }
}


def test_parse_submissions_filters_to_13f_only():
    refs = parse_submissions(_SUBMISSIONS_FIXTURE)
    assert len(refs) == 2
    assert all(r.form_type in ("13F-HR", "13F-HR/A") for r in refs)


def test_parse_submissions_parses_dates():
    refs = parse_submissions(_SUBMISSIONS_FIXTURE)
    by_acc = {r.accession: r for r in refs}
    assert by_acc["0001067983-23-000070"].filing_date == date(2023, 8, 14)
    assert by_acc["0001067983-23-000070"].period_of_report == date(2023, 6, 30)
    assert by_acc["0001067983-23-000040"].form_type == "13F-HR/A"
    assert by_acc["0001067983-23-000040"].period_of_report == date(2023, 3, 31)


def test_parse_submissions_returns_filing_ref_objects():
    refs = parse_submissions(_SUBMISSIONS_FIXTURE)
    assert all(isinstance(r, FilingRef) for r in refs)


def test_parse_submissions_primary_document():
    refs = parse_submissions(_SUBMISSIONS_FIXTURE)
    assert all(r.primary_document == "form13f.xml" for r in refs)


def test_parse_submissions_empty_forms_returns_empty():
    data = {
        "filings": {
            "recent": {
                "accessionNumber": ["0001-23-000001"],
                "form": ["10-K"],
                "filingDate": ["2023-02-22"],
                "reportDate": ["2022-12-31"],
                "primaryDocument": ["10k.htm"],
            }
        }
    }
    assert parse_submissions(data) == []


# --- latest_13f ---------------------------------------------------------------


def test_latest_13f_picks_later_filing_date():
    refs = [
        FilingRef("acc-001", "13F-HR", date(2023, 5, 15), date(2023, 3, 31), "a.xml"),
        FilingRef("acc-002", "13F-HR", date(2023, 8, 14), date(2023, 6, 30), "b.xml"),
    ]
    result = latest_13f(refs)
    assert result is not None
    assert result.accession == "acc-002"


def test_latest_13f_amendment_wins_when_later():
    refs = [
        FilingRef("acc-001", "13F-HR", date(2023, 5, 15), date(2023, 3, 31), "a.xml"),
        FilingRef("acc-002", "13F-HR/A", date(2023, 6, 1), date(2023, 3, 31), "b.xml"),
    ]
    result = latest_13f(refs)
    assert result is not None
    assert result.form_type == "13F-HR/A"
    assert result.accession == "acc-002"


def test_latest_13f_tiebreak_by_accession():
    refs = [
        FilingRef("acc-002", "13F-HR", date(2023, 8, 14), date(2023, 6, 30), "a.xml"),
        FilingRef("acc-001", "13F-HR/A", date(2023, 8, 14), date(2023, 6, 30), "b.xml"),
    ]
    result = latest_13f(refs)
    # acc-002 > acc-001 lexicographically
    assert result is not None
    assert result.accession == "acc-002"


def test_latest_13f_empty_returns_none():
    assert latest_13f([]) is None


def test_latest_13f_single_entry():
    ref = FilingRef("acc-001", "13F-HR", date(2023, 5, 15), date(2023, 3, 31), "a.xml")
    assert latest_13f([ref]) == ref


# --- parse_infotable: unprefixed XML -----------------------------------------

_UNPREFIXED_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<informationTable>
  <infoTable>
    <nameOfIssuer>APPLE INC</nameOfIssuer>
    <titleOfClass>COM</titleOfClass>
    <cusip>037833100</cusip>
    <value>5000</value>
    <shrsOrPrnAmt>
      <sshPrnamt>100000</sshPrnamt>
      <sshPrnamtType>SH</sshPrnamtType>
    </shrsOrPrnAmt>
    <putCall></putCall>
  </infoTable>
  <infoTable>
    <nameOfIssuer>NVIDIA CORP</nameOfIssuer>
    <titleOfClass>COM</titleOfClass>
    <cusip>67066G104</cusip>
    <value>3000</value>
    <shrsOrPrnAmt>
      <sshPrnamt>20000</sshPrnamt>
      <sshPrnamtType>SH</sshPrnamtType>
    </shrsOrPrnAmt>
    <putCall>PUT</putCall>
  </infoTable>
</informationTable>"""

_NAMESPACED_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<ns1:informationTable xmlns:ns1="http://www.sec.gov/edgar/document/thirteenf/informationtable">
  <ns1:infoTable>
    <ns1:nameOfIssuer>APPLE INC</ns1:nameOfIssuer>
    <ns1:titleOfClass>COM</ns1:titleOfClass>
    <ns1:cusip>037833100</ns1:cusip>
    <ns1:value>5000</ns1:value>
    <ns1:shrsOrPrnAmt>
      <ns1:sshPrnamt>100000</ns1:sshPrnamt>
      <ns1:sshPrnamtType>SH</ns1:sshPrnamtType>
    </ns1:shrsOrPrnAmt>
    <ns1:putCall></ns1:putCall>
  </ns1:infoTable>
  <ns1:infoTable>
    <ns1:nameOfIssuer>NVIDIA CORP</ns1:nameOfIssuer>
    <ns1:titleOfClass>COM</ns1:titleOfClass>
    <ns1:cusip>67066G104</ns1:cusip>
    <ns1:value>3000</ns1:value>
    <ns1:shrsOrPrnAmt>
      <ns1:sshPrnamt>20000</ns1:sshPrnamt>
      <ns1:sshPrnamtType>SH</ns1:sshPrnamtType>
    </ns1:shrsOrPrnAmt>
    <ns1:putCall>put</ns1:putCall>
  </ns1:infoTable>
</ns1:informationTable>"""


def test_parse_infotable_unprefixed_count():
    holdings = parse_infotable(_UNPREFIXED_XML)
    assert len(holdings) == 2


def test_parse_infotable_namespaced_count():
    holdings = parse_infotable(_NAMESPACED_XML)
    assert len(holdings) == 2


def test_parse_infotable_namespace_agnostic_same_result():
    unprefixed = parse_infotable(_UNPREFIXED_XML)
    namespaced = parse_infotable(_NAMESPACED_XML)
    assert len(unprefixed) == len(namespaced)
    for u, n in zip(unprefixed, namespaced):
        assert u.cusip == n.cusip
        assert u.name_of_issuer == n.name_of_issuer
        assert u.value_raw == n.value_raw
        assert u.shares == n.shares
        assert u.prn_type == n.prn_type
        assert u.put_call == n.put_call


def test_parse_infotable_empty_put_call_becomes_empty_string():
    holdings = parse_infotable(_UNPREFIXED_XML)
    apple = next(h for h in holdings if h.cusip == "037833100")
    assert apple.put_call == ""


def test_parse_infotable_put_call_uppercased():
    # namespaced XML has lowercase 'put'
    holdings = parse_infotable(_NAMESPACED_XML)
    nvda = next(h for h in holdings if h.cusip == "67066G104")
    assert nvda.put_call == "PUT"


def test_parse_infotable_sh_type():
    holdings = parse_infotable(_UNPREFIXED_XML)
    apple = next(h for h in holdings if h.cusip == "037833100")
    assert apple.prn_type == "SH"
    assert apple.shares == 100000


def test_parse_infotable_value_raw_is_integer():
    holdings = parse_infotable(_UNPREFIXED_XML)
    assert all(isinstance(h.value_raw, int) for h in holdings)


def test_parse_infotable_prn_type_xml():
    prn_xml = b"""<?xml version="1.0"?>
<informationTable>
  <infoTable>
    <nameOfIssuer>BOND FUND</nameOfIssuer>
    <titleOfClass>NOTE</titleOfClass>
    <cusip>AAAAAAAAA</cusip>
    <value>9999</value>
    <shrsOrPrnAmt>
      <sshPrnamt>500000</sshPrnamt>
      <sshPrnamtType>PRN</sshPrnamtType>
    </shrsOrPrnAmt>
    <putCall></putCall>
  </infoTable>
</informationTable>"""
    holdings = parse_infotable(prn_xml)
    assert holdings[0].prn_type == "PRN"
    assert holdings[0].shares == 500000


# --- normalize_value ----------------------------------------------------------


def test_normalize_value_threshold_date_is_usd():
    val, units = normalize_value(1000, date(2022, 12, 31))
    assert val == 1000
    assert units == "usd"


def test_normalize_value_pre_threshold_is_thousands():
    val, units = normalize_value(1000, date(2022, 9, 30))
    assert val == 1_000_000
    assert units == "usd_thousands"


def test_normalize_value_recent_period_is_usd():
    val, units = normalize_value(5_000_000, date(2025, 6, 30))
    assert val == 5_000_000
    assert units == "usd"


def test_normalize_value_2023_is_usd():
    val, units = normalize_value(250, date(2023, 3, 31))
    assert val == 250
    assert units == "usd"


def test_units_for_period_threshold():
    assert units_for_period(date(2022, 12, 31)) == "usd"


def test_units_for_period_before_threshold():
    assert units_for_period(date(2022, 9, 30)) == "usd_thousands"


def test_units_for_period_recent():
    assert units_for_period(date(2025, 6, 30)) == "usd"


# --- aggregate_holdings -------------------------------------------------------

_CIK = "0001067983"
_ACC = "0001067983-23-000070"
_PERIOD_USD = date(2023, 6, 30)  # >= threshold -> already USD
_PERIOD_K = date(2022, 9, 30)    # < threshold -> thousands


def _raw(cusip: str, value: int, shares: int | None, put_call: str = "", prn_type: str = "SH") -> RawHolding:
    return RawHolding(
        cusip=cusip,
        name_of_issuer="ISSUER",
        title_of_class="COM",
        value_raw=value,
        shares=shares,
        prn_type=prn_type,
        put_call=put_call,
    )


def test_aggregate_same_cusip_two_managers_merged():
    """Same cusip from two otherManagers -> ONE aggregated row."""
    raws = [
        _raw("037833100", 1000, 100),
        _raw("037833100", 2000, 200),
    ]
    rows = aggregate_holdings(raws, cik=_CIK, accession=_ACC, period=_PERIOD_USD)
    assert len(rows) == 1
    assert rows[0].cusip == "037833100"
    assert rows[0].value_usd == 3000
    assert rows[0].shares == 300


def test_aggregate_same_cusip_put_vs_none_are_distinct():
    """Same cusip with putCall='' and 'PUT' -> TWO rows."""
    raws = [
        _raw("037833100", 1000, 100, put_call=""),
        _raw("037833100", 500, 50, put_call="PUT"),
    ]
    rows = aggregate_holdings(raws, cik=_CIK, accession=_ACC, period=_PERIOD_USD)
    assert len(rows) == 2
    put_calls = {r.put_call for r in rows}
    assert put_calls == {"", "PUT"}


def test_aggregate_same_cusip_sh_vs_prn_are_distinct():
    """Same cusip with SH and PRN prn_type -> TWO rows."""
    raws = [
        _raw("037833100", 1000, 100, prn_type="SH"),
        _raw("037833100", 500, None, prn_type="PRN"),
    ]
    rows = aggregate_holdings(raws, cik=_CIK, accession=_ACC, period=_PERIOD_USD)
    assert len(rows) == 2
    prn_types = {r.prn_type for r in rows}
    assert prn_types == {"SH", "PRN"}


def test_aggregate_shares_none_when_all_none():
    """If all shares are None for a group -> HoldingRow.shares is None."""
    raws = [
        _raw("037833100", 1000, None),
        _raw("037833100", 2000, None),
    ]
    rows = aggregate_holdings(raws, cik=_CIK, accession=_ACC, period=_PERIOD_USD)
    assert rows[0].shares is None


def test_aggregate_shares_sums_non_none():
    """Mixed None and int shares -> sum only the non-None."""
    raws = [
        _raw("037833100", 1000, 100),
        _raw("037833100", 2000, None),
        _raw("037833100", 3000, 200),
    ]
    rows = aggregate_holdings(raws, cik=_CIK, accession=_ACC, period=_PERIOD_USD)
    assert rows[0].shares == 300  # only 100 + 200


def test_aggregate_value_usd_pre_threshold_multiplied():
    """Pre-2023 period -> value multiplied by 1000."""
    raws = [_raw("037833100", 1000, 100)]
    rows = aggregate_holdings(raws, cik=_CIK, accession=_ACC, period=_PERIOD_K)
    assert rows[0].value_usd == 1_000_000


def test_aggregate_output_deterministic_order():
    """Output is sorted by (cusip, put_call, prn_type)."""
    raws = [
        _raw("BBBBBBBBB", 100, 10),
        _raw("AAAAAAAAA", 200, 20),
    ]
    rows = aggregate_holdings(raws, cik=_CIK, accession=_ACC, period=_PERIOD_USD)
    assert rows[0].cusip == "AAAAAAAAA"
    assert rows[1].cusip == "BBBBBBBBB"


def test_aggregate_holding_row_fields():
    """HoldingRow carries correct cik, accession, period_of_report."""
    raws = [_raw("037833100", 5000, 50)]
    rows = aggregate_holdings(raws, cik=_CIK, accession=_ACC, period=_PERIOD_USD)
    r = rows[0]
    assert r.cik == _CIK
    assert r.accession == _ACC
    assert r.period_of_report == _PERIOD_USD
    assert isinstance(r, HoldingRow)


def test_aggregate_empty_returns_empty():
    rows = aggregate_holdings([], cik=_CIK, accession=_ACC, period=_PERIOD_USD)
    assert rows == []
