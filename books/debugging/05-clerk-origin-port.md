# 5. Clerk production keys rejected on a port

Result: fixed 2026-10-13. Serve the dev server on 443 so the origin has no port. Documented in `apps/dashboard_client_web/LOCAL_PROD_API.md`.

## Symptom

| Where | What |
| --- | --- |
| Browser | `Clerk: Production Keys are only allowed for domain "prettylog.com". API Error: The Request HTTP Origin header must be equal to or a subdomain of the requesting URL.` |
| Origin sent | `https://local.prettylog.com:3000` |

## Cause

```text
URL  https://local.prettylog.com:3000
Origin header = scheme + host + :3000
        ▼
Clerk compares Origin with the requesting URL ─► not equal / not a subdomain ─► reject
```

- The host was right. The port made the origin a different string.

## Fix

Run on port 443, the https default. The browser then sends `https://local.prettylog.com` with no port.

```sh
pnpm exec next dev --turbopack -p 443 -H 0.0.0.0 --experimental-https ...
```

Binding 443 raises chapter 6.

## Evidence

- `LOCAL_PROD_API.md` table row for port 443: "Clerk rejected `https://local.prettylog.com:3000` ... (seen 2026-10-13)".
- Check-table row: "Clerk: Production Keys are only allowed for domain ... the URL has a port, or the host is not under `prettylog.com`".

## Lesson

Read the origin literally, port included. A matching host is not a matching origin.
