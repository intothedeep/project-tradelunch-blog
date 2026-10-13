# 출처 노트: 무한 스크롤 429와 prefetch (2026-10-13)

이 파일은 문서(`06-prefetch.md`)와 책(9장)의 출처다. 관찰과 분석은 메인 세션이 적었다.
해결책 칸은 developer 작업 뒤에 채운다.

## 1. 증상 (오너, 2026-10-13)

- 메인 페이지, 로그인 안 함. 스크롤하면 무한 스크롤이 에러를 낸다.
- 오너의 말: "it seems I request more than 50 times per 10 seconds. what makes it request so much?"
- 오너의 말: "every time I scroll there are a lot of requests happens?"

## 2. 관찰: DevTools Network 스크린샷 (오너, 2026-10-13 17:52 로컬)

- 하단 표시: `79 requests`, `264 kB transferred`.
- 보이는 줄은 28개. 1줄을 빼면 모두 빨간 ✕ (실패).
- 고른 요청 하나:
  - URL `https://my.prettylog.com/blog/@taeklim/do-politicians-beat-the-market-building-an-event-study-harness-to-find-out?_rsc=5CB68i4pnAekjehf`
  - Status `429 Too Many Requests`
  - 요청 헤더: `Next-Router-Prefetch: 1`, `Next-Router-Segment-Prefetch: /_tree`, `Next-Url: /`, `Rsc: 1`, `Referer: https://my.prettylog.com/`
  - 요청 헤더 `Cache-Control: no-cache`, `Pragma: no-cache` (DevTools "Disable cache"가 켜져 있었을 가능성)
  - 쿠키에 `__session` 없음, `__client_uat=0` (로그인 안 함)
- 보이는 요청 이름, 분류:

| 종류 | 보이는 이름 | 보이는 수 |
| --- | --- | --- |
| 태그 페이지 | express, monitoring, blog, command, linux, authentication, jwt, authorization, architecture, api-security, session-tokens, algorithms, bfs, blog, cargo, linux-commands | 16 |
| 글 페이지 | do-politicians-beat-the-market-…, how-clerk-auth-actually-works-the-…, 그 밖에 이름이 잘린 줄 2개 (`s…`, `d…`) | 약 4 |
| 메뉴 페이지 | `?_rsc=` (홈) ×2, log, about, resume ×4 | 8 |

- `_rsc` 값이 두 가지 이상 보인다: `5CB68i4pnAekjehf`, `tXyZJ52UQVBCVsD3`. resume은 4개가 모두 다르다 (`7h4NYy5eoyMcNlUN`, `ylp22O3xgPPxC28X`, `GtPQNNxLIKJutPiZ`, `nhMlUGAzmieyjVka`).
- `blog`는 `_rsc` 값만 다르게 두 번 나온다.

## 3. 분석 (메인 세션, 코드 읽기, 2026-10-13)

### 요청을 많이 만드는 것: Next.js `<Link>` 미리 받기(prefetch)

- Next.js 16(`"next": "^16.2.9"`)의 `<Link>`는 화면에 보이면 대상 페이지를 미리 받는다. 기본값이다.
- 카드 컴포넌트 `apps/dashboard_client_web/app/blog/components/RecentPostCard.client.tsx`의 링크 (수정 전):

| 링크 | 줄 | prefetch | 카드 1장당 요청 |
| --- | --- | --- | --- |
| 카드 전체 → 글 | :77 | 켜짐 | 1 |
| 작성자 | :112 | 꺼짐 (`prefetch={false}`) | 0 |
| 태그 칩 → `/tags/<tag>` | :186 | 켜짐 | 태그 수 (2–3) |
| 댓글 수 → 글 (카드와 같은 주소) | :209 | 켜짐 | 0–1 |

- 무한 스크롤 `apps/dashboard_client_web/app/blog/components/RecentPostsList.client.tsx`:
  - 바닥 감지 칸(sentinel)에 IntersectionObserver를 단다. `rootMargin: '200px'`.
  - 한 번에 `/api/posts/load-more?...&limit=10`을 부른다. 카드 10장이 붙는다.
  - 요청이 끝나면 effect가 observer를 다시 만든다. 감지 칸이 아직 보이면 다음 페이지를 바로 또 부른다.
