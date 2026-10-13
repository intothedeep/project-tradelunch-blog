# 10. zsh does not split a string variable

Result: fixed 2026-10-13. Use an array. Documented in `deploy/gcp/README.md` §2.

## Symptom

| Where | What |
| --- | --- |
| Command | `Z="--zone=us-central1-a --tunnel-through-iap"` then `gcloud compute ssh $VM $Z` |
| Effect | `gcloud` took the whole string as the zone value |

(The exact gcloud error text is not in the sources. Not verified.)

## Cause

```text
bash:  $Z  ─► split on spaces ─► two arguments
zsh:   $Z  ─► NOT split       ─► one argument "--zone=us-central1-a --tunnel-through-iap"
```

## Fix

```sh
Z=(--zone=us-central1-a --tunnel-through-iap)   # array: zsh does not split "$Z"
gcloud compute ssh $VM "${Z[@]}"
```

## Evidence

- `deploy/gcp/README.md` line 57: `Z=(--zone=us-central1-a --tunnel-through-iap)   # array: zsh does not split "$Z"`.
- Used in every `gcloud compute scp` and `ssh` of §2 and §8.

## Lesson

Keep several arguments in an array and expand it with `"${Z[@]}"`. This works in zsh and bash.
