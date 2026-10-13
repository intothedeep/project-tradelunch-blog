# 무한 스크롤 429와 미리 받기 (2026-10-13)

목표: 메인 페이지를 스크롤해도 요청 수 제한(rate limit)에 걸리지 않고, 걸려도 페이지가 깨지지 않는다.

출처: [`prefetch-source.md`](./prefetch-source.md). 결정: [`decisions.plan.md` #70](../../../decisions.plan.md), 한도 [#68](../../../decisions.plan.md). 배포 뒤 확인: [`check.md` 2번](../../../check.md).

## O. 무한 스크롤 429와 prefetch (코드 수정 완료, 커밋 전, 배포 전)

**결과:** 로그인 안 한 오너가 메인 페이지를 스크롤하자 요청이 79개 나갔다. 대부분 Next.js `<Link>`가 화면에 보이는 링크를 미리 받는(prefetch) 요청이었다. Cloudflare 한도 50 / 10 s(#68)를 넘어 429가 났다. 무한 스크롤은 429를 처리하지 못해 페이지가 error boundary로 넘어갔다. 고친 것은 네 가지(a 태그 칩, b 댓글 링크, c 카드 링크, d load-more 실패 처리)와 Log 메뉴 숨기기다. 기대: 스크롤 한 번에 약 31–41번이 약 1–2번이 된다. 측정한 값이 아니라 기대값이다.

**왜 필요했나:** 오너의 말: "it seems I request more than 50 times per 10 seconds. what makes it request so much?" 스크롤할 때마다 요청이 많이 나가고, 한도에 걸리면 사이트가 쓸 수 없게 된다.

**문제:** 두 가지가 겹쳤다.

1. 카드 링크가 화면에 들어오기만 해도 미리 받기 요청을 낸다. 한 번 스크롤에 수십 개다.
2. 무한 스크롤 코드가 `res.ok`를 보지 않는다. 429를 받으면 `data.posts`가 없어서 TypeError가 난다.

### 한 번 스크롤에서 일어난 일

```text
스크롤 ─► 바닥 감지 칸(sentinel)이 보임 (rootMargin 200px)
   │
   ├─► GET /api/posts/load-more?...&limit=10          1번  → 카드 10장 추가
   │
   └─► 새 카드 10장이 화면에 들어옴 ─► <Link> 미리 받기
          ├─ 카드 링크 → 글 페이지        10번
          ├─ 태그 칩 → /tags/<tag>        20–30번 (카드당 2–3개)
          └─ 댓글 수 → 글 페이지          0–10번
                         │
                         ▼
            약 31–41번 요청 ─► 두 번 빠르게 스크롤 = 10초에 약 60–80번
                         │
                         ▼
            Cloudflare "web rate limit" (IP당 10초 50번, HIT도 센다)
                         │
                         ▼
                    429 Too Many Requests
                         │
                         ▼
   load-more가 429를 받음 ─► res.json() 실패 또는 data.posts 없음
                         ─► [...prev, ...undefined] TypeError ─► 페이지 깨짐
```

### 무엇을 알려고 쓰나

오너의 DevTools Network 화면에서 어떤 요청이 79개를 채웠는지 센다.

| 종류 | 보이는 이름 | 보이는 수 |
| --- | --- | --- |
| 태그 페이지 | express, monitoring, blog, command, linux, authentication, jwt, authorization, architecture, api-security, session-tokens, algorithms, bfs, blog, cargo, linux-commands | 16 |
| 글 페이지 | do-politicians-beat-the-market-…, how-clerk-auth-actually-works-the-…, 이름이 잘린 줄 2개 | 약 4 |
| 메뉴 페이지 | 홈 ×2, log, about, resume ×4 | 8 |

- 화면 아래에 `79 requests`, `264 kB transferred`가 보였다.
- 보이는 줄은 28개다. 1줄을 빼면 모두 실패(429)다.
- 고른 요청의 헤더에 `Next-Router-Prefetch: 1`이 있었다. 미리 받기 요청이다.
- 로그인하지 않은 상태였다(`__client_uat=0`, `__session` 없음).
- 같은 링크가 여러 번 받힌 이유는 **추정, 확인 안 함**이다.
  - Next 16은 페이지를 조각(segment)으로 나눠 미리 받는다(`Next-Router-Segment-Prefetch: /_tree`). 링크 하나가 요청 둘 이상이 될 수 있다. resume ×4가 그 예로 보인다.
  - `_rsc` 값이 다르면 브라우저 라우터 캐시와 Cloudflare 캐시 키가 다르다. `blog`가 두 번 나온 것이 그 예로 보인다.
  - 429로 실패한 미리 받기는 링크가 다시 보일 때 또 시도될 수 있다.

### 카드 링크별 요청 수 (수정 전)

대상: `RecentPostCard.client.tsx`의 `<Link>` 4종. 카드 1장 기준이다.

| 링크 | prefetch | 카드 1장당 요청 |
| --- | --- | --- |
| 카드 전체 → 글 (:77) | 켜짐 | 1 |
| 작성자 (:112) | 꺼짐 | 0 |
| 태그 칩 → `/tags/<tag>` (:186) | 켜짐 | 태그 수 (2–3) |
| 댓글 수 → 글, 카드와 같은 주소 (:209) | 켜짐 | 0–1 |

### 원인과 해결책

| 원인 | 해결책 | 기대 효과 (카드 10장당) |
| --- | --- | --- |
| 태그 칩이 화면에 들어오면 미리 받는다 | **a.** 태그 칩 `<Link>`에 `prefetch={false}` | 20–30 → 0 |
| 댓글 수 링크가 글 주소를 또 미리 받는다 | **b.** 댓글 수 `<Link>`에 `prefetch={false}` | 0–10 → 0 |
| 카드 전체 링크가 화면에 들어오면 미리 받는다 | **c.** 마우스를 올리거나 포커스할 때만 미리 받는다 | 약 10 → 마우스를 올린 글만 |
| load-more가 `res.ok`를 보지 않아 429에서 페이지가 깨진다 | **d.** 실패를 처리하고 "다시 불러오기" 버튼을 둔다 | 에러 화면 없음 |
| 메뉴 링크(홈, log, about, resume)도 미리 받는다 | **e.** Log 메뉴만 숨긴다. 나머지는 그대로 둔다 | 처음 한 번뿐이라 효과가 작다 |
| (버린 방법) 미리 받기 요청을 한도에서 빼고 싶다 | Cloudflare 규칙에서 `Next-Router-Prefetch` 헤더가 붙은 요청을 세지 않기 | 쓰지 않음 |

**c에서 왜 `false`가 아니라 `null`을 쓰나:**

- Next의 `link.d.ts`는 `prefetch?: boolean | 'auto' | null`을 허용한다(:120).
- 같은 파일(:106)은 `false`가 화면 진입 prefetch와 hover prefetch를 **둘 다** 끈다고 적는다.
- 그래서 처음에는 `false`로 둔다. `onMouseEnter`나 `onFocus`가 오면 `null`(기본 prefetch)로 바꾼다.

**버린 방법을 왜 쓰지 않나:** 공격자도 `Next-Router-Prefetch` 헤더를 붙여 한도를 피할 수 있다. 헤더만 믿고 세지 않으면 한도가 뚫린다.

**e에서 메뉴 링크를 왜 그대로 두나:** 메뉴 링크는 처음 한 번만 받는다. 줄여도 스크롤마다 나가는 요청에는 영향이 작다. Log 메뉴는 오너가 숨기라고 했다("and hide log menu"). `/log` 주소는 그대로 열린다.

### 어떻게 고쳤나

d의 동작 순서:

1. load-more를 부른다.
2. `res.ok`와 `Array.isArray(data.posts)`를 확인한다.
3. 실패하면 `isError = true`로 둔다. 이미 보인 글은 남긴다.
4. observer를 다시 만들지 않는다. 자동 재시도는 없다.
5. 감지 칸 자리에 "글을 더 불러오지 못했습니다."와 "다시 불러오기" 버튼이 나온다.
6. 버튼을 누르면 `isError`가 지워지고 로딩이 다시 된다.

### 기대 효과 (측정 아님)

| 시점 | 스크롤 한 번의 요청 수 | 근거 |
| --- | --- | --- |
| 수정 전 | 약 31–41 | 카드 10장, 태그 2–3개의 어림 계산: load-more 1 + 글 10 + 태그 20–30 |
| 수정 후 | 약 1–2 | load-more 1 + 마우스를 올린 글 |

- 위 숫자는 **기대값**이다. 브라우저에서 429를 다시 일으켜 보지 않았다.
- 배포 뒤 아래 "배포 뒤 확인"으로 실제 값을 센다.

### 구현한 파일

모두 `apps/dashboard_client_web/` 아래다. 커밋 전이다.

| # | 파일 | 바뀐 것 |
| --- | --- | --- |
| a | `app/blog/components/RecentPostCard.client.tsx` | 태그 칩 `<Link>`에 `prefetch={false}` |
| b | 같은 파일 | 댓글 수 `<Link>`에 `prefetch={false}` |
| c | `components/ui/HoverPrefetchLink.client.tsx` (새 파일). 카드 overlay 링크가 쓴다 | `prefetch={isActive ? null : false}`. `onMouseEnter`나 `onFocus`가 오면 `null`로 바뀐다 |
| d | `app/blog/components/RecentPostsList.client.tsx`, `TagPostsList.client.tsx` (같은 패턴이라 함께 고침) | `res.ok`와 `Array.isArray(data.posts)` 확인. 실패하면 `isError`. "다시 불러오기" 버튼 |
| 문구 | `messages/{en,ko}/blog.json` | `blog.feed.loadError`, `blog.feed.retry` |
| 메뉴 | `hooks/useNavLinks.hook.ts` | Log 메뉴를 뺐다. 메뉴의 `/log` prefetch도 함께 없어진다 |

- 정적 검사(2026-10-13): `pnpm --filter dashboard_client_web check-types` 오류 0, `lint` 경고 0.

### 배포 뒤 확인

같은 방법으로 다시 센다. 기대: 스크롤 한 번에 약 1–2번.

1. 로그인하지 않은 브라우저 창을 연다.
2. 개발자 도구 Network를 열고 필터에 `_rsc`를 넣는다.
3. 메인 페이지를 빠르게 스크롤한다.
4. 스크롤 한 번에 나간 요청 수를 센다.
5. 429가 나왔는지 본다.
6. 카드 위에 마우스를 올리면 그 글의 요청이 하나 나가는지 본다.
7. 결과를 Claude에게 알린다.

| 확인 | 기대 | 결과 |
| --- | --- | --- |
| 스크롤 한 번의 요청 수 | 약 1–2 | |
| 429 | 없음 | |
| 카드에 마우스를 올릴 때 | 그 글의 요청 1번 | |
| 일부러 load-more를 실패시킬 때 | "다시 불러오기" 버튼, 이미 보인 글은 남음 | |
