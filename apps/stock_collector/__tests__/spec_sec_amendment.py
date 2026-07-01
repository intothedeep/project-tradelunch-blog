"""Tests for NEW HOLDINGS amendment reconciliation (pure functions only, no network/DB).

Covers:
  * parse_amendment_type: unprefixed / namespaced / absent / RESTATEMENT
  * reconcile_period_filings: all 5 documented cases
"""

from datetime import date

import pytest

from collector.transform.sec_parse import (
    FilingRef,
    parse_amendment_type,
    reconcile_period_filings,
)


# --- parse_amendment_type fixtures -------------------------------------------

_COVER_NEW_HOLDINGS_UNPREFIXED = b"""<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission>
  <headerData>
    <submissionType>13F-HR/A</submissionType>
  </headerData>
  <formData>
    <coverPage>
      <reportCalendarOrQuarter>2025-03-31</reportCalendarOrQuarter>
      <amendmentInfo>
        <amendmentType>NEW HOLDINGS</amendmentType>
      </amendmentInfo>
    </coverPage>
  </formData>
</edgarSubmission>"""

_COVER_NEW_HOLDINGS_NAMESPACED = b"""<?xml version="1.0" encoding="UTF-8"?>
<ns1:edgarSubmission xmlns:ns1="http://www.sec.gov/edgar/thirteenf">
  <ns1:headerData>
    <ns1:submissionType>13F-HR/A</ns1:submissionType>
  </ns1:headerData>
  <ns1:formData>
    <ns1:coverPage>
      <ns1:amendmentInfo>
        <ns1:amendmentType>NEW HOLDINGS</ns1:amendmentType>
      </ns1:amendmentInfo>
    </ns1:coverPage>
  </ns1:formData>
</ns1:edgarSubmission>"""

_COVER_RESTATEMENT = b"""<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission>
  <formData>
    <coverPage>
      <amendmentInfo>
        <amendmentType>RESTATEMENT</amendmentType>
      </amendmentInfo>
    </coverPage>
  </formData>
</edgarSubmission>"""

_COVER_NO_AMENDMENT_TYPE = b"""<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission>
  <headerData>
    <submissionType>13F-HR</submissionType>
  </headerData>
  <formData>
    <coverPage>
      <reportCalendarOrQuarter>2025-03-31</reportCalendarOrQuarter>
    </coverPage>
  </formData>
</edgarSubmission>"""


def test_parse_amendment_type_new_holdings_unprefixed():
    result = parse_amendment_type(_COVER_NEW_HOLDINGS_UNPREFIXED)
    assert result == "NEW HOLDINGS"


def test_parse_amendment_type_new_holdings_namespaced():
    result = parse_amendment_type(_COVER_NEW_HOLDINGS_NAMESPACED)
    assert result == "NEW HOLDINGS"


def test_parse_amendment_type_restatement():
    result = parse_amendment_type(_COVER_RESTATEMENT)
    assert result == "RESTATEMENT"


def test_parse_amendment_type_absent_returns_none():
    result = parse_amendment_type(_COVER_NO_AMENDMENT_TYPE)
    assert result is None


def test_parse_amendment_type_invalid_xml_returns_none():
    result = parse_amendment_type(b"not xml at all <<<")
    assert result is None


def test_parse_amendment_type_returns_uppercase():
    xml = b"""<root><amendmentType>new holdings</amendmentType></root>"""
    result = parse_amendment_type(xml)
    assert result == "NEW HOLDINGS"


# --- reconcile_period_filings helpers -----------------------------------------

_CIK = "0001067983"
_PERIOD = date(2025, 3, 31)


def _ref(acc: str, form: str, fd: date, amendment_type: str | None = None) -> FilingRef:
    return FilingRef(
        accession=acc,
        form_type=form,
        filing_date=fd,
        period_of_report=_PERIOD,
        primary_document="primary_doc.xml",
        amendment_type=amendment_type,
    )


# --- Case 1: original + NEW HOLDINGS -> both live, none superseded
# This is the Berkshire bug scenario.

def test_reconcile_case1_original_plus_new_holdings_both_live():
    """original 13F-HR + NEW HOLDINGS amendment -> both live, no superseded."""
    original = _ref("acc-001", "13F-HR", date(2025, 5, 15))
    nh = _ref("acc-002", "13F-HR/A", date(2025, 8, 14), "NEW HOLDINGS")
    live, superseded = reconcile_period_filings([original, nh])
    assert {r.accession for r in live} == {"acc-001", "acc-002"}
    assert superseded == []


