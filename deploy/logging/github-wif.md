# GitHub Actions → GCP without keys (Workload Identity Federation)

Status: **GCP side set up 2026-10-13** (pool + provider ACTIVE, `gh-logging-reader` with `roles/logging.viewer`, repo Variables `GCP_WIF_PROVIDER`, `GCP_LOGGING_SA`). Workflow change in progress. Purpose: let the weekly logging review
(`.github/workflows/logging-review.yml`, decision #57) run `check-volume.sh` itself and post
the result, instead of only opening a reminder issue. The same pool is reused later for the
automated deploy (task GCP-M3-7) with a separate service account.

| Fact | Value |
| --- | --- |
| GCP project | `mywebsite-511502` |
| GitHub repo | `intothedeep/project-tradelunch-blog` (**public**) |
| Pool / provider | `github` / `github` (global) |
| Service account | `gh-logging-reader@mywebsite-511502.iam.gserviceaccount.com` |
| Role | `roles/logging.viewer` (read logs only) |

## How it works

```text
GitHub Actions run (weekly)
  │ ① GitHub issues an OIDC token for this run:
  │    "I am a workflow of intothedeep/project-tradelunch-blog"
  ▼
GCP Workload Identity Pool "github"
  │ ② checks the token; attribute condition admits only this repo
  ▼
service account gh-logging-reader   (roles/logging.viewer)
  │ ③ short-lived credentials (about 1 hour), no key file anywhere
  ▼
deploy/logging/check-volume.sh 7d ─► summary in the issue
```

## Options

| Option | Good | Bad | Pick |
| --- | --- | --- | --- |
| **WIF** | no key file; only this repo can use it; credentials expire in ~1 h | ~5 commands once | **recommended** |
| Service-account JSON key in a GitHub secret | quick | a key that never expires sits in GitHub; a leak is a standing credential | no |
| Keep the reminder-only issue (today) | nothing to set up | the owner runs the check by hand | current |

One pool, one service account **per job**: `gh-logging-reader` (logging viewer) now,
a deploy account (IAP tunnel user + OS Login) later for GCP-M3-7. Each gets only its own role.

## Setup (Mac, once; changes IAM — owner approves before running)

```sh
P=mywebsite-511502
N=$(gcloud projects describe $P --format='value(projectNumber)')
REPO=intothedeep/project-tradelunch-blog

# 1. Pool + OIDC provider for GitHub, restricted to this repo
gcloud iam workload-identity-pools create github --project=$P --location=global
gcloud iam workload-identity-pools providers create-oidc github --project=$P --location=global \
  --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$REPO'"

# 2. Read-only service account
gcloud iam service-accounts create gh-logging-reader --project=$P
gcloud projects add-iam-policy-binding $P \
  --member=serviceAccount:gh-logging-reader@$P.iam.gserviceaccount.com \
  --role=roles/logging.viewer

# 3. Only workflows of this repo may act as that account
gcloud iam service-accounts add-iam-policy-binding \
  gh-logging-reader@$P.iam.gserviceaccount.com --project=$P \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

# 4. Values the workflow needs (not secret; store as repo Variables)
echo "GCP_WIF_PROVIDER=projects/$N/locations/global/workloadIdentityPools/github/providers/github"
echo "GCP_LOGGING_SA=gh-logging-reader@$P.iam.gserviceaccount.com"
gh variable set GCP_WIF_PROVIDER --body "projects/$N/locations/global/workloadIdentityPools/github/providers/github"
gh variable set GCP_LOGGING_SA   --body "gh-logging-reader@$P.iam.gserviceaccount.com"
```

Check:

```sh
gcloud iam workload-identity-pools providers describe github --project=$P \
  --location=global --workload-identity-pool=github --format='value(state,attributeCondition)'
# ACTIVE  assertion.repository=='intothedeep/project-tradelunch-blog'
```

## Workflow change (after setup)

Planned edits to `.github/workflows/logging-review.yml`:

```yaml
permissions:
    issues: write
    id-token: write          # lets the job request the OIDC token
    contents: read           # checkout, to run deploy/logging/check-volume.sh

steps:
    - uses: actions/checkout@v4
    - uses: google-github-actions/auth@v2
      with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_LOGGING_SA }}
    - uses: google-github-actions/setup-gcloud@v2
    - run: deploy/logging/check-volume.sh 7d > volume.txt
    - # build a SHORT summary from volume.txt and open the issue with it
```

Pin each action to a commit SHA when this lands (as `ci.yml` does); the tags above show the
intent only. Check the current major versions at that time.

## Public repo: post a summary only

Issues and Actions logs of a public repo are readable by anyone. The full script output names
the VM's services (`systemd`, `cloudflared`, `sbkeysync`, …) — low risk, but it describes the
server. The issue gets only:

| Line | Example |
| --- | --- |
| total MB for 7 days, vs the weekly target (< 250 MB) | `31.4 MB / 250 MB ✅` |
| `blog-api` ERROR count | `ERROR 2 ✅` |
| verdict | `OK` or `⚠️ check on the Mac: deploy/logging/check-volume.sh 7d` |

Do not `cat volume.txt` in a step (it would print in the public run log); keep it in the file.

## Undo

```sh
gcloud iam service-accounts delete gh-logging-reader@$P.iam.gserviceaccount.com --project=$P
gcloud iam workload-identity-pools delete github --project=$P --location=global
gh variable delete GCP_WIF_PROVIDER; gh variable delete GCP_LOGGING_SA
```

A deleted pool stays reserved for 30 days (the name `github` cannot be reused until then);
undelete with `gcloud iam workload-identity-pools undelete github --location=global`.
