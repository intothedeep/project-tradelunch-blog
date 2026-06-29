"""Pure: DAILY collection universe = watchlist.yaml UNION tracked_symbols(active).

``resolve_universe`` merges the static yaml entries with the dynamic
(Phase-2) tracked-symbol rows, de-duplicating by SYMBOL. The yaml WINS on
label/category/exchange (it is the curated source); a tracked-only symbol is
included with its own metadata so sticky-universe additions keep being
collected even when they are not in the yaml.

Invariants: deterministic; no side effects; order = yaml entries first (input
order), then tracked-only symbols (input order).
"""

from __future__ import annotations

from collections.abc import Iterable

from collector.schema.rows import TrackedSymbol, WatchlistEntry


def resolve_universe(
    yaml_entries: Iterable[WatchlistEntry],
    tracked: Iterable[TrackedSymbol],
) -> list[WatchlistEntry]:
    """Union by symbol; yaml entries take precedence over tracked rows."""
    out: list[WatchlistEntry] = []
    seen: set[str] = set()
    for e in yaml_entries:
        if e.symbol in seen:
            continue
        seen.add(e.symbol)
        out.append(e)
    for t in tracked:
        if t.symbol in seen:
            continue
        seen.add(t.symbol)
        out.append(
            WatchlistEntry(
                symbol=t.symbol,
                label=t.label,
                category=t.category,
                exchange=t.exchange,
            )
        )
    return out
