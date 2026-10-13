# Gate review 1: 트래픽 통제와 보안 (books/traffic-security)

- 검토자: reviewer (cycle 1/2; recovery 0/2)
- 날짜: 2026-10-13
- 대상: `main.tex`, `preamble.tex`, `chapters/01`–`09`, `chapters/A-commands.tex`
- 빌드 명령: `latexmk -C && latexmk -xelatex -interaction=nonstopmode main.tex` (from `books/traffic-security`)
- 출처 형식: 경로형 `% src:` (dispatch가 정한 형식). `[S-WS-n]` 해석은 N/A.
- MVP ladder (L1–L4): N/A. 시스템/앱 작업이 아니다.

## 판정

**ISSUE.** 두 근거가 각각 독립적으로 PASS를 막는다.

| 근거 | 위치 | 분류 | 라우팅 |
| --- | --- | --- | --- |
| 검사 3 실패: 방화벽(#69)이 `ON HOLD`(보류)로 적혀 있다 | `chapters/A-commands.tex:357` | implementation (문구) | sonnet-writer |
| 검사 2/4 reasoning ISSUE: 결정 #70과 prefetch 수정 완료(출처 최신 상태)가 8장, 1장에 반영되지 않았다 | `chapters/08-decisions.tex:8,29,41,121,180`, `chapters/01-overview.tex:131–168` | reasoning (출처 대비 틀린 수치, 오래된 주장) | researcher (단, 새 조사 불필요: 최신 출처가 이미 있다. 동기화 작업이다) |

나머지 검사(1, 5, 6, 7, 8)는 PASS이거나 비차단 메모다.

```
검사 1 빌드 ──── PASS
검사 2 출처 ──── PASS (표본 60+ 모두 일치) + reasoning ISSUE 2건 (아래)
검사 3 상태어 ── ISSUE (A-commands.tex:357)
검사 4 원칙 13 ─ ISSUE 1건 (#70 누락) + 메모 3건
검사 5 문체 ──── PASS + 비차단 메모 2건
검사 6 시각 ──── PASS + 비차단 메모 1건
검사 7 비밀 ──── PASS
검사 8 todo ──── PASS (3건, 모두 오너 소유)
H1/H2 ──────── H1 ISSUE (책 작업 행 없음, 비차단) / H2 PASS
```

## 1. 빌드

**PASS.**

| 항목 | 값 |
| --- | --- |
| 종료 코드 | 0 |
| Undefined references | 0 |
| Overfull boxes | 0 |
| Underfull boxes | 5 (badness 1038–10000, 비차단) |
| 쪽 수 | 87 |
| 경고 (비차단) | `xdvipdfmx: Object @page.i already defined` (frontmatter 로마 숫자 앵커), `xeCJK: Unknown CJK family \CJKttdefault`, `Font shape TU/AppleSDGothicNeo(0)/m/sl undefined` (기울임 대체) |

## 2. 출처 (% src:) 표본

**표본 결과: 확인한 숫자 60건 이상이 모두 출처와 일치한다. 9장은 숫자 전부를 확인했다.**
출처 누락(`% src:` 없는 숫자)은 없다. float 안에 `% src:`가 없는 곳은 `01-overview.tex:93, 131, 203` 세 표뿐이고, 셋 다 바로 위 문단에 `% src:` 줄이 있다.

### 9장 (전수)

| 줄 | 숫자 | 출처 | 결과 |
| --- | --- | --- | --- |
| 11, 35, 154–157, 303 | 31–41번, 1+10+20=31, 1+10+30=41, 60–80, 50 | prefetch-source.md §3 | 일치 |
| 12, 46, 304 | 기대 1–2번 | §4 | 일치 |
| 67–68 | 17:52 로컬, 79 requests, 264 kB | §2 | 일치 |
| 82–88 | 태그 16, 글 약 4, 메뉴 8, 합 28, blog 두 번 | §2 표 | 일치 |
| 96–100 | 1줄 제외 실패, 429, `Next-Router-Prefetch: 1`, `/_tree`, 쿠키 없음, `no-cache` (추정 표시) | §2 | 일치. 추정 라벨은 출처의 "가능성"과 같다 |
| 109 | Next.js 16 | §3 (`^16.2.9`) | 일치 |
| 128–134 | :77, :112, :186, :209, 태그 2–3, 댓글 0–1 | §3 표 | 일치 |
| 143–144 | rootMargin 200px, limit=10 | §3 | 일치 |
| 178–182 | resume 4번, blog 두 번, `_rsc` 값 다름 (추정 표시) | §2, §3 | 일치 |
| 190–204 | :56-64, route.ts:58 (src 주석), TypeError | §3 | 일치 |
| 224–236 | a 20–30→0, b 0–10→0, c 약 10→hover, d, Log 메뉴, e, 버린 안 | §4, §5 | 일치 |
| 245–255 | `isActive ? null : false`, link.d.ts:120, :106 | §5 | 일치 |
| 265–279 | guard 요약(요약임을 명시), `blog.feed.loadError`, `blog.feed.retry` | §5 | 일치 |
| 298–299 | 막대 (1,31)+(1,10)=41, (2,1)+(2,1)=2 | §3, §4 | 일치 |
| 321–324 | check-types 0, lint 0, 429 재현 안 함, 커밋 전 | §5 | 일치 |
| 333–337 | 배포 뒤 확인 절차 | §6 | 일치 |

### 1장–8장, 부록 (표본)

| 장:줄 | 숫자 | 출처 | 결과 |
| --- | --- | --- | --- |
| 01:8, 03:7, 07:8 | L1 640건 HIT, VM 0건 | 02-blocking.md L1 | 일치 |
| 01:149 | issue #5 14 PASS | review/README.md, 04-observability.md F | 일치 |
| 01:188–189 | 20:53–20:57, 21:00, 21:09–21:12, 21:20, 21:21 | 02-blocking.md 시험 결과, N, L-a 50 | 일치 |
| 02:6–8 | 12건, 11 고침, 1 열림 | books/debugging/README.md | 일치 |
| 02:118–126, 272, 276 | 증상 표, 1.49/0.51/0.35 s, 0.7–1.9 s | deploy/gcp/web-self-proxy.md | 일치 |
| 02:163 | Next 16.2.9, @clerk/nextjs 7.5.9 | web-self-proxy.md Cause 표 | 일치 |
| 02:313 | 사례 3: 200, noindex, A/B/C 미선택 | 03-relative-image-404.md:3,37,48–54 | 일치 |
| 02:321, 325, 327, 329 | 2029/01/13, ↺15(브리프), README 57번 줄, run 38354550435, issue #3 4.5 MB | 07, 09, 10, 11-*.md | 일치 |
| 03:127, 250, 305 | 규칙 전 DYNAMIC, max-age=14400, s-maxage=86400 | 01-reduce-traffic.md B, C, D | 일치 |
| 03:214–226, 358–368 | B 검사 7행, D 검사 6행 | 01-reduce-traffic.md 확인 표 | 일치 |
| 03:489–497, 512 | category_title 5, categories 5, tags 4, 각 1 | 01-reduce-traffic.md M | 일치 |
| 04:9–10, 73–75 | 50/10 s, 120/60 s, 30/60 s, 가안 100 | README §6, #62, #68 | 일치 |
| 04:95–115 | L-b 설계 값 11행, 키 상한 50,000 | traffic.design.md §7.4.3 | 일치 |
| 04:153 | "HIT도 센다고 가정 (보수적)" | traffic.design.md §7.4.1 | 일치 |
| 04:169–173 | 롤백 표 | traffic.design.md §7.4.6 | 일치 |
| 04:299–302, 314 | 20 MB, 8 KB, 200 MB, 103 MB, 106 MB | 02-blocking.md Q2, 배포 확인, L2-api | 일치 |
| 04:329, 343 | 30명 → 분당 120, profile 294 / tags 164 / categories 155 | 02-blocking.md Q3 | 일치 |
| 04:439–453 | 한도 공식 3행, N_page, 10 단위 올림, 14일 | traffic.design.md §7.4.4 | 일치 |
| 04:473–481, 516 | 11/9/6/2/0, 7/4 5/4 3/3 2/0, 최댓값 89 | 02-blocking.md 정상 사용량 | 일치 |
| 05:87, 148–158, 249, 264, 314 | 24건/48줄, 23+1, 운영 확인 6행, 64자, 32자, 21:01:13 | 03-status-codes.md G, L | 일치 |
| 05:376–384, 530 | fetcher 5개, IAP 35.235.240.0/20 | 02-blocking.md N, K | 일치 |
| 06:81–93, 67 | 로그 항목 표, rotate 7 | deploy/logging/README.md | 일치 |
| 06:156–204 | 1,837/48/121/1,370, 864/0/0/656, 상태 코드 7행 | 04-observability.md 스냅샷 | 일치 |
| 06:264–276, 371–377, 419–425 | 10 USD 50/90/100 %, 35–57 %, issue #4 MISS 2건, 4번 시도 1초 간격, 100 GB, 2.82 GB, 85 GB | 04-observability.md E, F, J; README §5; traffic-check.sh:25 | 일치 |
| 07:22–30, 434–446, 519–527, 566–576, 614–626, 682–690 | run id 3개, 3.1 %, 626 ms, 232/18, 53/97, L1·L2·L2-api 표 | 02-blocking.md 시험 결과 | 일치 |
| 07:106–132 | traffic-check.sh 검사 14개와 정규식 | `_scripts/cloudflare/traffic-check.sh:30–43` | 일치 (4+6+1+3=14) |
| 07:248–256, 303–330 | 세트 표(L3 20/10 s, 3 rps×20 s=60, 2.5 rps×120 s=300), 통과 기준 | load/README.md §1–2, traffic.design.md §10.2, §10.5 | 일치 |
| 07:376–392 | timeout 8분, concurrency 1, maxVUs 20, 미리 10, 10 s, redirects 0, cap 320/450, k6 2.3.0 | load-test.yml, common.js:16–17,48–49, l1.js:6, l2.js:8 | 일치 |
| 07:818–822 | b44b153, 0bf37d0, cbe0f78 내용 | `git show` diff (timeUnit 2s, `vals(d).count` → `passes + fails`, ONLY=api) | 일치 |
| 08:56–98 | 73 MB, 953 MB, 4.5 MB/일, 외부 IP 약 20개, #65 이유 없음 | decisions.plan.md #54–#69 | 일치 |
| A:65, 357–361 | us-central1-a, 방화벽 명령 | deploy/gcp/README.md:23, 02-blocking.md K | 일치 |

### 출처 ISSUE (reasoning)

| # | 위치 | 내용 | 분류 | 라우팅 |
| --- | --- | --- | --- | --- |
| R1 | `08-decisions.tex:8` "결정 16개 (#54–#69)", `:29` 절 제목, `:41` 표 캡션 | `decisions.plan.md`에는 #70(2026-10-13, 오너 "a b c d 고쳐줘")이 있다. 같은 날짜 범위의 결정은 17개다. dispatch가 #54–#70을 출처로 지정했다. 9장은 `\decision{70}`을 한 번도 인용하지 않는다 (`grep "70}"` 결과 없음) | reasoning (출처 대비 틀린 수치) | researcher. 새 조사 불필요, #70 한 행 동기화 |
| R2 | `08-decisions.tex:121` "prefetch 줄이기 설계 … 설계가 먼저 (architect)", `:180` 같은 내용; `01-overview.tex:131–168` 상태표에 O행 없음 | `prefetch-source.md §5`, `review/README.md` O행, `check.md` 2번은 코드 수정 완료(커밋 전)라 한다. 같은 사실의 최신 진술이 있으면 최신 것을 쓴다(source-citation "recency"). 8장 "남은 일 (2026/10/13 기준)"이 같은 날 끝난 일을 미완으로 적는다 | reasoning (오래된 주장) | researcher (동기화). `03:380, 03:534, 04:528, 07:754`는 #68 시점 서술이라 역사 기술로 읽히지만, 9장을 가리키는 `\Cref`를 붙이면 혼동이 없다 (메모) |
| R3 | `07-testing.tex:827` `| web \| undefined \| 88 |` | 출처가 "L2 run log (GitHub Actions)"다. 저장소 파일이 아니고 dispatch의 출처 목록에도 없다. 검토자가 확인할 수 없다. source-citation 규칙은 미확인 주장을 `\todo{미확인: …}`로 두라고 한다. 커밋 0bf37d0의 diff는 버그 자체(`vals(d).count`)는 증명하지만 그 행 문자열은 증명하지 않는다 | reasoning (확인 불가 주장) | researcher 또는 sonnet-writer: 그 문장을 지우거나 `\todo{미확인}`로 바꾼다 |

## 3. 소유자 상태 단어

**ISSUE 1건.** 나머지는 모두 맞다.

| 항목 | 요구 | 확인한 위치 | 결과 |
| --- | --- | --- | --- |
| 방화벽 #69 | 중단 | `01:159`, `05:504`, `05:510`, `05:542`, `08:21`, `08:98`, `08:134` | 중단. PASS |
| 방화벽 #69 | 중단 | `A-commands.tex:357` `# ON HOLD (decision 69)` | **ISSUE.** `ON HOLD`는 보류다. 오너가 중단으로 바꿨다 (decisions.plan.md #69 Update, check.md "중단"). implementation → sonnet-writer |
| HTML 캐시 키 허용 목록 (#68 a안) | 중단 | `01:163`, `03:379`, `03:532` | 중단. PASS |
| egress #61 | 보류 | `01:155`, `06:382`, `06:386`, `08:21`, `08:74`, `08:132` | 보류. PASS |

메모 (ISSUE 아님): `05-status-security.tex:31` "그대로 둠 (결정 69)"과 `04-blocking.tex:607` "그대로 둔다"는 결정의 내용(규칙을 켜 둔다)이지 상태어가 아니다. 두 곳 모두 같은 절이나 표 제목에 중단이 따로 있다.

## 4. 출처 밖 내용 (book.md 원칙 13)

**ISSUE 1건 (R1/R2와 같은 것). 메모 3건.**

| # | 위치 | 내용 | 분류 |
| --- | --- | --- | --- |
| R1/R2 | 위 2절 | #70과 코드 완료 사실 누락. 출처가 있는데 책이 옛 상태를 말한다 | reasoning |
| 메모 a | `07-testing.tex:532–535` "사전 확인 요청이 로그 줄에 들어갔을 수 있다(추정, 확인 안 함)" | 02-blocking.md는 340 대 320의 차이를 설명하지 않는다. 추정 자체는 책이 더한 해석이다. 추정 라벨과 "확인 안 함"이 붙어 있고 산수(13+44+87+172+24=340)는 맞다. 원칙 13을 엄격히 읽으면 `\todo{미확인}`가 맞다. 비차단 메모 |
| 메모 b | `06-observability.tex:209–212` "세는 범위가 다른 것으로 보인다(추정, 확인 안 함)" | 04-observability.md는 1,394 대 1,370의 차이를 설명하지 않는다. 메모 a와 같은 성격. 산수(1,076+133+39+93+25+22+6=1,394)는 맞다. 비차단 메모 |
| 메모 c | `01-overview.tex:202` `% src: task brief (chapter list)` | 장 구성표의 출처가 저장소 파일이 아니다. 책 자체의 구조라서 사실 주장이 아니다. 비차단 메모 |

추정 라벨 확인: 출처가 추정이라 한 곳(`09:100, 09:167–171, 04:295–297, 04:313`)은 책도 추정으로 적었다. PASS.

## 5. 문체와 조판

**PASS. 비차단 메모 2건.**

| 검사 | 방법 | 결과 |
| --- | --- | --- |
| 줄표 | style.md §3 grep, 10개 장 | 0건 |
| 세미콜론 | 한국어 산문 줄 grep (TikZ, listings, 수식 제외) | 산문 0건. 적중은 모두 TikZ 노드, 코드 블록, `\max(…,\;…)` 수식 |
| float + 캡션 + 라벨 | `\begin{figure}`/`\begin{table}`/`longtable` 수 = `tikzpicture`/`tabular` 수 = 캡션 수; `[H]` 수 일치; `\label`이 `\caption` 뒤 | 그림 29, 표 84(longtable 3 포함). 모두 float 안, 모두 `[H]` (longtable은 float 아님). PASS |
| 캡션 위치 | awk: 표는 캡션이 `tabular` 앞, 그림은 캡션이 `tikzpicture` 뒤 | 위반 0건 |
| booktabs `\midrule` 행 사이 | awk: 행 다음 행에 rule 없는 경우 | 0건. `\hline` 0건 |
| `\Cref` | `\ref{`, `\cref{`, `\pageref` grep | 0건. 모두 `\Cref` |
| 번호 표제 | preamble `\figurename`=Figure, `\tablename`=Table | PASS |
| 한글 폰트, CJKspace | preamble | PASS |

메모 (implementation, 비차단):

- `04-blocking.tex:509` 캡션이 세 문장이다. figures.md §3은 두 문장 이하다.
- 캡션 끝 출처 표기가 두 방식이다. Part B(05–08, A)는 캡션 안 `(src: …)`, Part A(01–04)와 09는 `% src:` 주석만이다. figures.md §3과 §7은 캡션에 출처 폴더를 요구한다. 책 전체에서 한 방식으로 맞추면 좋다.

## 6. 시각 검사

렌더: `pdftoppm -r 80`으로 PDF 12, 32, 38, 66, 70, 77, 81쪽을 `scratchpad/review/p*.png`에 냈다.

| PDF 쪽 | 그림 | 겹침 | 범례 | 결과 |
| --- | --- | --- | --- | --- |
| 77 | Figure 9.1 흐름도 (수정 전/후) | 없음 | 그림 아래 색 범례 | PASS |
| 81 | Figure 9.2 막대 (31–41 → 1–2) | 없음. 한도 점선 라벨, 막대 라벨 분리됨 | 축 위 한 줄 | PASS |
| 12 | Figure 1.1 시스템 그림 | 없음 | 그림 아래 | PASS |
| 32 | Figure 4.1 층 설계 | 없음 | 그림 아래 | PASS |
| 38 | Figure 4.4 한도별 구간 수 | **주석 화살표 끝이 한도 50 막대의 합계 라벨 "6"에 닿는다** (`04-blocking.tex:501, 504–506`) | 축 위 한 줄 | 비차단 메모 (figures.md §1) |
| 66 | Figure 7.4 L1 p95 | 없음 | 계열 하나, 범례 없음 | PASS |
| 70 | Figure 7.7 200/429 | 없음 | 축 위 한 줄 | PASS |

글자 크기: 그림 안 `\scriptsize`/`\footnotesize`가 80 dpi 렌더에서 읽힌다. 7 pt 이상으로 보인다.

## 7. 비밀 정보

**PASS.** 저장소가 공개이므로 전체 장을 grep했다.

| 대상 | 적중 | 판단 |
| --- | --- | --- |
| IP 주소 | `127.0.0.1`, `0.0.0.0`, `0.0.0.0/0`, `35.235.240.0/20` | loopback, 와일드카드, Google IAP 공개 대역. `35.235.240.0/20`은 `deploy/gcp/README.md:37`에 이미 있다 |
| 쿠키 값 | `__session`, `__session_abc`, `__client_uat` 이름만 | 값 없음. `prefetch-source.md`의 `_rsc` 값(`5CB68i4pnAekjehf` 등)은 책에 없다 |
| 토큰, 키 | `x-origin-key: <비밀>`, `ORIGIN_KEY=<64 hex chars>`, `<ACCOUNT_ID>`, `<PROJECT_ID>`, `<EMAIL>` | 자리표시자뿐 |
| 메일 주소 | 0건 | |
| 프로젝트 ID, 터널 ID, UUID | 0건 | |
| VM 이름, 사용자, zone | `<USER>@<VM>`, `us-central1-a` | zone은 README:23에 이미 있다. 이름과 사용자는 자리표시자다 |
| 호스트 | `my.`, `blog-api.`, `local.prettylog.com` | 공개 호스트. README에 있다 |

## 8. 남은 \todo{}

**PASS.** 기대한 3건과 같다. 모두 오너 소유라 ISSUE가 아니다.

| 위치 | 내용 | 소유 |
| --- | --- | --- |
| `04-blocking.tex:202` | RL-0 Free 플랜 화면 값 (README §6a "Write what you see") | 오너 |
| `08-decisions.tex:145` | 브라우저 요청 헤더에 `x-origin-key`가 없는지 | 오너 |
| `09-prefetch.tex:339` | 배포 뒤 측정 결과 (스크롤 한 번의 요청 수, 429 유무) | 오너 |

## H1/H2 (hierarchy)

| 검사 | 결과 | 근거 |
| --- | --- | --- |
| H1 trace | **ISSUE (비차단)** | `00.plan.md:288`에 Phase TC mission block이 있고 M1–M6 줄마다 `cycle 0/2; recovery 0/2`가 있다. 그러나 이 책(`books/traffic-security`)을 가리키는 작업 행이 `00.tasks.md`, `00.plan.md`에 없다 (`grep -i "books/\|book"` 적중 없음). dispatch가 준 `cycle 1/2; recovery 0/2`를 싣는 milestone 줄이 없다. `budget:` 줄 없음(검사 대상 아님). 라우팅: product-manager |
| H2 decisions logged | PASS | 이 gate 전에 책 작업에서 선택이 생기지 않았다. 관련 오너 결정 #54–#70은 `decisions.plan.md`에 Why와 함께 있다 |

## 라우팅 요약

| 분류 | 건수 | 받는 쪽 | 항목 |
| --- | --- | --- | --- |
| implementation (차단) | 1 | sonnet-writer | A-commands.tex:357 `ON HOLD` → 중단 |
| reasoning (차단) | 2 | researcher (동기화) | R1 #70 누락과 "16개", R2 prefetch 완료 미반영 (08, 01) |
| reasoning (비차단) | 1 | researcher 또는 sonnet-writer | R3 07:827 확인 불가 문장 |
| implementation (비차단) | 3 | sonnet-writer | 04:509 캡션 3문장, Fig 4.4 화살표와 라벨 겹침, 캡션 출처 표기 통일 |
| hierarchy (비차단) | 1 | product-manager | 책 작업 행과 cycle 줄 없음 |

고치는 쪽에 주는 메모: R1, R2, A:357은 모두 한 번의 sonnet-writer 디스패치로 끝날 크기다. 새 조사는 없다. 출처는 `decisions.plan.md #70`, `deploy/traffic/review/prefetch-source.md §5`, `check.md`다.
