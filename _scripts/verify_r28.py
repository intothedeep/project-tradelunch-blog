"""Synthetic R2.8 verification script.

Exercises the full write path end-to-end:
  insert_decision → submit_order → receive_trade → read-back

Assertions:
  A1  events_decisions row has decision_id, order_id (no action_id column)
  A2  orders row has buy_order_id = order_id for buy
  A3  events_trades row has local_event_trade_id, order_id (no position_id, no action_id)
  A4  sell orders row has buy_order_id = buy's order_id
  A5  events_trades sell row links back to buy via orders.buy_order_id
  A6  events_decisions has no 'action_id' column
  A7  events_trades has no 'position_id' and no 'action_id' column
  A8  events_orders has no 'position_id' column
"""

import sys
from datetime import datetime, timezone
from decimal import Decimal

sys.path.insert(0, "/Users/tio/Documents/00_projects/weatherbot/src")

from weatherbot_db.config import CLICKHOUSE_DATABASE
from weatherbot_db.client import get_client
from weatherbot_live.writer_infra import make_decision_id, make_local_event_trade_id, _now_utc
from weatherbot_live.writer import submit_order, receive_trade, write_trade
from weatherbot_live.writer_events import insert_decision

ACCOUNT_ID = 1  # paper-canonical-001

client = get_client()

# ---------------------------------------------------------------------------
# 0. Schema-level column assertions (A6, A7, A8)
# ---------------------------------------------------------------------------

def _columns(table: str) -> set[str]:
    r = client.query(
        f"SELECT name FROM system.columns "
        f"WHERE database=%(db)s AND table=%(t)s",
        parameters={"db": CLICKHOUSE_DATABASE, "t": table},
    )
    return {row[0] for row in r.result_rows}


ed_cols = _columns("events_decisions")
assert "decision_id" in ed_cols, "A6-fail: events_decisions missing decision_id"
assert "action_id" not in ed_cols, "A6-fail: events_decisions still has action_id"
print("A6 PASS  events_decisions has decision_id, no action_id")

et_cols = _columns("events_trades")
assert "local_event_trade_id" in et_cols, "A7-fail: events_trades missing local_event_trade_id"
assert "position_id" not in et_cols, "A7-fail: events_trades still has position_id"
assert "action_id" not in et_cols, "A7-fail: events_trades still has action_id"
print("A7 PASS  events_trades has local_event_trade_id, no position_id, no action_id")

eo_cols = _columns("events_orders")
assert "position_id" not in eo_cols, "A8-fail: events_orders still has position_id"
print("A8 PASS  events_orders has no position_id")

o_cols = _columns("orders")
assert "buy_order_id" in o_cols, "orders missing buy_order_id"
assert "decision_id" in o_cols, "orders missing decision_id"
print("     orders has buy_order_id and decision_id")

# ---------------------------------------------------------------------------
# 1. Build test dicts
# ---------------------------------------------------------------------------

market_id = "test-r28-market-001"
decision_ts = _now_utc()
buy_decision_id = make_decision_id(market_id, "buy", decision_ts)

buy_dict = {
    "decision_id": buy_decision_id,
    "order_id": buy_decision_id,
    "market_id": market_id,
    "city": "test-city",
    "bucket_low": Decimal("70"),
    "bucket_high": Decimal("75"),
    "decided_at": decision_ts.isoformat(),
    "action": "buy",
    "price": Decimal("0.45"),
    "cnt": Decimal("10"),
    "cost": Decimal("4.50"),
    "budget_delta": Decimal("-4.50"),
    "date": "2026-05-10",        # <-- resolution_date fix
    "resolution_date": "2026-05-10",
    "stop_loss_curr": Decimal("0.20"),
    "stop_loss_total": Decimal("0.05"),
    "open_ts": decision_ts.isoformat(),
    "position_id": buy_decision_id,
}

sell_ts = _now_utc()
sell_decision_id = make_decision_id(market_id, "sell", sell_ts)

sell_dict = {
    "decision_id": sell_decision_id,
    "order_id": sell_decision_id,
    "market_id": market_id,
    "city": "test-city",
    "bucket_low": Decimal("70"),
    "bucket_high": Decimal("75"),
    "decided_at": sell_ts.isoformat(),
    "action": "sell",
    "price": Decimal("0.80"),
    "cnt": Decimal("10"),
    "cost": Decimal("8.00"),
    "pnl": Decimal("3.50"),
    "budget_delta": Decimal("8.00"),
    "date": "2026-05-10",
    "resolution_date": "2026-05-10",
    "close_ts": sell_ts.isoformat(),
    "position_id": buy_decision_id,  # link to buy
    "why_close": "take_profit",
}

# ---------------------------------------------------------------------------
# 2. Write buy via write_trade (fan-out)
# ---------------------------------------------------------------------------

try:
    write_trade(client, buy_dict, ACCOUNT_ID)
    print("     write_trade(buy) OK")
except Exception as exc:
    print(f"FAIL write_trade(buy): {exc}")
    sys.exit(1)

# Also insert an explicit decision row for the buy
try:
    insert_decision(client, buy_dict, ACCOUNT_ID)
    print("     insert_decision(buy) OK")
except Exception as exc:
    print(f"FAIL insert_decision(buy): {exc}")
    sys.exit(1)

# ---------------------------------------------------------------------------
# 3. Write sell via write_trade
# ---------------------------------------------------------------------------

