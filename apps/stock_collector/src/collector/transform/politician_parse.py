"""Pure transform: parse kadoa congressional-trade JSON records into typed rows.

Purpose: map raw kadoa dict records -> (PoliticianTradeRow list, PoliticianRow list).
No I/O, no network, no DB. stdlib-only + schema imports.

Invariants:
  * disclosure_date (filing_date) is NOT NULL — records without it are skipped.
  * filer_id is NOT NULL — records without it are skipped (prevents FK violation
    against politician_registry when the upsert batch runs).
  * transaction_type must resolve to a known normalized value; unknown/None values
    map to 'exchange' (conservative: unknown transactions are neither buy nor sell).
  * Ticker normalisation: uppercase, strip whitespace, dots → dashes (BRK.B→BRK-B);
    empty/None → None.
  * value_estimate = round(sqrt(value_min * value_max)); None when either bound is None.
  * Registry dedup: one PoliticianRow per distinct filer_id (first-seen wins metadata).
  * asset_type defaults to 'other' for any unrecognized code.
  * parse_filers: maps filers.json records to PoliticianRow with aggregates carried;
    est_volume (float in JSON) is rounded to int to match BIGINT DB column.

Side effects: none.
"""

from __future__ import annotations

import math
from datetime import date
from typing import Optional

from collector.schema.rows import PoliticianRow, PoliticianTradeRow

# ---------------------------------------------------------------------------
# Mapping tables (source-representation-first)
# ---------------------------------------------------------------------------

# transaction_type normalization
_TRANSACTION_TYPE_MAP: dict[str, str] = {
    "Purchase": "buy",
    "Sale (Full)": "sell",
    "Sale (Partial)": "sell",
    "Exchange": "exchange",
}

# owner normalization
_OWNER_MAP: dict[str, str] = {
    "Self": "self",
    "SP": "spouse",
    "Spouse": "spouse",
    "JT": "joint",
    "Joint": "joint",
    "Child": "dependent",
    "DC": "dependent",
}

# asset_type normalization
_EQUITY_CODES = {"CS", "PS", "ST", "Stock", "Non-Public Stock"}
_BOND_CODES = {"GS", "Corporate Bond", "Municipal Security"}
_OPTION_CODES = {"OP", "OL"}


def _normalize_transaction_type(raw: Optional[str]) -> str:
    """Map kadoa transaction_type string to 'buy'|'sell'|'exchange'.

    Falls back to 'exchange' for unrecognized values (conservative: unknown
    transactions are neither buy nor sell).
    """
    if raw is None:
        return "exchange"
    return _TRANSACTION_TYPE_MAP.get(raw, "exchange")


def _normalize_owner(raw: Optional[str]) -> Optional[str]:
    """Map kadoa owner string to 'self'|'spouse'|'joint'|'dependent' or None."""
    if raw is None:
        return None
    return _OWNER_MAP.get(raw)


def _normalize_asset_type(raw: Optional[str]) -> str:
    """Map kadoa asset_type code to 'equity'|'bond'|'option'|'other'."""
    if raw is None:
        return "other"
    if raw in _EQUITY_CODES:
        return "equity"
    if raw in _BOND_CODES:
        return "bond"
    if raw in _OPTION_CODES:
        return "option"
    return "other"


def _normalize_ticker(raw: Optional[str]) -> Optional[str]:
    """Normalize ticker: uppercase, strip, dots→dashes; empty/None→None."""
    if not raw:
        return None
    t = raw.strip().upper().replace(".", "-")
    return t if t else None


