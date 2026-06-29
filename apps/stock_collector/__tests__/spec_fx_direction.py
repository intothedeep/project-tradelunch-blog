import pytest

from collector.transform.fx_direction import fx_label


def test_six_letter_pair_keeps_source_native_direction():
    assert fx_label("EURUSD=X") == "EUR/USD"


def test_three_letter_short_form_implies_usd_base():
    assert fx_label("KRW=X") == "USD/KRW"
    assert fx_label("JPY=X") == "USD/JPY"
    assert fx_label("THB=X") == "USD/THB"


def test_lowercase_symbol_is_normalized():
    assert fx_label("eurusd=x") == "EUR/USD"


@pytest.mark.parametrize("bad", ["EURUSD", "BTC-USD", "12AB=X", "ABCD=X"])
def test_non_fx_or_unparseable_raises(bad):
    with pytest.raises(ValueError):
        fx_label(bad)
