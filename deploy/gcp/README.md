# GCP deploy runbook: Express (`blog-api`) and Next (`blog-web`)

Express: sections 0–7 below. Next web: section 8 (same tarball, same steps, `web` in place of `api`).

Manual first deploy (task GCP-M2-9). Design: [`gcp.design.md`](../../gcp.design.md) §3.3–§3.4.
Decisions: `decisions.plan.md` #47–#54.

```text
GitHub Actions (gcp.yml) ──build──► artifact gcp-<sha>
        │ 1. gh run download            (your Mac)
        ▼
     your Mac ──2. gcloud compute scp --tunnel-through-iap──► VM ~/prettylog/
        ▼
     VM: 3. shared/api.env  4. release.sh api <sha> <tgz>  5. pm2 startup/save
        ▼
     6. checks: localhost:4000/ping → https://blog-api.prettylog.com/ping
```

Fixed values:

| Name | Value |
| --- | --- |
| VM | `instance-servers`, zone `us-central1-a`, user `tio_taek_lim` |
| App root on VM | `~/prettylog/` (`api/releases/<sha>/`, `api/current` → symlink, `shared/api.env`) |
| PM2 app | `blog-api`, `127.0.0.1:4000` (ecosystem sets `PORT`, `NODE_ENV`, `HOST_NAME`) |
| Public host | `blog-api.prettylog.com` (Cloudflare Tunnel → `localhost:4000`) |
| PM2 app (web) | `blog-web`, `localhost:3000` (ecosystem sets `PORT`, `NODE_ENV`, `HOSTNAME=localhost`) |
| Public host (web) | `my.prettylog.com` (same tunnel → `localhost:3000`) |

Always pass the user name to `gcloud`. Without it, `gcloud` logs in as your Mac user (`tio`),
which has no nvm, Node or PM2.

---

## 0. Before you start (one time)

- [ ] Firewall: inbound only `tcp:22` from `35.235.240.0/20` (IAP). No rule opens 3000/4000.
- [ ] VM: Node 24 via nvm, PM2 installed for `tio_taek_lim`, 4 GB swap.
- [ ] Cloudflare Tunnel: `blog-api.prettylog.com` → `http://localhost:4000`.
- [ ] A green `GCP build` run on GitHub Actions for the commit you deploy.

## 1. Pick the build and download it (your Mac)

```sh
cd ~/Documents/00_projects/project_tradelunch
gh run list --workflow=gcp.yml --limit 5        # pick a run with "success"
RUN=<run id>
SHA=$(gh run view $RUN --json headSha --jq .headSha)
gh run download $RUN -n gcp-$SHA -D x_gh_download   # repo-local, gitignored by x_*
ls x_gh_download                                     # api-$SHA.tgz  web-$SHA.tgz
```

## 2. Copy files to the VM (your Mac)

```sh
VM=tio_taek_lim@instance-servers
Z=(--zone=us-central1-a --tunnel-through-iap)   # array: zsh does not split "$Z"

gcloud compute ssh $VM "${Z[@]}" --command 'mkdir -p ~/prettylog/shared'
gcloud compute scp x_gh_download/api-$SHA.tgz \
  deploy/gcp/ecosystem.config.cjs deploy/gcp/release.sh \
  $VM:~/prettylog/ "${Z[@]}"
```

`ecosystem.config.cjs` and `release.sh` change rarely. Copy them again only when they change in git.

## 3. Write the secrets file (VM, first time or when a value changes)

```sh
gcloud compute ssh $VM "${Z[@]}"
vi ~/prettylog/shared/api.env
chmod 600 ~/prettylog/shared/api.env
```

One `KEY=VALUE` per line, no `export`. Copy the values from the old Vercel Express project
(Settings → Environment Variables). Never commit this file.

| Key | Value | If missing |
| --- | --- | --- |
| `POSTGRES_URL` | Supabase pooled URL (port `6543`) | no DB |
| `POSTGRES_URL_NON_POOLING` | Supabase direct URL (port `5432`) | direct queries fail |
| `CLERK_SECRET_KEY` | `sk_live_...` | every signed-in request → 401 |
| `ALLOWED_ORIGINS` | `https://my.prettylog.com` | default `''` → browser calls blocked by CORS |
| `STORAGE_PROVIDER` | `oci` | default `supabase` → uploads go to the wrong store |
| `STORAGE_ENDPOINT` · `STORAGE_ACCESS_KEY` · `STORAGE_SECRET_KEY` · `STORAGE_REGION` | OCI S3-compat values | image upload fails |
| `SITE_DOMAIN` · `APP_URL` | `https://my.prettylog.com` | default `http://localhost:3000` |
| `DEFAULT_USER_ID` | the value Vercel had | default `2` |

