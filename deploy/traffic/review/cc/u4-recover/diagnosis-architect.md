# U4 recover: architect 진단 (recover step 1+2)

- Phase CC, M-CC2 → S-CC (B), recovery 1/2. 섬기는 줄: G-CC (DRAFT), M-CC2 exit "flag on 빌드 잡 통과 · 배포".
- 대상 코드: `cc-u4` head efe7eed (worktree `/Users/tio/Documents/00_projects/tradelunch-cc-u4`). main은 revert 상태(7b4a138).
- 근거 파일: `blog-web-errors.json`(이 폴더), Next 16.2.9 `node_modules/next/dist`.
- 코드 수정, git 쓰기, 네트워크, 로컬 실행 없음.

## 0. 결론 (근본 원인 3줄)

1. `/nope`는 `(shell)/[handle]`에 맞는다. `generateStaticParams`가 있어서 ISR(증분 정적 생성, Incremental Static Regeneration) 경로(`isSSG`)로 렌더된다. `HandleLayout`이 Suspense 밖에서 `notFound()`를 던져 prerender 바깥 catch로 간다.
2. catch는 404 화면을 `prerender-legacy` 저장소로 다시 렌더한다. 거기서 `(shell)` 레일의 `TagCloud` `no-store` fetch가 `revalidate = 0`을 남긴다. `TagCloud`의 catch가 그 신호 오류를 삼켜 렌더는 "성공"한다.
3. 핸들러는 `isSSG`이고 `revalidate 0 < 1`이면 E22를 던진다. 응답은 500 `Internal Server Error`(21바이트)다. `next dev`는 이 검사 블록 전체를 건너뛰어 404가 나온다.

## 1. 렌더 경로 (그림)

```
GET /nope  (proxy: 첫 segment에 '@' 없음 → gate 없음, 통과)
   │
   ▼
app-page.js  isSSG = true   (dynamicRoutes['/[handle]'] 있음: generateStaticParams 탓)
   │
   ▼
prerenderToStream, cacheComponents 분기 (store type 'prerender')
   │  (shell)/layout → RailFrame → TagCloud: no-store fetch = hanging promise
   │  [handle]/layout: '@' 없음 → notFound()   ← Suspense 밖, layout에서 던짐
   ▼
catch (app-render.js:4264)  res.statusCode = 404
   │  prerenderLegacyStore = { type: 'prerender-legacy', revalidate: INFINITE }   (4303)
   │  404 경계 트리를 이 저장소로 다시 렌더 (4326–4345)
   │     TagCloud → getPopularTags → fetch(cache:'no-store')
   │        patch-fetch.js:548 markCurrentScopeAsDynamic
   │        dynamic-rendering.js:239  store.revalidate = 0, DynamicServerError throw
   │        TagCloud.server.tsx:34 catch {} 가 삼킴 → "tags unavailable" 렌더
   │  collectedRevalidate = 0   (4387)
   ▼
app-page.js:982  if (!routeModule.isDev)        ← dev는 여기서 끝. 404 응답
app-page.js:1001 isSSG && revalidate 0 < 1 → throw E22 "Invalid revalidate configuration provided: 0 < 1"
   ▼
500, 본문 "Internal Server Error" (21 bytes)
```

## 2. 근거

| 주장 | 근거 |
| --- | --- |
| E22를 던지는 곳 | `next/dist/build/templates/app-page.js:1001` (`!routeModule.isDev` 블록 안, 982) |
| dev 차이 | 같은 파일 982: dev는 cacheControl 계산 블록 전체를 건너뛴다. 다른 차이는 필요 없다 |
| 404 재렌더가 legacy 저장소 | `server/app-render/app-render.js:4303–4345` |
| no-store fetch → revalidate 0 | `server/lib/patch-fetch.js:548`, `server/app-render/dynamic-rendering.js:238–239` |
| 로그 순서 | 각 500 직전 50 ms 안에 `Dynamic server usage … revalidate: 0 fetch …/tags?limit=30` (`blog-web-errors.json`) |
| 오류가 삼켜짐 | 그 로그의 message가 "Failed to fetch popular tags" = 앱 로그. `TagCloud.server.tsx:30–36` catch-all |
| `/foo/bar`도 같은 경로 | routePath `/(shell)/[handle]/[slug]/page`, `[handle]/layout`이 같은 `notFound()` |
| fetch 없이도 재현 | `markCurrentScopeAsDynamic`은 네트워크 호출 전에 실행된다(patch-fetch 548). API 없이 CI에서 재현된다 |

미확인 1건: 404 경계가 붙는 segment가 정확히 어디인지(`findPrerenderHTTPErrorBoundaryTree`, 빌드 산출물 없음). 로그가 `TagCloud`가 legacy 저장소에서 돈 것을 직접 보이므로 결론은 바뀌지 않는다.

## 3. 덧붙인 사실 (후보 선택에 영향)

