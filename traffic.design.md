# 트래픽 통제 검증 설계 (DRAFT, system-architect, 2026-10-13)

> 상태: 설계 초안 rev1. 선택(§12)은 오너가 한다.
> 대상: `https://my.prettylog.com`(Next 16 standalone, PM2 `blog-web`), `https://blog-api.prettylog.com`(Express 5, PM2 `blog-api`).
> 실행 규칙: agent는 curl, ssh, 배포를 하지 않는다. 아래 명령은 오너 또는 main session이 실행한다(`00.tasks.md` Phase GCP 머리말).
> 테스트 러너(test runner)는 쓰지 않는다(`rules/core.md` Tests SUSPENDED). 검증은 실제 시스템에 대한 고의 파손(deliberate breakage)으로 한다.
> 출처 표기: 오너 측정 = 2026-10-13 Mac에서 curl 2회. "확인 필요(대시보드)" = Cloudflare Free 플랜 제공 여부를 확신하지 못한 항목.

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
 C14 spike test (오너 승인 시만): HIT URL에 제한된 burst
```

- HIT는 오리진에 오지 않는다. 그래서 VM 로그에는 HIT가 없다.
- 전체 요청 수는 Cloudflare Analytics(C11)만 안다.

## 2. 통제 표

| ID | 통제 | 지키는 것 | 위치 | 지금 상태 (오너 측정 2026-10-13) |
| --- | --- | --- | --- | --- |
| C1 | web Cache Rules W1–W4 | VM CPU·RAM, egress, 데이터 누출 | Cloudflare Cache Rules | 미적용: `/` DYNAMIC, OG DYNAMIC, robots EXPIRED |
| C2 | api Cache Rules A1–A2 (#54) | VM CPU, Supabase, egress, 누출 | Cloudflare Cache Rules | 미적용: posts API DYNAMIC |
| C3 | Tiered Cache | colo별 MISS 감소 → VM | Cloudflare Caching → Tiered Cache | 미확인 |
| C4 | purge 절차 | 발행 후 stale | `_scripts/cf-purge.sh` | 스크립트 있음, 실측 없음 |
| C5 | 오리진 Cache-Control | 엣지 정책의 원천, 누출 | Express `posts.cache.ts`, Next 라우트 | posts 3곳만 송출 |
| C6 | API 입력 방어 | Supabase 부하 | Express CORS, `?limit=` clamp | CORS 거부 = 500 + `error_log` INSERT |
| C7 | rate limiting | cache 우회 폭주 → VM | Cloudflare WAF → Rate limiting | 없음 |
| C8 | Bot Fight Mode / WAF custom | 스캐너, 봇 | Cloudflare Security | 미확인 |
| C9 | PM2 cap + swap + 메모리 관찰 | VM 폭발 | PM2, Linux, Ops Agent | cap 320M/200M, available ≈ 475 MiB |
| C10 | 비용 경보 | G2 청구 | GCP Billing, Monitoring, Supabase | budget 미생성(GCP-U3) |
| C11 | 엣지 적중률 보기 | 모든 C의 효과 측정 | Cloudflare Analytics | 미측정 |
| C12 | blog-web 요청 로그 (#58) | MISS의 출처 분석 | `proxy.ts` → PM2 → Ops Agent | 구현 중(developer) |
| C13 | 주간 자동 점검 | 통제가 계속 살아 있음 | GH Actions | `logging-review.yml`만 있음 |
| C14 | spike test | HIT가 burst를 흡수함을 증명 | GH Actions, 오너 승인 | 없음 |

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

- 단건 purge: `./_scripts/cf-purge.sh <url>`.
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

1. `./_scripts/cf-purge.sh` (전체, zone `prettylog.com` = 두 host 모두).
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

### 7.4 C7: rate limiting

- 위치: Cloudflare → Security → WAF → Rate limiting rules.
- Free 제공 규칙 수, 기간, 차단 시간: 확인 필요(대시보드). Free는 규칙 1개로 알려져 있다(미검증).
- 함정: SSR 호출(#53)은 모두 VM의 외부 IP 하나에서 온다. `blog-api.`에 IP 기준 제한을 걸면 사이트가 자기 SSR을 막는다.

| 안 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A (권고) | 규칙 1개, host `my.`만, IP당 예: 100 요청 / 10 s | SSR hairpin과 무관. HTML 우회(R6)를 막는다 | API 직접 폭주는 못 막는다 |
| B | host 둘 다, VM IP 제외 | API도 덮음 | VM IP는 ephemeral(GCP-U7 2-a). 바뀌면 사이트가 막힌다 |
| C | 없음 | 설정 0 | R6 폭주를 PM2 재시작이 받는다 |

- 숫자 100 / 10 s는 예다. C12 로그의 IP별 분포를 본 뒤 오너가 정한다(D5).
- 고의 파손(오너 승인 필요): GH Actions에서 같은 IP로 한도+10 요청 → 마지막 요청이 `429`.

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
- 지표의 주간 합계 조회는 WIF 서비스 계정에 `roles/monitoring.viewer`가 더 필요하다. IAM 변경이라 오너 승인(D7).

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

## 10. C14: spike test (오너 승인 필요)

- 오너 Mac에서 부하를 만들지 않는다(`~/.claude/CLAUDE.md` "No local execution").
- MISS를 대량으로 만드는 부하 시험은 하지 않는다. 그것은 VM을 일부러 터뜨리는 일이다.

| 안 | 내용 | 권고 |
| --- | --- | --- |
| A | 하지 않는다. C13 표본 + Analytics만 | 가능 |
| B | HIT burst만: GH Actions `workflow_dispatch`, 이미 HIT인 URL 1개 | **권고** |
| C | B + 작은 MISS burst (`?probe=<n>` 20건, 동시 2) | VM 메모리 관찰용. 별도 승인 |

**B안 수치 (사전 등록, `rules/measurement.md` §1 형식으로 run 전에 고정):**

| 항목 | 값 |
| --- | --- |
| URL | `https://my.prettylog.com/robots.txt` 또는 S-web의 글 1개 |
| 사전 조건 | 같은 URL 2회 → 2번째 `HIT` (아니면 시작 안 함) |
| 요청 수 | 300 |
| 동시성 | 10 |
| 요청당 제한 | `curl --max-time 10` |
| 중단 조건 | 첫 non-`HIT` 또는 non-200에서 즉시 중단 |
| 통과 | 300 / 300 `HIT` + 같은 시간대 C12 로그에 그 URL 줄 0개 + VM `pm2 ls` ↺ 불변 |
| 비용 | HIT는 VM egress 0 byte. Cloudflare Free는 요청당 과금 없음 |