Do not set `PORT`, `NODE_ENV` or `HOST_NAME`: the ecosystem file sets them and wins.
`CDN_ASSETS` and `STORAGE_BUCKET` already default to prod values.

## 4. Release (VM)

```sh
cd ~/prettylog
chmod +x release.sh
SHA=<the full sha from step 1>
./release.sh api $SHA ~/prettylog/api-$SHA.tgz
```

What it does: unpacks into `api/releases/$SHA/` (via a temp dir, so a failed `tar` leaves
nothing half-done) → switches `api/current` atomically → `pm2 reload blog-api` (or
`pm2 start` the first time) → keeps the 3 newest releases and renames older ones to `x_<sha>`.

## 5. Survive reboots (VM, first time only)

```sh
pm2 startup systemd -u tio_taek_lim --hp /home/tio_taek_lim
# run the one sudo command it prints
pm2 save
```

Run `pm2 save` again after any new app starts. Re-run `pm2 startup` if you change the Node
version with nvm.

## 6. Check

On the VM:

```sh
pm2 ls                                  # blog-api  online
curl -s localhost:4000/ping             # "status":"ok"
pm2 logs blog-api --lines 50 --nostream # no DB / Clerk / storage errors
free -h                                 # record memory (gate GCP-M2-6)
```

From your Mac:

```sh
curl -sI https://blog-api.prettylog.com/ping | grep -iE '^HTTP|server'   # HTTP/2 200, server: cloudflare
curl -s 'https://blog-api.prettylog.com/v1/api/posts?limit=1' | head -c 300   # real post JSON
curl -m 5 http://<VM external IP>:4000/ping                               # must time out (firewall)
```

## 7. Cloudflare cache rules (decision #54, 4-a; once)

Caching → Cache Rules, in this order (a later rule overrides an earlier one):

| # | Expression | Action |
| --- | --- | --- |
| 1 | `(http.host eq "blog-api.prettylog.com" and http.request.method eq "GET")` | Eligible for cache · Edge TTL: Respect origin |
| 2 | `(http.host eq "blog-api.prettylog.com" and any(http.request.headers.names[*] eq "authorization"))` | Bypass cache |

Check (untested until now):

```sh
U='https://blog-api.prettylog.com/v1/api/posts?limit=1'
curl -sI "$U" >/dev/null; curl -sI "$U" | grep -i cf-cache-status                 # HIT
curl -sI -H 'Authorization: Bearer x' "$U" | grep -i cf-cache-status               # BYPASS or DYNAMIC
```

---

## 8. Web (`blog-web`)

```text
Mac: a. download ─► b. scp ─► VM: c. web.env (once) ─► d. release.sh web ─► e. checks (VM, then Mac)
```

The `gcp-<sha>` artifact holds both tarballs. A run that built the API also built the web.

**a. Download (Mac, repo root)**

```sh
gh run list --workflow=gcp.yml --limit 5        # pick a run with "success"
RUN=<run id>
SHA=$(gh run view $RUN --json headSha --jq .headSha)
ls x_gh_download/web-$SHA.tgz 2>/dev/null || gh run download $RUN -n gcp-$SHA -D x_gh_download
echo $SHA
```

**b. Copy (Mac)**

```sh
VM=tio_taek_lim@instance-servers
Z=(--zone=us-central1-a --tunnel-through-iap)
gcloud compute scp x_gh_download/web-$SHA.tgz $VM:~/prettylog/ "${Z[@]}"
# ecosystem.config.cjs / release.sh: copy again only when they changed in git
gcloud compute scp deploy/gcp/ecosystem.config.cjs deploy/gcp/release.sh $VM:~/prettylog/ "${Z[@]}"
```

**c. Secrets (VM, first time only)**

```sh
vi ~/prettylog/shared/web.env       # one line: CLERK_SECRET_KEY=sk_live_...
chmod 600 ~/prettylog/shared/web.env
```

| Key | Value | If missing |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | `sk_live_...` (same as `api.env`) | the Clerk middleware fails on every page |

