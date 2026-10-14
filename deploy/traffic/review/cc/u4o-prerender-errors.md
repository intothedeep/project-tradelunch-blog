# U4 (`f76c1d9`) 배포 직후 서버 오류 로그 (2026-10-14)

- 무엇: cacheComponents를 켠 U4 배포 뒤 `blog-web` 오류 로그에 새로 생긴 줄.
- 기록: main session. 원본 = VM `~/.pm2/logs/blog-web-error-3.log`, 18:16 UTC 이후 줄.

## 배포와 확인

| 항목 | 값 |
| --- | --- |
| 배포 | `release.sh web f76c1d9…` 18:16 UTC, 뒤이어 `cf-purge.sh` |
| route 표 15개 | 200 7개, 404 8개 (`/nope`, `/zzz/foo`, `/xmlrpc.php`, 없는 프로젝트, 없는 사용자, 없는 글, 익명 `/@u/me`, `/@u/saved`) |
| `Invalid revalidate configuration` | 18줄. 배포 전 줄. 배포 뒤 smoke 2회 동안 늘지 않음 |
| 배포 뒤 ERROR 줄 (`time` 18:xx) | 8줄 |

## 배포 뒤 ERROR 줄

| 메시지 (우리 코드) | 줄 |
| --- | --- |
| Failed to fetch popular tags | 6 |
| Failed to fetch posts by tag | 2 |
| Failed to fetch user profile | 2 |
| Failed to fetch a post | 2 |

- 메시지 수 합(12)이 8줄보다 많다. 한 줄 grep에 같은 줄의 두 메시지가 잡혔다.
- 원인 문구 (Next): "During prerendering, fetch() rejects when the prerender is complete." 8줄 모두.
- route: `/[handle]/[slug]` 4, `/[handle]/projects/[project]` 4, `/tags/[tag]` 4.

## 원인

- cacheComponents는 새 param 경로의 첫 요청에서 static shell을 runtime prerender로 만든다.
- 캐시되지 않은 fetch는 prerender 동안 걸려 있다가, shell이 끝나면 Next가 reject한다 (hanging promise rejection).
- 우리 fetcher의 `catch`가 이 내부 신호를 진짜 오류로 보고 ERROR를 남겼다.
- 화면 영향 없음: 응답 200, `/tags/rust` 태그 링크 37개, 프로젝트 글 링크 8개가 들어 있었다.

## 처방

- 서버 fetcher catch 7곳의 첫 줄에 `unstable_rethrow(error)` (`next/navigation`). commit `181e6ed` (branch `cc-u4-o`).
- Next 16.2.9 `unstable-rethrow.server.js`가 `isHangingPromiseRejectionError`, `isPrerenderInterruptedError`를 다시 던진다 (main session 확인).

## 착시 하나

- `curl -I` (HEAD)는 `cf-cache-status: DYNAMIC`을 보였다. GET은 HIT였다. 엣지 캐시는 정상이다.
- 응답 헤더 `cache-control: private, no-cache, no-store`는 Next가 보낸다. Cloudflare 캐시 규칙이 GET에서 덮어쓴다.

## 수정 배포 뒤 (`181e6ed`, 18:30 UTC)

- 오류 로그 줄 수: 배포 직후 855, 처음 여는 param 경로 포함 smoke 뒤 855. 새 줄 0.
- `/` 첫 요청 1회 502 (PM2 reload 중), 바로 뒤 3회 200.

## U4 가드 run (`f76c1d9`, #106 G-a ≤ 60)

- run 폴더: `deploy/traffic/review/cc/runs/20261014T181839Z_U4_u4o_f76c1d9_browser/` (`summary.csv`).
- 로그인 `g_a_max_10s` 50 / 53 / 50. 익명 36 / 36 / 36. hydration 0. 링크당 prefetch 최댓값 로그인 6 / 6 / 5, 익명 6.
- 판정: G-a 통과 (≤ 60, #106). 주 지표는 판정하지 않는다 (#106, 흔들림).
