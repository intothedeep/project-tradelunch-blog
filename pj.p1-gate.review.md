# Phase PJ P1 gate review (M3 끝, reviewer 단독)

- 날짜: 2026-10-13 (운영 측정 원본은 2026-10-14 파일 포함)
- 대상: `00.plan.md` Phase PJ M1–M3 exit, `00.tasks.md` Phase PJ P1 행 (PJ-1-01…25, 11b, D1, PJ-2-01/02/04)
- 근거 파일: `projects.report.md`, `deploy/projects/mvp1-local-run-2026-10-13.txt`, `deploy/projects/mvp2-prod-2026-10-14.txt`
- 이 검토가 직접 보낸 요청: 운영 GET 약 15회 (읽기만). 정적 검사 4종 로컬 실행.
- 코드 범위: `a360d8c^..HEAD` (Phase PJ 첫 커밋부터 `d7228ea`까지).

## 1. 판정 요약

**판정: ISSUE.** M3가 아직 닫히지 않았다. M1 exit 한 절이 시연되지 않았다. 코드와 정적 검사는 모두 통과한다.

```
M1 exit  [부분]  Express 400 시연 없음 (PJ-1-03 AC2–AC4)        → 오너 token으로 main session 실행
M2 exit  [PASS]  운영 200, 키 = mock, 308 3종, HIT
M3 exit  [부분]  PJ-1-23 미실행, MVP3 보고 없음, `/blog/@` 주석 3건, 308 2회째 EXPIRED
사다리   L1 PASS · L2 PASS · L3 PASS · L4 ISSUE (M1 미닫힘 상태로 M2 열림)
계층     H1 ISSUE (문서 상태) · H2 PASS
```

| 분류 | 건수 | 경로 |
| --- | --- | --- |
| Must-fix | 4 | §8 |
| Nice-to-fix | 9 | §9 |

이 gate는 M3의 `cycle 1/2`로 센다. 카운터 수정은 `recover` step 3의 몫이다. 이 검토는 `00.plan.md`를 고치지 않았다.

## 2. 빌드와 정적 검사

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| `pnpm --filter dashboard_client_web check-types` | PASS | tsc 출력 0줄 |
| `pnpm --filter dashboard_client_web lint` | PASS | eslint `--max-warnings 0` 출력 0줄 |
| `pnpm --filter dashboard_server check-types` | PASS | tsc 출력 0줄 |
| `uv run ruff check .` (blog_agent) | PASS | `All checks passed!` |
| `uv run mypy agents configs db utils` | PASS | `Success: no issues found in 41 source files` |
| 작업 트리 | PASS | `git status`: `next-env.d.ts`만 수정, PJ 파일 미커밋 없음 |

`next build`, dev 서버, 테스트, 배포는 실행하지 않았다 (지시 범위).

## 3. P1 행별 AC

### M1

