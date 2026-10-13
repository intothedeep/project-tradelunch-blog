# 트래픽 통제 검증 설계 (DRAFT, system-architect, 2026-10-13)

> 상태: 설계 초안 rev2. 선택(§12)은 오너가 한다.
> rev2 (2026-10-13): §7.4 C7, §10 C14, §11.1, §12를 고쳤다. 5단계(`deploy/traffic/README.md`)는 모두 끝났다.
> 대상: `https://my.prettylog.com`(Next 16 standalone, PM2 `blog-web`), `https://blog-api.prettylog.com`(Express 5, PM2 `blog-api`).
> 실행 규칙: agent는 curl, ssh, 배포를 하지 않는다. 아래 명령은 오너 또는 main session이 실행한다(`00.tasks.md` Phase GCP 머리말).
> 테스트 러너(test runner)는 쓰지 않는다(`rules/core.md` Tests SUSPENDED). 검증은 실제 시스템에 대한 고의 파손(deliberate breakage)으로 한다.
> 출처 표기: 오너 측정 = 2026-10-13 Mac에서 curl 2회. "확인 필요(대시보드)" = Cloudflare Free 플랜 제공 여부를 확신하지 못한 항목.
> 오너용 5단계 실행표(진행 체크 포함): [`deploy/traffic/README.md`](deploy/traffic/README.md). 이 설계를 줄인 것이다.

## 0. Mission block (인용: 원본 `00.plan.md` "Phase GCP" #### Mission block. 원본이 이긴다)

