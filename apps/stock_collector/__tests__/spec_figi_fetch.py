"""Tests for figi_fetch — batching + index alignment, HTTP boundary mocked."""

from collector.sink import figi_fetch
from collector.transform.cusip_resolve import parse_figi_mapping


def test_batch_size_for_key():
    assert figi_fetch.batch_size_for_key(None) == 10
    assert figi_fetch.batch_size_for_key("KEY123") == 100


def test_fetch_mapping_chunks_and_preserves_order(monkeypatch):
    calls: list[list[dict]] = []

    def fake_post(jobs, api_key):
        calls.append(jobs)
        # echo one result per job so alignment is checkable
        return [{"data": [{"ticker": j["idValue"][:4]}]} for j in jobs]

    monkeypatch.setattr(figi_fetch, "_post_batch", fake_post)
    cusips = ["AAAAA0001", "BBBBB0002", "CCCCC0003"]
    sent, results = figi_fetch.fetch_mapping(cusips, batch_size=2)

    assert sent == cusips
    assert len(results) == 3
    assert len(calls) == 2  # 3 cusips, batch_size 2 -> two batches
    # results stay aligned so parse can zip them back to the cusips
    rows = parse_figi_mapping(sent, results)
    assert [r.cusip for r in rows] == cusips


def test_fetch_mapping_dedupes_before_sending(monkeypatch):
    def fake_post(jobs, api_key):
        return [{"data": []} for _ in jobs]

    monkeypatch.setattr(figi_fetch, "_post_batch", fake_post)
    sent, results = figi_fetch.fetch_mapping(["037833100", "037833100", "594918104"])
    assert sent == ["037833100", "594918104"]
    assert len(results) == 2


def test_headers_include_key_only_when_present():
    assert "X-OPENFIGI-APIKEY" not in figi_fetch._headers(None)
    assert figi_fetch._headers("K")["X-OPENFIGI-APIKEY"] == "K"