| 행 | 판정 | 근거 |
| --- | --- | --- |
| PJ-1-01 | PASS | `packages/types/src/routes.ts:6,16,18` 세 이름. 배열 원소 6개, 순서 일치. `project.ts:5,10,21` 인터페이스 3개, `project_id/post_id/id/seq` 모두 `string`. `index.ts:14-15` export |
| PJ-1-02 | PASS | `01.status.md:61` "0 rows, closed" |
| PJ-1-03 | 부분 (AC1 PASS, AC2–AC4 미실행) | `posts.write.ts:98` 생성, `:171` 수정에서 `isReservedSlug` → `sendReservedSlug`. 제목에서 만든 slug(`:95`)도 `:98`에서 같이 검사. 400 시연은 어느 원본에도 없다 (`projects.report.md` MVP1 단계 8 "skipped", MVP2 "남은 것") |
| PJ-1-04 | PASS | `post.py:152,218`, `uploading_agent.py:87`. `configs/routes.py` 6개 이름. AC2 `ValueError: slug is reserved: Posts` (mvp1 원본 끝). AC3 ruff 0. 주의: `configs/__init__.py:17-20`이 database, storage 설정을 import한다. AC2 전제가 깨졌는데 실행됐다. 결과는 맞다 |
| PJ-1-05 | PASS | `[handle]/page.tsx:11` `permanentRedirect`, `layout.tsx:14` `notFound`. 운영: `/@taeklim` 308 → `/@taeklim/posts`, `/%40taeklim` 같음, `/no-at-xyz` 404 (mvp2 원본 "web redirects") |
| PJ-1-06 | PASS (AC3 제목 비교는 불가) | 4개 파일. `force-dynamic` 0. `posts/page.tsx:33` canonical `/@${author}/posts`. 운영 `/@taeklim/posts` 200, canonical `https://my.prettylog.com/@taeklim/posts` (이 검토 GET). 옛 `/blog/@taeklim`은 이제 308이라 "첫 3개 제목 비교"는 할 수 없다 |
| PJ-1-07 | PASS | 5개 파일. `rg "/blog/@" app/[handle]/` 0. 운영 `/@taeklim/rust-config` 200, canonical `.../@taeklim/rust-config`. `/opengraph-image` 200 `image/png` (이 검토 GET). `/@taeklim/posts`는 목록을 연다 (200, 카드 목록) |
| PJ-1-08 | PASS | `next.config.ts:66-124` `permanent: true` 12건 (AC 기준 ≥3), `source: '/blog'` 1건 (#81). 운영 308 7종 + `?tags=rust` → `location: /@taeklim/posts?tags=rust` (이 검토 GET). 308에 `set-cookie` 0 |
| PJ-1-09 | PASS | `utils/routes.ts:7,11,15,19` 4개. `useNavLinks.hook.ts:47` `nav.projects`, `/blog/@` 0. en/ko 키 수 8 = 8. `en/blog.json:14,88` 2줄 |
| PJ-1-10 | PASS (PJ-1-22로 은퇴) | mock은 `mocks/x_projects/{cards,posts}.json`으로 이동. `PROJECTS_DATA_SOURCE` 0건 (`x_` 제외). `NEXT_PUBLIC_PROJECTS` 0 |
| PJ-1-11 | PASS (행 메모대로) | `[handle]/components/` 9개 파일 (+ `x_ProjectPostList.server.tsx`). `CategorySidebar` 히트는 `posts/page.tsx:85` (PJ-1-06 코드)만. `RecentVisited` 히트는 `showRecentVisited` prop만. `ProjectsRail.server.tsx`에 `auth()` 0 |
| PJ-1-11b | PASS | prop 정의 `LeftRail.client.tsx:28,33`, `LeftRailContainer.server.tsx:15,17`. `false` 전달 `projects/layout.tsx:21`, `[slug]/layout.tsx:31`. 운영 HTML: CNN 글의 "Recently viewed" 히트 1건은 i18n 메시지 blob 안이다 (렌더 0). `rust-config`는 blob 1 + 렌더 1 (이 검토 GET) |
| PJ-1-12 | PASS | route 3개 + loading 2개. `force-dynamic` 0, page/layout 맨 위 `auth()` 0 (잎 `ProjectsTreeWrapper.server.tsx:17`, `PostJsonLd.server.tsx:18`만). `<Link` 0, 대신 `HoverPrefetchLink` (`prefetch={false}` 기본, hover 때만 켬 = #70 c). 하드코딩 영문 0. `getTranslations('blog.projects')` 5파일 |
| PJ-1-13 | PASS (AC2 구조 순서는 저장 근거 없음) | `[slug]/layout.tsx:24-27`, `page.tsx:71-74` `projectOfSlug`. 분기 증거 = 11b의 0/1 분리. TOC 위, tree 아래 순서는 SSR HTML에 TOC 제목이 없어 curl로 못 본다. MVP1 열린 문제 4의 원인: 일반 글의 `UserContextRail` 카테고리 tree에도 `projects` 카테고리 노드가 있다 (`rust.html`에 CNN slug 1건). 버그 아님 |
| PJ-1-24 | PASS | `source: '/blog'` 1. `HOME_FEED_AUTHOR` `(feed)/`, `[handle]/posts/` 0. 운영 `/blog` 308 → `/`, `/@taeklim/posts` canonical 자기 자신 |
| PJ-1-14 | PASS | `projects.report.md` MVP1 8단계, AC 대응 표. 원본 `mvp1-local-run-2026-10-13.txt`. PJ-1-03 AC2–4는 skipped로 기록 |

### M2

| 행 | 판정 | 근거 |
| --- | --- | --- |
| PJ-1-15 | PASS | `posts.user-projects.ts:19-21,123,154-155,170,205-206`. `parseInt|Number(` 0. `posts.user-categories.ts` PJ 기간 커밋 0. `posts.ts:12` 등록 |
| PJ-1-16 | PASS (AC4 valid-token 변형 미측정) | 이 검토 GET: `success true`, 카드 1, 키 `[overview, post_count, project, project_id]`, overview 키 `[post_id, slug, stored_uri, title]` = mock 키. 순서 `[[0,"283"]…[7,"290"]]`. `no-such-user` 404, `no-such-project` 404, `darkowlrising` → `200 {"projects":[]}`. `cache-control: public, s-maxage=86400`. 잘못된 token은 `public` (설계대로: `optionalAuth`가 `req.auth`를 세우지 않음), 엣지 `DYNAMIC` (4-a bypass 동작). 유효 token의 `private, no-store`는 미측정 |
| PJ-1-17 | PASS | `getProjects.api.ts:15`, `getProjectPosts.api.ts:21`. `project.ts` 커밋 `a360d8c` 1개만 |
| PJ-1-18 | PASS | `rg "/blog/@" deploy/traffic/load .github/workflows` 0. traffic-check 0 FAIL (mvp2 원본 끝) |
| PJ-1-19 | PASS | mvp2 원본: 8페이지 200, `[MOCK]` 0, 308 9종, HIT. `projects.report.md` MVP2 절 + MVP1 대비 표 |
| PJ-2-01 | PASS | 운영 `/about`, `/resume` 308 → `/@taeklim/...`, `/@taeklim/about` 200. `/@someone/about` 404는 mvp1 원본 |
| PJ-2-02 | PASS (AC2 브라우저 확인은 오너) | `/@taeklim/saved` 307 → sign-in (mvp1), `robots.txt` `/@*/saved` 1 (이 검토 GET) |
| PJ-2-04 | PASS | `/@taeklim/saved` 2회째 `DYNAMIC` (mvp2 원본) |

### M3

| 행 | 판정 | 근거 |
| --- | --- | --- |
| PJ-1-20 | ISSUE (문자 그대로) | `rg -c "/blog/@" apps/ --glob '!**/*.test.*' --glob '!**/x_*'` → `next.config.ts` 2, `getPost.api.ts` 1. 셋 다 주석 (`next.config.ts:60,62`, `getPost.api.ts:40`). 링크는 0. sitemap은 `postPath` 사용 (`sitemap.ts:67`). Python `published_url` `/@{username}/{slug}` (`uploading_agent.py:486,913`) |
| PJ-1-21 | PASS | #70 파일 diff의 `prefetch` 변경은 `prefetch={false}` 추가 3건만, 제거 0 (`RecentPostCard.client.tsx`, `PostContentCard.server.tsx`). 아이콘 `iconKey: 'projects'` (`useNavLinks.hook.ts:48`), `PrimaryNav.client.tsx` 매핑 |
| PJ-1-22 | PASS | `mocks/x_projects/` 존재. `PROJECTS_DATA_SOURCE|mocks/projects` 0 (`x_` 제외). fetcher 두 개 모두 real 경로만 |
| PJ-1-23 | **미실행 (`[ ]`)** | 최종 배포 없음. 운영은 web `9f7c5fe`. 그 뒤 커밋 `d7228ea` (mock 은퇴) 미배포. AC1 후반 실패: `/blog/@taeklim/rust-config` 2회 모두 `cf-cache-status: EXPIRED`, 308 응답에 `cache-control` 헤더 없음 (이 검토 GET). AC1 전반 `/@taeklim/projects` 2회째 `HIT` 통과. AC2 sitemap `/blog/@` 0, `/@taeklim/` 23 통과. AC3 traffic-check는 10-14 값만. AC4 "MVP3" 절과 맨 위 요약 줄 없음 |
| PJ-1-25 | PASS (AC1 문서 1건, AC2 버튼 표시는 PJ-1-23 뒤) | `app/blog`, `app/about`, `app/resume` 없음. `@/app/blog/` 히트는 `components/blog/error.segments.vs.components.md:19,119` (문서). 코드 0. 좋아요, 저장, 댓글 버튼 표시는 PJ-1-23 배포 뒤 확인 항목 |
| PJ-1-D1 | 보류, gate 밖 | 행에 "P1 gate에 들지 않는다". 이 판정에 영향 없음 |

### 미완 행이 gate를 막는가

| 행 | 막는가 | 이유 |
| --- | --- | --- |
| PJ-1-03 AC2–AC4 | 막는다 | M1 exit 문장에 "Express 400으로 멈춤"이 있다. 테스트 러너가 없으므로 고의 파손이 유일한 검증이다. 코드(`posts.write.ts:98,171`)는 맞아 보이지만 시연이 없다. exit 줄 완화는 오너만 할 수 있다 (`rules/core.md` Decision hierarchy) |
| PJ-1-23 | 막는다 | M3의 마지막 행이다. "코드만 만든 phase는 끝이 아니다" (`.claude/CLAUDE.md` System build phasing). MVP3 보고도 없다 |
| PJ-1-D1 | 막지 않는다 | 행이 스스로 gate 밖이라고 적었다 |

## 4. Exit 기준 M1–M3

| 기준 | 판정 | 근거 |
| --- | --- | --- |
| M1: mock 순환 1회 (메뉴 → 카드 `[MOCK]` → 목록 → real 상세) | PASS | mvp1 원본: 카드 2개 `[MOCK]`, 목록 8개, 상세 200, 메뉴 "Projects" |
| M1: `/blog/@taeklim` 308 | PASS | mvp1 원본, mvp2 원본 |
| M1: 예약 slug가 Express 400으로 멈춤 | **ISSUE** | 시연 없음 (§3 PJ-1-03) |
| M1: 예약 slug가 Python `ValueError`로 멈춤 | PASS | mvp1 원본 마지막 줄 |
| M1: TOC 위, tree 아래, 현재 글 강조 | 저장 근거 없음 | 보고에 "pending". SSR HTML에 TOC 없음. 오너 눈 확인 항목. 단독으로는 막지 않는다 |
| M1: 보고가 `projects.report.md` "MVP1"에 있음 | PASS | 8단계 + AC 표 |
| M2: Express 경로 2개 운영 200, 응답 키 = mock JSON | PASS | §3 PJ-1-16. 카드 키, overview 키, 글 키 모두 `mocks/x_projects/*.json`과 같다 |
| M2: 웹 배포 뒤 G1 measure (세 경로 200, 순서 = #73) | PASS | mvp2 원본 web pages 3곳 200, API 순서 priority 0→7 |
| M2: 옛 URL 3종 308 + `location` 새 URL | PASS | mvp2 원본 web redirects |
| M3: `/blog/@` 문자열 0 (테스트 제외) | **ISSUE (주석 3건)** | §3 PJ-1-20 |
| M3: sitemap 글 URL 모두 `/@u/<slug>` | PASS | 이 검토 GET: `/blog/@` 0, `/@taeklim/` 23, 다른 작성자 `/@darkowlrising/` 3. 비글 URL `/about`, `/resume`는 §9 |
| M3: mock fetcher 경로 `x_` 은퇴 | PASS (코드) · 미배포 | `mocks/x_projects/`, fetcher real만. 운영 배포 전 (`d7228ea` 미배포) |
| M3: purge 뒤 `/@taeklim/projects` 2회째 HIT | PASS (10-14 배포 기준) | mvp2 원본 + 이 검토 GET HIT. 최종 배포 뒤 재측정은 PJ-1-23 |

## 5. MVP 사다리 L1–L4

| 불변식 | 판정 | 근거 |
| --- | --- | --- |
| L1 스키마는 하나의 계약 | PASS | 마이그레이션 `a360d8c^..HEAD` 변경 0 (최신 `0024_log_social.sql`, PJ 전). mock 키 집합 = 운영 API 키 집합 (카드 4, overview 4, 글 10, `project` 2). `id`, `seq` 운영 타입 `string`. `TProject*` 타입 커밋 1개 |
| L2 mock에서 흐름 시연 전 파이프라인 금지 | PASS | mock 순환 `7f15669` + 실행 10-13 (mvp1 원본) 뒤 real API `ab4c3c0`. Express 경로 2개는 MVP1에서 mock으로 같은 화면이 돌았다 |
| L3 mock은 분명하고 격리 | PASS | `mocks/x_projects/` 전용 폴더, 제목 `[MOCK] `, id `999…` 문자열. 코드에서 읽는 곳 0. 운영 HTML `[MOCK]` 0 |
| L4 이전 phase exit 닫힌 뒤 다음 phase | **ISSUE** | M1 exit "Express 400" 미시연 상태로 M2(`ab4c3c0`)가 열렸다. M3도 PJ-1-23 미실행 상태로 gate가 열렸다. 완화 사유: Express 400은 배포 뒤에만 잴 수 있고 로컬 실행이 금지다 (`00.tasks.md` PJ 머리말). 그래도 exit 줄은 그대로다 |

L4 경로: `agents/reviewer.md`는 사다리 ISSUE를 `system-architect`로 보낸다. 이 건은 그 경로와 다르게 main session으로 보낸다. 이유: 스키마 결함이 아니고 M1으로 되돌릴 조각이 없다. 필요한 것은 측정 1회(§8 1번)와 배포 1회(§8 2번)다. main session이 이 판단을 뒤집으면 `system-architect`로 보낸다.

## 6. 계층 검사 H1–H2

| 검사 | 판정 | 근거 |
| --- | --- | --- |
| H1 plan mission block | PASS | `00.plan.md:308-319`. Mission, Vision 오너 승인 #79. S1 → G1. M1–M3 `cycle 0/2; recovery 0/2`. `budget:` 없음 |
| H1 G1 날짜 | **ISSUE** | `00.plan.md:312` G1 "DRAFT, 오너 승인 대기", `by <owner date>` 자리 비어 있음. 숫자 goal은 날짜가 있어야 한다 (`rules/docs.md` §0.1) |
| H1 design doc mission block | **ISSUE** | `projects.design.md` §0 "`00.plan.md`에 ... 아직 없다". 지금은 있다. 인용이 없다 |
| H1 task → M 태그 | PASS | P1 모든 행 `→ M1/M2/M3`. PJ-1-D1만 `→ (없음)` (DEFERRED, 오너가 phase를 정함) |
| H1 stub 상태 | **ISSUE** | `00.plan.md:331` "PLANNED, 0 done", `00.tasks.md:665` "0 done". 실제 ticked 21행. `00.plan.md:350` "#78 오너 선택 대기" (이미 A 선택). stub이 진실이어야 한다 (`rules/docs.md` §1) |
| H1 design rev | nice | `projects.design.md`에 #80, #81 (about/resume/saved P1 이동, `/blog` 제거) 반영 없음 |
| H2 결정 기록 | PASS | #71–#81 모두 Why에 G1/S1/Vision. #78 owner Update. HoverPrefetchLink = #70 c. `/blog` → `/` = #81. 기록 없는 옵션 선택을 찾지 못했다. 다만 Constraints `prefetch={false}` 문구와 hover 구현의 표현 차이는 pm이 맞출 것 |

H1 경로: `product-manager`.

## 7. 회귀 점검

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| 옛 `/blog/@` 링크 (web, test/md 제외) | PASS (코드) | 히트 3건 모두 주석 (§3 PJ-1-20) |
| 예약 slug 목록 TS = Python | PASS | `routes.ts:6-13`, `routes.py` 6개, 같은 순서. 둘 다 trim + lower |
| i18n en/ko 키 동일 | PASS | `messages/en/*` 전 파일 `jq paths` diff 0 |
| Jotai Provider | PASS | `app/layout.tsx:7,141-163` `JotaiProvider` (`fd0e7a5` per-request store) |
| BIGINT 문자열 | PASS | `Number(|parseInt` 0 (`app/[handle]`, `posts.user-projects.ts`). SQL `::text` |
| hard DELETE | PASS | `posts.user-projects.ts`에 `DELETE` 0, `deleted_at IS NULL` 7곳 |
| 새 `<Link>` prefetch | PASS | PJ diff의 `+<Link` 3건은 모두 옛 `/blog/@` 링크의 재작성 (`-` 쌍 있음). 메뉴 링크 prefetch는 #70이 끄지 않기로 함. 카드와 목록은 `HoverPrefetchLink`. tree는 `router.push`. `ResumeTOC`는 외부 `target="_blank"` |
| sitemap | nice | `/about`, `/resume` 2건이 308 대상이다 (§9) |

## 8. Must-fix

| # | 항목 | 분류 | 경로 | 닫는 조건 |
| --- | --- | --- | --- | --- |
| 1 | PJ-1-03 AC2–AC4: Express 예약 slug 400 고의 파손 | 측정 미완 (M1 exit) | main session + 오너 token | `POST slug=Posts` 400, 제목 `Projects` 400, DB 0행, `pj-guard-check` 201. 결과를 `projects.report.md`에 적는다 |
| 2 | PJ-1-23: 최종 배포 (`d7228ea` 포함) + purge + 재측정 | 배포 미완 (M3 exit) | USER deploy + main session | AC1–AC3 통과, `projects.report.md` "MVP3" 절 + 맨 위 요약 줄. PJ-1-25 AC2 버튼 표시(좋아요, 저장, 댓글)도 같은 배포 뒤 확인 |
| 3 | 308 응답이 엣지에 안 남는다: `cache-control` 없음, 2회 `EXPIRED` | implementation | `developer` (방법 선택이 필요하면 `system-architect`) | `/blog/@taeklim/rust-config` 2회째 `HIT` (PJ-1-23 AC1). `next.config.ts:62` 주석 "Cloudflare can store it"은 지금 사실이 아니다 |
| 4 | M3 exit "`/blog/@` 문자열 0": 주석 3건 | implementation (문자 그대로) 또는 오너 결정 | `developer`가 주석 3줄 고침, 또는 오너가 exit 줄을 "링크 0"으로 바꿈 | `rg -c "/blog/@" apps/ --glob '!**/*.test.*' --glob '!**/x_*'` → 출력 없음 |

4번은 기능에 영향이 없다. exit 줄을 그대로 읽어 올렸다. 오너가 줄을 바꾸면 닫힌다.

## 9. Nice-to-fix

| # | 항목 | 경로 |
| --- | --- | --- |
| 1 | `00.plan.md:331,350`, `00.tasks.md:665` stub 상태가 "0 done, #78 대기"로 낡음 | `product-manager` |
| 2 | G1 날짜 비어 있음 (`00.plan.md:312`) | 오너가 날짜를 준다, `product-manager`가 적는다 |
| 3 | `projects.design.md` §0 mission block 미인용, #80/#81 미반영 | `product-manager` 또는 `system-architect` |
| 4 | `app/sitemap.ts:40,46` `/about`, `/resume`가 308 대상 URL | `developer` (PJ-2-01 후속) |
| 5 | `components/blog/error.segments.vs.components.md:19,119` `@/app/blog/` 참조 (낡은 문서) | `sonnet-writer` |
| 6 | PJ-1-16 AC4 유효 token `private, no-store` 미측정 (코드 `posts.cache.ts:17`은 맞음) | main session, 1번과 같은 token으로 GET 1회 |
| 7 | PJ-1-13 AC2 TOC 위, tree 아래, 강조: 저장 근거 없음. 오너 눈 확인 1회를 보고에 적는다 | main session + 오너 |
| 8 | Constraints "`prefetch={false}`" 문구 vs `HoverPrefetchLink` (hover 때 켬, #70 c). 표현만 맞춘다 | `product-manager` |
| 9 | `app/[handle]/components/x_ProjectPostList.server.tsx` 잔존 (gitignore). 오너가 지운다 | 오너 |

---

## Cycle 2/2 (2026-10-14, reviewer 단독, 재검토)

- 대상: cycle 1/2 must-fix 4건 (§8), M1–M3 exit, 사다리 L1–L4, 계층 H1–H2.
- 근거 파일: `deploy/projects/pj-1-03-guard-2026-10-14.txt` (아래 "guard 파일"), `deploy/projects/pj-1-23-final-2026-10-14.txt` (아래 "final 파일"), 커밋 `adcfc06`.
- 이 검토가 직접 보낸 요청: 운영 GET 9회 (읽기만, 1 s 간격). 정적 검사 4종을 로컬에서 2번 실행 (검토 도중 HEAD가 바뀌어서).
- must-fix 코드 범위: `d7228ea..adcfc06` (web 파일 4개: `proxy.ts`, `utils/legacyRedirect.ts`, `next.config.ts`, `apis/getPost.api.ts`).
- 검토 도중 바뀐 것: HEAD가 `8dc5dca`(PJ-1-32 `/@u/me`, gate 밖)로 이동. `00.plan.md`, `00.tasks.md`, `decisions.plan.md`(#82–#91)가 다른 세션에서 갱신됨. 작업 트리에 미커밋 WIP 3개 (`[slug]/layout.tsx`, `posts/layout.tsx` 수정, `projects/[project]/layout.tsx` 신규). WIP는 이 gate의 대상이 아니다 (PJ-1-35 또는 Phase CC).

### C2-1. 판정 요약

**판정: PASS.** M3 exit 4항목이 모두 실행된 시연으로 닫혔다. must-fix 4건 중 3건 닫힘, 1건(PJ-1-23)은 AC1–AC3 닫힘, AC4(MVP3 보고 절)만 미작성이다. AC4는 exit 줄 항목이 아니라 gate를 막지 않는다. 다만 PJ-1-23 행은 AC4가 채워지기 전까지 진실로 닫힌 것이 아니다.

```
M1 exit  [PASS]  Express 400 시연됨 (guard 파일) · 나머지 cycle 1과 같음
M2 exit  [PASS]  cycle 1과 같음
M3 exit  [PASS]  /blog/@ 0 · sitemap /@u 23, /blog/@ 0 · x_ 은퇴 · projects 2회째 HIT
사다리   L1 PASS · L2 PASS · L3 PASS · L4 PASS (cycle 1 ISSUE에서 바뀜)
계층     H1 ISSUE (stub 수치만) · H2 PASS
```

| 분류 | 건수 | 경로 |
| --- | --- | --- |
| Must-fix (gate 차단) | 0 | 없음 |
| 비차단 ISSUE | 2 | C2-8 |
| Nice-to-fix | 5 | C2-9 |

카운터(`cycle`, `recovery`)는 `recover` step 3의 몫이다. 이 검토는 `00.plan.md`를 고치지 않았다.

### C2-2. 빌드와 정적 검사

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| `pnpm --filter dashboard_client_web check-types` | PASS | tsc 출력 0줄 (adcfc06 트리, 8dc5dca+WIP 트리 모두) |
| `pnpm --filter dashboard_client_web lint` | PASS | eslint `--max-warnings 0` 출력 0줄 (2번 모두) |
| `pnpm --filter dashboard_server check-types` | PASS | tsc 출력 0줄 (2번 모두) |
| `rg -c "/blog/@" apps/ --glob '!**/*.test.*' --glob '!**/x_*' --glob '!**/node_modules/**'` | PASS | 출력 없음, exit 1 (일치 0). 2번 모두 |

### C2-3. Must-fix 4건 재검토

| # | 항목 | 판정 | 근거 |
| --- | --- | --- | --- |
| 1 | PJ-1-03 AC2–AC4 Express 예약 slug 400 | PASS | guard 파일: slug `Posts` 400 `slug is reserved: Posts`, 제목 `Projects` 400 `slug is reserved: projects`, 15분 내 예약 slug 행 0, `pj-guard-check` 201 (draft 247). 247은 오너가 `/me`에서 soft delete (final 파일 9행). 운영 blog-api `ab4c3c0` |
| 2 | PJ-1-23 최종 배포 + purge + 재측정 | AC1–AC3 PASS, **AC4 ISSUE (비차단)** | 아래 C2-3a |
| 3 | PJ-1-26 308 엣지 캐시 | PASS | 아래 C2-3b |
| 4 | PJ-1-27 `/blog/@` 주석 3건 | PASS | `rg` 출력 없음 (C2-2). `next.config.ts:59-61` 주석은 "redirect가 `proxy.ts`로 갔다"로 바뀜. `legacyRedirect.ts:3-8` 주석은 `(at)u` 표기. `getPost.api.ts` 변경 1줄 (`adcfc06` stat) |

#### C2-3a. PJ-1-23 AC별

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1 `/@taeklim/projects` 2회째 HIT, `/blog/@taeklim/rust-config` 308 2회 + 2회째 HIT | PASS | final 파일 6행, 8행 (HIT x5). 이 검토 GET: `/blog/@taeklim/rust-config` 2회 모두 `308`, `cache-control: public, s-maxage=86400`, `location: /@taeklim/rust-config`, `cf-cache-status: HIT`. `/@taeklim/projects` 200 HIT |
| AC2 sitemap `/blog/@` 0, `/@taeklim/` ≥1 | PASS | 이 검토 GET: `/blog/@` 0, `/@taeklim/` 23 |
| AC3 `traffic-check.sh` 0 FAIL | 근거 없음 (비차단) | final 파일에 traffic-check 줄 없음. cycle 1의 0 FAIL은 `9f7c5fe` 기준. `adcfc06`은 redirect 처리만 바꿨고 새 URL HIT는 이 검토 GET으로 변함없다. main session이 1회 실행하고 한 줄 적는다 |
| AC4 `projects.report.md` "MVP3" 절 + 맨 위 요약 줄 | **ISSUE** | `grep -c "^## MVP3" projects.report.md` 0. `adcfc06`, `pj-1-23-final` 문자열 0건. 제목은 `## MVP1`, `## MVP2`만 (433줄). 맨 위 요약 줄 없음. 행은 `[x]`인데 AC가 비었다 |

cycle 1에서 PJ-1-23이 gate를 막은 이유는 "코드만 있고 배포가 없다"였다. 지금은 배포, purge, 측정이 모두 끝났다. 남은 것은 보고 절 하나다. exit 줄은 보고 절을 요구하지 않는다 (`00.plan.md:316`). 그래서 비차단이다. 그러나 `.claude/CLAUDE.md` System build phasing은 단계 보고와 요약 페이지 링크를 요구한다. 보고 절 없이 PJ-1-23을 `[x]`로 둔 것은 pm이 고칠 문서 진실 문제다.

#### C2-3b. PJ-1-26 AC별

| AC | 판정 | 근거 |
| --- | --- | --- |
| AC1 `proxy.ts`에 `Cache-Control` ≥1, `next.config.ts`에 `source: '/blog/:handle` 0, 거짓 주석 0 | PASS | `proxy.ts:96-97` `NextResponse.redirect(url, 308)` + `Cache-Control: public, s-maxage=86400`. `next.config.ts`에 `redirects()` 함수 없음 (히트는 주석 59–60행만). "Cloudflare can store it" 문장 없음 |
| AC2 check-types, lint | PASS | C2-2 |
| AC3 2회 308, `cache-control` ≥1, 2회째 HIT, `set-cookie` 0 | PASS | final 파일 8행 (5형태 HIT). 이 검토 GET: `/blog/@taeklim/rust-config` x2, `/about` x2 모두 308 + `cache-control` + HIT, `set-cookie` 0줄. 쿼리 유지: `/blog/@taeklim?tags=rust` → 308 `location: /@taeklim/posts?tags=rust` |

308을 Clerk 앞에서 처리하므로 Clerk 헤더가 붙지 않는다 (`proxy.ts:84-86`). 2회째 HIT는 오너가 Cloudflare "web cache" Status code TTL에 308을 추가한 뒤에 나왔다 (final 파일 7행). 코드 변경만으로는 EXPIRED였다 (4행).

### C2-4. Exit 기준 M1–M3

| 기준 | 판정 | 근거 |
| --- | --- | --- |
| M1: 예약 slug가 Express 400으로 멈춤 | PASS (cycle 1 ISSUE에서 바뀜) | C2-3 #1 |
| M1: 나머지 5항목 | PASS | cycle 1 §4와 같음. TOC 위, tree 아래 눈 확인은 PJ-1-30 (gate 밖) |
| M2: 3항목 | PASS | cycle 1 §4와 같음. 재배포 뒤 페이지 200, `[MOCK]` 0 (final 파일 5행) |
| M3: `/blog/@` 문자열 0 (테스트 제외) | PASS (cycle 1 ISSUE에서 바뀜) | C2-2 `rg` 출력 없음 |
| M3: sitemap 글 URL 모두 `/@u/<slug>` | PASS | 이 검토 GET: `/blog/@` 0, `/@taeklim/` 23. 비글 URL `/about`, `/resume` 2건은 PJ-1-28 (gate 밖) |
| M3: mock fetcher 경로 `x_` 은퇴 | PASS (배포됨) | `mocks/x_projects/`만 존재. `rg "x_projects|mocks/projects|PROJECTS_DATA_SOURCE"` (`x_`, `.md` 제외) 0. 운영 `adcfc06` = `d7228ea` 포함 |
| M3: purge 뒤 `/@taeklim/projects` 2회째 HIT | PASS | final 파일 6행. 이 검토 GET HIT |

### C2-5. MVP 사다리 L1–L4

| 불변식 | 판정 | 근거 |
| --- | --- | --- |
| L1 스키마는 하나의 계약 | PASS | `git log d7228ea..adcfc06 -- packages/db packages/types posts.user-projects.ts` 0건. `8dc5dca`는 `RESERVED_HANDLE_SEGMENTS`에 `me`를 더했다 (#89). TS `routes.ts:6-14`와 Python `routes.py:11-19` 모두 7개, 같은 순서. DB 변경 0. cycle 1의 키 집합 대조 그대로 유효 |
| L2 mock에서 흐름 시연 전 파이프라인 금지 | PASS | 새 파이프라인 없음. `adcfc06`은 redirect 처리 이동만 |
| L3 mock은 분명하고 격리 | PASS | C2-4 x_ 행. 운영 글 상세 `[MOCK]` 0 (이 검토 GET) |
| L4 이전 phase exit 닫힌 뒤 다음 phase | PASS (cycle 1 ISSUE에서 바뀜) | M1 exit "Express 400"이 운영 blog-api에서 실제 실행으로 닫혔다 (guard 파일). M3 exit 4항목도 배포 뒤 측정으로 닫혔다. 순서 위반(M1 미닫힘 상태의 M2 열림)은 과거 사실로 남고, 지금은 모두 닫혔다 |

### C2-6. 계층 검사 H1–H2

| 검사 | 판정 | 근거 |
| --- | --- | --- |
| H1 plan mission block | PASS | `00.plan.md:308-319`. M1–M3 `→ S1`, S1 `→ G1`. M3 `cycle 1/2; recovery 0/2`, 분모 안. `budget:` 없음 |
| H1 design doc mission block | PASS (cycle 1 ISSUE에서 바뀜) | `projects.design.md` §0 "Mission block (인용)": Mission, Vision 인용 + 원본 위치 명시 |
| H1 G1 날짜 | PASS (cycle 1 ISSUE에서 바뀜) | `00.plan.md:312` "by 2026-10-14 (owner 2026-10-14, #91). 상태: 달성". DRAFT 해제. `decisions.plan.md` #91 |
| H1 task → M 태그 | PASS | P1 전 행 `→ M1/M2/M3`. 새 행 PJ-1-26…35 `→ M3`. PJ-1-D1만 `→ (없음)` |
| H1 stub 상태 | **ISSUE (비차단)** | `00.plan.md:338` "M3 4/7 (열림 PJ-1-23, PJ-1-26, PJ-1-27) … 남은 must-fix = PJ-1-26, PJ-1-27, PJ-1-23", `00.tasks.md:667` "M3 7 (4 done; 열림 …)". 세 행은 `[x]`다. `00.tasks.md:7` ACTIVE/OPEN은 "PLANNED 2026-10-13 … M2는 #78 오너 선택 대기". `01.status.md:72` "must-fix 4/4 closed"는 AC4 미작성을 덮는다. stub이 진실이어야 한다 (`rules/docs.md` §1) |
| H1 Constraints 줄 변경 | PASS | prefetch 줄 #90, 예약 slug 7개 #89. 둘 다 D-row가 먼저 있고 옛 줄은 취소선 + SUPERSEDED 표기 |
| H2 결정 기록 | PASS | `decisions.plan.md` #82–#91 (10행). cycle 1 nice 2 → #91, nice 8 → #90. `/me` 이동 → #89. P1 gate → CC → P2 순서 → #82. `proxy.ts`로 옮긴 것은 제약 강제다 (`headers()`는 `redirects()`에 안 붙음, 길 하나). PJ-1-26 행 AC1이 그 길을 미리 적었다. Cloudflare 308 TTL은 오너의 운영 설정 변경이다. 둘은 D-row를 빚지지 않는다 |

H1 경로: `product-manager`.

### C2-7. 회귀 점검 (cycle 1 §7에서 바뀐 것만)

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| 308이 Clerk 앞에서 나감 | PASS | `proxy.ts:87-100`. `set-cookie` 0 (이 검토 GET 5회) |
| `%`로 시작하되 `%40`이 아닌 경로 | PASS (코드) | `legacyRedirect.ts:33-34` `null` 반환. 잘못된 인코딩을 handle로 만들지 않음 |
| `/blog/@u/opengraph-image` 규칙 | PASS (코드) | `legacyRedirect.ts:9,27-29` 주석대로 slug 규칙과 같음 (next.config 시절과 동일) |
| 예약 slug 목록 TS = Python | PASS | 7개, 같은 순서 (`me` 추가 뒤). C2-5 L1 |
| PJ-1-25 AC2 버튼 표시 | PASS (SSR 근거) | 이 검토 GET `/@taeklim/rust-config` 200: `aria-label="Post actions"` 1, `"Write a comment"` 1. 좋아요, 저장은 client 렌더라 SSR HTML에서 aria 0. 오너 눈 확인은 PJ-1-30과 함께 |
| PJ-2-02 AC "로그인 안 하면 sign-in" | 행 문구 낡음 | #89로 익명은 404다 (`8dc5dca`). AC 문구는 pm이 #89에 맞춘다. exit 줄 밖 |
| 두 페이지의 `cache-control: private, no-store` + `HIT` | 발견 아님 | Cloudflare "web cache" 규칙이 HTML에서 origin 헤더를 덮는다. PJ 이전부터 같다 |

### C2-8. 비차단 ISSUE

| # | 항목 | 분류 | 경로 | 닫는 조건 |
| --- | --- | --- | --- | --- |
| 1 | PJ-1-23 AC4: `projects.report.md` "MVP3" 절 + 맨 위 요약 줄 없음 | implementation (문서) | `sonnet-writer` 또는 main session. 원본 = guard 파일 + final 파일. pm은 행 메모에 "AC4 pending" 표기 | `grep -c "^## MVP3" projects.report.md` → 1. 맨 위 줄에서 MVP1–3 절 링크 |
| 2 | PJ-1-23 AC3: `adcfc06` 뒤 traffic-check 값 없음 | 측정 미완 | main session 1회 | final 파일 또는 `projects.report.md`에 "0 FAIL" 한 줄 |

1번은 코드도 배포도 필요 없다. 새 approach도 아니다. `recover`가 architect와 analyst를 띄울 일이 아니다.

### C2-9. Nice-to-fix

| # | 항목 | 경로 |
| --- | --- | --- |
| 1 | `00.plan.md:338`, `00.tasks.md:7,667`, `01.status.md:72` stub 수치와 "열림" 목록이 낡음 (C2-6) | `product-manager` |
| 2 | `deploy/traffic/README.md:83` "Status code TTL 200 only: 1 day". 오너가 308을 1일로 추가했다 (final 파일 7행). 문서 불일치 | `sonnet-writer` 또는 main session |
| 3 | PJ-2-02 AC 문구를 #89(익명 404)에 맞춘다 (C2-7) | `product-manager` |
| 4 | cycle 1 nice 4, 5, 6, 7, 9는 PJ-1-28…31 행과 오너 할 일로 옮겨졌다. nice 2, 8은 #91, #90으로 닫혔다. 모두 gate 밖 | 각 행 |
| 5 | sitemap 비글 URL `/about`, `/resume` 2건 여전 (이 검토 GET) | PJ-1-28 |

### C2-10. 다음 단계

- Phase CC 열림 조건 "Phase PJ P1 gate PASS"는 이 판정으로 충족한다 (`00.plan.md:357`).
- M4 (P2) 열림 조건은 #82로 "Phase CC M-CC3 gate PASS"다 (`00.plan.md:318`). 이 판정만으로 열리지 않는다.
- `recover` step 3이 M3 줄의 카운터를 정리한다.
- C2-8 1번은 Phase CC 첫 dispatch 전에 닫는 것이 맞다. 보고 없는 phase는 끝이 아니기 때문이다 (`.claude/CLAUDE.md` System build phasing).
