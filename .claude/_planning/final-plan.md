# `.claude` 하네스 재구성 — 최종 계획 (v2 빌드-후-교체 방식)

확정: 2026-09-20. 소유자 결정 D1–D6 반영 완료.
입력 문서: `harness-facts.md` (검증된 로더 사실 F1–F8), `harness-design.md` (아키텍트 설계),
`harness-tasks.md` (pm 작업 분해 H1/H2 — **이 문서가 그 2단계 구조를 대체함**, 아래 §0 참조).

---

## 0. 전략 변경 — 왜 Phase 1/2a/2b가 사라졌나

소유자 결정: **`.claude`를 제자리에서 수정하지 않는다. `.claude.v2/`를 새로 빌드하고 통째로 교체한다.**

`harness-tasks.md`의 2단계 게이트(2a 지금 / 2b는 STATUS 6단계 후)는 **오직 실행 중인
리서치 파이프라인을 깨지 않으려고** 존재했다. v2 방식에서는 교체 순간까지 `.claude`가
그대로이므로 그 이유가 소멸한다. 따라서:

- H1/H2 단계 분리 → **단일 빌드 + 단일 교체**로 통합
- `x_rules/` · `x_agents/` → **불필요.** 은퇴 = "v2로 복사하지 않음"이고,
  교체 시 `.claude` → `x_claude.v1`이 되므로 그것이 곧 soft-delete 보관소다
- 모든 `AC-` 검증 → **교체 후**로 이동 (v2는 로드되지 않으므로 사전 검증 불가)

**핵심 기술 사실:** `.claude.v2/` 안의 것은 아무것도 로드되지 않고 아무 에이전트도
등록되지 않는다. Claude Code는 `./CLAUDE.md`와 `./.claude/`만 본다. 빌드 중 간섭이
없다는 뜻이자, 교체 전에는 동작 확인이 불가능하다는 뜻이다.

**롤백:** `mv .claude x_claude.v2 && mv x_claude.v1 .claude` — 한 줄.

---

## 1. 소유자 결정 반영 결과

| # | 결정 | 확정 |
| --- | --- | --- |
| D1 | `omitClaudeMd`가 `rules/`도 막는가 측정? | **보류.** 설계가 이 기능을 아예 안 씀 |
| D2 | `agents/x_foo.md` vs 별도 디렉터리 | **무효화됨.** v2 방식에서 은퇴는 "복사 안 함" |
| D3 | `rules/development/python.md` 유지? | **유지.** `paths: ["**/*.py", "pyproject.toml"]` |
| D4 | `ml-engineer` 은퇴? | **은퇴 취소 → `data-analyst`로 용도 변경.** §4 참조 |
| D5 | Phase 2 게이트 | **무효화됨** (§0). 남은 질문은 "교체 시점"뿐 → 권장: 즉시 |
| D6 | `x_research.md` 출력 스키마 정의 | **나중.** 별도 pm/architect 과제 |
| **B1** | ML 경계선이 `~/.claude/CLAUDE.md`와 충돌 | **해소 (2026-09-20).** 소유자가 (A) 선택 → `~/.claude/CLAUDE.md` 직접 수정. `core.md`는 인용만 |

---

## 2. 최종 트리

