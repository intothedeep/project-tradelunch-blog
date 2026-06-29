"""Pure: symbol <-> exchange resolution + label-uniqueness indexing.

Invariants:
  * ``resolve_exchange`` maps a KRX equity ticker (``.KS`` / ``.KQ`` suffix) to
    'KRX', everything else to 'US'. (Phase 1 has no KRX equities -> always 'US';
    KRX spot indices live in the ``indices`` category and carry no exchange.)
  * ``index_by_label`` guarantees globally-unique labels (history is keyed by
    label only) — a collision raises ``LabelCollisionError``.
Side effects: none.
"""

from __future__ import annotations

from collections.abc import Iterable

from collector.schema.rows import WatchlistEntry

KRX_SUFFIXES = (".KS", ".KQ")


class LabelCollisionError(ValueError):
    """Two watchlist entries share a label (would corrupt label-keyed history)."""


def resolve_exchange(symbol: str) -> str:
    """'KRX' for a ``.KS``/``.KQ`` equity ticker, else 'US'."""
    return "KRX" if symbol.upper().endswith(KRX_SUFFIXES) else "US"


def index_by_label(entries: Iterable[WatchlistEntry]) -> dict[str, WatchlistEntry]:
    """Build a label -> entry map, raising on any duplicate label."""
    out: dict[str, WatchlistEntry] = {}
    for e in entries:
        if e.label in out:
            raise LabelCollisionError(
                f"duplicate label {e.label!r}: {out[e.label].symbol} vs {e.symbol}"
            )
        out[e.label] = e
    return out
