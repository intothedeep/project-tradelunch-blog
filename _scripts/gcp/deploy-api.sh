#!/usr/bin/env bash
# Deploy blog-api (Express) to the GCP VM from a green "GCP build" run.
# Steps follow deploy/gcp/README.md §1, §2, §4, §6. Secrets (§3, shared/api.env) must exist already.
#
#   ./_scripts/gcp/deploy-api.sh                 # newest successful run on main
#   ./_scripts/gcp/deploy-api.sh <run id>        # a specific run
#   COPY_CONFIG=1 ./_scripts/gcp/deploy-api.sh   # also copy ecosystem.config.cjs + release.sh
#
# Run from the repo root on the Mac. Roll back: see README "Roll back".

set -euo pipefail

VM=tio_taek_lim@instance-servers
Z=(--zone=us-central1-a --tunnel-through-iap)

# 1. Pick the run and download the tarball.
RUN="${1:-$(gh run list --workflow=gcp.yml --branch main --status success --limit 1 \
    --json databaseId --jq '.[0].databaseId')}"
SHA=$(gh run view "$RUN" --json headSha --jq .headSha)
echo "run $RUN  sha $SHA"
TGZ=".gh-artifacts/api-$SHA.tgz"
[ -f "$TGZ" ] || gh run download "$RUN" -n "gcp-$SHA" -D .gh-artifacts
test -f "$TGZ"

# 2. Copy to the VM. One scp and one ssh: IAP connections are slow and rate limited.
FILES=("$TGZ")
if [ "${COPY_CONFIG:-0}" = 1 ]; then
    FILES+=(deploy/gcp/ecosystem.config.cjs deploy/gcp/release.sh)
fi
gcloud compute scp "${FILES[@]}" "$VM:~/prettylog/" "${Z[@]}"

# 4 + 6 (VM side). Non-interactive ssh does not load nvm, so source it for pm2.
# A re-run finds the release already unpacked: switch to it without the tarball.
gcloud compute ssh "$VM" "${Z[@]}" --command "bash -c '
    set -e
    source ~/.nvm/nvm.sh
    cd ~/prettylog
    if [ -d api/releases/$SHA ]; then
        ./release.sh api $SHA
    else
        ./release.sh api $SHA ~/prettylog/api-$SHA.tgz
    fi
    pm2 save
    sleep 3
    pm2 ls
    curl -m 10 -s -w \"\nping    %{http_code} %{time_total}s\n\" http://localhost:4000/ping
    pm2 logs blog-api --err --lines 20 --nostream
'"

# 6 (Mac side). No edge purge: API cache rules respect origin TTL (README §7).
curl -m 15 -s -o /dev/null -w 'api-pub %{http_code} %{time_total}s\n' https://blog-api.prettylog.com/ping
curl -m 15 -s 'https://blog-api.prettylog.com/v1/api/posts?limit=1' | head -c 200; echo
echo "deployed api $SHA"
