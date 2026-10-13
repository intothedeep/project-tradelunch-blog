# 12. `pnpm exec next` at the repo root

Result: fixed 2026-10-13. Run through the workspace filter. Documented in `apps/dashboard_client_web/LOCAL_PROD_API.md` step 4 and the app `README.md`.

## Symptom

| Where | What |
| --- | --- |
| Repo root, `pnpm exec next dev ...` | `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "next" not found` |
| Related slip | key variables forgotten in front of the command, so the dev keys in `.env.local` load and chapter 4 returns |

## Cause

```text
repo root node_modules/.bin  ─► no "next"      (next lives in apps/dashboard_client_web)
pnpm exec runs from cwd      ─► not found
```

- The runbook states `next` is not installed at the repo root.
- Without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in front, dev keys load and every signed-in call is 401 again.

## Fix

```sh
pnpm --filter dashboard_client_web exec next dev -p 3000 --experimental-https
# or: cd apps/dashboard_client_web first
```

Keep both key variables in front of the command (read them with `read -s`, see the runbook).

## Evidence

- `LOCAL_PROD_API.md` step 4: "Run `next` from `apps/dashboard_client_web` (or with `pnpm --filter dashboard_client_web exec`): it is not installed at the repo root".
- Same file: "Both key variables are required."

## Lesson

In a monorepo, run a package binary through its workspace. Never assume the root has it.
