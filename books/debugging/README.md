# Debugging casebook

Fifteen real cases from 2026-10-13 and 2026-10-14, each with symptom, cause, fix and evidence.
Result: 12 fixed, 1 open (chapter 3, the missing thumbnail on the CDN), 1 needed no fix (chapter 13), 1 fixed but unmeasured in bytes (chapter 15).
Chapter 14 holds two cases (14.1 fixed in `753c2c9`; 14.2 fixed in `11b3023`) plus a toolkit.

## What this book is

Purpose: teach the method behind the fixes, using cases from this repo.

| Part | File |
| --- | --- |
| General method | [`00-method.md`](./00-method.md) |
| Fifteen cases | `01-...md` to `15-...md` |

Sources are the repo runbooks and code named in each chapter.
No secret value appears in the book. Key names appear, key values never.

## Index

| # | Chapter | Symptom (one line) | Root cause (one line) | Fix | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | [`01-web-self-proxy.md`](./01-web-self-proxy.md) | Page hangs 20 s, `/robots.txt` is 200 | Next router origin `127.0.0.1` differs from middleware URL `localhost`, so Clerk's rewrite looks external | `3a6463a`, `HOSTNAME: 'localhost'` | fixed |
| 2 | [`02-feed-unreachable.md`](./02-feed-unreachable.md) | API down sends the whole home page to the error page | `getFeed` threw `TypeError: fetch failed` with no guard | `77315eb` | fixed |
| 3 | [`03-relative-image-404.md`](./03-relative-image-404.md) | Post page shows the error page | Relative image ref hits the post route, API says 404, code rethrew a generic Error | `42ba55c` (page). Content bug open | page fixed, content open |
| 4 | [`04-clerk-dev-keys-401.md`](./04-clerk-dev-keys-401.md) | Local web gets 401 from the prod API | Token from the Clerk dev instance, API verifies with the live key | mode C in `LOCAL_PROD_API.md` (`cc5aead`) | fixed |
| 5 | [`05-clerk-origin-port.md`](./05-clerk-origin-port.md) | Clerk: "Production Keys are only allowed for domain" | Origin had port `:3000` | serve on 443 | fixed |
| 6 | [`06-bind-eacces-443.md`](./06-bind-eacces-443.md) | `listen EACCES ... 127.0.0.1:443` | macOS lets a normal user bind low ports only on `0.0.0.0` | `-H 0.0.0.0` | fixed |
| 7 | [`07-certificate-and-hmr.md`](./07-certificate-and-hmr.md) | Certificate warning, then blocked HMR | Next's cert lacks the host, `allowedDevOrigins` lacks the host | mkcert cert, `allowedDevOrigins` | fixed |
| 8 | [`08-cors-preflight-500.md`](./08-cors-preflight-500.md) | Preflight returns 500, no CORS headers | Origin missing from the running `ALLOWED_ORIGINS`, restart used a bare name | full ecosystem path, `--update-env` | fixed |
| 9 | [`09-blog-api-crash-loop.md`](./09-blog-api-crash-loop.md) | `blog-api` restarts in a loop (↺15) | A numeric key in `api.env` held a non-numeric value | digits only | fixed |
| 10 | [`10-zsh-word-splitting.md`](./10-zsh-word-splitting.md) | `gcloud` takes the whole string as the zone | zsh does not split an unquoted string variable | array `Z=(...)` | fixed |
| 11 | [`11-wif-auth-token-refresh.md`](./11-wif-auth-token-refresh.md) | setup-gcloud: "problem refreshing your current auth tokens" | STS and IAM Credentials APIs were off | `gcloud services enable ...` | fixed |
| 12 | [`12-pnpm-exec-next-not-found.md`](./12-pnpm-exec-next-not-found.md) | `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` | `next` is not installed at the repo root | `pnpm --filter ... exec` | fixed |
| 13 | [`13-stale-error-log-etimedout.md`](./13-stale-error-log-etimedout.md) | pm2 error log shows `ETIMEDOUT` after a release | The lines are old (last write 20:57:17 UTC, before the release). Cause of the old timeouts unknown | none needed | no fix needed |
| 14 | [`14-blog-agent-publish.md`](./14-blog-agent-publish.md) | 14.1 publish fails `[Errno 51]` to an IPv6 address. 14.2 top image broken after a re-publish | 14.1 direct DB host is IPv6-only, no IPv6 route. 14.2 OG webp written into the post folder, then picked as thumbnail | 14.1 pooled `POSTGRES_URL` first + asyncpg cache off (`753c2c9`). 14.2 OG webp to `<post>/.generated/` (`11b3023`) | fixed |
| 15 | [`15-traffic-overrun.md`](./15-traffic-overrun.md) | Vercel 402 (2026-09-22), then request bursts behind Cloudflare (2026-10-13) | 16 causes: cache leaks, no edge cache, prefetch bursts, duplicate fetches | `d094859`, `c21e53c`, Cache Rules, `34e2080`, `61d48bc`, `964c9f8` and others | fixed in part. Bytes, GB and money never measured |

## How to read a chapter

Each chapter keeps one order.

| Section | Question it answers |
| --- | --- |
| Result | Is it fixed? Which commit or file? |
| Symptom | Where did it show, and what exact text? |
| Cause | Why? A diagram first, then a short list |
| Fix | Which command or diff? |
| Evidence | Which source line or measured output proves it? |
| Lesson | What do I carry to the next fault? |

A line marked "not verified" was given in the task brief and is not in a repo source.
