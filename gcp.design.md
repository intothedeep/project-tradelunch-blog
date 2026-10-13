# GCP 호스팅 설계 (DRAFT, system-architect, 2026-10-12)

> 상태: 설계 초안 rev2 (2026-10-12, research 반영). 전략 선택은 오너.
> GCP 숫자 출처 = `_docs/gcp-hosting.research.md`의 `S-GCP-n`. 이 문서는 숫자를 그 id로 인용한다.
> rev1 → rev2 변경: 권고 A → **B**. 이유는 §3 "rev2 판정".
> rev3 (2026-10-12): 오너가 B + us-central1 + Cloudflare Tunnel 2개를 선택. Caddy/443/Origin CA 진입 경로를 Tunnel로 교체(§3.3).
> rev4 (2026-10-12): `gcp.plan.md` Q1–Q4 반영 — swap 4 GB(오너), p95 측정 경로(§3.1), SSR 직결 env(§3.3 (4)), §0은 `00.plan.md` 인용.
> rev5 (2026-10-12): `decisions.plan.md` #51(터널 1개 + hostname 2개, `blog-api.`), #52(PM2, VM 밖 빌드, Docker 없음) 반영 → §3.3 수정, §3.4 신설. B 열의 Docker 문구는 #52로 대체됨.

## 0. Mission block (인용 — 원본 `00.plan.md` "Phase GCP" #### Mission block; 원본이 이기며, 이 문서는 고치지 않는다)

