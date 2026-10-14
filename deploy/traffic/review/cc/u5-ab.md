# U5 A-B 측정 (#110, 2026-10-14)

- 지표: MISS TTFB, 익명, `cc-measure.mjs --only miss --runs 3`. 읽기 A = run마다 `/`, `/@taeklim/projects`, `/@taeklim/<S>` 원값 9개의 p50 → run 3개 중앙값.
- C = U4 `181e6ed` (18:36–18:37 UTC). T = U5 `b30d03a` (18:37:42 배포 + purge, 18:37–18:38 UTC 측정).

| 블록 | run 폴더 | run별 p50 (ms) | 중앙값 |
| --- | --- | --- | --- |
| C | `20261014T183605Z_U5_u5C_181e6ed`, `…183636Z_U5_u5C_2…`, `…183654Z_U5_u5C_3…` | 472 / 302 / 263 | 302 |
| T | `20261014T183758Z_U5_u5T_1_b30d03a`, `…183817Z_U5_u5T_2…`, `…183835Z_U5_u5T_3…` | 283 / 343 / 316 | 316 |

- 참고선 (#110) = max(0.10 × 302, 50) = 50 ms. T가 C보다 14 ms 느리다. 미달.
- C2가 없어 흔들림은 가르지 않았다 (#110).

## 오류

- T 동안 `blog-web` 오류 로그 855 → 1134줄. `⨯ Error: Connection closed.` 43회, digest `978306872`.
- route: `/[handle]/projects`, `/[handle]/projects/[project]` (render). 응답 status는 200.
- 18:39:18 UTC U4 `181e6ed`로 되돌림 + purge. 되돌린 뒤 smoke에서 새 줄 0.
- 원인 미확인. 후보: `'use cache'` 안의 값 직렬화, `cache()` 안의 `'use cache'`, tree 경로의 `clientRequest`.