- **Suspense, `connection()`은 해결이 아니다.** `TagCloud`는 이미 Suspense 안이다(`LeftRailContainer.server.tsx:16`). legacy 저장소에서는 `connection()`도 `revalidate = 0`을 남긴다. pm은 이 행을 만들지 않는다.
- **같은 부류가 더 있다.** ISR 경로에서 Suspense 밖 `notFound()`는 모두 같은 위험이다.
  - `[handle]/about/page.tsx:29`, `[handle]/resume/page.tsx:131`: 주인이 아닌 handle에서 `notFound()`. `classifyGatePath`는 RESERVED segment에 null을 돌려 gate가 없다. `/@nobody/about`도 500일 가능성이 높다(미측정).
  - `/settings`: proxy가 보호 경로로 다루지만 page가 없다. `[handle]`에 맞아 같은 500이 된다(추정).
  - 점이 든 한 segment 경로(`/wp-login.php`, `/xmlrpc.php`): proxy matcher가 점 경로를 빼므로 gate가 못 본다. public 파일이 없으면 `[handle]`로 가서 같은 500이 된다(추정). 스캐너 요청마다 전체 렌더 한 번이다.
  - 그 밖에는 없다. 검색 범위: `app/` 전체, `components/`, `utils/`, `lib/`의 `notFound(`, `forbidden(`, `unauthorized(`, `redirect(`. leaf gate 3개(`UserGate`, `ProjectGate`, `OwnerOnly`)는 모두 Suspense 안이다(`(rail)/layout.tsx:31`, `projects/[project]/layout.tsx:24`, `me/page.tsx:22`, `saved/page.tsx:21`). `log/[username]/[logId]` notFound, redirect는 no-store fetch 뒤라 prerender 중에는 닿지 않는다(표에 회귀 행으로 둔다).
- 로그의 "During prerendering, fetch() rejects…"는 실제 페이지(`/tags/[tag]`, `/[handle]/[slug]`)에서 prerender 종료 뒤 정상적으로 나는 신호다. 앱 catch가 이것도 오류로 기록한다. 500 원인은 아니다. 다만 catch-all이 Next 신호 오류를 삼키는 패턴은 남는 위험이다(`unstable_rethrow` 미사용).
- `dynamicParams = false`는 탈락이다. 샘플 handle 하나 외의 모든 사용자(`/log/[username]`, 다른 작성자 글)가 404가 된다.

## 4. 후보 (단순한 것부터, 각 검사는 실행 전에 적음)

공통 하위 단계 S0 (A, B 모두에 들어감): `/@<주인 아님>/about`, `/@<주인 아님>/resume`을 proxy에서 순수 검사(`isOwnerHandle`, I/O 없음)로 `NOT_FOUND_PATH` rewrite. 렌더 전에 404가 정해진다.

### A. proxy 허용 목록: 알려진 최상위 segment가 아니고 `@`도 아니면 404 rewrite

- 내용: `utils/notFoundGate.ts`에 순수 함수 하나. 첫 segment가 `@`로 시작하지 않고 앱의 정적 최상위 segment(`log`, `tags`, `write`, `admin`, `onboarding`, `sign-in`, `sign-up`, `api`, `trpc` 등)가 아니면 `NOT_FOUND_PATH`. + S0.
- 장점: diff가 가장 작다. Next 내부를 건드리지 않는다. 렌더 전에 404라 스캐너 요청이 싸다.
- 단점: 목록이 라우트와 어긋날 수 있다(새 최상위 라우트가 404). 점 경로는 matcher 밖이라 남는다. 원인 구조(ISR + layout throw)는 그대로다.
- 목록 어긋남 방지: 같은 Actions 잡에 정적 검사 하나. 허용 목록 = `app/` 최상위 폴더(route group 안 포함, `[handle]` 제외)와 같다. 파일 목록만 본다.
- 예상: 점 경로 행은 FAIL할 가능성이 높다. 그러면 B로 간다.
- 추적: → M-CC2 exit 1 (flag on 빌드 잡 통과), 배포 가능 조건.

### B. 내부 경로 rewrite: `/@u/...` → `/u/<u>/...`, `[handle]` 최상위 동적 segment 제거

- 내용: `app/(shell)/[handle]`을 `app/(shell)/u/[username]`으로 옮긴다(`_` 접두는 Next private folder라 쓰지 않는다). proxy가 `@` 경로를 rewrite한다. 공개 URL과 링크는 그대로 `/@u`다. `/u/...` 직접 요청은 proxy가 404. + S0.
- 효과: `/nope`, `/foo/bar`, `/xmlrpc.php`는 어떤 라우트에도 맞지 않는다. Next 기본 `/_not-found`(정적)로 간다. 허용 목록이 필요 없다.
- 단점: 파일 이동이 크다(`[handle]` 트리 전체, `generateStaticParams`, gate 경로 계산). middleware rewrite와 segment prefetch 캐시 키의 상호작용은 G-CC 지표(이동 시간)에 영향을 줄 수 있다. 측정 전에는 모른다.
- CC Constraint "단위 하나 = 배포 하나 = purge 하나"에 맞추려면 U4와 별도 단위로 배포한다.
- 추적: → M-CC2 exit 1 (flag on 빌드 잡 통과), 배포 가능 조건.

