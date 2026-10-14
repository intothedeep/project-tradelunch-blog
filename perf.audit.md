# 성능 감사(performance audit): `apps/dashboard_client_web` 대 S1–S3 규칙

- 작성: system-architect, 2026-10-14. 분석만 했다. 코드 변경, git, 로컬 실행, 배포는 없다.
- 대상: Next ^16.2.9 App Router, React 19, TanStack Query(탠스택 쿼리) v5, next-intl, Clerk, jotai, next-themes.
- 근거 표기: `file:line`, 또는 `rg` 명령과 결과 개수. 확인하지 못한 것은 "확인 못함"으로 적는다(§5).
- 결과: 25개 항목 중 PASS 6, PARTIAL 7, FAIL 11, N/A 1. 상위 8개 수정은 §4.

## 0. 출처(Sources)

### S1. "Next.js 이렇게 쓰면 느립니다" 1편: 동적 RSC(dynamic RSC)와 prefetch

URL: https://velog.io/@k-svelte-master/nextjs-slow-1-dynamic-rsc-prefetch

- 요청 시점 API(request-time API)가 route 어디에든 있으면 route 전체가 동적(dynamic)이 된다. 예: `cookies()`, `headers()`, `searchParams`, auth helper.
- 동적 route는 page payload를 prefetch하지 않는다. `loading.js`까지만 받는다.
- 동적 route의 client router cache(클라이언트 라우터 캐시) 보존 시간은 0초다. 클릭마다 왕복(round trip)이 생긴다.
- 처방: `cacheComponents: true`, dynamic 읽기를 `<Suspense>` 잎(leaf)으로, `params`는 잎에서만, `generateStaticParams`, `experimental.staleTimes`를 일부러 정한다.
- 규칙 하나: 이동 속도는 클릭 전에 RSC 구멍(hole)이 prefetch와 cache로 채워졌는지로 정해진다.

### S2. 2편: Server Functions(Server Actions)는 순차 실행된다

URL: https://velog.io/@k-svelte-master/nextjs-slow-2-server-actions-sequential

- Server Action은 client마다 하나씩 줄을 선다. 1초 action 셋을 `Promise.all`로 불러도 약 3초다.
- 첫 렌더(initial render) 중에는 부를 수 없다. TanStack Query의 `queryFn`으로 쓰지 않는다.
- 설계 규칙: Server Action은 변경(mutation) 전용이다. 읽기(read)는 Server Component나 Route Handler로 한다.
- BFF(backend for frontend): backend 호출을 Next server에서 한다. 같은 곳에 있어 왕복이 짧다.

### S3. 3편: Suspense, 스트리밍(streaming), 워터폴(waterfall)

URL: https://velog.io/@k-svelte-master/nextjs-slow-3-suspense-streaming-waterfall

- Suspense 스트리밍: 첫 chunk에 fallback이 가고, 내용은 뒤 chunk로 온다. 마지막 경계가 끝나야 응답이 닫힌다.
- 중첩 async 컴포넌트는 워터폴(waterfall)을 만든다. 300 ms + 300 ms = 600 ms.
- 처방: `React.cache`로 감싸고 부모에서 `void getX(id)`로 미리 시작(preload)한다. 자식은 같은 promise를 기다린다.
- client fetch(`useQuery`)만 쓰면 크롤러(crawler)는 loading 상태 HTML을 받는다(SEO).
- TanStack hydration: `prefetchQuery` + `HydrationBoundary` 없이 쓰면 요청이 두 번 나고 hydration 불일치가 생긴다.

## 1. 라우트(route) 지도

무엇을 알려고: 각 route가 왜 동적인지, 클릭 때 무엇이 막는지.

```text
root app/layout.tsx  getLocale()/getMessages() :106-107  ── 모든 route 동적(확인 못함 §5-1)
 │
 ├─ (feed)/layout.tsx ── BlogShell cookies() :44 + LeftRailContainer cookies() :19
 │    ├─ /                    force-dynamic :26, getFeed auth() (Suspense 안)     loading.tsx 있음
 │    └─ /tags/[tag]          force-dynamic :12, page 맨 위 await :23             loading.tsx 있음
 │
 └─ [handle]/layout.tsx (params만)
      ├─ posts/layout.tsx     BlogShell + LeftRailContainer cookies()
      │    └─ /@u/posts       searchParams :68, await getTagFilterItems :74       loading.tsx 있음
      ├─ [slug]/layout.tsx    BlogShell + cookies(), await getProjectsTree :24  ◄ loading.tsx 위
      │    └─ /@u/<slug>      await getProjectsTree :71, 잎 auth() 3곳            loading.tsx 있음
      ├─ projects/layout.tsx  BlogShell + cookies()                              loading.tsx 있음
      ├─ about/layout.tsx     LeftRailContainer cookies() (주석은 "읽지 않음")      loading 없음
      └─ resume/layout.tsx    LeftRailContainer cookies() (주석은 "읽지 않음")      loading 없음
 /log, /log/[u], /log/[u]/[id]   force-dynamic
```

