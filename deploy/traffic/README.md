# Traffic controls: 5 steps

Goal: Cloudflare answers public traffic, so the VM and the bill stay small.
This is the short form of [`traffic.design.md`](../../traffic.design.md) (controls C1–C14, Phase TC in `00.tasks.md`).
Rate limit, spike test and decisions D1–D10 wait until these 5 steps are done.
Open decisions follow the design's recommendations unless the owner says otherwise.

## Progress

```text
[x] 1. Web request log     who reaches the VM                 done 2026-10-13
[x] 2. Web cache rules     Cloudflare answers pages           done 2026-10-13
[x] 3. API cache rules     Cloudflare answers API GETs        done 2026-10-13
[x] 4. Alerts              mail when money or memory is high  done 2026-10-13
[x] 5. Weekly auto check   a weekly issue with cache checks   done 2026-10-13
[x] 6. Web rate limit      cap one IP on my.                  done 2026-10-13 (429 verified; 100 → 50 / 10 s, #68)
```

| Step | Protects | Who | Done when |
| --- | --- | --- | --- |
| 1 | analysis | done | requests show in Cloud Logging (`deploy/logging/README.md` "Query the web log") |
| 2 | VM overload, egress cost | owner → Claude measures | the second GET of `/` is `HIT` |
| 3 | VM overload, Supabase load | owner → Claude measures | the second GET of an API URL is `HIT` |
| 4 | the bill | owner | the budget and the alert policy exist |
| 5 | it keeps working | Claude | a weekly issue shows HIT ratios |

Tick a box here when its "done when" check passes. Write the date.

## Rule order

```text
Cloudflare → prettylog.com → Caching → Cache Rules

  1. web cache     Eligible, 1 day
  2. web bypass    Bypass            ← below "web cache": a later rule overrides an earlier one
  3. api cache     Eligible, respect origin
  4. api bypass    Bypass            ← below "api cache"
```

- Create the bypass rule first. Otherwise a signed-in page can be cached for a day.
- A new rule goes to the end of the list. Drag "web bypass" below "web cache" after both exist.

## 2. Web cache rules (`my.prettylog.com`)

**a. "web bypass": signed-in users and private pages skip the cache**

Expression (Edit expression):

```text
(http.host eq "my.prettylog.com" and (
  http.cookie contains "__session"
  or starts_with(http.request.uri.path, "/write")
  or starts_with(http.request.uri.path, "/me")
  or starts_with(http.request.uri.path, "/settings")
  or starts_with(http.request.uri.path, "/admin")
  or starts_with(http.request.uri.path, "/onboarding")
  or (starts_with(http.request.uri.path, "/@") and ends_with(http.request.uri.path, "/saved"))
  or (starts_with(http.request.uri.path, "/@") and ends_with(http.request.uri.path, "/me"))
  or (any(http.request.headers.names[*] eq "rsc") and not http.request.uri.query contains "_rsc=")
))
```

| Field | Value |
| --- | --- |
| Cache eligibility | Bypass cache |

- The path list must match `isProtectedRoute` in `apps/dashboard_client_web/proxy.ts`. Change both together.
- `contains "__session"` also matches Clerk's `__session_<suffix>` cookies.
- Do not bypass on `__client_uat`. Every visitor gets it (CF2 MUST 2).
- The `rsc` line: an in-app navigation without `_rsc=` must not share a key with the HTML page.

**b. "web cache": every other page for 1 day**

```text
(http.host eq "my.prettylog.com" and http.request.method eq "GET"
  and not starts_with(http.request.uri.path, "/_next/")
  and not starts_with(http.request.uri.path, "/api/"))
```

| Field | Value |
| --- | --- |
| Cache eligibility | Eligible for cache |
| Edge TTL | Ignore cache-control header and use this TTL: 1 day |
| Status code TTL (if shown) | 200 only: 1 day |
| Browser TTL | Respect origin |
| Cache key | keep the full query string (default) |

- This rule also covers `/sitemap.xml`, `/robots.txt` and the OG images.
- `/_next/static` is already `HIT` without a rule.
- If "Status code TTL" is not on the Free plan: an error page can be cached for a day. Purge fixes it (below).

**c. Check (Claude runs it after "했어")**

Use GET, not HEAD (`curl -I`). HEAD answers differ from GET.