- 어림 계산 (카드 10장, 태그 2–3개): load-more 1 + 글 10 + 태그 20–30 = 약 31–41번이다.
- 두 번 빠르게 스크롤하면 10초에 약 60–80번이다. Cloudflare "web rate limit" 한도(IP당 10초 50번, #68)를 넘는다.
- Cloudflare 한도는 캐시 HIT도 센다 (L-a 시험, `02-blocking.md`).

### 같은 링크가 여러 번 받히는 이유 (추정, 확인 안 함)

- Next 16은 페이지를 조각(segment)으로 나눠 미리 받는다 (`Next-Router-Segment-Prefetch: /_tree`). 링크 하나가 요청 둘 이상이 될 수 있다. resume ×4가 그 예로 보인다.
- `_rsc` 값이 다르면 브라우저 라우터 캐시와 Cloudflare 캐시 키가 서로 다르다. `blog`가 두 번 나온 것이 그 예로 보인다.
- 429로 실패한 prefetch는 링크가 다시 보일 때 또 시도될 수 있다.

### 에러 화면이 나오는 이유

- `RecentPostsList.client.tsx:56-64` (수정 전):

```ts
const res = await fetch(`/api/posts/load-more?...`);
const data = await res.json();
setPosts((prev) => [...prev, ...data.posts]);
```

- `res.ok`를 보지 않는다.
- 429면 Cloudflare 차단 응답이다. `res.json()`이 실패하거나 `data.posts`가 없다.
- route가 500 `{ error: 'Failed to load posts' }`를 돌려줘도 `data.posts`가 없다 (`app/api/posts/load-more/route.ts:58`).
- `[...prev, ...undefined]`가 TypeError를 낸다. 페이지가 error boundary로 넘어간다.

## 4. 고른 해결책 (오너: "a b c d 고쳐줘", 2026-10-13)

| # | 무엇 | 기대 효과 (카드 10장당) |
| --- | --- | --- |
| a | 태그 칩 `prefetch={false}` | 20–30 → 0 |
| b | 댓글 링크 `prefetch={false}` | 0–10 → 0 |
| c | 카드 링크: 마우스를 올릴 때만 prefetch | 약 10 → 마우스를 올린 글만 |
| d | load-more 실패 처리 + "다시 불러오기" 버튼 | 에러 화면 없음 |
| e | 메뉴 링크는 그대로 | 처음 한 번뿐이라 효과가 작다 |

- 기대: 스크롤 한 번에 약 31–41번 → 약 1–2번.
- 쓰지 않은 방법: Cloudflare 규칙에서 `Next-Router-Prefetch` 헤더가 붙은 요청을 세지 않기. 공격자도 그 헤더를 붙여 한도를 피할 수 있다.

## 5. 구현 (developer, 2026-10-13)

모두 `apps/dashboard_client_web/` 아래다. 커밋 전이다.

| # | 파일 | 바뀐 것 |
| --- | --- | --- |
| a | `app/blog/components/RecentPostCard.client.tsx` | 태그 칩 `<Link>`에 `prefetch={false}` |
| b | 같은 파일 | 댓글 수 `<Link>`에 `prefetch={false}` |
| c | `components/ui/HoverPrefetchLink.client.tsx` (새 파일), 카드 overlay 링크가 이것을 쓴다 | `prefetch={isActive ? null : false}`. 처음에는 `false`다. `onMouseEnter`나 `onFocus`가 오면 `null`(기본 prefetch)로 바뀐다 |
| d | `app/blog/components/RecentPostsList.client.tsx`, `TagPostsList.client.tsx` (같은 패턴이라 함께 고침) | `res.ok`와 `Array.isArray(data.posts)`를 확인한다. 실패하면 `isError = true`. 이미 보인 글은 남긴다. observer를 다시 만들지 않는다 (자동 재시도 없음). 감지 칸 자리에 "글을 더 불러오지 못했습니다." + "다시 불러오기" 버튼. 버튼이 `isError`를 지우면 로딩이 다시 된다 |
| 문구 | `messages/{en,ko}/blog.json` | `blog.feed.loadError`, `blog.feed.retry` |
| 메뉴 | `hooks/useNavLinks.hook.ts` | Log 메뉴를 뺐다 (오너: "and hide log menu"). `/log` 주소는 그대로 열린다. 메뉴의 `/log` prefetch도 함께 없어진다 |

- c에서 `null`을 쓴 근거: `node_modules/next/dist/client/app-dir/link.d.ts:120`은 `prefetch?: boolean | 'auto' | null`을 허용한다. 같은 파일 :106은 `false`가 화면 진입과 hover prefetch를 둘 다 끈다고 적는다. 그래서 hover 뒤에만 `null`로 바꾼다.
- 정적 검사: `pnpm --filter dashboard_client_web check-types` 오류 0, `lint` 경고 0 (2026-10-13).
- 브라우저에서 429를 다시 일으켜 보지는 않았다. 배포 뒤 §6으로 확인한다.

## 6. 배포 뒤 확인 (오너)

(배포 뒤 같은 방법으로 다시 센다: 로그인 안 한 창, Network, 필터 `_rsc`, 빠르게 스크롤)