- 실행: main session이 workflow를 dispatch한다. agent는 실행하지 않는다.
- C7을 켠 뒤면 한도에 걸려 `429`가 나온다. 그 경우 B를 C7 검증과 겸한다.

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
| MVP1-8 | C3 Tiered Cache, C7 rate limit(D5), C8 `.php` 차단 + 각 curl 검증 | USER | MVP1-2 |
| MVP2-1 | `logging-review.yml`에 curl probe 단계(§9.2, 요약만) | ENG | MVP1-2, MVP1-3 |
| MVP2-2 | 같은 job에 blog-web, PM2 재시작 집계 | ENG | C12 배포, MVP2-1 |
| MVP2-3 | egress 주간 합계(D7 승인 시) | ENG + USER(IAM) | MVP2-1 |
| MVP3-1 | C12 검증 §8.3 (3요청 시험) | USER | C12 배포 |
| MVP3-2 | C11 적중률 첫 값 기록, D1 목표 확정 | USER | MVP1 전부 |
| MVP3-3 | C14 B안 (승인 시) | main session dispatch | MVP2-1 |

- "먼저"는 켜는 시점이다. 룰 목록 안의 위치는 §3.2, §4.1 표 순서를 지킨다(bypass가 마지막).
- 이유: bypass가 없는 동안 로그인한 오너의 화면이 익명 키에 24h 저장될 수 있다(R1, R7).
- MVP2가 고르는 실제 조각 1–2개: MVP2-1(curl probe)과 MVP2-2(로그 집계).
- C12는 #58로 이미 구현 중이다. 그래서 MVP3-1은 배포 직후 앞당겨도 된다.
- 순서 불변식: MVP1-1이 실패하면 MVP1-2의 W3 부분은 멈추고 `recover`로 간다.

## 12. 오너 결정 목록

| ID | 질문 | 선택지 | 권고 |
| --- | --- | --- | --- |
| D1 | 목표 숫자 (G2 아래 traffic goal 초안) | `my.` HTML 적중률 ≥ 80 % (7일), 주간 blog-web MISS 줄 ≤ N | 첫 측정(MVP3-2) 뒤 확정 |
| D2 | 주간 점검 형태 | A 기존 job 확장 / B 새 curl job / C 둘 다 | A |
| D3 | R8 Cache-Control 없는 API GET | A Express 기본 no-store / B A1 경로 축소 | A |
| D4 | 상태 코드 TTL이 Free에 없을 때 | HTML 캐시 보류 / 위험 수용 | 대시보드 확인 뒤 결정 |
| D4b | 404 캐시 | 안 함 / 10분 | 10분 (스캐너 흡수) |
| D5 | rate limit | A `my.`만 / B 둘 다 + VM IP 제외 / C 없음, 그리고 한도 숫자 | A, 숫자는 C12 분포 뒤 |
| D6 | Bot Fight Mode | 켬 / 끔 | 끔 (SSR, 점검 차단 위험) |
| D7 | WIF 계정에 `roles/monitoring.viewer` 추가 | 예 / 아니오 | 예 (읽기 전용) |
| D8 | Cloudflare Analytics 자동화 토큰 | secret 1개 추가 / 수동 | 수동 |
| D9 | spike test | A 안 함 / B HIT burst / C + MISS burst | B |
| D10 | U-CORS 응답 | 403 / 헤더 없이 200 | 헤더 없이 200 (INSERT 0, 단순) |

- 각 선택은 `decisions.plan.md` 행을 먼저 쓴 뒤 작업한다(`rules/core.md` Log first).
