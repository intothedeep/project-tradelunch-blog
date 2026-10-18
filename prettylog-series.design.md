# Prettylog 프로젝트 연재(project series) 설계

> 상태: 설계 초안 rev1 (system-architect, 2026-10-18). 글, 코드, 그림 없음. 선택은 오너가 한다.
> 위치 근거: 저장소 선례 `projects.design.md`, `gcp.design.md`와 같은 루트 `*.design.md`다.
> `00.plan.md` 절과 `00.tasks.md` 행은 product-manager(pm)가 쓴다. 이 문서는 그것을 고치지 않는다.

## 0. 미션 블록 (인용)

> - Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
> - Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)

- 원본: `00.plan.md` Phase PJ "Mission block". 이 연재용 `PLAN` 절은 아직 없다.
- 목표(goal) 초안 (오너 승인 전, pm이 plan에 옮긴다):
  - G-PL1: 8개 글이 `projects/my-work/prettylog/` 아래 발행된다. 메뉴 Projects 배지(badge)는 2다.
  - G-PL2: 모든 숫자에 저장된 출처 파일이 있다. 측정 안 한 값은 "미측정"으로 적힌다.

오너 요구 (verbatim, 2026-10-18):

> write project posts for SST blog based on READM.md? design and plan to publish project series on this. do you understand?
> and last one will be debugging process with timeline? why? what? how? why matters?

## 1. 결과 요약