```
.claude.v2/
├── CLAUDE.md                           ~45   상시 로드. 최소 공통 계약
├── settings.json                        22   그대로 복사
├── settings.local.json                  21   그대로 복사 (머신 로컬, 손대지 않음)
│
├── agents/                                    7개 (기존 7 − 은퇴 2 + 신규 2)
│   ├── system-architect.md             ~45   유지·슬림. SSOT 참조 오류 수정
│   ├── product-manager.md              ~40   유지·슬림. STATUS 3단계 소유 (진행 중)
│   ├── researcher.md                   ~60   신규. model: opus
│   ├── data-analyst.md                 ~55   ml-engineer 용도 변경. model: opus
│   ├── sonnet-writer.md                ~70   524줄에서 슬림. 이름 변경 금지
│   ├── developer.md                    ~40   유지·슬림. skills: [karpathy-guidelines]
│   └── reviewer.md                     ~50   신규. STATUS 6단계 + AC 검증 담당
│
├── rules/
│   ├── core.md                         ~35   무조건 로드. authority order + 금지사항
│   ├── docs.md                         247   원문 + paths: 9줄
│   ├── development/
│   │   ├── code.md                     ~40   paths: 소스 확장자
│   │   └── python.md                    82   원문 + paths:
│   └── writing/
│       ├── book.md                     241   원문 + paths: (한국어 한 문장도 안 바꿈)
│       └── latex.md                    161   원문 + paths: + sonnet-writer에서 온 §13
│
├── skills/
│   ├── karpathy-guidelines/                  그대로 복사
│   ├── research-methodology/SKILL.md   ~70   신규
│   └── source-citation/SKILL.md        ~25   신규
│
├── authoring/
│   ├── book.md                           3   전달 스텁 → rules/writing/book.md
│   └── latex.md                          3   전달 스텁 → rules/writing/latex.md
│
└── _planning/
    ├── facts.md · design.md · tasks.md · final-plan.md   (이 4개 문서)
```

**v2로 복사되지 않는 것** (= 은퇴. `x_claude.v1`에 보존됨):
`rules/nexjts.md`, `rules/x_rust.md`, `rules/x_typescript.md`, `rules/BASE.md`(CLAUDE.md로 흡수),
`agents/mock-producer.md`, `agents/test-engineer.md`,
`agents/sonnet-writer.md`의 GDA 예시 ~120줄.

---

## 3. 상시 로드 예산

| | 상시 줄 수 |
| --- | --- |
| 현재 `.claude/` | **487** |
| `.claude.v2/` (CLAUDE.md 45 + core.md 35) | **~80** |
| 절감 | **−407 (−84%)** |

서브에이전트가 전체 계층을 상속하므로(F4), 6개 병렬 리서치 기준
7 × 487 ≈ 3,400줄 → 7 × 80 ≈ 560줄.

**이 숫자는 목표치다.** 교체 후 §7의 M1에서 실측하며, 목표를 맞추려고 파일을 손대지 않는다.

---

## 4. `data-analyst` — ml-engineer 용도 변경 (D4)

**은퇴가 아니라 용도 변경인 이유:** `rules/BASE.md` 3번째 줄이 워크플로를
`architect + ml-engineer (더 나은 안을 고른다)`로 끝낸다. 은퇴시키면 이 참조가 끊긴다.
그리고 **주인 없는 실제 업무가 있다** — STATUS 4단계 "Analysis memo (표 확정, 출처 정리)".

| 항목 | 변경 |
| --- | --- |
| 이름 | `ml-engineer` → `data-analyst` (BASE.md 참조도 함께 갱신) |
| 모델 | `opus` 유지 (소유자 확정 2026-09-20: 추론 역할 = Opus. 초안의 `fable` 전환은 철회) |
| 담당 | STATUS 4단계 분석 메모 · 리서치 데이터 정합성/중복 제거/표 설계 · 온체인·물류 데이터 탐색 분석 · 방법론 선택 판단 |
| 삭제되는 책임 | "Train model", "Run controlled experiments", "Version models", 모델 아티팩트 산출 |

### ⚠️ B1 — 차단 중: ML 경계선이 상위 규칙과 충돌

소유자 발언(2026-09-20): *"딥러닝 학습은 원치 않지만 다른 머신러닝은 빠르니 괜찮다."*

그러나 `~/.claude/CLAUDE.md`(authority order **최상위**)는 현재:
- `fine-tuning, hyperparameter sweeps, cross-validation, grid search` 를 **명시적으로 금지**
- "허용" 목록에 `fit()`이 **없음** (`constructing a model on random init (no optimizer steps)`까지만)

합의된 규칙 — *"자식은 부모를 절대 덮어쓰지 않는다. 충돌하면 STOP하고 소유자에게 묻는다"* —
에 따라 `core.md`에 더 느슨한 규칙을 쓰지 않는다. **소유자 선택 필요:**

