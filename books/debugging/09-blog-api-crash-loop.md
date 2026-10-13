# 9. `blog-api` crash loop from a bad number in `api.env`

Result: fixed 2026-10-13. Digits only in the value, then restart with `--update-env`. Source: `deploy/gcp/README.md` troubleshooting table.

## Symptom

| Where | What |
| --- | --- |
| `pm2 ls` | `blog-api` restarts climbing (↺15 in the brief, not verified in a repo file) |
| `pm2 logs blog-api` | `ZodError ... MAX_FILE_SIZE expected number, received NaN` |

## Cause

```text
shared/api.env:  MAX_FILE_SIZE=<unit, formula or "# comment">
        ▼
ecosystem.config.cjs readEnvFile ─► env string
        ▼
zod env schema: number expected ─► NaN ─► ZodError at boot ─► PM2 restarts ─► loop
```

- The runbook names the bad shapes: a unit, a formula, or a same-line `# comment`.
- Other numeric keys listed: `THUMBNAIL_*`.

## Fix

1. Edit `~/prettylog/shared/api.env`. Keep digits only, or delete the line to use the default.
2. Restart so PM2 re-reads the file.

```sh
pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-api --update-env
```

## Evidence

- `deploy/gcp/README.md` troubleshooting row: `ZodError ... expected number, received NaN` (seen 2026-10-13).
- `deploy/gcp/ecosystem.config.cjs` `readEnvFile` takes the text after `=` as the value.
- Not verified: the exact bad value that was in the file.

## Lesson

Read the first ZodError line. It names the key. A boot loop is a config fault until proven otherwise.