`NEXT_PUBLIC_*` are baked in at build time (repo Variables in `gcp.yml`); do not put them here.
Do not set `PORT`, `HOSTNAME` or `NODE_ENV` either: the ecosystem file sets them and wins.

**d. Release (VM)**

```sh
cd ~/prettylog
SHA=<the full sha from a>
./release.sh web $SHA ~/prettylog/web-$SHA.tgz   # first time: pm2 start; later: pm2 reload
pm2 save                                         # keep blog-web across reboots
```

If only `ecosystem.config.cjs` changed (no new tarball):

```sh
pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-web --update-env
```

**e. Checks**

On the VM (every `curl` has a timeout, so nothing hangs):

```sh
pm2 ls                                                   # blog-web online, ↺ not climbing
pm2 env $(pm2 id blog-web | tr -dc '0-9') | grep HOSTNAME   # HOSTNAME: localhost
ss -ltnp | grep ':3000'                                  # 127.0.0.1:3000 (loopback only)
u=http://localhost:3000
curl -m 20 -s -o /dev/null -w 'page    %{http_code} %{time_total}s\n' $u/
curl -m 10 -s -o /dev/null -w 'static  %{http_code} %{time_total}s\n' $u/robots.txt
curl -m 10 -s -o /dev/null -w 'api-pub %{http_code} %{time_total}s\n' https://blog-api.prettylog.com/ping
pm2 logs blog-web --err --lines 40 --nostream            # no "Failed to proxy", no Clerk errors
free -h; vmstat 5 3                                      # memory gate: si column near 0
```

From the Mac:

```sh
curl -m 30 -s -o /dev/null -w 'my. %{http_code} %{time_total}s\n' https://my.prettylog.com/
curl -m 5 http://<VM external IP>:3000/                  # must time out (firewall)
```

Then in a browser: sign in on `https://my.prettylog.com` and write a test comment (delete it after).

| Result | Meaning |
| --- | --- |
| `page 200`, `my. 200` | done |
| `page 000` after 20 s, `static 200`, log `Failed to proxy` | Next proxies to itself: `HOSTNAME` is not `localhost` ([`web-self-proxy.md`](./web-self-proxy.md)) |
| `my. 500` at once, plain `Internal Server Error` | the middleware throws: read `pm2 logs blog-web --err` |
| `my. 502` | `blog-web` not running, or the tunnel route for `my.` is missing |

Roll back: `~/prettylog/release.sh web <older sha>` (pick one from `ls -1t ~/prettylog/web/releases`).

---

## Change a secret

```sh
vi ~/prettylog/shared/api.env
pm2 reload ~/prettylog/ecosystem.config.cjs --only blog-api --update-env
```

`pm2 reload blog-api` alone does not re-read the file.

## Roll back

```sh
ls -1t ~/prettylog/api/releases          # pick an older sha (not x_*)
~/prettylog/release.sh api <older sha>   # no tarball = switch back, then reload
```

## Troubleshooting

| Symptom | Look at |
| --- | --- |
| `https://blog-api.../ping` → 502 | app not running: `pm2 ls`, `curl localhost:4000/ping` |
| `530` / error 1033 | tunnel down: `sudo systemctl status cloudflared` |
| `pm2: command not found` over ssh | nvm not loaded: `source ~/.nvm/nvm.sh` (release.sh does this itself) |
| browser CORS error | `ALLOWED_ORIGINS` in `shared/api.env`, then reload with `--update-env` |
| restarts in a loop (`pm2 ls` ↺ climbing) | `pm2 logs blog-api`; memory cap is 200M (`max_memory_restart`) |
| `ZodError ... expected number, received NaN` | a numeric key in `api.env` (`MAX_FILE_SIZE`, `THUMBNAIL_*`, …) has a unit, a formula or a same-line `# comment`. Keep digits only, or delete the line to use the default. Then `pm2 restart ~/prettylog/ecosystem.config.cjs --only blog-api --update-env` (seen 2026-10-13) |
| web: `Failed to proxy http(s)://localhost:3000/` (hang, `EPROTO` or `ECONNREFUSED`) | `blog-web` must run with `HOSTNAME=localhost`; see [`web-self-proxy.md`](./web-self-proxy.md) |
| `[PM2][ERROR] Process or Namespace ecosystem not found` | a bare `ecosystem` works only inside `~/prettylog`; use the full path `~/prettylog/ecosystem.config.cjs` |
| `injected env (0) from .env…` in the out log | harmless: dotenv finds no `.env*` in the release dir; PM2 supplies the env |
