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

## 9. 후속 글 08: 알리바바 봇과 egress 초과 (system-architect, 2026-11-18)

> 상태: 설계 초안. 글, CSV, 그림 없음. §1–§8은 고치지 않는다.
> 그림 방식은 `ps.plan.md`(#124)를 따른다: 다이어그램 = 글 안 mermaid, 데이터 차트만 PNG. §4.1의 "mermaid를 못 그린다"는 낡았다 (`ps.plan.md` "설계 정정 필요").
> 사실 원본: `deploy/traffic/review/07-alibaba-bot.md`(핵심 흐름 13–36행), 원자료 `deploy/traffic/review/history/2026-11-18-alibaba-bot/`, `tips/bot-egress.tips.html`.

### 9.0 미션 블록 (인용, `ps.plan.md` 13–15행)

> - Mission: 채용 담당자가 프로젝트 결과를 한눈에 보게 한다. (오너 승인 2026-10-13, #79)
> - Vision: 방문자가 `/@u/...` 한 체계에서 글, 프로젝트, 소개를 로그인 없이 읽는다. 옛 URL은 모두 새 URL로 연결된다. (오너 승인 2026-10-13, #79)
> - Constraints (줄임. 원문은 `ps.plan.md:15`): 글은 영어 · 숫자는 모두 저장된 파일에서 · `posts/`와 `S`는 커밋하지 않음 · 증거는 `deploy/projects/ps-*.txt` · 다이어그램 = mermaid, 차트만 matplotlib PNG · 로컬 실행 입력 = `S/data/*.csv`만, 한 코어, 300 s · 발행, 운영 SQL, purge, 운영 curl = main session 또는 오너만 · 발행 순서 · 테스트 러너 금지.

- 이 글이 미션에 맞는 이유: 운영 사고를 찾고 막은 과정은 채용 담당자가 보는 "운영 능력"의 결과다.
- 미션 블록 밖 일: G-PL1 measure("글 8개, 00 → 07")와 S1("글 8개")은 9번째 글을 덮지 않는다. 오너 승인용 초안은 §9.8에 둔다.

### 9.1 결과 요약

| 결정 | 고름 |
| --- | --- |
| 자리 | 후속 글(follow-up) 하나. 폴더 `08-bot-egress/`, `priority` 8. 기존 글 8개는 손대지 않는다 |
| 제목 | `Prettylog From Scratch (Follow-up): <N> Feed Page Requests in 9 Days, All Past the Cache` |
| N | `fig_08_daily_requests.csv`의 `/@taeklim/posts` 열, 11-09 ~ 11-17(9일, 모두 온전한 날) 합. 스크립트가 센다. 봇과 사람을 나누지 않은 전체 요청이다 |
| 순서 | Results → 핵심 흐름(mermaid) → Problem → How it was checked → Fixes → Not measured → Sources |
| 그림 | mermaid 2개, 차트 PNG 4장, 썸네일 1장 |
| 발행 | 한 번만. 두 조치 뒤 첫 온전한 하루(11-19 UTC)를 11-20에 모은 뒤 |
| 사전 판정선 | V1 캐시: 4경로 요청 중 오리진 도달 비율 ≤ 10 %. V2 WAF: SSR 피드 호출 하루 ≤ 2,000 (§9.6) |

```text
11-18 22:30 WAF 규칙 2, 1 (오너) + 22:35 캐시 배포 (3bb35f0)
   ─► 15분 첫 값 저장됨 (cf-after-*-15min.json)
   ─► 11-19 UTC 하루 = V1, V2 창 ─► 11-20 main 수집
   ─► CSV + 그림 ─► 글 작성 ─► reviewer 1회 ─► 글 발행 (한 번)
```

### 9.2 자리: 연재 안 어디에 두나

근거 (slug는 제목에서 만든다):

- `publish_oneshot.py` 경로는 `article_info`를 넘기지 않는다. 그래서 slug = `generate_slug_from_title(title)`다 (`apps/blog_agent/agents/extracting_agent.py:170-173`, `schema.py:354-373`).
- 운영 slug에 `1-7` … `7-7`이 들어 있다 (`00-overview.md:87-93`).
- `upsert_post`는 매번 새 행을 INSERT한다. 서버는 slug마다 마지막 판을 고른다 (`db/repositories/post.py:192-226`).
- 그래서 제목을 바꾸면 새 slug의 새 글이 생긴다. 옛 slug 글은 살아 있고, 옛 URL → 새 URL 연결은 없다.

| 안 | 내용 | 판정 |
| --- | --- | --- |
| A | **후속 글 `(Follow-up)`, 폴더 08, priority 8** | **고름**. 기존 URL 8개 그대로. 프로젝트 쪽에서 맨 뒤에 보인다 |
| B | `(8/8)`로 내고 01–07을 `(k/8)`로 다시 냄 | 버림. 새 slug 7개 + 옛 글 7개가 공개로 남는다. 숨기려면 tombstone 7행. 옛 URL 연결이 끊겨 Vision에 어긋난다 |
| C | 연재 밖 단독 글(다른 카테고리) | 버림. 프로젝트 페이지에서 안 보인다. 채용 담당자가 놓친다 |
| D | 07 디버깅 타임라인에 T11로 덧붙임 | 버림. 07 다시 발행 = 같은 slug 새 행, 새 id. 좋아요와 댓글이 어느 id에 붙는지 확인 안 됨 |
| E | 00 개요의 연재 지도에 08 행 추가 | 버림 (지금). 00 다시 발행이 필요하다 (D와 같은 위험). 프로젝트 페이지가 이미 08을 보인다 |

- 공통 AC C3(제목 형식)과 C11(링크 없음)은 08용으로 고친다 (§9.7 P8-08).
- 다시 발행(republish)은 피한다. 새 id가 생기기 때문이다. 그래서 발행은 한 번이다 (§9.6).

### 9.3 제목, slug, 앞머리

| # | 제목 후보 | 판정 |
| --- | --- | --- |
| T1 | **Prettylog From Scratch (Follow-up): `<N>` Feed Page Requests in 9 Days, All Past the Cache** | **고름**. N은 실측 합(봇과 사람을 나누지 않음). 피드 HTML은 `private, no-store`라 모든 요청이 캐시를 지난다 (`07-alibaba-bot.md:19`). 15단어 |
| T1′ | (Follow-up): `<N>` Bot Page Requests in 9 Days Skipped the Cache | 버림. 봇과 사람을 나눈 저장 파일이 없다. 11-08 하루 1,943은 봇 전 값이다 |
| T2 | (Follow-up): 4 Uncached API Routes Turned One Bot Into 600,058 Database Calls | 버림. 600,058은 10-13 이후 누적이다. 평소 방문도 섞였다 |
| T3 | (Follow-up): How an Alibaba Cloud Bot Burned Through Free Supabase Egress | 버림. 숫자가 없다. 회사 이름을 제목에 둔다. egress GB는 저장 파일이 없다 |
| T4 | (Follow-up): One Bot, 7 API Calls per Page, Free Egress Gone | 버림. 7은 페이지당 호출 구조값이다. 사건 크기를 보이지 못한다 |

- 제목 숫자 N은 손으로 쓰지 않는다. P8-05 스크립트 합을 그대로 쓴다.
- 11-18은 부분 날(조회 시각까지)이라 N에서 뺀다. 그래서 "9 Days"다.
- slug: 제목에서 생긴다. 쉼표는 `-`가 된다 (예: `219,372` → `219-372`). 발행 전에 slug를 `ps-08-publish-<date>.txt`에 적는다.
- `meta_title`은 70자에서 잘린다 (`uploading_agent.py:439`). 기존 07도 같다. 받아들인다.

앞머리 (cnn 형식, `ps.plan.md` C2):

| 키 | 값 |
| --- | --- |
| `title` | T1 |
| `tags` | `postmortem`, `cloudflare`, `waf`, `caching`, `supabase`, `bot-traffic`, `egress`, `observability` |
| `desc` | 한 문장: bot, cache bypass, two fixes. 170자 이하 (`meta_description` 한도) |
| `date` | 발행 날짜 |
| `priority` | 8 |
| `userId`, `username`, `status` | `1`, `taeklim`, `'public'` |

### 9.4 글 구성 (오너 순서: 문제 → 확인 → 조치, 핵심 흐름이 맨 앞)

| # | 절 | 담는 것 | 그림 | 출처 |
| --- | --- | --- | --- | --- |
| 0 | 썸네일 + 질문 한 줄 | "Question: who used up the free database egress, how was it found, and what stopped it?" | TH08 | |
| 1 | `## Results` | 3줄: 봇 출처(ASN 45102), N 요청, 두 조치(11-18 22:30 ~ 22:35 함께 배포)의 V1, V2 판정. 15분 첫 값은 보조 | 없음 | `fig_08_verdicts.csv` |
| 2 | `## The core flow` | 오너의 핵심 흐름 그대로. 봇 → 피드 MISS → SSR 7회 호출 → BYPASS 4경로 → Supabase | M08a | `07-alibaba-bot.md:15-31`, `cf-24h-api.json` |
| 3 | `## Problem` | 일별 요청, 10-22 시작(추정 표시), 11-09부터 하루 2만 안팎. 캐시를 피한 이유 2개. IP당 하루 10–20회라 한도 70 / 10 s에 안 걸림 | F08a | `cf-zone-daily.json`, `cf-posts-page-daily.json`, `cf-24h-ip.json`, `apis/buildFeedQuery.ts:29-32` |
| 4 | `## How it was checked` | 다섯 단계 a–e. 느린 쿼리가 아니라 호출 수. timeout은 원인이 아니라 결과 | M08b, F08c, F08d | `supabase-query-summary.txt`, `error-log.txt`, tips Step 2 |
| 5 | `## Fixes` | 표 3행: WAF / API 캐시 4경로 / 필터 query 정규화. 행마다 끊는 곳, 상태, 전, 후 | F08b | `3bb35f0`, `07-alibaba-bot.md:167-206` |
| 6 | `## What we never measured` | Supabase egress GB, GCP egress GB, ASN과 query string(무료 플랜) | 없음 | §9.6 |
| 7 | `## Sources` | 공통 AC C7 | | |

- 길이: 본문 60–70줄. 산문은 그림 하나에 1–2줄 (owner: 차트 + 키워드 + 숫자).
- 10-22 시작은 `/@taeklim/posts` 열이 없는 기간이다 (11-08부터). 존 요청과 `error_log` 주별로 추정했다. 글에 "inferred"로 쓴다.
- 봇 IP: 글에는 ASN과 `/16` 대역(47.79, 47.82)만 쓴다. 전체 IP는 쓰지 않는다.
- VM IP는 어디에도 쓰지 않는다 (`07-alibaba-bot.md:36`).
- WAF 규칙 2의 식(expression)은 글에 싣지 않는다. 다음 봇에게 피하는 법을 알려 준다. 글에는 "multi-tag filter URLs from unverified bots get a challenge" 한 줄만 쓴다.
- WAF 규칙 1(ASN 45102 Block)은 식을 실어도 된다. 피할 방법이 ASN을 바꾸는 것뿐이다.
- 바이트 크기(38 KB, 11 KB, 약 50 KB)와 추정 11 GB는 원자료 파일이 없다. 글에 쓰지 않는다. 쓰려면 P8-02b를 먼저 한다.
- blog-api 합계 157,153은 저장 파일로 다시 나오지 않는다. 두 JSON은 상위 20 그룹뿐이다 (host 합과 api 합이 서로 다르다). 글은 경로별 행만 쓴다. 합이 필요하면 CSV에서 세고 "top 20 groups"를 붙인다.

### 9.5 그림

#### mermaid (글 안, `S/data/F08*.mmd`에 원문)

| F | 종류 | 보이는 것 | 출처 |
| --- | --- | --- | --- |
| M08a | `flowchart TD` | 봇(SG, ASN 45102) → `my.` 피드 MISS (`private, no-store`, 무작위 필터) → SSR 7회 → 6경로와 캐시 상태 → Supabase 쿼리 5–6개 → 과부하 → timeout → `error_log` INSERT | `07-alibaba-bot.md:15-34`, `cf-24h-api.json` |
| M08b | `flowchart LR` | a Supabase calls → b Cloudflare 일별 → b' 24시간 host/path/IP → c `curl -D -` 헤더 → d `error_log` 집계 → e `whois` ASN | `tips/bot-egress.tips.html` Step 2, `07-alibaba-bot.md:220-224` |

- M08a는 바이트 라벨 없이 옮긴다 (§9.4). 경로 이름과 캐시 상태는 그대로다.
- 조치가 끊는 곳은 M08a에 그리지 않는다. F08b와 Fixes 표가 보인다.

#### 데이터 차트 (`S/fig_08.py`, CSV는 저장 JSON/TXT에서 스크립트로 뽑는다)

| F | 파일 | 보이는 것 | CSV (열) | 원자료 |
| --- | --- | --- | --- | --- |
| F08a | `fig_08_daily_requests.png` | 패널 2개, x축 공유. 위: 존 일별 요청(캐시분 구분). 아래: `/@taeklim/posts` 일별. 11-18 부분 날은 빗금. 세로선 하나: 11-18 22:30 ~ 22:35 (WAF + 캐시). 아래 패널의 뒤 날은 200만 센다 (V2와 같은 정의) | `fig_08_daily_requests.csv` (date, zone_requests, zone_cached, posts_page_requests, status, source) | `cf-zone-daily.json`, `cf-posts-page-daily.json`, 뒤 수집 파일 (§9.6) |
| F08b | `fig_08_api_cache.png` | 패널 2개. 왼쪽: 15분 구간 21:00 ~ 22:30, 피드 200/403 + blog-api bypass/miss/hit (조치 순간). 오른쪽: 6경로 × 전(11-17 12:00 ~ 11-18 12:00) / 후(11-19 하루), HIT 대 오리진 도달 (§9.6 정의), `none`은 따로 | `fig_08_api_cache.csv` (window, path, cache_status, edge_status, count, status, source) | `cf-after-posts-15min.json`, `cf-after-api-15min.json`, `cf-24h-api.json`, 뒤 수집 파일 |
| F08c | `fig_08_supabase_calls.png` | 쿼리 6개(#1–#5, #7)의 호출 수. 제목에 "cumulative since stats reset 2026-10-13 01:02 UTC" | `fig_08_supabase_calls.csv` (rank, query_label, calls, mean_ms, source) | `supabase-query-summary.txt:1-14`, `error-log.txt:1-2` |
| F08d | `fig_08_error_log.png` | 주별 `error_log` 행, 그중 `/@taeklim/posts?…`. 11-16 주는 부분 주 | `fig_08_error_log.csv` (week, rows, posts_rows, status, source) | `error-log.txt:4-12` |

- 캡션: 두 문장, 둘째는 "Why:" (`rules/figures.md` §3). 끝에 `Data: _series/data/<csv>`.
- "후" 값이 아직 없으면 그 막대는 빈 막대 + `not measured` (F03c와 같은 방식).
- F08b "전" 행은 반환된 상위 20 그룹뿐이다. 캡션에 "top 20 groups"를 쓴다. "후" 수집은 `limit` 100 이상, host = `blog-api.prettylog.com` 필터로 한다.
- F08c는 평소 방문이 섞인 누적값이다. "전 하루" 값이 아니다. 전후 비교에 쓰지 않는다.

#### 썸네일

| F | 파일 | 숫자 | 글자 | 출처 |
| --- | --- | --- | --- | --- |
| TH08 | `08-bot-egress/08-bot-egress.png` | N (제목과 같은 값) | "feed page requests in 9 days, past the cache" | `cf-posts-page-daily.json` |

- `thumbs.py`의 위치 격자는 4 × 2 = 8칸이다 (`thumbs.py:26-34`). NN = 08이면 칸 밖으로 나간다.
- 고침: 08은 위 글자를 "Prettylog From Scratch · Follow-up"으로 쓴다. 8칸은 모두 회색, 채운 칸 없음.
- `thumbs.py`는 지정한 NN만 그린다. 기존 썸네일 8장의 바이트는 바뀌지 않는다 (P8-06 AC).

### 9.6 "후" 측정: 무엇을, 언제

사실 갱신 (coordinator, 2026-11-18): WAF 규칙 2는 22:30 UTC쯤, 규칙 1은 그 직후 배포됐다. 캐시 배포(22:35)와 같은 15분 구간이다. 그래서 두 조치는 같은 날부터 함께 돈다.

이미 있는 첫 "후" 값 (15분 단위, 부분 구간):

| 15분 구간 (UTC, 11-18) | `/@taeklim/posts` 200 | 403 | blog-api bypass | miss | hit |
| --- | --- | --- | --- | --- | --- |
| 21:00 ~ 22:15 (6구간) | 구간마다 177 ~ 249 | 0 | 구간마다 887 ~ 1,254 | 179 ~ 252 | 179 ~ 265 |
| 22:30 (부분) | 52 | 107 | 0 | 55 | 328 |

- 출처: `history/2026-11-18-alibaba-bot/cf-after-posts-15min.json`, `cf-after-api-15min.json`. 위 범위는 이 두 JSON에서 읽었다. 글은 CSV 값만 쓴다.
- 주의: `07-alibaba-bot.md` §6.1 표는 JSON과 몇 칸 다르다. 403은 JSON 107, md 106. 22:00 bypass는 JSON 1,254, md 1,253. 22:15 bypass는 JSON 1,032, md 1,034. 글과 CSV는 JSON을 쓴다. md 고침은 main session 몫이다.
- 엣지 분석은 Challenge로 끝난 요청도 센다 (403 107). 그래서 "`/@taeklim/posts` 전체 요청"은 WAF 효과를 재지 못한다. `07-alibaba-bot.md:206`의 통과 기준도 같은 문제가 있다. 아래 V2는 200 응답만 센다.
- api 15분 JSON은 경로 차원이 없다. blog-api 호스트 전체다.

판정선 (`rules/measurement.md` §1). 이 절을 쓴 시각에 하루 "후" 값은 아직 없다. 데이터를 본 뒤 고치지 않는다.

| ID | 조치 | 주 지표 | 전 | 판정선 (통과) | 실패 | 창(window) | 가장 이른 수집 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | API 캐시 (`3bb35f0`) | 4경로(`/tags`, `/posts/users/taeklim/{tags,profile,categories}`) 요청 중 오리진 도달 비율. 오리진 도달 = `bypass`, `miss`, `expired`, `dynamic` | `cf-24h-api.json` 같은 4경로, 같은 정의 (스크립트가 셈) | ≤ 10 % | > 50 % | 11-19 00:00 ~ 11-20 00:00 UTC | 11-20 |
| V2 | WAF 규칙 2개 | `/@taeklim/posts` 중 `edgeResponseStatus` = 200, 하루 | 11-08 이후 일별 전체 요청 (전에는 403 = 0, 15분 JSON 21:00 ~ 22:15) | ≤ 2,000 | > 11-09 ~ 11-17 중 가장 작은 날의 50 % (스크립트가 CSV에서 정한다) | 11-19 00:00 ~ 11-20 00:00 UTC | 11-20 |

- V1이 비율인 이유: 봇 양이 줄어도 비율은 바뀌지 않는다. 그래서 WAF와 같은 날이어도 캐시 효과만 읽힌다.
- V1 최소 표본: 창 안 4경로 요청 ≥ 1,000. 못 미치면 `not comparable`. WAF가 SSR 호출 자체를 줄여 이럴 수 있다.
- `none` 상태는 오리진 도달로 세지 않는다. 뜻을 확인하지 못했다. CSV에 따로 적는다.
- 사이 값: `partial`. V1이면 캐시 헤더를 다시 보는 행, V2면 규칙 식을 다시 보는 행을 연다.
- 두 조치의 "절대 수 감소"(SSR 피드 호출, Supabase 호출)는 둘이 섞인다. 글에 "both fixes combined"로 쓴다. 따로 나누지 않는다.
- 잡음은 재실행으로 재지 않는다. 구조 변경의 하루 측정이다. 글에 "one day, one window"로 쓴다.
- 보조 V2b: blog-api `/posts/users/taeklim` (SSR 피드 호출) 하루 수. 전 = `cf-24h-api.json` 21,955 행. 봇 페이지 하나가 SSR 피드 호출 하나를 만든다 (`07-alibaba-bot.md:20-27`).
- 저장 위치: `deploy/traffic/review/history/2026-11-20-after/`. 같은 GraphQL 쿼리(tips Step 2 b)에 `edgeResponseStatus` 차원을 더한다.
- 판정 결과는 `S/data/fig_08_verdicts.csv` 한 파일 (id, metric, before, after, ratio, verdict, source). 글은 이 파일에서만 숫자를 읽는다.
- Cloudflare 무료 플랜 보존 기간이 짧다. 11-19 하루치는 11-20에 바로 수집한다.

보조 숫자 (있으면 쓰고, 없으면 `not measured`):

| 값 | 얻는 법 | 가장 이른 날 |
| --- | --- | --- |
| WAF 규칙별 차단 수 | 토큰이 `firewallEventsAdaptiveGroups`를 못 읽는다. 오너가 Security → Events 화면을 저장 (`…/2026-11-20-after/waf-events.*`) | 11-20 |
| `error_log` 주별 | 같은 SELECT (`error-log.txt` 형식), 읽기 전용 | 11-23 (11-16 주 끝) |
| Supabase 쿼리 호출 하루 수 | 시각을 적은 스냅숏 2개, 24시간 간격. 차이가 하루 값 | 첫 스냅숏 + 1일 |
| Supabase egress GB | 오너가 Usage 화면을 저장 | 오너 저장 뒤. 없으면 `not measured` |
| GCP egress GB | `check.md` 11 (매달 초, 지난달) | 12-01 이후. 글에는 `not measured` |

발행 규칙 (결정):

- 글은 한 번 낸다. V1, V2 하루 값(11-19 UTC)을 11-20에 모은 뒤 쓴다.
- 11-20 수집이 실패하면(보존, 토큰) 15분 값만으로 쓴다. 하루 칸은 `not measured`로 둔다.
- 버린 안: 지금 바로 냄 (15분 부분 구간 하나뿐) / 한 주 기다림 (보존 기간을 넘길 위험, 얻는 것 적음) / 먼저 내고 뒤에 다시 냄 (새 id, §9.2 D).

### 9.7 단계 (pm이 행으로 바꾼다. 담당은 권고)

| # | 단계 | 담당 | 선행 | AC |
| --- | --- | --- | --- | --- |
| P8-00 | 결정 기록 | pm | 없음 | `decisions.plan.md`에 행: 자리 A, 제목 T1, 발행 규칙, V1/V2 판정선. 수집(P8-02) 전에 쓴다 |
| P8-01 | 증거 커밋 | main/오너 | 없음 | `git ls-files`에 `07-alibaba-bot.md`, `history/2026-11-18-alibaba-bot/` 9개(`cf-after-*-15min.json` 포함), `tips/bot-egress.tips.html`. 지금은 untracked다 |
| P8-02 | V1, V2 하루 수집 | main | P8-00, 11-20 | `history/2026-11-20-after/`에: `cf-24h-api.json`(11-19 00:00 ~ 24:00 UTC, host = `blog-api.prettylog.com`, 차원 path + cacheStatus, limit ≥ 100), `cf-posts-page-daily.json`(차원 date + `edgeResponseStatus`, 11-19 행 필수, 앞 날은 보존되는 만큼), `cf-zone-daily.json`(11-19 행 필수). `clientIP` 차원 없음. 쿼리 원문은 `query.txt`에 |
| P8-02b | (선택) 응답 크기 | main | 없음 | 6경로 `curl -s -o /dev/null -w '%{size_download}'` 결과를 `…/2026-11-18-alibaba-bot/api-sizes.txt`에. 있으면 M08a에 KB 라벨을 다시 단다 |
| P8-03 | WAF Events 저장 | 오너 | 11-20 | `history/2026-11-20-after/waf-events.*` (규칙별 차단, Challenge 수). 없으면 글의 그 칸은 `not measured` |
| P8-04 | CSV 5개 + 판정 | developer | P8-02, O7 | `S/data/`에 §9.5 CSV 4개 + `fig_08_verdicts.csv`. 값을 모으는 방법은 O7이 정한다 (스크립트 또는 손 + `grep` 대조). 모든 행 `source` 칸. N, V1 전후 비율, V2 값과 실패선(가장 작은 날의 50 %)을 `S/figures.md` "Checks"에 명령과 함께. 11-18과 22:30 구간은 `status` = `partial`. 고의 파손: CSV 한 행의 `source`를 비우면 `fig_08.py` exit ≠ 0, 되돌림. 실행 = 저장 파일만, `OMP_NUM_THREADS=1 timeout 300 uv run …` |
| P8-05 | `fig_08.py` + PNG 4장 | developer | P8-04 | PS-1-02 AC와 같다 (읽기 `S/data/*.csv`만, 범례 축 위, source 빈칸이면 exit ≠ 0). `not measured` 막대가 비어 있다. 기존 PNG 20장의 `shasum`이 전후로 같다 |
| P8-06 | 썸네일 08 | developer | P8-04 | `thumbs.csv`에 08 행. `08-bot-egress.png` 1200 × 630. 위 글자 "· Follow-up". 기존 썸네일 8장 `shasum` 불변 |
| P8-07 | `figures.md` 행 | developer | P8-05, P8-06 | 행 7개 추가 (PNG 4, mermaid 2, 썸네일 1). `M08a.mmd`, `M08b.mmd`가 `S/data/`에. `P` 아래 표에 없는 PNG 0개 |
| P8-08 | 글 08 작성 | sonnet-writer | P8-07 | 공통 AC C1, C2, C4–C7, C9, C12 그대로. C3 → 제목 = T1 형식, N = "Checks" 값. C8 → §6 문구 + "Supabase egress GB", "GCP egress GB"는 `not measured`. 추정 11 GB 0회. C10 → 본문 ≤ 80줄. C11 → 다른 연재 글 링크 0개. 절 순서 = §9.4. WAF 규칙 2 식 0회. 전체 IP 0회. Results 숫자 = `fig_08_verdicts.csv` |
| P8-09 | reviewer 1회 | reviewer | P8-08 | `ps.plan.md` PS-2-08과 같은 검사, 글 1개. 결과 `ps-08.review.md`. cycle 0/2 |
| P8-10 | 발행 | main | P8-09 PASS (지적 고침) | 발행 전 SELECT: 새 slug 행 0개. `publish_oneshot.py --no-llm …/08-bot-egress/08-bot-egress.md` 1회. URL `?probe=$T` 200. slug를 `deploy/projects/ps-08-publish-<date>.txt`에 |
| P8-11 | purge + 운영 확인 | main + 오너 | P8-10 | `cf-purge.sh` 1회. `/@taeklim/projects/prettylog` 200, 글 9개, 순서 00 → 08. 기존 8개 slug 200 그대로. `traffic-check.sh` FAIL 0. 새 글 둘째 GET HIT. sitemap에 새 URL 1개. 오너 시각 확인: mermaid 2개가 그림. 출력 `deploy/projects/ps-08-prod-<date>.txt` |

- MVP 사다리는 적용하지 않는다. 새 스키마, API, 파이프라인이 없다 (§7과 같다).
- 크기: P8-04 M, P8-08 M, 나머지 S.

### 9.8 오너에게 넘길 초안 줄 (결정하지 않음)

- G-PL1 measure 초안: "글 8개, 순서 00 → 07" → "글 9개, 순서 00 → 08" (P8-11 통과 기준).
- S1b 초안 → G-PL1, G-PL2: "후속 글 08을 `07-alibaba-bot.md`와 저장 JSON으로 쓴다. 자리 A (§9.2)".
- M4 초안 → S1b: exit = P8-00 … P8-11 닫힘, `ps-08-prod-<date>.txt`에 결과 줄, reviewer 1회 PASS. cycle 0/2, recovery 0/2.

### 9.9 열린 선택 (기본값으로 진행한다)

| # | 선택 | 기본값 | 누가 |
| --- | --- | --- | --- |
| O1 | (닫힘) WAF 시점. 오너가 11-18 22:30 UTC에 넣었다. V1은 비율 지표라 섞이지 않는다 (§9.6) | 없음 | 오너, 끝남 |
| O2 | Supabase Usage 화면(egress GB)을 저장하나 | 저장하면 실측으로 쓴다. 안 하면 `not measured` | 오너 |
| O3 | P8-02b 응답 크기를 재나 | 안 잰다. M08a는 바이트 라벨 없이 | main/오너 |
| O4 | WAF 규칙 2 식을 글에 싣나 | 안 싣는다. 한 줄 설명만 | pm + architect 결정. 오너가 바꿀 수 있다 |
| O5 | 00 개요 지도에 08 행 | 안 넣는다 (다시 발행 위험, §9.2 E) | pm + architect 결정 |
| O6 | G-PL1, S1b, M4 초안 승인 (§9.8) | 승인 전에도 P8-00 … P8-09는 진행한다. 발행(P8-10)만 승인 뒤 | 오너 |
| O7 | `ps.plan.md` Constraints "로컬 입력 = `S/data/*.csv`만"은 JSON 원자료를 읽는 스크립트를 막는다 | (a) 오너가 "`S/data/raw/`의 증거 사본(`cmp` 동일)"까지 넓힌다 → `extract_08.py`. (b) 답이 없으면 PS-1-01처럼 developer가 Read로 손으로 모은 CSV + 행마다 `source` + "Checks"에 `grep` 대조. 실행 없음. 기본값: (b)로 진행, (a)가 오면 스크립트로 바꾼다 | 오너 (Constraint 변경) |
| O8 | `07-alibaba-bot.md` §6.1 표의 세 칸이 JSON과 다르다 (§9.6). md를 고치나 | 고친다. 글은 어느 쪽이든 JSON을 쓴다 | main session |
