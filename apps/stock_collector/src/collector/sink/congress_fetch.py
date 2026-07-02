"""IO boundary: fetch United States Congress legislator YAML from GitHub.

Purpose: download current + historical legislators YAML from the
unitedstates/congress-legislators dataset (CC0 public domain) and return a
combined list of raw dicts. Both files are ALWAYS fetched because many active
kadoa filers may have already left office and appear only in the historical file.

Endpoints:
  * _CURRENT_URL  — legislators-current.yaml  (~1 MB)
  * _HISTORICAL_URL — legislators-historical.yaml (~9 MB)

Invariants:
  * Returns current + historical concatenated (no dedup — build_legislator_index
    deduplicates by bioguide_id).
  * Exponential backoff on 429 / 5xx (max 3 attempts, 2-second base).
  * Raises requests.HTTPError on final non-retryable failure.
  * YAML is parsed with yaml.safe_load (no arbitrary code execution).

Side effects: network (raw.githubusercontent.com).
"""

from __future__ import annotations

import time

import requests
import yaml

_BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main"
_CURRENT_URL = f"{_BASE}/legislators-current.yaml"
_HISTORICAL_URL = f"{_BASE}/legislators-historical.yaml"

_USER_AGENT = "tradelunch-collector admin@prettylog.com"
_TIMEOUT = 60  # seconds — historical YAML is ~9 MB
_MAX_RETRIES = 3
_BACKOFF_BASE = 2.0


def _get_with_backoff(url: str, session: requests.Session) -> bytes:
    """GET url with exponential backoff on transient errors. Returns raw bytes."""
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            resp = session.get(url, timeout=_TIMEOUT)
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < _MAX_RETRIES - 1:
                time.sleep(_BACKOFF_BASE**attempt)
                continue
            resp.raise_for_status()
            return resp.content
        except requests.exceptions.ConnectionError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_BACKOFF_BASE**attempt)
    if last_exc is not None:
        raise last_exc
    raise RuntimeError(f"fetch failed for {url} after {_MAX_RETRIES} retries")


def fetch_legislators() -> list[dict]:
    """Download current + historical legislators YAML; return combined list of raw dicts.

    The combined list may contain the same bioguide_id in both files (a legislator
    who was historical and then returned). Callers should deduplicate as needed.
    """
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept-Encoding": "gzip, deflate",
        }
    )

    current_bytes = _get_with_backoff(_CURRENT_URL, session)
    historical_bytes = _get_with_backoff(_HISTORICAL_URL, session)

    current: list[dict] = yaml.safe_load(current_bytes) or []
    historical: list[dict] = yaml.safe_load(historical_bytes) or []

    return current + historical
