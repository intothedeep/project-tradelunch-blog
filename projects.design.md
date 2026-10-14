# 작성자 URL 재편 + Projects 화면 설계 (DRAFT, system-architect, 2026-10-13)

> 상태: 설계 초안 rev2. 코드 없음. 전략 선택은 오너가 한다.
> rev1 → rev2: 오너가 URL 체계를 velog 방식으로 바꿨다(2026-10-13, dispatch 경유). §1, §5, §8, §9를 새로 썼다.
> 위치 근거: 저장소 선례 `gcp.design.md`, `traffic.design.md`와 같은 루트 `*.design.md`다.
> `00.plan.md` 절과 `00.tasks.md` 행은 product-manager(pm)가 쓴다. 이 문서는 고치지 않는다.

## 0. Mission block (인용)

> - Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
> - Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)

- 원본: `00.plan.md` Phase PJ "Mission block". Constraints, G1, S1, M1–M5는 그곳만 본다.
- 블록은 `00.plan.md`에만 있다. 이 절은 인용만 한다 (`rules/docs.md` §0.1).

오너 요구 (2026-10-13, dispatch 경유 요약):

- URL은 velog를 본뜬다. `/@u/posts`, `/@u/projects`, `/@u/projects/<project>`, `/@u/<post-slug>`.
- 왼쪽 메뉴에 공개 항목 "Projects"를 둔다.
- 카드 항목: 썸네일(thumbnail), 프로젝트 이름, overview 글 제목, 글 수. overview는 priority 최소, 동률이면 seq 최소인 글이다.
- 프로젝트 글 목록은 priority ASC, seq ASC 순이다. slug마다 최신 revision만 쓴다.
- 오른쪽 aside는 projects tree다(B). 프로젝트 글 상세는 TOC 위, tree 아래다(F).
- 모바일은 접이식 메뉴다(E). `/blog`(All posts)는 그대로다(C).
- 사용자 아래로 더 옮긴다: `/@u/about`, `/@u/resume`, `/@u/saved`, `/@u/logs`, `/@u/logs/<logId>`.
- 단계: P1 = projects 화면 + `/@u/<slug>` + `/@u/posts` + 308 redirect + 예약 slug 검사.
- P2 = about, resume, saved, logs 이동. 나중 = 앱 전체 `cacheComponents`.

## 1. URL 지도 (route map)

### 1.1 velog 대응표

| velog | 우리 (P1 뒤) | 오늘 | 단계 |
| --- | --- | --- | --- |
| `/` | `/` | `(feed)/page.tsx` | 불변 |
| `/@u/posts` | `/@u/posts` | `/blog/@u` | P1 이동 |
| `/@u/<slug>` | `/@u/<slug>` | `/blog/@u/<slug>` | P1 이동 |
| `/@u/series` | `/@u/projects` | 없음 | P1 새로 |
| `/@u/series/<name>` | `/@u/projects/<project>` | 없음 | P1 새로 |
| `/@u/about` | `/@u/about` | 전역 `/about` (owner 전용 내용) | P2. 이름은 P1에서 예약 |
| 없음 | `/@u/resume` | 전역 `/resume` (owner 전용 내용) | P2 |
| 없음 (velog는 `/saved`) | `/@u/saved` | `/me/saved` (로그인한 본인 목록) | P2 |
| 없음 | `/@u/logs`, `/@u/logs/<logId>` | `/log/@u`, `/log/@u/<logId>` | P2 |
| `/tags/<tag>` | `/tags/<tag>` | `(feed)/tags/[tag]` | 불변 |
| `/@u` | `/@u` → 308 `/@u/posts` | 없음 | P1 |
| 없음 | `/blog` (All posts), `/log` (전체 로그) | `blog/page.tsx`, `log/page.tsx` | 불변 |
| 없음 | `/me` (내 초안) | `me/page.tsx` | 불변 |

### 1.2 흐름

```
왼쪽 메뉴 "Projects" ─► /@<owner>/projects                      카드 목록
                             │ 카드 클릭
                             ▼
                        /@<u>/projects/<project>                  프로젝트 글 목록
                             │ 글 클릭
                             ▼
왼쪽 메뉴 "My blog" ─► /@<u>/posts ── 글 클릭 ──► /@<u>/<slug>    글 상세 (모든 글이 이 URL 하나)

옛 URL ─ 308 ─► /blog/@<u>          → /@<u>/posts   (query 유지)
               /blog/@<u>/<slug>   → /@<u>/<slug>
               /@<u>               → /@<u>/posts
```

### 1.3 App Router 폴더

```
app/
├── (feed)/ about/ admin/ api/ blog/ log/ me/ onboarding/ resume/ sign-in/ sign-up/ write/
│                                       정적 폴더. 같은 깊이에서 [handle]보다 먼저 맞는다
└── [handle]/                           동적. '@'로 시작하지 않으면 notFound()
    ├── layout.tsx                      handle 검사만. shell 없음
    ├── page.tsx                        /@u → permanentRedirect('/@u/posts')
    ├── posts/
    │   ├── layout.tsx                  오늘 blog/[username]/layout.tsx 내용 (BlogShell + UserContextRail)
    │   └── page.tsx                    오늘 blog/[username]/page.tsx 내용
    ├── projects/
    │   ├── layout.tsx                  BlogShell + ProjectsRail
    │   ├── page.tsx                    카드 목록
    │   └── [project]/page.tsx          글 목록
    ├── about/ resume/ saved/           P2 (§5.3)
    ├── logs/  logs/[logId]/            P2 (§5.3)
    └── [slug]/
        ├── layout.tsx                  BlogShell + 글 종류로 고른 rail (§4.2)
        ├── page.tsx                    글 상세
        └── opengraph-image.tsx         blog/[username]/[slug]/에서 이동
```

결정과 이유:

