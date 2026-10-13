# GCP 호스팅 설계 (DRAFT, system-architect, 2026-10-12)

> 상태: 설계 초안 rev2 (2026-10-12, research 반영). 전략 선택은 오너.
> GCP 숫자 출처 = `_docs/gcp-hosting.research.md`의 `S-GCP-n`. 이 문서는 숫자를 그 id로 인용한다.
> rev1 → rev2 변경: 권고 A → **B**. 이유는 §3 "rev2 판정".

## 0. Mission block (DRAFT — 오너가 정한다; 확정 후 pm이 `00.plan.md`에 기록, 이 문서는 인용만)

- Mission: (오너 미정) — 기존 `00.plan.md`에 블록 없음.
- Vision (DRAFT): `my.prettylog.com`과 `blogapi.prettylog.com`이 Vercel 없이 GCP 오리진에서 200을 응답하고, 공개 트래픽은 Cloudflare 엣지가 흡수한다.
- Constraints: 스키마/DB(Supabase)·이미지 저장소(OCI) 불변 · soft-delete · 로컬 실행 금지(`~/.claude/CLAUDE.md` "No local execution") → 이미지 빌드는 원격(CI)에서만 · CF2 MUST ①–③ 유지 · pnpm only.
- G1 (DRAFT): 두 호스트 모두 HTTP 200 복구; measure `curl -sI` 200 + `server: cloudflare`(my.) by <오너 날짜>.
- G2 (DRAFT): 월 GCP 청구액 ≤ <오너 금액> (예: $0–5); measure Billing 리포트 by 첫 청구월.
- S1 → G1, G2: A/B/C 중 하나 (§3, 오너 선택).
- M1 → S1: MVP1 계약 + 원격 빌드; exit = §5 MVP1 exit; cycle 0/2; recovery 0/2.

## 1. 현재 구조와 목표 구조

```
현재 (둘 다 402)                              목표
browser ──DNS-only──► Vercel(my.)  ──┐        browser ──CF proxied──► GCP origin(my.)   ──┐
browser ──DNS-only──► Vercel(blogapi.)◄┘      browser ──CF(§4 결정)─► GCP origin(blogapi.)◄┘
                 Vercel edge = s-maxage 캐시           Cloudflare edge = 유일한 공유 캐시
both ──► Supabase pooler(6543) · OCI(blog-assets., CF Worker) — 불변
```

## 2. Part A — Vercel 결합 목록

출처: grep(node_modules, `x_*`, `_docs/archive` 제외) + 파일 읽기. `.env.example` 읽기는 권한 거부 → env 목록은 `env.schema.ts` 기준.

