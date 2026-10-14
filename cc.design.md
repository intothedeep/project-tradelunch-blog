# Phase CC: 앱 전체 cacheComponents와 RSC prefetch 성능 설계 (DRAFT, system-architect, 2026-10-13, rev2 2026-10-14)

> 상태: 설계 초안 rev2. 코드 없음. 전략 선택은 오너가 한다.
> rev1 → rev2: 성능 감사 `perf.audit.md`(25항목, 출처 `perf.sources.md`)를 합쳤다. 새 단위 QW1(빠른 수정), QW2(rail 폭 hotfix), U7(load-more). §5.3 지표 표, §7 단위 표, §10 질문을 새로 썼다. 새 절: §12 감사 항목 추적표, §13 `perf.audit.md` 정정.
> 위치 근거: 저장소 선례 `projects.design.md`, `traffic.design.md`와 같은 루트 `*.design.md`다.
> `00.plan.md` 절, `00.tasks.md` 행, `decisions.plan.md` 행은 product-manager(pm)가 쓴다. 이 문서는 고치지 않는다.
> 이 문서는 `projects.design.md` §7.2–§7.5를 이어받는다. 거기 적힌 내용은 다시 쓰지 않는다. 틀린 줄은 §11에서 정정한다.

## 0. Mission block (인용)

`00.plan.md` Phase PJ mission block에서 그대로 옮긴다. CC는 그 블록의 M5다.

- Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
- Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)
- Constraints: 스키마 변경 없음, 계약 = `@repo/types` `TProjectCard`, `TProjectPost`, `RESERVED_HANDLE_SEGMENTS` · BIGINT id는 문자열 · soft-delete만 · 새 `Link`는 `prefetch={false}` (#70) · 테스트 러너 금지, 검증 = 고의 파손(deliberate breakage) · 빌드는 GH Actions에서만 (Phase GCP) · 로컬 실행 = `~/.claude/CLAUDE.md` "No local execution" · mock은 `mocks/projects/`에 격리, 운영(prod)은 언제나 `real` · 예약 slug 6개 (#76) · 옛 URL은 308 (#71).
- M5: CC (앱 전체 `cacheComponents`), stub. 열림 조건 = #70 커밋이 main에 있음 + P1 gate PASS. 설계와 행은 그때 쓴다. 첫 행 = `staleTimes` (`projects.design.md` §7.4).

- CC의 goal, strategy, milestone 줄은 아래 초안뿐이다. 오너 승인 뒤 pm이 `00.plan.md` 블록에 쓴다(`rules/docs.md` §0.1). 이 문서가 블록을 대신하지 않는다.

초안 (DRAFT, architect, 오너 승인 대기, `00.plan.md`에 아직 없음):

| 줄 | 초안 |
| --- | --- |
| G-CC | 로그인 상태 W1 이동 시간 p50을 기준선보다 판정선 이상 줄인다. 가드(§5.3)는 모두 통과한다. 판정선 숫자는 기준선 3회 뒤 채운다. 날짜는 오너 |
| S-CC → G-CC | B 단계 이전(§6). 다른 후보 A, C |
| M-CC1 → S-CC | MVP1: U0, QW1, QW2, U1, U2, U3. exit = W1–W4가 운영에서 돈다, 가드 통과, 각 단위 주 지표 판정이 `00.runs.md`에 있음. cycle 0/2. recovery 0/2 |
| M-CC2 → S-CC | MVP2: U4. exit = flag on 빌드 잡 통과, 배포 뒤 G-CC 판정. cycle 0/2. recovery 0/2 |
| M-CC3 → S-CC | MVP3: U5, U6, U7. exit = 글 수정 → `/api/revalidate` → purge 뒤 익명 창에 새 값, U5 주 지표 판정. cycle 0/2. recovery 0/2 |
| Tactic | 단위마다 kill = §7 표의 되돌림 조건 |
- 오너 지시(2026-10-13, dispatch 경유): P1이 닫히면 P2 전에 CC를 한다. 기준 글은 velog 글이다. 바꾸기 전에 기준선(baseline)을 잰다.
- 오너 지시(2026-10-14, dispatch 경유): 첫 CC 작업 단위 = 공유 왼쪽 rail(shared left rail) 한 개. §4.

## 1. 결론

```
오늘                                         CC 뒤 (MVP3)
─────────────────────────────────────        ─────────────────────────────────────────
모든 route = dynamic                          route = static shell + Suspense 잎(leaf)
  원인: layout의 cookies(), 잎 밖 fetch,        cookies() 없음. rail 상태는 client(§4.3)
        force-dynamic 6곳, Suspense 없는 params params는 sample(generateStaticParams)로 검증
rail = 형제 layout 6곳이 각각 렌더             rail = (shell) layout 한 곳. 이동 때 다시 안 받음
client router cache = 0초                     staleTimes / cacheLife.stale로 재사용
prefetch = 빈 껍데기 또는 없음                 hover prefetch가 static shell을 받는다
Next 데이터 캐시 = 없음 (no-store 전부)        'use cache' = 공개 저빈도 데이터만 (tree, projects, tags)
무효화 = cf-purge.sh 한 층                    무효화 = /api/revalidate(expire 0) → cf-purge.sh 두 층
```

- 할 수 있다. 막힘은 많지만 대부분 "잎으로 옮기기"다. 표는 §3이다.
- `getLocale()`은 막힘이 아니다. 설치된 next-intl 4.13.0 소스로 확인했다(§2). `projects.design.md` §7.4 첫 행을 정정한다.
- 기존 버그 하나를 찾았다. 익명 HTML은 엣지(edge)에 1일 남는다. `railCollapsed` 쿠키는 bypass 규칙에 없다. 그래서 첫 MISS 방문자의 rail 폭이 모두에게 간다. §4.3이 이것도 고친다.
- 권고 전략(strategy): B (§6). 순서: 기준선 → 빠른 수정(QW1) → rail 폭 hotfix(QW2) → 공유 rail → staleTimes → 잎 정리(flag off) → flag on → `'use cache'` 조각 → 무효화 → load-more.
- 감사(`perf.audit.md`)의 FAIL 11, PARTIAL 7은 모두 단위에 매겼다(§12). 감사의 틀린 줄 4개는 §13에서 정정한다.
- 서버 fetch는 오늘 요청 안에서 한 번도 중복 제거(memoization)되지 않는다. `composeSignal`이 언제나 signal을 붙이기 때문이다(§2). 그래서 QW1의 `cache()`가 효과가 크다.

## 2. 라이브러리 지원 확인

방법: 설치본 `node_modules` 소스와 Next가 함께 싣는 문서(`node_modules/next/dist/docs/`)를 읽었다. 웹 changelog는 열지 않았다.

| 라이브러리 | 설치 버전 | 근거 | cacheComponents 판정 |
| --- | --- | --- | --- |
| next | 16.2.9 | `docs/.../cacheComponents.md`: 16.0.0에서 도입, stable 설정. `staleTimes`는 아직 experimental | 지원. 문서 확인 |
| next-intl | 4.13.0 | `server/react-server/getConfig.js` 25–33행: `requestLocale`은 lazy getter다. `i18n/request.ts`는 `locale`만 읽는다. `getLocale`, `getTranslations`, `getMessages`는 `getConfig`만 부른다 | `headers()`를 읽지 않는다. 소스 확인, 빌드 미확인 |
| @clerk/nextjs | 7.5.9 | `app-router/server/ClerkProvider.js` 16, 24행: `dynamic` prop이 없으면 요청을 읽지 않는다. `keyless-provider.js` 11행: keyless는 dev에서만 | root `ClerkProvider`는 static과 맞는다. `auth()`는 runtime API라 Suspense 잎에만. 소스 확인, Clerk 문서 미확인 |
| next-themes | 0.4.6 | client 컴포넌트. 서버 API 없음 | 영향 없음. 미확인(소스 안 읽음) |
| jotai | 2.20.1 | `JotaiProvider.client.tsx`: client `Provider`. 서버 API 없음 | 영향 없음. Activity 주의(§9) |
| next (fetch 중복 제거) | 16.2.9 | `node_modules/next/dist/server/lib/dedupe-fetch.js` 88–96행: `options.signal`이 있으면 중복 제거 없이 원래 fetch를 부른다. `apis/http.core.ts:35-37` `composeSignal`은 언제나 `AbortSignal.timeout`을 돌려준다. `http.server.ts:80`이 그것을 넘긴다 | 모든 서버 fetch가 요청마다 따로 나간다. 소스 확인. 감사 §5-5의 열린 질문을 닫는다 |

Next 문서에서 이 설계가 기대는 규칙 (모두 `node_modules/next/dist/docs/01-app/` 아래):

| 규칙 | 출처 |
| --- | --- |
| `cookies`, `headers`, `searchParams`, `params`는 runtime API다. Suspense 밖이면 빌드 오류 | `01-getting-started/08-caching.md` 134–141, 292행 |
| `params`는 `generateStaticParams`가 sample을 하나 이상 주면 runtime이 아니다. 빈 배열은 빌드 오류 | 같은 파일 139행, `04-functions/generate-static-params.md` 310행 |
| sample 밖의 param은 첫 요청 때 검증하고 디스크에 저장한다 | `03-file-conventions/dynamic-routes.md` 153, 260행 |
| `dynamicParams`는 쓸 수 없다 | `route-segment-config/dynamicParams.md` 22행 |
| `force-dynamic`은 필요 없다. 지운다. `revalidate`는 `cacheLife`로 바꾼다 | `02-guides/migrating-to-cache-components.md` |
| `'use cache'` 안에서 `cookies()`, `headers()` 금지. 기본 저장소는 in-memory LRU | `01-directives/use-cache.md` 196–207행 |
| `new Date()`, `Math.random()`은 `connection()` + Suspense 또는 `'use cache'` | `08-caching.md` 200–233행 |
| `generateMetadata`의 runtime 읽기와 uncached fetch는 요청 때로 미룬다 | `04-functions/generate-metadata.md` 1256행 |
| flag가 켜지면 client 재사용 시간은 `cacheLife(...).stale`이 정한다. `staleTimes.static`이 default profile의 stale을 바꾼다 | `04-functions/cacheLife.md` 247–257행 |
| `revalidateTag(tag, 'max')`는 stale-while-revalidate다. 외부 호출(webhook)은 `{ expire: 0 }` | `04-functions/revalidateTag.md` 20–24, 136행 |
| flag가 켜지면 이전 route를 `<Activity hidden>`으로 남긴다. 상태 유지, effect는 다시 돈다 | `05-config/.../cacheComponents.md` 36–48행 |
| `instrumentation-client.ts`의 `onRouterTransitionStart` | `03-file-conventions/instrumentation-client.md` |

## 3. dynamic 읽기 목록 (inventory)

### 3.1 옮기는 규칙

| 자리 | Suspense 안인가 | 처리 |
| --- | --- | --- |
| `loading.tsx`가 있는 segment의 `page.tsx` | 예. `loading.tsx`가 page를 감싼다 | 그대로 둬도 빌드는 된다. shell은 skeleton뿐이다. 나중에 잎으로 더 내린다 |
| `layout.tsx` | 아니다. 자기 `loading.tsx`는 layout을 감싸지 않는다 | 데이터 읽기는 Suspense 잎으로. `params`는 sample로 |
| `loading.tsx` 없는 page | 아니다 | `loading.tsx` 추가 또는 Suspense 잎 |
| `generateMetadata` | 요청 때로 미뤄진다 | 그대로. page에 dynamic 잎이 있으면 오류 없음 |
| QW1, QW2, U1–U3, U7 | | flag와 무관하다. 파일별 `git revert`로 되돌린다 |
| U4 | | 한 묶음이다. `'use cache'`(D26, D27)는 flag가 있어야 돈다. `force-dynamic` 삭제는 flag가 있어야 안전하다. 그래서 flag 한 줄만 끄면 빌드가 깨진다. 되돌림 = U4 커밋 `git revert` + 재배포 + purge |

### 3.2 목록

route 기호: `F` = `/`, `T` = `/tags/<tag>`, `P` = `/@u/posts`, `J` = `/@u/projects*`, `S` = `/@u/<slug>`, `A` = `/@u/about`, `R` = `/@u/resume`, `V` = `/@u/saved`, `L` = `/log*`, `M` = `/me*`, `W` = `/write*`.

| # | 파일:줄 | API | dynamic으로 만드는 route | 옮기는 법 | 단위 |
| --- | --- | --- | --- | --- | --- |
| D1 | `app/layout.tsx:106-107` | `getLocale()`, `getMessages()` | 없음 (§2: `headers()`를 읽지 않음) | 그대로. `i18n/request.ts`가 `requestLocale`을 읽지 않는다는 주석만 남긴다 | U4 확인 |
| D2 | `components/shell/BlogShell.server.tsx:44` | `cookies()` `railCollapsed` | F T P J S | 쿠키 읽기를 지운다 (§4.3 R-A). BlogShell 나누기는 U1b | QW2 |
| D3 | `components/rail/LeftRailContainer.server.tsx:19` | `cookies()` | F T P J S A R | 같음 | QW2 |
| D4 | `app/(feed)/page.tsx:26` | `force-dynamic` | F | 지운다 | U4 |
| D5 | `app/(feed)/tags/[tag]/page.tsx:12, 19` | `force-dynamic`, `params` | T | `force-dynamic` 삭제. params는 `loading.tsx` 안이라 그대로 | U4 |
| D6 | `app/log/page.tsx:7`, `log/[username]/page.tsx:12, 27`, `[logId]/page.tsx:9, 22` | `force-dynamic`, `params` | L | 삭제. `loading.tsx` 추가. P2 이동(logs) 때 함께 | U4 |
| D7 | `app/me/page.tsx:6` | `force-dynamic` | M | 삭제. 데이터 읽기를 Suspense 잎으로 | U4 |
| D8 | `app/me/saved/page.tsx:10` | `currentUser()` | M | Suspense 잎 안에서 redirect | U3 |
| D9 | `app/[handle]/layout.tsx:13` | `params` (`@` 검사 + `notFound()`) | 모든 `/@u/*` | 잎으로 옮기지 않는다. 잎이면 404 화면이 status 200으로 나간다. 그리고 엣지가 그 200을 1일 저장한다. sample로 푼다: `generateStaticParams` → `[{ handle: '@<HOME_FEED_AUTHOR>' }]` | U4 |
| D10 | `app/[handle]/posts/layout.tsx:23`, `projects/layout.tsx:16` | `params` | P J | D9 sample이 덮는다 | U4 |
| D11 | `app/[handle]/[slug]/layout.tsx:22-27` | `params` + `getProjectsTree` uncached fetch (rail 고르기) | S | rail 고르기를 Suspense 잎 `RightRailSwitch`로. layout은 shell만 | U3 |
| D12 | `app/[handle]/posts/layout.tsx:35`, `[slug]/layout.tsx:44` → `MobileContextHeader.server.tsx:19` | uncached fetch `getUserProfile` | P S | Suspense로 감싼다 (fallback = 칩 skeleton) | U3 |
| D13 | `app/[handle]/posts/page.tsx:19, 68` | `searchParams` | P | `loading.tsx` 안이라 빌드는 된다. 필터 칸만 잎으로 내리는 일은 나중 | U4 확인 |
| D14 | `app/[handle]/posts/page.tsx:85` → `CategorySidebarWrapper.server.tsx:31` | `auth()` | P | page가 `loading.tsx` 안이다. 그대로. 잎 Suspense는 나중 | U4 확인 |
| D15 | `app/[handle]/[slug]/page.tsx:27, 67` | `params`, uncached fetch (metadata, tree) | S | page는 `loading.tsx` 안. `[slug]` sample 1개 추가(§10 Q5) | U4 |
| D16 | `components/blog/PostContentCard.server.tsx:30` | `auth()` | S | 이미 Suspense 안. 그대로 | 없음 |
| D17 | `app/[handle]/components/PostJsonLd.server.tsx:18` | `auth()` | S | 이미 Suspense 안. 그대로 | 없음 |
| D18 | `components/blog/PostContentToc.server.tsx:15` | `auth()` | S | 이미 Suspense 안 | 없음 |
| D19 | `apis/getPosts.fetch.server.ts:52` | `auth()` | F P | `BlogMainPage` Suspense 안. 그대로 | 없음 |
| D20 | `app/[handle]/components/ProjectsTreeWrapper.server.tsx:17` | `auth()` | J S | `ProjectsRail`의 Suspense 안 | 없음 |
| D21 | `app/[handle]/projects/page.tsx:12, 24`, `[project]/page.tsx:12, 23` | `params` | J | `loading.tsx` 안. `[project]` sample 1개(§10 Q5) | U4 |
| D22 | `app/[handle]/about/page.tsx:28`, `resume/page.tsx:132` | `params` | A R | D9 sample이 덮는다 | U4 |
| D23 | `app/[handle]/resume/page.tsx:117` | `new Date().toLocaleDateString()` | R | client 잎으로 옮긴다(mount 뒤 표시) | U3 |
| D24 | `app/[handle]/saved/page.tsx:16` | `params` | V | D9 sample. 소유자 검사는 이미 client gate | U4 |
| D25 | `app/write/[postId]/page.tsx:12` | `params` | W | `loading.tsx` 추가 | U4 |
| D26 | `app/sitemap.ts:25, 30` | `revalidate`, `new Date()` | `/sitemap.xml` | 1안: 데이터 fetch 함수만 `'use cache'` + `cacheLife('days')`. 2안: metadata route의 `export const revalidate`가 flag 아래에서도 허용되면 그대로. U4 빌드로 확정 | U4 |
| D27 | `app/[handle]/[slug]/opengraph-image.tsx:23` | `revalidate = 86400` | OG 이미지 | `ImageResponse`는 `Response`라 `'use cache'` 반환값이 될 수 없다(직렬화 규칙, `use-cache.md` 103–110행). 제목 fetch(`getPostBySlug(slug, null)` 감싼 함수)만 `'use cache'` + `cacheTag`. 이미지는 캐시 밖에서 만든다. MISS마다 CPU는 남지만 엣지가 OG를 1일 저장한다(`deploy/traffic/README.md` §2 b). D26의 2안도 함께 본다. U4 빌드로 확정 | U4 |
| D28 | `apis/http.server.ts:78` | 모든 fetch `cache: 'no-store'` | 전부 | flag on 뒤에는 "uncached data"다. Suspense 잎이면 문제 없다. `'use cache'` fetcher용 경로는 U5에서 정한다 | U5 |
| D29 | `components/rail/TagCloud.server.tsx:32-33` | uncached fetch | 공유 rail | 이미 Suspense 안. U5에서 `'use cache'` 후보 1번 | U5 |
| D30 | `components/log/LogCardBody.tsx:32` | `Date.now()` (렌더 중) | L | 이미 dynamic 잎 안이면 그대로. U4 빌드 오류가 나면 client mount 뒤로 | U4 확인 |

- 빌드가 실제로 잡는 목록이 진실이다. 이 표는 빌드 전에 고칠 순서를 정하는 용도다.
- 빌드는 GH Actions에서만 돈다. 그래서 단위마다 "빌드만, 배포 없음" 잡을 하나 둔다(§7 U3).

## 4. U1 공유 왼쪽 rail (shared left rail)

### 4.1 무엇을 알려고 하나

- 형제 layout 6곳이 rail을 따로 렌더한다. 그래서 형제 route 사이 이동마다 rail이 다시 mount되고 TagCloud를 다시 받는다.
- 모든 RSC payload에 rail이 다시 실린다. 기준선 §5가 그 바이트를 잰다.

| layout | rail 렌더 방식 | 오늘 쿠키 읽기 |
| --- | --- | --- |
| `app/(feed)/layout.tsx` | `BlogShell leftRail=<LeftRailContainer/>` | 예 (D2, D3) |
| `app/[handle]/posts/layout.tsx` | 같음 | 예 |
| `app/[handle]/[slug]/layout.tsx` | 같음. `showRecentVisited={!isProjectPost}` | 예 |
| `app/[handle]/projects/layout.tsx` | 같음. `showRecentVisited={false}` | 예 |
| `app/[handle]/about/layout.tsx` | `LeftRailAside` + `LeftRailContainer`, BlogShell 없음 | D3만 |
| `app/[handle]/resume/layout.tsx` | 같음 | D3만 |

rail이 없는 route (grep 확인, `LeftRailContainer|BlogShell|LeftRailAside` 사용처 15파일): `log/*`, `me/*`, `write/*`, `admin/*`, `onboarding`, `sign-in`, `sign-up`, `[handle]/saved`, `[handle]/page.tsx`(redirect만), `not-found.tsx`.

### 4.2 폴더 이동 (URL 불변)

```
오늘                                   U1 뒤
app/                                   app/
├── layout.tsx  (html, providers)      ├── layout.tsx            불변
├── (feed)/                            ├── (shell)/
│   ├── layout.tsx  BlogShell+rail     │   ├── layout.tsx        새: RailFrame (rail 1번)
│   ├── page.tsx, loading.tsx          │   ├── (feed)/
│   └── tags/[tag]/                    │   │   ├── layout.tsx    ContentFrame + HomeRightRail
├── [handle]/                          │   │   └── page.tsx, loading.tsx, tags/[tag]/
│   ├── layout.tsx  '@' 검사           │   └── [handle]/
│   ├── posts/ layout BlogShell+rail   │       ├── layout.tsx    '@' 검사 불변
│   ├── projects/ layout 같음          │       ├── posts/ layout ContentFrame + UserContextRail
│   ├── [slug]/ layout 같음            │       ├── projects/ layout ContentFrame + ProjectsRail
│   ├── about/ resume/ layout rail     │       ├── [slug]/ layout ContentFrame + RightRailSwitch(잎)
│   ├── saved/ (rail 없음)             │       ├── about/ resume/ layout <main> 전폭만
│   └── components/                    │       ├── saved/       rail 숨김 (§4.4)
├── log/ me/ write/ admin/ ...         │       └── components/
                                       ├── log/ me/ write/ admin/ ...   불변, rail 없음
```

- 이동: `git mv app/(feed) app/(shell)/(feed)`, `git mv app/[handle] app/(shell)/[handle]`. route group이라 URL은 그대로다.
- import 경로가 깨진다: `@/app/[handle]` 문자열이 16파일 19곳(2026-10-13 grep). `components/rail/HomeRightRail.server.tsx`, `components/blog/sidebar-blog.server.tsx`도 포함한다.
- 권고: 이동 전에 `app/[handle]/components/`를 `components/projects/`로 먼저 옮긴다. 그러면 `app/` 경로를 import하는 곳이 사라진다. 커밋을 둘로 나눈다(옮기기, 그다음 group 이동).
- 커밋은 `git mv`만 담는다. 내용 변경과 섞지 않는다. 그래야 rename으로 추적된다.

### 4.3 BlogShell 나누기와 rail 접힘 상태

```
(shell)/layout.tsx  (server, 요청 읽기 없음)
└─ RailFrame (server)              div.flex.min-h-screen.flex-col.font-mono > div.flex.w-full.flex-1
   ├─ LeftRailAside (client)        폭 = CSS가 <html data-rail>로 정함
   │  └─ LeftRail (client)          PrimaryNav · tagCloud 칸 · RecentVisited(경로 규칙 §4.4)
   │     └─ tagCloud = <Suspense><TagCloud/></Suspense>   (server 조각을 prop으로 전달)
   └─ {children}                    아래 형제 중 하나
        ├─ ContentFrame (server)    main(max-w-3xl, mobileTopContext) + aside(rightRail) + userContextSheet
        └─ <main> 전폭             about, resume
```

- `BlogShell` = `ContentFrame`으로 이름과 역할이 바뀐다. 시그니처에서 `leftRail`이 빠진다. `topbar`는 오늘 쓰는 곳이 없다. 그대로 둔다.
- `LeftRailContainer`는 `cookies()`를 잃고 동기 server 컴포넌트가 된다.

rail 접힘 상태: 세 안

| 안 | 내용 | hydration | 엣지 캐시 | 판정 |
| --- | --- | --- | --- | --- |
| **R-A (권고)** | root layout `<head>`의 차단 inline script가 쿠키를 읽어 `<html data-rail="collapsed">`를 쓴다. 폭과 접힘 때 숨길 블록은 CSS가 정한다. React는 `useSyncExternalStore`로 읽고 server snapshot = 펼침 | server와 첫 client 렌더가 같은 펼침 markup이다. 불일치 없음. `<html suppressHydrationWarning>`은 이미 있다 | HTML에 상태가 없다. 버그가 사라진다 | 채택 |
| R-B | `cookies()`를 Suspense 잎으로 | 맞음 | 첫 MISS 방문자 상태가 1일 동안 모두에게 간다(오늘 버그 그대로) | 버림 |
| R-C | mount 뒤에만 rail 렌더 | 맞음 | 맞음 | 첫 화면에서 폭이 바뀐다(layout shift). 버림 |

- rev2: R-A는 U1b가 아니라 QW2(hotfix)로 먼저 나간다(§7, §10 Q10). 폴더 이동 없이 rail 컴포넌트 4개와 root layout만 바뀐다. 그래서 U1b는 구조 이동만 남는다.
- 감사 A2의 처방(false로 seed, mount 뒤 `useEffect`로 쿠키 읽기)은 쓰지 않는다. 접힘 사용자에게 첫 화면 폭이 한 번 바뀐다. R-A는 paint 전에 CSS가 폭을 정해서 그 깜빡임이 없다.
- next-themes가 같은 방식이다(차단 script + class). 테마와 같은 시점에 적용된다.
- 쿠키 `railCollapsed`는 이름과 값(`1`, `0`)을 그대로 둔다. 기존 사용자의 상태가 유지된다. 서버는 더 읽지 않는다.
- `useHydrateAtoms([[isLeftRailCollapsedAtom, initialCollapsed]])` 두 곳(`LeftRailAside.client.tsx:27`, `LeftRail.client.tsx:35`)을 지운다. 오늘 고친 per-request JotaiProvider(공유 store 버그)는 그대로 둔다. 서버 seed가 없으니 그 버그의 원인 자체가 없어진다.
- script는 server root layout에 둔다. client 컴포넌트가 `<script>`를 렌더하면 React 19가 경고한다(오늘 `fd0e7a5` 커밋의 next-themes 경고와 같은 종류, 추정).
- 확인(고의 파손, deliberate breakage): 쿠키 `railCollapsed=1`로 `/`를 연다. 콘솔 hydration 오류 0, 첫 paint 폭 = 접힘. script를 지운 빌드에서는 폭이 바뀌는 것을 본다.

### 4.4 경로 규칙: per-route prop 대신 `usePathname()`

| 경로 | RecentVisited | rail 자체 | 근거 |
| --- | --- | --- | --- |
| `/@u/projects`, `/@u/projects/<p>` | 숨김 | 보임 | #79 |
| `/@u/<slug>` 중 프로젝트 글 | 숨김 | 보임 | #79. 경로만으로는 알 수 없다(아래) |
| ~~`/@u/saved`~~ | ~~해당 없음~~ | ~~**숨김** (오늘 rail 없음)~~ | ~~오늘 동작 유지. §10 Q2~~ <!-- SUPERSEDED 2026-10-14: 오너가 `/@u/saved`, `/@u/me`에 공유 왼쪽 rail을 요청. §15.5 --> |
| `/@u/saved`, `/@u/me` | 보임 | **보임** | 오너 2026-10-14. §15.5 |
| 그 밖 | 보임 | 보임 | 오늘과 같음 |

- 규칙은 순수 함수 하나: `utils/rail-visibility.ts` `railVisibility(pathname) → { showRail, showRecent }`. `RESERVED_HANDLE_SEGMENTS`(`@repo/types`)를 import해 경로 이름을 고정한다.
- 한계: slug가 프로젝트 글인지는 tree가 정한다. URL에는 없다. 그래서 `usePathname()`만으로 #79를 지킬 수 없다.
- 권고: `[slug]` 잎(`RightRailSwitch`)이 프로젝트 글일 때 `<RailContextPublisher hideRecent />`를 렌더한다. `TocPublisher`와 같은 effect + cleanup 방식이다. Activity에서도 안전하다(숨겨지면 cleanup).
- RecentVisited는 localStorage를 mount 뒤에 읽는다. 그래서 같은 commit에서 숨김 신호가 오면 깜빡임이 보이지 않는다(추정. U1 확인 항목).
- 대안: 프로젝트 글 상세에서는 RecentVisited를 보인다(#79 일부 완화). §10 Q1.

### 4.5 위험 (U1 한정)

| 위험 | 내용 | 대응 |
| --- | --- | --- |
| `[handle]` `@` 검사와 중첩 | `/foo`도 `(shell)` layout을 지난 뒤 `[handle]` layout에서 `notFound()`다 | `notFound()`는 부모의 not-found 경계로 간다. `(shell)/not-found.tsx`를 만들지 않는다. 그러면 root `not-found.tsx`가 root layout의 children을 바꾼다. 404는 오늘처럼 rail 없이 나간다 |
| 404 요청이 rail 데이터를 부름 | 봇의 임의 경로마다 `(shell)` layout의 TagCloud가 돌 수 있다(layout은 병렬 렌더) | U5에서 TagCloud를 `'use cache'`로. 그 전에는 기준선의 404 MISS 비율을 본다 |
| `loading.tsx` 자리 | `(shell)/loading.tsx`를 두면 `(feed)`와 `[handle]` 전체를 감싼다 | 만들지 않는다. 기존 `loading.tsx` 6개는 segment 안에 그대로. rail은 로딩 중에도 보인다 |
| `about`, `resume` 폭 | ContentFrame의 `max-w-3xl`이 맞지 않는다 | 그 둘의 layout은 `<main className="flex min-w-0 flex-1 flex-col">`만 렌더 |
| `/@u/saved`에 rail이 생김 | `[handle]` 전체가 group 안으로 간다 | `railVisibility`가 숨긴다(§4.4) |
| 프로젝트 글 판단이 잎으로 감 | 잎이 늦으면 오른쪽 rail이 skeleton을 먼저 보인다 | fallback = 오른쪽 rail skeleton. 기준선과 비교 |
| `UserContextSheet.client.tsx`, `BlogShell.test.tsx` | BlogShell을 import한다 | sheet는 이미 연결 해제된 파일. test는 쓰지 않는 파일(테스트 중단). 둘 다 이름만 고친다 |

## 5. 기준선(baseline) 측정 계획

### 5.1 무엇을 알려고 하나

- CC 단위마다 이동이 빨라지는가, RSC 요청과 바이트가 줄어드는가를 안다.
- 동시에 #68의 50 / 10 s 한도를 넘지 않는가, 엣지 HIT와 비공개 BYPASS가 그대로인가를 지킨다.

### 5.2 측정 경로 (walk)

| ID | 순서 (앱 안 클릭, URL 입력 아님) | 무엇을 보나 |
| --- | --- | --- |
| W1 | `/` → 왼쪽 메뉴 "My blog" `/@taeklim/posts` → 메뉴 "Projects" `/@taeklim/projects` → 카드 `/@taeklim/projects/<P>` → 글 `/@taeklim/<S>` → 메뉴 Home `/` | 이동 시간, `_rsc` 수, payload 바이트 (오너 요청 경로 포함) |
| W2 | W1 끝에서 브라우저 뒤로 ×3 | client router cache 재사용(staleTimes) |
| W3 | `/`에서 load-more 2회까지 스크롤 | #70 가드. 10초 창의 최대 요청 수 |
| W4 | 카드 1장에 마우스 올리기 1회, 메뉴 링크 6개가 보이는 첫 화면 | 링크 1개당 prefetch 요청 수 (segment prefetch) |

- `<P>`, `<S>`는 실행 전에 고정해 `manifest.json`에 적는다. 같은 값을 모든 실행에 쓴다.
- 팔(arm) 둘: 익명(시크릿 창), 로그인(오너). 로그인은 엣지를 BYPASS하므로 오리진 효과가 그대로 보인다.

### 5.3 지표 (실행 전에 적는다, `rules/measurement.md` §1)

판정은 단위마다 주 지표 하나로 한다. 나머지는 기록만 한다.

주 대비는 모든 단위가 같다: 직전 단위 뒤 3회 중앙값 vs 이 단위 뒤 3회 중앙값. 첫 비교의 기준은 U0b 기준선이다.

| 단위 | 주 지표 | 판정선 (통과) | 실패 조건 |
| --- | --- | --- | --- |
| QW1 빠른 수정 | 서버 fetch 수 / MISS 렌더 1회. 페이지 3개 합: `/`, `/@taeklim/posts`, `/@taeklim/<S>`. 각각 `?cb=` 새 값. `ssr_fetch` 로그 줄(U0a)을 그 요청 시간 창에서 센다 | 줄어든 수 ≥ max(범위 × 2, 2) | 미달이면 "중복 제거 효과 없음"으로 적는다. 가드가 통과하면 코드는 남긴다(C3, C2는 스트리밍 순서 수정이라 정확성 이득) |
| QW2 rail 폭 hotfix | 정확성 판정(이진). (1) 익명 MISS `/?cb=X`의 HTML이 `Cookie: railCollapsed=1` 유무와 무관하게 rail 폭 class가 같다. (2) 쿠키 1인 브라우저의 첫 paint 폭 = 접힘(오너, Performance filmstrip). (3) hydration 오류 0 | 셋 모두 참 | 하나라도 거짓이면 되돌림 |
| U1 공유 rail | W1 익명, `text/x-component` 응답 본문 바이트 합 | 줄어든 양 ≥ max(범위 × 2, 기준선 HAR rail 조각 크기 × 0.5) | 미달이면 "바이트 효과 없음"으로 적는다. 가드가 통과하면 U1은 남긴다(구조 정리) |
| U2 staleTimes (§16이 대체) | W2 익명, 뒤로 3회 동안의 `_rsc` 요청 수 | 줄어든 수 ≥ max(범위 × 2, 1) | 0 감소면 되돌림(설정 한 줄) |
| U3 잎 정리 | W1 로그인, 5단계(글 상세) 이동 시간 p50 (`[nav]` 로그) | 줄어든 양 ≥ max(범위 × 2, 기준 p50의 10 %) | 미달이면 "효과 없음"으로 적는다. 가드가 통과하면 남긴다(U4의 필수 준비) |
| U4 flag on | W1 로그인, 이동 시간 p50 (5단계 전체) | 줄어든 양 ≥ max(범위 × 2, 기준 p50의 10 %) | 미달이면 U4 되돌림과 `recover` |
| U5 'use cache' | MISS TTFB p50, `/`, `/@taeklim/projects`, `/@taeklim/<S>`, `?cb=` | 줄어든 양 ≥ max(범위 × 2, 50 ms) | 미달이면 그 fetcher의 지시문 되돌림 |
| U6 무효화 | 정확성 판정(이진). 글 1개 제목 수정 → 스크립트 1회 → 60초 안에 익명 창과 로그인 창 모두 새 제목 | 참 | 거짓이면 되돌림 |
| U7 load-more | W3 동안 `my.`에 온 `/api/posts/load-more` 요청 수 (`proxy.ts` 요청 로그) | (b)안: 0. (a)안: 두 번째 같은 스크롤에서 `cf-cache-status: HIT` 비율 ≥ 90 % | 미달이면 되돌림 |

- QW1 지표를 Next 쪽에서 세는 이유: SSR 호출은 `blog-api.`(Cloudflare 경유)로 간다. 익명 GET은 엣지 HIT라 Express 로그에 남지 않을 수 있다(감사 §5-6).
- `React.cache`가 `generateMetadata`, layout, page를 한 요청으로 묶는지는 확인하지 못했다(감사 §5-7). QW1 지표가 이것을 같이 잰다: `/@taeklim/<S>`의 `/posts/slug/` 줄이 1이면 묶는다.
- 판정선의 범위 값은 기준선 3회를 잰 뒤 채운다. 그 전에 공식은 바꾸지 않는다. pm이 공식을 `decisions.plan.md` 행으로 먼저 남긴다(write-first).
- 10 %, 50 ms, 1, 0.5는 잡음이 0일 때의 바닥값이다. 바이트처럼 결정적인 지표에만 쓰인다.

가드 (모든 단위, 하나라도 깨지면 그 단위 되돌림):

| ID | 가드 | 통과 |
| --- | --- | --- |
| G-a | W1+W3+W4 동안 10초 창 최대 요청 수 (`/_next/` 제외, Cloudflare 규칙과 같은 범위) | 기준선 + 20 % 이하. 30을 넘으면 그 자체로 오너 경보(되돌림 조건은 아님) |
| G-b | W4 링크 1개당 prefetch 요청 수 | 기준선보다 늘지 않음 |
| G-c | `./_scripts/cloudflare/traffic-check.sh` | 0 FAIL |
| G-d | 공개 표본 응답 `set-cookie` | 0줄 |
| G-e | `/nope`, `/@nope/x` status (layout 단계 `@` 검사) | 404. 200이면 엣지가 1일 저장한다. flag 아래에서 200이 되면 처방 = `@` 검사를 `proxy.ts`로 옮겨 not-found로 rewrite (shell이 먼저 나가지 않게) |
| G-e2 | `/@taeklim/nope` status (slug 단계) | 기록만. 오늘도 `[slug]/loading.tsx` 때문에 첫 flush 뒤 `notFound()`라 200 + noindex일 가능성이 높다. 기준선이 확정한다. 발행 뒤 purge가 그 200을 지운다 |
| G-f | W1 콘솔 hydration 오류 | 0, rail 펼침과 접힘 두 상태 모두 |
| G-g | 비공개 글 고의 파손: 익명 창에서 오너의 비공개 글 URL | 404 화면, 본문 없음 |
| G-h | 같은 URL의 prefetch와 이동이 서로 다른 `_rsc` 값 | 다름 (Cloudflare는 `Vary`로 key를 나누지 않는다) |
| G-i | VM 메모리 (`./_scripts/gcp/vm-metrics.sh 1`) | 최대 < 80 %. 오늘 35–57 % (`deploy/traffic/README.md` §4b) |
| G-j | 서버 fetch 수 / MISS 렌더 (QW1 지표) | QW1 뒤 단위에서 늘지 않음 |
| G-k | 익명 HTML이 `railCollapsed` 쿠키와 무관 (QW2 판정 (1)) | QW2 뒤 모든 단위에서 참 |
| G-l | 감사 PASS 항목 회귀 없음: B1, B3 (`rg -n "Promise\.all"` 0건, action은 mutation 전용), C5 (본문, feed 첫 10개, 댓글이 HTML에 있음), C6 (`initialData` seed 유지), D2 (`prefetch=` 수 불변 또는 감소), D3 (`?_rsc=` `text/x-component` HIT) | 모두 유지 |

기록만 하는 지표: 단계별 payload 바이트, 단계별 `_rsc` 수, 익명 이동 시간, HIT 표본 TTFB, Cloudflare Percent cached 7일(대시보드), rail 조각 크기.

### 5.4 측정 도구와 실행 주체

| 지표 | 도구 | 누가 | 로컬 실행 규칙 |
| --- | --- | --- | --- |
| W1–W4 요청, 바이트, prefetch 헤더 | Chrome DevTools Network, "Preserve log", "Disable cache" **끔**, HAR 내보내기(내용 포함) | 오너 (브라우저 손 조작) | 손 조작이라 해당 없음 |
| 이동 시간 | `instrumentation-client.ts`의 `onRouterTransitionStart` + pathname commit 표시 → `console.info('[nav]', from, to, ms)`. `localStorage.navTiming === '1'`일 때만 | 오너가 콘솔 로그를 저장 | 코드다. U0에서 기준선 **전에** 배포한다(§10 Q3) |
| HAR 요약 표 | `deploy/traffic/review/cc/har_summary.py` (developer가 씀) | main session | 저장된 HAR만 읽는다. `OMP_NUM_THREADS=1 timeout 300 uv run python ...` = "Allowed locally" |
| MISS/HIT TTFB, 상태, 헤더 | `curl` (아래) | main session | `traffic-check.sh`와 같은 종류의 GET 몇십 개. 앞선 선례대로 |
| 서버 렌더 시간 | 없음. `proxy.ts` 요청 로그에 시간이 없다 | | MISS TTFB를 대리 지표로 쓴다. 로그에 `durationMs`를 넣을지는 §10 Q4 |
| 서버 fetch 수와 시간 | `apis/http.server.ts` `serverRequest`가 호출마다 JSON 한 줄: `{ message: 'ssr_fetch', path, status, ms }` (U0a). Cloud Logging으로 간다(#58과 같은 경로) | main session (`deploy/logging/README.md` 질의 방식) | 코드다. U0a에서 기준선 전에 배포. 기록 코드는 하나, 실행마다 바꾸지 않는다(`rules/measurement.md` §2.4) |
| 메모리 | `./_scripts/gcp/vm-metrics.sh 1` | main session | 읽기 전용 API 호출 |
| HIT 비율 | Cloudflare → Analytics → Caching, 7일 | 오너 | |

curl 단계 (main session, Mac, 저장소 루트):

```sh
T=$(date -u +%Y%m%dT%H%M%SZ); D=deploy/traffic/review/cc/runs/${T}_baseline; mkdir -p $D
W=https://my.prettylog.com; U=taeklim; P='<project>'; S='<slug>'
# sleep 1 per request: #68 blocks an IP above 50 / 10 s, and a 429 corrupts the run
h(){ sleep 1; curl -s -o "$1.body" -D "$1.head" -w '%{http_code} %{time_starttransfer} %{size_download}\n' "${@:2}"; }

# 1. MISS 렌더 (?cb= 로 엣지 key를 새로). 경로마다 3회
for p in / /@$U/posts /@$U/projects /@$U/projects/$P /@$U/$S; do
  for i in 1 2 3; do n=$(echo "$p" | tr '/@' '__')_miss$i
    echo "$p $(h $D/$n "$W$p?cb=cc$T$i")" >> $D/ttfb.txt; done; done

# 2. 같은 URL 다시 (HIT)
for p in / /@$U/posts /@$U/projects; do n=$(echo "$p" | tr '/@' '__')_hit
  echo "$p $(h $D/$n "$W$p?cb=cc${T}1")" >> $D/ttfb.txt; done

# 3. RSC 전체 payload 크기 (rail 반복 확인). prefetch 헤더 있음/없음
for p in /@$U/posts /@$U/projects /@$U/$S; do n=$(echo "$p" | tr '/@' '__')
  echo "$p full $(h $D/${n}_rsc -H 'rsc: 1' "$W$p?_rsc=cc$T")" >> $D/rsc.txt
  echo "$p pref $(h $D/${n}_pref -H 'rsc: 1' -H 'next-router-prefetch: 1' "$W$p?_rsc=ccp$T")" >> $D/rsc.txt; done

# 4. 가드
for p in /nope /@nope/x /@$U/nope; do echo "$p $(h $D/404 "$W$p?cb=cc$T")" >> $D/guards.txt; done
h $D/rail0 "$W/?cb=ccr$T"; h $D/rail1 -H 'Cookie: railCollapsed=1' "$W/?cb=ccr$T"   # 오늘: 같은 HTML (버그 확인)
grep -ic '^set-cookie' $D/*.head >> $D/guards.txt
sleep 15   # let the 10 s window drain before traffic-check.sh's ~20 GETs
./_scripts/cloudflare/traffic-check.sh > $D/traffic-check.txt
./_scripts/gcp/vm-metrics.sh 1 > $D/vm.txt
git rev-parse HEAD > $D/web_sha.txt   # 배포된 커밋과 같은지 deploy 기록으로 확인
```

- 1단계의 `?cb=` 응답은 엣지에 1일 남는다. 표본은 15개뿐이라 무시해도 된다. 다음 실행은 새 `$T`를 쓴다.
- 3단계의 rail 조각 크기: payload 안에서 TagCloud의 태그 이름과 `rail.collapse` 문구가 나오는 구간 바이트. `har_summary.py`가 같은 규칙으로 센다.
- curl은 `rsc: 1`만 보낸다. 브라우저가 보내는 `Next-Router-State-Tree`가 없다. 그래서 curl 바이트는 "전체 트리" 크기다. 브라우저 HAR 바이트와 섞어 비교하지 않는다.

실행 폴더 (`rules/measurement.md` §2):

```
deploy/traffic/review/cc/
├── 00.runs.md                    결과 대장. 한 행 = 한 실행
├── criteria.md                   §5.3 표 사본 + 범위 값. 첫 비교 전에 커밋
├── har_summary.py                CODE_VERSION 상수, sha를 manifest에 적음
└── runs/<T>_<tag>/               tag = baseline1..3, u1, u2, ...
    ├── manifest.json             web_sha, 단위, 팔, <P>, <S>, 브라우저 버전, rail 상태
    ├── w1-anon.har  w1-auth.har  w2 … w4
    ├── nav.log                   [nav] 콘솔 줄
    └── ttfb.txt rsc.txt guards.txt traffic-check.txt vm.txt *.head
```

### 5.5 운영(prod)과 local.prettylog.com의 역할

| 어디 | 무엇을 | 숫자를 판정에 쓰나 |
| --- | --- | --- |
| 운영 `my.prettylog.com` | §5.3 모든 지표와 가드 | 예. 유일한 판정 근거 |
| `local.prettylog.com` (dev 서버, 운영 API) | U4 전 확인: dev가 "Suspense 밖 uncached data" 오류를 보이는가, hydration 오류, rail 상태, `_rsc` key 분리 | 아니다. dev는 on-demand 컴파일이고 prefetch가 운영과 다르다 |
| GH Actions 빌드 잡 | 빌드 통과. flag on에서 빌드 오류 목록 | 통과/실패만 |

- dev 서버 실행은 실행마다 오너 허락이 필요하다(`~/.claude/CLAUDE.md` "No local execution", Q-L 선례).
- 로컬 `next build`는 하지 않는다. 빌드는 GH Actions에서만이다(Phase GCP Constraints).
- 잡음: 기준선을 3회 잰다. 같은 시간대, 같은 브라우저, 같은 `<P>`, `<S>`. 첫 1회 전에 W1을 한 번 돌려 엣지를 데운다(그 실행은 버린다).

## 6. 전략 (strategy) A/B/C

모두 초안 G-CC(hand-back: "로그인 W1 이동 시간 p50을 기준선보다 판정선 이상 줄인다, 가드 전부 통과")를 섬긴다.

| 안 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A 안정(stable) | flag 없음. 공유 rail + client rail 상태 + `staleTimes` + 잎 정리까지만 | 위험이 가장 작다. 빌드 방식 불변 | static shell prefetch가 없다. velog 글의 핵심 처방을 못 쓴다. 이동 시간 효과가 작을 수 있다 |
| **B 단계(scalable), 권고** | A + flag on(모든 데이터는 Suspense 잎, 캐시 없음) + `'use cache'`는 공개 저빈도 데이터 3개만 + `/api/revalidate` | MVP 사다리와 맞다. 단위마다 되돌리기가 작다 | flag on 단위의 빌드 오류 수정이 한 번에 몰린다(U3 사전 정리로 줄인다) |
| C 최신(cutting-edge) | B + 모든 글 `generateStaticParams` + `'use cache: remote'`(Redis 등 공유 저장소) + viewport prefetch 다시 켜기 | 첫 방문까지 빠르다 | 빌드가 운영 API를 대량 호출한다. VM 1대라 remote cache 이득이 없다. #70과 #68에 어긋난다. 버림 |

## 7. 작업 단위 (design units, 크기와 순서만, 일정 없음)

```
U0a 계측 ─► U0b 기준선 ─► QW1 빠른 수정 ─► QW2 rail 폭 hotfix ─► U1a ─► U1b 공유 rail ─► U2 staleTimes ─► U3 잎 정리
 MVP1 (flag off) ──────────────────────────────────────────────────────────────────────────────────────────────┘
   ─► U4 flag on ─► U5 'use cache' 3개 ─► U6 무효화 ─► U7 load-more (U0b 뒤 어디든 가능, 기본 자리는 끝)
      MVP2 ───────┘ MVP3 ─────────────────────────────────────┘
```

각 단위의 주 지표와 판정선은 §5.3, 가드 정의는 §5.3 가드 표다. "전부" = G-a부터 G-l까지.

| # | 단위 (무엇을 바꾸나) | 단계 | 크기 | 선행 | 주 지표 (§5.3) | 가드 | 배포 + purge | 닫는 감사 항목 | 되돌림 조건 (kill) → 방법 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| U0a | `[nav]` 계측 `instrumentation-client.ts`, `ssr_fetch` 로그 줄(`http.server.ts`), `har_summary.py`, `criteria.md` | MVP1 | S | P1 gate PASS (§10 Q12) | 없음 (계측) | G-c, G-d, G-f | 예 + purge | 감사 §5-3, §5-4, §5-6의 측정 수단 | 계측이 동작을 바꿈(콘솔과 로그 외 부작용) → 파일 revert |
| U0b | 기준선 3회 + 범위 값 + D-행. D1 재현(curl 쿠키 유무), load-more `cf-cache-status`, 404 status 포함 | MVP1 | S | U0a | 없음 (기준) | 측정만 | 아니오 | 감사 §5-3, §5-4 (재지 않은 것) | 3회 범위가 지표 중앙값의 50 % 넘음 → 측정 방법 재설계 |
| QW1 | (1) C3: `PostContentCard.server.tsx:124` `<Comments>`를 Suspense + 댓글 skeleton. (2) C1: `getUserProfile`, `getCategoriesByUsername`, `getPopularTags`, `getUserPopularTags`를 `cache()`, 위치 인자 원시값, token은 `null`로 정규화. (3) C2: `posts/page.tsx:74` `getTagFilterItems`를 async 잎 `FilterChipRowLeaf`로 옮겨 Suspense. (4) A3: `posts/page.tsx:85` `CategorySidebarWrapper`를 Suspense. (5) B2: `app/actions/post.action.ts` → `x_post.action.ts` | MVP1 | S | U0b | 서버 fetch 수 / MISS 렌더 | 전부 | 예 + purge | C1, C2(`/@u/posts` 절반), C3, A3, B2, C7(일부) | G-a..G-l 하나라도 실패 → `git revert` + 재배포 + purge |
| QW2 | R-A(§4.3): root layout 차단 script + `<html data-rail>` + CSS 폭. `BlogShell.server.tsx:44`, `LeftRailContainer.server.tsx:19`의 `cookies()` 삭제. `useHydrateAtoms` 2곳 삭제. about, resume layout 주석 정정 | MVP1 | S | QW1 (같은 배포로 묶지 않는다, 판정을 섞지 않으려고) | 정확성 판정 (이진) | 전부 + G-k | 예 + purge (필수, 옛 폭이 엣지에 1일 남음) | A2, D1, D5 | 판정 하나라도 거짓 → `git revert` + 재배포 + purge |
| U1a | `app/[handle]/components/` → `components/projects/`, import 19곳 정리 | MVP1 | S | QW2 | 없음 (동작 불변) | G-c, G-e, smoke §7.3 | 예 + purge | 없음 (U1b 준비) | 빌드 실패 또는 smoke 변화 → `git revert` |
| U1b | `(shell)` group, RailFrame/ContentFrame, `railVisibility`, `RailContextPublisher` (§4) | MVP1 | M | U1a | W1 익명 RSC 바이트 | 전부 + smoke §7.3 | 예 + purge | D6 | 가드 실패 또는 smoke 하나라도 status나 `location` 변화 → `git revert` + 재배포 + purge |
| U2 | `experimental.staleTimes = { dynamic: 30 }`. `static`은 두지 않는다(기본 300초, flag 뒤 default `cacheLife.stale`, `cacheLife.md` 257행) | MVP1 | S | U1b | W2 `_rsc` 수 (§16이 대체: W1 s6 `_rsc`) | 전부 | 예 + purge | A6 | 판정 실패 또는 오너가 30초 지연 거부(Q6) → 설정 줄 삭제 |
| U3 | flag off로 잎 정리: D11 `[slug]` rail 고르기 → Suspense 잎 `RightRailSwitch`(A7). 로그인 글 읽기 preload: page 맨 위 `void getPostBySlug(slug, token)`(C4, token 읽기는 잎 안). D12 `MobileContextHeader` Suspense, D8, D23. "빌드만" GH Actions 잡 + flag on 시험 빌드(배포 없음) | MVP1 | M | U2 | W1 로그인 5단계 이동 p50 | 전부 | 예 + purge | A7, C4, C2(`[slug]` 절반), C7(나머지) | 가드 실패 → `git revert` |
| U4 | `cacheComponents: true`, D4–D7 `force-dynamic` 삭제, D9, D15, D21 sample, D25 `loading.tsx`, D26, D27 처리, D1 확인 | MVP2 | M | U3 | W1 로그인 이동 p50 | 전부 | 예 + purge | A1(확인), A4, A5, A8(sample로 재평가) | 판정 실패, G-e 실패, 또는 빌드가 스키마나 URL 변경 없이 통과 못함 → U4 커밋 `git revert` + 재배포 + purge (§3.1) |
| U5 | `'use cache'` + `cacheTag` 3개: TagCloud(`tags`), tree(`tree:<u>`), projects(`projects:<u>`). token = null 경로만 | MVP3 | M | U4 | MISS TTFB p50 | 전부 (특히 G-i) | 예 + purge | 없음 (감사 밖, CC 계획) | 판정 실패, G-i, revalidate 뒤 옛 tree → 그 fetcher 지시문 삭제 |
| U6 | `POST /api/revalidate` + `cf-purge.sh`가 먼저 부름 + Server Action은 `updateTag` (§8.3) | MVP3 | S | U5 | 정확성 판정 (이진) | 전부 | 예 + purge | 없음 (U5의 안전장치) | 판정 거짓 → 스크립트 revert. `cacheLife`가 최대 지연 상한 |
| U7 | B4 load-more. 기본 (b)안: `RecentPostsList.client.tsx:62`, `TagPostsList.client.tsx:60`이 `blog-api.` 피드 GET을 직접 부른다. 로그인이면 Clerk client token을 `Authorization`에 실어 draft도 받는다(첫 page와 같은 규칙). `app/api/posts/load-more/route.ts`는 `x_` 접두로 은퇴. (a)안은 §10 Q11 | MVP3 (CC와 독립) | M | U0b | W3 동안 `my.` load-more 요청 수 | 전부 + Express L-b 한도(`log` 모드 경고 수) | 예 + purge | B4 | 판정 실패, 로그인 draft가 2쪽부터 안 보임 → `git revert` |

- 깜빡임 없는 hotfix(QW2)를 U1b에서 떼어 낸 이유: D1은 지금 모든 익명 독자에게 보이는 정확성 버그다. U1b는 폴더 이동이라 크고 늦다. QW2는 rail 파일 4개와 root layout만 바꾼다. §10 Q10 기본값.
- QW1과 QW2는 flag와 무관하다. P1 gate 전에 낼지는 §10 Q12.
- D4(tree 링크를 `<a href>`로)는 미룬다. 이유는 §12.

- 단위 하나 = 배포 하나 = purge 하나다(웹 배포 뒤 purge, `deploy/traffic/README.md` "Purge after a new post"). §10 Q7.
- 글 본문(`getPostBySlug`)과 피드는 U5에 넣지 않는다. 변경이 잦고 비공개 글 token 경로가 섞인다. 다음 capability로 따로 연다(사다리 "Repeat").
- U4의 sample: `[handle]` = `@<HOME_FEED_AUTHOR>`, `[slug]`와 `[project]`는 §10 Q5.

### 7.1 MVP 사다리 대응

`.claude/CLAUDE.md` "System build phasing"을 인용한다. 다시 쓰지 않는다.

| 단계 | 이 phase의 "스키마(계약)" | real | 끝-끝 순환 |
| --- | --- | --- | --- |
| MVP1 모양 | §3.1 배치 규칙 + §7.2 캐시 지도 + `/api/revalidate` 요청 모양 + `ssr_fetch` 로그 줄 모양 + 빌드 잡 | U0, QW1, QW2, U1, U2, U3. flag off | W1–W4가 운영에서 돈다. 가드 통과 |
| MVP2 조각 하나 | 같은 계약 | U4: flag on. 데이터는 모두 Suspense 잎, 캐시 없음 | 같은 순환. 주 지표 판정 |
| MVP3 핵심 이전 | 같은 계약 | U5 `'use cache'` 3개 + U6 무효화 + U7 load-more | 같은 순환. 수정 → revalidate → purge → 새 값 |

- mock은 없다. 기다리는 backend가 없어서다(사다리 "real data exists and no backend is needed").
- 계약 변경이 필요하면(예: 새 tag 이름, 새 route) 그 단위는 MVP1로 돌아간다.

### 7.2 캐시 지도 (cache map, MVP1 계약)

| route | static shell에 드는 것 | `'use cache'` (U5, tag, life) | 요청마다 (Suspense 잎) |
| --- | --- | --- | --- |
| 모두 | root layout, nav, RailFrame, PrimaryNav | TagCloud (`tags`, hours) | rail 접힘(client), RecentVisited(client) |
| `/` | ContentFrame, skeleton | 없음 | 피드 첫 페이지(`auth`), HomeRightRail 잎 |
| `/@u/posts` | ContentFrame, skeleton | tree (`tree:<u>`) | 피드, 필터(`searchParams`), 프로필 |
| `/@u/projects*` | ContentFrame, 제목 skeleton | 카드, 목록 (`projects:<u>`), tree | `ProjectsTreeWrapper`(`auth`) |
| `/@u/<slug>` | ContentFrame, 본문 skeleton | tree (rail 고르기) | 본문, JSON-LD, TOC(`auth`), 댓글 |
| `/@u/about`, `/@u/resume` | 전부 (코드에 박힌 내용) | 없음 | 인쇄 날짜(client) |
| `/sitemap.xml`, OG | | 데이터 fetch만 (`days`). OG 이미지 렌더는 캐시 밖 | 이미지 렌더 (엣지가 1일 저장) |

- `'use cache'` 안에서는 token을 쓰지 않는다. token이 있는 호출은 언제나 잎이고 캐시하지 않는다. 비공개 글이 캐시에 들어갈 길이 없다.

### 7.3 smoke 표본 (URL 불변 확인, 15개)

기준선에서 status와 `location`을 저장한다. 단위마다 같은 값이어야 한다.

| # | URL | 기대 (기준선이 확정) |
| --- | --- | --- |
| 1–5 | `/`, `/@taeklim/posts`, `/@taeklim/projects`, `/@taeklim/projects/<P>`, `/@taeklim/<S>` | 200 |
| 6–7 | `/nope`, `/@nope/x` | 404 |
| 8 | `/@taeklim/nope` | 기록 (G-e2) |
| 9–12 | `/blog`, `/blog/@taeklim`, `/about`, `/resume` | 308 + `location` |
| 13 | `/@taeklim` | 308 → `/@taeklim/posts` |
| 14 | `/me/saved` (익명) | 로그인으로 redirect |
| 15 | `/sitemap.xml` | 200, 글 URL 수 동일 |

## 8. Cloudflare 엣지 HTML 캐시, #70 prefetch 정책과의 관계

### 8.1 층별로 무엇이 바뀌나

```
브라우저 ─(HTML, _rsc)─► Cloudflare my. ─MISS─► Next (VM) ─fetch─► Cloudflare blog-api. ─MISS─► Express ─► Supabase
  client router cache        HTML·_rsc 1일          'use cache' (U5)        s-maxage                    
  staleTimes / cacheLife.stale                       static shell (U4)
```

| 층 | 익명 | 로그인(`__session`, `cf-cache-status: DYNAMIC`, rev2.1 §14.4) |
| --- | --- | --- |
| 브라우저 router cache | U2와 U4가 `_rsc` 재요청을 줄인다. 요청 수 한도에 도움 | 같음 |
| Cloudflare HTML·`_rsc` | 변화 없음. 응답은 shell + 스트림이 한 HTTP 응답이다. 엣지는 전체를 저장한다 | 해당 없음 (저장 안 함, 매번 오리진) |
| Next 오리진 | MISS 렌더가 싸진다(shell 재사용, U5 캐시) | 효과가 가장 크다. 모든 요청이 오리진에 온다 |

- 익명 HTML의 결정은 그대로다: 1일, 배포 뒤 purge.
- 완전히 static이 되는 route(about, resume)는 Next가 `s-maxage`를 보낼 수 있다. 엣지 규칙은 "Ignore cache-control"이라 그대로다. 브라우저 TTL은 "Respect origin"이다. `traffic-check.sh`의 "HTML browser cache-control" 줄이 이것을 본다(G-c).

### 8.2 prefetch 요청이 늘어나나

- 늘 수 있다. Next 16은 segment 단위로 prefetch한다(`Next-Router-Segment-Prefetch`). 링크 하나가 요청 여러 개가 된다. 오늘 `resume ×4`가 그 예다(`deploy/traffic/review/prefetch-source.md` §2).
- flag on 뒤에는 static shell이 생긴다. 그래서 prefetch가 받을 segment가 늘 수 있다.
- 줄이는 힘도 있다: 공유 rail로 rail segment를 한 번만 받는다. staleTimes와 cacheLife.stale로 재요청이 준다.
- 그래서 판정은 측정으로 한다: G-a(10초 창 ≤ 30), G-b(링크당 prefetch 수 불변).
- #70 정책은 그대로다. viewport prefetch를 다시 켜지 않는다. 새 `Link`는 `prefetch={false}` 또는 hover(`HoverPrefetchLink`).
- 메뉴 링크(`PrimaryNav`)는 오늘 viewport prefetch다(#70 e: "처음 한 번뿐"). G-b가 깨지면 첫 처방은 메뉴 링크를 hover로 바꾸는 것이다.
- 어림(검증 전): 메뉴 6개 × segment 2–4 = 첫 화면 12–24 요청. 50 / 10 s 아래지만 W3 스크롤과 겹치면 가깝다. 그래서 G-a 선을 30으로 둔다.

### 8.3 무효화 순서

```
글 발행/수정 ──► Express/blog_agent DB 쓰기
                 │
                 ├─(1) POST my./api/revalidate {tags}  revalidateTag(tag, { expire: 0 })  ← 'max'(SWR)면 첫 요청이 옛 값을 내고 엣지가 그것을 1일 저장한다
                 └─(2) cf-purge.sh  (두 host 함께, 오늘 규칙)
```

- 순서가 중요하다. (2)를 먼저 하면 엣지가 옛 Next 캐시로 다시 찬다.
- `/api/revalidate` 계약: `POST`, 헤더 `x-origin-key`(#64와 같은 비밀), 본문 `{ "tags": string[] }`, 응답 `{ success, data: { revalidated: string[] } }`. 허용 tag는 §7.2의 이름만.
- 이 route는 `/api/`라 엣지 "web cache" 규칙 밖이다. rate limit 규칙에는 들어간다(1회 호출이라 무관).
- 오늘 발행 뒤 purge는 오너가 손으로 한다. U6는 `cf-purge.sh`가 (1)을 먼저 부르게 바꾼다. 잊어도 `cacheLife`(hours)가 최대 지연을 막는다.
- 앱 안 Server Action(`app/actions/postPublish.action.ts`)은 `updateTag`를 직접 부를 수 있다. blog_agent는 DB에 바로 쓴다. 그래서 스크립트 경로가 필요하다.

## 9. 위험

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| 수정 뒤 옛 내용 | U5 뒤 tree, projects, tags가 cacheLife 동안 옛 값 | §8.3 순서. `expire: 0`. cacheLife = hours 상한 |
| 엣지 1일 + Next 캐시 이중 | purge만 하면 옛 Next 값으로 다시 찬다 | (1) → (2) 순서를 스크립트에 고정 |
| 빌드가 운영 API를 부름 | `'use cache'` 데이터와 `generateStaticParams`가 GH runner에서 `blog-api.`를 호출한다. `(feed)/page.tsx` 주석이 일부러 피한 일이다 | U4는 데이터 없이 통과하게 설계(모두 Suspense 잎). U5의 static 데이터만 빌드에서 부른다. §10 Q8 |
| sample 밖 param이 디스크에 저장됨 | 첫 성공 요청마다 저장. 봇이 임의 slug를 두드림 | 404는 성공이 아니라 저장되지 않는다(추정, U4 확인: 배포 후 `.next` 크기 1주 관찰) |
| VM 메모리 1 GB | `'use cache'` in-memory LRU가 메모리를 쓴다 | U5는 데이터 3개만. G-i. 메모리 알림 90 %가 이미 있다 |
| Clerk | `auth()`가 Suspense 밖에 남으면 빌드 오류. root `ClerkProvider`에 `dynamic`을 붙이면 전부 dynamic | `dynamic` prop 금지를 규칙으로 적는다. D16–D20은 이미 잎 |
| hydration | rail 상태 불일치(오늘 고친 shared-store 버그와 같은 종류) | R-A는 서버 seed를 없앤다. G-f 두 상태 확인 |
| Activity (flag on) | 숨겨진 route가 mount된 채 남는다. effect가 뒤로 가기 때 다시 돈다 | `TocPublisher`는 cleanup이 있어 안전. `RecordRecentView` effect는 뒤로 가기마다 다시 기록한다. 최근 본 글 순서만 바뀐다. 수용, U4 확인 항목. 열린 dropdown(PostActions)은 닫는 cleanup을 확인 |
| `getLocale` 정정이 틀림 | next-intl이 다른 경로로 `headers()`를 읽음 | U3 빌드 잡(flag on 시험 빌드)이 잡는다. 그때 `setRequestLocale('en')`을 root layout에 추가 |
| `_rsc` key 섞임 | prefetch(shell)와 이동(전체)이 같은 key면 엣지가 shell을 이동에 낸다 | G-h. 깨지면 U4 되돌림 |
| `force-dynamic` 삭제 후 flag off | flag 없이 지우면 Next가 빌드 때 prerender를 시도할 수 있다 | D4–D7 삭제는 U4(flag on)에서만 한다 |
| 다른 세션과 충돌 | `components/rail/*`, `app/[handle]/*`는 Phase PJ 파일이다 | CC는 P1 gate PASS 뒤에만 연다(M5 조건). P2 행과 같은 파일이면 pm이 순서를 정한다 |
| 404의 rail 비용 | §4.5 | U5 TagCloud 캐시 |
| QW1 `cache()`의 token 정규화 | 감사 C1은 token을 `null`로 맞추라고 한다. `CategorySidebarWrapper`는 소유자 token으로 비공개 카테고리를 읽는다. 강제로 `null`이면 소유자가 자기 비공개 카테고리를 못 본다 | token은 인자로 남긴다. 같은 인자일 때만 합쳐진다. `null`은 원래 익명 호출인 곳에서만. 익명 요청에서는 모두 `null`이라 그대로 합쳐진다 |
| QW1 `cache()` 범위 | `React.cache`가 `generateMetadata`와 page를 한 요청으로 묶지 않으면 효과가 작다 | QW1 지표가 직접 잰다(§5.3 주석) |
| QW2 배포 뒤 옛 폭 | 엣지에 옛 HTML(쿠키 폭)이 1일 남는다 | 배포 직후 purge 필수 |
| U7 (b)안 | 브라우저가 `blog-api.`를 직접 부른다. Express L-b 한도(IP당 읽기 120 / 60 s, 지금 `log` 모드, #62, #67)를 독자 IP가 받는다 | W3 스크롤은 그 한도의 몇 %다. `rate_limit` 경고 수를 U7 가드로 본다. CORS는 이미 `Origin: my.` HIT(`deploy/traffic/README.md` §3) |

## 10. 열린 질문 (owner)

| # | 질문 | 설계 기본값 |
| --- | --- | --- |
rev1 Q1–Q10과 감사의 열린 항목(B4 선택, D4, §5)을 합쳤다. 중복은 하나로 줄였다. 출처 칸이 어디서 왔는지 적는다.

| # | 질문 | 설계 기본값 | 출처 |
| --- | --- | --- | --- |
| Q1 | 프로젝트 글 상세에서 RecentVisited 숨김(#79)을 지킬까. 지키려면 잎 신호(`RailContextPublisher`)가 필요하다. `usePathname()`만으로는 알 수 없다 | 지킨다. 잎 신호 | rev1 |
| ~~Q2~~ | ~~`/@u/saved`는 오늘 rail이 없다. group 안으로 오면 rail을 보일까~~ | ~~숨긴다 (오늘과 같음)~~ | rev1. **대체됨 2026-10-14**: 오너가 saved, me에 공유 왼쪽 rail을 요청했다(§15.5) |
| Q3 | 기준선 전에 계측 코드 2개를 배포해도 되나: `[nav]`(`instrumentation-client.ts`, 기본 꺼짐), `ssr_fetch` 로그 줄(`http.server.ts`) | 된다. `[nav]`가 없으면 U3, U4 주 지표 = HAR의 prefetch 아닌 `_rsc` 요청 시간. `ssr_fetch`가 없으면 QW1 주 지표를 쓸 수 없고 QW1은 기록만 한다 | rev1 + 감사 §5-6 |
| Q4 | 서버 렌더 시간: `proxy.ts` 요청 로그에 `durationMs`를 넣을까. MISS TTFB를 대리 지표로 둘까 | TTFB 대리. `ssr_fetch`의 `ms`가 fetch 쪽 시간을 준다 | rev1 |
| Q5 | `generateStaticParams` sample: `[slug]`, `[project]`를 env 상수, 빌드 때 API 조회, placeholder 중 무엇으로 | env 상수 (`CC_SAMPLE_SLUG`, `CC_SAMPLE_PROJECT`) | rev1 + 감사 A8 |
| Q6 | `staleTimes.dynamic = 30`: 좋아요, 댓글 수가 뒤로 가기 때 최대 30초 늦어도 되나 | 된다 | rev1 + 감사 A6 |
| Q7 | 단위마다 웹 배포 1회 + purge 1회 (U0a, QW1, QW2, U1a, U1b, U2, U3, U4, U5, U6, U7 = 11회) | 된다 | rev1 |
| Q8 | U5에서 빌드(GH Actions)가 운영 `blog-api.`를 호출해도 되나 (tags, tree, projects 3개) | 된다. `x-origin-key` secret을 빌드 잡에 준다 | rev1 |
| Q9 | 로그인 팔(arm) 측정을 오너가 3회씩 해 줄 수 있나 (HAR + 콘솔 로그) | 예. 안 되면 U3, U4 주 지표를 익명 이동 시간으로 바꾸고 D-행에 적는다 | rev1 |
| Q10 | 엣지 rail 폭 버그(D1): U1b에 넣을까, 별도 hotfix로 먼저 낼까 | **별도 hotfix QW2** (rev1 기본값 "U1b 포함"을 바꿈). 지금 모든 익명 독자에게 보이는 버그다. 폴더 이동과 묶으면 늦고 판정이 섞인다 | rev1 + 감사 A2, D1 |
| Q11 | load-more(B4): (a) Next `/api/posts/load-more`에 익명 `s-maxage=60` + Cloudflare 규칙 추가, (b) 브라우저가 `blog-api.` 피드 GET을 직접 부름 | (b). Cloudflare 규칙을 새로 만들지 않는다. 익명은 이미 엣지 HIT. 로그인은 token을 실어 첫 page와 같은 draft 규칙이 된다. VM 한 hop이 빠진다 | 감사 B4 |
| Q12 | QW1, QW2(flag 무관)를 P1 gate PASS 전에 내도 되나. 오너 지시는 "P1 뒤 CC"다 | 기준선(U0) 뒤에 바로 낸다. 단 Phase PJ가 같은 파일(`posts/page.tsx`, rail 파일)을 고치는 중이면 pm이 순서를 정한다. 기준선이 P1 gate 뒤라면 그 순서를 따른다 | 감사 §4 "지금" 항목 |
| Q13 | D4(카테고리, projects tree의 글 node를 `<Link prefetch={false}>`로)를 CC 밖으로 미뤄도 되나 | 미룬다. 성능 항목이 아니다(SEO). `app/sitemap.ts:67`이 글 URL을 모두 낸다. #70 파일과 겹친다 | 감사 D4 |

## 11. `projects.design.md` §7.4 정정

| 그 문서의 줄 | 정정 | 근거 |
| --- | --- | --- |
| "root layout `getLocale()` (headers)" 막힘, 처방 `setRequestLocale('en')` | 막힘이 아니다. `i18n/request.ts`가 `requestLocale`을 읽지 않는다. 그래서 `headers()`가 불리지 않는다. 처방 불필요. U4 빌드로 최종 확인 | `node_modules/next-intl/dist/esm/development/server/react-server/getConfig.js` 25–33행 |
| "첫 행 = `staleTimes`" | 첫 행 = 기준선(U0), 그다음 QW1, QW2, 공유 rail(U1, 오너 2026-10-14). `staleTimes`는 U2 | 오너 지시, rev2 |
| "`staleTimes.dynamic = 30`" 단독 효과 | flag on 뒤에는 `cacheLife(...).stale`이 client 재사용을 정한다. `staleTimes`는 flag 전의 이득이다 (§16.6 정정: `dynamic`은 flag 뒤에도 이득) | `cacheLife.md` 247–257행 |

## 12. 감사 항목 추적표 (traceability)

무엇을 알려고: `perf.audit.md`의 25항목이 모두 어느 단위에서 닫히는가. 빠진 항목이 없는가.

| 감사 상태 | 수 | 단위로 감 | 미룸 | 유지(가드) |
| --- | --- | --- | --- | --- |
| FAIL | 11 | 10 | 0 | 0 (A1은 정정으로 PASS 예정, U4 확인) |
| PARTIAL | 7 | 6 | 1 (D4) | 0 |
| PASS | 6 | | | 6 (G-l) |
| N/A | 1 | 1 (A8, U4 재평가) | | |

| 항목 | 감사 상태 | 내용 (짧게) | 닫는 단위 | 비고 |
| --- | --- | --- | --- | --- |
| A1 | FAIL | root layout `getLocale` | U4 확인 | §13 정정: 소스상 `headers()`를 읽지 않는다. 고칠 코드 없음 |
| A2 | FAIL | shell `cookies()` 2곳 | QW2 | 처방은 R-A (감사의 `useEffect` 안 대신, §4.3) |
| A3 | PARTIAL | `posts/page.tsx:85` `auth()` Suspense 밖 | QW1 | |
| A4 | FAIL | `force-dynamic` 6곳 | U4 | flag와 같은 커밋에서만 삭제(§9) |
| A5 | FAIL | `cacheComponents` 없음 | U4 | |
| A6 | FAIL | `staleTimes` 없음 | U2 | `dynamic: 30`만 |
| A7 | PARTIAL | `[slug]/layout.tsx:24` tree await | U3 | D11 `RightRailSwitch` |
| A8 | N/A | `generateStaticParams` | U4 재평가 | flag 아래에서는 layout이 `params`를 await하려면 sample이 필요하다(§13) |
| B1 | PASS | 읽기 action 없음, 병렬 action 없음 | 유지 (G-l) | |
| B2 | FAIL | 죽은 읽기 action `loadMorePosts` | QW1 | `x_` 이름 바꾸기 |
| B3 | PASS | action을 `queryFn`에 안 씀 | 유지 (G-l) | |
| B4 | PARTIAL | load-more가 엣지 밖, token 차이 | U7 | Q11 기본 (b) |
| C1 | PARTIAL | 요청 안 중복 fetch | QW1 | signal이 중복 제거를 끈다는 것을 소스로 확인(§2). 영향 H 유지 |
| C2 | FAIL | 순차 await | QW1 (`/@u/posts`), U3 (`[slug]`) | |
| C3 | FAIL | 댓글이 본문 스트리밍을 막음 | QW1 | |
| C4 | FAIL | preload 없음 | U3 | 로그인 경로만 |
| C5 | PASS | 색인 내용 server 렌더 | 유지 (G-l) | |
| C6 | PASS | TanStack seed | 유지 (G-l) | |
| C7 | PARTIAL | Suspense 경계 빠짐 | QW1 (`:85`, `:124`), U3 (`MobileContextHeader`) | about, resume `loading.tsx`는 불필요: U4 뒤 완전 static (D22 sample) |
| D1 | FAIL | 엣지 HTML이 rail 쿠키로 바뀜 | QW2 | G-k로 회귀 감시 |
| D2 | PASS | viewport prefetch #70 한도 안 | 유지 (G-l, G-b) | |
| D3 | PASS | `_rsc` key 분리 | 유지 (G-l, G-h) | |
| D4 | PARTIAL | tree 링크가 `router.push` | 미룸 | 성능 밖(SEO). sitemap이 덮는다. #70 파일. Q13 |
| D5 | PARTIAL | about, resume atom 이중 seed | QW2 | `useHydrateAtoms` 삭제로 사라진다 |
| D6 | FAIL | rail이 형제 layout 6곳 | U1b | 오른쪽 rail은 parallel route 대신 child layout의 ContentFrame(§13) |

- FAIL 11개 중 단위로 가는 것은 10개다. A1은 정정 항목이다(U4 빌드가 확인).
- PARTIAL 7개 중 6개가 단위로 가고 D4 하나만 미룬다.

## 13. `perf.audit.md` 정정 (그 파일은 고치지 않는다)

| 감사의 줄 | 정정 | 근거 |
| --- | --- | --- |
| A1, §1 route 지도 첫 줄, §5-1: `getLocale()`이 모든 route를 동적으로 만든다 | 만들지 않는다. `getConfig`의 `requestLocale`은 lazy getter이고 `i18n/request.ts`는 그것을 읽지 않는다. 처방(`setRequestLocale`) 불필요. U4 빌드가 최종 확인 | `node_modules/next-intl/dist/esm/development/server/react-server/getConfig.js` 25–33행, 같은 폴더 `getLocale.js`, `getTranslations.js` |
| §5-2: `ClerkProvider`가 동적 읽기인지 모름 | `dynamic` prop이 없으면 요청을 읽지 않는다. keyless는 dev만 | `@clerk/nextjs/dist/esm/app-router/server/ClerkProvider.js` 16, 24행, `keyless-provider.js` 11행, `utils/feature-flags.js` 4행 |
| C1, §5-5: signal이 fetch 중복 제거를 끈다는 것은 기억에 기댐 | 설치본에서 확인했다. signal이 있으면 원래 fetch를 그대로 부른다. `composeSignal`은 언제나 signal을 돌려준다. 그래서 오늘 같은 URL도 요청 안에서 매번 나간다. C1 영향 H 유지 | `node_modules/next/dist/server/lib/dedupe-fetch.js` 88–96행, `apis/http.core.ts:35-37` |
| C1 처방 "token은 `null`로 맞춘다" | 원래 token을 쓰는 호출(`CategorySidebarWrapper`)까지 `null`로 바꾸면 소유자가 비공개 카테고리를 못 본다. token은 인자로 남긴다 | §9 QW1 행 |
| A2 처방 "false로 seed, mount 뒤 읽기, 폭이 한 번 바뀜" | R-A를 쓴다. paint 전 script + CSS라 폭이 바뀌지 않는다 | §4.3 |
| A4 "blog 2건을 지운다" | flag 없이 지우지 않는다. flag 켜는 U4 커밋에서 6건 모두 | §9 `force-dynamic` 행 |
| A5 "`'use cache'`를 끝낸 뒤 켠다" | 순서를 바꾼다. flag 먼저(U4, 데이터는 모두 Suspense 잎, 캐시 없음), `'use cache'`는 그 뒤(U5). `'use cache'`는 flag가 있어야 돈다 | `cacheComponents.md` 22–27행 |
| A8 "N/A, CC 뒤 재평가" | flag 아래에서는 N/A가 아니다. layout이 `params`를 Suspense 밖에서 읽으려면 sample이 하나 이상 필요하다. 빈 배열은 빌드 오류 | `generate-static-params.md` 310행, `dynamic-routes.md` 151–153행 |
| D6 처방 "오른쪽 rail은 parallel route(`@right`)" | 쓰지 않는다. child layout이 ContentFrame으로 오른쪽 rail을 넘긴다. parallel route는 `default.tsx`와 slot 규칙이 더 든다(KISS) | §4.3 |
| D6 "나중 (CC 뒤)" | 오너가 첫 CC 단위로 당겼다(2026-10-14). U1b | 오너 지시 |
| §3 "`cc.design.md`가 없다" | 있다. 이 문서다. 감사 §4의 "Phase CC" 행은 §12 추적표가 대신한다 | 이 문서 |

## 14. rev2.1 측정 보정 (measurement amendments, 2026-10-14)

- 입력: `deploy/traffic/review/cc/baseline.md` (data-analyst, curl 측정 3회, 배포 `19f5e31`). 그 파일은 고치지 않는다.
- 결정: system-architect. 변경 후 측정(post-change run) 전에 고정한다. pm이 #88 행에 Update로 적는다(write-first).
- 공식 자체(§5.3)는 바꾸지 않는다. "무엇의 p50인가"와 집계 방법만 정한다.

### 14.1 p50 읽기 (baseline.md §2.3)

| 단위 | 고른 읽기 | 버린 읽기 | 이유 |
| --- | --- | --- | --- |
| U4 = G-CC | **A**: run마다 W1 로그인 s2–s6 원값 15개(5단계 × 반복 3)의 p50. 그다음 run 3개 값의 중앙값 = 지표. 범위 = run 3개 값의 최댓값 − 최솟값 | B (원값 5개로 낸 p50이라 거칠다), C (p50이 아니라 합이다. 원문과 다르다) | 원문 "p50"에 가장 가깝다. 표본을 모두 쓴다. 주 지표 하나 규칙(`rules/measurement.md` §1)을 지킨다 |
| U3 | U4와 같은 방식. 5단계 하나(s5)의 원값 3개 p50 → run 3개 중앙값 | | 단계 하나라 A와 B가 같다 |
| U5 | **A**: run마다 세 페이지 MISS 원값 9개의 p50 → run 3개 중앙값 | 페이지별 (판정이 셋이 된다) | 주 지표 하나. 페이지별 값은 기록만 한다 |

- 단계 섞임 대비: 단계별 run 중앙값은 기록 칸에 계속 남긴다. 한 단계만 나빠지면 기록에서 보인다.
- 판정 숫자: U4, U3의 **판정 지표는 `[nav]`(브라우저 run)** 다. curl `total_ms` proxy(U4 110 ms, U3 246 ms)는 판정에 쓰지 않는다. 브라우저 기준선 3회가 없으면 U3, U4는 판정할 수 없다.
- U5는 curl `ttfb_ms`가 원래 지표다. 판정선 140 ms를 지금 고정한다.
- QW1, QW2는 브라우저 run 없이 판정할 수 있다(§14.2, QW2 판정 (1)). QW2의 (2), (3)은 브라우저 run이 필요하다.

### 14.2 QW1 집계: `ssr_fetch` 줄을 MISS 렌더 하나에 묶는 법

어디에 있나:

| 위치 | 근거 | 용도 |
| --- | --- | --- |
| Cloud Logging `LOG_ID("blog-web")` | Ops Agent가 `~/.pm2/logs/blog-web-out-*.log`를 보낸다 (`deploy/logging/README.md` "Web request log", "Log views") | **1차 출처**. main session이 `gcloud logging read`로 읽는다. ssh 없음 |
| VM 파일 `~/.pm2/logs/blog-web-out-0.log` (logrotate 7일) | 같은 README §① | 대체 출처. Cloud Logging 줄 수가 모자랄 때만 |

- 두 줄은 같은 프로세스(VM 시계)에서 나온다: `proxy.ts` 요청 줄(`message: "request"`, `query`, `ua`, `time`)과 `ssr_fetch` 줄(`time` = fetch 끝).
- 요청 id는 없다. 그래서 시간 창으로 묶는다. 창의 경계는 Mac 시계가 아니라 VM의 요청 줄로 정한다(시계 차이를 없앤다).

묶는 규칙:

```
MISS 요청 i  ─ proxy 줄: message=request, query에 cb 값, ua에 runId   → t_i
                │  ssr_fetch 줄들 (t_i < time ≤ t_next)               → count_i
다음 요청    ─ proxy 줄 (출처 무관, 다음 시각)                         → t_next   (상한 t_i + 5 s)
```

1. 실행 끝(마지막 요청 + 30초) 뒤에 한 번 읽는다. Cloud Logging 수집 지연 때문이다.
2. 질의 (main session, Mac, 저장소 루트):

```sh
# manifest has no run-level start/end: take the span of the MISS windows, padded 10 s each side
R=<run 폴더>; W='.metrics.arms.anon.miss_windows'
A=$(jq -r "[$W[].start] | min" $R/manifest.json); B=$(jq -r "[$W[].end] | max" $R/manifest.json)
A=$(date -u -j -v-10S -f '%Y-%m-%dT%H:%M:%S' "${A%%.*}" +%Y-%m-%dT%H:%M:%SZ); B=$(date -u -j -v+10S -f '%Y-%m-%dT%H:%M:%S' "${B%%.*}" +%Y-%m-%dT%H:%M:%SZ)
gcloud logging read "LOG_ID(\"blog-web\") AND timestamp>=\"$A\" AND timestamp<=\"$B\" AND (jsonPayload.message=\"request\" OR jsonPayload.message=\"ssr_fetch\")" \
  --order=asc --limit=5000 --format=json > $R/blog-web-log.json
```

3. 집계 (main session, 저장된 파일만 읽는다, "Allowed locally"): `_scripts/perf/ssr-fetch-count.mjs <run 폴더>` (developer가 쓴다).
   - `manifest.json` `metrics.arms.anon.miss_windows`의 각 창에서 `path`와 `cb` 값을 얻는다.
   - `blog-web-log.json`에서 `query`에 그 `cb`가 있는 request 줄을 찾는다 → `t_i`.
   - `t_i` 다음의 첫 request 줄 시각 → `t_next`. 없으면 `t_i + 5 s`.
   - 그 사이 `ssr_fetch` 줄을 센다. 경로별 수도 남긴다(`/posts/slug/` 수 = 감사 §5-7 답).
   - 오염 검사: 창 안에 `ua`에 runId가 없는 request 줄이 있고, 그 줄이 `/_next/`가 아니면 그 창을 **오염**으로 표시하고 뺀다.
   - 출력: `$R/ssr_fetch.csv` (창, 페이지, count, 경로별 count, 오염 여부)와 run 값 = 세 페이지 count 합의 반복 중앙값.
4. 판정: run 값 3개의 중앙값과 범위로 §5.3 QW1 공식.

대체(fallback):

| 조건 | 대체 |
| --- | --- |
| Cloud Logging의 request 줄 수 < 그 run의 요청 수 (수집 누락) | 같은 질의 범위를 VM 파일에서 읽는다: `gcloud compute ssh $VM "${Z[@]}" --command 'grep -h -E "\"message\":\"(request|ssr_fetch)\"" ~/.pm2/logs/blog-web-out-0.log'` 1회 → `$R/blog-web-log.jsonl`. 같은 집계. ssh는 1회만(`rules/ssh.md`) |
| 오염 창이 페이지마다 3개 중 2개 이상 | 그 run을 버리고 다시 돈다. 트래픽이 적은 시각(UTC 05–07시, 기준선 시각)에 |
| `cb` 줄을 못 찾음 (`query` 필드 없음 등) | 창 = 스크립트의 `[start, end]` ± 0 s, VM과 Mac 시계 차를 `ntp` 정상으로 가정하고 표시 `clock-window`. 판정 행에 그 표시를 적는다 |

- 기준선 QW1 값: 세 기준선 run의 로그가 아직 남아 있다(30일). 위 절차를 그 세 폴더에 그대로 돌린다. 새 run이 필요 없다. 단 U0a(`ssr_fetch`)가 `19f5e31`에 들어 있어야 한다. 아니면 QW1 기준선은 새로 3회 잰다.

### 14.3 측정 스크립트 보정 (`_scripts/perf/cc-measure.mjs`, developer)

| 빈틈 | 보정 |
| --- | --- |
| `manifest.json`에 `web_sha` 없음 | 응답 헤더에 배포 sha가 없다(`grep` 0건). 배포 표시는 VM의 `~/prettylog/web/current` symlink다(`deploy/gcp/release.sh` 41행 `releases/<sha>`). 스크립트는 **`--web-sha` 필수 인자**로 받는다. 없으면 시작하지 않는다. main session이 실행 전 ssh 1회로 읽는다: `gcloud compute ssh $VM "${Z[@]}" --command 'basename "$(readlink ~/prettylog/web/current)"'` |
| `unit` 키 없음 | `--unit` 필수 인자 (`U0b`, `QW1`, …). `manifest.json` 최상위 키 |
| 폴더 이름의 sha가 로컬 HEAD라 헷갈림 | 폴더 = `<T>_<unit>_<tag><n>_web<web_sha7>`. 로컬 HEAD는 `manifest.json` `harness_sha`, `harness_dirty`로 이름을 바꿔 남긴다. 이미 만든 기준선 폴더는 개명하지 않는다(`rules/measurement.md` §2.3 5번). 그 셋의 `web_sha` = `19f5e31`은 `00.runs.md` 행에 "dispatch 기록"으로 적는다 |
| `rail_cookie_*_same_html` sha 비교를 믿을 수 없음 | HTML HIT 본문 sha가 응답마다 달라진다(baseline.md §5 5번). sha 비교 키 2개를 지운다. 대신 rail `<aside>`의 class 문자열을 뽑아 비교한다: `border-r-2 border-primary`가 든 첫 `<aside class="…">`의 class 값 전체. 키: `rail_aside_class_plain`, `_cookie`, `_cookie_fresh`, 그리고 `rail_width_same` = 세 값이 같은가. QW2 뒤에는 폭 class가 바뀔 수 있어서 `w-64` 문자열이 아니라 class 전체를 비교한다 |
| `har_summary.py` 없음 | 만들지 않는다. 브라우저 측정은 `cc-browser-measure.yml`이 맡는다. 그 workflow의 요약 출력이 §5.4의 `har_summary.py` 역할을 대신한다. 조건: 그 출력이 `_rsc` 수, 10초 창 최대 요청 수, 링크당 prefetch 수, `[nav]` 줄, hydration 오류 수, `text/x-component` 바이트 합을 run 폴더에 파일로 남긴다. 빠진 칸이 있으면 그 workflow를 고친다 |
| W4 메뉴 목록에 `/log`가 있음 | 메뉴에서 `/log`는 숨겨져 있다(`hooks/useNavLinks.hook.ts:56-58`, 오너 2026-10-13). W4 메뉴 = 실제 익명 메뉴: Home, Projects, About, Resume. `/log`를 뺀다. `Explore`는 `disabled`라 링크가 아니다(같은 파일 116행) |
| W4 prefetch 본문을 저장하지 않음 | 1 KB 미만 응답은 본문을 `w4_<name>.rsc`로 저장한다. §14.4 2번 확인용 |

### 14.4 기준선에서 나온 사실 두 개

1. **로그인 팔은 `BYPASS`가 아니라 `DYNAMIC`이다.** 모든 로그인 응답이 `cf-cache-status: DYNAMIC`이다(baseline.md §5 4번, `traffic-check.txt` 5행). 뜻은 같다: 엣지가 저장하지 않고 매번 오리진에 간다. §5.2와 §8.1의 "BYPASS" 표현을 "DYNAMIC(저장 안 함)"으로 읽는다. §8.1 표는 고쳤다. 로그인 `hit.*` 행은 HIT가 아니라 오리진 두 번째 호출이다.
2. **About, Resume 메뉴 prefetch가 232, 233 B다(다른 메뉴는 47–80 KB).**
   - 링크 대상: `/@taeklim/about`, `/@taeklim/resume` (`aboutPath`, `resumePath`). 두 route는 있다. 상태 200, `text/x-component`.
   - 추정 원인: 두 segment에 `loading.tsx`가 없다. 동적 route의 prefetch는 가장 가까운 loading 경계까지만 받는다. 경계가 없어서 거의 빈 응답이다. 그래서 prefetch 요청은 나가지만 클릭은 여전히 왕복이다. 본문을 저장하지 않아 확인 못함. §14.3 마지막 행이 확인한다.
   - `/log` 182 B는 스크립트만 보낸 요청이다. 실제 메뉴에 없다. 낭비 요청이 아니다.
   - 판단: 지금 고치지 않는다. 이유: 요청 2개는 첫 화면에 한 번뿐이고 엣지 HIT라 싸다(#70 e와 같은 판단). U4 뒤 두 page는 완전 static이 되어 prefetch가 내용 전체를 담는다(§7.2). 그러면 이 요청은 쓸모 있게 된다.
   - 다만 확인 결과 본문이 redirect나 오류면 QW1에 한 줄을 더한다: 두 메뉴 링크를 `HoverPrefetchLink`로. 그 판단은 §14.3 본문 저장 뒤 한다.

## 15. U1c 공유 오른쪽 rail (decision #93, 2026-10-14)

### 15.1 무엇을 알려고 하나

- #93: `/`, `/@u/projects`, `/@u/projects/<p>`, `/@u/saved`, `/@u/posts`가 오른쪽 rail 하나를 쓴다. posts는 rail 위에 프로필 카드를 두고 인기 태그를 뺀다. 글 상세, about, resume, me는 제외다.
- 막힘: `(shell)/layout.tsx`는 `[handle]` 위라 `params.handle`이 없다. 요청 API도 쓸 수 없다(§3.1). `HomeRightRail`은 server 컴포넌트라 client `usePathname()`으로 username을 넘길 수 없다.

### 15.2 세 안과 판정

| 안 | 내용 | 맞는가 | rail이 유지되는 이동 (W1 기준) | 비용과 위험 | 판정 |
| --- | --- | --- | --- | --- | --- |
| (i) | `(shell)`에 rail 하나, `HOME_FEED_AUTHOR` 고정 | 아니다. 다른 handle의 `/@u/projects`가 소유자 데이터를 보인다. posts 카드를 rail 위에 둘 수 없다 | `/` ↔ 모든 곳 | handle 무시는 다중 사용자 코드(`/@u/…`, #71 Vision)와 어긋난다 | 버림 |
| (ii) | 오늘처럼 layout마다 `rightRail` (렌더 자리 3곳: `(feed)`, `posts`, `projects`, 그리고 `saved`는 rail 없음) | 맞다 | `projects` ↔ `projects/<p>`만 | posts ↔ projects마다 rail이 다시 mount되고 다시 받는다 | 바탕으로 쓴다 |
| (iii) | parallel route slot `(shell)/@right/…` | 맞게 만들 수는 있다 | **(ii′)와 같다.** slot 하위 트리는 URL을 따라간다. `/`와 `/@u/projects`는 서로 다른 slot segment라 다시 mount된다 | 아래 표 | 버림 |
| **(ii′) 권고** | (ii) + `[handle]/(rail)` route group 하나. 그 layout이 handle을 받아 rail을 한 번 렌더한다. 렌더 자리 2곳: `(feed)/layout`, `[handle]/(rail)/layout` | 맞다 | posts ↔ projects ↔ `<p>` ↔ saved (같은 handle) | `/` ↔ `/@u/*`에서만 다시 mount. 프로필 카드는 모든 (rail) page에서 server가 렌더하고 client가 posts에서만 보인다 | **채택** |

(iii)을 버린 근거 (Next 16.2.9 문서, `node_modules/next/dist/docs/01-app/`):

| 확인 항목 | 문서 | 이 앱에서의 결과 |
| --- | --- | --- |
| 부드러운 이동(soft navigation)에서 slot 유지 | `parallel-routes.md` 97–99행: 맞지 않는 slot은 **이전 subpage를 그대로 보인다** | 글 상세처럼 제외할 route로 가면 이전 rail이 남는다. 막으려면 `@right/[...rest]/page.tsx`(null)와 제외 route마다 null page가 필요하다 |
| 새로 고침(hard load) | 같은 파일 91, 100행: 맞지 않는 slot은 `default.js`, 없으면 404 | 모든 URL에 slot page나 catch-all이 있어야 한다. 하나 빠지면 그 URL 전체가 404다 |
| `default.js` 필수 | `02-guides/upgrading/version-16.md` 942–946행: 없으면 빌드 실패 | `@right/default.tsx` 필수. `children` 쪽 `(shell)/default.tsx`도 필요할 수 있다(93행) |
| 한 instance 유지 | slot도 segment마다 따로 렌더된다 | `/`(slot 루트 page)와 `/@u/projects`(slot `[handle]/projects` page)는 다른 segment라 다시 mount된다. 같은 handle 안의 유지는 (ii′)도 준다. 이득 없음 |
| `notFound()` 경계 | posts의 알 수 없는 사용자 404는 layout에서 던진다 | slot page는 children layout과 따로 돈다. 404가 될 요청에서도 slot의 rail fetch가 나간다 |
| `loading.tsx` | children의 loading은 slot을 감싸지 않는다 | slot마다 Suspense를 따로 둬야 한다 |
| cacheComponents | `parallel-routes.md` 69행: 같은 단계의 slot 하나가 dynamic이면 모두 dynamic | `(shell)` 단계에 slot을 두면 모든 children의 static 판정이 slot에 묶인다. U4에 불리하다 |

측정할 효과 (U1c 주 지표 = U1b와 같은 W1 익명 RSC 바이트, 브라우저 HAR):

| W1 이동 | (ii) 오늘 | (ii′) 뒤 |
| --- | --- | --- |
| s2 `/` → posts | 다시 받음 | 다시 받음 (자리 2곳 경계) |
| s3 posts → projects | 다시 받음 | **유지** |
| s4 projects → `<p>` | 유지 | 유지 |
| s5 `<p>` → 글 상세 | 제외 route | 제외 route |
| s6 글 → `/` | 다시 받음 | 다시 받음 |

- 판정선: 줄어든 바이트 ≥ max(범위 × 2, 기준 HAR의 오른쪽 rail 조각 크기 × 0.5). 기대: 한 번(s3)만큼 준다.
- curl 바이트로는 판정하지 않는다. curl은 `Next-Router-State-Tree`가 없어 언제나 전체 트리를 받는다(baseline.md §2.1).
- 서버 비용: 로그인 이동에서 rail fetch(tree, categories, recents)가 s3에서 사라진다. QW1 지표(`ssr_fetch`)로 기록만 한다.

### 15.3 구조 (U1c 뒤)

```
app/(shell)/
├── layout.tsx                  RailFrame (왼쪽 rail 1번)               불변
├── (feed)/layout.tsx           ContentFrame + HomeRightRail()          렌더 자리 1, 불변
└── [handle]/
    ├── layout.tsx              '@' 검사                                 불변
    ├── (rail)/                                                          새 route group (URL 불변)
    │   ├── layout.tsx          handle → 사용자 404 → ContentFrame
    │   │                         rightRail = RightRail
    │   │                           ├─ PostsProfileSlot (client, posts에서만 보임)
    │   │                           │    └─ <Suspense><UserProfileCard username/></Suspense>
    │   │                           └─ HomeRightRail username            렌더 자리 2
    │   ├── posts/   layout.tsx = 모바일 머리 + children만 (ContentFrame 없음)
    │   ├── projects/ (list)/ [project]/   projects/layout.tsx 은퇴(x_)
    │   └── saved/   layout.tsx 은퇴(x_)
    ├── [slug]/ about/ resume/ me/    오른쪽 rail 제외 (오늘 그대로)
    └── page.tsx                       /@u → 308
```

### 15.4 developer 파일 계획 (순서대로, 커밋 2개)

커밋 1: 이동만 (`git mv`, 내용 변경 없음, URL 불변)

| # | 명령 |
| --- | --- |
| 1 | `git mv 'app/(shell)/[handle]/posts' 'app/(shell)/[handle]/(rail)/posts'` |
| 2 | `git mv 'app/(shell)/[handle]/projects' 'app/(shell)/[handle]/(rail)/projects'` |
| 3 | `git mv 'app/(shell)/[handle]/saved' 'app/(shell)/[handle]/(rail)/saved'` |
| 4 | import 1곳 고침: `components/blog/sidebar-blog.server.tsx:5` `@/app/(shell)/[handle]/posts/loading` → `(rail)/posts/loading`. 그 밖은 `rg -n "\[handle\]/(posts\|projects\|saved)" app components apis hooks utils`로 0건 확인 |

커밋 2: rail 하나로 (모두 `apps/dashboard_client_web/` 아래)

| # | 파일 | 변경 |
| --- | --- | --- |
| 5 | `app/(shell)/[handle]/(rail)/layout.tsx` (새) | `await params` → `username`. `if (!(await getUserProfile(username))) notFound()` (posts layout에서 옮김. 이제 projects, saved에도 같은 404). `<ContentFrame main={children} rightRail={<RightRail><PostsProfileSlot card={<Suspense fallback={<ProfileCardSkeleton/>}><UserProfileCard username={username}/></Suspense>} /><HomeRightRail username={username} /></RightRail>} />` |
| 6 | `components/rail/PostsProfileSlot.client.tsx` (새) | `usePathname()` → `isPostsPath(pathname)`이면 `card`를 렌더, 아니면 null. 상태 없음 |
| 7 | `utils/rail-visibility.ts` | 순수 함수 `isPostsPath(pathname)` 추가: decode 뒤 `^/@[^/]+/posts/?$` |
| 8 | `app/(shell)/[handle]/(rail)/posts/layout.tsx` | ContentFrame, `notFound`, `UserContextRail` 제거. 반환 = `<><div className="mb-3 lg:hidden"><Suspense fallback={<MobileContextHeaderSkeleton/>}><MobileContextHeader username={username}/></Suspense></div>{children}</>` (D12도 여기서 닫힘) |
| 9 | `app/(shell)/[handle]/(rail)/projects/layout.tsx` | `x_layout.tsx`로 이름 변경 (soft-delete). (rail) layout이 대신한다 |
| 10 | `app/(shell)/[handle]/(rail)/saved/layout.tsx` | `x_layout.tsx`로 이름 변경. saved는 이제 오른쪽 rail을 받는다(#93) |
| 11 | `app/(shell)/[handle]/(rail)/projects/[project]/layout.tsx` | 불변 (프로젝트 404 경계) |
| 12 | `components/rail/HomeRightRail.server.tsx` | 불변. 인기 태그를 보이지 않는지 확인만. 보이면 #93대로 뺀다 |

- skeleton 두 개(`ProfileCardSkeleton`, `MobileContextHeaderSkeleton`)가 없으면 기존 `RailCardSkeleton`을 쓴다. 새 파일을 만들지 않는다.
- `UserContextRail`은 지우지 않는다. 글 상세(`[slug]/layout.tsx`)가 아직 쓴다.

검증 (테스트 러너 없음, 고의 파손):

| 확인 | 기대 |
| --- | --- |
| smoke §7.3 15개 | status, `location` 불변 |
| `/@nope/posts`, `/@nope/projects` | 404 (layout 경계라 shell보다 먼저) |
| `/@taeklim/posts` | rail 위 프로필 카드 + 공유 rail. `/@taeklim/projects`에는 카드 없음 |
| `/@taeklim/saved` (로그인 소유자) | 왼쪽 rail + 오른쪽 공유 rail |
| 고의 파손 | `isPostsPath`를 항상 false로 → posts에서 카드 사라짐 확인 → 되돌림 |
| 브라우저 posts → projects | Network에서 rail 조각이 다시 오지 않음, React DevTools에서 `HomeRightRail` 하위가 다시 mount되지 않음 |
| 가드 | §5.3 전부 |

되돌림: 커밋 2 `git revert` (커밋 1은 URL과 동작 불변이라 남겨도 된다) + 재배포 + purge.

### 15.5 pm에게: 대체된 결정

- §10 Q2와 CC 행 AC7("`/@u/saved`에서 rail 숨김")은 **대체됨**. 오너가 2026-10-14에 `/@u/saved`, `/@u/me`에도 공유 왼쪽 rail을 명시적으로 요청했다(dispatch 경유).
- 코드는 이미 그렇게 되어 있다: `utils/rail-visibility.ts` 5행 주석 "The rail itself stays on every (shell) route (saved and me…)".
- 오른쪽 rail: saved는 #93의 공유 rail을 받는다. me는 오른쪽 rail에서 제외다(#93).
- `decisions.plan.md`에 Q2 대체 행이 필요하다. Supersedes = Q2 기본값과 AC7.

## 16. U2 재설정 (U2 re-scope, 2026-10-14)

- 결정: system-architect + pm (오너 위임). U2 코드 전에 고정한다(write-first).
- 결론: **(b) U2를 유지한다. 주 지표만 바꾼다. 스크립트 변경은 없다.**
- 이 절이 §5.3 U2 행, §7 U2 행의 "W2 `_rsc` 수"를 대체한다.

### 16.1 무엇을 알려고 하나

- 질문: `staleTimes.dynamic = 30`이 30초 안의 **앞으로 재방문(forward re-visit)** 요청을 없애는가.
- 옛 지표가 못 움직이는 이유: 뒤로 가기(back/forward)는 stale 시간을 보지 않는다.
- 근거: 기준선 `w2_back3_rsc` = 0, 네 팔(arm) 모두 (`runs/20261014T052554Z_baseline_19f5e31_browser/summary.csv`).
- 코드 근거: `segment-cache/bfcache.js` 104–112행 `readFromBFCache`는 staleness를 건너뛴다(`-1`).
- 문서 근거: `staleTimes.md` 36행 "doesn't change back/forward caching".

### 16.2 표: 세 안

| 안 | 내용 | 판정 |
| --- | --- | --- |
| (a) U2 삭제 | 설정 줄 없음. A6 열린 채 | 버림. 측정할 수 있는 처방을 시험 없이 버린다 |
| **(b) 유지, 지표 교체** | 같은 설정 한 줄. 주 지표 = W1 s6 | **채택**. 기전이 있고 이미 재는 칸이다 |
| (c) U3, U4에 합침 | 한 배포에 두 변경 | 버림. U3, U4 지표는 이동 시간이다. 변경 하나씩 원칙이 깨진다 |

### 16.3 시각화: 어느 이동이 바뀌나

```
W1 (익명)  s1 hard load `/` ──► s2 posts ─► s3 projects ─► s4 <P> ─► s5 <S> ─► s6 `/`
             │ hydration이 `/`를 BFCache에 씀                                     │
             │ staleAt = 적재 시각 + dynamic                                       │
             └──────────────── 기준선 간격 8.1–10.1 s ──────────────────────────────┘
  dynamic = 0  (오늘) : s6에서 staleAt 지남 → `_rsc` 1건
  dynamic = 30 (U2)   : s6에서 아직 신선 → `_rsc` 0건
W2 뒤로 ×3          : stale 무시 → 오늘도 0건, U2 뒤에도 0건 (못 움직임)
```

- s2–s5는 서로 다른 URL이다. 30초 안의 재방문은 s6 하나뿐이다.
- 간격 출처: 기준선 `raw.jsonl`의 s1 `document` 요청 `at`과 s6 `_rsc` 요청 `at`의 차. 익명 8.1–8.2 s, 로그인 9.1–10.1 s.

### 16.4 어떻게 하나 (사전 등록, `rules/measurement.md` §1)

| 칸 | 값 |
| --- | --- |
| 주 지표 | `w1_s6_home_rsc_nonprefetch`, 익명(anon) expanded. `summary.csv`에 이미 있는 칸 |
| 주 대비 | 직전 단위 뒤 3회 중앙값 vs U2 뒤 3회 중앙값 (§5.3 공통) |
| 판정선 (통과) | 줄어든 수 ≥ max(범위 × 2, 1). 기준선 값 1, 범위 0 → 0이 되면 통과 |
| 실패 조건 | 감소 0 → 설정 줄 삭제 + 재배포 + purge |
| 유효 조건 | 그 run의 s1→s6 간격 < 25 s. 넘으면 그 run은 판정 불가로 적는다 |
| 기록만 | 로그인 팔 같은 칸, `w1_rsc_nonprefetch` (5 → 4 예상), `w1_s6_home_nav_ms`, `w2_back3_rsc` (0 유지) |
| 가드 | G-a…G-l 전부 (§5.3) |

예 (기준선 숫자, `summary.csv` 12행, 16행):

1. 기준선 익명 expanded s6 `_rsc` 비prefetch = 1 1 1, 범위 0.
2. U2 뒤 값이 0 0 0이면 감소 1 ≥ max(0, 1). 통과.
3. 같은 run의 `w2_back3_rsc`는 0 그대로여야 한다.

- 간격은 스크립트가 아니라 판정 때 `raw.jsonl`의 `at`으로 계산한다. 그래서 스크립트 변경은 없다.
- 간격 계산: data-analyst가 run마다 `at(s6 _rsc) − at(s1 document)`를 판정 항목에 적는다. 저장된 산출물 분석이라 "Allowed locally"다.
- 25 s인 이유: hydration은 document 요청 뒤에 온다. 잰 간격이 실제보다 길다. 25 s는 안전 쪽 여유다.
- 이 경로가 쓰이는 근거: hydration 시드가 `DYNAMIC_STALETIME_MS`로 staleAt을 쓴다(`create-initial-router-state.js` 49행, `bfcache.js` 50–51행).
- Link 클릭은 `FreshnessPolicy.Default`로 간다(`navigate-reducer.js` 47행). 그 경우 `readFromBFCacheDuringRegularNavigation`이 staleAt을 본다(`ppr-navigations.js` 542–552행).
- segment cache 경로가 운영에서 돈다: 기준선 `raw.jsonl`에 `next-router-segment-prefetch` 요청 185건.

### 16.5 읽는 법

| 경우 | 뜻 |
| --- | --- |
| s6 1 → 0, W2 0 유지 | U2 통과. A6 닫힘 |
| s6 1 → 1, 간격 < 25 s | 설정이 듣지 않는다. 되돌림. A6 = "측정 결과 효과 없음" |
| 간격 ≥ 25 s | 판정 불가. W1이 느려진 원인을 먼저 본다. 다시 3회 |
| W2가 0이 아님 | U2와 무관한 회귀. 가드처럼 보고한다 |

### 16.6 U4(cacheComponents)와의 관계: 코드 읽기, 측정 아님

- `cacheLife.stale`은 prefetch 항목의 staleAt을 정한다(`segment-cache/cache.js` 1832–1852행, `x-nextjs-stale-time`).
- 이동 응답의 dynamic 데이터는 `DYNAMIC_STALETIME_MS`를 쓴다. 예외는 page의 `unstable_dynamicStaleTime` 하나다(`fetch-server-response.js` 183–187행).
- 그래서 flag 뒤에도 `staleTimes.dynamic`은 계속 듣는다. U4에 기댈 것이 없다.
- 순서: U2를 U3, U4 앞에 둔다. 변경 하나씩 재야 원인을 가린다.
- 정정: §11의 "`staleTimes`는 flag 전의 이득이다"는 `static`에만 맞다. `dynamic`은 flag 뒤에도 이득이다.

### 16.7 남는 위험과 확인

- Q6 범위: 오너 답은 뒤로 가기 기준이었다. 실제 변화는 30초 안의 링크 재클릭이다. 상한 30초는 같다. 막지 않는다. main session이 오너에게 한 줄로 알린다.
- 앱에 `revalidatePath`, `revalidateTag`, `router.refresh` 호출이 없다(`rg` 0건). 그래서 mutation이 client cache를 비우지 않는다.
- 고의 확인 (U2 task AC, 로그인): 글에 좋아요 → 다른 메뉴로 이동 → 10초 안에 그 글을 다시 클릭 → 좋아요 수와 상태 확인.
- 같은 확인을 글 제목 수정 뒤에도 한다. 옛 값이 보이면 기록하고 Q6 범위로 오너에게 보고한다. 되돌림 조건은 아니다.

### 16.8 pm에게 (이 절은 고치지 않는다)

| 파일 | 고칠 곳 |
| --- | --- |
| `decisions.plan.md` | 이 재설정 행 먼저. Supersedes = §5.3 U2 주 지표 |
| `deploy/traffic/review/cc/criteria.md` | U2 행 보정 행 추가. U2 실행 전이라 허용 |
| `00.tasks.md` CC-U2 | 주 지표, kill, AC2를 §16.4로. 고의 확인 AC 하나 추가. 선행 CC-U1b → CC-U1c (`cc.plan.md` 18행 순서) |
| `cc.plan.md` U2 tactic | kill "W2 `_rsc` 수 감소 0" → "W1 s6 익명 `_rsc` 감소 0" |

## 17. rev2.2 이동 시간 지표 (nav metric, 2026-10-14)

- 결정: system-architect + pm (오너 위임). **U3 비교 run 전에 고정한다(write-first).** U3 코드는 `0ac938c`에 커밋됐고 아직 배포 전이다.
- 이 절이 §5.3의 U3, U4 행과 §14.1의 U3, U4 읽기를 대체한다. U5 읽기(§14.1)는 그대로다.
- 공식 `max(범위 × 2, 기준값의 10 %)`는 바꾸지 않는다. 지표의 정의와 팔(arm)만 바꾼다.

### 17.1 무엇이 틀렸나

| 가정 (§14.1) | 실제 (브라우저 run) | 결과 |
| --- | --- | --- |
| run마다 원값 15개 (5단계 × 반복 3) | run마다 W1 1회, `[nav]` 원값 5개 (s2–s6) | 5개의 p50 = 세 번째로 큰 값 |
| p50이 이동 전체를 대표한다 | 로그인 expanded 원값 예: {35, 20, 130, 473, 21} → p50 35 = s2 | 글 상세 s5(347–473 ms)가 바뀌어도 지표가 안 움직인다 |
| rail 팔은 하나 | 브라우저 run에 expanded와 collapsed 두 팔이 있다 | 어느 팔로 판정하는지 정해지지 않았다 |

### 17.2 고친 지표 (판정용)

| 단위 | 주 지표 | 팔 | run 값 | 단위 값과 범위 | 이유 |
| --- | --- | --- | --- | --- | --- |
| U3 | `w1_s5_post_nav_ms` (W1 5단계, 글 상세로 가는 `[nav]`) | 로그인(auth), expanded | run마다 1개 | run 3개의 중앙값. 범위 = 최댓값 − 최솟값 | U3가 고치는 곳(A7 rail 고르기 잎, C4 preload)이 글 상세뿐이다. 다른 단계를 섞으면 효과가 희석된다 |
| U4 = G-CC | `w1_nav_ms_s2_s6` (s2–s6 `[nav]` 합) | 로그인(auth), expanded | run마다 1개 | 같음 | flag는 모든 route에 걸친다. 걸음 전체 시간이 G-CC의 뜻이다. 합은 느린 단계(s4, s5)의 변화를 그대로 담는다 |

- 로그인 팔인 이유: 로그인은 `DYNAMIC`이라 매번 오리진에 간다(§14.4). 익명은 엣지 HIT라 오리진 변화가 안 보인다.
- expanded인 이유: 기본 상태다. 처음 방문자는 모두 expanded다. QW2 뒤 rail 상태는 렌더 경로를 바꾸지 않는다.
- 기록만: collapsed 같은 칸, 익명 같은 칸, U4 단계별 run 값(s2–s6 각각).
- 이름 정정: U4 지표는 p50이 아니라 **합**이다. §5.3과 G-CC 초안(§0)의 "이동 시간 p50"을 "s2–s6 이동 시간 합(run 3개 중앙값)"으로 읽는다.

### 17.3 판정선 다시 계산 (저장된 브라우저 run, `summary.csv` `values` 칸 = run 순서)

| 출처 run (배포) | U3 s5 run 값 | 중앙값 / 범위 | U3 판정선 | U4 합 run 값 | 중앙값 / 범위 | U4 판정선 |
| --- | --- | --- | --- | --- | --- | --- |
| U0b `runs/20261014T052554Z_baseline_19f5e31_browser/summary.csv` 38, 42행 | 473 / 347 / 379 | 379 / 126 | max(252, 37.9) = 252 ms | 679 / 561 / 585 | 585 / 118 | max(236, 58.5) = 236 ms |
| after-QW `runs/20261014T053859Z_QW1_after_qw_61d48bc_browser/summary.csv` 41, 45행 | 287 (run 1개) | 범위 없음 | 계산 불가 | 556 (run 1개) | 범위 없음 | 계산 불가 |
| **U1** `runs/20261014T055732Z_U1_u1_3596e4c_browser/summary.csv` 41, 45행 | 401 / 338 / 341 | **341 / 63** | max(126, 34.1) = **126 ms** | 607 / 533 / 541 | **541 / 74** | max(148, 54.1) = **148 ms** |

비교 기준 규칙 (§5.3 "직전 단위 뒤 3회"):

| 단위 | 비교 기준 | 지금 쓸 수 있는 값 |
| --- | --- | --- |
| U3 | U2 배포(`c26c69d`) 뒤 브라우저 3회 | 없음. U2 브라우저 run이 아직 없다. **U3 배포 전에 U2 브라우저 3회가 있어야 한다.** 그 값으로 판정선을 다시 낸다. 그때까지 가안 = U1 값: 기준 341 ms, 판정선 126 ms (U3 뒤 중앙값 ≤ 215 ms면 통과) |
| U4 | U3 배포 뒤 브라우저 3회 | 없음. 가안 = U1 값: 기준 541 ms, 판정선 148 ms (U4 뒤 중앙값 ≤ 393 ms면 통과) |

- U2는 s5에 영향이 없다(s5는 첫 방문 URL, §16.3). s6은 U2 뒤 빨라질 수 있다. 그래서 U4 기준은 반드시 U2, U3 뒤 값으로 다시 낸다.
- U0b 줄은 참고다. 판정에 쓰지 않는다.
- 잡음 주의: run 3개라 범위가 크다(s5 범위 63–169 ms). 판정선은 공식대로 범위 × 2를 따른다. 손으로 줄이지 않는다.

### 17.4 pm에게

| 파일 | 고칠 곳 |
| --- | --- |
| `decisions.plan.md` | #88 Update 2 행 먼저: U3 = s5 로그인 expanded, U4 = s2–s6 합 로그인 expanded. Supersedes = §14.1 U3, U4 읽기 |
| `deploy/traffic/review/cc/criteria.md` | U3, U4 행 + §3 2, 3번 (이 dispatch에서 architect가 고쳤다. U3 비교 run 전 정정으로 표시) |
| `00.tasks.md` CC-U3, CC-U4 | 주 지표 칸, AC의 지표 이름. CC-U3 선행에 "U2 브라우저 3회" 추가 |
| `cc.plan.md` | G-CC 초안 measure를 "s2–s6 합"으로 |

## 18. U4 real-404 under cacheComponents (2026-10-14)

- 결정: system-architect + pm (오너 위임). U4 다음 커밋 전에 고정한다(write-first).
- 오너 제약: 모르는 사용자, 프로젝트, 글 page는 진짜 HTTP 404다. 200 soft 404는 안 된다 (오너 2026-10-14, `560f941`, #89).
- 막힘: `cc-u4`(`1f88209`)는 빌드 실패다. `(rail)` layout이 Suspense 밖에서 uncached `getUserProfile`을 기다린다.
- `cc-u4-soft404`(`e95b975`)는 빌드 통과다. 그러나 gate가 Suspense 잎이라 200 + noindex다. 오너 제약에 어긋난다.
- 이 절이 D9의 "sample로 푼다"와 CC-U3의 D8 이월을 대체한다. 이 절은 git 객체를 읽지 않았다. 두 branch 내용은 dispatch 설명을 따른다.

### 18.1 결론

**P안: 존재 검사(existence gate)를 `proxy.ts`로 옮긴다. gate 잎은 남긴다. U4에 `'use cache'`를 더하지 않는다.**

```
요청 ─► proxy.ts (clerkMiddleware 안, 렌더 전)
         │ classifyGatePath(pathname) → user | project | post | ownerOnly | 없음
         │ 익명: 문서와 _rsc 모두 검사        로그인: 문서만 검사 (RSC 이동은 건너뜀)
         ├─ API 404 ─► rewrite /__nf/__/__/__ (맞는 route 없음) ─► Next 기본 404 + root not-found.tsx
         └─ 200 / 오류 / 시간 초과 ─► 그대로 통과 ─► static shell ─► Suspense 잎 gate (예비 방어)
```

- 문서 근거: `02-guides/streaming.md` 670행. proxy는 렌더 전에 돈다. 그래서 status code를 정할 수 있다.
- 로그인 RSC 이동은 검사하지 않는다. 그래서 G-CC(로그인 s2–s6 `[nav]` 합)에 비용이 들지 않는다.

### 18.2 질문별 답 (근거)

Q1. 캐시된 존재 검사를 layout(Suspense 위)에 둘 수 있나:

| 항목 | 답 | 근거 |
| --- | --- | --- |
| 캐시된 읽기는 Suspense 위에 둘 수 있다 | 예. uncached만 빌드 오류다 | `01-getting-started/08-caching.md` 292행. `03-file-conventions/dynamic-routes.md` 198–231행: `await params` 뒤 `'use cache'` `getPost`를 Suspense 없이 쓴다 |
| 존재 검사 뒤 `notFound()`는 진짜 404 | 예. 첫 byte 전이다 | `02-guides/streaming.md` 608–645행 "The HTTP contract" |
| `notFound()`를 `'use cache'` 안에서 던져도 되나 | 쓰지 않는다. 캐시 함수는 boolean만 돌려준다. `notFound()`는 layout이 던진다 | 문서에 정의가 없다 (`01-directives/use-cache.md`에 throw 규칙 없음) |
| sample 밖 param | 첫 요청 때 검증하고 렌더한다. 성공한 렌더만 디스크에 저장한다 | `dynamic-routes.md` 153, 260행 |
| 404도 저장되나 | 저장되지 않는다고 본다(추정). 404는 "성공"이 아니다 | 같은 곳. 확인: §9 `.next` 크기 행 |
| `dynamicParams` | 쓸 수 없다. 모르는 param은 언제나 요청 때 렌더한다 | `route-segment-config/dynamicParams.md` 22행 |
| fallback shell이 200을 먼저 보내나 | 보내지 않는다고 본다(추정). `[handle]` layout 위에 Suspense 조상이 없다. 그래서 shell이 비고 렌더가 막힌다(blocking) | root, `(shell)`, `[handle]` layout에 `Suspense` 0건 (grep). `07-adapters/09-output-types.md` 142행 `parentFallbackMode: null` = blocking |
| 사용자, 프로젝트 존재 | 가능하다. 둘 다 token 없는 공개 읽기다 (`getUserProfile.api.ts`, `getProjectPosts.api.ts`) | 위 행들 |

- 그래도 U4에서는 쓰지 않는다. 이유는 Q4와 18.3의 L안 행이다.

Q2. `[slug]`: 익명 캐시 검사 + 잎 token 검사:

- 개인정보는 새지 않는다. 캐시 값은 익명 API 결과 하나다. Express는 비공개와 없음을 둘 다 404로 준다 (`posts.detail.ts` 141, 153–157행).
- **그러나 오너 제약을 못 지킨다.** "공개 아님"이면 잎으로 간다. 익명의 모르는 slug도 잎으로 간다. 잎의 `notFound()`는 200 + noindex다. 엣지가 그 200을 1일 저장한다.
- 원인: layout 결과는 static shell에 든다. shell은 모든 viewer가 함께 쓴다. 그래서 viewer에 따라 다른 status는 layout에서 만들 수 없다.
- viewer를 렌더 전에 아는 곳은 proxy 하나다. `clerkMiddleware`의 `auth()`가 그 자리에 있다.
- 결론: 비공개 글의 viewer 분기는 proxy에서만 된다. Q2 안은 버린다.

Q3. proxy 비용 (요청 하나당):

| 요청 | 오늘 (`cc-u4` 이전, layout gate) | P안 | 순 증가 |
| --- | --- | --- | --- |
| 익명, 엣지 HIT (대부분) | 오리진 안 감 | 오리진 안 감 | 0 |
| 익명, 엣지 MISS, 글 | layout이 글 1회 기다림 | proxy 1회 + 잎 1회. 둘 다 `blog-api.` 엣지 HIT (`setPostReadCache` s-maxage 1일) | fetch +1, 대개 엣지 HIT |
| 익명, MISS, 사용자 page | layout이 profile 1회 기다림 | proxy profile 1회 + 잎 1회. profile은 엣지 캐시 없음 | Express +1 |
| 로그인 문서 load, 글 | layout 1회 | proxy 1회 (token, `DYNAMIC`) + 잎 1회 | Express +1 |
| 로그인 RSC 이동 (G-CC) | layout 1회 기다림 | 검사 없음. 잎만 | 0. 오히려 shell이 먼저 온다 |
| 404 응답 | 해당 없음 | 엣지가 저장하지 않는다 | `deploy/traffic/README.md` 116행 "404 REVALIDATED" |

- 기다림은 늘지 않는다. 오늘도 layout이 같은 왕복 하나를 기다린다. 늘어나는 것은 fetch 수다. 그 수는 gate 로그 줄이 잰다(18.4 3번).
- React `cache()`는 proxy와 렌더 사이에서 공유되지 않는다. 그래서 중복 제거가 없다.

Q4. U5와의 분리:

- P안은 `'use cache'`를 더하지 않는다. U5의 세 읽기(tags, tree, projects)는 손대지 않는다.
- U5 비교 기준은 "직전 단위 뒤 3회"다(§5.3). 그래서 U4의 gate 비용은 U5 기준에 이미 들어 있다. U5 판정은 깨끗하다.
- U4 범위는 바뀐다(proxy gate 추가). pm이 D-행으로 적는다. 지표와 판정선은 그대로다(§17.2).

### 18.3 세 안과 판정

| 안 | 내용 | 오너 제약 | U4 빌드 | U5 분리 | 판정 |
| --- | --- | --- | --- | --- | --- |
| S (soft) | `cc-u4-soft404` 그대로 | 어긋남 (200 + noindex, 엣지 1일) | 통과 | 깨끗 | 버림 (오너 금지) |
| L (layout 캐시 + proxy) | 사용자, 프로젝트 = layout의 `'use cache'` boolean. 글, me, saved = proxy | 지킴 | 빌드가 운영 `blog-api.`를 불러야 한다. runner 도달과 `ORIGIN_KEY`가 증명되지 않았다 (u4-preview.md 11행의 fetch는 prerender 끝에 취소된 것이다) | 범위 변경: Q8 앞당김, D28 (`no-store` 안의 `'use cache'`), 새 `cacheTag` 이름 → CC-U5 AC1, CC-U6 허용 목록 변경 | 목록의 대안. U5로 미룬다 |
| **P (proxy만)** | 네 gate 모두 proxy. 잎 gate는 예비 방어로 남김 | 지킴 (예외 18.6) | 데이터 없이 통과 (§9 "U4는 데이터 없이 통과") | `'use cache'` 0개 추가 | **채택** |

- L안을 다시 여는 조건: gate 로그의 `ms` p50이 사용자 page MISS TTFB의 20 % 이상이면 U5에서 사용자, 프로젝트 존재를 캐시로 옮긴다. 그때 D-행, `cacheLife('minutes')`, tag `exists:user:<u>`, `exists:project:<u>:<p>`를 정한다.

### 18.4 developer 파일 계획 (`cc-u4` 위, 모두 `apps/dashboard_client_web/` 아래)

커밋 1: 잎 gate (빌드 녹색으로)

| # | 파일 | 변경 |
| --- | --- | --- |
| 1 | `app/(shell)/[handle]/(rail)/layout.tsx` | `cc-u4-soft404` `e95b975`의 `UserGate` 잎을 가져온다. layout은 `await params`만 하고 데이터를 기다리지 않는다 |
| 2 | `app/(shell)/[handle]/(rail)/projects/[project]/layout.tsx` | 같은 커밋의 `ProjectGate` 잎 |
| 3 | `app/(shell)/[handle]/[slug]/layout.tsx` | 같은 커밋의 `PostGate` 잎. `preloadCommentsFirstPage(post.id)`는 `PostGate` 안, `getPostBySlug` 뒤로 옮긴다. `preloadProjectsTree(username)`는 layout에 남긴다 (await 없음) |
| 4 | 잎 3개 주석 | "proxy가 404를 정한다. 이 잎은 proxy를 지난 요청(로그인 RSC 이동, fail-open)의 예비 방어다" |

- 커밋 1은 main session이 `e95b975`를 cherry-pick하는 것으로 대신할 수 있다. 충돌만 developer가 푼다.

커밋 2: proxy gate

| # | 파일 | 변경 |
| --- | --- | --- |
| 5 | `utils/notFoundGate.ts` (새, 순수) | `classifyGatePath(pathname)` → `{kind:'user', username}` (`/@u/posts`, `/@u/projects`) · `{kind:'project', username, project}` (`/@u/projects/<p>`) · `{kind:'post', username, slug}` (`/@u/<seg>`, `seg`가 `RESERVED_HANDLE_SEGMENTS` 밖) · `{kind:'ownerOnly', username}` (`/@u/me`, `/@u/saved`) · `null` (그 밖: `/@u`, about, resume, logs, 세 단계 이상 경로). decode 뒤 비교. `shouldCheck({ signedIn, isRsc })` = `!signedIn \|\| !isRsc` |
| 6 | `apis/existence.proxy.ts` (새) | `checkExists(gate, token)` → `'found' \| 'missing' \| 'unknown'`. 경로: user = `/v1/api/posts/users/:u/profile`, project = `getProjectPosts.api.ts`와 같은 경로, post = `/v1/api/posts/slug/:slug` (token 있으면 `Authorization`). `x-origin-key` 헤더, `AbortSignal.timeout(1500)`. 404만 `missing`. 그 밖 status, 오류, 시간 초과 = `unknown` (fail-open). `server-only`와 React `cache()`를 import하지 않는다. `originKeyHeaders()` import가 proxy 빌드에서 깨지면 env 읽기 두 줄을 이 파일에 둔다 |
| 7 | `apis/existence.proxy.ts` | ownerOnly: 익명 = 네트워크 없이 `missing`. 로그인 문서 = `GET /v1/api/users/me` (token). `data.username`이 handle과 다르면 `missing`. 필드 이름은 `users.ts` 46행으로 확인 |
| 8 | `proxy.ts` | `clerkMiddleware` 콜백 안, 요청 로그 줄 뒤, `isProtectedRoute` 앞. GET, HEAD만. `const { userId, getToken } = await auth()`. `isRsc = req.headers.get('rsc') === '1'`. `classifyGatePath` → `shouldCheck` → `checkExists`. `missing`이면 `return NextResponse.rewrite(new URL(NOT_FOUND_PATH, req.url))`. 상수 `NOT_FOUND_PATH = '/__nf/__/__/__'` (4단계). 어느 route와도 맞지 않는 경로라 Next 기본 404가 root `not-found.tsx`를 낸다. `[handle]` layout과 flag 동작(18.2 Q1 추정 행)에 기대지 않는다. 먼저 `find app -name '[[]...*' -o -name '[[][[]...*'` → 0건 (catch-all 없음)을 확인한다. branch에 이미 있는 `/__not-found` rewrite는 이 한 길로 합친다 |
| 9 | `proxy.ts` | gate를 검사한 요청마다 JSON 한 줄: `{severity:'INFO', message:'gate', kind, result, ms, signedIn, rsc}`. `LOG_REQUESTS` 스위치를 따른다 |
| 10 | `components/me/OwnerOnly.server.tsx` | 코드 불변. 주석만: "진짜 404는 proxy가 낸다. 여기는 로그인 RSC 이동의 예비 방어" |

- 바꾸지 않는 것: `packages/*`, Express, `env.schema.ts`, `next.config.ts`의 flag 줄, 측정 스크립트.
- `[slug]` sample(`CC_SAMPLE_SLUG`)은 `HOME_FEED_AUTHOR`의 공개 글이어야 한다. 잎 gate라 빌드는 데이터를 부르지 않는다. 그래도 운영 smoke와 같은 값을 쓴다.

### 18.5 검증 (테스트 러너 없음, 고의 파손)

| # | 언제 | 확인 | 기대 |
| --- | --- | --- | --- |
| 1 | 빌드 | GH Actions 빌드 잡 (flag on) | 통과. `rg -n "'use cache'" A/app A/apis A/components` → CC-U4 AC5의 OG, sitemap 함수만. 18.4 1–3번 layout 세 파일에 `rg -n "auth\(\|cookies\(\|headers\(\|currentUser\("` → 0 |
| 1b | 빌드 로그 | `/[handle]/[slug]`에 fetch 취소 경고 (u4-preview.md 11행과 같은 모양) | 0건. 있으면 `preloadProjectsTree`를 `PostGate` 안으로 옮긴다 |
| 5a | 배포 + purge 직후, **2번보다 먼저** | `/nope`, `/@nope/x` | 404. 이 결과가 18.2 Q1 추정(flag 아래 layout `notFound()` = 404)을 판정한다. 2–4번 실패 원인을 가린다 |
| 2 | 배포 + purge 뒤, 익명 | `/@nope/posts`, `/@nope/projects`, `/@taeklim/projects/cc-nope`, `/@taeklim/cc-nope-slug` | 404. 본문에 root `not-found.tsx` 표지 문구. 두 번째 호출의 `cf-cache-status`가 HIT 아님 |
| 3 | 같음, 익명 RSC | 같은 4개 + 헤더 `RSC: 1` + `?_rsc=cc` | 404 |
| 4 | 같음, 익명 | `/@taeklim/me`, `/@taeklim/saved` | 404 (CC-U4 AC7) |
| 5 | 같음 | `/nope`, `/@nope/x` (G-e), smoke §7.3 15개 | 404, 나머지 status와 `location` 불변 |
| 6 | 로그인 (오너 세션 스크립트) | 오너 비공개 글 slug 문서, `/@taeklim/me`, `/@taeklim/saved` | 200, 비공개 글 제목이 본문에 있다 |
| 7 | 로그인 | `/@taeklim/cc-nope-slug` 문서 | 404 |
| 8 | 고의 파손 (배포 없는 local dev 또는 다음 배포 전) | `shouldCheck`가 늘 false | 2번 URL이 200 + `noindex`로 바뀐다. proxy가 404를 만든다는 증거. 되돌린다 |
| 9 | 기록만 | `/@taeklim/x.png` (matcher가 점 있는 경로를 건너뜀) | status 기록. 200이면 18.6 2번 |
| 9b | 브라우저, 익명 | 글 화면에서 모르는 slug 링크로 client 이동 (주소창 입력 아님) | not-found 화면이 보인다. 빈 화면이나 멈춤이 아니다 |
| 10 | 기록만, 1일 | Cloud Logging `message="gate"` | kind별 수, `ms` p50, `result` 비율. U4 브라우저 run 중 `signedIn:true, rsc:true` gate 줄 = 0 |

- 비용 손잡이 (지금 만들지 않음): 익명 prefetch 요청(`Next-Router-Prefetch`, segment prefetch 헤더)도 gate를 지난다. prefetch shell에는 글 데이터가 없다. 10번의 수나 `ms`가 크면 prefetch를 검사에서 뺀다.

- 8번 local dev는 "Allowed locally" 밖일 수 있다. 실행 여부는 main session이 정한다.

### 18.6 남는 예외 (오너에게 보일 것)

1. **오너 질문.** 로그인 상태의 RSC 이동으로 모르는 page에 가면 잎이 not-found 화면을 낸다. RSC 응답 status는 200이다. 응답은 `DYNAMIC`이라 엣지에 저장되지 않는다. crawler는 이 길을 타지 않는다. 문서 load는 404다. 오너가 고른다: (a) 받아들인다 (기본안), (b) 로그인 RSC 이동도 검사한다. (b)는 글 이동(s5)마다 Express 호출 1회가 는다. G-CC에 직접 걸린다.
   - #103 (2026-10-14): 오너가 (b)를 골랐다. 로그인 RSC 이동도 검사한다. branch `cc-u4`에서 `shouldCheck` 건너뛰기를 지웠다. 비용: gate 경로 이동마다 Express 호출 1회.
2. 점이 든 경로(`/@u/x.png`)는 proxy matcher 밖이다. 잎 gate가 soft 404를 낸다. 9번 결과가 200이면 다음 단위에서 matcher 또는 layout의 동기 검사로 막는다. slug에 점이 없는지 먼저 확인한다.
3. fail-open: API 시간 초과나 5xx면 proxy가 통과시킨다. 그 요청이 모르는 page면 soft 404가 엣지에 1일 남을 수 있다. 드물다. 잘못된 404보다 낫다.
4. 글 slug 조회는 handle을 보지 않는다 (`posts.detail.ts` 140행, `username` 질의 없음). 오늘 동작과 같다. 이 단위에서 바꾸지 않는다.

### 18.7 되돌림

| 조건 (kill) | 방법 |
| --- | --- |
| 18.5 5a, 2–7, 9b번 중 하나라도 거짓, 또는 있는 page가 404 | U4 커밋 전부 `git revert` + 재배포 + purge (§3.1). 커밋 2만 되돌리면 soft 404가 남는다. 오너 금지라 단독 되돌림은 쓰지 않는다 |
| gate `ms` p50이 18.3 L안 조건을 넘음 | 되돌리지 않는다. U5에서 L안으로 옮긴다 (D-행) |

### 18.8 pm에게 (이 절은 고치지 않는다)

| 파일 | 고칠 곳 |
| --- | --- |
| `decisions.plan.md` | 새 행 먼저: U4 404 gate = P안. Rejected = S (오너 #89), L (빌드 API 도달 미증명, U5 범위 침범), Q2 안 (익명 soft 404). Supersedes = D9 "sample로 푼다", CC-U3의 D8 이월 |
| `00.tasks.md` CC-U4 | 범위에 proxy gate 추가. AC7에 18.5 2, 3, 6, 7번 추가. 새 AC: 18.5 8번 고의 파손, 10번 기록만. 18.6 1번을 오너에게 알린 줄이 `01.status.md`에 있다 |
| `00.tasks.md` CC-U5 | 변경 없음. 18.3 L안 다시 여는 조건만 메모 |

## 19. 흔들림 아래 U4 측정 (U4 measurement under drift, rev2.3, 2026-10-14)

- 결정: system-architect + pm (오너 위임). **다음 U4 run 전에 고정한다(write-first).** §14, §17과 같은 종류의 사전 등록 보정이다.
- 이 절이 §17.2, §17.3의 U4 비교 방법(직전 단위 뒤 3회 대 U4 뒤 3회)을 대체한다. 지표 `w1_nav_ms_s2_s6`, 로그인 expanded는 그대로다.
- 입력: `deploy/traffic/review/cc/u4-verdict.md`, 흔들림 대조 run 2개(아래 표).

### 19.1 무엇을 알려고 하나

- 질문: U4 build 하나만 바꿨을 때 로그인 걸음 합이 줄어드는가. 환경 흔들림(drift)과 섞이지 않게 가르고 싶다.
- 문제: 같은 W1 코드 경로의 build에서 값이 몇 시간 사이에 약 +150 ms 움직였다.

| run (build) | 시각 (UTC) | 로그인 expanded s2–s6 합, run 값 | 중앙값 | 범위 | 출처 |
| --- | --- | --- | --- | --- | --- |
| U4 비교 기준 (`0ac938c`, 하네스 v2) | 07:44 | 295 / 329 / 329 | 329 | 34 | `runs/20261014T074439Z_U4_u4base_v2_0ac938c_browser/summary.csv` |
| U4 attempt 2 (`f122265`) | 09:22 | 482 / 421 / 434 | 434 | 61 | `runs/20261014T092201Z_U4_u4_f122265_browser/summary.csv` |
| 대조, U7 (`964c9f8`, W1 경로 불변) | 09:54 | 454 / 609 / 500 | 500 | 155 | `runs/20261014T095432Z_U7_u7_964c9f8_browser/summary.csv` 49행 |
| 대조, 재확인 (`964c9f8`) | 10:17 | 459 / 623 / 476 | 476 | 164 | `runs/20261014T101744Z_U4_env_recheck_964c9f8_browser/summary.csv` 49행 |

- 대조 두 개는 U4 코드가 없는데도 기준보다 147–171 ms 높다. U4 attempt 2의 +105 ms보다 크다.
- 그래서 오늘의 어떤 U4 run도 07:44 기준과 비교하면 FAIL이거나 판정 불가다. 지금 공식으로 대조 476 / 범위 164를 기준으로 삼으면 판정선이 328 ms다. treatment가 148 ms 이하여야 통과한다. 실현 불가다.

### 19.2 결론

| 항목 | 정한 것 |
| --- | --- |
| 07:44 기준 (329 ms) | **U4에는 대체됨.** 흔들림 증거(19.1 대조 2개) 때문이다. 다른 시각의 run과 비교하지 않는다 |
| attempt 2 판정 | 기록된 FAIL은 고치지 않는다(사후 수정 금지). 주석만 단다: "주 지표의 원인은 흔들림과 섞였다. kill은 G-a, G-b FAIL로 유지된다" |
| 새 비교 | 한 시간 안의 A-B-A 묶음 하나. 대조(C)와 처리(T)가 같은 시간대를 공유한다 |
| 가드 | G-a, G-b는 그대로다. 요청 수라서 지연 흔들림에 영향을 받지 않는다. attempt 2를 실제로 막은 것이 이 둘이다 |

### 19.3 A-B-A 묶음 (어떻게 하나)

```
t=0 ─ 사전 점검 ─ C1 (대조 build, 5 run) ─ T 배포 ─ T (U4 build, 5 run) ─ C 재배포 ─ C2 (대조 build, 5 run) ─ t ≤ 60 min
        │            │                      │                              │
        │            └ 각 블록 앞 warmup W1 1회 (run 0, 버림)               └ release.sh 되돌림: tarball 없이 수 초
        └ VM 메모리 < 80 %, 다른 배포·purge·workflow 없음, 같은 하네스 v2, 같은 runner 플랫폼
```

| 칸 | 값 |
| --- | --- |
| 대조 build | 측정 시각의 현재 운영 build. `--web-sha`로 적는다 |
| 처리 build | U4 build. GH Actions artifact를 미리 받아 둔다. 묶음 안에서 빌드하지 않는다 |
| 전환 | `release.sh web <T_sha> <tgz>` (switch), 되돌림 `release.sh web <C_sha>` (이미 풀린 release로, `deploy/gcp/release.sh` 3–4행). 전환마다 `cf-purge.sh` 1회, 60초 대기, warmup 1회 |
| run 수 | 블록마다 **5 run**. 대조 10, 처리 5 |
| 팔 | 판정 = 로그인 expanded. 가드용 = 익명 expanded (G-a, G-b). collapsed 두 팔은 묶음에서 뺀다. 60분 안에 끝내기 위해서다. 시간이 넘치면 팔을 줄이고 run 수는 줄이지 않는다 |
| 시간 | 첫 C1 run 시작부터 마지막 C2 run 끝까지 ≤ 60 min. 넘으면 묶음 전체가 판정 불가 |
| 시각 | 조용한 시각. 지난 7일 Cloud Logging `LOG_ID("blog-web") jsonPayload.message="request"`의 시간별 수(하네스 UA 제외)에서 가장 적은 1시간 창. 기본값 UTC 05–07시(기준선을 잰 시각) |
| 기록 | 묶음 하나 = 폴더 3개(`…_C1`, `…_T`, `…_C2`) + 묶음 manifest 1개(세 폴더 경로, 전환 시각, 총 시간, 조용한 시각 근거) |

### 19.4 판정 규칙 (사전 등록)

기호: 블록마다 run 값 5개. `m(C1)`, `m(C2)`, `m(T)` = 블록 중앙값. `c̃` = 대조 10 run 전체의 중앙값.

| 단계 | 규칙 | 왜 |
| --- | --- | --- |
| 1. 유효 | A-A 차 `d = \|m(C1) − m(C2)\|`. **d ≤ 0.10 × c̃**여야 유효하다. 넘으면 묶음 안에서 흔들렸다. 판정 불가, 다른 시각에 다시 | 같은 build 두 블록이 다르면 그 시간대는 쓸 수 없다 |
| 2. 판정선 | `L = max(2 × d, 0.10 × c̃)` | 잡음은 같은 시간대의 A-A 차에서 유도한다(`rules/measurement.md` §1). 10 %는 기존 공식의 바닥값을 그대로 쓴다 |
| 3. 통과 | 셋 모두 참: (a) `c̃ − m(T) ≥ L`, (b) `m(T) < min(m(C1), m(C2))`, (c) T 5 run 중 4개 이상이 `c̃`보다 작다 | (b)는 T가 두 대조 사이에 끼면 흔들림일 수 있어서다. (c)는 run 하나의 튀는 값에 판정이 걸리지 않게 한다 |
| 4. 회귀 | `m(T) − c̃ ≥ L`이고 T 5 run 중 4개 이상이 `c̃`보다 크다 → FAIL(회귀) | 반대 방향도 같은 기준으로 판정한다 |
| 5. 그 밖 | 효과 없음(미달). §5.3 U4 실패 조건대로 되돌림과 `recover` | |
| 가드 | T 블록의 run마다 G-a(10초 창 최대 요청 수 ≤ U0b + 20 %), G-b(링크당 prefetch ≤ 기준). 하나라도 FAIL이면 주 지표와 무관하게 되돌림 | attempt 2를 실제로 막은 선이다 |

- 퍼짐(spread) 기록: 대조 10 run의 IQR(Q1–Q3)과 최댓값·최솟값을 뺀 trimmed 범위를 함께 적는다. 판정에는 쓰지 않는다.
- IQR을 판정선에 쓰지 않는 이유: 대조 run에 600 ms대의 높은 run이 섞인다(6개 중 2개, 19.1). IQR × 2가 약 300 ms가 되어 어떤 효과도 판정할 수 없다. 블록 중앙값 비교의 잡음은 블록 사이 차 `d`가 직접 보인다.
- 예 (19.1의 대조 두 폴더를 C1, C2로 가정한 연습. 판정 아님): `m(C1)` = 476, `m(C2)` = 500, `d` = 24. `c̃` ≈ 488이면 0.10 × c̃ = 48.8 ≥ d라 유효하다. `L` = max(48, 48.8) = 48.8 ms. 통과하려면 `m(T)` ≤ 439 ms, `m(T)` < 476, T run 4개 이상 < 488이어야 한다.

### 19.5 로그인 팔의 실행 자리

- 로그인 팔은 `my.prettylog.com` 도메인의 Clerk 세션 쿠키가 있어야 돈다.
- 단독 Actions 점검(예: `traffic-check.sh`를 도는 주간 workflow)은 그 쿠키를 그 도메인에 둘 수 없다(쿠키 도메인). 그래서 그 점검은 익명 값만 낸다.
- U4 판정은 로그인 팔이 필요하다. 그래서 A-B-A는 오너 secret이 있는 하네스 경로(`cc-browser-measure.yml`, main session이 dispatch)에서만 돈다. 익명만 나온 묶음은 U4를 판정하지 못하고 가드만 기록한다.

### 19.6 읽는 법

| 경우 | 뜻 |
| --- | --- |
| 유효 + 통과 + 가드 통과 | U4 효과 확인. G-CC 판정 근거 |
| 유효 + 회귀 | U4가 로그인 상세 이동을 느리게 한다. `u4-verdict.md` §4 H-S, H-C 판별로 간다 |
| 유효 + 미달 | 효과 없음. 되돌림 |
| 무효 (d > 10 %) | 그 시간대가 흔들렸다. 판정 없이 다른 조용한 시각에 다시 |
| 가드 FAIL | 주 지표와 무관하게 되돌림. 메뉴 prefetch 처방(§8.2)이 먼저다 |

### 19.7 pm에게 (이 절은 고치지 않는다)

| 파일 | 고칠 곳 |
| --- | --- |
| `decisions.plan.md` | #88 Update 3 행 먼저: U4 비교 = A-B-A 1시간 묶음, 블록당 5 run, 규칙 19.4. Supersedes = §17.3 U4 비교 기준(07:44 329 ms) |
| `deploy/traffic/review/cc/criteria.md` | U4 행 (architect가 이 dispatch에서 고쳤다. "다음 U4 run 전 보정"으로 표시) |
| `deploy/traffic/review/cc/u4-verdict.md` | data-analyst가 19.2의 주석 한 줄을 §0에 단다. 판정 칸은 고치지 않는다 |
| `00.tasks.md` CC-U4 | 측정 AC를 19.3, 19.4로. 묶음 안 배포 2회(T 배포, C 되돌림)와 purge 2회를 적는다 |