- `@u` 폴더 이름은 쓰지 않는다. `@x` 폴더는 parallel route slot이다. 그래서 동적 폴더 `[handle]`을 쓴다.
- `[handle]`은 문자열을 디코드한 뒤 `@`로 시작하는지 본다. `%40`도 같은 값이 된다. 아니면 `notFound()`다.
- 이 검사가 `/apple-touch-icon.png` 같은 없는 파일 요청도 404로 막는다.
- handle 공간은 `@`로 시작하고 정적 최상위 폴더는 `@`로 시작하지 않는다. 그래서 둘은 겹치지 않는다.
- `[handle]` 아래에서 `posts`, `projects`는 정적이라 `[slug]`보다 먼저 맞는다. 그래서 slug가 `posts`인 글은 열 수 없다. §2가 막는다.
- `<project>` = 카테고리 `title` 원문이다. 링크는 `encodeURIComponent`, SQL은 정확 일치(`=`)로 찾는다.
- 프로젝트 이름 유일성 근거: `categories_user_title_key UNIQUE (user_id, title)` (`packages/db/schema/tradelunch.schema.sql` 130행).
- 상세 URL이 하나라서 rev1의 중복 콘텐츠(canonical) 문제와 소속 검사 문제가 사라진다.

## 2. 예약 slug (reserved slug)

### 2.1 목록과 위치

- 상수: `RESERVED_HANDLE_SEGMENTS = ['posts', 'projects', 'about', 'resume', 'saved', 'logs']`.
- P2 폴더(about, resume, saved, logs)의 이름도 P1에서 함께 예약한다. 그래야 P2 전에 그 slug의 글이 생기지 않는다.
- TS 원본: `packages/types/src/routes.ts`(`@repo/types`). 웹과 Express가 import한다.
- Python 사본: `apps/blog_agent/configs/routes.py`. 주석에 TS 원본 경로를 적는다. storage 모듈의 TS/Py 사본과 같은 방식이다.
- 비교는 소문자로 한다.
- `[handle]` 아래에 정적 폴더를 새로 만들면 먼저 이 상수에 넣는다. 그리고 §2.3 검사를 돌린다.

### 2.2 쓰기 경로 두 곳에서 막는다

| 경로 | 막는 곳 | 동작 |
| --- | --- | --- |
| Express 생성 | `posts.write.ts` 87행, `slug` 확정 직후 | 400 `slug is reserved: <slug>`. 제목에서 만든 slug도 같다 |
| Express 수정 | PATCH의 `slug`가 있을 때 (`helpers/writePost.ts` `updatePost` 앞) | 400 같은 메시지 |
| blog_agent | `db/repositories/post.py` `create_post`, `upsert_post` 입구 | `ValueError`. 모든 발행 경로가 여기를 지난다 |
| blog_agent 앞단 | `scripts/publish_oneshot.py`, slug 확정 직후 | 같은 검사를 먼저 해서 이미지 업로드 전에 멈춘다 |

- 조용히 바꾸지 않는다(`posts` → `posts-1` 금지). slug는 폴더 이름이고 원본 표현이다(MEMORY "Source representation first").
- DB CHECK 제약은 스키마 변경이라 쓰지 않는다. 대안으로만 적는다.

### 2.3 기존 충돌 확인 쿼리 (read-only, main session 또는 오너가 실행)

```sql
SELECT p.id::text, u.username, p.slug, p.status, p.created_at
FROM posts p JOIN users u ON u.id = p.user_id
WHERE p.deleted_at IS NULL
  AND lower(p.slug) IN ('posts', 'projects', 'about', 'resume', 'saved', 'logs')
ORDER BY u.username, p.slug, p.created_at DESC;
```

- 0행이면 통과다. 1행 이상이면 오너가 slug를 정한다. 행을 지우지 않는다.

## 3. 데이터 계약 (data contract)

### 3.1 기존 endpoint로 되는가

| 기존 endpoint | 쓸 곳 | 모자란 점 |
| --- | --- | --- |
| `GET /v1/api/posts/users/:u/categories` (tree) | aside tree, 상세 rail 선택 | 썸네일이 없다. `seq`가 없다. path 정렬은 이미 priority → seq 순이다 |
| `GET /v1/api/posts/users/:u/category/:categoryId` | 없음 | `id DESC` 정렬. `priority`, `seq`가 없다. keyset 페이지. 옛 `res.json` 형식 |
| `GET /v1/api/posts/slug/:slug` | 상세 본문 | 없음. `PostContentCard`가 그대로 쓴다 |

결론: 카드와 글 목록에는 새 read 경로가 필요하다. tree와 상세는 재사용한다.

### 3.2 옵션 A/B/C

모든 옵션은 초안 G1(hand-back, "세 경로가 요구 순서대로 렌더된다")을 섬긴다.

| 옵션 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| **A 안정(stable), 권고** | 새 controller `posts.user-projects.ts` 1개, 경로 2개. tree와 상세는 재사용 | 기존 SQL 무변경. 스키마 무변경. 정렬과 썸네일을 SQL이 정한다 | Express 파일 1개 추가 |
| B 확장(scalable) | tree 경로에 `?root=projects`와 썸네일 join 추가. 카드와 목록은 Next 서버가 계산 | endpoint 수가 그대로다 | "byte-for-byte" 고정 SQL(`posts.user-categories.ts` 10행)을 건드린다. 모든 블로그 페이지 응답이 커진다 |
| C 최신(cutting-edge) | DB view 또는 materialized view(MV) `v_user_projects` | 읽기가 가장 단순하다 | 스키마 변경. "스키마 변경 없음 우선" 제약에 걸린다. 버림 |

### 3.3 새 경로 (옵션 A)

공통 규칙:

- 파일: `apps/dashboard_server/src/controllers/posts/posts.user-projects.ts`. `posts.ts`에서 등록한다.
- `optionalAuth`. viewer = `req.auth?.userId ?? -1`. 조건 `(p.status = 'public' OR p.user_id = $viewer)`.
- 응답은 `sendOk` / `sendError` envelope `{ success, data }`.
- 캐시: `setPostReadCache(req, res)`. 익명 = `public, s-maxage=86400`. 로그인 = `private, no-store`.
- BIGINT id는 문자열이다. `::text`로 내보내고 문자열로 바인딩한다. `parseInt` 금지.
- 상수 `PROJECTS_ROOT_CATEGORY_TITLE = 'projects'`도 `packages/types/src/routes.ts`에 둔다.