def test_reconcile_case1_order_independent():
    """Same result regardless of input order."""
    original = _ref("acc-001", "13F-HR", date(2025, 5, 15))
    nh = _ref("acc-002", "13F-HR/A", date(2025, 8, 14), "NEW HOLDINGS")
    live1, sup1 = reconcile_period_filings([original, nh])
    live2, sup2 = reconcile_period_filings([nh, original])
    assert {r.accession for r in live1} == {r.accession for r in live2}
    assert sup1 == sup2


# --- Case 2: original + RESTATEMENT -> restatement live, original superseded

def test_reconcile_case2_restatement_supersedes_original():
    """RESTATEMENT amendment replaces original."""
    original = _ref("acc-001", "13F-HR", date(2025, 5, 15))
    restatement = _ref("acc-002", "13F-HR/A", date(2025, 6, 1), "RESTATEMENT")
    live, superseded = reconcile_period_filings([original, restatement])
    assert len(live) == 1
    assert live[0].accession == "acc-002"
    assert "acc-001" in superseded


# --- Case 3: original only -> original live

def test_reconcile_case3_original_only():
    """Single original filing -> itself is live, no superseded."""
    original = _ref("acc-001", "13F-HR", date(2025, 5, 15))
    live, superseded = reconcile_period_filings([original])
    assert len(live) == 1
    assert live[0].accession == "acc-001"
    assert superseded == []


# --- Case 4: original + RESTATEMENT + later NEW HOLDINGS -> restatement + NH live

def test_reconcile_case4_restatement_then_new_holdings():
    """RESTATEMENT is base; later NEW HOLDINGS is additive."""
    original = _ref("acc-001", "13F-HR", date(2025, 5, 15))
    restatement = _ref("acc-002", "13F-HR/A", date(2025, 6, 1), "RESTATEMENT")
    nh = _ref("acc-003", "13F-HR/A", date(2025, 8, 14), "NEW HOLDINGS")
    live, superseded = reconcile_period_filings([original, restatement, nh])
    live_accs = {r.accession for r in live}
    assert live_accs == {"acc-002", "acc-003"}
    assert "acc-001" in superseded
    assert len(superseded) == 1


# --- Case 5: two NEW HOLDINGS + original -> all three live

def test_reconcile_case5_two_new_holdings_all_live():
    """Two NEW HOLDINGS amendments + original -> all three live."""
    original = _ref("acc-001", "13F-HR", date(2025, 5, 15))
    nh1 = _ref("acc-002", "13F-HR/A", date(2025, 8, 14), "NEW HOLDINGS")
    nh2 = _ref("acc-003", "13F-HR/A", date(2025, 9, 1), "NEW HOLDINGS")
    live, superseded = reconcile_period_filings([original, nh1, nh2])
    assert {r.accession for r in live} == {"acc-001", "acc-002", "acc-003"}
    assert superseded == []


# --- Edge cases ---------------------------------------------------------------

def test_reconcile_empty_returns_empty():
    live, superseded = reconcile_period_filings([])
    assert live == []
    assert superseded == []


def test_reconcile_amendment_type_none_treated_as_base():
    """amendment_type=None (not fetched yet) -> treated as non-NEW-HOLDINGS (base candidate)."""
    ref1 = _ref("acc-001", "13F-HR", date(2025, 5, 15), None)
    ref2 = _ref("acc-002", "13F-HR/A", date(2025, 6, 1), None)
    # Both are base candidates; later one wins
    live, superseded = reconcile_period_filings([ref1, ref2])
    assert len(live) == 1
    assert live[0].accession == "acc-002"
    assert "acc-001" in superseded


def test_reconcile_new_holdings_before_base_is_superseded():
    """A NEW HOLDINGS amendment filed BEFORE the base is superseded (stale addendum)."""
    nh_stale = _ref("acc-001", "13F-HR/A", date(2025, 2, 1), "NEW HOLDINGS")
    original = _ref("acc-002", "13F-HR", date(2025, 5, 15))
    live, superseded = reconcile_period_filings([nh_stale, original])
    assert {r.accession for r in live} == {"acc-002"}
    assert "acc-001" in superseded
