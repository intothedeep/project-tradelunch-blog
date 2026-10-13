#!/usr/bin/env bash
# Usage: release.sh <api|web> <sha> [tarball]
# With tarball: unpack into releases/<sha>, switch `current`, reload PM2.
# Without: roll back to the already unpacked releases/<sha>.
set -euo pipefail

app="${1:?usage: release.sh <api|web> <sha> [tarball]}"
sha="${2:?usage: release.sh <api|web> <sha> [tarball]}"
tarball="${3:-}"
keep=3

case "$app" in api | web) ;; *) echo "app must be api or web" >&2; exit 2 ;; esac
[[ "$sha" =~ ^[A-Za-z0-9._-]+$ && "$sha" != x_* ]] || { echo "bad sha: $sha" >&2; exit 2; }

root="$HOME/prettylog"
dir="$root/$app"
pm2_app="blog-$app"
release="$dir/releases/$sha"

if ! command -v pm2 >/dev/null; then
    # Non-interactive ssh does not load nvm.
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
fi

if [[ -n "$tarball" ]]; then
    [[ -f "$tarball" ]] || { echo "no tarball: $tarball" >&2; exit 2; }
    [[ ! -e "$release" ]] || { echo "release exists: $release (omit tarball to roll back)" >&2; exit 2; }
    mkdir -p "$dir/releases"
    # Unpack beside the target, then rename: a failed tar never leaves a half release.
    partial="$dir/releases/.partial-$sha"
    mkdir "$partial"
    tar -xzf "$tarball" -C "$partial"
    mv "$partial" "$release"
else
    [[ -d "$release" ]] || { echo "no such release: $release" >&2; exit 2; }
fi
touch "$release" # rollback target counts as newest for retention

cd "$dir"
ln -sfn "releases/$sha" current.new
mv -T current.new current

if pm2 describe "$pm2_app" >/dev/null 2>&1; then
    pm2 reload "$pm2_app" --update-env
else
    pm2 start "$root/ecosystem.config.cjs" --only "$pm2_app"
fi

# Retention: keep the newest $keep (and `current`); rename the rest to x_<sha>.
# Never rm: the owner deletes x_* by hand.
current="$(basename "$(readlink current)")"
n=0
while IFS= read -r name; do
    n=$((n + 1))
    [[ $n -le $keep || "$name" == "$current" ]] && continue
    [[ -e "releases/x_$name" ]] && { echo "skip: releases/x_$name exists" >&2; continue; }
    mv "releases/$name" "releases/x_$name"
done < <(cd releases && ls -1t | grep -v '^x_')
