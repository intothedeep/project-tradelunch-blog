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
[ ] 5. Weekly auto check   a weekly issue with HIT ratios     Claude builds
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

## 5. Weekly auto check (Claude builds)

- Extends `.github/workflows/logging-review.yml`.
- Once a week it runs `_scripts/cloudflare/traffic-check.sh` and opens an issue with the results.
- Not built yet. It starts after steps 2 and 3 pass.

## Purge after a new post

The cache holds pages for a day, so a new post can be invisible for a while.
Purge everything once after you publish:

```sh
./_scripts/cloudflare/cf-purge.sh
```

Or use the dashboard: Caching → Configuration → Purge Everything.
Purge both hosts together. If you purge only the HTML, the page refills from the old API answer.