### C. 레일 태그를 캐시 가능한 읽기로: `TagCloud` 데이터를 `'use cache'` + `cacheLife`, catch에 `unstable_rethrow`

- 내용: legacy 저장소에서 `'use cache'` 범위는 `markCurrentScopeAsDynamic`이 무시한다(dynamic-rendering.js:204). `revalidate`가 0이 아니게 된다.
- 막는 줄: `apis/http.server.ts:15` "ONLY the OG route may pass it" (Phase CF, Cloudflare 단일 캐시). 오너 결정과 `DECISIONS.md` 행이 먼저다. 팀이 고를 수 없다.
- 단점: 404 재렌더 트리의 다른 `no-store` fetch가 하나라도 있으면 다시 깨진다. 알 수 없는 경로마다 ISR 캐시 항목이 생길 수 있다(미확인). 권하지 않는다.
- 추적: → M-CC2 exit 1 (flag on 빌드 잡 통과). 오너 결정 필요.

## 5. 통과/실패 검사 (A, B, C 공통, 배포 전)

조건: 운영과 같은 실행 형태. `next.config.ts:64` `output: 'standalone'`, 운영은 pm2 + standalone `server.js`다.

- `next dev`는 재현하지 못한다(app-page.js:982 `isDev`).
- `next start`는 재현한다. 다만 운영 형태가 아니다. standalone `server.js`를 쓴다.

기존 flag on 빌드 잡(GitHub Actions)을 확장한다. Clerk 등 env를 그대로 재사용한다. `@` 행은 `gateNotFound`의 `auth()`와 root `ClerkProvider`를 거치므로 env가 없으면 무관한 이유로 실패한다. 로컬 실행 금지 규칙에 따라 Actions에서만 돌린다.

1. `pnpm --filter dashboard_client_web build` (`cacheComponents: true`).
2. 배포 스크립트와 같은 방식으로 `.next/static`, `public`을 standalone에 복사한다.
3. `PORT=3100 node .next/standalone/apps/dashboard_client_web/server.js > server.log 2>&1 &`
4. 아래 표를 `curl -s -o body -w '%{http_code} %{size_download}'`로 친다. 각 경로를 2번 친다(첫 요청 = ISR 생성, 둘째 = 캐시 경로).
5. `grep -c 'Invalid revalidate configuration' server.log` = 0.
6. 음성 대조: 같은 잡을 수정 전 efe7eed에 먼저 돌린다. `/nope`가 500이어야 한다. 500이 안 나오면 이 잡은 운영을 재현하지 못한다. 그 상태로는 어떤 후보도 판정하지 않는다.

| 경로 | 기대 | 비고 |
| --- | --- | --- |
| `/nope`, `/zzz-unknown`, `/nope2` | 404, HTML 본문(> 21 bytes) | 실패 재현 경로 |
| `/foo/bar` | 404, HTML | `[handle]/[slug]` |
| `/settings` | 404 또는 로그인 리다이렉트, 500 아님 | page 없음 |
| `/xmlrpc.php`, `/wp-login.php` | 404 | 점 경로. A는 FAIL 예상 |
| `/@nobody/about`, `/@nobody/resume` | 404 | S0 |
| `/@nobody-xyz/no-such-post` (익명) | 404 | 기존 gate 회귀 |
| `/@nobody-xyz` | 500 아님 (404 또는 200 not-found 화면, #98) | gate 없음, 판정은 기존 설계 |
| `/`, `/@taeklim`, `/@taeklim/posts`, `/tags/rust`, `/log` | 200 | API 필요. API secret이 없으면 "500 아님"만 본다 |
| `/@taeklim/<실제 slug>` | 200 | 같음 |
| `/log/taeklim/999999999999` | 404 또는 200 not-found, 500 아님 | loading.tsx 뒤 notFound |

판정: 표의 모든 행이 기대와 같고 5가 0이고 6의 음성 대조가 500이면 PASS. 한 행이라도 다르면 FAIL. 그 후보는 다음 후보로 넘긴다.

배포 뒤 확인: 같은 표를 운영 URL에 `?cb=<난수>`로 친다. `blog-web` 로그에서 E22 0건.

## 6. 오너가 정할 것

- C를 고르려면 Phase CF 줄(`http.server.ts:15`)을 바꿔야 한다. 오너 결정이다.
- B는 공개 URL을 바꾸지 않지만 라우트 트리를 옮긴다. S-CC(B) 안의 tactic이라 팀 결정 범위로 본다. pm이 tactic 줄을 확인한다.
