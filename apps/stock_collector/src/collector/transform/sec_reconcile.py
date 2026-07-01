"""Pure reconciliation logic for SEC 13F amendment types.

Purpose: determine which filings for a period are LIVE vs SUPERSEDED, and
parse <amendmentType> from a cover-page XML document. Extracted from
sec_parse.py to keep that file ≤300 LOC.

Invariants:
  * parse_amendment_type: NAMESPACE-AGNOSTIC — matches on local XML tag name
    only (never hardcoded namespace). Returns uppercased string or None.
  * reconcile_period_filings: pure function; no I/O. Implements the rule:
      base  = MAX filing_date among non-NEW-HOLDINGS filings (original / restatement)
      live  = {base} ∪ {NEW HOLDINGS amendments with filing_date >= base}
      superseded = everything else in the period group.
    Handles 5 documented cases; see docstring.

Side effects: none.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Optional

from collector.transform.sec_parse import FilingRef

_AMENDMENT_TYPE_NEW_HOLDINGS = "NEW HOLDINGS"


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def parse_amendment_type(primary_doc_xml: bytes) -> Optional[str]:
    """Parse <amendmentType> from a 13F cover-page XML document.

    NAMESPACE-AGNOSTIC: matches on local tag name only so both unprefixed
    (<amendmentType>) and namespaced (<ns1:amendmentType>) variants parse
    identically.

    Returns the uppercased string value (e.g. 'RESTATEMENT', 'NEW HOLDINGS')
    or None when the element is absent (original 13F-HR filings never carry it).

    Pure — no I/O, no side effects.
    """
    try:
        root = ET.fromstring(primary_doc_xml)
    except ET.ParseError:
        return None

    for elem in root.iter():
        if _local(elem.tag) == "amendmentType":
            text = (elem.text or "").strip().upper()
            return text if text else None
    return None


def reconcile_period_filings(
    filings: list[FilingRef],
) -> tuple[list[FilingRef], list[str]]:
    """Determine LIVE vs SUPERSEDED accessions for a single period's filings.

    Reconciliation rule:
      base  = filing with MAX filing_date among those that are NOT 'NEW HOLDINGS'
               (i.e. original 13F-HR or RESTATEMENT amendments). This is the
               full-portfolio filing.
      live  = {base} ∪ {every NEW HOLDINGS amendment with filing_date >= base.filing_date}
      superseded = every other accession in the group.

    NEW HOLDINGS amendments list only previously-confidential positions whose
    treatment expired; they are ADDITIVE to the base portfolio, not replacements.
    Treating them as superseding the original causes the Berkshire bug (4 holdings
    shown instead of 110+4).

    Cases:
      1. original + NEW HOLDINGS → both live, none superseded
      2. original + RESTATEMENT → restatement live, original superseded
      3. original only → original live
      4. original + RESTATEMENT + later NEW HOLDINGS → restatement + NH live,
         original superseded
      5. two NEW HOLDINGS + original → all three live (both NH >= original date)

    Pure — no I/O, no side effects.

    Args:
        filings: list of FilingRef for ONE period (amendment_type already populated).

    Returns:
        (live, superseded_accessions) where live is the list of FilingRef to ingest
        and superseded_accessions is the list of accession strings to soft-delete.
    """
    if not filings:
        return [], []

    # Partition: new-holdings amendments vs everything else (base candidates)
    new_holdings: list[FilingRef] = [
        f for f in filings if f.amendment_type == _AMENDMENT_TYPE_NEW_HOLDINGS
    ]
    base_candidates: list[FilingRef] = [
        f for f in filings if f.amendment_type != _AMENDMENT_TYPE_NEW_HOLDINGS
    ]

    if not base_candidates:
        # Degenerate: only NEW HOLDINGS filings (no original) — keep all
        return list(filings), []

    base = max(base_candidates, key=lambda f: (f.filing_date, f.accession))

    # NEW HOLDINGS addenda filed on or after the base are live (additive)
    live_nh = [f for f in new_holdings if f.filing_date >= base.filing_date]
    # NEW HOLDINGS before the base date are superseded (stale addenda)
    superseded_nh = [f for f in new_holdings if f.filing_date < base.filing_date]

    # Among base_candidates, only the chosen base is live; the rest are superseded
    superseded_bases = [f for f in base_candidates if f.accession != base.accession]

    live = [base] + live_nh
    superseded_accessions = [f.accession for f in superseded_bases + superseded_nh]

    return live, superseded_accessions
