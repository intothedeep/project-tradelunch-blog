from collector.ranking.universe import assemble, normalize_symbol


def test_normalize_dot_to_dash():
    assert normalize_symbol("BRK.B") == "BRK-B"
    assert normalize_symbol(" brk.b ") == "BRK-B"


def test_assemble_dedupes_and_sorts():
    out = assemble(["AAPL", "MSFT"], ["MSFT", "NVDA"])
    assert out == ["AAPL", "MSFT", "NVDA"]


def test_assemble_keeps_both_dot_and_dash_forms():
    out = assemble(["BRK.B"])
    assert "BRK.B" in out and "BRK-B" in out


def test_assemble_skips_blanks():
    out = assemble(["", "  ", "AAPL"])
    assert out == ["AAPL"]