def _parse_date(raw: Optional[str]) -> Optional[date]:
    """Parse ISO date string 'YYYY-MM-DD' to date; None on missing/invalid."""
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _geometric_mean(low: Optional[int | float], high: Optional[int | float]) -> Optional[int]:
    """Geometric mean of two bounds; None when either is None or non-positive."""
    if low is None or high is None:
        return None
    try:
        lf, hf = float(low), float(high)
    except (TypeError, ValueError):
        return None
    if lf <= 0 or hf <= 0:
        return None
    return round(math.sqrt(lf * hf))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_trades(
    records: list[dict],
) -> tuple[list[PoliticianTradeRow], list[PoliticianRow]]:
    """Parse kadoa JSON records into trade rows + deduplicated registry rows.

    Args:
        records: list of raw kadoa dicts (one dict = one trade with filer meta).

    Returns:
        (trade_rows, registry_rows) where registry_rows has one entry per
        distinct filer_id (first-seen metadata wins on collision within a batch).

    Records that are missing ``id``, ``filing_date`` (the NOT-NULL disclosure
    date), or ``filer_id`` (FK into politician_registry) are skipped; all other
    missing fields map to their defaults.
    """
    trade_rows: list[PoliticianTradeRow] = []
    seen_filers: dict[str, PoliticianRow] = {}

    for rec in records:
        external_id = rec.get("id")
        filing_date_raw = rec.get("filing_date")

        # Skip rows that cannot satisfy NOT NULL constraints.
        if not external_id or not filing_date_raw:
            continue

        disclosure_date = _parse_date(filing_date_raw)
        if disclosure_date is None:
            continue

        # Skip rows with no filer_id — they would produce a politician_trades
        # row with no matching politician_registry row and abort the FK batch.
        filer_id = rec.get("filer_id") or ""
        if not filer_id:
            continue

        transaction_type_raw = rec.get("transaction_type")
        owner_raw = rec.get("owner")
        asset_type_raw = rec.get("asset_type")
        value_min_raw = rec.get("amount_range_low")
        value_max_raw = rec.get("amount_range_high")

        trade = PoliticianTradeRow(
            external_id=external_id,
            filer_id=filer_id,
            disclosure_date=disclosure_date,
            transaction_date=_parse_date(rec.get("transaction_date")),
            transaction_type=_normalize_transaction_type(transaction_type_raw),
            transaction_type_raw=transaction_type_raw,
            filer_owner=_normalize_owner(owner_raw),
            owner_raw=owner_raw,
            asset_type=_normalize_asset_type(asset_type_raw),
            asset_type_raw=asset_type_raw,
            ticker=_normalize_ticker(rec.get("ticker")),
            asset_name=rec.get("asset_name"),
            value_min=int(value_min_raw) if value_min_raw is not None else None,
            value_max=int(value_max_raw) if value_max_raw is not None else None,
            value_estimate=_geometric_mean(value_min_raw, value_max_raw),
            value_label=rec.get("amount_range_label"),
            doc_url=rec.get("doc_url"),
            source_id=rec.get("source_id"),
            filing_type=rec.get("filing_type"),
            days_to_file=rec.get("days_to_file"),
            is_late=bool(rec.get("is_late")) if rec.get("is_late") is not None else None,
        )
        trade_rows.append(trade)

        # Registry: first-seen filer_id wins within this batch.
        if filer_id not in seen_filers:
            seen_filers[filer_id] = PoliticianRow(
                filer_id=filer_id,
                filer_name=rec.get("filer_name") or "",
                party=rec.get("party"),
                chamber=rec.get("chamber"),
                branch=rec.get("branch"),
                state=rec.get("state"),
                office=rec.get("office"),
                agency=rec.get("agency"),
                bioguide_id=None,
                source="kadoa",
            )

    registry_rows = list(seen_filers.values())
    return trade_rows, registry_rows


def parse_filers(records: list[dict]) -> list[PoliticianRow]:
    """Parse kadoa filers.json records into enriched PoliticianRow list.

    Maps filers.json shape (id, full_name, branch, chamber, party, state,
    agency, office, photo_url, trade_count, purchases, sales, late_filings,
    est_volume) to PoliticianRow with all aggregate fields populated.

    ``est_volume`` is a float in the source JSON (fractional dollars); it is
    rounded to int to match the BIGINT DB column.

    Records without ``id`` are skipped. No I/O.
    """
    rows: list[PoliticianRow] = []
    for rec in records:
        filer_id = rec.get("id")
        if not filer_id:
            continue
        est_volume_raw = rec.get("est_volume")
        est_volume = int(round(est_volume_raw)) if est_volume_raw is not None else None
        rows.append(
            PoliticianRow(
                filer_id=filer_id,
                filer_name=rec.get("full_name") or "",
                party=rec.get("party"),
                chamber=rec.get("chamber"),
                branch=rec.get("branch"),
                state=rec.get("state"),
                office=rec.get("office"),
                agency=rec.get("agency"),
                bioguide_id=None,
                source="kadoa",
                photo_url=rec.get("photo_url"),
                trade_count=rec.get("trade_count"),
                purchases=rec.get("purchases"),
                sales=rec.get("sales"),
                late_filings=rec.get("late_filings"),
                est_volume=est_volume,
            )
        )
    return rows
