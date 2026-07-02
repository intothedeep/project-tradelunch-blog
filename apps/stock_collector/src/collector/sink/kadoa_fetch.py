"""IO boundary: fetch kadoa congressional-trade JSON over HTTP.

Purpose: single GET of the kadoa trades.json file from GitHub raw content.
No API key required. ETag/If-None-Match supported optionally (caller can
pass last_etag; returns (records, new_etag) tuple).

Invariants:
  * Returns list[dict] — one dict per trade record.
  * 304 Not Modified: returns ([], last_etag) — caller skips upsert.
  * Raises requests.HTTPError on any non-2xx, non-304 response.
  * Exponential backoff via request_with_backoff (max 3 attempts).

Side effects: network (raw.githubusercontent.com).
"""

from __future__ import annotations

import time

import requests

_KADOA_TRADES_URL = (
    "https://raw.githubusercontent.com/kadoa-org/"
    "congress-trading-monitor/main/public/data/trades.json"
)

_USER_AGENT = "tradelunch-collector admin@prettylog.com"
_TIMEOUT = 30
_MAX_RETRIES = 3
_BACKOFF_BASE = 2.0  # seconds


def _request_with_backoff(fn, *, max_retries: int = _MAX_RETRIES) -> requests.Response:
    """Retry fn() with exponential backoff on 429/5xx. Raises on final failure."""
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            resp = fn()
            # Retry on transient server errors and rate-limit
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < max_retries - 1:
                wait = _BACKOFF_BASE ** attempt
                time.sleep(wait)
                continue
            return resp
        except requests.exceptions.ConnectionError as exc:
            last_exc = exc
            if attempt < max_retries - 1:
                time.sleep(_BACKOFF_BASE ** attempt)
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("fetch failed after retries")


# Module-level session for TCP connection reuse.
_session = requests.Session()
_session.headers.update(
    {
        "User-Agent": _USER_AGENT,
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
    }
)


def fetch_trades(
    url: str = _KADOA_TRADES_URL,
    *,
    last_etag: str | None = None,
) -> tuple[list[dict], str | None]:
    """GET kadoa trades JSON; return (records, etag).

    Args:
        url: override for testing.
        last_etag: ETag from a prior successful response; enables 304 short-circuit.

    Returns:
        (records, etag) — records is [] on 304; etag is the new value or last_etag.

    Raises:
        requests.HTTPError: on non-2xx, non-304 response after retries.
    """
    headers: dict[str, str] = {}
    if last_etag:
        headers["If-None-Match"] = last_etag

    resp = _request_with_backoff(
        lambda: _session.get(url, timeout=_TIMEOUT, headers=headers)
    )

    if resp.status_code == 304:
        return [], last_etag

    resp.raise_for_status()
    new_etag = resp.headers.get("ETag") or last_etag
    return resp.json(), new_etag
