# Phase CC 프로젝트 끝 리뷰: system-architect

- 범위: `.claude/CLAUDE.md` Workflow step 4, architect 몫이다.
- 질문: 만든 것이 설계와 스키마 계약(contract)에 맞는가. 무엇을 되돌리나.
- 기준: main ≥ `8b8dd39`. 앱 트리 = 운영 `181e6ed`.
- 읽은 것: `cc.design.md` §7.2, §8.3, §18, §19, `decisions.plan.md` #82–#112, `cc.report.md`, 아래 코드.
- 방법: 코드 읽기와 grep만 했다. 실행, 측정, git은 하지 않았다.

## 0. 결론

| 질문 | 답 |
| --- | --- |
| MVP1로 돌아갈 것 | **없다.** 계약 변경은 오너 결정이다(#109, #111). API가 스키마에 안 맞아서가 아니다 |
| 고칠 것 (다음 작은 단위) | (a) `[handle]` 빠짐 경로(fall-through) 500 위험 닫기. (b) 잎(leaf)의 빈 `catch {}`에 `unstable_rethrow`. (c) 설계 문서 정정 |
| 과제 전제 정정 | `HoverPrefetchLink`는 죽은 코드가 아니다. 사용처 6곳이다(#70 c, #90). `x_` 파일은 gitignore 패턴에 걸린다. 추적 여부는 `git ls-files`로 확인한다 |

```
요청 ─► proxy.ts ─┬─ 점 경로(dotted)  ─► PUBLIC_PATHS면 통과, 아니면 404
                  ├─ isUnknownPath   ─► 404 (첫 segment가 KNOWN 목록 밖)
                  ├─ gateNotFound    ─► Express 존재 검사 1회 ─► missing면 404
                  └─ 통과 ───────────► static shell ─► Suspense 잎 (데이터 매번 새로 fetch)
                                         │
             matcher 밖 (favicon/) ──────┘  KNOWN 첫 segment + 짧은 경로 ─► [handle] layout notFound() (§2 R1)
```

## 1. 설계 대 코드 차이 (drift)

| # | 설계가 말하는 것 | 코드가 하는 것 | 판정 |
| --- | --- | --- | --- |
| D1 | §18.1 그림: 로그인 RSC 이동은 검사 안 함 | 로그인 RSC 클릭도 검사한다. 로그인 prefetch만 건너뛴다 (`proxy.ts` 103–110행) | 문서화. §18.6 1번은 #103을 이미 적었다. 낡은 곳은 §18.1 그림과 §18.2 Q3 표 "로그인 RSC 이동" 행뿐이다 |
| D2 | §18.5 비용 손잡이: 익명 prefetch도 검사 | 익명 prefetch는 검사한다. 로그인 prefetch는 건너뛴다 | 유지. #106과 맞다 |
| D3 | §18.4 5번: `shouldCheck({signedIn,isRsc})` 함수 | 함수가 없다. `gateNotFound` 안에 줄로 들어 있다 | 유지. 동작 차이 없음 |
| D4 | §18.4 4번: 잎 gate 주석 "proxy가 404를 정한다. 잎은 예비 방어" | `UserGate`, `PostGate`, `ProjectGate`, `(rail)/layout.tsx`, `projects/[project]/layout.tsx`, `[slug]/layout.tsx` 주석은 "status stays 200"만 말한다. proxy 언급이 없다 | **고침** (주석만). 읽는 사람이 soft 404가 운영 동작이라고 오해한다 |
| D5 | §18.4 10번: `OwnerOnly` 주석 "로그인 RSC 이동의 예비 방어" | 주석은 그대로다. #103 뒤로는 로그인 prefetch와 fail-open의 예비 방어다 | 고침 (주석 한 줄) |
| D6 | §7.2 캐시 지도 `'use cache'` 칸: TagCloud, tree, projects | 앱에 `'use cache'`, `cacheTag`, `cacheLife`가 0건이다 | 문서화. #111이 U5를 뺐다. §7.2에 "대체됨" 표시 필요 |
| D7 | §7.2 sitemap, OG 행: 데이터 fetch만 `'use cache'` (days) | `sitemap.ts`, `opengraph-image.tsx`에 segment `revalidate = 86400` export가 남았다. `'use cache'`는 없다 | 유지 + 확인. flag 아래 이 export가 실제로 듣는지 운영 `Cache-Control`로 한 번 본다. 엣지가 1일 저장해서 영향은 작다 |
| D8 | §8.3 무효화 순서: `/api/revalidate` 먼저, purge 다음 | `deploy/*.sh`에 `revalidate` 0건. `/api/revalidate` route 없음 | 문서화. #109가 대체했다. §8.3에 표시 필요 |
| D9 | §18.4: gate 4종(user, project, post, ownerOnly) | 4종에 더해 `isUnknownPath`, `isDottedPath`, `PUBLIC_PATHS`, `KNOWN_TOP_LEVEL_SEGMENTS`가 있다 (attempt 1 수정 A2) | 문서화. 이 장치는 README와 진단 문서에만 있다. `cc.design.md`에 §18 보충이 필요하다 |
| D10 | §7.3 smoke 14번: `/me/saved` 익명 = 로그인 redirect | route가 없다(#89). 기준선은 `smoke-0ac938c.txt`다(#101) | 문서화. N14 정정이 §7.3 표에 아직 없다 |
| D11 | §18.4: `[slug]` sample은 실제 공개 글이어야 한다 | `CC_SAMPLE_SLUG`, `CC_SAMPLE_PROJECT` 기본값이 `cc-sample-slug`, `cc-sample-project`다. workflow와 deploy 파일에 설정이 0건이다 | 확인. 운영 env에 없으면 shell은 없는 경로로 prerender된다. 실제 글은 모두 runtime prerender 길로 간다. 동작은 맞다. §18.4 문장과 다르다 |
| D12 | `cc.report.md` U6: handler를 `app/api/x_revalidate/x_route.ts`로 보관 | main 디스크에 없다. 이름이 `.gitignore` 44행 `x_*`에 걸린다. 추적 여부는 main session이 `git ls-files` 1회로 확인한다 | 문서화. 복구 경로 = branch `cc-u5`의 되돌리기 전 커밋 기록 |
| D13 | `cc-build.yml` 머리 주석: 저장소 config는 flag off | config가 이미 flag on이다. 입력 기본값 `true`면 sed가 같은 키를 한 번 더 넣는다 | 고침 또는 은퇴. 중복 키로 빌드가 깨질 수 있다 |

## 2. 남는 위험: `'use cache'` 없이 cacheComponents 운영

| # | 위험 | 근거 | 심각도 |
| --- | --- | --- | --- |
| R1 | **`[handle]` 빠짐 경로가 500 사슬을 다시 열 수 있다.** `HandleLayout`은 아직 Suspense 밖에서 `notFound()`를 던진다. attempt 1의 원인 2번이다. proxy만 막는다. 빈틈 둘: (a) matcher가 `favicon/`을 건너뛴다. `/favicon/<없는 파일>`이 middleware 없이 `[handle]/[slug]`에 닿는다. (b) `isUnknownPath`는 KNOWN 첫 segment면 깊이를 보지 않는다. 익명 노출 = `/api/x`, `/tags`. `/admin`, `/onboarding/x`는 익명이면 `auth.protect()`가 sign-in redirect를 낸다(`proxy.ts` 154–156행). 그래서 그 둘은 로그인 때만 노출된다 | `proxy.ts` 192행, `notFoundGate.ts` 66행, `cc.report.md` 389–392행. `cc-standalone-check.yml` 79–83행은 이 경로를 시험하지 않는다 | **중간~높음 (추정, 미시험)**. 같은 기전이다. `/api/*`는 scanner가 많이 친다. 5xx는 엣지 BYPASS라 매번 오리진이다 |
| R2 | **잎의 빈 `catch {}`가 Next 신호를 다시 삼킨다.** fetcher에는 `unstable_rethrow`를 넣었다(#108). 그러나 부르는 쪽이 한 번 더 잡고 대체 화면을 낸다 | 아래 표 | 중간 (현재 화면 영향 없음, R1과 겹치면 500 원인) |
| R3 | **모든 오리진 렌더가 데이터를 새로 받는다.** `http.server.ts`가 `no-store`다. 캐시 층은 엣지(익명 1일)와 React `cache()`(요청 안)뿐이다 | §7.2 D6, #111 | 낮음 (익명). 중간 (로그인: 모든 요청이 오리진과 Express에 간다) |
| R4 | **proxy gate가 렌더 앞에 Express 왕복을 직렬로 더한다.** §18.2 Q3은 "기다림은 늘지 않는다"고 썼다. flag 아래에서는 맞지 않는다. 예전 layout gate는 page와 `cache()`로 fetch를 나눴다. 이제는 proxy 1회 뒤에 잎이 같은 글을 다시 받는다. 최악은 시간 초과 1500 ms다 | `existence.proxy.ts` 13행, §18.2 Q3, #102 s4 +34, s5 +95 ms | 중간. 비용이 측정되지 않았다(R5) |
| R5 | **gate 비용이 측정되지 않았다.** §18.3 L안 재개 조건(gate `ms` p50 ≥ 사용자 page MISS TTFB의 20 %)과 §18.5 10번(1일 gate 로그)의 결과 파일이 리뷰 폴더에 없다 | `deploy/traffic/review/cc/`에 `message="gate"` 결과 0건 | 중간 (판단 근거 없음) |
| R6 | **fail-open soft 404.** API 오류나 시간 초과면 통과한다. 모르는 page면 잎이 200 + noindex를 낸다. 익명이면 엣지가 1일 저장한다 | §18.6 3번, `proxy.ts` 95–96행 | 낮음 (드묾, 잘못된 404보다 낫다) |
| R7 | **글 gate가 handle을 보지 않는다.** `/@<아무나>/<실제 slug>`가 200이다. 중복 내용이다. flag 아래에서는 경로마다 runtime prerender shell이 생길 수 있다. scanner가 VM 디스크(`.next`)를 키울 수 있다 | §18.6 4번, `existence.proxy.ts` 20행 | 낮음~중간. 고치기 쉽다: 응답의 글 작성자와 handle을 비교한다 (필드 이름은 확인 필요) |
| R8 | **`/log/...` page의 `notFound()`, `redirect()`는 `loading.tsx` 아래다.** 그래서 200 not-found 또는 client redirect가 된다. proxy gate 밖이다 | `app/log/[username]/[logId]/page.tsx` 36–55행, `loading.tsx` 있음 | 낮음. #89 범위(사용자, 프로젝트, 글) 밖이다. U4 전에도 같았다고 본다(추정) |

### 2.1 빈 `catch` 자리 (R2)

- 규칙: `unstable_rethrow`는 신호가 지나는 모든 catch의 첫 줄에 둔다. fetcher 한 곳만으로는 부족하다.
- 위험 순서: shell prerender 안에서 도는 잎(`auth()` 없음)이 먼저다. `auth()` 잎은 dynamic hole이라 낮다.

| 자리 | 감싸는 호출 | 등급 |
| --- | --- | --- |
| `components/rail/TagCloud.server.tsx` 34행 | `getPopularTags`, `getUserPopularTags` (rethrow 있음, 여기서 다시 삼킴) | 높음. attempt 1 원인 3번 |
| `components/rail/UserProfileCard.server.tsx` 20행 | `getUserProfile` | 중간 |
| `components/rail/mobile/MobileContextHeader.server.tsx` 20행 | `getUserProfile` | 중간 |
| `components/blog/filter/getFilterItems.server.ts` 35, 50행 | `getCategoriesByUsername`, `getUserPopularTags` | 중간 |
| `components/blog/comments/Comments.server.tsx` 24행 | `getCommentsFirstPage` (isomorphic, fetcher에 rethrow 없음) | 중간 |
| `app/(shell)/[handle]/[slug]/page.tsx` 71행 `.catch(...)` | `getProjectsTree` | 중간 |
| `app/(shell)/[handle]/[slug]/page.tsx` 61행 (generateMetadata) | `getPostBySlug`. `notFound()`도 삼킨다 | 낮음 (proxy가 먼저 404) |
| `app/(shell)/[handle]/(rail)/posts/page.tsx` 46행 (generateMetadata) | `getUserProfile` | 낮음 |
| `components/projects/PostJsonLd.server.tsx` 20, 48행 | `auth()`, `getPostBySlug` | 낮음 |
| `app/(shell)/[handle]/[slug]/opengraph-image.tsx` 49행 | `getPostBySlug`. 없는 글도 일반 카드 200 | 낮음 |
| `app/log/page.tsx` 16행, `app/log/[username]/page.tsx` 40행 | log stream (isomorphic) | 낮음 |
| `auth()` 감싸기: `PostGate` 15행, `PostContentCard` 41행, `getPosts.fetch.server.ts` 54행. 개발자 목록 밖: `PostContentToc` 17행, `CategorySidebarWrapper` 33행, `ProjectsTreeWrapper` 19행 | `auth()` 만 감싼다 (fetch는 catch 밖) | 낮음 |

## 3. 뺀 U5, U6, b안이 남긴 코드

| 대상 | 상태 | 권고 |
| --- | --- | --- |
| `components/ui/HoverPrefetchLink.client.tsx` | 살아 있다. 6곳: ProjectPostList, ProjectCardGrid, RecentPostCard, PostContentHeader, RecentVisited, RecentPostsWidget | 유지. #70 c, #90 정책이다. 과제 전제("카드에만")는 틀렸다 |
| b안 (메뉴 hover 전용 prefetch) | main에 없다. `PrimaryNav`는 보통 `Link`다. branch `cc-u4-t`에만 있다 | main 코드 정리 없음. branch 정리는 오너 |
| U5 `'use cache'`, U6 `/api/revalidate`, `updateTag` | main에 0건. branch `cc-u5`에만 있다 | 유지 (#111 보관). `x_MarkdownEditor.client.tsx` 243행 주석이 `updateTag`를 말하지만 gitignore 파일이다 |
| `x_layout.tsx` ×2 (`(rail)/projects`, `(rail)/saved`), `app/actions/x_post.action.ts`, `x_posts-load-more.route.ts`, `mocks/x_projects/`, `x_.next_*` 빌드 폴더 | 이름이 `.gitignore` `x_*`와 `tsconfig` exclude에 걸린다. 추적 여부는 `git ls-files '*x_*'` 1회로 확인한다 (이 리뷰는 git을 쓰지 않았다) | 오너가 손으로 지운다(soft-delete 규칙). 빌드 영향 없음 |
| `CC_SAMPLE_SLUG`, `CC_SAMPLE_PROJECT`, `generateStaticParams` 3곳 | flag가 요구한다. 살아 있다 | 유지. 값은 D11 확인 |
| `KNOWN_TOP_LEVEL_SEGMENTS`, `gen-public-paths.mjs`, `cc-standalone-check.yml` | 살아 있는 가드다 | 유지. R1 경로를 시험 표에 더한다 |
| `.github/workflows/cc-build.yml` | 목적(flag 미리보기)이 끝났다. 기본값으로 돌리면 중복 키 | 은퇴 권고 (`x_` 이름 변경 또는 기본값 `false`) |

## 4. 되돌릴 것

- **MVP1로 돌아갈 것: 없다.**
  - 사다리 시험: API가 스키마를 바꿔야 해서 MVP1로 가는 경우가 아니다.
  - U5, U6의 계약(§7.2 tag 이름, §8.3 요청 모양)은 오너가 뺐다(#109, #111).
  - 운영 경로는 §18 P안 계약(gate 4종, `NOT_FOUND_PATH`, fail-open)과 맞는다.
- **운영 되돌림: 필요 없다.** 단 R1이 확인되면 수정 우선이다.
- **pm에게 넘길 설계 단위 (크기와 순서만):**

| 순서 | 단위 | 크기 | 닫는 것 | kill / 확인 |
| --- | --- | --- | --- | --- |
| 1 | R1 확인 (main session). 익명 GET 1회씩: `/api/x`, `/tags`, `/favicon/x`. 로그인 GET 1회씩: `/admin`, `/onboarding/x` | XS | R1이 실제인지 | 500이면 2번이 급하다 |
| 2 | R1 수정. 안 a: `isUnknownPath`가 "page 있는 KNOWN 경로"만 통과시킨다. 안 b: `HandleLayout`의 `notFound()`를 다른 gate처럼 잎으로 옮긴다. `cc-standalone-check.yml` 79행에 1번 경로를 더한다 | S | R1 | standalone 검사에서 익명 3개 404 |
| 3 | 2.1 표 높음, 중간 줄에 `unstable_rethrow` 첫 줄. README 138행 규칙을 "모든 서버 catch"로 넓힌다 | S | R2 | `blog-web` ERROR 새 줄 0, smoke 불변 |
| 4 | 문서 정정: D1, D4, D5 주석, D6, D8 "대체됨" 표시, D9 §18 보충, D10, D12, §18.2 Q3 "기다림 불변" 정정(R4) | S | §1 | 코드 변경 없음 |
| 5 | (선택) R7: 글 gate가 작성자와 handle 비교. R5: gate 로그 1일 집계 | S | R5, R7 | 오너가 고른다 |