- **(A) 권장** — `~/.claude/CLAUDE.md`를 직접 수정. 규칙이 한 곳에만 존재
- **(B)** — 상위 유지 + `core.md`에 날짜·근거 붙은 승인 예외로 기록. 규칙이 두 곳에 생김

**(A) 제안 문구:**
```
- deep-learning training of any kind: gradient-based loops, `.backward()`,
  `opt.step()`, fine-tuning, and any sweep/grid search over them

Classical ML is allowed when it finishes in seconds and persists no weights
(owner, 2026-09-20): sklearn-scale `fit()` for clustering, trees, regression —
run for INSIGHT, not to produce a model artifact. The test is runtime and
output, not the algorithm's name. Anything over ~60s or writing a model file
goes to Colab.
```

**해소됨 (2026-09-20):** 소유자가 (A)를 선택, `~/.claude/CLAUDE.md`를 직접 수정했다. 제목과 첫
문장도 `deep-learning`으로 좁혀 파일 내부 모순을 없앴고, 허용 목록에 classical-ML `fit()` 한 줄을
추가했다. `core.md`와 `data-analyst.md`는 그 파일을 **인용만** 한다 — 규칙 문장은 한 곳에만 존재.

---

## 5. `rules/core.md` — authority order (소유자 승인 완료)

```markdown
## Authority order (권한 순서 — 트리의 뿌리)
~/.claude/CLAUDE.md > 01.rules.md > .claude/CLAUDE.md > rules/core.md
  > rules/<domain>/* > agents/* > skills/*

- 자식은 부모를 절대 덮어쓰지 않는다.
- 충돌하면 로컬에서 해결하지 말고 STOP하고 소유자에게 묻는다.
- 규칙 문장은 정확히 한 곳에만 존재한다. 다른 곳은 인용만 한다.
- 서브에이전트는 서브에이전트를 디스패치하지 않는다 (`tools:`에 `Agent` 금지).
```

`01.rules.md`는 이 저장소에 아직 없다 — 트리의 빈 자리이며, 소유자가 만들면 채워진다.

### 워크플로 루프 종료 조건 (BASE.md → CLAUDE.md 흡수 시 필수)

기존 `BASE.md`: `architect → pm → developer → architect ... Repeat until done.`
→ **`until done`에 경계가 없다.** 이것이 아키텍처의 유일한 진짜 무한 루프다
(에이전트 그래프가 아니라 메인 세션이 도는 루프이므로 도구 권한으로 막을 수 없다).

흡수 시 추가할 종료 조건 **두 개 모두**:
1. 반복 상한 — 최대 2회
2. 상태 조건 — 한 사이클이 최소 하나의 `[ ]`를 닫지 못하면 STOP하고 보고

---

## 6. 빌드 작업 (V-계열) — `.claude/`는 전혀 건드리지 않음

모든 작업의 출력은 `.claude.v2/` 안에만 생성된다. 담당은 별도 표기 없으면 메인 세션.

