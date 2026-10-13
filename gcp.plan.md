# Phase GCP — hosting move off Vercel (plan detail)

> Split from `PLAN.md` (rules/docs.md §1). The PLAN.md stub is the truth if
> the two disagree; update both in the same edit.

> Split parent: `00.plan.md` "Phase GCP" stub (it holds the mission block, §0.1).
> Design source: `gcp.design.md` rev5 (system-architect). Atomic rows + AC: `00.tasks.md` Phase GCP.
> Decisions: `decisions.plan.md` #47–#53; OPEN: CF2-4 `blog-api.` cache rule (4-a/4-c) → #54.
> State (2026-10-12): 31 live rows, 4 done, 27 open, 6 struck. Both hostnames already route to the tunnel; CF 502 = origin not running.

---

## Scope

- Move `my.prettylog.com` (Next) and `blog-api.prettylog.com` (Express) from Vercel to one GCP
  e2-micro VM in us-central1 (#47, #48, #49).
- Ingress = 1 Cloudflare Tunnel (`cloudflared.service`) + 2 public hostnames: `my.prettylog.com` → `localhost:3000`,
  `blog-api.prettylog.com` → `localhost:4000` (#51). Outbound-only; VM inbound all denied except IAP ssh tcp:22.
  Express binds 0.0.0.0 (`apps/dashboard_server/src/index.ts:18`), so the firewall blocks tcp:3000/4000.
- Runtime = PM2 apps `blog-api` / `blog-web` (fork, 1 instance, `max_memory_restart`); `pm2 startup` + `pm2 save`
  for reboot; release dirs + `current` symlink + `pm2 reload`; secrets in `~/prettylog/shared/*.env` (chmod 600).
  No Docker, no images, no Artifact Registry (#52; `gcp.design.md` §3.4).
- SSR and browser both call `NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com` (#53); GCP-D1 stays DEFERRED.
- Unchanged: schema (`packages/db/schema/tradelunch.schema.sql`), `/v1/api/*` envelope, env names,
  Supabase DB, OCI images, Clerk Production instance, CF2 MUST ①–③ (`gcp.design.md` §0, §5).
- Builds run in GitHub Actions only: Next standalone tarball + Express `pnpm deploy --prod` tarball. Never
  `pnpm install` or `next build` on the VM or locally (`~/.claude/CLAUDE.md` "No local execution"; `gcp.design.md` §3.4).
- First deploy = owner manual IAP scp (GCP-M2-9); later = GH Actions + WIF (GCP-M3-7, after O5).
- Agents write files only. The main session or the owner runs every ssh, deploy and curl
  (`gcp.design.md` §6.1).

## Milestones (MVP ladder; exit criteria are the gate, reviewer checks them)

| M | Rung | Exit (runnable) | Rows |
| --- | --- | --- | --- |
| M1 | MVP1 deployment contract | In a GH Actions job, 2 tarballs (§3.4) build. The job unpacks them in a new dir and starts, without secrets, `node dist/src/index.js` (PORT=4000) and `node server.js` (PORT=3000): `/ping` (api) and `/robots.txt` (web) → 200; the job checks `dist/` in the `pnpm deploy` output. No local build (`gcp.design.md` rev5 §5 MVP1 exit) | GCP-M1-2, M1-4, M1-5 (M1-1, M1-3 struck) |
| M2 | MVP2 one real slice = Express | `curl -sI https://blog-api.prettylog.com/ping` → 200 + `server: cloudflare`, origin = tunnel hostname `blog-api.` → `localhost:4000`; CF2-4 rule AC met; §3.1 memory gate read and recorded | GCP-M2-1, M2-4..9 (M2-2, M2-3 struck) |
| M3 | MVP3 Next migrated | `curl -sI https://my.prettylog.com` → 200 + `server: cloudflare`, origin = tunnel hostname `my.` → `localhost:3000`; CF2-1/2/3 AC met; a post publishes via Server Actions | GCP-M3-2..7 (M3-1 struck) |

Why Express first: `listen()` + SIGTERM exist (`apps/dashboard_server/src/index.ts:18,24`), no ISR
state, smallest artifact; proves Supabase pooler SSL, OCI upload (sharp) and Clerk token checks from GCP
egress before Next moves (`gcp.design.md` §5 MVP2).

Note: `output: 'standalone'` (design §2 #17) is needed in M1, not M3, because the M1 exit runs the
web tarball. Design §5 MVP3 restates it; the M1 row carries it.

## Tactic: memory gate (kill condition, pre-registered in design §3.1)

- Method: on the VM, read Express-only RSS (M2-4), then RSS + swap with Next added (M2-6).
- Kill: sustained swap-in under normal load, OR p95 > 2 s at CF MISS. Criterion = DRAFT until owner O13.
- On kill: switch to listed alternative A-FH, then A-LB (#48). A switch needs a new decision row.

## Owner inputs (`gcp.design.md` §7)

| # | Item | State | Row |
| --- | --- | --- | --- |
| O1 | strategy | DONE B (#48) | — |
| O2, O4 | GCP project id; billing + budget alert amount (G2) | open | GCP-U3 |
| O3 | region us-central1 DONE (#49); Supabase project region | open (Supabase part) | GCP-U2 |
| O5, ~~O6~~ | deploy executor (1st = owner manual IAP scp; later GH Actions + WIF); ~~Artifact Registry repo name~~ <!-- O6 DROPPED 2026-10-12 by #52 --> | O5 open; O6 DROPPED (#52) | GCP-U4 |
| O7, O10 | Cloudflare plan (Free assumed) + DNS edit right; Clerk instance unchanged | open | GCP-U11 |
| O8 | `blog-api.` cache rule (CF2-4: 4-a / 4-c; 4-b impossible); today = 4-c de facto (proxied, no rule) | OPEN decision → #54 | CF2-4 |
| O9 | secret values into ~~the VM root-only env file~~ <!-- SUPERSEDED 2026-10-12 by #52 --> `~/prettylog/shared/api.env` + `web.env` (chmod 600) | open | GCP-U10 |
| O11 | Mission sentence, G1 date, G2 amount | open | GCP-U1 |
| O12 | accept VM OS patching + IAP ssh deploy | open | GCP-U5 |
| O13 | approve §3.1 gate criterion | open | GCP-U9 |
| O14 | Zero Trust (Free) + ~~2 tunnels + 2 tokens on VM~~ <!-- SUPERSEDED 2026-10-12 by #51 --> 1 tunnel, `/etc/cloudflared/token`, `cloudflared.service`, 2 hostnames | DONE 2026-10-12 (owner, #51) | GCP-U12 (U6 struck) |
| O15 | outbound: 2-a external IP kept (recommended) / 2-b Cloud NAT | open | GCP-U7 |
| O16 | when to swap Vercel DNS records for tunnel hostnames | DONE 2026-10-12: `blog-api.` 2026-10-12, `my.` 2026-10-12 (owner swapped both before any origin ran; CF 502) | GCP-U8 |
| O17 | SSR direct call (`API_INTERNAL_BASE`) | DONE 2026-10-12 (#53): owner "use only NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com" for browser and SSR; GCP-D1 DEFERRED | GCP-U13 |
| O18 | ops-agent (~103 MB) keep / disable | open (owner: "wait for now", 2026-10-12) | GCP-U14 |
| O19 | VM `uname -m` / `ldd --version` / `node -v` | DONE 2026-10-12 (owner): `x86_64`; glibc 2.39 (`Ubuntu GLIBC 2.39-0ubuntu8.9`); `v24.21.0` | GCP-U15 |

## Open questions (for system-architect, rev4)

- Q1: design §3.1 says 2 GB swap; owner set 4 GB (#48). Design text to update.
- Q2: M2-6 p95 "at CF MISS" for Next cannot go through Cloudflare before `my.` cutover. Name the
  measurement path (localhost curl inside IAP ssh, or a temporary tunnel hostname).
- Q3: deferred row GCP-D1 (SSR → Express without the Cloudflare hairpin). `apis/http.server.ts:46`
  calls `${API_BASE}`, and `API_BASE` = `NEXT_PUBLIC_API_BASE` (`env.schema.ts:87`), baked at build.
  A direct call needs a new server-only env. Inside compose, `127.0.0.1` is the web container itself,
  not the host, so the target is the compose service name (e.g. `blog-api:4000`) or host networking.
- Q4: design §0 holds a draft mission block; §0.1 puts the block in `00.plan.md` only. Design should
  quote it from there.
- Status 2026-10-12: Q1 resolved (rev4 §3.1: 4 GB). Q2 resolved (rev4 §3.1: temporary hostname
  `stg-my.prettylog.com`). Q3 premise is wrong after #52 (no compose; loopback is correct, rev5 §3.3);
  the question itself closed by owner #53. Q4 resolved (rev4 §0 quotes `00.plan.md`).
- Q5 (open, architect): `my.` already routes to `localhost:3000` (GCP-U12). Starting PM2 `blog-web` for the
  GCP-M2-6 memory gate makes `my.` public before CF2-2/3 rules. Is that acceptable (Next sends
  `private, no-store`; CF default does not cache HTML), or should the gate run Next on another port?
  Also: is `stg-my.` still needed when `my.` itself has no Cache Rule yet?

## Rollback (design §6.4)

- No live fallback: Vercel is 402.
- ~~Rollback = previous image tag via `docker compose up` (Artifact Registry keeps ≥ 2 tags).~~ <!-- SUPERSEDED 2026-10-12 by #52 -->
- Rollback = point `current` back to the previous `releases/<sha>` and `pm2 reload` (design §3.4; 3 releases kept,
  older ones renamed `x_<sha>`, never `rm`).
- Second-line: DNS back to Vercel once its quota resets, then purge the Cloudflare cache.
- Vercel projects are paused, never deleted (soft). `vercel.json` ×2 and `api/index.ts` stay until
  M3 exits, then `x_` (GCP-M3-5).