| route | 동적으로 만드는 것 | 클릭 때 막는 것 |
| --- | --- | --- |
| `/` | root `getLocale`, `cookies()` 2곳, `force-dynamic`, `getFeed`의 `auth()` | 없음. feed는 Suspense 안 |
| `/tags/[tag]` | 위 + `force-dynamic` | page 맨 위 `getPostsByTag` (loading.tsx가 가림) |
| `/@u/posts` | 위 + `searchParams` | `getTagFilterItems` 다음에 feed 시작 |
| `/@u/<slug>` | 위 + 잎 `auth()` | layout의 tree 읽기가 loading.tsx 위에 있다 |

## 2. 체크리스트(checklist)

표기: `- [x]` = PASS 또는 N/A, `- [ ]` = FAIL 또는 PARTIAL. 영향(impact) H/M/L은 익명 블로그 독자(Cloudflare 뒤) 기준이다.

### A. 동적 렌더링(dynamic rendering)과 prefetch (S1)

- [ ] **A1. root layout에 요청 시점 API가 없다**
  - **What**: root layout은 `headers()`나 `cookies()`를 읽지 않는다.
  - **Why**: S1. root가 동적이면 모든 route가 동적이다. 모든 클릭이 왕복이다. https://velog.io/@k-svelte-master/nextjs-slow-1-dynamic-rsc-prefetch
  - **How**: `rg -n "getLocale\(|getMessages\(" app/layout.tsx` → 2건 (`app/layout.tsx:106`, `:107`). 처방: locale은 오늘 항상 `en`이다(`proxy.ts:17-28`). `setRequestLocale('en')` 또는 고정 locale을 쓴다. `projects.design.md` §7.4 1행.
  - **When**: Phase CC, 1순위.
  - 상태 FAIL / 근거 위 2건 / 영향 M (HTML은 edge가 막는다. 이동은 매번 왕복)
- [ ] **A2. shell이 `cookies()`를 읽지 않는다**
  - **What**: layout shell은 cookie로 모양을 정하지 않는다.
  - **Why**: S1. `cookies()` 하나가 route 전체를 동적으로 만든다. URL 위와 같다.
  - **How**: `rg -n "await cookies\(\)" components` → 2건 (`components/shell/BlogShell.server.tsx:44`, `components/rail/LeftRailContainer.server.tsx:19`). 같은 값을 두 번 읽는다. 처방: 서버 읽기 둘을 지운다. atom은 `false`로 seed한다. cookie는 mount 뒤 `useEffect`에서 읽는다(`hooks/useSavedTags.hook.ts:6-7` 방식). 주의: `store/layout.atom.ts:41`은 module 초기화 때 `document.cookie`를 읽는다. seed 없이 두면 첫 렌더 hydration 불일치(hydration mismatch)가 난다. 대가: 첫 화면에서 rail 폭이 한 번 바뀐다. D1도 같이 풀린다.
  - **When**: Phase CC 2순위. D1 때문에 지금 해도 된다.
  - 상태 FAIL / 근거 위 2건 / 영향 M
- [ ] **A3. `auth()`는 Suspense 안 잎에서만 읽는다**
  - **What**: token 읽기는 Suspense 경계 안 잎 컴포넌트에만 둔다.
  - **Why**: S1. cacheComponents를 켤 때 static shell을 지킨다. URL 위와 같다.
  - **How**: `rg -n "await auth\(\)" app components apis` → 7건. 1건은 action이다(`postPublish.action.ts:19`). 렌더 경로 6건 중 Suspense 안 5건: `PostJsonLd.server.tsx:18`, `PostContentToc.server.tsx:15`, `PostContentCard.server.tsx:30`, `ProjectsTreeWrapper.server.tsx:17`, `getPosts.fetch.server.ts:52`(RecentPostsList 안). Suspense 밖: `app/[handle]/posts/page.tsx:85`의 `CategorySidebarWrapper`(auth `:31`). 처방: `:85`를 `<Suspense>`로 감싼다.
  - **When**: 지금(작다). CC 전 준비.
  - 상태 PARTIAL / 근거 렌더 경로 6건 중 1건 밖 / 영향 L
