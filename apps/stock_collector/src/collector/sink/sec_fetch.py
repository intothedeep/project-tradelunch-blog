"""IO boundary: fetch SEC EDGAR 13F submissions and info-table data over HTTP.

Purpose: network-only module for Phase J. All SEC EDGAR HTTP calls go through
request_with_backoff + the PROVIDER_SEC13F rate limiter (300 rpm). A module-level
requests.Session carries the required User-Agent and Accept-Encoding headers.

Invariants:
  * cik passed in is ALWAYS the zero-padded 10-char string (from funds_loader).
  * Submissions endpoint (data.sec.gov) uses the padded CIK: CIK{cik}.json.
  * Archives endpoint (www.sec.gov) uses the UNpadded integer CIK — the padded
    form returns a 301 redirect. cik_int() strips leading zeros for that path.
  * accession_nodashes() strips the dashes for the Archives directory URL segment.
  * find_infotable_name() picks the info-table XML from the filing index: the
    filename is non-predictable (43977.xml, form13fInfoTable.xml, etc.); filter
    .xml files that do NOT contain the primary-doc name segment, then pick the
    largest by byte size when multiple candidates exist.
  * submission_page_names() reads the pagination overflow list from a submissions
    dict (filings.files[].name). Returns [] when absent (single-page fund).
  * fetch_submission_page() GETs one overflow page by name using the same session
    + rate limiter as all other SEC calls.
  * fetch_primary_doc() GETs the cover-page XML for a filing (used only for
    13F-HR/A filings to read <amendmentType>).

Side effects: network (SEC EDGAR — 3 GETs per fund per run).
"""

from __future__ import annotations

import requests

from collector.config.settings import sec_user_agent
from lib.constants import PROVIDER_SEC13F, SEC_DATA_BASE, SEC_EDGAR_BASE
from lib.rate_limit import for_provider, request_with_backoff

# Module-level session so TCP connections are reused across calls in one run.
_session = requests.Session()
_session.headers.update(
    {
        "User-Agent": sec_user_agent(),
        "Accept-Encoding": "gzip, deflate",
    }
)


def fetch_submissions(cik: str) -> dict:
    """GET submissions JSON for a CIK (zero-padded 10-char).

    Endpoint: {SEC_DATA_BASE}/submissions/CIK{cik}.json
    Raises on non-2xx status (raise_for_status).
    """
    url = f"{SEC_DATA_BASE}/submissions/CIK{cik}.json"
    resp = request_with_backoff(
        lambda: _session.get(url, timeout=30),
        limiter=for_provider(PROVIDER_SEC13F),
    )
    resp.raise_for_status()
    return resp.json()


def accession_nodashes(accession: str) -> str:
    """Strip dashes from accession number for use in Archives URL paths.

    e.g. '0001067983-23-000070' -> '0001067983230000070'
    """
    return accession.replace("-", "")


def cik_int(cik: str) -> str:
    """Strip leading zeros from a padded CIK for use in Archives URL paths.

    The padded form (0001067983) causes a 301 redirect; the Archives endpoint
    requires the integer form (1067983).
    e.g. '0001067983' -> '1067983', '0000093751' -> '93751'
    """
    return str(int(cik))


def fetch_accession_index(cik: str, accession: str) -> dict:
    """GET the filing index JSON for a (cik, accession) pair.

    Endpoint: {SEC_EDGAR_BASE}/Archives/edgar/data/{cik_int}/{accession_nodashes}/index.json
    Raises on non-2xx status.
    """
    url = (
        f"{SEC_EDGAR_BASE}/Archives/edgar/data"
        f"/{cik_int(cik)}/{accession_nodashes(accession)}/index.json"
    )
    resp = request_with_backoff(
        lambda: _session.get(url, timeout=30),
        limiter=for_provider(PROVIDER_SEC13F),
    )
    resp.raise_for_status()
    return resp.json()