| 결정 | 권고 |
| --- | --- |
| 연재 제목 | **Prettylog From Scratch** (§2) |
| 독자 | 채용 담당자(recruiter) 먼저, 엔지니어(engineer) 둘째 |
| 글 수 | 8개: 개요 00 + 본편 01–07. 제목 형식 `Prettylog From Scratch (n/7): <결과 주장>` |
| 마지막 글 | 07 디버깅 타임라인(timeline). 사건마다 why / what / how / why it matters |
| 숫자 규칙 | README가 단일 출처(single source of truth, SST)다. 숫자마다 저장 파일을 단다 |
| 그림 | 저장된 CSV/JSON에서 스크립트로 그린다. mermaid는 이 블로그가 그리지 못한다 (§4) |
| 발행 | `posts/projects/my-work/prettylog/NN-<slug>/`. 그룹 이동은 이미 끝났다 (#119, PG-2-04/05) |

```text
README.md (SST) ──► data/*.csv (손으로 모은 숫자 + 출처 칸) ──► fig_*.py ──► PNG
      │                                                                    │
      └──► 00 개요 ─► 01 경로 ─► 02 1 GB ─► 03 엣지 ─► 04 Next ─► 05 배포 ─► 06 과정 ─► 07 디버깅
```

## 2. 연재 목적과 제목

목적:

- 채용 담당자: 혼자 만든 풀스택(full-stack) 시스템이 운영(production)에서 돈다는 것을 1분 안에 본다.
- 엔지니어: 무료 등급(free tier) 제약 안의 설계 선택과, 측정으로 판정한 과정을 본다.
- 선례: `utrgv/cnn-from-scratch` 연재와 같은 형식(그림 먼저, 키워드와 숫자, 긴 산문 없음).

제목 후보:

| # | 제목 | 한 줄 이유 | 판정 |
| --- | --- | --- | --- |
| A | **Prettylog From Scratch** | "CNN From Scratch"와 짝이다. My Work 구역에서 두 연재가 같은 틀로 읽힌다 | **고름** |
| B | Single Source of Truth: Building Prettylog | 오너의 SST 착안을 그대로 쓴다. 그러나 채용 담당자에게 SST는 낯선 약어다 | 버림. 부제 규칙으로 살림 |
| C | A Full-Stack Blog on Free Tiers | 검색어가 좋다. 그러나 제목 숫자 $3.65는 청구서(bill)가 아니라 정가 계산이다 (§6) | 버림 |

SST를 살리는 자리 (B안의 장점):

- 00 개요 첫 줄 아래 한 줄: "Every number here comes from a saved file. The README is the single source of truth."
- 각 글 끝 "Sources" 표: 숫자 → 파일 경로. `cnn` 연재의 `figures.md`와 같은 역할이다.

## 3. 글 목록

- 제목 숫자는 모두 측정값 또는 설정값이다. 설정값은 본문에서 "cap"이나 "config"로 밝힌다.
- 길이는 `cnn` 연재 기준(본문 45–72줄)이다. 산문은 그림 한 장당 1–2줄이다.

| # | 폴더 | 제목 (작업용) | 한 줄 주장 | 절 | 그림 (§4 F번호) | 출처 파일 | 길이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 00 | `00-overview` | Prettylog From Scratch: A Full-Stack Blog on 8 Free Tiers and One 1 GB VM | Next.js 16 + Express 5 + Postgres + CDN + 인증이 무료 등급 8개와 1 GB VM 하나로 돈다 | Results · By the numbers · Architecture · Stack · Series map | F00a, F00b, F00c | `README.md`, `research/free-tiers-2026-10.md`, `books/debugging/README.md`, `decisions.plan.md` | 60–70줄 |
| 01 | `01-request-path` | (1/7): Zero Open Ports, One Tunnel, Four Cache Rules | 방화벽은 들어오는 연결을 모두 막는다. 요청은 Cloudflare Tunnel 하나로만 VM에 온다 | Result · Request path · Hosts · URL map · Why this shape | F01a, F01b | `README.md` "Request path", "URL map", `gcp.design.md`, `deploy/gcp/README.md` | 50줄 |
| 02 | `02-one-gigabyte-vm` | (2/7): Next.js and Express in 1 GB RAM, Built Off the VM | heap 상한 160/256 MB + swap 4 GB + 빌드 외주. L2-api는 8 rps에서 p95 626 ms였다 | Result · Memory budget (caps) · 8 tricks · Load test · Limits | F02a, F02b | `README.md` "How a 1 GB VM survives", `deploy/gcp/web-self-proxy.md` (475 MiB), `01.status.md` 55–56행, `books/traffic-security/chapters/07-testing.tex` | 55줄 |
| 03 | `03-edge-cache` | (3/7): 640 of 640 Load-Test Requests Never Reached the VM | Cache Rules 4개가 `DYNAMIC`을 `HIT`로 바꿨다. 요청 수 제한은 100 → 50 → 70이 됐다 | Result · Before rules · 4 rules · Rate limit · Scroll burst 79 · Logging 4.5 MB/day | F03a, F03b, F03c | `books/debugging/15-traffic-overrun.md` §3.2, `deploy/traffic/review/traffic-debug-evidence.md`, `deploy/traffic/README.md`, `01.status.md` 49, 53–58행 | 60줄 |
| 04 | `04-nextjs-pipeline` | (4/7): Server Fetches Cut From 19 to 13, and Real 404s From a Proxy Gate | QW1 19 → 13은 판정이 난 값이다 (13 → 12는 원인 기록 없음, ch15 B6). Phase CC 단위 9개 중 3개(QW1, U2, U7)가 사전 등록선(pre-registered line)을 넘었다. U4는 prefetch를 3배로 늘렸다 | Result · Pipeline · Cache layers · Phase CC units · What failed | F04a, F04b | `books/nextjs-performance/chapters/08-results.tex`, `09-lessons.tex` 표, `cc.report.md`, `deploy/traffic/review/cc/runs/*/summary.csv` | 65줄 |
| 05 | `05-build-and-deploy` | (5/7): next build Never Runs on the VM: 7 Workflows, 3 Kept Releases | GitHub Actions가 tarball을 만든다. 맥(Mac)이 IAP로 보내고, PM2가 다시 읽는다. 롤백은 직전 release다 | Result · Deploy sequence · Workflows · Monorepo · Publish agent · Project groups | F05a, F05b | `README.md` "Build & deploy", "Monorepo map", "Other GitHub workflows", `projects.design.md` §12, `apps/blog_agent/CLAUDE.md` | 55줄 |
| 06 | `06-engineering-the-process` | (6/7): 121 Logged Decisions, Lines Written Before Each Run | 제목의 121은 D1이 센 행 수로 바꾼다. 결정마다 D-row를 먼저 쓴다. 판정선은 run 전에 고정한다. 리뷰(review)는 gate에서만 한다 | Result · Decision log · MVP ladder · Gates · Measurement lessons | F06a, F06b | `decisions.plan.md`, `01.status.md`, `.claude/CLAUDE.md` "System build phasing", `books/nextjs-performance/chapters/09-lessons.tex` | 50줄 |
| 07 | `07-debugging-timeline` | (7/7): 16 Traffic Causes Fixed, 6 Measured, 2 Got Worse | 07-09 OCI 업로드 실패부터 10-18 그룹 이동까지 사건 10개. 잰 것과 못 잰 것을 나눠 적는다 | Result · Timeline · 사건별 Why / What / How / Why it matters · What we never measured | F07a, F07b | `books/debugging/README.md`, `books/debugging/15-traffic-overrun.md`, `01.status.md`, `decisions.plan.md` | 75줄 |

### 3.1 07 디버깅 글: 사건 목록

- 형식: 사건마다 4칸 표. Why = 왜 생겼나, What = 무엇이 보였나, How = 어떻게 고쳤나, Why it matters = 무엇을 배웠나.
- 매핑: `15-traffic-overrun.md` 칸 원인 → Why, 증상 → What, 처방 → How, "배운 것" → Why it matters.
- 날짜 출처가 없는 사건은 넣지 않는다. 예: BIGINT id 반올림(rounding) 사건(`f1e18ee`)은 날짜 기록이 status에 없다.

| # | 날짜 | 사건 | 핵심 숫자 | 출처 |
| --- | --- | --- | --- | --- |
| T1 | 2026-07-09 | OCI 업로드 실패 "aws chunked encoding not supported" → checksum `WHEN_REQUIRED` | 없음 (이진) | `01.status.md` 18행, `8ba1794` |
| T2 | 2026-09-04 | Phase CF: Next 서버 캐시를 모두 끔. 뒤에 OG 캐시가 꺼진 원인이 됨 | 없음 | `01.status.md` 40행, ch15 A1 |
| T3 | 2026-09-22 | Vercel 402 `DEPLOYMENT_DISABLED`. 누수 5건 수정 | OG 528 → 12 ms (렌더 시간) | ch15 §2, [S-TDE-1], [S-TDE-2] |
| T4 | 2026-10-12 | Vercel을 떠나 GCP e2-micro + Tunnel로 결정 | 결정 #47–#54 | `01.status.md` 41–44행 |
| T5 | 2026-10-13 | 이전(cutover) 날. `blog-api` 재시작 반복, web 자기 proxy로 20 s 멈춤 | ↺15, 20 s | casebook 1, 9 |
| T6 | 2026-10-13 | 엣지 캐시 없음: 모든 응답 `DYNAMIC` → Cache Rules 뒤 `HIT` | L1 640 요청, VM 도달 0 | ch15 B1, [S-TDE-5], [S-TDE-7] |
| T7 | 2026-10-13 | 익명 스크롤 한 번이 prefetch 폭주. 429를 받음 | 79 요청, 264 kB, 28줄 중 27줄 429 | ch15 B3, [S-TDE-9] |
| T8 | 2026-10-14 | U4 시도 1: 운영에서 모르는 경로가 500 → 되돌림 | `/nope` 500, 21 B | `01.status.md` 99행 |
| T9 | 2026-10-14 | U4 운영: 링크당 prefetch 2 → 6. 한도 50 → 70으로 받음. U5는 43회 오류로 뺌 | ×3, 302 → 316 ms | ch15 B9, B10, `01.status.md` 112–115행 |
| T10 | 2026-10-18 | 그룹 이동 F1 실제 run이 undefined-group 오류를 잡음. 같은 title 위험 확인 | 그룹 4행, cnn 1행 이동 | `01.status.md` 137–140행, #120, #121 |

- casebook 15건 중 12건은 Result 줄 날짜가 2026-10-13이다 (1, 4–14). 07 글은 이 수를 띠(band) 하나로 보인다.
- 07의 결론 표는 ch15 §1.1을 그대로 쓴다. 정직한 행을 빼지 않는다: B7 옮김(전체 12 → 12), B9 나빠짐(2 → 6), B10 나빠짐(302 → 316 ms).
- ch15의 이름표도 옮긴다: A1 528 → 12 ms는 렌더 시간이다. 트래픽 감소가 아니다.

## 4. 그림

### 4.1 만드는 법

- 블로그는 mermaid를 그리지 못한다. `apps/dashboard_client_web`에 mermaid 렌더러가 없다 (grep 0건).
- 그래서 README 다이어그램은 PNG로 다시 그린다. 도구는 matplotlib 상자 그림이다.
- mermaid-cli는 headless chromium을 띄운다. 로컬 허용 조건(한 코어)을 넘을 수 있다. 쓰려면 오너에게 묻는다.
- 입력: 손으로 모은 `data/*.csv`. 모든 행에 `source` 칸(파일 경로 + 행 또는 태그)을 둔다.
- 실행: `OMP_NUM_THREADS=1 timeout 300 uv run python fig_<NN>.py` (`~/.claude/CLAUDE.md` "Allowed locally").
- 스타일: 공용 모듈 하나 `fig_style.py` (`rules/visualization.md` §5). 글꼴 대체 목록은 `rules/figures.md` §5.
- 캡션: 두 문장 이하. 둘째 문장은 "Why:"로 연다 (`rules/figures.md` §3).
- 설정값(cap)과 측정값을 같은 축에 그리면 범례에 "cap (config)" / "measured"로 나눈다.

### 4.2 그림 목록

| F | 파일 | 보이는 것 | 핵심 숫자 | 데이터 출처 |
| --- | --- | --- | --- | --- |
| F00a | `fig_00_stack.png` | 서비스 8개와 연결 (README 첫 mermaid) | 8개 무료 등급 | `README.md` 25–34, 38–48행 |
| F00b | `fig_00_numbers.png` | 숫자 막대: 앱 3, 패키지 7, workflow 7, casebook 15, 결정 121 | 같은 값 | `README.md`, `books/debugging/README.md`, `decisions.plan.md` |
| F00c | `fig_00_cost.png` | 항목별 월 비용. IPv4만 0이 아니다 | ≈ $3.65 **list price** | `README.md` 50–58행, `research/free-tiers-2026-10.md` [S-FT-22] |
| F01a | `fig_01_request_path.png` | 브라우저 → Cloudflare → Tunnel → PM2 → Supabase | 규칙 4, 한도 70 / 10 s | `README.md` 117–141행 |
| F01b | `fig_01_url_map.png` | 공개, 소유자 전용, 404, 308 경로 | 경로 종류 5 | `README.md` 196–223행 |
| F02a | `fig_02_memory_caps.png` | 1 GB RAM + 4 GB swap 안의 heap 상한 160 / 256 MB | 상한 (config) | `README.md` 67행 |
| F02b | `fig_02_load_test.png` | L1 HIT 경로, L2 web, L2-api 결과 | 640 HIT · C_web ≈ 2 rps · p95 626 ms @ 8 rps | `01.status.md` 55–56행, `07-testing.tex` §결과 1–3 |
| F03a | `fig_03_cache_status.png` | 규칙 전 `DYNAMIC`, 규칙 뒤 `HIT` (URL별) | 640 중 VM 0 | [S-TDE-5], [S-TDE-7] |
| F03b | `fig_03_rate_limit.png` | 한도 계단 그림 100 → 50 → 70, 날짜와 결정 번호 | #68, #106 | ch15 §2 |
| F03c | `fig_03_scroll_burst.png` | 스크롤 한 번 요청 79 (전). 뒤는 빈 막대 "not measured" | 79, 264 kB, 27/28 | [S-TDE-9], ch15 §6 G8 |
| F04a | `fig_04_pipeline.png` | proxy → Clerk → 존재 gate → App Router (README mermaid) | fail-open 1500 ms | `README.md` 155–185행 |
| F04b | `fig_04_cc_units.png` | 단위별 전후: QW1 19→13, U2 1→0, U3 317→174 ms, U7 12→0, U4 prefetch 2→6 | 같은 값 | `09-lessons.tex` 표 `tab:le-all`, `cc.report.md` |
| F05a | `fig_05_deploy.png` | push → Actions → 맥 → IAP scp → `release.sh` → purge | release 3개 유지 | `README.md` 239–262행 |
| F05b | `fig_05_groups.png` | `projects/<group>/<project>` 계층. 스키마 변경 0 | 그룹 4, 이동 1행 | `projects.design.md` §12.1, §12.6 |
| F06a | `fig_06_decisions.png` | 날짜별 D-row 수 | 번호 #1–#121 (행 수는 D1이 센다) | `decisions.plan.md`. 날짜 없는 행은 `01.status.md`의 같은 번호 줄 날짜 |
| F06b | `fig_06_gates.png` | 단계별 gate 순환 (PJ, CC, PG): cycle n/2 | CC gate 2/2, U4 recovery 2/2 | `01.status.md` 93, 97, 111, 123, 137행 |
| F07a | `fig_07_timeline.png` | T1–T10 시간 축. 10-13 띠에 casebook 12건 | 날짜 10개 | `data/07_timeline.csv` (§3.1 표) |
| F07b | `fig_07_measured.png` | 원인 16개: 측정된 감소 4 (A1, B6, B7 `my.`, B8) / 측정된 악화 2 (B9, B10) / 비교 불가 10 | 4 / 2 / 10 | ch15 §1.1 |

### 4.3 썸네일과 파일 이름

- 썸네일: 글마다 `NN-<slug>.png`, 1200×630. 폴더 이름, md 이름과 같다 (MEMORY "Blog publish oneshot flow").
- 썸네일 글자: "Prettylog From Scratch · NN" + 핵심 숫자 하나. `cnn` 연재 `07-engineering-the-process.png`와 같은 틀이다.
- 썸네일 이름 `NN-<slug>.png`는 폴더마다 정확히 한 장이다.
- 본문 그림 `fig_NN_*.png`는 같은 폴더에 둔다. 모두 md 본문이 참조한다 (`cnn` 연재와 같다).
- 참조되지 않는 PNG는 폴더에 두지 않는다.
- OG webp는 `<post>/.generated/`에 생긴다. 썸네일로 잘못 잡히지 않는다 (casebook 14.2, `11b3023`).
- 본문 첫 줄: `![NN-<slug> thumbnail](NN-<slug>.png)` (`cnn` 연재와 같다).

## 5. 발행 계획

### 5.1 폴더와 앞머리(front matter)

```text
apps/blog_agent/posts/projects/my-work/prettylog/      (posts/ 는 gitignore. 커밋되지 않는다)
  00-overview/00-overview.md + 00-overview.png + fig_00_*.png
  01-request-path/ ...
  07-debugging-timeline/07-debugging-timeline.md + .png + fig_07_*.png
  _series/data/*.csv, _series/fig_style.py, _series/fig_NN.py, _series/figures.md
```

- 카테고리 경로 = 폴더 경로: `projects` → `my-work` → `prettylog`. 프로젝트 slug는 `prettylog`다.
- `_series/`는 발행 대상이 아니다. blog_agent가 md만 읽는지 D1 단위에서 확인한다.
- 앞머리는 `cnn` 연재를 복사한다: `title`, `tags`, `desc`, `date`, `priority`, `userId: 1`, `username: taeklim`, `status: 'public'`.
- `priority`: 00 = 0, 01 = 1, … 07 = 7. 프로젝트 안 순서 00 → 07이 운영에서 확인됐다 (`01.status.md` 64행).
- 연재 지도(series map) 링크는 새 모양 `/@taeklim/<slug>`를 쓴다. `cnn` 개요의 `/blog/...`는 308을 탄다.
- 본문 글: 영어, `rules/writing/style.md` §2–§3 (15단어, 세미콜론과 줄표 없음).
- `rules/writing/book.md`는 적용하지 않는다. 그 범위 표는 책, 논문, 회의 문서만 든다.

### 5.2 순서 (main session 또는 오너가 실행)

```text
1 발행 전 확인 (읽기 전용 SELECT)  title='prettylog' 카테고리가 어느 부모 아래에도 없다 (PG-2-08, #121)
2 그룹 확인                         my-work 그룹 행이 있다 (그룹 13–16, PG-2-04)
3 발행 01 → 07                      publish_oneshot.py --no-llm, 글마다 한 번
4 발행 00 마지막                    링크 대상 slug가 모두 있다. 홈 피드 맨 위에 개요가 온다
5 Cloudflare 전체 purge             _scripts/cloudflare/cf-purge.sh (HTML + blog-api, 둘 다 1일)
6 확인                              §5.3
```

- 연재는 recobell, adriel보다 먼저 간다. My Work 그룹 priority 10은 Company 20보다 앞이다 (§12.5).
- 4를 마지막에 두는 이유: slug는 제목에서 만들어진다. 링크를 실제 slug로 고친 뒤 개요를 낸다.
- main session 기본값 "개요 먼저"와 다르다. 읽는 순서(priority 0)는 개요가 먼저 그대로다. 발행 시각만 마지막이다.
- 01–07은 서로 링크하지 않는다. 연재 지도는 00에만 둔다. 그래서 slug 닭과 달걀 문제는 00 하나뿐이다.

### 5.3 확인

| 확인 | 기대 | 방법 |
| --- | --- | --- |
| 메뉴 Projects 배지 | 2 (cnn + prettylog) | 화면 |
| `/@taeklim/projects` | "My Work" 구역이 맨 위, 카드 1개. UTRGV 구역 cnn 그대로 | 화면 + curl 200 |
| `/@taeklim/projects/prettylog` | 200, 글 8개, 순서 00 → 07 | curl + 화면 |
| `/@taeklim/projects/cnn-from-scratch` | 200 그대로 | curl |
| 글 8개 `/@taeklim/<slug>` | 200, 썸네일 보임, 오른쪽 rail에 TOC + tree | curl + 화면 |
| `/@taeklim/projects/my-work` | 404 (그룹 URL 없음, §12.2) | curl |
| sitemap | 새 URL 8개 | curl `sitemap.xml` |
| Cache Rules | 14개 검사 0 FAIL | `_scripts/cloudflare/traffic-check.sh` |
| 엣지 HIT | 새 글 2개 + `/@taeklim/projects`, 두 번째 GET `cf-cache-status: HIT` | curl 두 번 |
| 같은 title | `prettylog` 카테고리 1행 | 읽기 전용 SELECT |

## 6. 없는 숫자 (gaps)

| 값 | 상태 | 글에 쓰는 법 |
| --- | --- | --- |
| 월 비용 $3.65 | 정가 계산. $0.005/h × 730 h. 실시간 가격표를 읽지 못했다. 청구서 없음 | "≈ $3.65 / month at list price (not a bill)" |
| 월 송신량(egress), GB | 미측정. README `314 MiB`는 예시 출력이다 (ch15 §6 G2) | 쓰지 않는다. "egress not measured" |
| 402 때 넘친 Vercel 계량기 | 저장 파일 없음 (G1) | "which meter tripped is unknown" |
| Cloudflare HIT 비율 | 미측정 (G3, TC-M3-2) | URL별 "second GET HIT"만 쓴다 |
| 수정 뒤 스크롤 요청 수 | 미측정 (G8) | 79 옆 빈 막대 "not measured" |
| 바이트 지표(U1) | null을 0으로 셈. 판정 불가 | "byte metric broken, no verdict" |
| U4 이동 시간 | 환경 표류(drift) +150 ms와 섞임 | 시간은 쓰지 않는다. prefetch 수(×3)만 쓴다 |
| VM 메모리 추이 | 한 번 잰 값뿐: 475 MiB 남음 | "one snapshot" |
| 방문자 수, 트래픽 양 | 저장 없음 | 쓰지 않는다 |

- 규칙: 제목과 결과 줄에는 측정값만 쓴다. 정가와 설정값은 본문에서 이름표를 단다.
- 07 글의 "What we never measured" 절이 이 표를 줄여 싣는다. 약점이 아니라 과정의 증거로 보인다.

## 7. 설계 단위 (pm용, 크기와 순서만)

| # | 단위 | 크기 | 선행 | 담당 (권고) |
| --- | --- | --- | --- | --- |
| D1 | `_series/data/*.csv` 모으기. 행마다 `source` 칸. blog_agent가 `_series/`를 무시하는지 확인 | S | 없음 | developer |
| D2 | `fig_style.py` + F00–F07 스크립트, PNG 18장 + 썸네일 8장 | M | D1 | developer |
| D3 | `_series/figures.md` (그림 → 숫자 → 출처 표, `cnn` 형식) | S | D2 | developer |
| D4 | 글 00 초안 (지도 링크는 자리표) | S | D3 | sonnet-writer |
| D5 | 글 01–06, 글마다 한 단위 | S × 6 | D3 | sonnet-writer |
| D6 | 글 07 디버깅 타임라인 | M | D3 | sonnet-writer |
| D7 | gate 검토: 숫자마다 출처, §6 이름표, 그림 규칙 §7 | S | D4–D6 | reviewer |
| D8 | 발행 §5.2, purge, 확인 §5.3 | S | D7, 오너 go | main session |

- MVP 사다리(`.claude/CLAUDE.md` "System build phasing")는 적용하지 않는다. 새 스키마, API, 파이프라인이 없다.
- 그룹 데이터 계약은 `projects.design.md` §12.3 그대로다. 발행은 그 계약 위의 데이터 쓰기다.
- 측정 run이 새로 필요하면(예: G8 스크롤 재측정) 이 연재 밖이다. 숫자는 §6처럼 "미측정"으로 둔다.

## 8. 열린 질문 (오너)

| # | 질문 | 기본값 |
| --- | --- | --- |
| Q1 | 글 언어 | 영어 (`cnn` 연재와 같다, 채용 담당자용) |
| Q2 | 연재 제목 | A "Prettylog From Scratch". SST는 개요 한 줄과 Sources 표로 넣는다 |
| Q3 | 그림 데이터와 스크립트(`_series/`)를 git에 남길까 | 남기지 않는다. `posts/`는 gitignore이고 `cnn`도 저장소 밖에 두었다 |
| Q4 | 다이어그램 PNG 도구 | matplotlib 상자 그림. mermaid-cli는 오너가 로컬 run을 허락할 때만 |