try:
    write_trade(client, sell_dict, ACCOUNT_ID)
    print("     write_trade(sell) OK")
except Exception as exc:
    print(f"FAIL write_trade(sell): {exc}")
    sys.exit(1)

# ---------------------------------------------------------------------------
# 4. Read-back assertions
# ---------------------------------------------------------------------------

import time; time.sleep(0.5)  # let CH merge settle slightly

# A1: events_decisions buy row
r = client.query(
    f"SELECT decision_id, order_id FROM {CLICKHOUSE_DATABASE}.events_decisions "
    f"WHERE account_id=%(a)s AND market_id=%(m)s AND action='buy' LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A1-fail: no events_decisions buy row found"
row = r.result_rows[0]
assert row[0] == buy_decision_id, f"A1-fail: decision_id mismatch {row[0]!r}"
assert row[1] == buy_decision_id, f"A1-fail: order_id mismatch {row[1]!r}"
print("A1 PASS  events_decisions buy row: decision_id and order_id correct")

# A2: orders row for buy has buy_order_id = order_id
r = client.query(
    f"SELECT order_id, buy_order_id, decision_id FROM {CLICKHOUSE_DATABASE}.orders FINAL "
    f"WHERE account_id=%(a)s AND market_id=%(m)s AND action='buy' LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A2-fail: no orders buy row found"
row = r.result_rows[0]
assert row[0] == buy_decision_id, f"A2-fail: order_id mismatch {row[0]!r}"
assert row[1] == buy_decision_id, f"A2-fail: buy_order_id != order_id for buy: {row[1]!r}"
print("A2 PASS  orders buy row: buy_order_id = order_id (self-reference)")

# A3: events_trades buy row has local_event_trade_id and order_id
r = client.query(
    f"SELECT local_event_trade_id, order_id FROM {CLICKHOUSE_DATABASE}.events_trades "
    f"WHERE account_id=%(a)s AND market_id=%(m)s AND action='buy' LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A3-fail: no events_trades buy row found"
row = r.result_rows[0]
assert row[0].startswith(buy_decision_id), f"A3-fail: local_event_trade_id bad prefix {row[0]!r}"
assert "|fill|" in row[0], f"A3-fail: local_event_trade_id missing '|fill|' {row[0]!r}"
assert row[1] == buy_decision_id, f"A3-fail: order_id mismatch {row[1]!r}"
print("A3 PASS  events_trades buy row: local_event_trade_id and order_id correct")

# A4: orders row for sell has buy_order_id = buy's order_id
r = client.query(
    f"SELECT order_id, buy_order_id FROM {CLICKHOUSE_DATABASE}.orders FINAL "
    f"WHERE account_id=%(a)s AND market_id=%(m)s AND action='sell' LIMIT 1",
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A4-fail: no orders sell row found"
row = r.result_rows[0]
assert row[0] == sell_decision_id, f"A4-fail: sell order_id mismatch {row[0]!r}"
assert row[1] == buy_decision_id, f"A4-fail: buy_order_id should be buy's order_id, got {row[1]!r}"
print("A4 PASS  orders sell row: buy_order_id = buy's order_id")

# A5: 2-hop join — events_trades sell → orders → buy_order_id
r = client.query(
    f"""
    SELECT t.order_id, o.buy_order_id
    FROM {CLICKHOUSE_DATABASE}.events_trades AS t
    INNER JOIN (SELECT * FROM {CLICKHOUSE_DATABASE}.orders FINAL) AS o
           ON o.account_id = t.account_id AND o.order_id = t.order_id
    WHERE t.account_id=%(a)s AND t.market_id=%(m)s AND t.action='sell'
    LIMIT 1
    """,
    parameters={"a": ACCOUNT_ID, "m": market_id},
)
assert r.result_rows, "A5-fail: 2-hop join returned no rows"
row = r.result_rows[0]
assert row[0] == sell_decision_id, f"A5-fail: sell order_id {row[0]!r}"
assert row[1] == buy_decision_id, f"A5-fail: buy_order_id via join {row[1]!r}"
print("A5 PASS  2-hop join: events_trades.sell -> orders -> buy_order_id = buy's order_id")

print()
print("ALL R2.8 ASSERTIONS PASSED")

# ---------------------------------------------------------------------------
# 5. Cleanup test rows
# ---------------------------------------------------------------------------

client.command(
    f"ALTER TABLE {CLICKHOUSE_DATABASE}.events_decisions DELETE "
    f"WHERE market_id=%(m)s",
    parameters={"m": market_id},
)
client.command(
    f"ALTER TABLE {CLICKHOUSE_DATABASE}.events_trades DELETE "
    f"WHERE market_id=%(m)s",
    parameters={"m": market_id},
)
client.command(
    f"ALTER TABLE {CLICKHOUSE_DATABASE}.events_orders DELETE "
    f"WHERE market_id=%(m)s",
    parameters={"m": market_id},
)
client.command(
    f"ALTER TABLE {CLICKHOUSE_DATABASE}.orders DELETE "
    f"WHERE market_id=%(m)s",
    parameters={"m": market_id},
)
client.command(
    f"ALTER TABLE {CLICKHOUSE_DATABASE}.snapshot_position DELETE "
    f"WHERE market_id=%(m)s",
    parameters={"m": market_id},
)
print("     test rows cleaned up")