```sh
h(){ curl -s -o /dev/null -D - "$@"; }
W=https://my.prettylog.com

h "$W/" >/dev/null; h "$W/" | grep -iE '^cf-cache-status|^age'       # HIT, age > 0
h -H 'Cookie: __session=x' "$W/" | grep -i '^cf-cache-status'          # BYPASS or DYNAMIC
h "$W/me" | grep -i '^cf-cache-status'                                 # BYPASS or DYNAMIC
h -H 'rsc: 1' "$W/?_rsc=check1" | grep -iE '^cf-cache-status|^content-type'   # text/x-component
h -H 'rsc: 1' "$W/" | grep -i '^cf-cache-status'                       # BYPASS or DYNAMIC
h "$W/" | grep -ic '^set-cookie'                                       # 0
```

| Result | Meaning |
| --- | --- |
| second `/` is `HIT` | pass |
| `/` stays `DYNAMIC` | "web cache" is off, or its expression is wrong |
| `__session` or `/me` gives `HIT` | fail: turn "web cache" off now, then check the rule order |
| `?_rsc=` gives `text/html` | fail: the RSC payload and the HTML share a key |
| `set-cookie` count is not 0 | fail: a cached page would hand one visitor's cookie to others |

Measured 2026-10-13 (rules on): `/` MISS then HIT, `/blog`, `/robots.txt`, `/sitemap.xml` HIT, `__session` and `__session_abc` DYNAMIC, `/me` 307 DYNAMIC, `?_rsc=` `text/x-component` HIT, `rsc` without `_rsc=` DYNAMIC, `set-cookie` 0, 404 REVALIDATED (not served from cache).

Fixed 2026-10-13: zone Browser Cache TTL was 4 h (`private, max-age=14400` on cached HTML, and a purge does not clear a browser). Set to Respect Existing Headers. Now cached HTML is `HIT` with the origin `private, no-store`, and `/_next/static` keeps `max-age=31536000, immutable`.

## 3. API cache rules (`blog-api.prettylog.com`)

**a. "api bypass" (create first)**

```text
(http.host eq "blog-api.prettylog.com" and any(http.request.headers.names[*] eq "authorization"))
```

Cache eligibility: Bypass cache.

**b. "api cache"**

```text
(http.host eq "blog-api.prettylog.com" and http.request.method eq "GET")
```

Cache eligibility: Eligible for cache. Edge TTL: Respect origin (Express sends `s-maxage`).

Then drag "api bypass" below "api cache".

**c. Check**

```sh
U='https://blog-api.prettylog.com/v1/api/posts?limit=1'
h "$U" >/dev/null; h "$U" | grep -iE '^cf-cache-status|^age'           # HIT
h -H 'Authorization: Bearer x' "$U" | grep -i '^cf-cache-status'       # BYPASS or DYNAMIC
h https://blog-api.prettylog.com/ping >/dev/null
h https://blog-api.prettylog.com/ping | grep -i '^cf-cache-status'     # not HIT (no Cache-Control)
```

| Result | Meaning |
| --- | --- |
| second posts GET is `HIT` | pass |
| `Authorization` request gives `HIT` | fail: turn "api cache" off now |
| `/ping` gives `HIT` | Cloudflare caches responses without Cache-Control: decide D3 in the design |

Measured 2026-10-13 (rules on, edge TTL "use cache-control if present, else bypass"): `posts?limit=1` MISS then HIT, `Authorization` DYNAMIC, `/ping` BYPASS (no Cache-Control, so R8 is closed), `/users/me` 401 and a 404 EXPIRED (not served from cache), `set-cookie` 0, OPTIONS 204 DYNAMIC. CORS: `Origin: my.` and `Origin: local.` both HIT, each with its own `access-control-allow-origin`.

## 4. Alerts

```text
a. budget (done 2026-10-13)      1 account ID ─► 2 enable API ─► 3 create ─► 4 check
b. memory alert (done 2026-10-13) 0 components ─► 1 email channel ─► 2 policy ─► 3 check
```

Run on the Mac, repo root. Email only. Nothing shuts down automatically.

### a. Budget: `prettylog-monthly`, 10 USD, 50 / 90 / 100 % (done 2026-10-13)

The console form would not take "All services" ("Please select a service"). So it was made with `gcloud`.
No service filter means all services.

