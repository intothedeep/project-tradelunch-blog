# 11. WIF weekly review fails at setup-gcloud

Result: fixed 2026-10-13. Commit `cf6a932`, file `deploy/logging/github-wif.md`. Re-run 38354550435 posted issue #3.

## Symptom

| Where | What |
| --- | --- |
| First Actions run of the weekly logging review | fails at the `setup-gcloud` step |
| Error | `There was a problem refreshing your current auth tokens` |
| Failure path | the workflow opened a warning issue (#2), so the fallback worked |

## Cause

```text
GitHub OIDC token ─► auth step OK (login happens)
        ▼
exchange via STS API            ─► API off
impersonate via IAM Credentials ─► API off
        ▼
setup-gcloud: cannot refresh tokens ─► fail
```

- The job logged in, then failed. Two APIs were disabled: STS and IAM Credentials.

## Fix

```sh
gcloud services enable sts.googleapis.com iamcredentials.googleapis.com iam.googleapis.com --project=$P
```

Re-run result: Actions run 38354550435 opened issue #3 with 4.5 MB / 7 days, 0 ERROR, OK.

## Evidence

- `deploy/logging/github-wif.md` status line and setup step 0 (the comment cites "seen 2026-10-13").
- The ⚠️ issue #2 detail comes from the brief, not verified in a repo file.

## Lesson

A login that works and a refresh that fails points at disabled APIs. Check `gcloud services list` first.
