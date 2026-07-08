# scripts/parity — Finance Parity Harness

Read-only comparison tool. No prod changes. Exits 0 if all endpoints match, 1 if any diverge.

## How it works

For each finance endpoint the harness:
1. GETs from backend A and backend B in parallel.
2. Normalizes both responses: strips timestamp/generation-time fields, sorts arrays by stable key.
3. Deep-diffs the normalized payloads.
4. Prints PASS / FAIL / WARN per endpoint, then a summary table.

## B0.4 use case — two local dev servers (same Supabase DB)

Both `finance_api` and `dashboard_server` can point at the same `POSTGRES_URL`
(Supabase) so they share identical data. Run them on different ports.

```sh
# Terminal 1 — finance_api on :4000
cd apps/finance_api
POSTGRES_URL="<supabase-pooled-url>" PORT=4000 pnpm dev

# Terminal 2 — dashboard_server on :3002
cd apps/dashboard_server
POSTGRES_URL="<supabase-pooled-url>" PORT=3002 pnpm dev

# Terminal 3 — run harness with defaults (A=:4000, B=:3002)
node scripts/parity/parity.mjs \
  --cik 0001067983 \
  --cusip 594918104 \
  --ticker MSFT \
  --filer nancy_pelosi
```

Supply param values that exist in your dataset. The defaults are illustrative;
endpoints return `data: null` for unknown params (still a valid parity result).

## B2.1 use case — Oracle vs Supabase (after data move)

This is the authoritative parity run. After `finance_api` is deployed on the
Oracle VM and Supabase data has been restored there:

```sh
node scripts/parity/parity.mjs \
  --base-a https://finance-api.your-oracle-vm.example.com \
  --base-b https://project-tradelunch-blog-server.vercel.app \
  --cik 0001067983 \
  --cusip 594918104 \
  --ticker MSFT \
  --filer nancy_pelosi
```

## All flags

| Flag        | Default               | Description                          |
|-------------|-----------------------|--------------------------------------|
| `--base-a`  | `http://localhost:4000` | Base URL for backend A             |
| `--base-b`  | `http://localhost:3002` | Base URL for backend B             |
| `--cik`     | `0001067983`          | CIK for /funds/:cik routes           |
| `--cusip`   | `594918104`           | CUSIP for /securities/:cusip/consensus |
| `--ticker`  | `MSFT`                | Ticker for /securities/:ticker/by-ticker |
| `--filer`   | `nancy_pelosi`        | filerId for /politicians/:filerId    |
| `--timeout` | `10000`               | Per-request timeout in ms            |

## Normalization policy

Fields stripped before diff (`IGNORED_KEYS` constant in `parity.mjs`):
`createdAt`, `updatedAt`, `generatedAt`, `fetchedAt`, `asOf`, `timestamp`,
`lastModified`, `cachedAt`, `requestedAt`.

Arrays are sorted by a stable JSON fingerprint of their values so reordering
does not count as a diff. Extend the `IGNORED_KEYS` set in the script as needed.

## Syntax check

```sh
node --check scripts/parity/parity.mjs
```