| # | file:line | 결합 | GCP에서 필요한 것 |
| --- | --- | --- | --- |
| 1 | `apps/dashboard_server/vercel.json:3` | `installCommand` (Vercel 빌드) | Dockerfile의 `pnpm install --frozen-lockfile` (corepack, `packageManager` 핀) |
| 2 | `apps/dashboard_server/vercel.json:4` | `@repo/types build` + `check-types`만 실행; TS 번들은 `@vercel/node`가 함 | Dockerfile: `pnpm --filter @repo/types build` → `pnpm --filter dashboard_server build`(`tsc && tsc-alias`) → `node dist/src/index.js`. 이 경로는 prod에서 한 번도 안 돌았다 |
| 3 | `apps/dashboard_server/src/utils/tree.utils.ts:1-7` | `ETreeNodeType`를 **값**으로 import; `@repo/types` `main`=`./dist/index.js` | #2의 `@repo/types build` 필수. 빠지면 부팅은 되고 카테고리 요청에서 throw |
| 4 | `apps/dashboard_server/vercel.json:5-8` | `includeFiles: @img+sharp-*linux*` (sharp libvips 동봉) | 리눅스 이미지 안에서 `pnpm install` → 해당 플랫폼 바이너리가 자연히 설치. 베이스 이미지 libc(glibc/musl) 일치 필요 |
| 5 | `apps/dashboard_server/vercel.json:10-12` | rewrite `/(.*)` → `/api` | 불필요 (`listen()`이 전 경로 처리) |
| 6 | `apps/dashboard_server/api/index.ts:1-6` | `@vercel/node` 핸들러 export | 불필요. 진입점 = `src/index.ts:18` `app.listen(SERVER_PORT)` + SIGTERM 종료(이미 있음). 파일은 `x_` 처리 후보 |
| 7 | `apps/dashboard_server/src/config/env.schema.ts:30` | `PORT` default 4000 | Cloud Run이 `PORT` 주입 → 그대로 동작. VM은 명시 설정 |
| 8 | `apps/dashboard_server/src/config/env.schema.ts:46-50` | `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` = Vercel↔Supabase 통합이 자동 주입 | 같은 이름으로 수동 등록(Secret Manager 또는 VM env 파일). 이름 유지 → 코드 변경 0 |
| 9 | `apps/dashboard_server/src/config/env.schema.ts:7-9` | 주석 "On Vercel there is no .env.local" | 이미지에 `.env*` 미포함(`.dockerignore`) |
| 10 | `apps/dashboard_server/src/database.ts:3-6,33` | `max: 5` 근거 = Vercel Fluid Compute | Cloud Run: 5 × 인스턴스 수 → `--max-instances` 상한으로 묶는다 (Google 권고 시작값 3, S-GCP-27). VM: 5 고정. Supabase pooler 상한은 GCP research 범위 밖 → R8 open (B에선 5 고정이라 영향 작음) |
| 11 | `apps/dashboard_server/src/controllers/posts/posts.cache.ts:6-7,12` | `public, s-maxage=86400` — Vercel 엣지가 받아 주던 캐시 | GCP 오리진 앞에 공유 캐시 없음 → §4 결정 (blogapi 프록시 여부) |
| 12 | `…/posts/posts.cache.ts:20` | `Vary: Authorization` 의존 | Cloudflare는 Vary로 키를 나누지 않음(CF2-3 MUST ③) → 엣지 bypass 룰로 대체 (§4) |
| 13 | `apps/dashboard_server/src/server.ts:9-12`, `env.schema.ts:73,130` | `ALLOWED_ORIGINS` = CORS + Clerk `authorizedParties` | 값 `https://my.prettylog.com` 유지 (도메인 불변). `*.run.app` 테스트 시 임시 추가 |
| 14 | `apps/dashboard_server/src/server.ts` (부재) | `trust proxy` 미설정 | CF/LB 뒤에서 `req.ip` 부정확. 현재 IP 사용처 없으면 보류 (낮음) |
| 15 | `apps/dashboard_server/tsconfig.json:2`, `decisions.plan.md:51-62` | `@vercel/node` ts-node 제약으로 strict 인라인 | 제약 소멸. 그대로 둔다(최소 diff). 결정 문서는 pm이 "obsolete" 표기 |
| 16 | `apps/dashboard_server/package.json:12` | `start:pm2` | 쓰지 않는다 (B도 Docker 이미지로 배포). 그대로 둔다 |
| 17 | `apps/dashboard_client_web/next.config.ts:46` (부재) | `output: 'standalone'` 없음 (Vercel은 불필요) | 추가 필요 + `outputFileTracingRoot` = 모노레포 루트 (`node-linker=isolated`, `.npmrc:2`) |
| 18 | `apps/dashboard_client_web/package.json:11` | `next start -p 3000` 포트 하드코딩 | standalone `server.js`는 `PORT`/`HOSTNAME=0.0.0.0` env를 읽음 → 이를 진입점으로 |
| 19 | `apps/dashboard_client_web/next.config.ts:5-9` | 빌드 진단 로그 (Vercel 로그 redaction 전제) | 동작 무관. 그대로 |
| 20 | `apps/dashboard_client_web/next.config.ts:49-57` | `images.unoptimized: true` (Vercel 옵티마이저 우회) | 유지. 컨테이너에서도 `/_next/image` CPU 소모 회피 |
| 21 | `apps/dashboard_client_web/env.schema.ts:24-57`, `app/layout.tsx:43-44` | `NEXT_PUBLIC_*` = `next build` 시점에 번들에 박힘; default가 prod 값이라 누락이 숨겨짐 | Docker **build arg**로 전달 (`API_BASE`, `CDN_ASSETS`, `SITE_URL`, `CLERK_PUBLISHABLE_KEY`, `DEFAULT_BLOG_AUTHOR`, `GOOGLE_*`). 런타임 secret 아님 |
| 22 | `@clerk/nextjs` 내부 (`proxy.ts:24`) | `CLERK_SECRET_KEY`를 grep에 안 보이게 암묵 읽기 | Next 컨테이너 **런타임** secret으로 주입. 누락 시 미들웨어 전 경로 실패 |
| 23 | `apps/dashboard_client_web/app/actions/*.action.ts` (2개) | Server Actions: Origin ↔ Host(`x-forwarded-host`) 비교 | 오리진이 받는 Host가 `my.prettylog.com`이어야 함. Host가 `*.run.app`로 바뀌는 경로(Worker)면 `serverActions.allowedOrigins` 필요. 다중 인스턴스면 고정 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 필요(S-GCP-21). B(단일 프로세스, Host 보존)는 둘 다 불필요 |
| 24 | `apps/dashboard_client_web/app/sitemap.ts:23`, `…/opengraph-image.tsx:20,23` | ISR `revalidate=86400` = Vercel Data Cache(공유·영속) | Cloud Run: `.next/cache` 인스턴스별·휘발, 디스크가 RAM(S-GCP-18, S-GCP-21), revalidate 재생성은 응답 뒤 CPU 제한 구간에서 돈다(S-GCP-19). VM: 디스크 영속·단일 인스턴스 → 문제 없음. 어느 쪽이든 CF2-2 엣지 24h가 실제 캐시 → custom cacheHandler 안 만듦(YAGNI) |
| 25 | `apps/dashboard_client_web/instrumentation.ts:17-41` | `onRequestError` → Express `/v1/api/error-logs` | 플랫폼 무관. Node 런타임에서 동작. 변경 없음 |
| 26 | `apps/dashboard_client_web/proxy.ts:30-39` | Clerk 미들웨어 matcher (Vercel 미들웨어 런타임) | standalone 서버에서도 실행. 변경 없음 |
| 27 | Clerk Production instance (`my.prettylog.com`) | 도메인 기반 키 | 도메인 불변 → 변경 없음. Clerk DNS 레코드(`clerk.` 등) 건드리지 않는다 |
| 28 | `.github/workflows/ci.yml:18-26` | 검사만; **배포 단계 없음** (Vercel Git 통합이 배포) | CI/CD 신규: 이미지 빌드 + push + deploy. 로컬 빌드 금지 규칙상 원격 필수 |
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