> - Mission: (owner 미정, O11 → GCP-U1)
> - Vision (DRAFT, architect; owner 승인 대기): `my.`/`blog-api.`가 Vercel 없이 GCP 오리진에서 200을 내고, 공개 트래픽은 Cloudflare 엣지가 흡수한다.
> - Constraints: 스키마·Supabase·OCI 불변 · soft-delete · 로컬 실행 금지 → 빌드는 GH Actions에서만 · CF2 MUST ①–③ · pnpm only.
> - G1 (DRAFT): 두 호스트 HTTP 200 복구; measure `curl -sI` 200 + `server: cloudflare` by <owner date> (O11).
> - G2 (DRAFT): 월 GCP 청구 ≤ <owner amount>; measure Billing report by 첫 청구월 (O4/O11).
> - S1 → G1, G2: B — e2-micro VM 1대(us-central1), Next + Express, Cloudflare Tunnel 2개 (picked: B, owner 2026-10-12: "I will run nextjs and express server"); listed alternatives: A-FH → A-LB (#48).
> - M1 → S1: MVP1 배포 계약; exit: GH Actions 잡에서 두 이미지 빌드 + secret 없이 `/ping`·`/robots.txt` 200; cycle 0/2; recovery 0/2
> - M2 → S1: MVP2 Express 슬라이스; exit: `https://blog-api.prettylog.com/ping` 200 + `server: cloudflare` via tunnel "api"; cycle 0/2; recovery 0/2
>   - Tactic: §3.1 메모리 게이트; kill: 정상 부하 swap-in 지속 OR CF MISS p95 > 2 s (DRAFT, O13) → A-FH
> - M3 → S1: MVP3 Next 이전; exit: `https://my.prettylog.com` 200 + `server: cloudflare` via tunnel "web" + Server Actions 발행 OK; cycle 0/2; recovery 0/2

원본 갱신 필요(pm): 위 인용의 "Tunnel 2개", M1 "두 이미지", M2/M3 "tunnel "api"/"web"" 는 #51(터널 1개, hostname 2개)·#52(PM2, 이미지 없음) 이전 문구다. 원본이 바뀌면 이 인용도 따라 바꾼다. M1 exit 제안 문구: §5 MVP1 exit.

설계 문서의 오너 원문 기록(dispatch 경유): "I will use 2 cloudflare tunnel for each nextjs and express server", "I want to use 4g swap" (2026-10-12).

## 1. 현재 구조와 목표 구조

```
현재 (둘 다 402)                              목표
browser ──DNS-only──► Vercel(my.)  ──┐        browser ──CF proxied──► GCP origin(my.)   ──┐
browser ──DNS-only──► Vercel(blog-api.)◄┘      browser ──CF(§4 결정)─► GCP origin(blog-api.)◄┘
                 Vercel edge = s-maxage 캐시           Cloudflare edge = 유일한 공유 캐시
both ──► Supabase pooler(6543) · OCI(blog-assets., CF Worker) — 불변
```

## 2. Part A — Vercel 결합 목록

출처: grep(node_modules, `x_*`, `_docs/archive` 제외) + 파일 읽기. `.env.example` 읽기는 권한 거부 → env 목록은 `env.schema.ts` 기준.

| # | file:line | 결합 | GCP에서 필요한 것 |
| --- | --- | --- | --- |
| 1 | `apps/dashboard_server/vercel.json:3` | `installCommand` (Vercel 빌드) | GH Actions 빌드 잡의 `pnpm install --frozen-lockfile` (`packageManager` 핀) — §3.4 |
| 2 | `apps/dashboard_server/vercel.json:4` | `@repo/types build` + `check-types`만 실행; TS 번들은 `@vercel/node`가 함 | 빌드 잡: `pnpm --filter @repo/types build` → `pnpm --filter dashboard_server build`(`tsc && tsc-alias`) → VM에서 PM2가 `node dist/src/index.js`. 이 경로는 prod에서 한 번도 안 돌았다 |
| 3 | `apps/dashboard_server/src/utils/tree.utils.ts:1-7` | `ETreeNodeType`를 **값**으로 import; `@repo/types` `main`=`./dist/index.js` | #2의 `@repo/types build` 필수. 빠지면 부팅은 되고 카테고리 요청에서 throw |
| 4 | `apps/dashboard_server/vercel.json:5-8` | `includeFiles: @img+sharp-*linux*` (sharp libvips 동봉) | ubuntu x64 runner에서 `pnpm install` → `@img/sharp-linux-x64`(glibc) 설치. VM도 x86_64 + glibc(Ubuntu)여야 일치 — §3.4 |
| 5 | `apps/dashboard_server/vercel.json:10-12` | rewrite `/(.*)` → `/api` | 불필요 (`listen()`이 전 경로 처리) |
| 6 | `apps/dashboard_server/api/index.ts:1-6` | `@vercel/node` 핸들러 export | 불필요. 진입점 = `src/index.ts:18` `app.listen(SERVER_PORT)` + SIGTERM 종료(이미 있음). 파일은 `x_` 처리 후보 |
| 7 | `apps/dashboard_server/src/config/env.schema.ts:30` | `PORT` default 4000 | Cloud Run이 `PORT` 주입 → 그대로 동작. VM은 명시 설정 |
| 8 | `apps/dashboard_server/src/config/env.schema.ts:46-50` | `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` = Vercel↔Supabase 통합이 자동 주입 | 같은 이름으로 수동 등록(Secret Manager 또는 VM env 파일). 이름 유지 → 코드 변경 0 |
| 9 | `apps/dashboard_server/src/config/env.schema.ts:7-9` | 주석 "On Vercel there is no .env.local" | 산출물 tarball에 `.env*` 미포함. secret은 VM의 저장소 밖 env 파일(§3.4) |
| 10 | `apps/dashboard_server/src/database.ts:3-6,33` | `max: 5` 근거 = Vercel Fluid Compute | Cloud Run: 5 × 인스턴스 수 → `--max-instances` 상한으로 묶는다 (Google 권고 시작값 3, S-GCP-27). VM: 5 고정. Free pooler client 상한 200(S-GCP-48) → 5는 여유 (R8 resolved) |
| 11 | `apps/dashboard_server/src/controllers/posts/posts.cache.ts:6-7,12` | `public, s-maxage=86400` — Vercel 엣지가 받아 주던 캐시 | GCP 오리진 앞에 공유 캐시 없음 → §4 결정 (`blog-api.` 캐시 룰) |
| 12 | `…/posts/posts.cache.ts:20` | `Vary: Authorization` 의존 | Cloudflare는 Vary로 키를 나누지 않음(CF2-3 MUST ③) → 엣지 bypass 룰로 대체 (§4) |
| 13 | `apps/dashboard_server/src/server.ts:9-12`, `env.schema.ts:73,130` | `ALLOWED_ORIGINS` = CORS + Clerk `authorizedParties` | 값 `https://my.prettylog.com` 유지 (도메인 불변). `*.run.app` 테스트 시 임시 추가 |
| 14 | `apps/dashboard_server/src/server.ts` (부재) | `trust proxy` 미설정 | CF/LB 뒤에서 `req.ip` 부정확. 현재 IP 사용처 없으면 보류 (낮음) |
| 15 | `apps/dashboard_server/tsconfig.json:2`, `decisions.plan.md:51-62` | `@vercel/node` ts-node 제약으로 strict 인라인 | 제약 소멸. 그대로 둔다(최소 diff). 결정 문서는 pm이 "obsolete" 표기 |
| 16 | `apps/dashboard_server/package.json:12` | `start:pm2` | 쓰지 않는다: 이 스크립트는 VM에서 `pnpm build`를 돌리는데, VM 빌드는 금지다(#52). PM2 실행은 `ecosystem.config.cjs`(§3.4)가 맡는다. 스크립트는 그대로 둔다 |
| 17 | `apps/dashboard_client_web/next.config.ts:46` (부재) | `output: 'standalone'` 없음 (Vercel은 불필요) | 추가 필요 + `outputFileTracingRoot` = 모노레포 루트 (`node-linker=isolated`, `.npmrc:2`) |
| 18 | `apps/dashboard_client_web/package.json:11` | `next start -p 3000` 포트 하드코딩 | standalone `server.js`는 `PORT`/`HOSTNAME=0.0.0.0` env를 읽음 → 이를 진입점으로 |
| 19 | `apps/dashboard_client_web/next.config.ts:5-9` | 빌드 진단 로그 (Vercel 로그 redaction 전제) | 동작 무관. 그대로 |
| 20 | `apps/dashboard_client_web/next.config.ts:49-57` | `images.unoptimized: true` (Vercel 옵티마이저 우회) | 유지. 컨테이너에서도 `/_next/image` CPU 소모 회피 |
| 21 | `apps/dashboard_client_web/env.schema.ts:24-57`, `app/layout.tsx:43-44` | `NEXT_PUBLIC_*` = `next build` 시점에 번들에 박힘; default가 prod 값이라 누락이 숨겨짐 | GH Actions 빌드 잡의 env(Actions variables)로 전달 (`API_BASE`=`https://blog-api.prettylog.com`, `CDN_ASSETS`, `SITE_URL`, `CLERK_PUBLISHABLE_KEY`, `DEFAULT_BLOG_AUTHOR`, `GOOGLE_*`). 런타임 secret 아님. 값이 바뀌면 재빌드 |
| 22 | `@clerk/nextjs` 내부 (`proxy.ts:24`) | `CLERK_SECRET_KEY`를 grep에 안 보이게 암묵 읽기 | Next 컨테이너 **런타임** secret으로 주입. 누락 시 미들웨어 전 경로 실패 |
| 23 | `apps/dashboard_client_web/app/actions/*.action.ts` (2개) | Server Actions: Origin ↔ Host(`x-forwarded-host`) 비교 | 오리진이 받는 Host가 `my.prettylog.com`이어야 함. Host가 `*.run.app`로 바뀌는 경로(Worker)면 `serverActions.allowedOrigins` 필요. 다중 인스턴스면 고정 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 필요(S-GCP-21). B(단일 프로세스, Host 보존)는 둘 다 불필요 |
| 24 | `apps/dashboard_client_web/app/sitemap.ts:23`, `…/opengraph-image.tsx:20,23` | ISR `revalidate=86400` = Vercel Data Cache(공유·영속) | Cloud Run: `.next/cache` 인스턴스별·휘발, 디스크가 RAM(S-GCP-18, S-GCP-21), revalidate 재생성은 응답 뒤 CPU 제한 구간에서 돈다(S-GCP-19). VM: 디스크 영속·단일 인스턴스 → 문제 없음. 어느 쪽이든 CF2-2 엣지 24h가 실제 캐시 → custom cacheHandler 안 만듦(YAGNI) |
| 25 | `apps/dashboard_client_web/instrumentation.ts:17-41` | `onRequestError` → Express `/v1/api/error-logs` | 플랫폼 무관. Node 런타임에서 동작. 변경 없음 |
| 26 | `apps/dashboard_client_web/proxy.ts:30-39` | Clerk 미들웨어 matcher (Vercel 미들웨어 런타임) | standalone 서버에서도 실행. 변경 없음 |
| 27 | Clerk Production instance (`my.prettylog.com`) | 도메인 기반 키 | 도메인 불변 → 변경 없음. Clerk DNS 레코드(`clerk.` 등) 건드리지 않는다 |
| 28 | `.github/workflows/ci.yml:18-26` | 검사만; **배포 단계 없음** (Vercel Git 통합이 배포) | CI/CD 신규: 산출물 빌드 + 전송 + `pm2 reload` (§3.4). 로컬 빌드 금지 규칙상 원격 필수 |
| 29 | `.github/workflows/supabase-keepalive.yml:17` | `secrets.DATABASE_URL` (Vercel 무관) | 변경 없음. 참고: 루트 `CLAUDE.md`는 `BLOG_SUPABASE_DATABASE_URL`라 적음 → 문서 drift, pm에 보고 |
| 30 | cron | 레포에 Vercel cron 없음 (finance 이관) | 없음 |
| 31 | `apps/dashboard_client_web/.gitignore:33-34` | `.vercel` | 무해. 그대로 |

## 3. Part B — 옵션 A/B/C

**핵심 경첩 (rev2, research로 확정):** Cloud Run은 Host로 라우팅한다. Cloudflare Free는 Host/SNI를 바꿀 수 없다: Origin Rules의 Host·SNI override는 Enterprise 전용(S-GCP-15), Snippets는 Pro 이상(S-GCP-16). 따라서 proxied CNAME → `*.run.app` 직결은 Free에서 동작하지 않는다(404 주장은 커뮤니티 출처뿐, S-GCP-14 §4 [UNVERIFIED]). A가 쓸 수 있는 앞단은 넷이다:

| A 하위안 | 앞단 | 판정 근거 |
| --- | --- | --- |
| A-LB | 외부 Application LB + serverless NEG | Google 권장(S-GCP-14). forwarding rule ≈ $0.025/h → 규칙 1개 ≈ $18/월(S-GCP-17, snippet; 산수는 research 추론) |
| A-DM | Cloud Run domain mapping | **Preview, "not production-ready"**(S-GCP-14). Cloudflare 앞단이면 "Always use HTTPS" 꺼야 함 → **탈락**(정확성 우선) |
| A-Worker | Cloudflare Worker가 run.app으로 재요청 | Free 100k req/day, 10 ms CPU(S-GCP-33). Worker는 캐시 HIT 요청에도 매번 실행 → 일일 상한이 **전체 트래픽** 상한이 된다. `blog-assets.`가 이미 Worker를 쓰므로 계정 쿼터 공유 (이 두 문장은 Cloudflare 동작, research 외). Zone Cache Rules가 아니라 Worker 코드가 캐시를 맡게 되어 **CF2 MUST ①–③을 코드로 재구현**해야 함. Host가 run.app로 바뀌어 #23 대응 필요 |
| A-FH | Firebase Hosting rewrite → Cloud Run | Blaze 필수, 전송 10 GB/월 무료 후 $0.15/GB(S-GCP-35, S-GCP-36). Cloudflare 앞 Firebase 커스텀 도메인은 Host를 Firebase가 앎(research 추론, 미검증). CDN 이중(Firebase CDN + Cloudflare) |

VM(B)에는 이 경첩 자체가 없다: proxied A 레코드 → VM IP, Host 그대로 도착. CF2 룰을 그대로 쓴다.

| 항목 | A — Cloud Run ×2 (scale-to-zero) | B — e2-micro VM 1대 (Tunnel + 2 프로세스) **[오너 선택 2026-10-12]** | C — Firebase App Hosting(Next) + Cloud Run(Express) |
| --- | --- | --- | --- |
| 배포 형태 | 서비스 2개: `blog-web`(Next standalone), `blog-api`(Express). `min=0`, `max=2`(Google 권고 ≤3, S-GCP-27). 무료 할당은 billing account당 1개를 두 서비스가 공유(S-GCP-1) | VM 1대, us-central1(무료 리전, S-GCP-1): `cloudflared` 1개(hostname 2개, #51) → `127.0.0.1:3000`(Next), `127.0.0.1:4000`(Express). PM2로 실행, Docker 없음(#52). §3.3, §3.4 | Next = App Hosting(관리형 빌드·롤아웃), Express = Cloud Run |
| Dockerfile / 산출물 | 2개 (multi-stage, `pnpm deploy`/standalone) | 없음(#52). 대신 빌드 잡 1개 + `ecosystem.config.cjs` + 배포 스크립트(§3.4) | Express 1개. Next는 `apphosting.yaml` |
| Cloudflare 앞단 | 위 하위안 A-LB / A-Worker / A-FH 중 하나 (A-DM 탈락) | Cloudflare Tunnel(outbound-only). 공개 hostname = proxied CNAME → `<tunnel-id>.cfargotunnel.com`. 오리진 TLS·인증서 없음. Host 원본 유지(cloudflared 기본 동작, research 외). §3.3 | App Hosting 커스텀 도메인 + Cloud CDN(S-GCP-12) → Cloudflare 이중 캐시. Next 16 지원 [CONFLICT](S-GCP-13 vs S-GCP-32), Express "not guaranteed"(S-GCP-13) |
| 캐시 | ISR 인스턴스별·RAM·휘발, 재생성 CPU 제한(#24); `max>1`이면 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 고정 필요(S-GCP-21); CF 엣지가 본 캐시 | ISR 디스크 영속·단일 인스턴스 → Vercel과 가장 비슷 | ISR = App Hosting이 관리; CF2 룰과 상호작용 검증 필요 |
| Secrets | Secret Manager → `--update-secrets`, 버전 고정(S-GCP-40). 무료 = 활성 버전 6개/월, 접근 1만 회/월(S-GCP-1). secret이 6개를 넘으므로(O9) JSON secret 1–2개로 묶는다 | VM의 root-only env 파일(또는 Secret Manager를 부팅 시 fetch) | Secret Manager (App Hosting 연동) |
| CI/CD | GH Actions + Workload Identity Federation → Artifact Registry → `gcloud run deploy` | GH Actions가 tarball 2개 빌드 → IAP ssh/scp(`google-github-actions/auth@v3`, WIF, S-GCP-30)로 전송 → release 디렉터리 + symlink 전환 + `pm2 reload`(§3.4). Artifact Registry 안 씀. VM에서 빌드 금지 | App Hosting은 GitHub 연동 자동 빌드; Express는 A와 동일 |
| 롤백 | 이전 revision으로 트래픽 100% (초 단위) | `current` symlink를 이전 release로 되돌리고 `pm2 reload` (초–분 단위, §3.4) | App Hosting rollout 롤백 + Cloud Run revision |
| 콜드스타트 | 있음 (Next SSR 수 초). 익명 트래픽은 CF HIT로 흡수; 로그인 사용자·API는 체감. `min=1`이면 해소되나 idle 과금(request-based idle vCPU $0.0000025/s, S-GCP-5/6 secondary; 1 vCPU 상시 ≈ $6.6/월 vCPU분, 산수) | 없음 | Next·Express 모두 있음 |
| 비용 위험 | 무료 = 2M req, 180k vCPU-s, 360k GiB-s, egress 1 GB/월(S-GCP-1). **spend cap budget GA, Cloud Run 대상**(S-GCP-28) → 상한 초과 시 신규 사용 정지(즉시 아님; egress 포함 여부 미기재) + `max-instances` | VM·30 GB PD 무료, egress 1 GB/월(S-GCP-1). spend cap 대상 아님 → alerts-only budget(S-GCP-25). 외부 IPv4 $0.005/h ≈ $3.65/월, 무료 tier 포함 여부 [CONFLICT](S-GCP-41/42/43) → §3.3 (2) | Blaze + 10 GiB 무료 후 $0.15–0.20/GiB(S-GCP-12); Next 16·Express 지원 불확실 |
| 월 비용(고정분, 무료 할당 내 트래픽 가정) | A-LB ≈ $18+(S-GCP-17) · A-DM $0 (탈락) · A-Worker $0 (100k req/day 상한) · A-FH $0 (10 GB 초과 시 $0.15/GB) | $0–3.65 (외부 IPv4, [CONFLICT] S-GCP-41/43) + 1 GB 초과 egress. Tunnel은 Cloudflare Free 기능(비용 0, research 외) | $0 + 10 GiB 초과분 |
| 운영 부담 | 낮음 (관리형) | 높음: OS 패치, 디스크, 메모리. 2 shared vCPU, 지속 0.25 vCPU, 1 GB RAM(S-GCP-38, aggregator) → §3.1 | 중간 |
| SPOF | 없음 | VM 1대 | 없음 |
| 목표 추적 | G1 강함, G2: A-LB 약함 / A-Worker·A-FH 중간(상한·이중 CDN) | G1 중간(메모리 위험), G2 강함 | G1 중간, G2 약함 |

### 3.1 오너 질문: "e2-micro 무료 1대에 Next 서버 1개 + Node 서버 1개?"

- **답: 가능할 가능성이 높지만 빠듯하다. 실측 전에는 확정할 수 없다.** research가 줄 수 있는 숫자가 아니다.
- 근거: research는 "one e2-micro could run both under one 1 GB budget"을 추론으로만 둔다(S-GCP-1, S-GCP-38). 무료 조건은 VM 1대·3개 리전·30 GB PD·egress 1 GB(S-GCP-1).
- 위험: (1) RAM 1 GB를 OS + 상주 에이전트 + cloudflared 1개 + PM2 + Next + Express가 나눈다. 오너 VM 스냅샷(앱 기동 전, `ps`): ops-agent ~103 MB, cloudflared 39, osconfig 31, PM2 26, guest-agent 16, snapd 15 → **available ≈ 543 MB**가 Next + Express 예산이다. 가장 큰 상주분은 ops-agent다. 끄면 약 100 MB가 생기지만 GCP 모니터링·로그를 잃는다(O18). (2) 지속 CPU 0.25 vCPU — OG 렌더(Satori)와 sharp 업로드가 버스트. OG는 CF 24h가 흡수.
- 설계 대응: **4 GB swap**(PD 위, 무료 30 GB 안; owner 2026-10-12 "I want to use 4g swap") + `vm.swappiness=10` · 프로세스별 `--max-old-space-size` 상한 · `next build`는 절대 VM에서 안 함(CI 빌드) · `images.unoptimized` 유지(#20).
- **MVP2 게이트(B):** VM에서 Express 단독 RSS → Next 추가 후 RSS·swap 사용량을 읽는다. 기준(사전 등록): 정상 부하에서 swap-in 지속 없음 + p95 응답이 CF MISS 기준 2 s 이하. 실패 시 kill → A-FH로 전환. swap이 4 GB라 OOM은 늦어지지만 지연은 숨지 않는다 → 판정은 swap-in(`vmstat si`)과 p95로 하고 "swap 여유"로 하지 않는다.
- **p95 측정 경로 (Q2, `my.` 전환 전):** 기존 터널(#51)에 임시 공개 hostname `stg-my.prettylog.com` → `localhost:3000`을 하나 더 붙인다(새 터널 아님). 이 host에는 Cache Rule을 만들지 않는다 → HTML은 CF 기본 동작상 캐시되지 않아 매 요청이 MISS 경로(브라우저→CF→tunnel→Next)를 탄다.
  1. 검증: 응답의 `cf-cache-status`가 `DYNAMIC` 또는 없음.
  2. 측정: 익명 공개 URL 고정 목록(홈, 글 3개, 태그 1개)마다 `curl -o /dev/null -s -w '%{time_total}\n'` 20회 → 전체 p95. main session 또는 오너가 실행하고, 결과는 파일로 저장한다.
  3. 정리: 측정 후 hostname을 제거한다.
  - 한계: Clerk Production은 `my.` 기준이라 로그인 기능은 이 host에서 보지 않는다. 익명 페이지만 잰다. 보조 지표로 IAP ssh 안 `curl localhost:3000`을 같이 재서 tunnel·CF 구간과 Next 자체 시간을 나눈다.

### 3.2 rev2 판정

**최종 권고: B (e2-micro VM 1대, Next + Express, Cloudflare proxied) — 오너 선택 2026-10-12, 진입 = Tunnel(§3.3).** 이유 한 줄: Free Cloudflare에서 Host가 그대로 도착하는 유일한 $0 경로라, CF2 MUST ①–③과 단일 인스턴스 ISR·Server Actions가 코드 변경 없이 그대로 성립한다.

- A 계열 탈락/후순위 이유: A-LB는 고정 ≈ $18/월로 G2 위반 · A-DM은 Preview(정확성) · A-Worker는 CF2 룰을 Worker 코드로 재구현 + 전체 트래픽 100k/day 상한 · A-FH는 이중 CDN과 cert 동작 미검증.
- **listed alternatives (순서): B → A-FH → A-LB.** §3.1 게이트가 kill되면 A-FH. A-FH의 Host 보존·cert 동작은 미검증이므로, 실패하면 research가 검증한 유일한 경로 A-LB(≈ $18/월, S-GCP-14, S-GCP-17). C는 비권고 유지.
- rev1 대비 변경: rev1은 A 조건부였다. 조건("경첩이 고정비 또는 Preview")이 research로 충족되어 B로 전환한다.

### 3.3 진입 경로: Cloudflare Tunnel 1개 + hostname 2개 (owner 2026-10-12, #50 → #51)

```
browser ─► Cloudflare edge (Cache Rules, proxied) ─► tunnel(1) ─► cloudflared.service ─┬─ my.prettylog.com       ─► localhost:3000 Next    (PM2 blog-web)
                                                                                       └─ blog-api.prettylog.com ─► localhost:4000 Express (PM2 blog-api)
VM (us-central1, e2-micro, Ubuntu): inbound 전부 차단, IAP ssh(tcp:22, IAP 대역)만 허용
outbound ─► Cloudflare edge(tunnel) · Supabase pooler · OCI · Clerk · GitHub(배포 전송은 IAP 경유 inbound ssh)
```

- **바인딩:** Docker가 없으므로(#52) 모든 프로세스가 같은 호스트 네트워크에 있다. 따라서 `127.0.0.1`/`localhost`가 **올바른 대상**이다(rev4의 compose 서비스명 메모는 폐기).
  - Next standalone은 `HOSTNAME=127.0.0.1`로 loopback에만 바인딩된다.
  - Express는 `app.listen(SERVER_PORT)`(`src/index.ts:18`)에 host 인자가 없어 0.0.0.0에 바인딩된다. `HOST_NAME`은 로그에만 쓰인다. 외부 차단은 GCP 방화벽이 맡는다. loopback 바인딩 코드 변경은 하지 않는다(최소 diff; 방화벽이 1차 방어).
- **cloudflared:** 프로세스 1개, systemd `cloudflared.service`, `--token-file /etc/cloudflared/token`(오너 VM 실측, #51). 부팅 시 systemd가 올린다. 토큰은 `/etc/cloudflared/token`(root-only)에만 있고 레포에는 없다.
- **(2) outbound 경로: 외부 IP 유지 vs Cloud NAT.** Tunnel은 outbound만 쓴다. 그러나 VM은 Supabase·OCI·Clerk·Cloudflare edge로 나가야 한다. 외부 IP가 없으면 Cloud NAT가 필요하다.

  | 안 | 비용 | 보안 |
  | --- | --- | --- |
  | 2-a (권고) ephemeral 외부 IPv4 유지 + 방화벽 inbound 전부 deny(IAP 22만 allow) | $0.005/h ≈ $3.65/월(S-GCP-41, verified). 무료 tier가 덮는지는 [CONFLICT](S-GCP-42 snippet vs S-GCP-43 사례) | 공인 IP는 있으나 열린 포트 없음 |
  | 2-b 외부 IP 없음 + Cloud NAT | Cloud NAT 단가는 research에 없음 [UNVERIFIED]. 게이트웨이 시간 + 처리 GB 과금 구조로 알려짐(research 외) → 2-a보다 쌀 근거 없음 | 공인 IP 자체가 없음 |

  Supabase·OCI·Clerk·Cloudflare edge가 모두 인터넷이라, 외부 IP나 NAT 중 하나는 반드시 있어야 한다.
- **(3) CF2 캐시 룰:** Tunnel 공개 hostname은 proxied CNAME이다. CF2-2/3 Cache Rules(MUST ①–③)는 hostname 기준이라 그대로 적용된다. Cache Rules는 Free에서 proxied DNS를 요구한다(S-GCP-45).
- **blog-api 결과:** Tunnel hostname은 DNS-only가 될 수 없다 → §4의 4-b는 성립하지 않는다. CF2-4 보류는 오너 Tunnel 선택으로 해소되고, 4-a 또는 4-c 중 하나다(pm D-row).
- **(4) egress:** Tunnel 응답 바이트는 VM → Cloudflare outbound이므로 **GCP egress로 계산**된다. 무료 1 GB/월(S-GCP-1), 초과분 단가는 CDN Interconnect 적용 여부 미확인(S-GCP-9 secondary, [UNVERIFIED]). Next SSR의 `blog-api.` 호출도 VM → CF → tunnel → VM을 돌아 egress에 더해진다. 줄이는 수단 = CF HIT(4-a). 서버 측 직결은 **DEFERRED 유지 (GCP-D1)**:
  - 형태: 서버 전용 런타임 env `API_INTERNAL_BASE=http://127.0.0.1:4000` (PM2·같은 호스트라 loopback이 맞다; `NEXT_PUBLIC_` 아님 → 번들에 안 박힘). `apis/http.server.ts:46`만 `API_INTERNAL_BASE ?? API_BASE`를 쓴다. 브라우저 경로는 그대로 `NEXT_PUBLIC_API_BASE=https://blog-api.prettylog.com`.
  - **오너 제안 `NEXT_PUBLIC_API_BASE=http://localhost:4000`은 쓰지 않는다:** `http.client.ts:40`이 같은 `API_BASE`를 쓴다(브라우저 fetcher 32개). 브라우저의 `localhost`는 방문자 자신의 PC라 모든 클라이언트 호출이 실패한다. 미결정(O17).
  - M3에 넣지 않는 이유: 직결은 4-a의 CF HIT를 건너뛰어 모든 SSR 호출이 0.25 vCPU Express에 닿는다. egress 절감과 CPU 부하가 맞바뀐다. 측정 없이 고를 근거가 없다.
  - 재검토 트리거: M2/M3에서 월 egress가 무료 1 GB의 절반을 넘을 추세, 또는 §3.1 p95 실패 원인이 hairpin(tunnel·CF 구간)으로 나올 때.
- **(5) 실행 형태:** §3.4 (PM2). VM에는 Node 24(nvm)가 **필수**다(#52). pnpm은 VM에 필요 없다 — 산출물에 `node_modules`가 들어 있다. VM에서 `pnpm install`/`next build`를 하지 않는다.
- **(6) 빠지는 것:** Caddy, Caddyfile, :443 오픈, Cloudflare Origin CA cert, SSL "Full (strict)" 설정, Caddy ACME, A 레코드 → VM IP, "오리진 IP에 Host 헤더 curl" 검증. Docker, compose, 이미지, Artifact Registry(#52). 대신 검증은 IAP ssh 안의 `curl localhost:<port>` + 공개 hostname curl.

### 3.4 빌드·전송·실행: PM2, VM 밖 빌드 (owner 2026-10-12, #52)

```
GH Actions ubuntu x64 ── build ──► api-<sha>.tgz, web-<sha>.tgz ── IAP scp ──► VM ~/prettylog/{api,web}/releases/<sha>/
                                                                                       │ ln -sfn + mv -T (atomic)
                                                                                       ▼
                                                                    {api,web}/current ──► pm2 reload <app>
```

- **빌드 장소 = GitHub Actions `ubuntu-latest`(x64).** 로컬(owner Mac = darwin, Apple Silicon이면 arm64)은 sharp 바이너리가 맞지 않고, 로컬 실행 규칙에도 걸린다. e2-micro는 x86_64(E2 계열은 x86 전용; research 외) → runner와 아키텍처가 같다. 오너 확인 1회: VM에서 `uname -m` = `x86_64`, `ldd --version`(glibc) (O19).
- **Node 버전:** runner `setup-node` 24와 VM nvm Node 24를 같은 major로 맞춘다(`.nvmrc` v24.3.0). sharp는 N-API라 major가 같으면 동작한다.
- **Express 산출물 = `pnpm deploy --filter dashboard_server --prod out/api`** (bundling 대신).
  - 이유: 새 도구가 없다. sharp·pg 같은 native/optional 의존성을 번들러로 다룰 필요가 없다. `@repo/types` workspace 의존성도 실제 패키지로 복사된다.
  - 순서: `@repo/types build` → `dashboard_server build` → `pnpm deploy`.
  - 주의: `pnpm deploy`는 publish 규칙으로 파일을 고른다. gitignore된 `dist/`가 빠질 수 있다 → 잡에서 `out/api/dist`와 `out/api/node_modules/@repo/types/dist` 존재를 검사한다. 없으면 `cp -r`로 넣는다.
- **Next 산출물 = `output:'standalone'`** + `outputFileTracingRoot` = 레포 루트(#17, S-GCP-22).
  - standalone은 `.next/static`과 `public`을 복사하지 않는다(S-GCP-22) → 잡이 `apps/dashboard_client_web/.next/static`과 `public`을 `.next/standalone/apps/dashboard_client_web/` 아래로 복사한다.
  - `NEXT_PUBLIC_*`는 이 잡에서 박힌다(#21).
- **패키징:** `tar -czf`로 묶는다(pnpm `node_modules`의 상대 symlink 보존). `scp -r`은 symlink를 풀어 버리므로 쓰지 않는다.
- **전송:**
  - 1회차(M2): 오너가 Actions artifact를 내려받아 `gcloud compute scp --tunnel-through-iap`로 올린다.
  - 이후: Actions가 WIF 서비스 계정(IAP-secured Tunnel User + OS Login 역할)으로 같은 명령을 실행한다.
  - agent는 어느 쪽도 실행하지 않는다.
- **release 디렉터리** (`~tio_taek_lim/prettylog/`, sudo 불필요):

  ```
  api/releases/<sha>/   web/releases/<sha>/   api/current → releases/<sha>   web/current → releases/<sha>
  shared/api.env  shared/web.env   (chmod 600, 레포 밖)      ecosystem.config.cjs
  ```

  - 전환: `tar -xzf` → `ln -sfn releases/<sha> current.new && mv -T current.new current`(원자적 rename) → `pm2 reload <app> --update-env`.
  - 롤백: `current`를 이전 `<sha>`로 같은 방식으로 되돌리고 reload.
  - 보존: 최근 3개를 남긴다. 더 오래된 release는 `x_<sha>`로 rename하고, 오너가 수동 삭제한다(`rules/core.md` soft-delete; agent·스크립트는 `rm`하지 않는다).
  - fork 모드의 `pm2 reload`는 사실상 restart다 → 수 초간 끊긴다. 익명 트래픽은 CF 캐시가 받는다. cluster 모드는 쓰지 않는다(메모리).
- **`ecosystem.config.cjs`** (레포에 커밋, 예: `deploy/gcp/`; 배포 시 `~/prettylog/`로 복사; secret 없음):

  | 항목 | `blog-api` | `blog-web` |
  | --- | --- | --- |
  | `cwd` | `~/prettylog/api/current` | `~/prettylog/web/current/apps/dashboard_client_web` |
  | `script` | `dist/src/index.js` | `server.js` |
  | `exec_mode` / `instances` | `fork` / 1 | `fork` / 1 |
  | env | `NODE_ENV=production`, `PORT=4000`, `HOST_NAME=127.0.0.1` + `shared/api.env` | `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=127.0.0.1` + `shared/web.env` |
  | `max_memory_restart` (초안, §3.1 게이트로 조정) | `200M` | `320M` |
  | `node_args` | `--max-old-space-size=160` | `--max-old-space-size=256` |

  - 두 상한의 합 520 MB < available 543 MB다. 넘치면 4 GB swap이 받고, §3.1 게이트가 판정한다.
  - env 파일 읽기: config가 JS이므로 `shared/*.env`를 `KEY=VALUE` 줄 단위로 읽어 `env`에 병합한다(약 10줄). PM2의 env-file 지원 여부에 기대지 않는다.
  - Express는 `.env.production`도 cwd에서 읽는다(`env.schema.ts:24`). release 디렉터리에는 그 파일을 두지 않는다 → 출처는 `shared/api.env` 하나다.
  - `shared/web.env`: `CLERK_SECRET_KEY`(#22) 등. `shared/api.env`: `POSTGRES_URL*`, `CLERK_SECRET_KEY`, `STORAGE_*`, `SUPABASE_*`, `ALLOWED_ORIGINS=https://my.prettylog.com`.
- **재부팅 복구:** 두 앱을 띄운 뒤 `pm2 startup systemd -u tio_taek_lim --hp /home/tio_taek_lim`(출력된 sudo 명령 1회 실행) → `pm2 save`.
  - 주의: `pm2 startup`은 그 시점 nvm Node 경로를 박는다. nvm으로 Node를 바꾸면 `pm2 unstartup` → `pm2 startup` → `pm2 save`를 다시 한다.
  - cloudflared는 별도 systemd 유닛이라 독립적으로 뜬다.

## 4. 캐시 계층 — CF2 규칙과 blog-api 재평가

- **my.**: CF2-1/2/3 그대로 적용. MUST ① 쿼리 스트링 전체를 키에 포함 · ② `__session` 있으면 bypass(`__client_uat` 금지) · ③ Edge TTL "Override origin"(Next가 `private, no-store` 송출). 오리진만 GCP로 바뀐다.
- **CF2-1 선행 게이트**("402 해소 뒤에만 proxied")는 새 GCP 오리진이 200을 내는 순간 충족된다. 컷오버 순서에 흡수(§6).
- **blog-api. — CF2-4 재개 필요.** Vercel 엣지가 사라지면 `s-maxage=86400`(#11)을 받아 줄 공유 캐시가 없다. 모든 Next 렌더 fan-out(1–4 호출)과 브라우저 TanStack 호출이 오리진으로 간다.

| 선택지 | 내용 | 위험 |
| --- | --- | --- |
| 4-a (권고) | blog-api.를 proxied로 전환. Cache Rule: `GET /v1/api/*` 중 **`Authorization` 요청 헤더가 있으면 bypass**, 나머지는 Edge TTL = "Respect origin"(Express는 정확한 `s-maxage`/`private, no-store`를 보낸다). `Vary` 의존(#12)을 엣지 룰로 바꾸므로 CF2-4가 든 누출 이유가 해소된다 | Free Cache Rules는 `http.request.headers`·Cookie 매칭 + Bypass 가능; Enterprise 전용은 헤더/쿠키를 캐시 **키**에 넣는 것뿐(S-GCP-45/46/47) → R9 resolved. 룰 예: `any(http.request.headers["authorization"][*] ne "")` → Bypass (미테스트). AC: 토큰 요청 → `BYPASS/DYNAMIC`, 익명 2회 → `HIT` |
| 4-b | blog-api. DNS-only 유지 | **Tunnel 선택으로 불가**(§3.3). 기록용으로만 남김 |
| 4-c | proxied, Cache Rule 없음 | CF 기본은 JSON을 캐시 안 함 → 안전하나 효과 0. 4-a의 1단계로 사용 가능 |

- 4-a 부수 효과: `_scripts/cf-purge.sh`가 처음으로 API 캐시까지 도달한다(현재는 redeploy만 purge, `posts.cache.ts:6-7`).
- B 선택 시 4-a 가치가 커진다: VM CPU가 작고, 오리진 egress 1 GB/월만 무료다(S-GCP-1). 초과분 단가는 CDN Interconnect NA $0.08/GB로 보도됨(S-GCP-9, secondary; Cloudflare 현재 파트너 여부 [STALE] S-GCP-8). CF HIT가 egress를 줄인다.
- 4-a/4-b는 **오너 선택**. pm이 D-row를 기록한 뒤 작업 시작.

## 5. MVP 사다리 (`.claude/CLAUDE.md` "System build phasing" 인용, 재진술 없음)

이 작업은 인프라 이전이다. **스키마·API 계약은 바뀌지 않는다** — 바뀌면 그 슬라이스는 MVP1로 되돌린다.

**MVP1 — 계약 (architect 소유).** 데이터 구조 = 기존 `packages/db/schema/tradelunch.schema.sql` 불변. 이번 MVP1의 "mock API 계약"에 해당하는 것은 **배포 계약**이다:

| 계약 | 내용 |
| --- | --- |
| HTTP | `/ping` → `{status:'ok'}` (헬스체크), `/v1/api/*` envelope `{success,data}` 불변 |
| 컨테이너 | `PORT` env로 listen, `0.0.0.0` 바인딩, SIGTERM 시 pool 종료 (Express는 이미 충족) |
| env | #8, #13, #21(build arg), #22(runtime) 표 = 단일 env 계약. 이름 변경 0 |
| 캐시 헤더 | Express `posts.cache.ts` 값 불변; my.는 CF2 룰 |
| fixture | 실 DB 대신 쓸 mock은 만들지 않는다: 계약은 HTTP/env이고, 프론트 mock은 레거시 Vercel 응답 형태 = 현행 코드 |

MVP1 exit (rev5, #52): GH Actions 잡 안에서 tarball 2개(§3.4)가 빌드된다. 잡이 그것을 새 디렉터리에 풀고, secret 없이 `node dist/src/index.js`(PORT=4000)와 `node server.js`(PORT=3000)를 띄운다. `/ping`(api)과 `/robots.txt`(web)가 200이어야 한다. 잡은 `pnpm deploy` 산출물의 `dist/` 존재도 검사한다. web은 `/`가 아니라 `/robots.txt`로 본다: `proxy.ts:36` matcher가 점 포함 경로를 건너뛰어 Clerk 키가 필요 없고, API 호출도 없다. **로컬 빌드 없음.**

**MVP2 — 실 슬라이스 1개: Express 먼저.** 이유: `listen()`+SIGTERM이 이미 있음, ISR 상태 없음, 산출물이 가장 작음. Supabase pooler SSL·OCI 업로드(sharp)·Clerk 토큰 검증을 GCP egress에서 먼저 증명한다. `my.`는 hostname으로 부르므로 `blog-api.` 하나만 바꾸면 깨끗한 슬라이스다.
- 태스크 1: 방화벽(IAP 22만) + `api-<sha>.tgz`를 release로 배치 + PM2 `blog-api`(§3.4) → IAP ssh 안에서 `curl localhost:4000/ping`, `GET /v1/api/posts?limit=5`, 카테고리 트리(#3 검증) 200. `pm2 startup`/`save` 후 재부팅 1회 → 자동 복구 확인. Express 단독 RSS 기록.
- 태스크 2: 기존 터널에 공개 hostname `blog-api.prettylog.com` → `localhost:4000`(#51; 기존 Vercel 레코드 교체) + §4 결정 적용. 공개 URL `/ping` 200, `server: cloudflare`.
- MVP3 직전 §3.1 메모리 게이트(Next 추가 후 RSS·swap)를 VM에서 읽는다. kill → A-FH.

**MVP3 — Next 이전.** `output:'standalone'`(#17) 추가 → `blog-web` 배포 → `my.` 전환 → CF2-2/3 룰. **#23 Server Actions** 동작 확인(글 발행).

**남는 것:** Vercel 프로젝트는 삭제하지 않고 정지 상태로 둔다(soft). `api/index.ts`, `vercel.json`은 MVP3 종료 후 `x_` 처리 — 그 전에는 DNS 롤백 대상의 설정으로 남긴다.

## 6. DNS 컷오버와 롤백

```
deploy(VM) ──► IAP ssh 안 localhost 검증 ──► tunnel 공개 hostname 지정 (Vercel CNAME 교체, proxied)
                                                             │
                                                             ▼
                                         CF2-2/3 룰(my.) / §4 룰(blog-api.) ──► HIT/BYPASS AC
```

1. 오리진 검증: IAP ssh 안에서 `curl -sI http://127.0.0.1:<port>/…` → 200. (main session 또는 오너가 실행. agent는 실행하지 않는다.)
2. 전환 = Zero Trust 대시보드에서 tunnel 공개 hostname 지정 → 기존 Vercel CNAME이 tunnel CNAME(proxied)으로 바뀐다. 오리진 200 확인 후에만(CF2-1 게이트). Tunnel CNAME은 proxied라 TTL은 Cloudflare가 관리한다.
3. 전환 후: `curl -sI https://blog-api.prettylog.com/ping`, `https://my.prettylog.com` → 200, `server: cloudflare`.
4. **롤백 정직성:** Vercel은 402이므로 **살아 있는 fallback이 없다.** 롤백 = `current` symlink를 이전 release로 되돌리고 `pm2 reload`(§3.4; release 최근 3개 보존). Vercel 쿼터가 리셋되면 DNS를 Vercel로 되돌리는 것이 2차 롤백이다(그때 CF 캐시 purge 필수 — 402 캐시 방지).

## 7. 오너가 제공할 것

| # | 항목 |
| --- | --- |
| O1 | ~~전략 선택~~ DONE: B (owner 2026-10-12). 대안 순서 A-FH → A-LB |
| O2 | GCP project id |
| O3 | ~~리전~~ DONE: us-central1 (owner 2026-10-12; 무료 리전, S-GCP-1). 남은 것: Supabase 프로젝트 리전 확인(지연 판단용) |
| O4 | Billing account 연결 + budget alert 금액 (G2 상한). B는 alerts-only(S-GCP-25); A는 spend cap 가능(S-GCP-28) |
| O5 | 배포 실행자: 1회차 오너 수동 scp → 이후 GH Actions + WIF(IAP-secured Tunnel User + OS Login 역할) 허용 여부 (§3.4) |
| O6 | ~~Artifact Registry 저장소 이름~~ DROPPED (#52, 이미지 없음) |
| O7 | Cloudflare 플랜 확인 (Free로 가정) + DNS 편집 권한 |
| O8 | §4 blog-api. 프록시 선택 (4-a/4-b/4-c) |
| O9 | secret 값을 `~/prettylog/shared/api.env`·`web.env`(chmod 600)에 직접 등록: `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `CLERK_SECRET_KEY`(양쪽), `STORAGE_*`, `SUPABASE_*`. 빌드용 `NEXT_PUBLIC_*`는 GH Actions variables (§3.4) |
| O10 | Clerk Production instance가 `my.prettylog.com`에 그대로 남는지 확인 (변경 없음 가정) |
| O11 | G1/G2 날짜·금액, Mission 문장 |
| O12 | VM OS 패치 책임 수용 + IAP ssh 배포 허용 |
| O14 | ~~Zero Trust + tunnel 2개~~ DONE in part (#51): 터널 1개·`/etc/cloudflared/token`·`cloudflared.service` 존재. 남은 것: 공개 hostname 2개 등록 시점(O16) |
| O15 | §3.3 (2) outbound: 2-a 외부 IP 유지(권고) / 2-b Cloud NAT |
| O16 | 기존 `my.`/`blog-api.` DNS 레코드(Vercel)를 tunnel hostname으로 교체하는 시점 |
| O13 | §3.1 메모리 게이트 기준(swap-in 지속 없음, MISS p95 ≤ 2 s) 승인 — architect 초안 |
| O17 | SSR 직결: `API_INTERNAL_BASE=http://127.0.0.1:4000`(서버 전용, GCP-D1) 채택 여부. `NEXT_PUBLIC_API_BASE`는 `https://blog-api.prettylog.com` 유지 (§3.3 (4)) |
| O18 | ops-agent(~103 MB) 유지 / 중지 — 중지 시 GCP 모니터링·로그 상실 (§3.1) |
| O19 | VM `uname -m`(= `x86_64` 기대)·`ldd --version`·`node -v`(24.x) 출력 1회 (§3.4) |

## 8. Research 항목 상태 (rev2)

| # | 사실 | 상태 | 출처 |
| --- | --- | --- | --- |
| R1 | Cloud Run domain mapping | resolved: Preview, not production-ready, 10 리전 → A-DM 탈락 | S-GCP-14 |
| R2 | LB forwarding rule 고정비 | resolved(partial): ≈ $0.025/h ≈ $18/월 | S-GCP-17 (snippet) |
| R3 | Cloudflare Free Host override | resolved: 불가 (Enterprise; Snippets Pro+) | S-GCP-15, S-GCP-16 |
| R4 | Cloud Run 무료 할당 + min=1 비용 | resolved: 2M/180k/360k/1 GB, billing account당 공유; idle vCPU 단가 secondary | S-GCP-1, S-GCP-5/6 |
| R5 | e2-micro 무료 조건 | resolved: 1대·3 리전·30 GB PD·1 GB egress; spec은 aggregator | S-GCP-1, S-GCP-38 |
| R6 | GCP → Cloudflare egress | partial: CDN Interconnect NA $0.08/GB(secondary), Cloudflare 파트너 여부 [STALE] | S-GCP-9, S-GCP-8 |
| R7 | Secret Manager 무료 | resolved: 버전 6 / 접근 1만 | S-GCP-1 |
| R8 | Supabase pooler 상한 | resolved: Free/Nano pooler client 200, direct 60 → B의 `max: 5`는 여유 | S-GCP-48, S-GCP-49 |
| R9 | CF Free Cache Rules 헤더 매칭 | resolved: 헤더·쿠키 매칭 + Bypass 가능; 키 커스텀만 Enterprise | S-GCP-45/46/47 |
| R10 | Firebase App Hosting | resolved: Blaze, 10 GiB, Next 16 [CONFLICT], Express 보증 없음 | S-GCP-12/13/32 |
| R11 | e2-micro 외부 IPv4 요금 | partial: $0.005/h ≈ $3.65/월(verified); 무료 tier 포함 여부 [CONFLICT] → B 월 비용 $0–3.65 | S-GCP-41/42/43 |
| R12 | Cloud NAT 단가 | **open** (§3.3 (2)-b 선택 시에만 필요) | — |

실측 대상(연구 불가): Next 16 + Express RSS가 1 GB에 들어가는지 → §3.1 게이트, VM에서 읽는다.
