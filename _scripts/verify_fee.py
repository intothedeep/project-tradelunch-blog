"""Verify broker_fee Option B implementation (R2.9).

Assertions:
  A1  schema columns present in events_trades, orders, snapshot_position
  A2  buy: events_trades.broker_fee == price * qty * 0.002 (4 dp)
  A3  buy: events_trades.broker_fee_ratio == 0.002
  A4  buy: orders.total_fee == events_trades.broker_fee
  A5  buy: snapshot_position.total_fee_buy == events_trades.broker_fee
  A6  buy: snapshot_position.total_fee_sell == 0
  A7  buy: snapshot_position.avg_price == price (RAW — no fee)
  A8  buy: accounts.balance_cash decreased by (cost + broker_fee)
  A9  sell: events_trades.broker_fee == sell_price * qty * 0.002
  A10 sell: snapshot_position.total_fee_sell == sell-side broker_fee
  A11 sell: snapshot_position.total_fee_buy unchanged from buy
  A12 sell: accounts.balance_cash increased by (sell_cost - broker_fee)
"""

import sys
import time
from decimal import Decimal

sys.path.insert(0, "/Users/tio/Documents/00_projects/weatherbot/src")

from weatherbot_db.config import CLICKHOUSE_DATABASE
from weatherbot_db.client import get_client
from weatherbot_live.writer_infra import make_decision_id, _now_utc
from weatherbot_live.writer import submit_order, receive_trade
from weatherbot_live.readers import read_open_positions, read_account_state
from weatherbot.brokers.paper.broker import PAPER_FEE_RATIO, PaperBroker

c = get_client()

# ---------------------------------------------------------------------------
# 0. Discover account_id
# ---------------------------------------------------------------------------
r = c.query(
    f"SELECT account_id, balance_start FROM {CLICKHOUSE_DATABASE}.accounts FINAL "
    f"WHERE account_name = 'canonical-001' LIMIT 1"
)
assert r.result_rows, "No account 'canonical-001' found — run register first"
ACCOUNT_ID = int(r.result_rows[0][0])
balance_start = Decimal(str(r.result_rows[0][1]))
print(f"     account_id={ACCOUNT_ID} balance_start={balance_start}")

# ---------------------------------------------------------------------------
# A1: Schema columns present
# ---------------------------------------------------------------------------
def _columns(table: str) -> set[str]:
    r = c.query(
        f"SELECT name FROM system.columns "
        f"WHERE database=%(db)s AND table=%(t)s",
        parameters={"db": CLICKHOUSE_DATABASE, "t": table},
    )
    return {row[0] for row in r.result_rows}

for tbl, cols in [
    ("events_trades", ["broker_fee", "broker_fee_ratio"]),
    ("orders", ["total_fee"]),
    ("snapshot_position", ["total_fee_buy", "total_fee_sell"]),
]:
    for col in cols:
        assert col in _columns(tbl), f"A1-fail: {tbl}.{col} missing"
print("A1 PASS  schema columns present")

# Also verify old 'fee' column is gone from events_trades
assert "fee" not in _columns("events_trades"), "A1-fail: events_trades still has old 'fee' column"
print("     events_trades.fee column correctly removed")

# ---------------------------------------------------------------------------
# 1. Build test data
# ---------------------------------------------------------------------------
market_id = "test-fee-r29-market-001"
buy_price = Decimal("0.45")
buy_qty = Decimal("10")
buy_cost = buy_price * buy_qty  # 4.50

decision_ts = _now_utc()
buy_decision_id = make_decision_id(market_id, "buy", decision_ts)

# Seed account balance for test (use balance_start as starting cash)
# We insert a synthetic "starting" balance into accounts — just read current cash
acct_before_buy = read_account_state(c, ACCOUNT_ID)
cash_before_buy = acct_before_buy["balance_cash"] if acct_before_buy else balance_start
print(f"     cash_before_buy={cash_before_buy}")

buy_dict = {
    "decision_id": buy_decision_id,
    "order_id": buy_decision_id,
    "market_id": market_id,
    "city": "test-city-fee",
    "bucket_low": Decimal("70"),
    "bucket_high": Decimal("75"),
    "decided_at": decision_ts.isoformat(),
    "action": "buy",
    "price": buy_price,
    "cnt": buy_qty,
    "cost": buy_cost,
    "date": "2026-06-01",
    "resolution_date": "2026-06-01",
    "stop_loss_curr": Decimal("0.20"),
    "stop_loss_total": Decimal("0.05"),
    "open_ts": decision_ts.isoformat(),
    "position_id": buy_decision_id,
    "budget": cash_before_buy - buy_cost,  # cash after buy (before fee deduction)
    "balance_start": balance_start,
}