def find_infotable_name(index_json: dict) -> str | None:
    """Pick the info-table XML filename from a filing index JSON.

    Strategy:
      1. Read index_json["directory"]["item"] — each item has {name, size, type}.
      2. Filter: name ends with '.xml' AND name does NOT contain 'primary_doc'
         (case-insensitive) AND name is not the primary document.
      3. If multiple candidates remain, pick the one with the largest int(size).
      4. Return the filename, or None if no candidate found.

    The info-table filename is non-predictable across filers and filing years
    (e.g. '43977.xml', 'form13fInfoTable.xml', 'infotable.xml').
    """
    items: list[dict] = index_json.get("directory", {}).get("item", [])
    candidates = [
        item
        for item in items
        if isinstance(item.get("name"), str)
        and item["name"].lower().endswith(".xml")
        and "primary_doc" not in item["name"].lower()
    ]
    if not candidates:
        return None
    # Pick largest by size (string int comparison unsafe for large files; cast)
    best = max(candidates, key=lambda i: int(i.get("size", 0) or 0))
    return best["name"]


def fetch_infotable(cik: str, accession: str, name: str) -> bytes:
    """GET the raw info-table XML bytes for a (cik, accession, name) triple.

    Endpoint: {SEC_EDGAR_BASE}/Archives/edgar/data/{cik_int}/{accession_nodashes}/{name}
    Returns raw bytes (parse_infotable expects bytes). Raises on non-2xx status.
    """
    url = (
        f"{SEC_EDGAR_BASE}/Archives/edgar/data"
        f"/{cik_int(cik)}/{accession_nodashes(accession)}/{name}"
    )
    resp = request_with_backoff(
        lambda: _session.get(url, timeout=30),
        limiter=for_provider(PROVIDER_SEC13F),
    )
    resp.raise_for_status()
    return resp.content


def fetch_primary_doc(cik: str, accession: str, primary_document_name: str) -> bytes:
    """GET the cover-page XML bytes for a 13F-HR/A filing.

    Used ONLY for amendment filings to read <amendmentType> via
    parse_amendment_type(). Originals (13F-HR) do not carry <amendmentType>.

    Endpoint: {SEC_EDGAR_BASE}/Archives/edgar/data/{cik_int}/{accession_nodashes}/primary_doc.xml
    Same session + PROVIDER_SEC13F rate limiter as all other SEC calls.
    Returns raw bytes. Raises on non-2xx status.

    NOTE: submissions `primaryDocument` is the XSL-RENDERED path
    (e.g. `xslForm13F_X02/primary_doc.xml`) — that URL returns styled HTML, not
    parseable XML. We strip the `xslForm13F_X0N/` prefix and fetch the RAW cover
    page at the accession root, which carries the <amendmentType> element.
    Fetching the xsl path returns HTML -> ET.fromstring fails -> amendment_type
    None -> the amendment wrongly supersedes the original (Berkshire NEW HOLDINGS bug).
    """
    doc_name = primary_document_name.rsplit("/", 1)[-1]  # strip xslForm13F_X0N/ -> raw XML
    url = (
        f"{SEC_EDGAR_BASE}/Archives/edgar/data"
        f"/{cik_int(cik)}/{accession_nodashes(accession)}/{doc_name}"
    )
    resp = request_with_backoff(
        lambda: _session.get(url, timeout=30),
        limiter=for_provider(PROVIDER_SEC13F),
    )
    resp.raise_for_status()
    return resp.content


def submission_page_names(subs: dict) -> list[str]:
    """Return the list of overflow submission page filenames for a CIK.

    SEC paginates older filings into separate JSON pages listed under
    ``filings.files[].name``. When absent (single-page fund), returns [].
    The caller fetches each page via ``fetch_submission_page`` and merges
    them with ``merge_submission_pages`` before calling ``parse_submissions``.
    """
    files: list[dict] = subs.get("filings", {}).get("files", [])
    return [item["name"] for item in files if isinstance(item.get("name"), str)]


def fetch_submission_page(name: str) -> dict:
    """GET one paginated submission overflow page by filename.

    Endpoint: {SEC_DATA_BASE}/submissions/{name}
    Uses the same module-level session + PROVIDER_SEC13F rate limiter as all
    other SEC EDGAR calls. Raises on non-2xx status.
    """
    url = f"{SEC_DATA_BASE}/submissions/{name}"
    resp = request_with_backoff(
        lambda: _session.get(url, timeout=30),
        limiter=for_provider(PROVIDER_SEC13F),
    )
    resp.raise_for_status()
    return resp.json()