> - Mission: (owner 미정, O11 → GCP-U1)
> - Vision (DRAFT, architect; owner 승인 대기): `my.`/`blog-api.`가 Vercel 없이 GCP 오리진에서 200을 내고, 공개 트래픽은 Cloudflare 엣지가 흡수한다.
> - Constraints: 스키마·Supabase·OCI 불변 · soft-delete · 로컬 실행 금지 → 빌드는 GH Actions에서만 · CF2 MUST ①–③ · pnpm only.
> - G1 (DRAFT): 두 호스트 HTTP 200 복구; measure `curl -sI` 200 + `server: cloudflare` by <owner date> (O11).
> - G2 (DRAFT): 월 GCP 청구 ≤ <owner amount>; measure Billing report by 첫 청구월 (O4/O11).
> - S1 → G1, G2: B — e2-micro VM 1대(us-central1), Next + Express를 PM2로 실행(빌드는 VM 밖, Docker 없음, #52), Cloudflare Tunnel 1개 + 공개 hostname 2개(#51) (picked: B, owner 2026-10-12); listed alternatives: A-FH → A-LB (#48).

- M1–M3 줄은 원본 `00.plan.md`에서 읽는다. 여기 옮기지 않는다.
- 이 설계와 닿는 곳: M2 tactic(§3.1 메모리 게이트), M3 exit의 CF2-2, CF2-3 AC(GCP-M3-3).

- 이 설계가 섬기는 줄: Vision의 "공개 트래픽은 Cloudflare 엣지가 흡수한다", 그리고 G2(월 청구).
- 오너 원문(2026-10-13): "I need to check if my cloudflare doing cache properly my web and api requests so I should not worry about over charged or server explosion."
- 오너 원문(2026-10-13): "design and plan to validate and verify traffic controls in my my.prettylog.com and apis".
- 목표 숫자(적중률 등)는 아직 오너 목표가 아니다. 초안은 §12 D1에 둔다.

## 1. 요청 흐름과 통제 위치

```
                          ┌──────────────── Cloudflare edge (Free) ─────────────────┐
 visitor / crawler /      │ C7 rate limit · C8 bot/WAF                              │
 GH Actions probe ───────►│ C1 web Cache Rules (W1–W4)   C2 api Cache Rules (A1–A2) │
                          │ C3 Tiered Cache   C4 purge(cf-purge.sh)                 │
                          │ C11 Analytics (HIT 포함 전체 요청 수)                    │
                          └───────┬───────────────────────── HIT ──► 응답 (VM 0 byte)
                                  │ MISS / BYPASS / DYNAMIC 만 내려간다
                                  ▼
                       Cloudflare Tunnel (1개, cloudflared.service)
                         │  응답 byte = GCP VM egress  ◄── C10 budget·egress metric
        ┌────────────────┴───────────────────┐
        ▼                                    ▼
 localhost:3000 Next (PM2 blog-web 320M)   localhost:4000 Express (PM2 blog-api 200M)
  C12 proxy.ts 요청 로그 (#58)              C5 Cache-Control 헤더 (posts.cache.ts)
  SSR fetch ─► https://blog-api... (#53)    C6 CORS 거부 · ?limit= clamp
   (CF를 다시 거친다: hairpin)               pino 요청 로그 (#55)
        └────────────── C9 PM2 cap · swap · Ops Agent host metrics ───────┘
                                    │
                                    ▼ (API MISS 때만)
                         Supabase pooler  ◄── C10 Supabase usage
 C13 weekly check (GH Actions): curl 표본 + Cloud Logging 집계 → issue 요약
 C14 부하 시험(load test, 오너 승인 시만): §10 세트 L1 HIT · L2 오리진 · L3 제한 발동
```

- HIT는 오리진에 오지 않는다. 그래서 VM 로그에는 HIT가 없다.
- 전체 요청 수는 Cloudflare Analytics(C11)만 안다.

## 2. 통제 표

| ID | 통제 | 지키는 것 | 위치 | 지금 상태 (오너 측정 2026-10-13) |
| --- | --- | --- | --- | --- |
| C1 | web Cache Rules W1–W4 | VM CPU·RAM, egress, 데이터 누출 | Cloudflare Cache Rules | 미적용: `/` DYNAMIC, OG DYNAMIC, robots EXPIRED |
| C2 | api Cache Rules A1–A2 (#54) | VM CPU, Supabase, egress, 누출 | Cloudflare Cache Rules | 미적용: posts API DYNAMIC |
| C3 | Tiered Cache | colo별 MISS 감소 → VM | Cloudflare Caching → Tiered Cache | 미확인 |
| C4 | purge 절차 | 발행 후 stale | `_scripts/cloudflare/cf-purge.sh` | 스크립트 있음, 실측 없음 |
| C5 | 오리진 Cache-Control | 엣지 정책의 원천, 누출 | Express `posts.cache.ts`, Next 라우트 | posts 3곳만 송출 |
| C6 | API 입력 방어 | Supabase 부하 | Express CORS, `?limit=` clamp | CORS 거부 → 403 + INSERT 0 (`corsRejection.ts`, developer 진행 중, 2026-10-13) |
| C7 | 요청 수 제한(rate limit) | cache 우회 폭주 → VM, Supabase | Cloudflare rule (`my.`) + Express backstop | 없음. 설계 §7.4 (rev2) |
| C8 | Bot Fight Mode / WAF custom | 스캐너, 봇 | Cloudflare Security | 미확인 |
| C9 | PM2 cap + swap + 메모리 관찰 | VM 폭발 | PM2, Linux, Ops Agent | cap 320M/200M, available ≈ 475 MiB |
| C10 | 비용 경보 | G2 청구 | GCP Billing, Monitoring, Supabase | budget 미생성(GCP-U3) |
| C11 | 엣지 적중률 보기 | 모든 C의 효과 측정 | Cloudflare Analytics | 미측정 |
| C12 | blog-web 요청 로그 (#58) | MISS의 출처 분석 | `proxy.ts` → PM2 → Ops Agent | 구현 중(developer) |
| C13 | 주간 자동 점검 | 통제가 계속 살아 있음 | GH Actions | `logging-review.yml`만 있음 |
| C14 | 부하 시험(load test) | HIT 흡수 증명, 오리진 용량 측정, 제한 발동 확인 | GH Actions + k6, 오너 승인 | 없음. 설계 §10 (rev2) |

## 3. C1: web Cache Rules (`my.`)

### 3.1 무엇을 지키나

- 익명 HTML, OG 이미지(OG image), sitemap, robots를 엣지에서 24h 서빙한다(오너 2026-09-22).
- 결과: VM CPU, RAM, egress가 MISS 몫만 남는다.

### 3.2 룰 (Cache Rules, 위에서 아래 순서. 뒤 룰이 앞 룰을 덮는다)

| # | 식(expression) 요지 | 동작 |
| --- | --- | --- |
| W1 | host `my.` and path in `/sitemap.xml`, `/robots.txt` | Eligible, Edge TTL Override 24h |
| W2 | host `my.` and path matches `/blog/*/*/opengraph-image` | Eligible, Edge TTL Override 24h |
| W3 | host `my.` and method GET and path not starts with `/_next/`, `/api/` | Eligible, Edge TTL Override 24h, 캐시 키 = 전체 쿼리(MUST ①), 상태 코드 TTL: 200만 24h |
| W4 | host `my.` and (`http.cookie contains "__session"` or path starts with `/write`, `/me`, `/settings`, `/admin`, `/onboarding` or (`rsc` 요청 헤더 있음 and 쿼리에 `_rsc=` 없음)) | Bypass cache |

- Browser TTL = Respect origin.
- `__client_uat`로는 bypass하지 않는다(MUST ②).
- `contains "__session"`은 Clerk의 `__session_<suffix>` 변형도 잡는다.
- W4의 보호 경로 목록은 `proxy.ts:4-10`의 `isProtectedRoute`와 같다. 한쪽만 바꾸지 않는다.
- 상태 코드 TTL(status code TTL)의 Free 제공 여부: 확인 필요(대시보드).
- 없으면 대안: W3에 `http.response.code` 조건을 쓸 수 없다. 이 경우 §3.4 R2가 남는다. 오너 결정 D4.

### 3.3 이 설계 전체가 기대는 가정 하나

- Next HTML은 `private, no-cache, no-store`를 보낸다(오너 측정).
- CF2-0b는 이를 Override origin으로 덮기로 했다. 아직 실측된 적이 없다.
- 그래서 MVP1 첫 검증은 이 가정이다(§11 MVP1-1).
- 실패하면(2회째도 DYNAMIC): HTML 캐시는 없다. OG, sitemap, robots만 남는다.
- 그때는 `recover` skill로 간다. 앱 쪽 헤더 변경은 CF2-0b가 기각한 길이라 architect 재설계가 필요하다.

### 3.4 정확성 위험

| ID | 위험 | 원인 | 막는 룰 | 고의 파손 시험 |
| --- | --- | --- | --- | --- |
| R1 | 로그인 사용자 화면이 익명 캐시에 들어감 | `__session` 요청이 캐시됨 | W4 | §3.6 B1 |
| R2 | Clerk handshake 307이 24h 캐시됨 | `__client_uat`만 있고 `__session` 없는 방문자 → `clerkMiddleware`가 307 | W3 상태 코드 TTL (200만) | §3.6 B2 |
| R3 | RSC 페이로드(RSC payload)가 HTML 자리에 캐시됨 | Cloudflare는 `Vary: rsc`로 키를 나누지 않는다 | W3 전체 쿼리 키 + W4 `rsc` 헤더 조건 | §3.6 B3, B4 |
| R4 | Next 500 페이지가 24h 캐시됨 | Override는 상태와 무관하게 캐시 | W3 상태 코드 TTL | 배포 중 관찰(§3.6 B6) |
| R5 | 새 글이 24h 안 보임 | 엣지 TTL 24h (오너 수용) | C4 purge | §6 |
| R6 | 임의 쿼리로 캐시 우회 | 전체 쿼리가 키다. `?x=1`, `?x=2`는 서로 다른 키 | 없음. C7이 상한 | §3.6 B5 |

- R6은 MUST ①의 대가다. 쿼리 제외(exclude) 설정은 `_rsc`를 깨뜨린다.
- 쿼리 키 "일부만 포함(include some)"의 Free 제공 여부: 확인 필요(대시보드). 쓰려면 앱의 실제 쿼리 이름 목록이 먼저 있어야 한다.

### 3.5 검증 (지금)

**무엇을 알려고 쓰나:** 익명 공개 URL이 2번째 요청에서 엣지 HIT가 되는가.

| 세트 | 대상 | 개수 |
| --- | --- | --- |
| web 표본 S-web | `/`, `/blog/@taeklim/rust-config`, 그 OG `/blog/@taeklim/rust-config/opengraph-image`, `/sitemap.xml`, `/robots.txt` | 5 URL |

```
curl #1 ──► MISS 또는 EXPIRED (colo가 처음 봄) ──► VM이 응답, 엣지가 저장
curl #2 ──► HIT ──────────────────────────────────► VM 미도달
```

**어떻게 하나:**

0. 이 문서의 모든 점검은 GET으로 헤더만 본다: `h() { curl -s -o /dev/null -D - "$@"; }`.
   - `curl -sI`는 HEAD를 보낸다. W3, A1은 `method eq "GET"`이라 HEAD에는 안 걸린다.
   - 그래서 `-I`로 재면 룰이 살아 있어도 `DYNAMIC`이 나올 수 있다.
   - `deploy/gcp/README.md` §7의 `curl -sI` 점검도 같은 이유로 `h`로 바꿔 읽는다.
1. URL마다 2회: `h "$U" | grep -iE '^(HTTP|cf-cache-status|content-type|set-cookie|age)'`.
2. 2번째 줄의 `cf-cache-status`를 읽는다.
3. 같은 URL에 `set-cookie` 줄 수를 센다.
4. 예(오너 측정, 룰 적용 전): `/`는 2회 모두 `DYNAMIC`. 룰 적용 후 기대: `MISS` → `HIT`.

**읽는 법:**

- `HIT`: 통과.
- `MISS` 2회 연속: 룰 미적중 또는 응답에 `Set-Cookie`. 룰 식과 헤더를 본다.
- `DYNAMIC`: 룰이 이 URL에 안 걸렸다. §3.3 가정 실패일 수도 있다.
- `EXPIRED` 2회 연속: 캐시는 되나 매번 재검증한다. Override TTL이 안 걸렸다.
- `BYPASS`: W4가 걸렸다. 익명 요청이면 룰 오류다.
- `set-cookie` 1줄 이상: 실패. CF2-0a 회귀다.

- robots.txt 메모: 측정된 `max-age=14400`은 4시간이다. Cloudflare 기본 Browser Cache TTL도 4시간이다.
- 그래서 그 값은 엣지가 고친 값일 수 있다(가설). 오리진 값은 VM 안에서 본다: `curl -s -o /dev/null -D - localhost:3000/robots.txt`.

### 3.6 고의 파손 (deliberate breakage)

**무엇을 알려고 쓰나:** 캐시하면 안 되는 요청이 정말 캐시를 피하는가.

| 시험 | 요청 | 기대 | 실패 뜻 |
| --- | --- | --- | --- |
| B1 | `h -H 'Cookie: __session=x' https://my.prettylog.com/` 2회 | `BYPASS` (또는 `DYNAMIC`) 2회 | R1 누출 경로 |
| B2 | 한 글 URL 단건 purge → `h -H 'Cookie: __client_uat=1700000000' <url>` → 쿠키 없이 `h <url>` | 3번째가 `HTTP/2 200` + `text/html` | R2: 307이 캐시됨 |
| B3 | `h '<url>'` 2회, `h -H 'RSC: 1' '<url>?_rsc=abc'` 2회 | 앞 쌍 `text/html` HIT, 뒤 쌍 `text/x-component` HIT | R3 (CF2-3 AC3) |
| B4 | 단건 purge → `h -H 'RSC: 1' '<url>'`(쿼리 없음) → `h '<url>'` | 2번째가 `text/html` | R3 오염(poisoning) |
| B5 | `h '<url>?x=1'`, `h '<url>?x=2'` | 둘 다 `MISS` (HIT 아님) | 정상. R6이 실재함을 보인다 |
| B6 | 보호 경로 `h https://my.prettylog.com/me` 2회 | `BYPASS` 또는 `DYNAMIC` | W4 경로 누락 |

- W4의 `rsc` 헤더 조건과 상태 코드 TTL은 Free 제공 여부에 기댄다. 둘 다 확인 필요(대시보드).

- 단건 purge: `./_scripts/cloudflare/cf-purge.sh <url>`.
- B2, B4는 purge 직후 첫 요청이 그 키를 채우는 시험이다. 순서를 지킨다.
- B5는 실패 시험이 아니다. "쿼리 우회는 VM에 닿는다"를 기록한다.

### 3.7 계속 살아 있는가

- C13 주간 점검이 S-web 5 URL과 B1, B3을 매주 돈다(§9).

## 4. C2: api Cache Rules (`blog-api.`, #54 = 4-a)

### 4.1 룰 (`deploy/gcp/README.md` §7)

| # | 식 | 동작 |
| --- | --- | --- |
| A1 | host `blog-api.` and method GET | Eligible, Edge TTL Respect origin |
| A2 | host `blog-api.` and `authorization` 요청 헤더 있음 | Bypass |

- 인증은 `Authorization` 헤더 하나다. `requireAuth.ts:10`, `optionalAuth.ts:10`이 `req.headers.authorization`만 읽는다.
- 쿠키 토큰 경로는 찾지 못했다. 따라서 A2가 누출 경로를 모두 덮는다.
- 예외 메모: `middlewares/csrf.js`가 `csrf({ cookie: true })`다. 어느 라우트가 쓰는지는 확인 필요(developer grep).

### 4.2 정확성 위험

| ID | 위험 | 원인 | 고의 파손 시험 |
| --- | --- | --- | --- |
| R7 | 인증 응답이 공유 캐시에 들어감 | A2 누락 | `h -H 'Authorization: Bearer x' '…/v1/api/posts?limit=1'` 2회 → `BYPASS`/`DYNAMIC` |
| R8 | Cache-Control 없는 GET이 기본 TTL로 캐시됨 | A1은 `/v1/api/*` 전체. `setPostReadCache`는 posts 3파일만 부른다 | `h '…/v1/api/posts/<id>/comments'` 2회 → 2번째 `HIT`면 R8 실재 |
| R9 | CORS 헤더가 첫 요청의 것으로 굳음 | `cors`는 요청 `Origin`을 그대로 돌려준다. Cloudflare는 `Vary: Origin`으로 키를 나누지 않는다 | 단건 purge → `Origin` 없이 curl(SSR과 같음) → `-H 'Origin: https://my.prettylog.com'` curl → `access-control-allow-origin` 줄 확인 |
| R10 | 발행 후 피드 stale 24h | `s-maxage=86400` | §6 purge |

- R8 대상 라우트(grep, optionalAuth 또는 무인증 GET): comments 목록, `log` 3개, `tags`, `/status`, `/health`, `/:id/like`.
- Cloudflare가 헤더 없는 200에 주는 기본 엣지 TTL: 확인 필요(Cloudflare 문서 "Default cache behavior").
- R8 영향: 익명 방문자가 새 댓글, 새 log를 늦게 본다. 누출은 아니다(인증 요청은 A2).
- R9 영향: SSR이 먼저 채우면 ACAO 없는 사본이 남는다. 브라우저의 같은 URL 호출이 CORS로 막힌다.
- R9가 실제 문제인지는 브라우저가 SSR과 같은 GET URL을 부르는지에 달렸다. B 시험으로 확정한다.

### 4.3 검증 (지금)

**무엇을 알려고 쓰나:** 익명 posts API는 HIT, 토큰 요청은 캐시를 피하는가.

| 세트 | 대상 | 개수 |
| --- | --- | --- |
| api 표본 S-api | `/v1/api/posts?limit=1`, `/v1/api/posts/slug/rust-config`, `/ping` | 3 URL |

**어떻게 하나:**

1. URL마다 2회 `h "$U"`(§3.5 step 0). `cf-cache-status`, `cache-control`을 읽는다.
2. 예(오너 측정, A1 적용 전): `posts?limit=1` = `public, s-maxage=86400` + `DYNAMIC` 2회.
3. A1 적용 후 기대: 2번째 `HIT`, `age` 값 증가.
4. `/ping`은 Cache-Control이 없다. R8 판정용 대조군이다.

**읽는 법:**

- posts 2번째 `HIT`: 통과.
- posts `DYNAMIC`: A1 미적용 또는 식 오류.
- `/ping` 2번째 `HIT`: R8 실재. D3 결정이 필요하다.
- 토큰 요청 `HIT`: 실패. 즉시 A1을 끄고(4-c 상태) 원인을 본다.

## 5. C3: Tiered Cache

- 지키는 것: VM. colo마다 첫 MISS가 오리진에 가는 것을 상위 colo 하나로 모은다.
- 위치: Cloudflare → Caching → Tiered Cache → Smart Tiered Cache.
- Free 제공 여부: 확인 필요(대시보드).
- 검증: 대시보드에서 켜짐 확인. 효과는 C12 로그의 같은 URL MISS 횟수로 본다.
- 읽는 법: 같은 URL이 하루에 여러 번 `blog-web` 로그에 나오면 colo별 MISS다.

## 6. C4: purge 절차 (발행 후 stale)

**무엇을 알려고 쓰나:** purge 뒤 새 내용이 보이고, 캐시가 다시 채워지는가.

| 세트 | 대상 | 개수 |
| --- | --- | --- |
| purge 표본 | `https://my.prettylog.com/`, `https://blog-api.prettylog.com/v1/api/posts?limit=1` | 2 URL |

```
cf-purge.sh ──► curl #1 MISS ──► curl #2 HIT
```

**어떻게 하나:**

1. `./_scripts/cloudflare/cf-purge.sh` (전체, zone `prettylog.com` = 두 host 모두).
2. 표본 URL마다 curl 2회.
3. 기대: `MISS` → `HIT`.

**읽는 법:**

- `MISS` → `HIT`: 통과.
- 1번째가 `HIT`: purge가 안 됐다. 스크립트 출력의 `success`를 본다.
- api가 purge 안 됨: zone이 다르다. 같은 zone이면 일어나지 않는다.

- 발행 순서: 발행 → purge 전체 1회. HTML과 API를 따로 purge하지 않는다.
- 이유: HTML만 purge하면 MISS가 stale API HIT로 다시 채워진다.
- 자동 purge는 CF2-5b(DEFERRED)로 둔다.

## 7. 오리진 보호 (C5–C9)

### 7.1 그래도 VM에 닿는 요청

| 경로 | 예 | 막는 것 |
| --- | --- | --- |
| 키별·colo별 첫 MISS | 새 글 첫 방문 | C3 |
| 쿼리 우회 (R6) | `/?x=<random>` | C7 |
| 위조 bypass | `Cookie: __session=x`, `Authorization: Bearer x` | C7. 위조해도 데이터는 익명이다 |
| `/_next/` 외 정적 파일 아닌 경로, 404 | 스캐너 `/wp-login.php` | C8, 404 짧은 캐시(D4) |
| Next `/api/*` route handler | `/api/posts/load-more` | 내부에서 API를 부른다 → C2 HIT |
| POST, Server Actions | 발행, 댓글 | 로그인 사용자만. 소량 |
| SSR hairpin | Next → `blog-api.` (#53) | C2 HIT. MISS면 egress 2배 |

- 핵심: 캐시는 정상 트래픽을 흡수한다. 악의적 우회는 C7만 막는다.
- `/_next/image`는 쓰이지 않는다. `next.config.ts:66`이 `images.unoptimized: true`다(확인함, 2026-10-13).
- 그래서 이미지 최적화(image optimization) 경로는 오리진 부하가 아니다. 이미지는 `blog-assets.`에서 바로 온다.

### 7.2 C5: 오리진 Cache-Control

- 위치: `posts.cache.ts`. 익명 = `public, s-maxage=86400`, 인증 = `private, no-store`, `Vary: Authorization`.
- R8 해결 선택지(D3):

| 안 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A (권고) | Express `/v1`에 기본 `Cache-Control: private, no-store`. posts 라우트가 덮어쓴다 | 새 라우트도 기본 안전. 정책이 코드에 있다 | 코드 변경 1곳, 배포 필요 |
| B | A1 식을 posts 경로로 좁힘 | 코드 변경 0 | 새 캐시 라우트마다 룰 수정. 정책이 두 곳 |

### 7.3 C6: API 입력 방어

- `?limit=` clamp(CF2-S4): feed 1000, user-feed 50.
  - 검증: `curl -s '…/v1/api/posts?limit=99999'`의 항목 수 ≤ 1000.
- CORS 거부(R11): `server.ts:25`가 throw → `errorHandler.ts:12` "one INSERT" → 500.
  - 결과: 낯선 `Origin` 요청 1건 = Supabase 쓰기 1건. 증폭 경로다.
  - 고의 파손: `curl -s -o /dev/null -w '%{http_code}' -H 'Origin: https://evil.example' https://blog-api.prettylog.com/ping` → `500`.
  - 이어서 Supabase `error_log`의 그 시각 이후 행 수를 본다. 1 증가면 R11 실재.
  - 주의: `Origin` 없는 curl은 허용된다(`server.ts:22`). 일반 curl 점검은 이것을 못 본다.
- R9, R11 해결 설계 단위 U-CORS: 낯선 Origin은 CORS 헤더 없이 통과(403 또는 무헤더). INSERT 0. 허용 origin이 하나면 ACAO를 고정값으로 보낸다.
  - AC 초안: 위 curl → `500` 아님, `error_log` 증가 0. purge 후 무Origin → Origin 순서에서 ACAO 존재.
- 진행 상황(2026-10-13): developer가 `corsRejection.ts`로 고치는 중이다. 낯선 Origin → 403, INSERT 0. 이 rev는 다시 설계하지 않는다.

### 7.4 C7: 요청 수 제한(rate limit) (rev2)

**무엇을 지키나:** 캐시를 피해 오리진에 닿는 요청(§7.1)이 한 IP에서 몰려 VM과 Supabase를 누르는 것.

```
                       ┌──────────── Cloudflare edge ────────────┐
 client ──────────────►│ L-a "web rate limit" (host my. 만)       │── 차단 시 429, VM 0 byte
                       │   /_next/ 제외, 검증된 봇 제외            │
                       │ Cache Rules: HIT ─► 응답 (제한 대상 아님)│
                       └─────────┬───────────────────────────────┘
                                 │ MISS / BYPASS 만
          ┌──────────────────────┴───────────────────┐
          ▼                                          ▼
   Next blog-web (in-process 제한 없음)        Express blog-api
     SSR fetch ─► Cloudflare ─► ────────────►  L-b backstop (메모리, IP별)
     x-origin-key 헤더 = SSR 표시               x-origin-key 일치 → 제외
                                                   │ 통과
                                                   ▼
                                              Supabase (pooled pg)
```

- 층은 둘이다. L-a는 엣지, L-b는 오리진 안이다.
- L-c는 "제한하지 않는 것" 목록이다.
- 모든 숫자는 가안(provisional)이다. §7.4.4 규칙으로 14일 뒤 다시 정한다(D5).

#### 7.4.1 Free 플랜에서 먼저 확인할 것 (RL-0, 오너 대시보드)

| 항목 | 이 설계의 가정 | 상태 |
| --- | --- | --- |
| rate limiting 규칙 수 | 1개 | 확인 필요(대시보드) |
| 세는 기준(characteristics) | IP만 | 확인 필요(대시보드) |
| 기간(period) | 10 s | 확인 필요(대시보드) |
| 차단 시간(mitigation timeout) | 10 s | 확인 필요(대시보드) |
| 동작(action) | Block, Managed Challenge | 확인 필요(대시보드) |
| 식에 쓸 수 있는 필드 | `http.host`, `http.request.uri.path`, `cf.client.bot` | 확인 필요(대시보드) |
| 캐시 HIT도 세는가 | 센다고 가정 (보수적) | 확인 필요(대시보드) |
| log 전용 동작 | 없다고 가정 | 확인 필요(대시보드) |
| 응답 코드 지정 | 기본 429 | 확인 필요(대시보드) |

- 오너가 Security → WAF → Rate limiting rules 화면의 값을 이 표에 적는다.
- `cf.client.bot`을 쓸 수 없으면 그 조건만 뺀다. 규칙은 만든다.
- `http.host`를 쓸 수 없으면 L-a를 만들지 않는다. 경로만으로는 세 host(`my.`, `blog-api.`, `blog-assets.`)를 가를 수 없다. D5로 돌아간다.

#### 7.4.2 L-a: Cloudflare 규칙 "web rate limit" (`my.`만)

```text
(http.host eq "my.prettylog.com"
  and not starts_with(http.request.uri.path, "/_next/")
  and not cf.client.bot)
```

| 칸 | 값 | 이유 |
| --- | --- | --- |
| 대상 host | `my.`만 | `blog-api.`의 SSR 호출은 모두 VM IP 하나에서 온다(#53). 엣지에서 IP로 세면 사이트가 자기 SSR을 막는다 |
| 대상 method | 전부 | POST, Server Actions도 오리진에 닿는다 |
| 제외 | `/_next/` | 한 페이지가 정적 청크(chunk)를 수십 개 받는다. 모두 HIT이고 immutable이다 |
| 제외 | `cf.client.bot` | 검증된 크롤러(Googlebot 등)의 sitemap 순회 |
| 세는 것 | IP당 요청 수 | Free 고정값(확인 필요) |
| 한도 (가안) | **100 요청 / 10 s** | 아래 계산 |
| 동작 | **Block**, 10 s | 아래 이유 |

- 왜 이 경로인가: `my.`의 MISS는 Next SSR 렌더다. 가장 비싼 요청이다(blog-web cap 320M).
- 쿼리 우회(R6) `/?x=<random>`은 매번 MISS다. 이것을 막는 층이 L-a뿐이다.
- 왜 Challenge가 아닌가: RSC 요청(`?_rsc=`)과 클라이언트 `fetch`는 challenge HTML을 풀 수 없다. 앱 안 이동이 깨진다.
- Block 10 s는 짧고 분명하다. 사람은 다시 누르면 된다.
- 가안 100의 근거: 한 페이지가 링크 prefetch로 RSC 요청 수십 개를 낸다(추정, RL-0에서 측정). HIT도 센다고 가정하면 3배 여유가 필요하다.
- 공유 NAT(회사, 학교, 이동통신 CGNAT) 뒤 사용자는 IP 하나를 나눠 쓴다. 이것이 한도를 낮추지 않는 이유다.
- 한계: IP 하나당 제한이다. 많은 IP로 나눈 공격(distributed)은 못 막는다. Free에서 받아들이는 위험이다.

#### 7.4.3 L-b: Express backstop (오리진 안, 메모리 전용)

- 왜 필요한가: L-a는 `blog-api.`를 덮지 않는다. API 직접 폭주와 POST 스팸은 Supabase까지 간다.
- Next에는 in-process 제한을 두지 않는다. L-a가 `my.`를 덮는다. YAGNI다.
- Redis는 쓰지 않는다. 프로세스는 하나(PM2 fork 1개)라 메모리 Map으로 충분하다.

```
pinoHttp ─► rateLimit ─► cors ─► corsRejection ─► json ─► /ping, /v1 ─► errorHandler
             │ 429 + Retry-After (sendError, error_log INSERT 없음)
```

| 칸 | 값 |
| --- | --- |
| 위치 | `server.ts`에서 `pinoHttp` 바로 뒤, `cors()` 앞. 429도 요청 로그에 남는다 |
| 키 | `cf-connecting-ip` 헤더. IPv6는 /64 접두사로 묶는다 |
| 헤더 없음 | 제한하지 않는다(fail-open). localhost 호출이다 |
| 제외 | `x-origin-key` 헤더가 env `ORIGIN_SSR_KEY`와 같은 요청 (= Next SSR). 비교는 timing-safe |
| 틀리거나 없는 키 | 일반 클라이언트처럼 센다. 우회 수단이 아니다 |
| 창(window) | 고정 창(fixed window) 60 s |
| 한도 (가안) | 읽기(GET, HEAD, OPTIONS) **120 / 60 s**, 쓰기(그 밖) **30 / 60 s**, IP당 |
| 응답 | `429`, `Retry-After: <남은 초>`, `sendError` 봉투. DB 쓰기 없음(R11을 되살리지 않는다) |
| 모드 | env `RATE_LIMIT_MODE` = `off` / `log` / `enforce`. 시작은 `log` |
| `log` 모드 | 막지 않는다. 한도를 넘은 요청마다 warn 한 줄 `rate_limit` (bucket, count, limit) |
| 키 상한 | 50,000. 넘으면 새 키는 세지 않는다(fail-open) + 분당 warn 1줄 |

- 쓰기 한도를 따로 두는 이유: 쓰기는 Supabase INSERT, UPDATE가 된다. 읽기보다 비싸다.
- 정상 사용자의 오리진 GET은 적다. 익명 GET은 대부분 엣지 HIT라 Express에 안 온다.
- Express에 오는 것: MISS, `Authorization` 요청(오너), 쓰기다.
- 메모리 비용(추정, 미측정): 키 1개 ≈ 200 B (문자열 + 카운터 객체 + Map 칸). 버킷 2개면 ≈ 400 B.
- 상한 50,000 키 × 400 B ≈ 20 MB. blog-api cap 200M 안이다. 평소에는 분당 고유 IP 수 × 400 B다.
- 창이 바뀌면 Map을 통째로 새로 만든다. 지난 창의 키는 GC가 거둔다.
- fail-open 전제: :4000이 공개 인터넷에 열려 있지 않다. 그래야 `cf-connecting-ip` 위조가 불가능하다. 확인 필요(`gcp.design.md` 방화벽, 터널만 허용인지).
- 구현 계약(architect 선택): 순수 카운터 `utils/` 1개 + 미들웨어 `middlewares/rateLimit.ts` 1개. 의존성 없음.
- `express-rate-limit`를 써도 된다. 단 위 표의 모드, 키 상한, /64, SSR 제외를 모두 지켜야 한다. developer가 최신 안정판에서 확인한다.
- Next 쪽 변경: `apis/http.server.ts`가 `x-origin-key`를 붙인다. `http.core.ts`의 공용 `buildHeaders`에는 넣지 않는다(브라우저 번들 유출).
- 두 번째 서버 fetch: `apis/reportSsrError.server.ts:24-29`는 `POST /v1/api/error-logs`를 자기 헤더로 보낸다(확인함). 여기에도 `x-origin-key`를 붙인다.
- 이 endpoint가 인증 없이 열려 있다면 요청 1건 = INSERT 1건이다. 확인 필요(developer grep). 열려 있으면 외부 호출은 L-b 쓰기 버킷이 막는다.
- 이유: 붙이지 않으면 SSR 오류 폭주 때 VM IP의 쓰기 버킷(30 / 60 s)이 찬다. 오류 보고가 가장 필요할 때 막힌다.
- 메모리 실측: RL-3 배포 전후 `pm2 ls`의 blog-api 메모리를 적는다. 위 추정은 이 값으로 바꾼다.
- env 이름에 `NEXT_PUBLIC_`을 붙이지 않는다. 붙이면 키가 브라우저로 간다.
- Cloudflare 캐시 키는 요청 헤더를 보지 않는다. 그래서 이 헤더는 "api cache" 적중에 영향이 없다.
- blog-api 요청 로그에 두 필드를 더한다(D11): `req.ip` (= `cf-connecting-ip`), `req.ssr` (키 일치 여부).
- 지금 blog-api는 클라이언트 IP를 기록하지 않는다. `server.ts:57-60`의 serializer가 id, method, url만 쓴다.
- 그리고 `trust proxy`가 없다. `req.ip`는 cloudflared가 붙는 `127.0.0.1`이다. 그래서 헤더를 직접 읽는다.

#### 7.4.4 한도를 정하는 규칙 (14일 로그 뒤)

**무엇을 알려고 쓰나:** 정상 방문자가 IP 하나에서 짧은 창에 몇 번 요청하는가. 오리진은 몇 rps까지 버티는가.

| 한도 | 아래 한계 (정상을 막지 않음) | 위 한계 (오리진을 지킴) |
| --- | --- | --- |
| L-a `my.` / 10 s | max(3 × 로그의 IP·10 s 창 최댓값, 3 × N_page) | 0.5 × C_web × 10 |
| L-b 읽기 / 60 s | max(3 × 로그의 IP·분 최댓값, 10 × p99) | 0.5 × C_api × 60 |
| L-b 쓰기 / 60 s | max(3 × 쓰기 IP·분 최댓값, 10) | 0.5 × C_api × 60 |

- N = 14일. 주간 주기 두 번이다. 보존 30일(#57) 안이다.
- N_page: 오너가 브라우저 DevTools로 센다. `/`를 열고 10초 스크롤한다. host `my.`, `/_next/` 제외 요청 수다.
- N_page가 필요한 이유: 오리진 로그는 MISS만 본다. Cloudflare가 HIT도 세면 로그 값은 아래쪽으로 치우친다.
- C_web, C_api: §10 L2가 잰 오리진 용량(rps)이다.
- 정하는 법: 아래 한계 이상, 위 한계 이하에서 10 단위로 올림한다.
- 아래 한계 > 위 한계면: 조정 문제가 아니다. 정상 사용자와 오리진 보호가 충돌한다. 오너 결정이다.

명령 (Mac, 저장소 루트, `gcloud` 로그인). 출력은 숫자뿐이다. IP는 터미널 밖으로 나가지 않는다.

```sh
# 공용 꼬리: 창별 개수 → p50, p99, max (IP는 출력되지 않는다)
stats() { sort -n | awk '{v[NR]=$1} END {if(NR==0){print "windows=0";exit}
  p=int(NR*0.99); if(p<1)p=1; print "windows="NR, "p50="v[int((NR+1)/2)], "p99="v[p], "max="v[NR]}'; }

# L-a: blog-web, IP별 10초 창 (timestamp 앞 18자 = 초의 십의 자리까지)
gcloud logging read 'log_id("blog-web") AND jsonPayload.message="request"' \
  --project=mywebsite-511502 --freshness=14d --limit=500000 \
  --format='value(timestamp,jsonPayload.ip)' \
| awk -F'\t' '$2!="" {print substr($1,1,18), $2}' | sort | uniq -c | awk '{print $1}' | stats

# L-b 읽기: blog-api, IP별 1분 창, SSR 제외 (D11 배포 뒤. 필드 이름은 developer 구현을 따른다)
R='(jsonPayload.req.method="GET" OR jsonPayload.req.method="HEAD" OR jsonPayload.req.method="OPTIONS")'
gcloud logging read "log_id(\"blog-api\") AND jsonPayload.req.ip:* AND NOT jsonPayload.req.ssr=true AND $R" \
  --project=mywebsite-511502 --freshness=14d --limit=500000 \
  --format='value(timestamp,jsonPayload.req.ip)' \
| awk -F'\t' '$2!="" {print substr($1,1,16), $2}' | sort | uniq -c | awk '{print $1}' | stats

# L-b 쓰기: 같은 명령에서 "AND $R"을 "AND NOT $R"로 바꾼다

# 시험 시각 고르기: 시간대(UTC)별 blog-web 요청 수
gcloud logging read 'log_id("blog-web") AND jsonPayload.message="request"' \
  --project=mywebsite-511502 --freshness=14d --limit=500000 --format='value(timestamp)' \
| cut -c12-13 | sort | uniq -c
```

- 이 명령은 저장된 로그만 읽는다. 로컬 허용 범위다(`~/.claude/CLAUDE.md` "Allowed locally").
- `--limit=500000`이 결과를 자르면 `windows` 합이 실제보다 작다. 그때 `--freshness`를 7d로 두 번 나눈다.
- 빈 창은 세지 않는다. 그래서 p99는 "요청이 있던 창"의 p99다. 보수적(높은 쪽)이다.

**읽는 법:**

- `windows=0`: 기간 안에 로그가 없다. 한도를 정하지 않는다.
- `max`가 `p99`의 10배 이상: 한 IP가 튀었다. 그 창의 UA를 따로 본다(봇일 수 있다).
- `max`가 가안 한도의 1/3 이상: 가안이 정상 사용자를 막을 수 있다. 위 표로 다시 계산한다.

#### 7.4.5 L-c: 제한하지 않는 것

| 대상 | 이유 |
| --- | --- |
| `/_next/static` | 페이지마다 수십 개. immutable HIT. VM에 안 온다 |
| `blog-assets.` host (이미지) | OCI 원본 + 엣지 캐시. VM과 무관하다 |
| 엣지 HIT 일반 | 오리진 비용 0. L-b는 HIT를 볼 수조차 없다 |
| Next SSR → `blog-api.` (`x-origin-key`) | VM 자신이다. 막으면 모든 방문자가 깨진다 |
| `traffic-check.sh` 표본 (GET 약 20회) | 어느 한도보다도 훨씬 작다. 예외 규칙을 따로 두지 않는다 |

#### 7.4.6 롤백 (rollback)

| 층 | 끄는 법 | 걸리는 시간 |
| --- | --- | --- |
| L-a | Cloudflare 규칙 토글 off | 즉시 |
| L-b | VM `.env`에서 `RATE_LIMIT_MODE=off` → `pm2 restart blog-api --update-env` | 수 초 |
| `x-origin-key` | 키 불일치는 "일반 클라이언트로 센다"일 뿐이다. `log` 모드면 영향 0 | 없음 |

- 고의 파손 시험은 §10 L3에 있다.

### 7.5 C8: Bot Fight Mode, WAF custom rules

- Bot Fight Mode: Free 제공(확인 필요, 대시보드).
- 위험 1: SSR fetch는 GCP 데이터센터 IP + Node UA다. 봇으로 판정되면 사이트가 깨진다.
- 위험 2: GH Actions 점검(C13)도 데이터센터 IP다. 거짓 실패가 난다.
- Free Bot Fight Mode를 skip 규칙으로 예외 처리할 수 있는지: 확인 필요(대시보드).
- 권고: 지금은 끈다. C12 로그로 봇 비율을 본 뒤 결정한다(D6).
- WAF custom rule (Free 개수 확인 필요): 스캐너 경로 차단 1개를 권고한다. 예: path가 `.php`로 끝남 → Block.
- 검증: `h https://my.prettylog.com/x.php` → `403` + `cf-mitigated` 또는 Cloudflare 차단 페이지.

### 7.6 C9: PM2 cap, swap, 메모리 관찰

```
요청 폭주 (MISS) ─► Node RSS 증가 ─► swap-in (vmstat si>0) ─► 응답 지연
                                   └► RSS > cap ─► PM2 재시작 ─► 수 초 502 (HIT는 계속 서빙)
```

- 위치: `ecosystem.config.cjs`. `blog-web` 320M / heap 256, `blog-api` 200M / heap 160.
- 지금 available ≈ 475 MiB (오너 측정). cap 합 520M은 이보다 크다. 둘이 동시에 차면 swap이 받는다.
- OOM은 4 GB swap 때문에 늦게 온다. 먼저 오는 증상은 지연이다(`gcp.design.md` §3.1).

**무엇을 알려고 쓰나:** VM이 지금 메모리 압박 상태인가, 재시작이 쌓이는가.

| 세트 | 대상 | 개수 |
| --- | --- | --- |
| VM 관찰 | `pm2 ls`(↺ 열), `free -m`, `vmstat 5 12`(`si`, `so`) | 명령 3개 |
| 콘솔 관찰 | Monitoring → VM → memory used %, swap used (Ops Agent host metrics) | 지표 2개 |

**어떻게 하나:**

1. IAP ssh에서 세 명령을 실행한다.
2. ↺ 값을 지난번 값과 비교한다.
3. 예(오너 측정 2026-10-13): available ≈ 475 MiB.

**읽는 법:**

- `si` 0 근처, ↺ 불변: 정상.
- `si`가 1분 넘게 0보다 큼: §3.1 tactic kill 조건 후보.
- ↺가 주마다 증가: cap에 닿는다. `pm2 logs`와 C12 로그로 원인을 찾는다.

- 계속 살아 있는가: Cloud Monitoring 알림 정책 1개. memory used > 90 % 5분 → email. 알림 정책 무료 여부: 확인 필요(GCP 가격 페이지).
- 주간 점검(C13)은 Cloud Logging의 PM2 재시작 줄 수를 센다. 문구는 developer가 실제 로그에서 확인한다.

## 8. 비용과 가시성 (C10–C12)

### 8.1 C10: 비용 경보

| 대상 | 무엇을 보나 | 어디서 | 경보 |
| --- | --- | --- | --- |
| GCP 청구 | 월 금액 vs G2 | Billing → Budgets (alerts-only, GCP-U3) | 50 %, 90 %, 100 % email |
| GCP egress | VM sent bytes | Monitoring → `compute.googleapis.com/instance/network/sent_bytes_count` | 주간 합계를 C13 issue에 |
| Cloudflare | 없음 | Free는 요청당 과금이 없다 | 없음 |
| Supabase | DB 크기, egress, 연결 | Supabase → Usage | 수동, 월 1회 |

- egress 무료량: 확인 필요(GCP 가격 페이지). 숫자를 이 문서에 적지 않는다.
- egress의 대부분은 HTML MISS와 SSR hairpin이다. HIT는 0 byte다.
- 무료 체험 종료 ≈ 2027-01-10(`deploy/logging/README.md`). budget은 그 전에 있어야 한다.
- 지표의 주간 합계 조회는 WIF 서비스 계정에 `roles/monitoring.viewer`가 더 필요하다. IAM 변경이라 오너 승인(D7). 오너가 보류했다(2026-10-13, "wait").

### 8.2 C11: 엣지 적중률

**무엇을 알려고 쓰나:** 전체 요청 중 몇 %를 엣지가 흡수하는가.

| 세트 | 대상 | 개수 |
| --- | --- | --- |
| zone 전체 | Analytics → Traffic: Requests, Cached requests, 7일 | zone 1개 (`prettylog.com`) |
| host별 | Analytics에서 host 필터 (`my.`, `blog-api.`, `blog-assets.`) | host 3개 |

**어떻게 하나:**

1. 대시보드 → zone → Analytics & Logs → Traffic.
2. 기간 7일. Percent cached 값을 읽는다.
3. host 필터의 Free 제공 여부: 확인 필요(대시보드).
4. 예: 아직 측정값 없음. MVP1 끝에 첫 값을 기록한다.

**읽는 법:**

- 목표 초안(D1, owner 미승인): `my.` HTML 적중률 ≥ 80 %.
- `blog-assets.`가 섞이면 zone 값이 부풀려진다. host별로 읽는다.
- 적중률이 낮고 C12 MISS 수가 많음: 우회(R6) 또는 colo 분산(C3).

- 자동화 선택(D8): GraphQL Analytics API는 Analytics Read 토큰이 필요하다. 레포 secret 1개가 생긴다.
- 권고: 지금은 수동. C13은 C12 로그 수로 MISS 쪽만 센다.

### 8.3 C12: blog-web 요청 로그 (#58, 오너 결정, developer 구현 중)

- 한 요청 = JSON 한 줄. 필드: method, host, path, query, ip(`cf-connecting-ip`, 전체), country(`cf-ipcountry`), ray(`cf-ray`), ua, referer, rsc 여부, signedIn 여부.
- 경로: `proxy.ts` → stdout → PM2 `blog-web-out-0.log` → Ops Agent → `log_id("blog-web")`.
- 회전: 기존 logrotate `~/.pm2/logs/*.log`가 이미 덮는다(#56).
- 범위 한계: matcher(`proxy.ts:36`)가 `_next`, 점 포함 경로를 건너뛴다. `/robots.txt`, `/sitemap.xml`, 정적 파일 MISS는 기록되지 않는다.
- 범위 한계: OG 경로 `/blog/…/opengraph-image`는 점이 없어 기록된다(확인 필요, B 검증 3).
- 이 로그의 모든 줄 = 엣지가 흡수하지 못한 요청이다.
- 개인정보: 전체 IP가 Cloud Logging에 30일 남는다(#57, #58). 레포가 PUBLIC이므로 IP는 issue에 절대 쓰지 않는다.

**무엇을 알려고 쓰나:** 로그가 MISS마다 한 줄씩, 맞는 필드로 들어오는가.

| 세트 | 대상 | 개수 |
| --- | --- | --- |
| 로그 검증 | `?probe=<UTC 시각>` 붙인 `/` (MISS 강제), 같은 URL 재요청(HIT), `Cookie: __session=x` 요청 | 요청 3건 |

**어떻게 하나:**

1. `T=$(date -u +%s)`. `curl -s -o /dev/null "https://my.prettylog.com/?probe=$T"` 2회.
2. `curl -s -o /dev/null -H 'Cookie: __session=x' "https://my.prettylog.com/?probe=$T-s"` 1회.
3. Logs Explorer: `log_id("blog-web") AND jsonPayload.query=~"probe=$T"`. 필드 이름은 developer 구현을 따른다.
4. 기대: `probe=$T` 줄 1개(2회째는 HIT라 없음), `probe=$T-s` 줄 1개.
5. 각 줄의 ip가 요청한 Mac의 공인 IP와 같다. `ray`가 응답 `cf-ray`와 같다.

**읽는 법:**

- 1줄 + 1줄: 통과.
- `probe=$T` 2줄: 2번째가 HIT가 아니었다. C1 실패다.
- 0줄: 로그 미수집. `pm2 logs blog-web`, Ops Agent receiver를 본다.
- ip가 `127.0.0.1` 또는 Cloudflare IP: `cf-connecting-ip`를 안 읽었다.

## 9. C13: 주간 자동 점검

### 9.1 형태 선택 (D2)

| 안 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A (권고) | 기존 `logging-review.yml`에 단계 추가. 한 issue | WIF 재사용, issue 1개 | 한 잡이 실패하면 둘 다 경고 |
| B | 새 `traffic-check.yml`, curl만, secret 없음 | 독립, 권한 0 | issue 2개. 로그 집계는 못 함 |
| C | B + A의 로그 집계 | 둘 다 | 파일 2개 유지 |

### 9.2 단계 (A안 기준, 요약만 출력)

```
[curl probe] S-web 5×2 + S-api 3×2 + B1 2 + B3 4 + R7 2 = 24 요청 (모두 GET, h)
      │ 결과는 probe.txt (run log에 출력 안 함)
[Cloud Logging, WIF] 7일: blog-web 줄 수, signedIn=false 줄 수, rsc 줄 수, 고유 ip 수
      │                    blog-api 5xx 수, PM2 재시작 줄 수
[issue] 표 한 개: 숫자와 ✅/⚠️ 만
```

| issue 줄 | 예 | 통과 |
| --- | --- | --- |
| HIT 표본 | `7 / 7 HIT` (S-web 5 + posts 2) | 모두 HIT |
| 누출 시험 | `B1 BYPASS, R7 BYPASS, B3 html/x-component` | 기대와 일치 |
| Set-Cookie on 표본 | `0` | 0 |
| blog-web 줄 (7일, MISS 수) | 값 | D1 기준(초안) |
| 고유 IP 수 (숫자만) | 값 | 기록만 |
| blog-api 5xx (7일) | 값 | ≤ 20 (기존 기준) |
| PM2 재시작 (7일) | 값 | 0 |

- 표본은 10 URL 이하로 둔다. runner의 MISS는 실제 오리진 요청이다.
- 1회째 MISS는 runner 근처 colo가 차가워서다. 판정은 2회째로 한다.
- IP, UA, referer, path 목록은 issue에도 run log에도 쓰지 않는다(PUBLIC 레포).
- Bot Fight Mode를 켜면(D6) 이 단계가 challenge를 받을 수 있다. 그때 `403`은 "점검 차단"으로 따로 표시한다.
- 로그 집계 쿼리와 출력 키(`TOTAL_MB=` 방식)는 `check-volume.sh`의 형식을 따른다.

## 10. C14: 부하 시험(load test) (rev2, 세트마다 오너 승인)

### 10.1 무엇을 알려고 쓰나

세 질문에 답한다. (1) 엣지가 burst를 흡수하는가. (2) 오리진은 MISS를 몇 rps까지 버티는가. (3) 제한(§7.4)이 실제로 발동하는가.

### 10.2 표

| 세트 | 질문 | 대상 URL | 속도 × 시간 | 총 요청 | 오리진 부하 | Supabase |
| --- | --- | --- | --- | --- | --- | --- |
| L1-web | (1) | `https://my.prettylog.com/blog/@taeklim/rust-config` (HIT) | 8 rps × 40 s | 320 | 0에 가깝다 | 0 |
| L1-api | (1) | `https://blog-api.prettylog.com/v1/api/posts?limit=1` (HIT) | 8 rps × 40 s | 320 | 0에 가깝다 | 0 |
| L2-web | (2) C_web | `https://my.prettylog.com/?lt=<run>-<n>` (매번 MISS) | 0.5 → 1 → 2 → 4 rps, 단계당 60 s | ≤ 450 | Next SSR 450회 | 거의 0 (SSR의 API 호출은 고정 URL → HIT) |
| L2-api | (2) C_api | `https://blog-api.prettylog.com/v1/api/posts?limit=1&lt=<run>-<n>` (매번 MISS) | 1 → 2 → 4 → 8 rps, 단계당 30 s | ≤ 450 | Express 450회 | posts 조회 ≤ 450회 |
| L3-cf | (3) L-a | `https://my.prettylog.com/?lt=<run>-<n>` | 한도를 잠시 20 / 10 s로 낮춘 뒤 3 rps × 20 s | 60 | Next < 60회 | 거의 0 |
| L3-api | (3) L-b | `https://blog-api.prettylog.com/` (`server.ts:75`, DB 없음, 로그 남음, Cache-Control 없음 → BYPASS) | 2.5 rps × 120 s | 300 | Express 300회, DB 0 | 0 |

- L3 길이를 창(window)의 2배로 둔 이유: 고정 창은 벽시계 경계에서 끊긴다. 창 하나 길이만 보내면 두 창에 나뉘어 한도를 안 넘을 수 있다.
- 2배면 그 안에 온전한 창이 하나 들어간다. L3-api는 그 창에 150건(> 120), L3-cf는 30건(> 20)이다.

- L1 URL은 점 없는 글 페이지다. `robots.txt`는 blog-web 로그에 안 남는다(§8.3). 그래서 "오리진 줄 수" 판정을 못 한다.
- L1 8 rps = 10 s에 80. L-a 가안 100보다 작다. 그래서 L1은 L-a를 켠 뒤에도 돌 수 있다.
- L2-web 4 rps = 10 s에 40. L-a에 걸리지 않는다.
- L2-api 8 rps = 분당 480. L-b `enforce`면 막힌다. 그래서 L2-api는 L-b가 `off` 또는 `log`일 때만 돈다.
- `/ping`을 L3에 쓰지 않는다. pino가 `/ping`을 건너뛴다(`server.ts:51`). 429가 로그에 안 보인다.
- L3-cf의 한도 20이 Free에서 설정 가능한지: 확인 필요(대시보드). 안 되면 가능한 최솟값 + 10건으로 바꾼다.
- `lt=` 키는 엣지에 하루 남는다. 해는 없다. purge하지 않는다(좋은 캐시도 지워진다).

### 10.3 시각화

```
L2 단계 (예: L2-web)     rps
                          4 ┤                         ┌──────┐  ← 여기서 실패하면 C_web = 2
                          2 ┤                ┌────────┘      │
                          1 ┤       ┌────────┘               │
                        0.5 ┤───────┘                        │
                            └──────┴────────┴────────┴───────┴─► 시간 (60 s 단계 4개)
 각 단계 끝: 5xx 1건 이상, 실패율 > 2 %, p95 > 3 s 중 하나 → 즉시 중단(abort)
 C_web = 끝까지 통과한 마지막 단계의 rps   →  L-a 위 한계 = 0.5 × C_web × 10 (§7.4.4)
```

### 10.4 어떻게 하나

1. 도구: k6 (Grafana, 단일 바이너리). `grafana/setup-k6-action`으로 설치한다. 최신 안정판은 developer가 확인한다.
2. k6 `constant-arrival-rate`(L1, L3), `ramping-arrival-rate`(L2) 실행기(executor)를 쓴다. 속도가 응답 시간과 무관하게 고정된다.
3. 실행 장소: GitHub Actions `workflow_dispatch` 전용 workflow `load-test.yml` 1개. 오너 Mac에서 돌리지 않는다(`~/.claude/CLAUDE.md` "No local execution").
4. workflow 상한:
   - 입력은 세트 이름 선택지(choice)만. 자유 URL 입력은 없다.
   - `timeout-minutes: 8`, `concurrency: load-test` (동시 실행 1개).
   - k6 `maxVUs` 20, 요청당 `timeout` 10 s, 리다이렉트 0.
   - 스크립트 안에 총 요청 상한을 둔다(위 표의 "총 요청").
5. 중단 조건(k6 `thresholds`, `abortOnFail: true`, `delayAbortEval: 10s`):
   - L1: 200 아닌 응답 > 1 %.
   - L2: 5xx ≥ 1, 실패율 > 2 %, p95 > 3 s 중 하나.
   - L3: 없음 (429가 기대값이다).
6. 사전 조건(시작 전 자동 확인, 아니면 시작 안 함):
   - `traffic-check.sh` 0 FAIL.
   - L1: 대상 URL 2회 GET → 2번째 `HIT`.
7. 시각: C12 로그의 시간대별 요청 수가 가장 낮은 시간(§7.4.4 마지막 명령).
8. 사전 등록(`rules/measurement.md` §1): 이 절의 기준을 run 전에 고친 채 둔다. run 뒤 바꾸지 않는다.
9. 기록: k6 `--summary-export` JSON을 workflow artifact로 올린다. 인용하는 숫자는 이 파일에서 읽는다.
10. run 뒤 점검(오너 또는 main session):
    - `pm2 ls`의 ↺를 run 전 값과 비교.
    - `./_scripts/gcp/vm-metrics.sh 1`의 메모리 최댓값.
    - blog-web 로그에서 run 시간대의 대상 path 줄 수.
    - blog-api 로그에서 run 시간대의 5xx 수.
11. 실행: main session이 `gh workflow run load-test.yml -f set=<세트>`로 띄운다. agent는 실행하지 않는다.
12. 끊기: 이상하면 main session이 `gh run cancel <id>`.

예(가상 숫자, 측정 전): L2-web가 2 rps 단계까지 통과하고 4 rps에서 p95 > 3 s로 멈춤 → C_web = 2. L-a 위 한계 = 0.5 × 2 × 10 = 10 / 10 s.

### 10.5 통과 기준 (사전 등록)

| 세트 | 통과 |
| --- | --- |
| L1 | 응답 200 ≥ 99 %, `HIT` ≥ 99 %, run 시간대 blog-web의 그 path 줄 ≤ 10, ↺ 불변 |
| L2 | 단계별 판정. ↺ 불변, 메모리 최댓값 < 80 %, blog-api 5xx 0 (L2-api) |
| L3-cf | 60건 중 10건 이상 차단(429 또는 Cloudflare 차단 응답), blog-web 그 path 줄 < 60, 한도 100으로 복구 확인 |
| L3-api `log` | 300건 모두 200, `rate_limit` warn 줄 ≥ 30 |
| L3-api `enforce` | 429 + `Retry-After` ≥ 30건. 절반은 `x-origin-key: wrong` 헤더를 붙인다. 그쪽도 429가 나온다 (위조로 못 피함). `error_log` 증가 0 |
| SSR 제외 | `log` 모드 14일 동안 `req.ssr=true` 줄이 있고, 그중 `rate_limit` warn은 0 |

- SSR 제외는 L3로 증명하지 않는다. runner가 띄우는 페이지의 SSR API 호출은 대부분 엣지 HIT라 Express에 안 온다.
- 그래서 실제 SSR 트래픽이 쌓인 `log` 모드 기록으로 판정한다(RL-4 전 조건).

- L1 줄 ≤ 10인 이유: runner는 연결마다 다른 캐시 서버에 닿을 수 있다. 처음 몇 건은 MISS다(README 5단계, 2026-10-13 거짓 MISS 2건).
- 메모리 80 %인 이유: 경보는 90 %가 5분 이어질 때다. 단계는 60 s라 경보가 울리지 않을 수 있다. 경보는 통과 신호가 아니다.
- k6는 VM 메모리를 볼 수 없다. 그래서 메모리와 ↺는 run 뒤 점검이 판정한다.
- L2의 첫 run은 판정하지 않는다(`.claude/CLAUDE.md` "first end-to-end cycle ... no verdict"). C_web, C_api 첫 값만 기록한다.

### 10.6 읽는 법

- L1 통과: 엣지가 burst를 흡수한다. 오리진 줄이 10을 넘으면 C1/C2 룰이나 colo 분산(C3)을 본다.
- L2에서 첫 단계부터 중단: 오리진이 0.5 rps도 못 버틴다. L-a 위 한계가 사람의 page burst보다 작다. 오너 결정이다(§7.4.4).
- L2 통과 중 ↺ 증가: PM2 cap에 닿았다. C9 문제다. 그 단계의 rps를 C 값으로 쓰지 않는다.
- L3-cf에서 차단 0: 규칙이 안 걸렸다. 식 또는 RL-0 표의 가정(HIT 집계 등)이 틀렸다.
- `enforce` 뒤 `traffic-check.sh` FAIL 또는 SSR 페이지 오류: `x-origin-key` 제외가 실패했다. 즉시 `RATE_LIMIT_MODE=off`.
- 위조 헤더로 429가 안 남: 키 비교가 틀렸다. `enforce`를 쓰지 않는다.

### 10.7 롤백

| 세트 | 남는 것 | 되돌리기 |
| --- | --- | --- |
| L1 | 없음 | 없음 |
| L2 | `lt=` 캐시 항목(1일 뒤 만료), PM2 재시작 가능성 | 재시작 후 `online`이 아니면 오너가 `pm2 restart blog-web` 또는 `blog-api` |
| L3-cf | 낮춘 한도 20 | 즉시 100으로 되돌리고 대시보드 값을 확인한다. 이 단계를 빠뜨리면 실제 방문자가 막힌다 |
| L3-api | `RATE_LIMIT_MODE` 값 | 시험 전 값으로 되돌리고 `pm2 restart blog-api --update-env` |

- 비용: HIT는 VM egress 0 byte. Cloudflare Free는 요청당 과금이 없다. L2 최대 900건의 MISS egress는 수 MB다(추정).

## 11. MVP 순서 (`.claude/CLAUDE.md` "System build phasing" 인용, 재진술 없음)

이 작업의 "스키마"는 통제 표(§2)와 각 검증의 기대값이다. 단계는 그 계약을 점점 자동화한다.

| 단계 | 끝나는 end-to-end cycle | 설계 단위 |
| --- | --- | --- |
| MVP1 | 오너가 손으로 모든 통제를 한 번 검증한다 | MVP1-1 ~ MVP1-8 |
| MVP2 | 주간 job이 표본과 로그 집계를 issue 1개로 낸다 | MVP2-1 ~ MVP2-3 |
| MVP3 | 가시성과 흡수 증명 | MVP3-1 ~ MVP3-3 |

### 설계 단위 (pm이 행과 AC로 바꾼다)

| ID | 단위 | 실행 | 선행 |
| --- | --- | --- | --- |
| MVP1-1 | W4(bypass)를 먼저 → W3 → `/` 2회 → HIT (§3.3 가정 검증) → 끝에 purge 전체 | USER | GCP-M3-2 |
| MVP1-2 | W1, W2 적용 + §3.5 S-web 5 URL + §3.6 B1–B6 | USER | MVP1-1 |
| MVP1-3 | A2(bypass)를 먼저 → A1 + §4.3 S-api + R7, R8, R9 시험 | USER | 없음 |
| MVP1-4 | D3 결과 반영(U-CACHE: Express 기본 no-store 또는 A1 축소) | ENG 또는 USER | MVP1-3 |
| MVP1-5 | U-CORS: 낯선 Origin → INSERT 0, ACAO 고정 + §7.3 시험 | ENG | 없음 |
| MVP1-6 | purge 시험 §6 | USER | MVP1-2, MVP1-3 |
| MVP1-7 | C10 budget(GCP-U3) + 메모리 알림 정책 1개 | USER | 없음 |
| MVP1-8 | C3 Tiered Cache, C8 `.php` 차단 + 각 curl 검증 (C7은 §11.1로 옮김, rev2) | USER | MVP1-2 |
| MVP2-1 | `logging-review.yml`에 curl probe 단계(§9.2, 요약만) | ENG | MVP1-2, MVP1-3 |
| MVP2-2 | 같은 job에 blog-web, PM2 재시작 집계 | ENG | C12 배포, MVP2-1 |
| MVP2-3 | egress 주간 합계(D7 승인 시) | ENG + USER(IAM) | MVP2-1 |
| MVP3-1 | C12 검증 §8.3 (3요청 시험) | USER | C12 배포 |
| MVP3-2 | C11 적중률 첫 값 기록, D1 목표 확정 | USER | MVP1 전부 |
| MVP3-3 | C14: §11.1 LT-1 ~ LT-3b (rev2) | main session dispatch | MVP2-1 |

- "먼저"는 켜는 시점이다. 룰 목록 안의 위치는 §3.2, §4.1 표 순서를 지킨다(bypass가 마지막).
- 이유: bypass가 없는 동안 로그인한 오너의 화면이 익명 키에 24h 저장될 수 있다(R1, R7).
- MVP2가 고르는 실제 조각 1–2개: MVP2-1(curl probe)과 MVP2-2(로그 집계).
- C12는 #58로 이미 구현 중이다. 그래서 MVP3-1은 배포 직후 앞당겨도 된다.
- 순서 불변식: MVP1-1이 실패하면 MVP1-2의 W3 부분은 멈추고 `recover`로 간다.

### 11.1 요청 수 제한 + 부하 시험 순서 (rev2, C7 + C14)

이 트랙의 계약(contract)은 §7.4의 한도 표, 로그 필드(`req.ip`, `req.ssr`), §10.5 통과 기준이다.

| 단계 | 끝나는 end-to-end cycle | 단위 |
| --- | --- | --- |
| MVP1 | 계약이 정해지고, 엣지 흡수가 측정된다. 아무것도 막지 않는다 | RL-0, LT-1, RL-1 |
| MVP2 | 실제 조각 2개: L-a 규칙(가안 한도)과 L-b `log` 모드 | RL-2, RL-3, LT-2, LT-3a |
| MVP3 | 14일 로그로 한도를 확정하고 L-b를 `enforce`로 바꾼다 | RL-4, LT-3b, RL-5 |

```
RL-0 대시보드 확인 ─┬─► RL-2 L-a 켬(100/10s) ─────────────┐
LT-1 L1 HIT burst   │                                     ├─► LT-3a L3-cf
RL-1 로그 필드+키 ──┼─► RL-3 L-b log 모드 ─► (14일) ─┐    │
                    └─► LT-2 L2 용량 ────────────────┴─► RL-4 한도 확정, enforce ─► LT-3b L3-api ─► RL-5 주간 줄
```

| ID | 단위 | 실행 | 선행 | 결과물 |
| --- | --- | --- | --- | --- |
| RL-0 | Free rate limiting 화면 값을 §7.4.1 표에 적는다. N_page를 DevTools로 센다 | USER | 없음 | 표 9칸, N_page 1개 |
| LT-1 | `load-test.yml` + k6 L1 스크립트, L1-web, L1-api 실행 (D9) | ENG 작성, main session 실행 | 없음 | k6 summary JSON, §10.5 L1 판정 |
| RL-1 | blog-api 로그에 `req.ip`, `req.ssr` (D11). Next `http.server.ts`가 `x-origin-key` 송신, 두 앱 env `ORIGIN_SSR_KEY` (D12) | ENG + USER(env) | 없음 | Logs Explorer에서 두 필드 확인 |
| RL-2 | L-a 규칙 "web rate limit", 가안 100 / 10 s, Block (D5) | USER | RL-0 | 규칙 1개 켜짐 |
| RL-3 | L-b 미들웨어, `RATE_LIMIT_MODE=log`, 가안 120 / 30 | ENG | RL-1 | `rate_limit` warn 줄이 생기는지 L3-api `log`로 확인 |
| LT-2 | L2-web, L2-api 실행 (D13). L-b는 `off` 또는 `log` | main session 실행 | LT-1 | C_web, C_api 첫 값 |
| LT-3a | L3-cf (한도 잠시 20 → 복구 100) | USER + main session | RL-2, LT-2 (C_web ≥ 3) | 차단 10건 이상 |
| RL-4 | §7.4.4 명령으로 한도 계산, 오너 확정 (D5), L-b `enforce` (D14) | USER + architect 계산 | RL-1 + 14일, RL-3, LT-2 | 한도 3개 확정값 |
| LT-3b | L3-api `enforce` + 위조 헤더 | main session 실행 | RL-4 | 429 + `Retry-After` |
| RL-5 | 주간 issue(C13)에 `rate_limit` warn 수, blog-api 429 수 2줄 (숫자만) | ENG | RL-4 | issue 줄 2개 |

- MVP2가 고르는 실제 조각: RL-2(엣지 규칙)와 RL-3(오리진 backstop, `log`).
- 가장 작은 첫 걸음은 RL-0과 LT-1이다. 둘 다 아무것도 막지 않는다.
- L-a를 측정 전에 켜는 이유: Free에는 log 전용 동작이 없다고 가정한다(RL-0에서 확인). 가안 100은 사람보다 훨씬 크다.
- L-b는 `log` 모드가 있으므로 측정과 동시에 켠다. 막는 것은 RL-4 뒤다.
- RL-5는 workflow 계정의 Cloud Logging 읽기 권한에 기댄다. 확인 필요(developer, `logging-review.yml`).
- 이것은 D7(`roles/monitoring.viewer`)과 다른 권한이다. 권한이 없으면 새 IAM 변경이라 오너 결정이 된다.
- 그동안 오너가 §7.4.4 명령을 손으로 돌린다.

## 12. 오너 결정 목록

| ID | 질문 | 선택지 | 권고 |
| --- | --- | --- | --- |
| D1 | 목표 숫자 (G2 아래 traffic goal 초안) | `my.` HTML 적중률 ≥ 80 % (7일), 주간 blog-web MISS 줄 ≤ N | 첫 측정(MVP3-2) 뒤 확정 |
| D2 | 주간 점검 형태 | A 기존 job 확장 / B 새 curl job / C 둘 다 | A |
| D3 | R8 Cache-Control 없는 API GET | A Express 기본 no-store / B A1 경로 축소 | A |
| D4 | 상태 코드 TTL이 Free에 없을 때 | HTML 캐시 보류 / 위험 수용 | 대시보드 확인 뒤 결정 |
| D4b | 404 캐시 | 안 함 / 10분 | 10분 (스캐너 흡수) |
| D5 | rate limit 층과 한도 (rev2, §7.4) | A 엣지 `my.`만 + Express backstop / B 엣지 두 host + VM IP 제외 / C 없음. 한도: 지금 가안으로 켬 / 14일 뒤 켬. 동작: Block / Managed Challenge | A. L-a는 가안 100 / 10 s Block으로 지금 켬, 14일 뒤 §7.4.4로 확정. Challenge는 RSC와 `fetch`를 깨뜨린다 |
| D6 | Bot Fight Mode | 켬 / 끔 | 끔 (SSR, 점검 차단 위험) |
| D7 | WIF 계정에 `roles/monitoring.viewer` 추가 | 예 / 아니오 | **보류 (오너 답 2026-10-13: "wait")**. 주간 egress 줄은 넣지 않는다. 그동안 `vm-metrics.sh`를 손으로 돈다 |
| D8 | Cloudflare Analytics 자동화 토큰 | secret 1개 추가 / 수동 | 수동 |
| D9 | 부하 시험 L1 (HIT burst, §10) | 함 / 안 함 | 함. 오리진 부하가 0에 가깝다. 총 640건 |
| D10 | U-CORS 응답 | 403 / 헤더 없이 200 | developer가 403으로 구현 중(2026-10-13). 이 rev는 다시 묻지 않는다 |
| D11 | blog-api 요청 로그에 전체 IP(`cf-connecting-ip`)와 `ssr` 표시 추가 | 예 (#58과 같은 정책: 30일, issue에 금지) / 아니오 | 예. 없으면 L-b 한도를 데이터로 정할 수 없다 |
| D12 | SSR을 L-b에서 빼는 방법 | A 비밀 헤더 `x-origin-key` (env 1개, 두 앱) / B GCP metadata에서 VM 외부 IP를 읽어 제외 / C 빼지 않음 | A. 이식 가능하고 검증이 쉽다. B는 GCP에 묶이고 IP 변경 순간에 틈이 있다. C는 공격 중 사이트 전체를 막을 수 있다 |
| D13 | 부하 시험 L2 (오리진 용량, MISS ≤ 900건, Supabase 조회 ≤ 450건) | 함 / 안 함 | 함, 저트래픽 시각에 1회. 없으면 한도의 위 한계를 모른다 |
| D14 | L-b 시작 모드 | `log` 14일 뒤 `enforce` / 바로 `enforce` | `log` 먼저. 공유 NAT 사용자를 막는지 먼저 본다 |

- 각 선택은 `decisions.plan.md` 행을 먼저 쓴 뒤 작업한다(`rules/core.md` Log first).
