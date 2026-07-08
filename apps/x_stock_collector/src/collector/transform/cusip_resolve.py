"""Pure transforms for CUSIP -> ticker resolution (Phase P, STEP 0-b).

Purpose: turn an OpenFIGI ``/v3/mapping`` response into resolved security rows
that ``security_map_sink`` can upsert, plus the small pure helpers around it
(ticker normalization, candidate de-duplication). All I/O — the HTTP call and
the DB writes — lives in ``sink/`` (figi_fetch, security_map_sink); this module
is deterministic input -> output with no side effects.

Invariants:
  * normalize_ticker: Bloomberg composite tickers use ``/`` for share classes
    (``BRK/B``); Yahoo/our market_history use ``-`` (``BRK-B``). Uppercased,
    whitespace-stripped. Empty/None -> None.
  * parse_figi_mapping: response is index-aligned with the request jobs, so the
    caller passes the SAME cusip order it sent. Each job's result is either
    ``{"data": [...]}`` (>=1 match -> resolved, first match wins) or a
    ``{"warning"|"error": ...}`` / empty ``data`` (-> unresolved, ticker=None).
    A length mismatch raises ValueError (never silently misaligns cusips).

Side effects: none.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Sequence

__all__ = ["ResolvedSecurity", "normalize_ticker", "dedupe_cusips", "parse_figi_mapping"]


@dataclass(frozen=True)
class ResolvedSecurity:
    """One CUSIP resolution outcome. ticker=None => unresolved (retry candidate)."""

    cusip: str
    ticker: Optional[str]
    name: Optional[str]
    confidence: str  # 'exact' when a ticker was found, 'unresolved' otherwise


def normalize_ticker(raw: Optional[str]) -> Optional[str]:
    """Normalize a Bloomberg-style ticker to Yahoo form.

    ``BRK/B`` -> ``BRK-B``; surrounding whitespace stripped; uppercased. Returns
    None for None/blank so unresolved rows stay NULL rather than empty-string.

    Pure — no I/O.
    """
    if raw is None:
        return None
    cleaned = raw.strip().upper().replace("/", "-")
    return cleaned or None


def dedupe_cusips(cusips: Sequence[str]) -> list[str]:
    """Return cusips with duplicates removed, preserving first-seen order.

    Blank entries are dropped. Pure — no I/O.
    """
    seen: set[str] = set()
    out: list[str] = []
    for cusip in cusips:
        key = (cusip or "").strip()
        if key and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def _first_match(job_result: Any) -> Optional[dict[str, Any]]:
    """Extract the first mapping match from one OpenFIGI job result, or None."""
    if not isinstance(job_result, dict):
        return None
    data = job_result.get("data")
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    return None


def parse_figi_mapping(
    cusips: Sequence[str], response: Sequence[Any]
) -> list[ResolvedSecurity]:
    """Pair a cusip request list with an index-aligned OpenFIGI mapping response.

    Args:
        cusips: the cusips sent, in request order (already de-duplicated).
        response: the parsed JSON array from ``POST /v3/mapping`` — one entry per
            cusip, either ``{"data": [{"ticker","name",...}]}`` or a
            ``{"warning"|"error"}`` object.

    Returns:
        One ResolvedSecurity per cusip. Matched -> ticker normalized,
        confidence='exact'. Unmatched/warning/error -> ticker=None,
        confidence='unresolved'.

    Raises:
        ValueError: when len(response) != len(cusips) (index misalignment would
            attach the wrong ticker to a cusip — fail fast instead).
    """
    if len(response) != len(cusips):
        raise ValueError(
            f"figi response length {len(response)} != request length {len(cusips)}"
        )
    out: list[ResolvedSecurity] = []
    for cusip, job_result in zip(cusips, response):
        match = _first_match(job_result)
        if match is None:
            out.append(ResolvedSecurity(cusip=cusip, ticker=None, name=None, confidence="unresolved"))
            continue
        ticker = normalize_ticker(match.get("ticker"))
        name = match.get("name") or None
        confidence = "exact" if ticker else "unresolved"
        out.append(ResolvedSecurity(cusip=cusip, ticker=ticker, name=name, confidence=confidence))
    return out