| Method · 경로 | 응답 `data` | 오류 |
| --- | --- | --- |
| `GET /v1/api/posts/users/:username/projects` | `{ projects: TProjectCard[] }` | 사용자 없음 404. `projects` 카테고리 없음 → 200 `[]` |
| `GET /v1/api/posts/users/:username/projects/:project` | `{ project: TProjectRef, posts: TProjectPost[] }` | 프로젝트 없음 404 |

타입 (`packages/types/src/project.ts`, 필드 이름은 기존 `TTreeNode`처럼 snake_case):

```ts
export interface TProjectRef {
    project_id: string;   // categories.id, BIGINT 문자열
    project: string;      // categories.title = URL 칸
}

export interface TProjectCard extends TProjectRef {
    post_count: number;   // 하위 카테고리 포함, slug 중복 제거 후
    overview: {
        post_id: string;  // BIGINT 문자열
        slug: string;
        title: string;
        stored_uri: string | null; // files.is_thumbnail
    } | null;             // 보이는 글이 0개면 null
}

export interface TProjectPost {
    id: string;           // BIGINT 문자열
    slug: string;
    title: string;
    description: string | null;
    priority: number;
    seq: string;          // int8, 문자열
    stored_uri: string | null;
    status: string;
    created_at: string;
    updated_at: string;
}
```

### 3.4 데이터 흐름 (data flow)

```
카드 페이지  → getProjects.api (cache)     → PROJECTS_DATA_SOURCE ─ mock: mocks/projects/cards.json   (MVP1)
                                                                 └ real: GET /users/:u/projects → SQL §3.5 (MVP2~)
목록 페이지  → getProjectPosts.api (cache) → 같은 전환 ─ mock: posts.json (MVP1) | real: GET /users/:u/projects/:project (MVP2~)
aside tree   → getProjectsTree.api (cache) → getCategoriesByUsername → GET /users/:u/categories   (MVP1부터 real)
상세 rail    → getProjectsTree.api (같은 요청에서 공유) → slug가 projects 아래인가
상세 본문    → PostContentCard → getPostBySlug → GET /posts/slug/:slug                         (MVP1부터 real)
```

### 3.5 SQL 초안 (카드 목록)

```sql
WITH RECURSIVE
root AS (            -- 'projects' 카테고리. 깊이와 무관하게 title로 찾는다
  SELECT c.id FROM categories c JOIN users u ON u.id = c.user_id
  WHERE u.username = $1 AND u.deleted_at IS NULL
    AND c.title = $3 AND c.deleted_at IS NULL          -- $3 = 'projects'
),
project AS (         -- 프로젝트 = root의 직계 자식
  SELECT c.id, c.title, c.priority, c.seq
  FROM categories c JOIN root r ON c.parent_id = r.id
  WHERE c.deleted_at IS NULL
),
subtree AS (         -- 프로젝트별 하위 카테고리 전부
  SELECT p.id AS project_id, p.id AS category_id FROM project p
  UNION ALL
  SELECT s.project_id, c.id FROM categories c
  JOIN subtree s ON c.parent_id = s.category_id
  WHERE c.deleted_at IS NULL
),
latest AS (          -- slug 중복 제거를 프로젝트로 거르기 "전에" 한다 (tree와 같음)
  SELECT p.id, p.seq, p.slug, p.title, p.priority, p.category_id,
         ROW_NUMBER() OVER (PARTITION BY p.slug
                            ORDER BY p.created_at DESC, p.id DESC) AS rn
  FROM posts p JOIN users u ON u.id = p.user_id
  WHERE u.username = $1 AND u.deleted_at IS NULL AND p.deleted_at IS NULL
    AND (p.status = 'public' OR p.user_id = $2)
),
ranked AS (
  SELECT s.project_id, l.*,
         ROW_NUMBER() OVER (PARTITION BY s.project_id
                            ORDER BY l.priority ASC, l.seq ASC) AS ord
  FROM latest l JOIN subtree s ON s.category_id = l.category_id
  WHERE l.rn = 1
)
SELECT pr.id::text AS project_id, pr.title AS project,
       (SELECT COUNT(*) FROM ranked k WHERE k.project_id = pr.id)::int AS post_count,
       ov.id::text AS overview_post_id, ov.slug, ov.title, th.stored_uri
FROM project pr
LEFT JOIN ranked ov ON ov.project_id = pr.id AND ov.ord = 1
LEFT JOIN LATERAL (
  SELECT f.stored_uri FROM files f
  WHERE f.post_id = ov.id AND f.is_thumbnail = true AND f.deleted_at IS NULL
  ORDER BY f.id DESC LIMIT 1          -- 썸네일 행이 둘이어도 카드는 하나
) th ON true
ORDER BY pr.priority ASC, pr.seq ASC;  -- tree path와 같은 순서
```

- 글 목록 SQL: 같은 CTE에 `AND pr.title = $4`를 둔다. `ranked`를 `ORDER BY priority, seq`로 반환하고 LATERAL 썸네일을 붙인다.
- `f.deleted_at IS NULL`을 넣는다. `posts.user-categories.ts`는 넣고 `posts.detail.ts`는 넣지 않는다. 더 엄격한 쪽을 따른다.
- 페이지 나누기(pagination)는 없다. 오늘 8개다. 기준은 §11 Q7.

## 4. 페이지별 컴포넌트 tree (component tree)

새 컴포넌트는 `app/[handle]/components/`, `apis/`, `utils/`에 둔다. `components/rail/*`은 import만 한다.

### 4.1 `/@u/posts` 와 `/@u/projects/*`