| ID | 작업 | 의존 |
| --- | --- | --- |
| **V0** | `.claude.v2/` 생성. `settings.json`·`settings.local.json`·`skills/karpathy-guidelines/` 그대로 복사 | — |
| **V1** | `rules/docs.md` — 원문 복사 + `paths:` 9줄 블록. **다른 바이트 변경 0** | V0 |
| **V2** | `rules/development/python.md` — 원문 복사 + `paths:`. 제목 번호·문구 변경 금지 | V0 |
| **V3** | `rules/writing/book.md` ← `authoring/book.md` **원문 복사** + `paths:` + 내부 링크 2줄만 수정. 한국어 문장 변경 절대 금지 | V0 |
| **V4** | `rules/writing/latex.md` ← `authoring/latex.md` 원문 복사 + `paths:` + 링크 수정 + sonnet-writer의 §1/§2/§5/§6를 §13으로 병합 | V0 |
| **V5** | `rules/core.md` 신규 작성 — authority order(§5) + 무조건 금지사항(로컬 딥러닝 학습·soft-delete·서브에이전트 커밋 금지·테스트 중단·모델 배분·write-first-append·모호하면 STOP) | V0 |
| **V6** | `rules/development/code.md` 신규 — CLAUDE.md의 Structure/DB/Config/Naming + 각 에이전트에서 중복 제거한 코딩 규칙 | V0 |
| **V7** | `CLAUDE.md` 신규 작성 ~45줄 — 우선순위·핵심원칙·규칙 색인·워크플로(종료조건 포함)·end-of-task. "이 저장소엔 책이 없다" 문구 **삭제 및 반전** | V5, V6 |
| **V8** | `skills/research-methodology/SKILL.md` — `research-plan.md` §0+§2.7에서 이식 가능한 핵심 추출 | V0 |
| **V9** | `skills/source-citation/SKILL.md` — 출처 ID 스키마 + `% src:` 규약 | V0 |
| **V10** | `agents/researcher.md` 신규 — `model: opus`, `skills: [research-methodology, source-citation]`, write-first-append 명시 | V8, V9 |
| **V11** | `agents/reviewer.md` 신규 — `tools: Read, Grep, Bash`, AC-R/AC-W 검증 + 빌드 | V9 |
| **V12** | `agents/data-analyst.md` — ml-engineer 용도 변경 (§4). **B1 답변 대기** | V5, **B1** |
| **V13** | `agents/sonnet-writer.md` — 524 → ~70. 이름 변경 금지. GDA 예시 복사 안 함 | V4, V5 |
| **V14** | `agents/{developer,product-manager,system-architect}.md` 슬림화. developer에 `skills: [karpathy-guidelines]`, architect의 SSOT 참조 수정 | V5, V6 |
| **V15** | `authoring/{book,latex}.md` 3줄 전달 스텁 (`research-plan.md` §3.5·AC-W1이 이 경로를 문자 그대로 참조하므로 필수) | V3, V4 |
| **V16** | `_planning/` 에 4개 문서 복사 | 전부 |
| **V17** | 빌드 자체 점검 — 트리 출력, 각 `paths:` 블록 문법 확인, `.claude/`와 `git status` 비교해 **미변경** 확인 | 전부 |
| **V18** | **커밋** (메인 세션. 서브에이전트 금지) — `.claude.v2/` 전체 + `.claude/` 무변경 | V17 |

**병렬 가능:** V1·V2·V3·V4·V8·V9는 서로 독립. V5→V6→V7이 직렬. V10–V14는 V5 이후.

---

## 7. 교체 + 검증 (소유자 실행)

```bash
mv .claude x_claude.v1 && mv .claude.v2 .claude     # 교체
# 롤백: mv .claude x_claude.v2 && mv x_claude.v1 .claude
```

교체 후 **새 세션**에서 확인 (소유자가 직접 수행하겠다고 확정):

| ID | 검증 | 통과 기준 |
| --- | --- | --- |
| **M1** | 상시 줄 수 실측 | 새 세션에서 아무 Read 없이, `Contents of .../project_job/.claude/...` 헤더에 뜬 파일만 합산 → ~80 (사용자 레벨 CLAUDE.md·MEMORY.md는 제외) |
| **M2** | `paths:` 발동 — 쓰기 | 새 세션에서 `book/chapters/11-*.tex`를 **Read** → `rules/writing/book.md` + `latex.md` 등장 |
| **M3** | `paths:` 미발동 | 새 세션에서 `book/research/STATUS.md`만 Read → 위 두 파일 **부재** |
| **M4** | `paths:` 발동 — docs | `docs/phases/x_probe.md` 하나 만들어 Read → `rules/docs.md` 등장. 확인 후 프로브는 이동(삭제 아님) |
| **M5** | ⚠️ **Bash 경로 확인** | `.tex`를 `cat`으로 열었을 때도 발동하는가? **발동하지 않으면**, `paths:` 규칙은 Read를 쓰는 에이전트만 보호하며 bypass 모드 메인 세션은 보호하지 않는다는 뜻 — 설계는 안 바뀌지만 **보장 범위가 좁아지므로 반드시 기록** |
| **M6** | 에이전트 등록 | `data-analyst`·`researcher`·`reviewer`가 디스패치 가능 목록에 뜨는가 |
| **M7** | 스킬 프리로드 | `researcher` 디스패치 → 그 컨텍스트에 research-methodology 내용이 있는가 |

