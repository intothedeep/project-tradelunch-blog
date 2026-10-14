# 나중에 확인할 것 (check)

Claude 세션을 시작하면 이 파일을 먼저 본다. 날짜가 지난 항목을 오너에게 알린다.
항목을 끝내면 `[x]`와 날짜를 적는다. 다 끝난 항목은 지우지 않고 아래 "끝난 것"으로 옮긴다.
배경: [`deploy/traffic/review/`](deploy/traffic/review/README.md), 결정 `decisions.plan.md` #62–#69.

## 할 일 (2026-10-13 작성)

| # | 할 일 | 언제 | 왜 | 확인 방법 |
| --- | --- | --- | --- | --- |
| 1 | [ ] Cloudflare 한도 50에 정상 사용자가 막히는지 지켜보기 | 2026-10-13 ~ 10-16 | 10-13 로그로는 보통 사용도 10초에 50번을 넘을 때가 6번 있었다 (#68) | 페이지가 10초 동안 안 열리거나 429가 보이면 Claude에게 알린다. Cloudflare → Security → Events에서 `web rate limit` 차단 수를 본다 |
| 3 | [ ] Express 요청 수 제한: 14일 로그로 한도 확정, `log` → `enforce` | 2026-10-27쯤 | 지금 숫자(읽기 120, 쓰기 30 / 60 s)는 가안이다. 차단 모드로 갈 준비(SSR 키 `7f07df7`)는 끝났다 (#62, #67) | Claude에게 "TC-M6-1 진행" 요청. `traffic.design.md` §7.4.4 규칙으로 계산한다 |
| 4 | [ ] Supabase Log Query 사용량 다시 보기 | 2026-10-15 ~ 10-16 | 10-13 하루 2.82 GB (무료 100 GB/월). Studio를 덜 열고도 많이 쓰는지 본다 | Supabase → Organization → Usage → Log Query per day. 하루 1 GB 이상이 계속되면 Claude에게 원인 조사 요청 |
| 5 | [ ] 다음 주간 issue 확인 | 2026-10-19 (월) 14:17 UTC 뒤 | 캐시 검사와 blog-api ERROR 수가 정상인지 본다 | `gh issue list --limit 3`. 기대: `Cloudflare cache rules: OK (14 PASS, 0 FAIL)`, ERROR ≤ 20 |

## 기타 (날짜 없음, 생기면 확인)

| # | 할 일 | 언제 | 왜 | 확인 방법 |
| --- | --- | --- | --- | --- |
| 6 | [ ] 첫 JSON 에러 줄 확인 → 책과 README의 "추정" 표시를 "관찰"로 바꾸기 | 다음 blog-web 에러가 난 뒤 | `35b3630`을 10-14에 배포했다. 에러가 아직 없어 새 줄 형식을 실제로 보지 못했다. 수집은 동작한다 (00:36 UTC `request` 줄 확인) | `gcloud logging read 'LOG_ID("blog-web") AND severity>=WARNING' --freshness=7d --limit 5 --format=json`. 결과를 Claude에게 붙여 준다. 같은 시각의 Next `⨯` 줄과 `digest`가 같은지도 본다 |
| 7 | [ ] prefetch 요청 수를 정확히 세기 → 책 9장 "배포 뒤 확인"(`sec:pf-verify`)에 넣기 | 시간 날 때 (선택) | 10-14 오너 확인은 "줄었다"뿐이고 개수가 없다. 10-13 기준은 79개 | 로그인 안 한 창 → Network 필터 `_rsc` → 빠르게 스크롤 한 번. 요청 수를 Claude에게 알린다. 글 상세(CNN 4편)도 로그인 한 창과 안 한 창에서 열자마자 `_rsc` 수를 센다 (태그·최근 본 글·저장 태그 prefetch 끈 뒤) |

## 있으면 좋음 (급하지 않음, 오너 2026-10-13)

| # | 할 일 | 언제 | 왜 | 확인 방법 |
| --- | --- | --- | --- | --- |
| 8 | [ ] 글쓰기 화면에서 예약 slug 미리 경고 ("이 제목은 쓸 수 없어요") | 시간 날 때 | 지금은 저장할 때 Express가 400으로 막는다 (PJ-1-03, #76). 저장 전에 알려 주면 덜 헷갈린다. 같은 `isReservedSlug`(`@repo/types`)를 쓴다. 작은 작업 | 글쓰기에서 제목 `Posts` 입력 → 저장 버튼 전에 경고가 보인다. 제목 `rust-config`는 경고 없음 |
| 9 | [ ] 예약 slug DB 제약 추가 (`CHECK (lower(slug) NOT IN (...))`) | 예약어 목록이 안정된 뒤 (P2 끝 이후) | 코드 검사를 빠뜨린 새 쓰기 경로가 생겨도 DB가 막는다. 마이그레이션 1개. 예약어가 바뀔 때마다 마이그레이션이 필요해서 지금은 하지 않는다 (#76 Rejected) | 마이그레이션 적용 뒤 `insert ... slug='posts'`가 제약 오류로 실패한다. 적용 전 `projects.design.md` §2.3 쿼리가 0행이어야 한다 |

## 보류 중 (오너 결정)

| 항목 | 결정 | 다시 볼 때 |
| --- | --- | --- |
| 주간 issue에 egress 넣기 (`roles/monitoring.viewer`) | 보류 (#61) | IAM을 손볼 때. 그동안 `./_scripts/gcp/vm-metrics.sh 7` |

## 중단 (오너, 2026-10-13: 다시 보지 않는다)

| 항목 | 결정 |
| --- | --- |
| 방화벽 `default-allow-ssh`, `default-allow-rdp` 끄기 | 중단 (#69) |
| HTML 캐시 키 허용 목록 (랜덤 쿼리 우회 a안) | 중단 (#68). 대신 Cloudflare 한도 50 / 10 s와 prefetch 줄이기 |

## 끝난 것

| # | 할 일 | 끝난 날 | 결과 |
| --- | --- | --- | --- |
| 2 | [x] 미리 받기(prefetch) 줄이기 (#70) → 배포 뒤 다시 세기 | 2026-10-14 | 오너 확인 (`35b3630` 배포 뒤): 스크롤 요청이 줄었다. 개수는 세지 않았다. 10-13 기준은 79개 |