```
posts/layout.tsx (server)      = 오늘 blog/[username]/layout.tsx 그대로 (이동)
posts/page.tsx (server)        = 오늘 blog/[username]/page.tsx 그대로 (이동). canonical만 /@u/posts

projects/layout.tsx (server)
└─ BlogShell (재사용)
   ├─ leftRail:  LeftRailContainer (재사용, 무변경)
   ├─ main:      {children}
   └─ rightRail: RightRail (재사용) → ProjectsRail (server, 새)          §4.3

projects/page.tsx (server)                      카드 목록
├─ div.lg:hidden → MobileCategory (재사용) → ProjectsTreeWrapper bare
└─ ProjectCardGrid (server, 새)
   └─ ProjectCard ×N: thumbnail · project · overview.title · post_count
      └─ Link prefetch={false} → /@u/projects/<project>

projects/[project]/page.tsx (server)            글 목록
├─ div.lg:hidden → MobileCategory → ProjectsTreeWrapper bare
├─ 제목: project · post_count
└─ ProjectPostList (server, 새)
   └─ ProjectPostRow ×N: 순번 · thumbnail · title · description
      └─ Link prefetch={false} → /@u/<slug>
```

### 4.2 `/@u/<slug>` 상세: 글 종류로 rail을 고른다

`[slug]/layout.tsx`는 `handle`과 `slug`를 둘 다 받는다. 그래서 여기서 고른다.

```
[slug]/layout.tsx (server)
├─ isProjectPost = getProjectsTree(u).projectOfSlug[slug] 가 있는가
└─ BlogShell
   ├─ rightRail: isProjectPost ? ProjectsRail : UserContextRail (오늘과 같음)
   └─ mobileTopContext: isProjectPost ? 없음 : MobileContextHeader (오늘과 같음)

[slug]/page.tsx (server)
├─ generateMetadata: canonical = /@u/<slug>   (오늘 blog 상세의 로직 이동)
├─ JsonLd (재사용). breadcrumb: Home → @u → 글
├─ isProjectPost 일 때
│  ├─ div.lg:hidden → MobileToc (재사용)                           1 TOC 위
│  │                 → MobileCategory → ProjectsTreeWrapper bare   2 tree 아래
│  ├─ Suspense → PostContentCard (재사용, 무변경)
│  └─ Suspense → PostContentToc (재사용)                            TOC atom 발행
└─ 아니면 PostContent (재사용) 그대로                                오늘과 같음
```

- 프로젝트 글은 `PostContent`를 쓰지 않는다. 그 안에 `MobileToc`가 있어서 tree를 TOC 아래에 둘 수 없다.
- 네 조각은 모두 export되어 있다. 페이지가 직접 조합한다.
- `getProjectsTree`는 `cache()`라서 layout과 page가 한 요청에서 한 번만 부른다.

### 4.3 aside: `ProjectsRail`

```
>= lg 오른쪽 rail
┌──────────────────────────────┐
│ RightRailToc (재사용)          │  목록 페이지: atom이 비어 null
│                               │  상세 페이지: 1 TOC (요구 F)
├──────────────────────────────┤
│ ProjectsTreeCard              │  2 projects tree (요구 B, F)
│   > PROJECTS                  │
│   ▾ CNN-FROM-SCRATCH   8      │  현재 프로젝트 강조
│      · 글 1                   │  현재 글 강조 (pathname 기준)
└──────────────────────────────┘
```

- 조건 분기가 없다. `RightRailToc`가 빈 atom에서 null을 낸다(`RightRailToc.client.tsx` 7–11행).
- 프로필 카드와 태그 구름(tag cloud)은 넣지 않는다. 오너 B/F가 두 블록만 적었다.
- 왼쪽 rail의 `RecentVisited`는 그대로 둔다(요구 C). §11 Q1에서 확인한다.

| 새 파일 | 종류 | 내용 |
| --- | --- | --- |
| `ProjectsRail.server.tsx` | server | `RightRailToc` + `CategoryErrorBoundary`(재사용) 안의 `ProjectsTreeWrapper` |
| `ProjectsTreeWrapper.server.tsx` | server | `auth()` token → `getProjectsTree` → `ProjectsTree` |
| `ProjectsTree.client.tsx` | client | `buildCategoryTree` + `CategoryTree` 재사용. 자체 `onSelectNode`, `selectedNode` |
| `apis/getProjects.api.ts`, `apis/getProjectPosts.api.ts` | server, `cache()` | mock/real 전환(§8) |
| `apis/getProjectsTree.api.ts` | server, `cache()` | `getCategoriesByUsername` + 자르기 |
| `utils/projects-tree.ts` | 순수 | `sliceProjectsSubtree(nodes)` → `{ nodes, projectOfSlug }` |

- `CategorySidebar`는 재사용하지 않는다. 클릭이 블로그 경로로 가거나 블로그 필터를 바꾼다(`CategorySidebar.client.tsx` 45–70행).
- 클릭: `projects` 노드 → `/@u/projects`. 프로젝트 노드 → `/@u/projects/<project>`. 글 노드 → `/@u/<slug>`.
- 강조: `usePathname()`에서 project 또는 slug를 읽어 노드 id를 `selectedNode`로 넘긴다.
- 이동은 `router.push`다. prefetch가 없다.
- `cache()`는 위치 인자(원시값)로 부른다. `getPost.api.ts` 8–17행의 주의와 같다.

## 5. 이동과 308 redirect

### 5.1 redirect 규칙

| 옛 URL | 새 URL | 방법 |
| --- | --- | --- |
| `/blog/@u` (+ query) | `/@u/posts` (+ query) | `next.config.ts` `redirects()`, `permanent: true` (308) |
| `/blog/@u/<slug>` | `/@u/<slug>` | 같음 |
| `/blog/@u/<slug>/opengraph-image` | `/@u/<slug>/opengraph-image` | 같음 |
| `/@u` | `/@u/posts` | `[handle]/page.tsx` `permanentRedirect` |

