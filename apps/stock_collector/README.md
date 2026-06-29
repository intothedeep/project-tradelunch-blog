# stock-collector

Yahoo OHLC daily collector + market-cap ranking feeding the tradelunch dashboard
(`market_snapshots` / `market_history`). Polyglot sibling app — NOT a pnpm
workspace member. See repo `00.plan.md` / `00.tasks.md` Phase I.

```sh
uv sync --extra dev
uv run pytest            # pure transform/ranking specs (stdlib-only, no network)
uv run python -m collector.entrypoints.run_daily
```