# ---------------------------------------------------------------------------
# 2. Execute buy via PaperBroker
# ---------------------------------------------------------------------------
broker = PaperBroker(c, {})
try:
    oid = broker.submit(ACCOUNT_ID, buy_dict)
    broker.receive(ACCOUNT_ID, oid, buy_dict)
    print("     PaperBroker buy OK")
except Exception as exc:
    print(f"FAIL PaperBroker buy: {exc}")
    sys.exit(1)

time.sleep(0.5)

# ---------------------------------------------------------------------------
# A2–A8: Assert buy-side fee
# ---------------------------------------------------------------------------
expected_buy_fee = (buy_price * buy_qty * PAPER_FEE_RATIO).quantize(Decimal("0.0001"))
print(f"     expected_buy_fee={expected_buy_fee}")

# A2: events_trades.broker_fee
r = c.query(
    f"SELECT broker_fee, broker_fee_ratio FROM {CLICKHOUSE_DATABASE}.events_trades "
    f"WHERE account_id=%(a)s AND market_id=%(m)s AND action='buy' LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A2-fail: no events_trades buy row found"
et_buy_fee = Decimal(str(r.result_rows[0][0]))
et_buy_fee_ratio = Decimal(str(r.result_rows[0][1]))
assert et_buy_fee == expected_buy_fee, f"A2-fail: broker_fee={et_buy_fee} expected={expected_buy_fee}"
print(f"A2 PASS  events_trades.broker_fee={et_buy_fee} correct")

# A3: events_trades.broker_fee_ratio
assert et_buy_fee_ratio == PAPER_FEE_RATIO, f"A3-fail: broker_fee_ratio={et_buy_fee_ratio}"
print(f"A3 PASS  events_trades.broker_fee_ratio={et_buy_fee_ratio} correct")

# A4: orders.total_fee
r = c.query(
    f"SELECT total_fee FROM {CLICKHOUSE_DATABASE}.orders FINAL "
    f"WHERE account_id=%(a)s AND market_id=%(m)s AND action='buy' LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A4-fail: no orders buy row found"
orders_total_fee = Decimal(str(r.result_rows[0][0]))
assert orders_total_fee == expected_buy_fee, f"A4-fail: orders.total_fee={orders_total_fee}"
print(f"A4 PASS  orders.total_fee={orders_total_fee} correct")

# A5/A6/A7: snapshot_position
r = c.query(
    f"SELECT total_fee_buy, total_fee_sell, avg_price FROM {CLICKHOUSE_DATABASE}.snapshot_position FINAL "
    f"WHERE account_id=%(a)s AND market_id=%(m)s LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A5-fail: no snapshot_position row found"
pos_fee_buy = Decimal(str(r.result_rows[0][0]))
pos_fee_sell = Decimal(str(r.result_rows[0][1]))
pos_avg_price = Decimal(str(r.result_rows[0][2]))
assert pos_fee_buy == expected_buy_fee, f"A5-fail: total_fee_buy={pos_fee_buy}"
print(f"A5 PASS  snapshot_position.total_fee_buy={pos_fee_buy} correct")
assert pos_fee_sell == Decimal("0"), f"A6-fail: total_fee_sell={pos_fee_sell} (should be 0)"
print(f"A6 PASS  snapshot_position.total_fee_sell=0 correct")
assert pos_avg_price == buy_price, f"A7-fail: avg_price={pos_avg_price} expected={buy_price} (should be RAW)"
print(f"A7 PASS  snapshot_position.avg_price={pos_avg_price} is RAW (no fee contamination)")

# A8: accounts.balance_cash decreased by (cost + broker_fee)
acct_after_buy = read_account_state(c, ACCOUNT_ID)
cash_after_buy = acct_after_buy["balance_cash"]
expected_cash_after_buy = cash_before_buy - buy_cost - expected_buy_fee
assert cash_after_buy == expected_cash_after_buy, (
    f"A8-fail: balance_cash={cash_after_buy} expected={expected_cash_after_buy} "
    f"(buy_cost={buy_cost} fee={expected_buy_fee})"
)
print(f"A8 PASS  accounts.balance_cash={cash_after_buy} correctly decreased by cost+fee")

# ---------------------------------------------------------------------------
# 3. Execute sell via PaperBroker
# ---------------------------------------------------------------------------
sell_price = Decimal("0.80")
sell_qty = buy_qty
sell_cost = sell_price * sell_qty  # 8.00
gross_pnl = sell_cost - buy_cost   # 3.50

sell_ts = _now_utc()
sell_decision_id = make_decision_id(market_id, "sell", sell_ts)

sell_dict = {
    "decision_id": sell_decision_id,
    "order_id": sell_decision_id,
    "market_id": market_id,
    "city": "test-city-fee",
    "bucket_low": Decimal("70"),
    "bucket_high": Decimal("75"),
    "decided_at": sell_ts.isoformat(),
    "action": "sell",
    "price": sell_price,
    "cnt": sell_qty,
    "cost": sell_cost,
    "pnl": gross_pnl,
    "date": "2026-06-01",
    "resolution_date": "2026-06-01",
    "close_ts": sell_ts.isoformat(),
    "position_id": buy_decision_id,
    "why_close": "take_profit",
    "budget": cash_after_buy + sell_cost,  # cash after sell (before fee deduction)
    "balance_start": balance_start,
    "total_trades": 1,
    "wins": 1,
    "losses": 0,
}

try:
    oid_sell = broker.submit(ACCOUNT_ID, sell_dict)
    broker.receive(ACCOUNT_ID, oid_sell, sell_dict)
    print("     PaperBroker sell OK")
except Exception as exc:
    print(f"FAIL PaperBroker sell: {exc}")
    sys.exit(1)

time.sleep(0.5)

# ---------------------------------------------------------------------------
# A9–A12: Assert sell-side fee
# ---------------------------------------------------------------------------
expected_sell_fee = (sell_price * sell_qty * PAPER_FEE_RATIO).quantize(Decimal("0.0001"))
print(f"     expected_sell_fee={expected_sell_fee}")

# A9: events_trades.broker_fee for sell
r = c.query(
    f"SELECT broker_fee FROM {CLICKHOUSE_DATABASE}.events_trades "
    f"WHERE account_id=%(a)s AND market_id=%(m)s AND action='sell' LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A9-fail: no events_trades sell row found"
et_sell_fee = Decimal(str(r.result_rows[0][0]))
assert et_sell_fee == expected_sell_fee, f"A9-fail: sell broker_fee={et_sell_fee} expected={expected_sell_fee}"
print(f"A9 PASS  events_trades sell broker_fee={et_sell_fee} correct")

# A10/A11: snapshot_position after sell
r = c.query(
    f"SELECT total_fee_buy, total_fee_sell FROM {CLICKHOUSE_DATABASE}.snapshot_position FINAL "
    f"WHERE account_id=%(a)s AND market_id=%(m)s LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A10-fail: no snapshot_position row after sell"
post_sell_fee_buy = Decimal(str(r.result_rows[0][0]))
post_sell_fee_sell = Decimal(str(r.result_rows[0][1]))
assert post_sell_fee_sell == expected_sell_fee, f"A10-fail: total_fee_sell={post_sell_fee_sell}"
print(f"A10 PASS snapshot_position.total_fee_sell={post_sell_fee_sell} correct after sell")
assert post_sell_fee_buy == expected_buy_fee, f"A11-fail: total_fee_buy changed to {post_sell_fee_buy}"
print(f"A11 PASS snapshot_position.total_fee_buy={post_sell_fee_buy} unchanged after sell")

# A12: accounts.balance_cash after sell
acct_after_sell = read_account_state(c, ACCOUNT_ID)
cash_after_sell = acct_after_sell["balance_cash"]
expected_cash_after_sell = cash_after_buy + sell_cost - expected_sell_fee
assert cash_after_sell == expected_cash_after_sell, (
    f"A12-fail: balance_cash={cash_after_sell} expected={expected_cash_after_sell} "
    f"(sell_cost={sell_cost} fee={expected_sell_fee})"
)
print(f"A12 PASS accounts.balance_cash={cash_after_sell} correctly adjusted by sell_cost-fee")

print()
print("ALL FEE R2.9 ASSERTIONS PASSED")

# ---------------------------------------------------------------------------
# Cleanup test rows
# ---------------------------------------------------------------------------
for tbl in ("events_decisions", "events_trades", "events_orders", "orders", "snapshot_position"):
    c.command(
        f"ALTER TABLE {CLICKHOUSE_DATABASE}.{tbl} DELETE WHERE market_id=%(m)s",
        parameters={"m": market_id},
    )
print("     test rows cleaned up")
