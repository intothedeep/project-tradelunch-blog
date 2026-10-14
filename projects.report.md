# Phase PJ 단계 보고 (Projects)

## MVP1 (2026-10-13)

단일 출처: `deploy/projects/mvp1-local-run-2026-10-13.txt` (오너가 허용한 로컬 실행 1회, Q-L, #79).
실행 명령: `PROJECTS_DATA_SOURCE=mock`, API = 운영 `blog-api.prettylog.com`, `next dev --turbopack -p 3000`.
이 절은 MVP1의 첫 end-to-end 순환(cycle)이다. 첫 순환이라 판정(verdict)을 내리지 않는다 (MVP 사다리).

### 요약

mock 모드의 웹이 한 번 끝까지 돌았다. 라우트 18개의 상태 코드가 기대와 같았다. 옛 URL 5개는 308로 새 URL에 갔다. 프로젝트 화면 3곳에서 "Recently viewed"가 0이었고, 일반 글에서는 1이었다. 배포가 필요한 항목(PJ-1-03 AC2–AC4)은 건너뛰었다. 이 실행이 재지 않은 항목은 AC 대응 표에 "대기"로 적었다.

| 단계 | 상태 | 한 줄 결과 |
| --- | --- | --- |
| 1. 라우트와 308 redirect | ran | 18개 URL 중 기대와 다른 것 없음 |
| 2. projects 카드 (mock) | ran | 카드 2개, 모두 `[MOCK]` |
| 3. 프로젝트 글 목록 순서 | ran | 글 8개: overview 1개 + 1/7 … 7/7 |
| 4. 상세 rail 분기 | ran | 프로젝트 글과 projects 화면에서 tree 제목 있음, 일반 글에서도 1 (아래 단계 4 참고) |
| 5. Recently viewed 제거 | ran | 프로젝트 화면 3곳 0, `rust-config` 1 |
| 6. canonical | ran | 3곳 모두 `/@taeklim/...` 경로, 호스트는 로컬 env |
| 7. 메뉴 | ran | 익명 메뉴 5개, "Projects" 있음 |
| 8. 예약 slug 검사 | 일부 ran | blog_agent `ValueError` 확인. Express 400은 skipped (PJ-1-19 대기) |

### 페이지 흐름 (ASCII 그림 1장, 이미지 대신 사용)

```
메뉴 "Projects"
   |
   v
/@taeklim/projects  ---- 카드 2개 ([MOCK]) ----+
   |                                           |
   v                                           v
/@taeklim/projects/cnn-from-scratch      /@taeklim/projects/empty-project
   |  (글 목록 8개)
   v
/@taeklim/<slug>   (프로젝트 글 상세: projects rail)
   ^
   |  308
옛 URL: /blog/@taeklim/<slug>, /blog/@taeklim, /blog, /about, /resume
```

### 단계 1. 라우트와 308 redirect

- What: 새 라우트의 상태 코드와 옛 URL의 308 위치를 본다.
- Why: PJ-1-05, PJ-1-06, PJ-1-07, PJ-1-08, PJ-1-24의 동작 AC.
- Input data: 로컬 서버에 보낸 URL 18개 (mock 모드, 실제 API).
- Output data: 상태 코드와 `location` 값 18줄.
- Result: 아래 표.
- 좋은 점: `%40taeklim`도 `@taeklim`과 같은 308이다. 나쁜 점: 없음.
- Status: ran.

| URL | 상태 | location |
| --- | --- | --- |
| `/` | 200 | |
| `/@taeklim` | 308 | `/@taeklim/posts` |
| `/%40taeklim` | 308 | `/@taeklim/posts` |
| `/no-at-xyz` | 404 | |
| `/@taeklim/posts` | 200 | |
| `/@taeklim/projects` | 200 | |
| `/@taeklim/projects/cnn-from-scratch` | 200 | |
| `/@taeklim/<CNN 글 slug>` | 200 | |
| `/@taeklim/rust-config` | 200 | |
| `/@taeklim/about` | 200 | |
| `/@someone/about` | 404 | |
| `/@taeklim/resume` | 200 | |
| `/@taeklim/saved` | 307 | `/sign-in?redirect_url=...` |
| `/blog` | 308 | `/` |
| `/blog/@taeklim` | 308 | `/@taeklim/posts` |
| `/blog/@taeklim/<CNN 글 slug>` | 308 | `/@taeklim/<CNN 글 slug>` |
| `/about` | 308 | `/@taeklim/about` |
| `/resume` | 308 | `/@taeklim/resume` |

### 단계 2. projects 카드 (mock)

- What: 카드 격자에 mock 카드가 뜨는지 본다.
- Why: PJ-1-12 AC4 (카드 수).
- Input data: `mocks/projects/cards.json` (mock, 실제 데이터 아님).
- Output data: 카드 제목 2개.
- Result: 아래 표.
- 좋은 점: 두 카드 모두 `[MOCK]` 접두가 보여 실제 데이터와 섞이지 않는다. 나쁜 점: `cards.json` 원소 수와의 대조값이 원본에 없다.
- Status: ran.

| 카드 제목 |
| --- |
| `[MOCK] empty-project` |
| `[MOCK] Overview: CNN from scratch` |

### 단계 3. 프로젝트 글 목록 순서

- What: `cnn-from-scratch` 목록의 글 링크 순서를 본다.
- Why: PJ-1-12 AC4 (순서 = `priority` ASC, `seq` ASC).
- Input data: mock 글 8개.
- Output data: 링크 8개 (원본 24–31행).
- Result: 아래 표.
- 좋은 점: overview 다음에 1/7부터 7/7까지 순서대로 나온다. 나쁜 점: `posts.json`의 `priority`, `seq` 값은 원본에 없어 직접 대조하지 못했다.
- Status: ran.

| 순번 | 글 slug 앞부분 |
| --- | --- |
| 1 | `training-a-cnn-from-scratch-4-to-93-2-...` (overview) |
| 2 | `cnn-from-scratch-1-7-...` |
| 3 | `cnn-from-scratch-2-7-...` |
| 4 | `cnn-from-scratch-3-7-...` |
| 5 | `cnn-from-scratch-4-7-...` |
| 6 | `cnn-from-scratch-5-7-...` |
| 7 | `cnn-from-scratch-6-7-...` |
| 8 | `cnn-from-scratch-7-7-...` |

### 단계 4. 상세 rail 분기 (프로젝트 글과 일반 글)

- What: 페이지별 rail에 projects tree 제목이 있는지 본다.
- Why: PJ-1-13 AC2–AC3, PJ-1-11 AC3.
- Input data: 페이지 4곳의 HTML.
- Output data: "projects-tree-title 있음" 개수 4줄.
- Result: 아래 표.
- 나쁜 점: 일반 글 `rust-config`에서도 tree 제목 개수가 1이다. 기대는 "오늘의 `UserContextRail`"인데 이 개수만으로는 어느 rail인지 가릴 수 없다. 이유를 이 실행에서 확인하지 못했다. 열린 문제로 둔다.
- Status: ran. 분기 판정은 대기.

| 페이지 | tree 제목 | Recently viewed |
| --- | --- | --- |
| `/@taeklim/projects` | 1 | 0 |
| `/@taeklim/projects/cnn-from-scratch` | 1 | 0 |
| `/@taeklim/<CNN 글 slug>` | 1 | 0 |
| `/@taeklim/rust-config` | 1 | 1 |

### 단계 5. Recently viewed 제거

- What: 프로젝트 화면 3곳에서 "Recently viewed"가 빠졌는지 본다.
- Why: PJ-1-11b AC2.
- Input data: 단계 4와 같은 HTML 4개.
- Output data: Recently viewed 렌더 개수 4개.
- Result: 프로젝트 화면 3곳 0, 일반 글 1 (위 단계 4 표의 마지막 열).
- 좋은 점: 일반 글에는 남아 있어 다른 화면이 바뀌지 않았다. 나쁜 점: `/@taeklim/posts`는 이 실행에서 세지 않았다.
- Status: ran.

### 단계 6. canonical

- What: `<link rel="canonical">` 값을 본다.
- Why: PJ-1-06 AC3, PJ-1-07 AC3, PJ-1-24 AC2.
- Input data: 페이지 3곳.
- Output data: canonical href 3개.
- Result: 아래 표.
- 좋은 점: 경로가 기대와 같다 (`/@taeklim/posts`는 자기 자신). 나쁜 점: 호스트가 `localhost:3001`이다. 아래 "발견한 문제" 2번에서 설명한다. `rust-config`의 canonical은 이 실행에서 재지 않았다.
- Status: ran.

| 페이지 | canonical href |
| --- | --- |
| `/@taeklim/posts` | `http://localhost:3001/@taeklim/posts` |
| `/` | `http://localhost:3001` |
| `/@taeklim/<CNN 글 slug>` | `http://localhost:3001/@taeklim/<CNN 글 slug>` |

### 단계 7. 메뉴

- What: 익명 사용자의 메뉴 항목을 본다.
- Why: PJ-1-09 (공개 항목 "Projects").
- Input data: 익명 요청의 HTML 1개.
- Output data: 메뉴 항목 5개.
- Result: `Home`, `Projects`, `Explore`, `About`, `Resume`.
- 좋은 점: 로그인 없이 "Projects"가 보인다. 나쁜 점: 없음.
- Status: ran.

### 단계 8. 예약 slug 검사 (guard)

- What: 예약 slug `Posts`가 막히는지 본다.
- Why: PJ-1-14 AC3 (PJ-1-03 AC2, PJ-1-04 AC2).
- Input data: blog_agent의 순수 함수 호출 1회 (모델, 데이터 없음). Express 요청은 보내지 않았다.
- Output data: stderr 1줄.
- Result: 아래 표.
- 좋은 점: 메시지가 설계와 같다. 나쁜 점: 원본에 셸 경고 `command not found: _encode`가 섞여 있다. 검사 결과와 무관한 셸 설정 경고다.
- Status: PJ-1-04 AC2 ran. PJ-1-03 AC2–AC4 skipped (blog-api 배포 뒤, PJ-1-19 대기).

| 검사 | 결과 | 상태 |
| --- | --- | --- |
| blog_agent `Posts` | `ValueError: slug is reserved: Posts` | ran |
| Express `POST` `slug=Posts` → 400 (PJ-1-03 AC2) | 실행 안 함 | skipped |
| 예약 slug 글 0건 (PJ-1-03 AC3) | 실행 안 함 | skipped |
| 정상 slug 회귀 (PJ-1-03 AC4) | 실행 안 함 | skipped |

### AC 대응

| AC | 결과 줄 | 판정 |
| --- | --- | --- |
| PJ-1-14 AC1 | 이 절에 단계마다 보고 1개 | pass |
| PJ-1-14 AC2 | 아래 줄마다 | 아래 참고 |
| PJ-1-14 AC3 | `ValueError` 확인, 400은 대기 | 일부 pass, 일부 pending |
| PJ-1-05 AC3 | `/@taeklim` 308 → `/@taeklim/posts`, `/%40taeklim` 같은 결과, `/no-at-xyz` 404 | pass |
| PJ-1-06 AC3 | `/@taeklim/posts` 200. 첫 3개 제목 비교는 원본에 없음 | pending |
| PJ-1-07 AC3 | `/@taeklim/rust-config` 200. canonical과 `opengraph-image`는 재지 않음 | pending |
| PJ-1-08 AC2 | `/blog/@taeklim` 308, `/blog/@taeklim/<slug>` 308. `?tags=rust`, `%40`, no-@ 형태는 재지 않음. `/blog`는 308 (아래 참고) | 일부 pass |
| PJ-1-11 AC3 | tree 제목 1. 강조와 클릭 이동은 재지 않음 | pending |
| PJ-1-11b AC2 | 프로젝트 화면 3곳 0, 일반 글 1. `/@taeklim/posts`는 세지 않음 | pass (프로젝트 화면 기준) |
| PJ-1-12 AC4 | 카드 2개, 목록 순서 확인. `cards.json` 원소 수와 `< 1024 px` 확인은 없음 | pending |
| PJ-1-13 AC2–AC3 | tree 제목 개수만 있음. TOC 위치, 강조, 모바일 순서, 일반 글 rail 동일 여부는 재지 않음 | pending |
| PJ-1-24 AC2 | `/blog` 308 → `/`, `/@taeklim/posts` canonical이 자기 자신. 여러 작성자 섞임은 재지 않음 | 일부 pass |
| PJ-1-03 AC2–AC4 | 실행 안 함 | pending (PJ-1-19) |
| PJ-1-04 AC2 | `ValueError: slug is reserved: Posts` | pass |

PJ-1-08 AC2의 `/blog` 기대(200)는 PJ-1-24(#81) 전의 값이다. PJ-1-24 이후 기대는 308 → `/`이고 실행값과 같다. `00.tasks.md` PJ-1-08 AC2 줄을 고치는 일은 이 보고의 범위가 아니다. 담당 세션에 넘긴다.

### 발견한 문제

1. 로컬 `packages/types/dist`가 7월 7일 빌드로 낡아 있었다. `PROJECTS_ROOT_CATEGORY_TITLE`이 없어 첫 실행에서 projects tree가 비었다. `pnpm --filter @repo/types build` 뒤에 정상이 되었다. CI는 turbo `^build`로 이 빌드를 하므로 배포는 영향이 없다. 로컬 실행 전에는 이 빌드가 필요하다.
2. canonical 호스트가 `http://localhost:3001`이다. 로컬 `SITE_URL` env 값이다. 버그가 아니다.
3. mock 카드는 제목이 `[MOCK]`으로 시작한다. 실제 데이터와 구분된다.
4. 단계 4: 일반 글 `rust-config`의 tree 제목 개수가 1이다. 이 실행만으로 rail 분기가 맞는지 판정하지 못했다. 다음 순환에서 일반 글의 rail 구성을 직접 확인한다.

### 판정

첫 순환이다. 판정하지 않는다 (MVP 사다리). 다음 순환은 한 가지만 고친다 (`rules/research.md` §8).

## MVP2 (2026-10-14)

단일 출처: `deploy/projects/mvp2-prod-2026-10-14.txt` (운영 원본 출력. api `ab4c3c0`, web `9f7c5fe`, `cf-purge` 뒤).
이 절은 MVP2의 첫 순환이며, MVP1 절에 대한 두 번째 end-to-end 순환(cycle)이다.
판정(verdict)은 실행 전에 쓴 PJ-1-16과 PJ-1-19의 AC에 대해서만 낸다. 비교는 단계마다 MVP1과 한다.

### 요약

운영에서 mock 없이 real 경로가 끝까지 돌았다. 웹 페이지 8곳이 모두 200이고 `[MOCK]`은 0개였다. 옛 URL 9개는 308, `/no-at-xyz`는 404였다. 엣지 캐시는 `/@taeklim/projects`와 `/@taeklim/rust-config`가 HIT, `/@taeklim/saved`가 DYNAMIC이었다. `traffic-check`는 0 FAIL이었다. 원본에 없는 항목은 아래 "원본에 없는 값"에 적었다.

| 단계 | 상태 | 한 줄 결과 |
| --- | --- | --- |
| 1. API 카드 | ran | `success: true`, 카드 1개, `post_count` 8 |
| 2. API 글 목록 순서 | ran | 글 8개, `post_id` 283 → 290 |
| 3. API 오류와 캐시 | ran | 404 2개, `cache-control: public, s-maxage=86400` |
| 4. 웹 페이지 | ran | 8곳 모두 200, `[MOCK]` 0개 |
| 5. redirect | ran | 9개 308, `/no-at-xyz` 404 |
| 6. 엣지 캐시 | ran | projects, rust-config HIT, saved DYNAMIC |
| 7. sitemap | ran | `/@taeklim` URL 23개, `/blog` URL 0개 |
| 8. traffic-check | ran | 0 FAIL |

### 흐름 (ASCII 그림 1장)

```
웹 (web 9f7c5fe)  --real-->  API (api ab4c3c0)
/@taeklim/projects           GET /v1/api/posts/users/taeklim/projects
/@taeklim/projects/<p>       GET .../projects/<project>
        |
        v
Cloudflare 엣지: 2회째 요청 HIT (saved는 DYNAMIC)
```

### 단계 1. API 카드

- What: 운영 API가 프로젝트 카드를 real로 주는지 본다.
- Why: PJ-1-16 AC1.
- Input data: `GET /v1/api/posts/users/taeklim/projects` 1회 (운영 DB, real).
- Output data: JSON 1개.
- Result: 아래 표.
- 좋은 점: 카드 `keys`에 `overview`가 중첩되어 있다. 나쁜 점: mock 카드와의 키 집합 대조(`jq -S 'keys'`)가 원본에 없다.
- Status: ran.

| 항목 | 값 |
| --- | --- |
| `success` | `true` |
| 카드 수 `n` | 1 |
| 카드 `keys` | `overview`, `post_count`, `project`, `project_id` |
| `overview_keys` | `post_id`, `slug`, `stored_uri`, `title` |
| `post_count` | 8 |

### 단계 2. API 글 목록 순서

- What: 프로젝트 글 8개의 순서를 본다.
- Why: PJ-1-16 AC2 (순서 = `priority`, `seq`).
- Input data: 운영 API의 글 8개.
- Output data: 순번, `post_id`, slug 8줄 (원본 5–12행).
- Result: 아래 표.
- 좋은 점: overview가 첫 글이고 1/7부터 7/7까지 이어진다. 나쁜 점: `priority`, `seq` 값과 같은 SQL의 `ORDER BY` 결과가 원본에 없어 직접 대조하지 못했다.
- Status: ran.

| 순번 | `post_id` | slug 앞부분 |
| --- | --- | --- |
| 0 | 283 | `training-a-cnn-from-scratch-4-to-93-2-...` (overview) |
| 1 | 284 | `cnn-from-scratch-1-7-...` |
| 2 | 285 | `cnn-from-scratch-2-7-...` |
| 3 | 286 | `cnn-from-scratch-3-7-...` |
| 4 | 287 | `cnn-from-scratch-4-7-...` |
| 5 | 288 | `cnn-from-scratch-5-7-...` |
| 6 | 289 | `cnn-from-scratch-6-7-...` |
| 7 | 290 | `cnn-from-scratch-7-7-...` |

### 단계 3. API 오류와 캐시

- What: 없는 사용자와 없는 프로젝트가 404인지, 캐시 헤더가 맞는지 본다.
- Why: PJ-1-16 AC3, AC4.
- Input data: 요청 3개.
- Output data: 상태 코드 2개, 헤더 1줄.
- Result: 아래 표.
- 좋은 점: 두 오류 모두 404다. 나쁜 점: `Authorization` 헤더를 붙인 경우(`private, no-store` 기대)와 `projects` 카테고리가 없는 사용자(`200` + `[]` 기대)는 재지 않았다.
- Status: ran.

| 요청 | 결과 |
| --- | --- |
| `no-such-user-xyz/projects` | 404 |
| `taeklim/projects/no-such-project` | 404 |
| `cache-control` | `public, s-maxage=86400` |

### 단계 4. 웹 페이지

- What: 운영 웹 페이지 8곳의 상태 코드, `[MOCK]` 개수, 응답 시간을 본다.
- Why: PJ-1-19 AC1.
- Input data: 운영 URL 8개.
- Output data: 상태, `[MOCK]` 개수, 시간 8줄 (원본 19–26행).
- Result: 아래 표.
- 좋은 점: 8곳 모두 200이고 `[MOCK]`은 0개다. 나쁜 점: 목록 페이지의 글 제목 순서를 이 원본은 담지 않는다. 순서는 단계 2의 API 값만 있다.
- Status: ran.

| URL | 상태 | `[MOCK]` | 시간 |
| --- | --- | --- | --- |
| `/@taeklim/projects` | 200 | 0 | 0.180027 s |
| `/@taeklim/projects/cnn-from-scratch` | 200 | 0 | 0.242808 s |
| `/@taeklim/training-a-cnn-from-scratch-4-to-93-2-...` (overview 글) | 200 | 0 | 0.167433 s |
| `/@taeklim/posts` | 200 | 0 | 0.291976 s |
| `/@taeklim/about` | 200 | 0 | 0.166324 s |
| `/@taeklim/resume` | 200 | 0 | 0.209017 s |
| `/` | 200 | 0 | 0.221649 s |
| `/tags/rust` | 200 | 0 | 0.265181 s |

### 단계 5. redirect

- What: 옛 URL 형태가 308로 새 URL에 가는지 본다.
- Why: PJ-1-19 AC2 (PJ-1-05 AC3, PJ-1-08 AC2).
- Input data: 운영 URL 10개.
- Output data: 상태 코드와 `location` 10줄.
- Result: 아래 표.
- 좋은 점: `%40taeklim`과 `taeklim`(`@` 없는 형태) 모두 새 URL로 간다. 나쁜 점: `?tags=rust` 형태는 원본에 없다.
- Status: ran.

| URL | 상태 | location |
| --- | --- | --- |
| `/@taeklim` | 308 | `https://my.prettylog.com/@taeklim/posts` |
| `/%40taeklim` | 308 | `https://my.prettylog.com/@taeklim/posts` |
| `/blog` | 308 | `https://my.prettylog.com/` |
| `/blog/@taeklim` | 308 | `https://my.prettylog.com/@taeklim/posts` |
| `/blog/@taeklim/rust-config` | 308 | `https://my.prettylog.com/@taeklim/rust-config` |
| `/blog/%40taeklim/rust-config` | 308 | `https://my.prettylog.com/@taeklim/rust-config` |
| `/blog/taeklim/rust-config` | 308 | `https://my.prettylog.com/@taeklim/rust-config` |
| `/about` | 308 | `https://my.prettylog.com/@taeklim/about` |
| `/resume` | 308 | `https://my.prettylog.com/@taeklim/resume` |
| `/no-at-xyz` | 404 | |

### 단계 6. 엣지 캐시

- What: 2회째 요청이 Cloudflare 캐시에 맞는지, 본인 전용 화면이 캐시되지 않는지 본다.
- Why: PJ-1-19 AC3, PJ-2-04 (`/@*/saved` bypass).
- Input data: 같은 URL 2회 요청, 3곳.
- Output data: `cf-cache-status` 3줄.
- Result: 아래 표.
- 좋은 점: 공개 HTML은 HIT이고 `saved`는 캐시되지 않는다. 나쁜 점: 없음.
- Status: ran.

| URL (2회째) | `cf-cache-status` |
| --- | --- |
| `/@taeklim/projects` | HIT |
| `/@taeklim/rust-config` | HIT |
| `/@taeklim/saved` | DYNAMIC |

### 단계 7. sitemap

- What: sitemap에 새 URL 형태만 있는지 본다.
- Why: PJ-1-20 (링크 교체)의 운영 확인.
- Input data: 운영 sitemap 1개.
- Output data: URL 개수 2개.
- Result: `/@taeklim` URL 23개, `/blog` URL 0개.
- 좋은 점: 옛 `/blog` URL이 sitemap에 없다. 나쁜 점: 없음.
- Status: ran.

### 단계 8. traffic-check

- What: Cloudflare 트래픽 점검 스크립트가 통과하는지 본다.
- Why: PJ-1-18 AC2.
- Input data: `_scripts/cloudflare/traffic-check.sh` 1회 (2026-10-14).
- Output data: FAIL 개수 1줄.
- Result: 0 FAIL.
- 좋은 점: 표본 URL을 `/@taeklim/rust-config`로 바꾼 뒤에도 통과한다. 나쁜 점: 없음.
- Status: ran.

### MVP1 대비

MVP1은 mock 모드의 로컬 실행이고, MVP2는 real 경로의 운영 실행이다.

| 단계 | MVP1 (mock, 로컬) | MVP2 (real, 운영) | 변화 |
| --- | --- | --- | --- |
| 카드 | 2개 (`[MOCK] empty-project` 포함) | 1개 (`n` 1) | mock의 빈 프로젝트 카드가 사라졌다 |
| 카드 제목 | `[MOCK]` 접두 | API는 `project` 키로 준다. 제목 텍스트는 원본에 없다 | `[MOCK]` 접두 없음 |
| `[MOCK]` 개수 | 카드 2개 모두 `[MOCK]` | 페이지 8곳 모두 0 | mock 글자 0 |
| 글 순서 | overview 1개 + 1/7 … 7/7 | `post_id` 283 → 290, 같은 순서 | 같음 (00 → 07) |
| 글 수 | 8개 | `post_count` 8 | 같음 |
| 페이지 상태 | 18개 URL, 기대와 같음 | 페이지 8곳 모두 200 | 같음 |
| redirect | 5개 URL이 308 | 9개 형태 308, `/no-at-xyz` 404 | 형태가 늘었다 (`%40`, `@` 없는 형태) |
| `/blog` | 308 → `/` | 308 → `https://my.prettylog.com/` | 같음. 호스트가 운영으로 바뀜 |
| `/@taeklim/saved` | 307 → `/sign-in?...` (로그인 없음) | DYNAMIC (캐시 안 됨) | 새로 잰 값 |
| 엣지 캐시 | 재지 않음 (로컬) | projects, rust-config HIT | 새로 잰 값 |
| sitemap | 재지 않음 | `/@taeklim` 23개, `/blog` 0개 | 새로 잰 값 |
| 예약 slug 400 | blog_agent `ValueError`만, Express 400 skipped | 아직 안 잼 (아래 "남은 것") | 변화 없음 |

MVP1에서 제목이 `[MOCK]`으로 시작하던 카드는 MVP2 원본에 제목 텍스트가 없다. 이 값은 원본에서 읽지 못했다.

### AC 대응 (판정)

기준은 실행 전에 쓴 `00.tasks.md`의 PJ-1-16, PJ-1-19, PJ-1-18 AC다.

| AC | 결과 줄 | 판정 |
| --- | --- | --- |
| PJ-1-16 AC1 | `success: true`, 카드 1개 (기대 ≥ 1). `overview` 중첩 키 있음. mock 키 집합 대조는 원본에 없음 | pass (`00.tasks.md` 기록에 "keys = mock keys"), 원본 대조 pending |
| PJ-1-16 AC2 | 글 8개, overview가 첫 글. `priority`, `seq` 값과 같은 SQL 대조는 원본에 없음 | pass (`00.tasks.md` 기록에 "priority 0..7"), 원본 대조 pending |
| PJ-1-16 AC3 | 404, 404. 카테고리 없는 사용자 `200` + `[]`는 안 잼 | 일부 pass |
| PJ-1-16 AC4 | `public, s-maxage=86400`. `Authorization` 변형은 안 잼 | 일부 pass |
| PJ-1-19 AC1 | 페이지 3곳 200 (projects, projects/cnn-from-scratch, overview 글), `[MOCK]` 0. 화면의 글 제목 순서는 원본에 없음 | pass (순서 줄은 `00.tasks.md` 기록의 "00→07"에 의존) |
| PJ-1-19 AC2 | PJ-1-05 AC3 형태 3개 통과 (308, 308, 404). PJ-1-08 AC2는 나열된 형태 통과. `?tags=rust` 형태는 원본에 없음 | 일부 pass |
| PJ-1-19 AC3 | 2회째 `/@taeklim/projects` HIT | pass |
| PJ-1-19 AC4 | 이 절 | pass |
| PJ-1-18 AC2 | 0 FAIL | pass |
| PJ-2-04 | `/@taeklim/saved` DYNAMIC | pass |

### 원본에 없는 값

- 단계 1: mock 카드 키 집합 대조 결과.
- 단계 2: `priority`, `seq` 값, 같은 SQL `ORDER BY` 결과.
- 단계 3: `Authorization` 붙인 `cache-control`, `projects` 카테고리 없는 사용자의 응답.
- 단계 4: 목록 페이지에 보이는 글 제목 순서, 카드 제목 텍스트.
- 단계 5: `?tags=rust` 형태.

### 남은 것

- PJ-1-03 AC2–AC4: Express 예약 slug 400. 로그인한 토큰이 있어야 해서 재지 않았다.
  - 2026-10-14 측정함 (blog-api ab4c3c0, 오너 token): slug `Posts` 400, 제목 `Projects` 400, 예약 slug 행 0, `pj-guard-check` 성공 (draft id 247, 오너가 `/me`에서 지운다). 원본: `deploy/projects/pj-1-03-guard-2026-10-14.txt`.
- PJ-1-22: mock 은퇴. 진행 중이다.
- P1 gate review: reviewer가 한다.

### 판정

PJ-1-16, PJ-1-19, PJ-1-18의 AC 중 원본에 값이 있는 항목은 모두 pass다. 원본에 값이 없는 항목은 "일부 pass" 또는 "pending"으로 두었다. 이 절의 결과로 gate 통과를 선언하지 않는다. gate 판정은 reviewer의 몫이다.