- [ ] **A4. `force-dynamic` 잔재가 없다**
  - **What**: blog route에 `export const dynamic = 'force-dynamic'`이 없다.
  - **Why**: S1. CC와 함께 쓸 수 없다. route segment config가 막는다. URL 위와 같다.
  - **How**: `rg -n "dynamic = 'force-dynamic'" app` → 6건. blog: `app/(feed)/page.tsx:26`, `app/(feed)/tags/[tag]/page.tsx:12`. log: `app/log/page.tsx:7`, `app/log/[username]/page.tsx:12`, `app/log/[username]/[logId]/page.tsx:9`. 기타: `app/me/page.tsx:6`. 처방: blog 2건을 지운다. 오늘은 root가 이미 동적이라 효과가 없다.
  - **When**: Phase CC.
  - 상태 FAIL / 근거 6건 / 영향 L
- [ ] **A5. `cacheComponents`가 켜져 있다**
  - **What**: `next.config.ts`에 `cacheComponents: true`가 있다.
  - **Why**: S1의 핵심 처방이다. static shell을 prefetch하고 cache한다. URL 위와 같다.
  - **How**: `rg -n "cacheComponents|experimental" next.config.ts` → 0건. 처방: A1, A2, A4와 fetch의 `'use cache'`를 끝낸 뒤 켠다(`projects.design.md` §7.4 표).
  - **When**: Phase CC 마지막. #77이 별도 phase로 정했다.
  - 상태 FAIL (계획된 보류) / 근거 0건 / 영향 M