**1. Find the billing account ID**

```sh
gcloud billing accounts list          # use the ACCOUNT_ID column
```

- Never write the account ID into this repo. It is public.

**2. Enable the budget API (once)**

```sh
gcloud services enable billingbudgets.googleapis.com
```

**3. Create the budget**

```sh
BA=<ACCOUNT_ID>
P=$(gcloud config get-value project)  # must be the VM project: echo $P
gcloud billing budgets create \
  --billing-account=$BA \
  --display-name=prettylog-monthly \
  --budget-amount=10USD \
  --filter-projects=projects/$P \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0
```

| Option | Meaning |
| --- | --- |
| `--budget-amount` | the monthly limit |
| `--filter-projects` | count this project only |
| `--threshold-rule` | email at 50 %, 90 %, 100 % of the limit |
| no service option | all services |

- Credits are subtracted (default). The alert follows the amount that will be billed.
- Email goes to the billing account admins and users (default).

**4. Check**

```sh
gcloud billing budgets list --billing-account=$BA \
  --format='table(displayName,amount.specifiedAmount.units,thresholdRules)'
# prettylog-monthly  10  [... 0.5 ... 0.9 ... 1.0]
```

| Error | Fix |
| --- | --- |
| `PERMISSION_DENIED` | log in as the billing account owner: `gcloud auth login` |
| `SERVICE_DISABLED` | run step 2 |

### b. Memory alert: memory used above 90 % for 5 minutes (done 2026-10-13)

Policy file: [`memory-alert.json`](./memory-alert.json). Metric: `agent.googleapis.com/memory/percent_used`, state `used` (from the Ops Agent).

**0. Prerequisites (once per Mac)**

The channel and policy commands live in the gcloud `beta` and `alpha` components.

```sh
gcloud components install beta alpha
gcloud components list --filter='id:(alpha beta)' --format='table(id,state.name)'
# alpha  Installed (or "Update Available": also installed)
```

- After the install, gcloud may run `brew install python@3.13`. It is optional. Ctrl+C is safe there: the components are already in (seen 2026-10-13).
- gcloud picks the first `python3` on PATH when `CLOUDSDK_PYTHON` is unset. Here that is pyenv 3.13.12.
- A `.python-version` or a venv in another folder can change it. Pin it:

```sh
echo 'export CLOUDSDK_PYTHON=$HOME/.pyenv/versions/3.13.12/bin/python3.13' >> ~/.zshrc
source ~/.zshrc
gcloud info --format='value(basic.python_location,basic.python_version)'
# /Users/<you>/.pyenv/versions/3.13.12/bin/python3.13  3.13.12 ...
```

- If pyenv drops 3.13.12, change this path too.

**1. Create an email channel (once)**

```sh
cd ~/Documents/00_projects/project_tradelunch   # repo root: the policy path is relative
read 'EMAIL?email: '                  # typed, not saved in a file
echo $EMAIL                           # not empty
gcloud beta monitoring channels create --display-name=owner-email --type=email \
  --channel-labels=email_address=$EMAIL
CH=$(gcloud beta monitoring channels list --filter='displayName="owner-email"' --format='value(name)')
echo $CH                              # projects/.../notificationChannels/<id>
```

- Run the create line once. A second run makes a second `owner-email`. Then `echo $CH` prints two lines and the policy command fails. Put one of them in `CH` by hand.

**2. Create the policy**

```sh
gcloud alpha monitoring policies create \
  --policy-from-file=deploy/traffic/memory-alert.json \
  --notification-channels=$CH
```

**3. Check**

```sh
gcloud alpha monitoring policies list --format='table(displayName,enabled)'
# VM memory used > 90%  True
```

- Verified 2026-10-13: `VM memory used > 90%`, enabled, 1 notification channel (`owner-email`).
- No deliberate breakage here. The VM has 1 GB. Filling it on purpose risks the live site.
- Today's level: 35–57 % (`_scripts/gcp/vm-metrics.sh`, 2026-10-13).

## Monitoring commands

Run from the Mac, repo root, unless a line says VM. All are read-only.

