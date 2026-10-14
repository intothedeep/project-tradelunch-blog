# perf scripts CHANGELOG

Code version ledger for `cc-browser.mjs` and `cc-measure.mjs` (`rules/measurement.md` §2.2).

| 버전 | 날짜 | 바뀐 것 | 영향받는 실행 |
| --- | --- | --- | --- |
| v1 | 2026-10-13 | 첫 버전 | baseline, QW1, QW2, U1 (u1-verdict.md §2: 바이트 값 결함) |
| v2 | 2026-10-14 | cc-browser: 바이트를 body(), request.sizes(), content-length 순서로 기록 (`bytes_src`) | v2 이후 실행. v1의 `rsc_bytes_*`와 값 정의가 다르다 (대체 출처는 압축 크기) |
| v2 | 2026-10-14 | cc-browser: 크기를 모르는 응답이 있으면 `rsc_bytes_total`, `rsc_bytes_w1`을 비운다. 키 `rsc_bytes_null_count`, `rsc_bytes_w1_null_count`, `rsc_bytes_fallback_count` 추가 | 같음 |
| v2 | 2026-10-14 | cc-browser: W1 이동(prefetch 아님) RSC 본문을 `w1_<arm>_<rail>_r<run>_<step>.rsc`로 저장 (300 KB 상한) | 같음 |
| v2 | 2026-10-14 | cc-browser: 측정 run마다 앞에 기록하지 않는 W1 warmup 추가 (`--no-run-warmup`으로 끔), 요약 키 `w1_miss_count` 추가 | 같음 |
| v2 | 2026-10-14 | cc-measure: `CODE_VERSION`만 v2로 올림 (동작 변경 없음, 두 스크립트 버전 맞춤) | 없음 |

불변성 근거: v2는 키를 더하기만 한다. 옛 키 이름은 그대로다. 바이트 합은 null이 있을 때만 값이 0 대신 빈 값이 된다.