**M4는 글롭 의미 확인도 겸한다.** flat 프로브(`docs/phases/x_probe.md`)가 발동하지 않고
nested(`docs/phases/sub/x_probe.md`)만 발동하면, `docs/phases/*.md`를 글롭에 추가해야 한다
(설계의 샤드 예시가 전부 flat이므로 실사용에 영향). 공식 문서 표는 `**/*.ts` = "모든
디렉터리의 TS 파일"이라 하므로 flat도 통과할 전망.

**M2 또는 M4가 실패하면** 해당 파일은 무조건 로드로 되돌리고 §3의 예산 주장을 수정한다.

---

## 8. 손대지 않는 것

- `book/` 전체 — 챕터·parts·preamble·main.tex·research 산출물
- `.claude/` — 교체 순간까지 읽기 전용 (**빌드 중 동결**)
- `authoring/book.md`의 한국어 문장 — 단 한 줄도 바꾸지 않음. 허용 변경은 `paths:` 블록 추가와 내부 링크 2줄뿐
- `sonnet-writer` **에이전트 이름** — STATUS 5단계·research-plan.md §3.5가 문자 그대로 참조
- `product-manager` — STATUS 3단계 진행 중
- `settings.json` / `settings.local.json` — 그대로 복사
- `01.rules.md` — 소유자 소유. 어떤 에이전트도 쓰지 않음 (이 저장소엔 아직 없음)
- `x_claude.v1` — 교체 후 소유자가 직접 확인하고 수동 삭제 (soft-delete 규칙)

---

## 9. 남은 위험

| # | 위험 | 대응 |
| --- | --- | --- |
| 1 | **교체 전 동작 검증 불가** (v2는 로드 안 됨) | §7 검증을 교체 후 필수 단계로 고정. 롤백 `mv` 한 줄 |
| 2 | **빌드 중 `.claude/`가 수정되면 조용히 갈라짐** | `.claude/` 동결. V17에서 `git status`로 미변경 확인 |
| 3 | **`paths:`가 Bash 경로에서 미발동** | M5가 경계를 측정. 설계는 안 바뀌고 보장 범위만 기록됨 |
| 4 | **한국어 원고 규칙 훼손** | 원문 복사, 분할 안 함, diff가 frontmatter + 링크 2줄만 보여야 함 (V3 AC) |
| 5 | **B1 미해결 상태로 `data-analyst` 작성** | V12를 B1에 하드 의존시킴. 나머지는 진행 |
| 6 | **예산 재확대** — "언젠가 쓸지도"로 상시 규칙이 다시 불어남 | CLAUDE.md에 입장 기준 명문화: *"되돌릴 수 없거나 사고에서 배운 것만 무조건 로드. 나머지는 `paths:` 아니면 스킬."* |

---

## 10. 지금 상태

- **V0–V18 실행 대기** — 소유자 승인 시 시작
- **B1만 미결** — V12 하나를 차단. 답변 없이도 나머지 17개 작업 진행 가능
- `.claude/` 무변경, 커밋 없음

---

## 11. 소유자 하네스 리서치 반영 (2026-09-20, 추가분)

소유자가 최신 Claude Code primitive 기준으로 구조를 재검토. **v3 불필요 — 전부 v2에 추가.**
채택 3개는 기존 빌드를 되돌리지 않고 덧붙는다.

### 채택

**V19–V21 — 워크플로 스킬 3개 (신규)**

| ID | 파일 | 내용 |
| --- | --- | --- |
| V19 | `skills/write-book/SKILL.md` | 챕터 파이프라인: researcher → sonnet-writer → latexmk → reviewer → PASS/ISSUE 분기. 반복 상한 명시 |
| V20 | `skills/review-book/SKILL.md` | 검증만 단독 실행. AC 확인 + `book/reviews/` 아티팩트 생성 |
| V21 | `skills/research/SKILL.md` | 리서치 워크스트림 오케스트레이션 (스코프 → 디스패치 → 병합 → 검증) |