| 항목 | A — Cloud Run ×2 (scale-to-zero) | B — e2-micro VM 1대 (Caddy + 2 프로세스) | C — Firebase App Hosting(Next) + Cloud Run(Express) |
| --- | --- | --- | --- |
| 배포 형태 | 서비스 2개: `blog-web`(Next standalone), `blog-api`(Express). `min=0`, `max=2`(Google 권고 ≤3, S-GCP-27). 무료 할당은 billing account당 1개를 두 서비스가 공유(S-GCP-1) | VM 1대(us-west1/us-central1/us-east1만 무료, S-GCP-1): Caddy :443 → Next :3000, Express :4000. Docker compose (산출물이 이미지이므로; pm2 안 씀) | Next = App Hosting(관리형 빌드·롤아웃), Express = Cloud Run |
| Dockerfile | 2개 (multi-stage, `pnpm deploy`/standalone) | 2개 (같은 것 재사용) + `compose.yml` + `Caddyfile` | Express 1개. Next는 `apphosting.yaml` |
| Cloudflare 앞단 | 위 하위안 A-LB / A-Worker / A-FH 중 하나 (A-DM 탈락) | A 레코드 → VM 고정 IP, proxied. TLS = Cloudflare Origin CA cert, SSL "Full (strict)". Host 자연 유지 | App Hosting 커스텀 도메인 + Cloud CDN(S-GCP-12) → Cloudflare 이중 캐시. Next 16 지원 [CONFLICT](S-GCP-13 vs S-GCP-32), Express "not guaranteed"(S-GCP-13) |
| 캐시 | ISR 인스턴스별·RAM·휘발, 재생성 CPU 제한(#24); `max>1`이면 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 고정 필요(S-GCP-21); CF 엣지가 본 캐시 | ISR 디스크 영속·단일 인스턴스 → Vercel과 가장 비슷 | ISR = App Hosting이 관리; CF2 룰과 상호작용 검증 필요 |
| Secrets | Secret Manager → `--update-secrets`, 버전 고정(S-GCP-40). 무료 = 활성 버전 6개/월, 접근 1만 회/월(S-GCP-1). secret이 6개를 넘으므로(O9) JSON secret 1–2개로 묶는다 | VM의 root-only env 파일(또는 Secret Manager를 부팅 시 fetch) | Secret Manager (App Hosting 연동) |
| CI/CD | GH Actions + Workload Identity Federation → Artifact Registry → `gcloud run deploy` | GH Actions(`google-github-actions/auth@v3`, Direct WIF, S-GCP-30)가 이미지 빌드 → Artifact Registry(무료 0.5 GB, cleanup "keep 2", S-GCP-1, S-GCP-31) → IAP ssh로 `docker compose pull && up -d`. 1 GB VM에서 `next build` 금지 | App Hosting은 GitHub 연동 자동 빌드; Express는 A와 동일 |
| 롤백 | 이전 revision으로 트래픽 100% (초 단위) | 이전 이미지 tag로 `compose up` (분 단위) | App Hosting rollout 롤백 + Cloud Run revision |
| 콜드스타트 | 있음 (Next SSR 수 초). 익명 트래픽은 CF HIT로 흡수; 로그인 사용자·API는 체감. `min=1`이면 해소되나 idle 과금(request-based idle vCPU $0.0000025/s, S-GCP-5/6 secondary; 1 vCPU 상시 ≈ $6.6/월 vCPU분, 산수) | 없음 | Next·Express 모두 있음 |
| 비용 위험 | 무료 = 2M req, 180k vCPU-s, 360k GiB-s, egress 1 GB/월(S-GCP-1). **spend cap budget GA, Cloud Run 대상**(S-GCP-28) → 상한 초과 시 신규 사용 정지(즉시 아님; egress 포함 여부 미기재) + `max-instances` | VM·30 GB PD 무료, egress 1 GB/월(S-GCP-1). spend cap 대상 아님 → alerts-only budget(S-GCP-25). **외부 IPv4 요금: research에 없음 → R11 open** | Blaze + 10 GiB 무료 후 $0.15–0.20/GiB(S-GCP-12); Next 16·Express 지원 불확실 |
| 월 비용(고정분, 무료 할당 내 트래픽 가정) | A-LB ≈ $18+(S-GCP-17) · A-DM $0 (탈락) · A-Worker $0 (100k req/day 상한) · A-FH $0 (10 GB 초과 시 $0.15/GB) | $0 + 외부 IPv4(R11) + 1 GB 초과 egress | $0 + 10 GiB 초과분 |
| 운영 부담 | 낮음 (관리형) | 높음: OS 패치, 디스크, 메모리. 2 shared vCPU, 지속 0.25 vCPU, 1 GB RAM(S-GCP-38, aggregator) → §3.1 | 중간 |
| SPOF | 없음 | VM 1대 | 없음 |
| 목표 추적 | G1 강함, G2: A-LB 약함 / A-Worker·A-FH 중간(상한·이중 CDN) | G1 중간(메모리 위험), G2 강함 | G1 중간, G2 약함 |

### 3.1 오너 질문: "e2-micro 무료 1대에 Next 서버 1개 + Node 서버 1개?"

- **답: 가능할 가능성이 높지만 빠듯하다. 실측 전에는 확정할 수 없다.** research가 줄 수 있는 숫자가 아니다.
- 근거: research는 "one e2-micro could run both under one 1 GB budget"을 추론으로만 둔다(S-GCP-1, S-GCP-38). 무료 조건은 VM 1대·3개 리전·30 GB PD·egress 1 GB(S-GCP-1).
- 위험: (1) RAM 1 GB를 OS + Docker daemon + Caddy + Next + Express가 나눈다. Docker daemon RSS도 게이트 예산 안에 센다. (2) 지속 CPU 0.25 vCPU — OG 렌더(Satori)와 sharp 업로드가 버스트. OG는 CF 24h가 흡수.
- 설계 대응: 2 GB swap(PD 위) · 프로세스별 `--max-old-space-size` 상한 · `next build`는 절대 VM에서 안 함(CI 빌드) · `images.unoptimized` 유지(#20).
- **MVP2 게이트(B):** VM에서 Express 단독 RSS → Next 추가 후 RSS·swap 사용량을 읽는다. 기준(사전 등록): 정상 부하에서 swap-in 지속 없음 + p95 응답이 CF MISS 기준 2 s 이하. 실패 시 kill → A-FH로 전환.

### 3.2 rev2 판정

**최종 권고: B (e2-micro VM 1대, Caddy + Next + Express, Cloudflare proxied).** 이유 한 줄: Free Cloudflare에서 Host가 그대로 도착하는 유일한 $0 경로라, CF2 MUST ①–③과 단일 인스턴스 ISR·Server Actions가 코드 변경 없이 그대로 성립한다.

- A 계열 탈락/후순위 이유: A-LB는 고정 ≈ $18/월로 G2 위반 · A-DM은 Preview(정확성) · A-Worker는 CF2 룰을 Worker 코드로 재구현 + 전체 트래픽 100k/day 상한 · A-FH는 이중 CDN과 cert 동작 미검증.
- **listed alternatives (순서): B → A-FH → A-LB.** §3.1 게이트가 kill되면 A-FH. A-FH의 Host 보존·cert 동작은 미검증이므로, 실패하면 research가 검증한 유일한 경로 A-LB(≈ $18/월, S-GCP-14, S-GCP-17). C는 비권고 유지.
- rev1 대비 변경: rev1은 A 조건부였다. 조건("경첩이 고정비 또는 Preview")이 research로 충족되어 B로 전환한다.

## 4. 캐시 계층 — CF2 규칙과 blogapi 재평가

- **my.**: CF2-1/2/3 그대로 적용. MUST ① 쿼리 스트링 전체를 키에 포함 · ② `__session` 있으면 bypass(`__client_uat` 금지) · ③ Edge TTL "Override origin"(Next가 `private, no-store` 송출). 오리진만 GCP로 바뀐다.
- **CF2-1 선행 게이트**("402 해소 뒤에만 proxied")는 새 GCP 오리진이 200을 내는 순간 충족된다. 컷오버 순서에 흡수(§6).
- **blogapi. — CF2-4 재개 필요.** Vercel 엣지가 사라지면 `s-maxage=86400`(#11)을 받아 줄 공유 캐시가 없다. 모든 Next 렌더 fan-out(1–4 호출)과 브라우저 TanStack 호출이 오리진으로 간다.

| 선택지 | 내용 | 위험 |
| --- | --- | --- |
| 4-a (권고) | blogapi.를 proxied로 전환. Cache Rule: `GET /v1/api/*` 중 **`Authorization` 요청 헤더가 있으면 bypass**, 나머지는 Edge TTL = "Respect origin"(Express는 정확한 `s-maxage`/`private, no-store`를 보낸다). `Vary` 의존(#12)을 엣지 룰로 바꾸므로 CF2-4가 든 누출 이유가 해소된다 | 룰이 헤더 존재를 매칭할 수 있어야 함 — research 범위 밖(GCP 아님) → **R9 open**. AC: 토큰 요청 → `BYPASS/DYNAMIC`, 익명 2회 → `HIT` |
| 4-b | blogapi. DNS-only 유지 | 공유 캐시 0 → 오리진 부하 = 전량. B에선 0.25 vCPU VM이 모든 API 호출을 받고 Caddy가 공인 인증서(ACME)를 직접 받아야 함 |
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

MVP1 exit: GH Actions 잡 안에서 두 이미지가 빌드되고, 잡 안에서 secret 없이 컨테이너를 띄워 `/ping`(api)·`/robots.txt`(web) 200. web은 `/`가 아니라 `/robots.txt`로 본다: `proxy.ts:36` matcher가 점 포함 경로를 건너뛰어 Clerk 키가 필요 없고, API 호출도 없다. **로컬 빌드 없음.**

**MVP2 — 실 슬라이스 1개: Express 먼저.** 이유: `listen()`+SIGTERM이 이미 있음, ISR 상태 없음, 이미지가 가장 작음. Supabase pooler SSL·OCI 업로드(sharp)·Clerk 토큰 검증을 GCP egress에서 먼저 증명한다. `my.`는 hostname으로 부르므로 `blogapi.` 하나만 바꾸면 깨끗한 슬라이스다.
- 태스크 1 (B 기준): VM + Caddy(Cloudflare Origin CA cert) + `blog-api` 컨테이너 → VM IP에 `Host: blogapi.prettylog.com`으로 `/ping`, `GET /v1/api/posts?limit=5`, 카테고리 트리(#3 검증) 200. Express 단독 RSS 기록.
- 태스크 2: `blogapi.` DNS 전환 + §4 결정 적용.
- MVP3 직전 §3.1 메모리 게이트(Next 추가 후 RSS·swap)를 VM에서 읽는다. kill → A-FH.

**MVP3 — Next 이전.** `output:'standalone'`(#17) 추가 → `blog-web` 배포 → `my.` 전환 → CF2-2/3 룰. **#23 Server Actions** 동작 확인(글 발행).

**남는 것:** Vercel 프로젝트는 삭제하지 않고 정지 상태로 둔다(soft). `api/index.ts`, `vercel.json`은 MVP3 종료 후 `x_` 처리 — 그 전에는 DNS 롤백 대상의 설정으로 남긴다.

## 6. DNS 컷오버와 롤백

```
deploy(origin) ──► 오리진 직접 검증 ──► DNS TTL 60s로 낮춤 ──► CNAME/A 전환 + proxied
                    (curl, Host 헤더)                          │
                                                             ▼
                                         CF2-2/3 룰(my.) / §4 룰(blogapi.) ──► HIT/BYPASS AC
```

1. 오리진 직접 검증: `curl -sI https://<origin> -H 'Host: blogapi.prettylog.com'` → 200. (main session 또는 오너가 실행. agent는 실행하지 않는다.)
2. TTL 60s로 낮춘 뒤 전환. proxied 전환은 200 확인 후에만(CF2-1 게이트).
3. 전환 후: `curl -sI https://blogapi.prettylog.com/ping`, `https://my.prettylog.com` → 200, `server: cloudflare`.
4. **롤백 정직성:** Vercel은 402이므로 **살아 있는 fallback이 없다.** 롤백 = 이전 이미지 tag로 `compose up`(B, 분 단위; Artifact Registry에 최소 2개 유지) 또는 이전 revision(A). Vercel 쿼터가 리셋되면 DNS를 Vercel로 되돌리는 것이 2차 롤백이다(그때 CF 캐시 purge 필수 — 402 캐시 방지).

## 7. 오너가 제공할 것

| # | 항목 |
| --- | --- |
| O1 | 전략 선택: B(권고), 대안 순서 A-FH → A-LB; 그 밖에 A-Worker / C |
| O2 | GCP project id |
| O3 | 리전: B는 us-west1 / us-central1 / us-east1 중 하나만 무료(S-GCP-1). Supabase 프로젝트 리전과 가까운 곳 (Supabase 리전도 알려 주세요) |
| O4 | Billing account 연결 + budget alert 금액 (G2 상한). B는 alerts-only(S-GCP-25); A는 spend cap 가능(S-GCP-28) |
| O5 | 배포 실행자: GH Actions + Workload Identity Federation(권고) vs Cloud Build |
| O6 | Artifact Registry 저장소 이름 |
| O7 | Cloudflare 플랜 확인 (Free로 가정) + DNS 편집 권한 |
| O8 | §4 blogapi. 프록시 선택 (4-a/4-b/4-c) |
| O9 | secret 값 등록: `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `CLERK_SECRET_KEY`(양쪽), `STORAGE_*`, `SUPABASE_*` |
| O10 | Clerk Production instance가 `my.prettylog.com`에 그대로 남는지 확인 (변경 없음 가정) |
| O11 | G1/G2 날짜·금액, Mission 문장 |
| O12 | (B) VM OS 패치 책임 수용 + IAP ssh 배포 허용 여부 |
| O13 | §3.1 메모리 게이트 기준(swap-in 지속 없음, MISS p95 ≤ 2 s) 승인 — architect 초안 |

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
| R8 | Supabase pooler 상한 | **open** (GCP 범위 밖; B에선 영향 작음) | — |
| R9 | CF Free Cache Rules 헤더 매칭 | **open** (Cloudflare 범위; §4-a 착수 전 필요) | — |
| R10 | Firebase App Hosting | resolved: Blaze, 10 GiB, Next 16 [CONFLICT], Express 보증 없음 | S-GCP-12/13/32 |
| R11 | **e2-micro 외부 IPv4 요금** (무료 tier 포함 여부) | **open — research 파일에 없음. B의 월 비용을 결정** | — |

실측 대상(연구 불가): Next 16 + Express RSS가 1 GB에 들어가는지 → §3.1 게이트, VM에서 읽는다.