- [ ] **A6. `experimental.staleTimes`를 일부러 정했다**
  - **What**: 동적 page의 router cache 보존 시간을 정한다.
  - **Why**: S1. 기본 0초면 같은 page로 돌아가도 다시 받는다. URL 위와 같다.
  - **How**: `rg -n "staleTimes" next.config.ts` → 0건. 처방: `experimental: { staleTimes: { dynamic: 30 } }`. 위험: 좋아요 수가 30초 늦을 수 있다. `projects.design.md:508`이 CC 첫 행으로 두었다.
  - **When**: 지금(설정 한 줄). 또는 CC 첫 행.
  - 상태 FAIL / 근거 0건 / 영향 M (Cloudflare 50 / 10 s 요청 수도 준다, #68)
- [ ] **A7. 클릭 직후 skeleton이 보인다(layout이 loading.tsx 위에서 막지 않는다)**
  - **What**: layout은 데이터를 await하지 않는다. `params`는 잎에서 읽는다.
  - **Why**: S1. 이동은 RSC 구멍이 올 때까지 멈춘다. 같은 segment의 layout은 `loading.tsx` 밖에 있다. URL 위와 같다.
  - **How**: `app/[handle]/[slug]/layout.tsx:24`가 `getProjectsTree`를 await한다. `[slug]/loading.tsx`는 page만 감싼다. 처방: rail 고르기를 Suspense 잎(rightRail 안)으로 옮긴다. `showRecentVisited`도 잎에서 정한다. 설계는 이것을 허용된 예외로 두었다(`projects.design.md` §7.3).
  - **When**: Phase CC (예외를 거둔다).
  - 상태 PARTIAL / 근거 `[slug]/layout.tsx:24` / 영향 M (글 상세는 가장 많이 여는 page)
- [x] **A8. N/A: hot segment에 `generateStaticParams`**
  - **What**: 자주 여는 동적 segment를 빌드 때 만든다.
  - **Why**: S1. 하지만 여기서는 Cloudflare가 HTML을 1일 cache한다. 배포 뒤 purge한다(`deploy/traffic/README.md:71-85`, `:418`).
  - **How**: `rg -n generateStaticParams app` → 0건. edge cache가 같은 일을 한다. CC 뒤 다시 본다.
  - **When**: 나중(CC 뒤 재평가).
  - 상태 N/A / 근거 0건 + edge 규칙 / 영향 L

### B. Server Actions와 데이터 읽기(data read) (S2)

- [x] **B1. 읽기는 Server Action으로 하지 않는다. action을 병렬로 부르지 않는다**
  - **What**: 읽기는 RSC나 Route Handler로 한다. action은 변경 전용이다.
  - **Why**: S2. action은 줄을 선다. 첫 렌더에 부를 수 없다. https://velog.io/@k-svelte-master/nextjs-slow-2-server-actions-sequential
  - **How**: `rg -l "'use server'"` → 2 파일. 쓰이는 action 4개는 모두 PATCH/DELETE다(`app/actions/postPublish.action.ts:30,45,58,74`). `rg -n "Promise\.all" app components hooks apis` → 0건.
  - **When**: 유지.
  - 상태 PASS / 근거 위 / 영향 없음
- [ ] **B2. 죽은 읽기 action이 없다**
  - **What**: 쓰이지 않는 `'use server'` 읽기 함수가 없다.
  - **Why**: S2. 읽기 action은 잘못된 본보기다. 다시 쓰이면 순차 실행이 된다.
  - **How**: `rg -n loadMorePosts` → 1건, 정의뿐(`app/actions/post.action.ts:6`). 처방: `x_post.action.ts`로 이름을 바꾼다(soft-delete).
  - **When**: 지금.
  - 상태 FAIL / 근거 1건 / 영향 L
- [x] **B3. action을 `queryFn`으로 쓰지 않는다**
  - **What**: TanStack `queryFn`은 fetch 함수다. action은 `mutationFn`에만 쓴다.
  - **Why**: S2. `queryFn`의 action은 Suspense query에서 깨진다. URL 위와 같다.
  - **How**: action을 import하는 hook 4개: `hooks/useDeletePost.query.client.ts:25`, `useDeleteAdminPostAction.query.client.ts:19`, `useSetAdminPostStatus.query.client.ts:27`(모두 mutation), `useEditorHandlers.hook.ts:182`(event handler).
  - **When**: 유지.
  - 상태 PASS / 근거 4건 / 영향 없음
- [ ] **B4. load-more BFF가 edge cache와 rate limit을 고려한다**
  - **What**: 무한 스크롤 읽기가 cache되거나, 요청 수 한도에 걸리지 않는다.
  - **Why**: S2는 Next server를 거치는 BFF를 권한다. 하지만 여기서 `/api/`는 edge cache 밖이다. 스크롤 한 page가 VM 요청 하나이고 50 / 10 s에 센다(#68, #70의 429).
  - **How**: client `components/blog/RecentPostsList.client.tsx:62`, `TagPostsList.client.tsx:60` → `/api/posts/load-more`. Cloudflare 규칙 `deploy/traffic/README.md:76` `not starts_with(..., "/api/")`. `app/api/posts/load-more/route.ts:49,56`은 `Cache-Control`을 붙이지 않는다. 더해 이 route는 token 없이 읽는다(`:52`). 첫 page(`getFeed`, token 있음)와 다르다. 소유자의 draft가 2쪽부터 빠진다. 처방 후보: (a) 익명 응답에 `Cache-Control: public, s-maxage=60`과 Cloudflare 규칙 추가, (b) 브라우저가 `blog-api.` GET을 직접 부른다(이미 edge HIT).
  - **When**: 나중(traffic 설계와 함께). (a)/(b) 선택은 소유자.
  - 상태 PARTIAL / 근거 위 / 영향 M (edge 상태는 확인 못함 §5-3)

### C. Suspense, 스트리밍(streaming), 워터폴(waterfall) (S3)

- [ ] **C1. 한 요청 안의 같은 읽기는 한 번만 나간다(`React.cache`)**
  - **What**: 여러 컴포넌트가 쓰는 fetcher는 `cache()`로 감싼다.
  - **Why**: S3. 요청당 중복을 막는다. https://velog.io/@k-svelte-master/nextjs-slow-3-suspense-streaming-waterfall . 여기서는 fetch 자동 memoization도 기대할 수 없다. 모든 fetch가 `signal`을 넘긴다(`apis/http.core.ts:35-37`, `http.server.ts:80`, `http.client.ts:58`). Next 문서는 signal을 memoization 해제 수단으로 적는다(§5-5).
  - **How**: `rg -n "cache\(" apis` → 4개만 감쌌다(`getPostBySlug`, `getProjectsTree`, `getProjects`, `getProjectPosts`). 안 감싼 것과 중복:
    - `getUserProfile`(`apis/getUserProfile.api.ts:19`): `/@u/posts`에서 3번(`posts/page.tsx:40`, `UserProfileCard.server.tsx:19`, `MobileContextHeader.server.tsx:19`).
    - `getCategoriesByUsername`(`apis/getCategories.api.ts:9`): `/@u/<slug>` 익명에서 2번(`getProjectsTree` 안, `CategorySidebarWrapper.server.tsx:38`). `/`에서 2번(`ProjectsTreeWrapper`, `CategorySidebarWrapper`).
    - `getPopularTags`(`apis/getPopularTags.api.ts:17`): `/`에서 2번(left rail `TagCloud`, `HomeRightRail.server.tsx:39`의 fallback `TagCloud`).
    - 처방: 위 세 fetcher와 `getUserPopularTags`를 `cache()`로 감싼다. `getComments`는 요청 안 중복이 없다(server 1회). 감싸도 CC 준비용일 뿐이다. 인자는 위치 인자 원시값(primitive)으로, token은 `null`로 맞춘다(`getPost.api.ts:8-17`의 규칙).
  - **When**: 지금.
  - 상태 PARTIAL / 근거 위 / 영향 H (Express와 Supabase 부하, signed-in은 edge를 못 탄다)
- [ ] **C2. page와 layout에 순차 await(waterfall)가 없다**
  - **What**: 서로 무관한 읽기가 앞 읽기를 기다리지 않는다.
  - **Why**: S3. 중첩 await는 시간이 더해진다. URL 위와 같다.
  - **How**: 
    - `/@u/<slug>`: tree(`[slug]/layout.tsx:24`, `page.tsx:71`) → post(`PostContentCard.server.tsx:36`) → comments(`Comments.server.tsx:23`). 익명은 `generateMetadata`(`page.tsx:32`)가 같은 `(slug, null)` post 읽기를 먼저 시작한다. 그러면 실제 줄은 tree → comments 2번이다(§5-7). signed-in은 token key가 달라 3번이 줄 선다.
    - `/@u/posts`: `getTagFilterItems`(`posts/page.tsx:74`) → feed(`BlogMainPage`). 2번이 줄 선다.
    - 처방: `posts/page.tsx:74`는 `FilterChipRow`를 async 잎으로 만들어 Suspense에 둔다. `[slug]`는 A7과 C4.
  - **When**: `/@u/posts`는 지금. `[slug]`는 Phase CC(A7과 같이).
  - 상태 FAIL / 근거 위 / 영향 H
- [ ] **C3. 부차 내용(댓글)은 본문 스트리밍을 막지 않는다**
  - **What**: 댓글은 자기 Suspense 경계를 가진다.
  - **Why**: S3. 경계가 없으면 글 카드 전체가 댓글 fetch를 기다린다. URL 위와 같다.
  - **How**: `components/blog/PostContentCard.server.tsx:124`의 `<Comments>`에 Suspense가 없다. 바깥 경계는 `PostContent.server.tsx:25`(카드 전체). 처방: `<Suspense fallback={댓글 skeleton}><Comments …/></Suspense>`. 댓글은 server에서 이미 seed되니 SEO는 그대로다(같은 응답 안 뒤 chunk).
  - **When**: 지금.
  - 상태 FAIL / 근거 `:124` / 영향 H (독자가 본문을 늦게 본다)
- [ ] **C4. 미리 시작(preload without await)을 쓴다**
  - **What**: 부모가 `void getX()`로 fetch를 먼저 시작하고, 자식이 같은 promise를 기다린다.
  - **Why**: S3. 600 ms를 300 ms로 줄이는 처방이다. URL 위와 같다.
  - **How**: `rg -n "^\s*void get|preload\(" app components` → 0건. 익명은 `generateMetadata`(`page.tsx:32`)가 이미 사실상 preload다(§5-7). 남는 경우는 signed-in이다. 처방: layout이나 page 맨 위에서 token을 한 번 읽고 `void getPostBySlug(slug, token)`을 시작한다. 또는 C1의 tree 읽기를 잎으로 옮겨(A7) 줄 자체를 없앤다.
  - **When**: Phase CC (A7과 같이).
  - 상태 FAIL / 근거 0건 / 영향 L (signed-in만)
- [x] **C5. 색인할 내용은 server에서 렌더한다**
  - **What**: 글 본문, feed 첫 page, 댓글 첫 page가 HTML에 있다.
  - **Why**: S3. client fetch만 쓰면 크롤러가 빈 상태를 본다. URL 위와 같다.
  - **How**: 본문 `MarkdownRenderer.server`(`PostContentCard.server.tsx:121`). feed 첫 10개 `RecentPostsList.server.tsx:32`. 댓글 50개 `Comments.server.tsx:23`. 2쪽 이후 feed는 client만이다. 하지만 `app/sitemap.ts:67`이 모든 글 URL을 낸다.
  - **When**: 유지.
  - 상태 PASS / 근거 위 / 영향 없음
- [x] **C6. TanStack query가 이중 요청이나 hydration 불일치를 만들지 않는다**
  - **What**: server 값이 props `initialData`로 client cache에 들어간다. 익명에게는 client query가 돌지 않는다.
  - **Why**: S3. seed 없이 쓰면 요청이 두 번 난다. URL 위와 같다.
  - **How**: `rg -n "HydrationBoundary|prefetchQuery"` → 0건. 대신 `initialData` seed 6곳(`hooks/useComments.query.client.ts:35`, log hook 3개 등). 기본 `staleTime` 60초(`ReactQueryProvider.client.tsx:18`)라 mount 직후 다시 받지 않는다. 개인 query(`useMe`, `useViewerLikes`, `useFavorites`)는 `enabled: isSignedIn`(`useMe.query.client.ts:23`, `useViewerLikes.query.client.ts:29`).
  - **When**: 유지. CC 뒤에도 이 방식이 맞다.
  - 상태 PASS / 근거 위 / 영향 없음
- [ ] **C7. Suspense 경계와 fallback이 알맞다**
  - **What**: 느린 async 잎마다 경계와 같은 크기의 skeleton이 있다.
  - **Why**: S3. 경계가 없으면 가장 느린 잎이 그 구역 전체를 막는다. URL 위와 같다.
  - **How**: rail은 잘 감쌌다(`UserContextRail.server.tsx:28,41,50`, `HomeRightRail.server.tsx:21,29`, `LeftRailContainer.server.tsx:27`). 빠진 곳: `posts/page.tsx:85`(A3), `PostContentCard.server.tsx:124`(C3), `MobileContextHeader`(`posts/layout.tsx:35`, `[slug]/layout.tsx:44`, Suspense 없이 `getUserProfile` await). about, resume에는 `loading.tsx`가 없다.
  - **When**: 지금(C3와 같은 손질).
  - 상태 PARTIAL / 근거 위 / 영향 M

### D. 이 앱 공통 (Cloudflare edge cache, #70, SEO, hydration)

- [ ] **D1. edge가 cache하는 HTML은 cookie에 따라 바뀌지 않는다**
  - **What**: Cloudflare가 1일 cache하는 익명 HTML에 개인 cookie 값이 들어가지 않는다.
  - **Why**: Cloudflare cache key는 cookie를 보지 않는다. `railCollapsed`는 bypass 규칙에 없다(`deploy/traffic/README.md:50-59`). 첫 MISS 방문자의 접힘 상태가 하루 동안 모든 익명 독자에게 간다.
  - **How**: `BlogShell.server.tsx:44-45`, `LeftRailContainer.server.tsx:19-20`이 cookie로 HTML 폭을 정한다. 처방: A2와 같다(client에서 읽는다). 첫 화면 폭이 한 번 바뀔 수 있다.
  - **When**: 지금 (A2와 함께). CC 2순위와 겹친다.
  - 상태 FAIL / 근거 위 / 영향 M (실제 재현은 확인 못함 §5-4)
- [x] **D2. 화면 진입 prefetch(viewport prefetch)가 #70 한도 안이다**
  - **What**: feed 카드, 태그 칩, 댓글 링크는 viewport prefetch를 하지 않는다.
  - **Why**: #70. 메인 page 스크롤에서 요청 79개, Cloudflare 50 / 10 s(#68)에 걸려 429가 났다.
  - **How**: `rg -n "prefetch=" app components` → 13건(`prefetch={false}` 12, `HoverPrefetchLink` 내부 1). `rg -c "<HoverPrefetchLink"` → 7건, 6 파일. 메뉴 링크(`PrimaryNav.client.tsx:97`)는 #70이 일부러 남겼다. 카테고리와 projects tree는 `router.push`라 prefetch가 없다(D4).
  - **When**: 유지. CC 뒤에도 viewport prefetch를 다시 켜지 않는다(`projects.design.md:515`).
  - 상태 PASS / 근거 위 / 영향 없음
- [x] **D3. RSC 이동 응답(`_rsc`)이 edge에서 HTML과 key를 나눈다**
  - **What**: `?_rsc=` 응답은 HTML과 다른 key로 cache된다. 배포 뒤 purge한다.
  - **Why**: S1의 "왕복"을 edge가 받는다. 익명 독자의 이동은 VM에 오지 않는다.
  - **How**: `deploy/traffic/README.md:58`(`_rsc` 없는 `rsc` 요청 bypass), `:115`(측정: `?_rsc=` `text/x-component` HIT), `:418-420`(배포마다 purge). 위험: purge를 잊으면 옛 JS를 가리키는 HTML이 남는다(2026-10-13 사례).
  - **When**: 유지.
  - 상태 PASS / 근거 위 / 영향 없음
- [ ] **D4. 색인할 링크는 `<a href>`다**
  - **What**: 카테고리 tree와 projects tree의 글 링크를 크롤러가 따라갈 수 있다.
  - **Why**: S3의 SEO 논점. `router.push`는 HTML에 `href`를 남기지 않는다.
  - **How**: `components/blog/CategorySidebar.client.tsx:61,67,79,84`, `app/[handle]/components/ProjectsTree.client.tsx:34`가 `router.push`다. 완화: `app/sitemap.ts:67`이 글 URL을 모두 낸다. 처방: 글 node만 `<Link prefetch={false}>`로 바꾼다(#70 유지).
  - **When**: 나중.
  - 상태 PARTIAL / 근거 5건 / 영향 L
- [ ] **D5. hydration이 올바르다**
  - **What**: server HTML과 첫 client 렌더가 같다. 한 atom을 두 곳에서 seed하지 않는다.
  - **Why**: S3. 불일치는 다시 렌더를 부르고 화면이 깜빡인다.
  - **How**: 맞는 것: 요청마다 jotai store(`fd0e7a5`), `<html suppressHydrationWarning>`(`app/layout.tsx:113`), localStorage는 effect에서 읽는다(`hooks/useSavedTags.hook.ts:6-7`). 틀린 것: about, resume layout은 `LeftRailAside`를 값 없이 seed한다(`about/layout.tsx:19`, 기본 false). 그 안 `LeftRail`은 cookie 값으로 같은 atom을 다시 seed한다(`LeftRailContainer.server.tsx:24`). `useHydrateAtoms`는 첫 값만 쓴다. 그래서 두 page에서 접힘 cookie가 무시된다. 두 layout의 주석("cookie 읽지 않음", `about/layout.tsx:9`)도 코드와 다르다.
  - **When**: A2를 할 때 같이 사라진다. 따로는 나중.
  - 상태 PARTIAL / 근거 위 / 영향 L
- [ ] **D6. 영역 사이 이동이 shell을 다시 만들지 않는다**
  - **What**: 왼쪽 rail은 한 layout에 한 번 놓인다. 이동 때 다시 mount하지 않는다.
  - **Why**: S1. 형제 layout 사이 이동은 공유 layout이 없어서 rail RSC를 매번 다시 받는다. `TagCloud`의 `getPopularTags`도 매번 다시 나간다.
  - **How**: `rg -n "<LeftRailContainer" app` → 6건(`(feed)/layout.tsx:17`, `[slug]/layout.tsx:31`, `posts/layout.tsx:28`, `projects/layout.tsx:21`, `about/layout.tsx:20`, `resume/layout.tsx:18`). 공통 조상은 root layout뿐이다. 처방 후보: rail을 root 아래 route group layout 하나로 올리고, 오른쪽 rail은 parallel route(`@right`)로 나눈다.
  - **When**: 나중 (CC 뒤, 구조 변경).
  - 상태 FAIL / 근거 6건 / 영향 M

## 3. 요약(summary)

| 묶음 | PASS | PARTIAL | FAIL | N/A | 계 |
| --- | --- | --- | --- | --- | --- |
| A. 동적 렌더링(dynamic rendering)과 prefetch (S1) | 0 | 2 | 5 | 1 | 8 |
| B. Server Actions와 읽기(read) (S2) | 2 | 1 | 1 | 0 | 4 |
| C. Suspense, 스트리밍(streaming), 워터폴(waterfall) (S3) | 2 | 2 | 3 | 0 | 7 |
| D. 이 앱 공통 | 2 | 2 | 2 | 0 | 6 |
| **계** | **6** | **7** | **11** | **1** | **25** |

- 강한 곳: 읽기(read) 경로(B1, B3), 검색 노출(SEO) 본문(C5), TanStack Query(탠스택 쿼리) seed(C6).
- 강한 곳: #70 prefetch(미리 받기) 제한(D2), Cloudflare edge(엣지) `_rsc` cache(캐시)(D3).
- 약한 곳: 요청 안 중복과 워터폴(waterfall)(C1–C3), cookie(쿠키) 기반 shell(셸)(A2, D1).
- 약한 곳: cacheComponents(캐시 컴포넌트, CC) 준비(A1, A4, A5).
- `cc.design.md`: 이 감사 시점(2026-10-14)에 파일이 없다.
- 대신 `projects.design.md` §7.3–§7.5와 대조했다. CC 설계가 나오면 §4의 "Phase CC" 행을 맞춘다.

## 4. 상위 8개 수정(top 8 fixes)

순서: 영향 대비 노력(effort). S = 한 시간 안, M = 하루 안.

| 순위 | 항목 | 수정 | 영향 | 노력 | 언제 | `projects.design.md` §7.4와 겹침 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | C3 | `PostContentCard.server.tsx:124` `<Comments>`를 Suspense 경계(boundary)로 감싼다 | H | S | 지금 | 없음 |
| 2 | C1 | `getUserProfile`, `getCategoriesByUsername`, `getPopularTags`, `getUserPopularTags`를 `cache()`로 감싼다 | H | S | 지금 | "모든 fetch" 행의 앞 단계 |
| 3 | C2 | `/@u/posts`의 `getTagFilterItems` await를 Suspense 잎(leaf)으로 옮긴다 | H | S | 지금 | 없음 |
| 4 | A6 | `experimental.staleTimes.dynamic = 30` | M | S | 지금 또는 CC 첫 행 | 있음 (`:508`) |
| 5 | A2 + D1 | shell(셸)의 `cookies()` 2곳을 지운다. `false`로 seed하고 mount 뒤 읽는다 | M | M | 지금 (D1 정확성) | 있음 (2행) |
| 6 | A7 + C4 | `[slug]` layout의 tree 읽기를 rail 잎(leaf)으로 옮긴다. signed-in 글 읽기를 미리 시작(preload)한다 | M | M | Phase CC | 있음 (§7.3 예외 철회) |
| 7 | A1 + A4 + A5 | 고정 locale(로캘), blog `force-dynamic` 2건 삭제, 그다음 `cacheComponents` | M | M | Phase CC | 있음 (1, 4, 5, 6행) |
| 8 | B4 | load-more(더 불러오기)를 edge cache(엣지 캐시)에 태우거나 `blog-api.`를 직접 부른다. token(토큰) 차이도 정리한다 | M | M | 나중 (소유자 선택) | 없음 (traffic 설계 쪽) |

- 바로 뒤: B2(`loadMorePosts`를 `x_`로, S, 지금).
- 그 뒤: D6(shell(셸) 공유, 나중), D4(tree(트리) 링크, 나중).

## 5. 확인하지 못한 것

1. next-intl v4 `getLocale()`이 이 설정에서 `headers()`를 읽는지 직접 보지 않았다. 프로젝트 자체 진단(`projects.design.md` §7.4 1행)을 따랐다.
2. `@clerk/nextjs` v7 root `ClerkProvider`가 그 자체로 동적 읽기인지 확인하지 못했다.
3. `/api/posts/load-more`의 실제 `cf-cache-status`, #70 배포 뒤 `_rsc` 요청 수를 재지 않았다. README는 첫 측정이 옛 HTML이었다고 적는다(`decisions.plan.md` #70 Update).
4. D1을 실제로 재현하지 않았다(접힘 cookie로 MISS를 만들고 익명으로 HIT 확인). 측정은 main session이 `curl`로 한다.
5. `signal`이 fetch memoization을 끈다는 점은 Next 문서 기억에 기댄다. 버전 16.2 문서로 다시 확인해야 한다. memoization이 살아 있다면 C1의 같은 URL 중복은 이미 한 번으로 줄어 있다. 그때 C1의 영향은 H에서 L로 내려간다. `cache()`로 감싸는 처방은 어느 쪽이든 안전하다.
6. 각 중복 fetch의 실제 지연은 재지 않았다. SSR 호출이 `blog-api.`(Cloudflare 경유)로 가면 익명 GET은 edge HIT라 싸다. signed-in 요청은 Express까지 간다.
7. `React.cache` 범위가 `generateMetadata`와 layout, page를 한 요청으로 묶는지 이 버전에서 확인하지 못했다. 묶지 않으면 C2의 `[slug]` 줄은 3번이고 C4의 영향은 M이다.
- main session이 `curl`로 잴 수 있는 것: 3(load-more `cf-cache-status`), 4(D1 재현).