- `next.config` redirect는 middleware(Clerk)보다 먼저 돈다. 그래서 응답에 쿠키가 없고 Cloudflare가 저장할 수 있다.
- source 예: `/blog/:handle(@[^/]+)`, `/blog/:handle(@[^/]+)/:slug`. `%40` 형태가 맞는지는 developer가 dev 서버에서 확인한다.
- `%40`이 안 맞거나 `@` 없는 옛 형태(`/blog/taek`)가 있으면 대안을 쓴다. `app/blog/[username]/` 페이지를 `permanentRedirect` 한 줄 stub로 남긴다.
- `/blog` (All posts)는 redirect하지 않는다.
- 배포 뒤 Cloudflare에 옛 HTML이 24시간 남는다. `cf-purge.sh`로 `/blog/@*`를 지운다.

### 5.2 앱 안의 링크

- `/blog/@` 문자열이 23개 파일, 37곳에 있다(웹 22파일 + `blog_agent/agents/uploading_agent.py`).
- 한 곳으로 모은다: `utils/routes.ts` `postsPath(u)`, `postPath(u, slug)`, `projectsPath(u)`, `projectPath(u, project)`.
- 순서: redirect를 먼저 배포한다. 그러면 옛 링크도 모두 동작한다. 링크 교체는 그 뒤에 파일별로 한다.
- #70 파일(`components/rail/*`, `RecentPostCard`, `PostContentCard`)의 링크는 #70 커밋 뒤에 바꾼다. 그 사이 redirect가 받는다.
- 글 본문 안의 옛 링크는 고치지 않는다. redirect가 받는다.
- `sitemap.ts`: 글 URL을 `/@u/<slug>`로 바꾼다. 옛 URL이 sitemap에 남으면 안 된다.
- `/@owner/posts`의 canonical은 오늘처럼 `/`다(`HOME_FEED_AUTHOR`).
- 메뉴(`hooks/useNavLinks.hook.ts`): "My blog" → `/@u/posts`. 새 "Projects" → `/@${HOME_FEED_AUTHOR}/projects`, 로그인 불필요.

### 5.3 P2: about, resume, saved, logs를 사용자 아래로

| 새 URL | 오늘 | 내용의 주인 | 옛 URL 처리 |
| --- | --- | --- | --- |
| `/@u/about` | `/about` | owner 한 명 (코드에 박힌 내용, `app/MainPage.tsx`) | `/about` → 308 `/@<owner>/about` |
| `/@u/resume` | `/resume` | owner 한 명 (코드에 박힌 내용) | `/resume` → 308 `/@<owner>/resume` |
| `/@u/saved` | `/me/saved` | 보는 사람 본인 (viewer별) | `/me/saved` → 307 `/@<viewer>/saved` |
| `/@u/logs` | `/log/@u` | 작성자 u | 308 |
| `/@u/logs/<logId>` | `/log/@u/<logId>` | 작성자 u | 308 |

#### about, resume: 두 안

| 안 | 내용 | 데이터 | 비용 |
| --- | --- | --- | --- |
| **최소(권고, P2)** | 오늘 페이지를 옮긴다. `@<HOME_FEED_AUTHOR>`만 렌더, 다른 handle은 `notFound()` | 없음 (코드에 박힌 그대로) | S |
| 전체 (나중) | 사용자별 내용. 사용자의 `about` 카테고리 글 1개를 렌더한다. resume는 그 글의 첨부 PDF | 기존 posts, categories, files. 스키마 변경 없음 | M. 편집 화면, 빈 상태, SEO |

- 최소 안에서 `/about`, `/resume`은 308로 보낸다. URL을 하나로 둔다. 둘 다 두면 canonical만 남고 메뉴가 둘로 갈린다.
- 308 대상은 빌드 때 정해진다. `HOME_FEED_AUTHOR`는 `NEXT_PUBLIC_` env라서 `next.config.ts`가 읽을 수 있다. 빈 값이면 redirect를 만들지 않고 옛 페이지를 둔다.
- 메뉴 About, Resume href = `/@${HOME_FEED_AUTHOR}/about`, `/resume`.
- 전체 안은 카테고리 title `about`을 쓴다. 예약 slug `about`과 겹치지 않는다(카테고리 title은 URL 칸이 아니다).

#### saved: 본인만 본다

```
요청 /@u/saved
  │
  ├─ proxy.ts matcher에 '/@*/saved' 추가 → 로그인 안 함 → sign-in 으로 (돌아올 URL 포함)
  │
  └─ 페이지 (server, 얇은 shell, auth를 읽지 않음)
       └─ SavedOwnerGate (client 잎): useUser().username === u ?
              ├─ 예  → SavedPostsList (재사용, 본인 token으로 조회)
              └─ 아니오 → 404 화면 (데이터 조회 없음)
```

- 데이터는 보는 사람 본인의 것이다. 그래서 본래 dynamic이다. auth 읽기는 잎(client gate)에만 둔다.
- 다른 사용자는 404 화면을 본다. HTTP 상태는 200일 수 있다. `robots: noindex`를 붙여서 색인되지 않게 한다.
- 정확한 404 상태가 필요하면 대안: 서버 page 맨 위에서 `auth()`로 비교하고 `notFound()`. 그러면 route가 dynamic이다. 본래 dynamic이라 손해는 작다. Q14.
- Cloudflare: `/@*/saved`는 언제나 BYPASS여야 한다. 로그인 쿠키 기준 BYPASS가 이미 있어도 path 규칙을 하나 더 둔다.
- `robots.ts`에 `/@*/saved` disallow를 더한다.
- `/me/saved`는 viewer마다 대상이 달라서 `next.config` redirect로 못 한다. 페이지 stub에서 `redirect()`(307)로 보낸다.
- 메뉴 Saved href = `/@${viewer}/saved`. 사용자 이름이 없으면 오늘 "My blog"처럼 숨긴다.

#### logs

- `app/log/[username]/`, `[logId]/`를 `app/[handle]/logs/`로 옮긴다. 내용은 그대로다.
- `[logId]`는 BIGINT 문자열이다. 그대로 넘긴다. `Number()` 금지.
- `[logId]/page.tsx`의 canonical redirect(작성자 이름이 다르면 옮김, 36–40행)는 새 URL을 만든다.
- 링크 만드는 곳(`toUsernameSegment`, `components/log/*`)은 `utils/routes.ts`의 `logsPath`, `logPath`로 모은다.
- `/log` (전체 로그 피드)는 그대로 둔다. `/blog`와 같은 이유다.

