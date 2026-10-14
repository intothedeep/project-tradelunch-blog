#!/usr/bin/env bash
# Deploy blog-web (Next) to the GCP VM from a green "GCP build" run.
# Steps follow deploy/gcp/README.md §8 a, b, d, d2, e. Secrets (§8 c) must exist already.
#
#   ./_scripts/gcp/deploy-web.sh                 # newest successful run on main
#   ./_scripts/gcp/deploy-web.sh <run id>        # a specific run
#   COPY_CONFIG=1 ./_scripts/gcp/deploy-web.sh   # also copy ecosystem.config.cjs + release.sh
#
# Run from the repo root on the Mac. Roll back: see README §8 "Roll back".

set -euo pipefail

VM=tio_taek_lim@instance-servers
Z=(--zone=us-central1-a --tunnel-through-iap)

# a. Pick the run and download the tarball.
RUN="${1:-$(gh run list --workflow=gcp.yml --branch main --status success --limit 1 \
    --json databaseId --jq '.[0].databaseId')}"
SHA=$(gh run view "$RUN" --json headSha --jq .headSha)
echo "run $RUN  sha $SHA"
TGZ=".gh-artifacts/web-$SHA.tgz"
[ -f "$TGZ" ] || gh run download "$RUN" -n "gcp-$SHA" -D .gh-artifacts
test -f "$TGZ"

# b. Copy to the VM. One scp and one ssh: IAP connections are slow and rate limited.
FILES=("$TGZ")
if [ "${COPY_CONFIG:-0}" = 1 ]; then
    FILES+=(deploy/gcp/ecosystem.config.cjs deploy/gcp/release.sh)
fi
gcloud compute scp "${FILES[@]}" "$VM:~/prettylog/" "${Z[@]}"

# d + e (VM side). Non-interactive ssh does not load nvm, so source it for pm2.
# A re-run finds the release already unpacked: switch to it without the tarball.
gcloud compute ssh "$VM" "${Z[@]}" --command "bash -c '
    set -e
    source ~/.nvm/nvm.sh
    cd ~/prettylog
    if [ -d web/releases/$SHA ]; then
        ./release.sh web $SHA
    else
        ./release.sh web $SHA ~/prettylog/web-$SHA.tgz
    fi
    pm2 save
    sleep 3
    pm2 ls
    u=http://localhost:3000
    curl -m 20 -s -o /dev/null -w \"page    %{http_code} %{time_total}s\n\" \$u/
    curl -m 10 -s -o /dev/null -w \"static  %{http_code} %{time_total}s\n\" \$u/robots.txt
    pm2 logs blog-web --err --lines 20 --nostream
'"

# d2. Old HTML at the edge points at old JS: purge every web release.
./_scripts/cloudflare/cf-purge.sh

# e (Mac side).
curl -m 30 -s -o /dev/null -w 'my. %{http_code} %{time_total}s\n' https://my.prettylog.com/
curl -s -o /dev/null -D - https://my.prettylog.com/ | grep -iE 'cf-cache-status|^age' || true
echo "deployed web $SHA"