**근거 (기술적):** v2 로스터의 서브에이전트는 `tools:`에 `Agent`가 없어 다른 에이전트를
디스패치할 수 없다. 따라서 오케스트레이션은 구조적으로 메인 세션에서만 가능하며,
**Skill이 이를 담을 수 있는 유일한 호출 가능·재현 가능한 그릇이다.**
부수 효과: §5의 루프 종료 조건을 산문 패치가 아니라 절차로 인코딩하게 된다.

**`book/reviews/` — 검증 아티팩트 (V11에 패치 전달 완료)**
```
추론  book/research/*.md   → researcher / data-analyst
구현  book/chapters/*.tex  → sonnet-writer
검증  book/reviews/*.md    → reviewer      ← 신규
```
ISSUE를 구현 이슈(→ sonnet-writer) / 추론 이슈(→ researcher)로 분류해 라우팅.
에이전트 간 인계가 대화가 아니라 **파일**로 이루어진다.

**4-primitive 모델 — CLAUDE.md에 명문화 (V7에 패치 전달 완료)**
`CLAUDE.md`=계약 · `rules/`=제약 · `agents/`=역할 · `skills/`=워크플로.
파생 규칙: 다중 에이전트 워크플로는 에이전트 본문이 아니라 스킬에 둔다.

### 반려 (각각 검증된 사실 또는 기결정과 충돌)

| 제안 | 반려 사유 |
| --- | --- |
| `writing/{latex,notation,structure,bibliography}` 재분할 | 글롭이 동일하면 항상 같이 로드 → 절감 0, 파일만 증가. 236줄 한국어 `book.md` 분할은 위험 4 |
| `development/testing.md` | 테스트 규칙은 금지사항. F3상 `paths:`는 Read 후 발동 → 위반 후 도착. `core.md`에 무조건 로드 |
| `rules/research/{methodology,citation}` | 제안서가 `rules/`와 `skills/` 양쪽에 둠 = "규칙은 한 곳에만" 위반. 리서치는 저장소 파일을 Read하지 않고 끝날 수 있어 `paths:`가 미발동. 스킬이 맞음 (작성 완료: 75줄 + 53줄) |
| 에이전트 4개 로스터 | `product-manager`(STATUS 3단계 진행 중) · `system-architect` · `data-analyst`(D4) 누락 |
| `paths: "book/**/*.tex"` | 저장소 이름이 박힌 글롭 → 이식성 파괴 (§8 규칙 2). `**/*.tex`로 빌드 완료 |
| 루트 `CLAUDE.md` | **원자적 교체를 깨뜨린다.** 루트 파일은 `mv .claude ...`와 함께 움직이지 않으므로 교체 순간 구형 루트 + 신형 `.claude/`가 공존. `.claude/CLAUDE.md` 유지 |

### 기본값으로 진행 (답변 없어 소유자 규칙 우선 적용)

- **`researcher` 모델 = `opus` (확정, 2026-09-20).** 초안은 `fable`이었으나 소유자가 Opus로 확정했다.
  `data-analyst`도 동일 — 추론 역할(리서치·분석·기획·아키텍처·리뷰)은 전부 Opus, 작성 역할만 Sonnet.
  규칙의 정본은 `rules/core.md`의 Model allocation 줄이고, 기계적 강제는 각 에이전트의 `model:` 프런트매터다
- **`book/research/` 레이아웃 = 현행 워크스트림별(`WS*.md`) 유지.** 챕터별 전환은 WS1–6 → 챕터
  11/12/15/23이 다대다 합성이라 1:1이 안 되고, STATUS.md·research-plan.md가 현행에 의존
- **`book/{figures,bibliography}/`** 는 만들지 않음 — git은 빈 디렉터리를 추적하지 않는다. 실제로
  필요해질 때 생성
