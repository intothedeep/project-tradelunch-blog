"""Load + validate the category-keyed watchlist YAML into WatchlistEntry list.

Validation (raises ``WatchlistError`` on any breach):
  * category is one of the 5-set;
  * every label is globally unique (history is keyed by label only);
  * stocks entries carry a valid exchange ('US'|'KRX'); non-stocks carry none.

Side effects: reads the YAML file (the only I/O here). Parsing/validation logic
is otherwise pure.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from collector.config.settings import WATCHLIST_PATH
from collector.schema.rows import (
    VALID_CATEGORIES,
    VALID_EXCHANGES,
    WatchlistEntry,
)
from collector.transform.fx_direction import fx_label
from collector.transform.mapping import index_by_label


class WatchlistError(ValueError):
    """The watchlist YAML is malformed or violates a contract invariant."""


def parse_watchlist(data: dict[str, Any]) -> list[WatchlistEntry]:
    """Pure: validate a parsed YAML mapping -> WatchlistEntry list."""
    entries: list[WatchlistEntry] = []
    for category, items in (data or {}).items():
        if category not in VALID_CATEGORIES:
            raise WatchlistError(f"invalid category {category!r} (not in {VALID_CATEGORIES})")
        for item in items or []:
            symbol = str(item.get("symbol", "")).strip()
            label = str(item.get("label", "")).strip()
            if not symbol or not label:
                raise WatchlistError(f"entry missing symbol/label in {category!r}: {item!r}")
            exchange = item.get("exchange")
            if category == "stocks":
                if exchange not in VALID_EXCHANGES:
                    raise WatchlistError(
                        f"stocks entry {symbol!r} needs exchange in {VALID_EXCHANGES}, got {exchange!r}"
                    )
            elif exchange is not None:
                raise WatchlistError(f"non-stocks entry {symbol!r} must not set exchange")
            if category == "fx":
                try:
                    expected = fx_label(symbol)
                except ValueError as exc:
                    raise WatchlistError(f"invalid fx symbol {symbol!r}: {exc}") from exc
                if label != expected:
                    raise WatchlistError(
                        f"fx label {label!r} is not source-native; expected {expected!r} for {symbol!r}"
                    )
            entries.append(
                WatchlistEntry(symbol=symbol, label=label, category=category, exchange=exchange)
            )
    index_by_label(entries)  # raises LabelCollisionError on duplicate label
    return entries


def load_watchlist(path: Path = WATCHLIST_PATH) -> list[WatchlistEntry]:
    """Read + validate the watchlist YAML file."""
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return parse_watchlist(data)