| Question | Command | Where |
| --- | --- | --- |
| Are the cache rules still right? | `./_scripts/cloudflare/traffic-check.sh` | Mac |
| How full is VM memory? How much leaves the VM? | `./_scripts/gcp/vm-metrics.sh 7` | Mac |
| Who reaches the VM (paths, bots, countries)? | queries in [`deploy/logging/README.md`](../logging/README.md) "Query the web log" | Mac |
| What is live right now? | `free -m`, `pm2 ls`, `pm2 monit` | VM |
| How much has the month cost? | https://console.cloud.google.com/billing → Reports | browser |
| What share does Cloudflare answer? | Cloudflare → prettylog.com → Analytics & Logs → Traffic / Caching | browser |

**1. Cache rules: `./_scripts/cloudflare/traffic-check.sh`**

- Runs the step 2 and step 3 checks. About 20 GET requests.
- Prints one `PASS` or `FAIL` line per check. Exit code 1 if any check fails.

```text
== web (https://my.prettylog.com)
PASS  GET / (2nd)                        HIT
PASS  __session cookie                   DYNAMIC
...
== api (https://blog-api.prettylog.com)
PASS  GET posts?limit=1 (2nd)            HIT
PASS  Authorization header               DYNAMIC
== 0 FAIL
```

| Line | Meaning |
| --- | --- |
| `GET ... (2nd)` is `FAIL` with `DYNAMIC` | a cache rule is off or its expression changed |
| `__session`, `/me`, `Authorization` is `FAIL` with `HIT` | private answers are cached: turn "web cache" or "api cache" off now |
| `HTML browser cache-control` is `FAIL` | the zone Browser Cache TTL is no longer "Respect Existing Headers" |

- Verified 2026-10-13: 14 PASS. With `W=https://blog-api.prettylog.com` (wrong host on purpose) the web checks print `FAIL`.

**2. Memory and egress: `./_scripts/gcp/vm-metrics.sh [days]`**

- Reads Cloud Monitoring through its API. Needs `gcloud auth login` and `jq`.
- Memory: the highest value per hour. The alert fires above 90 %.
- Egress: bytes the VM sent per day. Cloudflare `HIT` answers are not in it.

```text
== memory used, max per hour (alert at 90 %)
2026-10-13T19:37:01Z  53.6 %
...
== VM egress per day (Cloudflare MISS answers + SSR calls)
2026-10-13T19:37:03Z  314 MiB
```

| Reading | Meaning |
| --- | --- |
| memory near 90 % for hours | PM2 caps or swap need a look (`traffic.design.md` C9) |
| egress rises while traffic is flat | cache is missing: run `traffic-check.sh` |
| egress rises with traffic | expected. Compare with the budget |

**3. VM, live (`gcloud compute ssh`)**

```sh
free -m                               # "available" column; below ~100 MiB is tight
pm2 ls                                # status online, restarts not climbing
pm2 monit                             # live CPU and memory per app; q to quit
vmstat 5 3                            # si/so above 0 = swapping
```

## 5. Weekly auto check

- Workflow: `.github/workflows/logging-review.yml`, every Monday 14:17 UTC, or by hand: `gh workflow run logging-review.yml`.
- Step `cache` runs `_scripts/cloudflare/traffic-check.sh` on a GitHub runner. No secret is needed.
- The weekly issue gets one line: `Cloudflare cache rules: OK (14 PASS, 0 FAIL).`
- On a FAIL the title gets ⚠️ and the issue lists each FAIL line.
- A HIT check tries 4 times. A runner can reach a different Cloudflare cache server per connection (first run 2026-10-13: 2 false MISS).
- 🚨 appears only when a private answer (`__session`, `/me`, `Authorization`) comes back `HIT`.
- Its lines are public URLs and cache headers only, so they may go into the public issue.
- Not in it yet: weekly egress from `vm-metrics.sh`. The workflow account needs `roles/monitoring.viewer` first (IAM change, owner decision D7).

## 6. Web rate limit (Cloudflare, decision #62)

Why: the cache rules stop anonymous GETs only. Requests that miss the cache (signed-in pages, POST, a new query string each time) reach the 1 GB VM. This rule caps one IP on `my.`.
Design: `traffic.design.md` §7.4.1–§7.4.2. The numbers are provisional until 14 days of logs (§7.4.4).

**a. Read the Free plan values first (RL-0)**

Cloudflare → prettylog.com → Security → WAF → Rate limiting rules → Create rule. Do not save yet. Note what the form offers:

