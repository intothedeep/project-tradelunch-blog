# 7. Wrong certificate, then blocked hot reload

Result: fixed 2026-10-13. mkcert certificate plus `allowedDevOrigins`. Documented in `apps/dashboard_client_web/LOCAL_PROD_API.md` steps 3 and 5.

## Symptom

| Where | What |
| --- | --- |
| Browser | certificate warning `ERR_CERT_COMMON_NAME_INVALID` |
| Next's own cert | lists only `DNS:localhost`, IP `127.0.0.1`, `::1`, `0.0.0.0` |
| Dev server log | `Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "local.prettylog.com"` |

## Cause

```text
https://local.prettylog.com ─► Next --experimental-https cert
                                names: localhost, 127.0.0.1, ::1, 0.0.0.0
                                no local.prettylog.com ─► name mismatch

page loads, then HMR socket from host local.prettylog.com
   └─ not in allowedDevOrigins ─► dev server blocks it
```

- Two separate faults, both about the new host name.

## Fix

1. Use Next's cached mkcert to make a certificate that names the host.

```sh
MKCERT=$(ls ~/Library/Caches/mkcert/mkcert-* | head -1)
mkdir -p certificates
"$MKCERT" -key-file certificates/local-key.pem -cert-file certificates/local.pem \
  local.prettylog.com localhost 127.0.0.1
openssl x509 -in certificates/local.pem -noout -ext subjectAltName
```

2. Pass both flags: `--experimental-https-key certificates/local-key.pem --experimental-https-cert certificates/local.pem`.
3. In `next.config.ts` set `allowedDevOrigins: ['local.prettylog.com']`. Dev only, no effect on the prod build.

From the mkcert output on 2026-10-13: the cached tool was `mkcert-v1.4.4-darwin-arm64` and the certificate expires 13 January 2029. The runbook says "about two years".
`certificates/` is gitignored. Never commit it.

## Evidence

- `LOCAL_PROD_API.md` step 3 and the check table rows for `ERR_CERT_COMMON_NAME_INVALID` and `webpack-hmr`.
- Verify with `openssl x509 ... -ext subjectAltName`: it must list `DNS:local.prettylog.com`.

## Lesson

A new host name touches three places: the hosts file, the certificate and the dev-origin list.
