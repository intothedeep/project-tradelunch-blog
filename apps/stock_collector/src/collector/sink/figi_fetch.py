"""IO boundary: resolve CUSIPs to tickers via the OpenFIGI /v3/mapping API.

Purpose: network-only module for Phase P (STEP 0-b). Batches CUSIP lookups to
``POST https://api.openfigi.com/v3/mapping`` behind the PROVIDER_OPENFIGI rate
limiter + request_with_backoff. Parsing of the response into rows lives in the
pure ``transform/cusip_resolve`` module; this file only does HTTP.

Invariants:
  * The response array is INDEX-ALIGNED with the request jobs — fetch_mapping
    preserves input cusip order across batches so parse_figi_mapping can zip them.
  * API key is optional. Keyless is throttled (~25 req/min, 10 jobs/batch); a key
    (X-OPENFIGI-APIKEY header) allows ~250 req/min and 100 jobs/batch. Batch size
    derives from key presence unless overridden. RE-VERIFY limits vs OpenFIGI docs.
  * The HTTP call is isolated in ``_post_batch`` so tests can monkeypatch it
    without a network (mirrors sec_fetch's testing seam).

Side effects: network (OpenFIGI).
"""

from __future__ import annotations

import requests

from collector.config.settings import openfigi_api_key
from collector.transform.cusip_resolve import dedupe_cusips
from lib.constants import OPENFIGI_MAPPING_URL, PROVIDER_OPENFIGI
from lib.rate_limit import for_provider, request_with_backoff

__all__ = ["fetch_mapping", "batch_size_for_key"]

# Module-level session so TCP connections are reused across batches in one run.
# Per-request headers (incl. Content-Type + optional key) come from _headers().
_session = requests.Session()

_BATCH_KEYLESS = 10
_BATCH_KEYED = 100


def batch_size_for_key(api_key: str | None) -> int:
    """Jobs-per-request allowed by OpenFIGI: 100 with a key, 10 without."""
    return _BATCH_KEYED if api_key else _BATCH_KEYLESS


def _headers(api_key: str | None) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-OPENFIGI-APIKEY"] = api_key
    return headers


def _post_batch(jobs: list[dict], api_key: str | None) -> list[dict]:
    """POST one batch of mapping jobs; return the response JSON array.

    HTTP boundary (monkeypatched in tests). Raises on non-2xx status.
    """
    resp = request_with_backoff(
        lambda: _session.post(
            OPENFIGI_MAPPING_URL, json=jobs, headers=_headers(api_key), timeout=30
        ),
        limiter=for_provider(PROVIDER_OPENFIGI),
    )
    resp.raise_for_status()
    data = resp.json()
    if len(data) != len(jobs):
        # OpenFIGI guarantees index-aligned 1:1 results; a length mismatch would
        # silently misalign cusip<->ticker downstream. Fail fast per batch.
        raise ValueError(f"figi batch response {len(data)} != jobs {len(jobs)}")
    return data


def fetch_mapping(cusips, *, batch_size: int | None = None) -> tuple[list[str], list[dict]]:
    """Resolve CUSIPs to raw OpenFIGI job results, index-aligned.

    Args:
        cusips: CUSIPs to look up (de-duplicated internally, order preserved).
        batch_size: jobs per request; defaults to the key-aware max.

    Returns:
        ``(sent_cusips, results)`` where ``results[i]`` is the OpenFIGI job
        result for ``sent_cusips[i]``. Pass BOTH to
        ``cusip_resolve.parse_figi_mapping`` (it zips them).
    """
    api_key = openfigi_api_key()
    size = batch_size or batch_size_for_key(api_key)
    sent = dedupe_cusips(list(cusips))
    results: list[dict] = []
    for start in range(0, len(sent), size):
        chunk = sent[start : start + size]
        jobs = [{"idType": "ID_CUSIP", "idValue": cusip} for cusip in chunk]
        results.extend(_post_batch(jobs, api_key))
    return sent, results
