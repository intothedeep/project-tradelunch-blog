"""Load + validate the funds list YAML into FundEntry list.

Purpose: parse configs/funds.yaml into typed FundEntry objects, enforcing
SEC CIK format and uniqueness invariants.

Invariants:
  * Each entry must have cik (digits only, ≤10 chars after strip) and label.
  * cik is left-padded to exactly 10 chars with zeros (SEC-native format).
  * Duplicate cik or duplicate label raises ValueError.

Side effects: reads the YAML file only (the only I/O here). Parsing and
validation logic is otherwise pure.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from collector.schema.rows import FundEntry

# APP_ROOT = apps/stock_collector/ (this file: src/collector/config/funds_loader.py)
_APP_ROOT = Path(__file__).resolve().parents[3]
FUNDS_PATH = Path(os.getenv("FUNDS_PATH", str(_APP_ROOT / "configs" / "funds.yaml")))


def parse_funds(data: Any) -> list[FundEntry]:
    """Pure: validate a parsed YAML mapping -> FundEntry list.

    Expects data to be a dict with a 'funds' key containing a list of
    {cik, label} mappings. Raises ValueError on any contract breach.
    """
    if not isinstance(data, dict) or "funds" not in data:
        raise ValueError("funds YAML must be a mapping with a 'funds' key")

    items = data["funds"] or []
    entries: list[FundEntry] = []
    seen_ciks: set[str] = set()
    seen_labels: set[str] = set()

    for item in items:
        raw_cik = item.get("cik")
        label = item.get("label")

        if raw_cik is None or label is None:
            raise ValueError(f"fund entry missing cik or label: {item!r}")

        # Normalize: strip whitespace, coerce to string
        cik_str = str(raw_cik).strip()
        label_str = str(label).strip()

        if not cik_str or not label_str:
            raise ValueError(f"fund entry has empty cik or label: {item!r}")

        # CIK must be all digits
        if not cik_str.isdigit():
            raise ValueError(
                f"cik must contain digits only, got {cik_str!r} in entry {item!r}"
            )

        # CIK must not exceed 10 digits
        if len(cik_str) > 10:
            raise ValueError(
                f"cik is longer than 10 digits: {cik_str!r} in entry {item!r}"
            )

        # Left-pad to 10 chars
        padded_cik = cik_str.zfill(10)

        # Duplicate checks
        if padded_cik in seen_ciks:
            raise ValueError(f"duplicate cik {padded_cik!r} in funds YAML")
        if label_str in seen_labels:
            raise ValueError(f"duplicate label {label_str!r} in funds YAML")

        seen_ciks.add(padded_cik)
        seen_labels.add(label_str)
        entries.append(FundEntry(cik=padded_cik, label=label_str))

    return entries


def load_funds(path: Path = FUNDS_PATH) -> list[FundEntry]:
    """Read + validate the funds YAML file."""
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return parse_funds(data)