#### 왜 P2인가

- P1은 오너가 정한 묶음이다(projects + posts + 상세 + redirect + 예약).
- about, resume, saved, logs는 projects 화면과 데이터가 섞이지 않는다. 같은 `[handle]` 골격과 redirect 방식만 다시 쓴다.
- saved는 인증과 Cloudflare BYPASS 규칙이 새로 필요하다. P1에 넣으면 P1 gate의 검사 범위가 커진다.
- 예약 이름 6개는 P1에서 막는다. 그래서 P2를 미뤄도 slug 충돌이 생기지 않는다.

## 6. 모바일 (< lg)

| 페이지 | main 위쪽, `lg:hidden` |
| --- | --- |
| `/@u/posts` | 오늘과 같음 |
| `/@u/projects`, `/@u/projects/<project>` | `MobileCategory`("Projects") → tree bare |
| `/@u/<slug>` 프로젝트 글 | `MobileToc` 위 → `MobileCategory`("Projects") 아래 → 본문 |
| `/@u/<slug>` 다른 글 | 오늘과 같음 (`MobileContextHeader` + `PostContent` 안 `MobileToc`) |

## 7. 캐시, prefetch, cacheComponents

### 7.1 P1 규칙

| 항목 | 규칙 |
| --- | --- |
| 새 Express 경로 | `setPostReadCache` 필수. 빠지면 매 요청이 MISS다 |
| 새 `Link` | 전부 `prefetch={false}` (#70과 같음) |
| tree 이동 | `router.push`. prefetch 없음 |
| 308 응답 | 쿠키 없음. Cloudflare가 저장한다 |
| Cloudflare 규칙 | `/@*` 경로가 Phase TC HTML 캐시 규칙과 표본에 들어가야 한다. 오늘 규칙이 `/blog/*`를 이름으로 잡으면 고친다(§11 Q6) |

### 7.2 velog 글이 말하는 규칙

- 글: https://velog.io/@k-svelte-master/nextjs-slow-1-dynamic-rsc-prefetch (main session 요약을 따른다. 이 문서는 원문을 열지 않았다).
- 요약: `cookies()`, `headers()`, `auth()`, `searchParams` 중 하나라도 읽으면 route 전체가 dynamic이다.
- 그러면 RSC prefetch가 static shell을 못 받고, client router cache가 0초다.
- 처방: `cacheComponents: true`. dynamic 읽기를 Suspense 잎(leaf)으로 내린다. params는 잎에서 읽는다. 자주 보는 칸은 `generateStaticParams`. `staleTimes`를 의도해서 정한다.

오늘 상태 (main session이 확인, 이 문서가 다시 확인):

| 위치 | dynamic 읽기 | 영향 |
| --- | --- | --- |
| `app/layout.tsx` 105행 | `getLocale()` (headers) | 모든 route |
| `components/shell/BlogShell.server.tsx` 44행 | `cookies()` `railCollapsed` | shell을 쓰는 모든 route |
| `components/rail/LeftRailContainer.server.tsx` 15행 | `cookies()` | 같음 |
| `app/about/layout.tsx` 21행 | `cookies()` | `/about` |
| `app/blog/[username]/[slug]/page.tsx` 42, 94행 | `auth()` (metadata, JSON-LD) | 상세 |
| `components/blog/PostContentCard.server.tsx` 30행 | `auth()` | 상세. 이미 Suspense 안 |
| `app/blog/[username]/page.tsx` 1행 | `force-dynamic` | `cacheComponents`와 함께 쓸 수 없다 |
| `next.config.ts` | `cacheComponents`, `staleTimes` 없음 | 기본값 |

결론: 오늘 모든 route가 dynamic이다. P1의 새 route도 shell 때문에 dynamic이다.

### 7.3 (i) P1: 새 route를 `cacheComponents` 준비 상태로 만든다

새 파일이 지킬 것:

- `export const dynamic`을 쓰지 않는다. 옮기는 `posts/page.tsx`에서도 뺀다.
- page와 layout 맨 위에서 `auth()`, `cookies()`, `headers()`를 읽지 않는다.
- `auth()`는 Suspense 안 잎에서만 읽는다: `ProjectsTreeWrapper`, `PostContentCard`, JSON-LD 잎.
- 상세의 `generateMetadata`는 token 없이 공개 글로 만든다. 비공개 글 metadata는 작성자에게도 일반값이다. 이 차이는 Q11에서 확인한다.
- params는 그것을 쓰는 잎에 넘긴다. layout이 데이터를 미리 읽지 않는다. 예외: `[slug]/layout.tsx`의 rail 선택(§4.2)은 tree 한 번을 읽는다.
- 남는 막힘은 `BlogShell`과 `LeftRailContainer`의 `cookies()`다. P1은 이 둘을 고치지 않는다.

### 7.4 (ii) 앱 전체 `cacheComponents`: 별도 phase "CC" (나중)

| 막힘 | 처방 | 비용 | 위험 |
| --- | --- | --- | --- |
| root layout `getLocale()` (headers) | locale은 오늘 언제나 `en`이다(`proxy.ts` 13–24행). `i18n/request.ts`가 고정 `en`을 내고 `setRequestLocale('en')` | S | next-intl 버전별 API 차이. 한국어 전환 UI를 다시 열 때 다시 설계 |
| `BlogShell`, `LeftRailContainer`의 `cookies()` | 접힘 상태를 client에서 읽는다. 또는 Suspense 잎으로 | M | 첫 화면에서 rail 폭이 한 번 바뀔 수 있다 |
| 상세 `generateMetadata`, JSON-LD의 `auth()` | 공개 값으로 만들고, 작성자 전용 값은 잎으로 | S | 비공개 글 metadata |
| `force-dynamic` (blog 계열) | 제거 | S | 없음 |
| 모든 fetch | `'use cache'` + `cacheLife` 또는 Suspense 안 dynamic | M | 공개 글 갱신 지연. 오늘 정책(edge 24h, 배포 뒤 purge)과 맞춘다 |
| 빌드 | 빌드가 "Suspense 밖 uncached data" 오류를 낸다. 모두 고쳐야 빌드가 된다 | M | 빌드는 GH Actions에서만(Phase GCP) |

- 정정 (2026-10-13, `cc.design.md` §11): 첫 행 `getLocale()`은 막힘이 아니다. `i18n/request.ts`가 `requestLocale`을 읽지 않아 `headers()`가 불리지 않는다. CC 설계와 순서는 `cc.design.md`가 이어받는다.
- 판정: 할 수 있다. 하지만 P1에 넣지 않는다. 막힘이 모든 route에 걸쳐 있다. big-bang 이전이 된다(MVP 사다리 "Repeat" 위반).
- 따로 쉬운 것: `experimental.staleTimes.dynamic = 30`. client router cache가 30초 동안 페이지를 다시 쓴다. 뒤로 가기와 다시 방문 요청이 준다. 좋아요 수가 30초 늦을 수 있다. CC phase 첫 행으로 둔다.

### 7.5 (iii) #70 prefetch 줄이기와의 관계

- #70의 목적: 화면에 보이는 링크의 자동 prefetch가 Cloudflare 요청 수를 늘렸다(429). 그래서 hover prefetch나 `prefetch={false}`로 줄인다.
- P1은 #70과 같은 방향이다. 새 링크는 모두 `prefetch={false}`다.
- `cacheComponents`를 켜면 prefetch 한 번의 값이 커진다(static shell). 하지만 요청 수는 줄지 않는다. 링크마다 요청이 하나다.
- 그래서 순서: #70 먼저(요청 수). CC는 나중(요청당 비용). CC 뒤에도 viewport prefetch를 다시 켜지 않는다. 다시 켜려면 Cloudflare `_rsc` 응답 HIT를 먼저 측정한다.
- Cloudflare는 `Vary`로 key를 나누지 않는다(`proxy.ts` 22–24행). RSC 응답은 `_rsc` query로 URL이 달라야 한다. CC가 이 성질을 바꾸지 않는지 CC phase에서 확인한다.

## 8. MVP 사다리 대응 (P1)

`.claude/CLAUDE.md` "System build phasing"을 인용한다. 다시 쓰지 않는다.

| 단계 | 진짜(real) | mock | 끝-끝 순환(end-to-end cycle) |
| --- | --- | --- | --- |
| MVP1 모양 | `[handle]` 폴더, `/@u/posts`, `/@u/<slug>`, redirect, 예약 slug 검사, tree, 메뉴 | 새 Express 경로 2개의 응답 | 메뉴 → 카드 → 목록 → 상세가 렌더된다. 옛 URL이 308로 온다. 강조가 pathname을 따른다. 예약 slug 생성이 400과 `ValueError`로 멈춘다 |
| MVP2 진짜 조각 | + `GET .../projects`, `GET .../projects/:project` | fallback으로 남김 | 같은 순환이 real로 돈다. mock과 같은 타입을 만족한다 |
| MVP3 이전 완료 | 전부. 링크 교체(#70 파일 포함), sitemap | 두 fetcher의 mock 경로 은퇴(`x_` 접두) | 기본값 real. `/@*` 엣지 HIT, 308 HIT 확인 |

- URL 이동과 예약 slug는 기다리는 backend가 없다. 그래서 MVP1부터 real이다(사다리 "real data exists and no backend is needed").
- mock 위치: `apps/dashboard_client_web/mocks/projects/{cards,posts}.json`. 다른 데이터와 섞지 않는다.
- mock 표시: id는 `9990000000000000001`부터. 제목은 `[MOCK] ` 접두. `stored_uri`는 `null`.
- mock slug: 실제 cnn-from-scratch 글 slug를 쓴다. 그래야 상세 단계가 real 본문을 열고 순환이 끝까지 돈다.
- 전환: 서버 전용 env `PROJECTS_DATA_SOURCE=mock|real`. `env.schema.ts`(zod)에 둔다. 운영(prod) 값은 언제나 `real`이다. mock은 배포하지 않는다.
- 스키마 계약: `@repo/types`의 `TProjectCard`, `TProjectPost`, `RESERVED_HANDLE_SEGMENTS`. real이 타입을 바꿔야 하면 그 조각은 MVP1로 돌아간다.

## 9. 설계 단위 (design units, 크기와 순서만, 일정 없음)

| # | 단위 | 단계 | 크기 | 선행 |
| --- | --- | --- | --- | --- |
| U1 | `@repo/types`: `routes.ts`(예약 목록, `projects` 상수), `project.ts` 타입 | MVP1 | S | 없음 |
| U2 | §2.3 충돌 쿼리 실행과 결과 기록 (main session 또는 오너) | MVP1 | S | 없음 |
| U3 | 예약 slug 검사: Express 생성과 수정 | MVP1 | S | U1 |
| U4 | 예약 slug 검사: blog_agent repository + `publish_oneshot` + Py 사본 | MVP1 | S | U1 |
| U5 | `app/[handle]` 골격: handle 검사, `/@u` 308, `posts/`로 이동, `[slug]/`로 이동(OG 포함) | MVP1 | M | 없음 |
| U6 | `next.config.ts` redirect 3줄 + `%40`, 무`@` 확인. 필요하면 stub 대안 | MVP1 | S | U5 |
| U7 | `utils/routes.ts` + 메뉴(My blog, Projects) + i18n `nav.projects` (en, ko) | MVP1 | S | U5. 아이콘 1줄은 #70 뒤 |
| U8 | mock fixture + `getProjects`, `getProjectPosts` + env 전환 | MVP1 | S | U1 |
| U9 | `utils/projects-tree.ts` + `getProjectsTree` + `ProjectsTree*` + `ProjectsRail` | MVP1 | M | U1 |
| U10 | `projects/` layout, 카드 페이지, 글 목록 페이지, 모바일 accordion | MVP1 | M | U8, U9 |
| U11 | `[slug]/` layout과 page의 rail 선택, 프로젝트 글 조합 | MVP1 | M | U5, U9 |
| U12 | Express `posts.user-projects.ts` 두 경로 | MVP2 | M | U1 |
| U13 | fetcher real 전환 + mock과 응답 비교 | MVP2 | S | U8, U12 |
| U14 | 링크 교체: #70 밖 파일 + `uploading_agent.py` + `sitemap.ts` | MVP3 | M | U7 |
| U15 | 링크 교체: #70 파일 | MVP3 | S | #70 커밋 |
| U16 | mock 은퇴, Cloudflare 규칙과 purge, `/@*` HIT 확인 | MVP3 | S | U13, U14 |

나중 phase (P1 밖):

| # | P2 단위 (§5.3) | 크기 |
| --- | --- | --- |
| P2-1 | `/@u/about`, `/@u/resume` 최소 안: 이동 + owner만 렌더 + 308 + 메뉴 | S |
| P2-2 | `/@u/saved`: matcher, `SavedOwnerGate`, `/me/saved` 307 stub, robots, Cloudflare BYPASS | M |
| P2-3 | `/@u/logs`, `/@u/logs/<logId>`: 이동 + 308 + 링크 builder | M |
| P2-4 | about, resume 전체 안 (사용자별) | M. 오너가 고를 때만 |

| phase | 내용 |
| --- | --- |
| CC | §7.4 표. 첫 행은 `staleTimes` |
| 후속 | `getPostBySlug`에 `username` 전달. 오늘 slug 조회가 전역이라 `/@a/<b의 slug>`가 b의 글을 연다. `PostContentCard`(#70 파일) 수정이 필요하다 |

## 10. 위험과 다른 세션과의 충돌

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| #70 세션이 `components/rail/*`, `RecentPostCard`, `PostContentCard` 수정 중 | 링크 교체와 아이콘 1줄이 겹친다 | redirect를 먼저 배포한다. 그 파일들은 U15로 #70 뒤에 한다 |
| `00.plan.md`, `00.tasks.md`를 Phase TC 세션이 편집 중 | 덮어쓰기 | pm은 절 추가만 한다(surgical) |
| `messages/{en,ko}/blog.json` 공유 | 병합 충돌 | 키 추가만 |
| 기존 글 slug가 `posts`, `projects`, `about` | 그 글을 열 수 없다 | U2 쿼리. 이동 배포 전에 0행 확인 |
| Cloudflare에 옛 HTML 24시간 | 옛 URL이 redirect 대신 옛 페이지를 낸다 | 배포 뒤 purge |
| Google 색인 | 순위가 잠시 흔들린다 | 308 + sitemap 새 URL + canonical 새 URL |
| `[handle]`이 모든 최상위 오타를 받는다 | 404 처리 경로가 하나 는다 | `@` 검사 → `notFound()` |
| slug 전역 조회 | `/@a/<b의 slug>`가 b의 글을 연다. 오늘 `/blog`도 같다 | 후속 행. canonical은 글 작성자 기준으로 만든다 |
| tree path는 `LPAD(…, 6)` | priority가 음수거나 7자리면 tree 순서와 목록 순서가 다르다 | 목록은 숫자 정렬. 기록만 한다 |
| 프로젝트 이름 = 카테고리 title | title을 바꾸면 URL이 깨진다 | slug 열은 스키마 변경이라 넣지 않는다. Q2 |
| `nexjts.md` 규칙 파일 없음 | 클라이언트 폴더 규칙(`mocks/`)을 확인하지 못했다 | 루트 `CLAUDE.md`가 없는 파일을 인용한다. 오너에게 보고 |

## 11. 열린 질문 (open questions)

| # | 질문 | 설계 기본값 |
| --- | --- | --- |
| Q1 | "Recently viewed 대체"가 오른쪽 rail만인가, 왼쪽 `RecentVisited`도인가 | 오른쪽만 |
| Q2 | 프로젝트 title에 URL에 안전하지 않은 문자가 오면 | `encodeURIComponent`. slug 열은 만들지 않는다 |
| Q3 | `projects` 카테고리가 루트인가, 루트의 자식인가 | SQL이 title로 찾는다. 둘 다 동작한다 |
| Q4 | 프로젝트 아래 하위 카테고리 글을 셀까 | 센다. tree의 postCount와 같다 |
| Q5 | 보이는 글 0개 프로젝트의 카드 | 보인다. overview는 빈 자리 |
| Q6 | Cloudflare 캐시 규칙이 `/blog/*`를 이름으로 잡는가 | Phase TC 담당이 확인. 잡으면 `/@*` 추가 |
| Q7 | 페이지 나누기 기준 | 프로젝트당 글 50개를 넘으면 다시 설계 |
| Q8 | 예약 목록에 `series`, `tags`도 넣을까 | 지금은 6개. 정적 폴더를 만들 때 넣는다 |
| Q9 | `HOME_FEED_AUTHOR`가 빈 값이면 "Projects" 메뉴 | 숨긴다 |
| Q10 | 다른 사용자로 로그인해도 "Projects"가 owner 프로젝트로 가는가 | 그렇다. 공개 메뉴, 단일 작성자 모드 |
| Q11 | 비공개 글 metadata를 작성자에게 일반값으로 보여도 되는가 | 된다. `cacheComponents` 준비 때문 |
| Q12 | about, resume는 최소 안(owner만)인가 전체 안(사용자별)인가 | 최소 안. 전체 안은 P2-4 |
| Q13 | `@` 없는 옛 URL(`/blog/taek`, `/log/taek`)도 받을까 | 받는다. U6 stub 대안 |
| Q14 | 다른 사람의 `/@u/saved`는 HTTP 404 상태여야 하는가 | 아니다. 404 화면 + noindex. 상태가 꼭 필요하면 서버 비교안 |
| Q15 | `/about`, `/resume`을 308로 보낼까, 두 URL을 둘까 | 308. URL 하나 |