| Item | Design assumes | Write what you see |
| --- | --- | --- |
| rules allowed | 1 | |
| counting characteristics | IP only | |
| period choices | 10 s | |
| mitigation timeout choices | 10 s | |
| actions | Block, Managed Challenge | |
| fields in the expression | `http.host`, `http.request.uri.path`, `cf.client.bot` | |
| response code | 429 | |

- If `cf.client.bot` is not offered: drop that line only.
- If `http.host` is not offered: stop and tell Claude (the rule would also hit `blog-api.`).

**b. Create "web rate limit" (RL-2)**

```text
(http.host eq "my.prettylog.com" and not starts_with(http.request.uri.path, "/_next/") and not cf.client.bot)
```

| Field | Value |
| --- | --- |
| Rule name | `web rate limit` |
| Counting | per IP |
| Requests | 50 (was 100; decision #68, 2026-10-13) |
| Period | 10 seconds |
| Action | Block |
| Duration | 10 seconds |

- Block, not Challenge: in-app navigation (RSC) and `fetch` cannot solve a challenge page.
- Not on `blog-api.`: Next SSR calls all come from the VM's one IP. Counting them by IP would block the site itself.
- Off switch: the rule's toggle in the list.

**c. Check (Claude)**

- Normal browsing still works (open `/`, a post, sign in).
- A capped burst trips it once (set L3-cf, after the load-test workflow exists: `traffic.design.md` §10).

## Purge after a new post

The cache holds pages for a day, so a new post can be invisible for a while.
Purge everything once after you publish:

```sh
./_scripts/cloudflare/cf-purge.sh
```

Or use the dashboard: Caching → Configuration → Purge Everything.
Purge both hosts together. If you purge only the HTML, the page refills from the old API answer.

Purge also after **every web release** (`deploy/gcp/README.md` §8 d2). Old cached HTML
points at old JS, so the new code does not reach browsers until the purge
(2026-10-13: a release looked like it did nothing because `age: 13671` HTML was served).

## Purge token setup (one time, 2026-10-13)

Why: `cf-purge.sh` reads its token from `_scripts/cloudflare/.env`. Without the file it
stops with `CLOUDFLARE_API_TOKEN: set CLOUDFLARE_API_TOKEN`.
Why a custom token: it can purge the cache and nothing else. A leaked token cannot change
DNS or rules. Do not use the Global API Key (it has the whole account).

### a. Create the token (dashboard)

1. Top-right person icon → **My Profile** → **API Tokens**.
2. **Create Token**.
3. At the bottom: **Custom token** → **Get started**.
4. **Token name**: `prettylog-cache-purge`.
5. **Permissions**, one row:

   | Field 1 | Field 2 | Field 3 |
   | --- | --- | --- |
   | `Zone` | `Cache Purge` | `Purge` |

6. **Zone Resources**, one row:

   | Field 1 | Field 2 | Field 3 |
   | --- | --- | --- |
   | `Include` | `Specific zone` | `prettylog.com` |

7. Leave **Client IP Address Filtering** and **TTL** empty.
8. **Continue to summary** → **Create Token**.
9. The token shows **once**. Copy it now.

### b. Find the Zone ID

1. Left menu **Domains** → `prettylog.com`.
2. **Overview** page, scroll down.
3. **API** box → copy button next to **Zone ID** (on a wide screen it is in the right column).

### c. Write the env file (Mac, repo root)

```sh
vi _scripts/cloudflare/.env
```

Two lines, no leading spaces, no `<>`:

```
CLOUDFLARE_API_TOKEN=<the token>
CLOUDFLARE_ZONE_ID=<the zone id>
```

- The file is gitignored (`*.env`). Never paste the token into chat, an issue or a commit.

### d. Check

```sh
./_scripts/cloudflare/cf-purge.sh --dry-run    # shows what would be sent
./_scripts/cloudflare/cf-purge.sh              # purge everything
curl -s -o /dev/null -D - https://my.prettylog.com/ | grep -iE "cf-cache-status|^age"   # MISS, or a small age
```

Sources (checked 2026-10-13):
[Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/),
[API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/),
[Find account and zone IDs](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/),
[Invalidate cached content](https://developers.cloudflare.com/cache/guides/invalidate-cache/).
