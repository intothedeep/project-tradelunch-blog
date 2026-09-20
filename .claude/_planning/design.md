# `.claude/` harness restructure — DESIGN (system-architect, 2026-09-20)

Designed against the verified facts F1–F8 in `harness-facts.md`. No files were created, moved, renamed or edited.

## 0. Design thesis

1. **F4 makes unconditional context a multiplier, not an addend.** 487 lines is paid once per session *plus once per subagent launch*. A 6-agent research wave pays it 7 times.
2. **F3's caveat makes `paths:` a poor home for prohibitions.** `paths:` fires when Claude *Reads* a matching file. Any rule meant to stop an action before the relevant file exists (don't write tests, don't train models, don't commit) cannot be `paths:`-scoped — the trigger arrives after the damage.
3. **This repo is a book + two research domains.** ~60% of always-on context describes artifacts that do not exist, while 236 lines of Korean authoring voice + 156 of XeLaTeX mechanics are explicitly excluded from loading by a comment claiming "this repo has no books and no `.tex`". That is inverted.

---

## 1. Target tree

```
.claude/
├── CLAUDE.md                                        ~45   the minimal always-on contract
├── settings.json                                    22    unchanged
├── agents/
│   ├── system-architect.md                          ~45
│   ├── product-manager.md                           ~40
│   ├── researcher.md                                ~60   NEW: sourced markdown research (book + PhD)
│   ├── sonnet-writer.md                             ~70   LaTeX implementation from approved memo
│   ├── developer.md                                 ~40
│   └── reviewer.md                                  ~50   NEW: read-only AC verification + build check
├── rules/
│   ├── core.md                                      ~25   UNCONDITIONAL: prohibitions + model allocation
│   ├── docs.md                                      238   living-doc lifecycle (paths-scoped, verbatim)
│   ├── development/
│   │   ├── code.md                                  ~40   layering, SRP, naming, config, DB
│   │   └── python.md                                 77   verbatim
│   └── writing/
│       ├── book.md                                  236   authorial voice, 한글(English) policy (verbatim)
│       └── latex.md                                 156   XeLaTeX/xeCJK mechanics (verbatim)
├── skills/
│   ├── karpathy-guidelines/                         existing, unchanged
│   ├── research-methodology/SKILL.md                ~70   NEW
│   └── source-citation/SKILL.md                     ~25   NEW
├── authoring/
│   ├── book.md                                       3    forwarding stub → rules/writing/book.md
│   └── latex.md                                      3    forwarding stub → rules/writing/latex.md
├── x_rules/                                              retired rules, OUTSIDE rules/
│   ├── nexjts.md (36), x_rust.md (2), x_typescript.md (5)
└── x_agents/                                             retired agents, OUTSIDE agents/
    ├── ml-engineer.md (126), mock-producer.md (45), test-engineer.md (64)
```

### Deviations from the owner's proposed tree

| Owner proposed | Recommended | Why |
| --- | --- | --- |
| `development/{architecture,coding,testing,git}.md` | `development/{code,python}.md` | `architecture` + `coding` would carry the *identical* `paths:` glob, so they always load together — the split buys zero context and costs a file (KISS/YAGNI). `testing` and `git` contain *prohibitions* which per F3's caveat must be unconditional; they move to `core.md`. |
| `writing/{latex,structure,notation,bibliography}.md` | `writing/{book,latex}.md` | Same glob → same argument. Splitting the owner's 236-line Korean `book.md` is the highest-risk edit in this migration (§9 risk 3) for zero budget gain. Two files = two real responsibilities: *what to say* vs *how to typeset it*. `bibliography` is citation discipline shared with research → becomes the `source-citation` skill. |
| `research/{methodology,citation}.md` | `skills/research-methodology/`, `skills/source-citation/` | Per F6 and the F3 caveat: research does not begin by Reading a repo file, so a `paths:`-scoped research rule would silently never fire. Skills preloaded via `skills:` frontmatter are mechanically guaranteed. |
| `agents/{developer,researcher,sonnet-writer,reviewer}.md` | + `system-architect`, `product-manager` | Both are mid-flight: STATUS.md step 3 is `RUNNING` and owned by pm. |

---

## 2. Loading budget

| File | Mode | `paths:` globs | Always-on lines |
| --- | --- | --- | --- |
| `CLAUDE.md` | unconditional | — | **45** |
| `rules/core.md` | unconditional | — | **25** |
| `rules/docs.md` | `paths:` | `00.plan.md`, `00.tasks.md`, `01.status.md`, `01.rules.md`, `docs/phases/**/*.md`, `_docs/archive/**/*.md` | 0 |
| `rules/development/code.md` | `paths:` | `**/*.py`, `**/*.{ts,tsx,js,jsx}`, `**/*.go`, `**/*.rs`, `**/*.sql` | 0 |
| `rules/development/python.md` | `paths:` | `**/*.py`, `pyproject.toml` | 0 |
| `rules/writing/book.md` | `paths:` | `**/*.tex`, `**/*.bib` | 0 |
| `rules/writing/latex.md` | `paths:` | `**/*.tex`, `**/*.bib`, `**/*.sty`, `**/*.cls` | 0 |
| `skills/*` | on-demand + `skills:` preload | — | 0 |
| `authoring/*` stubs, `x_rules/*`, `x_agents/*` | outside auto-discovery | — | 0 |
| `agents/*.md` | loaded only when dispatched | — | 0 |

| | always-on lines | Δ vs today |
| --- | --- | --- |
| Today (measured) | **487** | — |
| After **Phase 1** (mechanical moves only) | **~127** | **−360 (−74%)** |
| After **Phase 2** (CLAUDE.md rewrite) | **~70** | **−417 (−86%)** |

Phase 1: `docs.md` → `paths:` (−238), `nexjts.md` → `x_rules/` (−36), `x_rust`+`x_typescript` → `x_rules/` (−7), `python.md` → `paths:` (−77), `BASE.md` folded into CLAUDE.md (−2). CLAUDE.md still 124 → **127**.
Phase 2: CLAUDE.md 124 → 45 + new `core.md` 25 → **70**.

Per F4 the saving is multiplied by (1 + subagents launched). A 6-agent wave: 7 × 487 ≈ 3,400 → 7 × 70 ≈ 490.

Gained at zero always-on cost: 392 lines of book+LaTeX rules that currently never load now load exactly when a `.tex` file is opened.

---

## 3. Mechanism choice per content block

### Unconditional — `CLAUDE.md` + `rules/core.md` (too important to be `paths:`-scoped)

| Content | Why it cannot be `paths:` |
| --- | --- |
| **Never train ML locally** | The violating action is `python train.py` via Bash. F3: Bash does not reliably trigger `paths:`. There may be no file to Read at all. |
| **Subagents never `git commit`/`push`** | Bash action, no file Read. Incident-derived (§22.1). |
| **Soft-delete only, never `rm`** | The rule's point is to prevent a file ceasing to exist. Nothing to Read. |
| **Tests are suspended (§19)** | Scoping to `**/*.test.ts` fires only after the test file is created — after the violation. |
| **Model allocation (Fable = research/analysis only)** | Read at *dispatch* time, before any file is touched. Incident-derived (two rate-limit deaths). |
| **Write-file-first-then-append** | Governs an agent's first action. WS2/WS3/WS4 died before their first row; WS6 survived because it did this. |
| **Never hard-DELETE DB rows** | Bash/SQL action. Vestigial here but 2 lines and portable. |
| **Ambiguity: unclear → STOP and ask** | No file in scope. |
| **Priority order + KISS/YAGNI/SRP** | Tie-breakers consulted continuously, including in pure-prose work. |
| **Workflow cycle + the rules index** | The index must load first; it tells an agent the other rules exist. |

### `paths:`-scoped rules

| Content | Trigger is reliable because… |
| --- | --- |
| `writing/book.md`, `writing/latex.md` | Pipeline step 5 fills `\todo{}` slots in *existing* chapters (AC-W12 "diff shows only additions"). The writer must Read the chapter before editing it. |
| `rules/docs.md` | Every operation it governs is a surgical edit to a named existing doc; §22.2 mandates reading it first. |
| `development/{code,python}.md` | Conventions bind when touching a source file, which requires Reading it. Lower stakes: a missed naming convention is a review comment, not an incident. |

Globs use `**/*.tex`, not `book/**` — a rule scoped to this repo's directory names would not survive being copied elsewhere (§8).

### Skills

| Content | Why a skill, not a rule |
| --- | --- |
| `research-methodology` | F6's exact case: a task-shaped procedure (candidate profile, recency tags, compensation hierarchy, dedup by `company_slug`, verification enum, selection log, write-first-append-per-row, never read `dossier/`). A research run may produce its entire output without Reading a repo file, so a `paths:` rule would **silently never fire**. |
| `source-citation` | Shared by three consumers (`researcher` emits `[S-WS3-12]`, `sonnet-writer` emits `% src: S-WS3-12`, `reviewer` checks AC-W6). A skill serves all three without duplicating text. |
| `karpathy-guidelines` (existing) | Promote from "available" to `skills: [karpathy-guidelines]` on `developer`, replacing the 4-line inline block. |

---

## 4. Content migration map

### `.claude/CLAUDE.md` (124 lines)

| Source section | Destination | Note |
| --- | --- | --- |
| Title + intent | `CLAUDE.md` | reworded: engineering **and authoring** workflow |
| Priority Order | `CLAUDE.md` | verbatim, 2 lines |
| Core Principles | `CLAUDE.md` (6→4 bullets) | DI/inheritance bullet → `development/code.md` |
| Structure & Layering | `development/code.md` | incl. module-size 300/400 rule; monorepo-DAG line kept (portable) |
| Database §7 | `development/code.md` | no DB here; kept for portability, 0 always-on cost |
| Configuration §8 | `development/code.md` | same |
| Naming §10/§17 | `development/code.md`; Next-specific line → `x_rules/nexjts.md` | |
| Workflow Docs | `CLAUDE.md` → 1-line pointer to `rules/docs.md` | −9 lines |
| Execution Discipline | "atomic commits / minimal diffs / comments explain WHY" → `CLAUDE.md`; "lint+typecheck+tests gate" → `development/code.md` | |
| Agent Discipline §18 | `rules/core.md`, condensed to 3 lines | items 1/3/5 collapse; item 2 merges with ambiguity policy |
| rm -rf (soft-delete) | `rules/core.md` | verbatim, unconditional |
| Jest & Docs §19 | `rules/core.md`, 3 lines | suspension + "Jest config is NOT dead code" + "verify by deliberate breakage". ts-jest specifics → `x_rules/nexjts.md` |
| End-of-task §21 | `CLAUDE.md`, 2 lines | "run the project once" → "run the build once (for `book/`: `latexmk -xelatex main.tex`)" |
| §22.1 (no commit) | `rules/core.md` | unconditional, incident-derived |
| §22.2 (surgical doc edits) | `rules/core.md` (1 line) + full text in `rules/docs.md` | the 1-line version applies to *any* doc |
| §22.3 (worktree reset) | `rules/core.md` | 1 line |
| §22.4 (no hard DELETE) | `rules/core.md` | 1 line |
| "Language-specific rules" index | `CLAUDE.md`, rewritten as the rules index incl. `rules/writing/` | |
| "Authoring rules (NOT auto-loaded)" | **deleted and inverted** | Premise ("this repo has no books and no `.tex`") is factually wrong. Replaced by: "Book/LaTeX conventions live in `rules/writing/` and load automatically when you open a `.tex` file." |

### `rules/*.md`

| Source | Destination | Treatment |
| --- | --- | --- |
| `BASE.md` (5) | `CLAUDE.md` "Workflow cycle" | fold in, 3 lines; agent names updated |
| `docs.md` (238) | `rules/docs.md` | **verbatim** + `paths:` frontmatter only. See §7. |
| `python.md` (77) | `rules/development/python.md` | **verbatim** + `paths:` |
| `nexjts.md` (36) | `.claude/x_rules/nexjts.md` | soft-delete by move |
| `x_rust.md` (2), `x_typescript.md` (5) | `.claude/x_rules/` | keep `x_` filenames, move out of `rules/` |

**The F2 collision, resolved.** F2 is empirically confirmed: `rules/x_rust.md` and `rules/x_typescript.md` are in this session's context right now. The `x_` prefix is a *human* marker; the loader ignores it. The repo's soft-delete rule forbids actual deletion. Resolution: **retirement = a move out of the auto-discovered directory, keeping the filename**. The `x_` lives on the *directory*, satisfying soft-delete (nothing destroyed) while actually removing the file from `rules/` recursion.

Same caution for agents: it is unverified whether `agents/x_foo.md` still registers as dispatchable. Do not gamble; use `x_agents/`.

### `.claude/authoring/*.md`

| Source | Destination | Treatment |
| --- | --- | --- |
| `authoring/book.md` (236) | `rules/writing/book.md` | **verbatim relocation.** Only sanctioned edits: add `paths:`; rewrite two internal path references. Mirrors `rules/docs.md` §2's promote rule where link rewriting is the only sanctioned content change during a move. Not one Korean sentence changes. |
| `authoring/latex.md` (156) | `rules/writing/latex.md` | **verbatim**, same treatment |
| — | `authoring/{book,latex}.md` | **new 3-line forwarding stubs**: "Moved to `.claude/rules/writing/<name>.md` (2026-09-20). It now loads automatically when a `.tex` file is opened." `research-plan.md` §3.5 and AC-W1 reference these literal paths and the pipeline is mid-flight. `authoring/` is not under `rules/`, so stubs cost 0. |

### Agent bodies

| Agent | Content | Destination |
| --- | --- | --- |
| `developer` (75) | responsibilities / inputs / outputs / MUST NOT / ambiguity | **keep** (~40) |
| | "Pure functions, SRP, least privilege, no duplicated logic, structure feature/util/" | → `development/code.md` (dedupe; CLAUDE.md already said all of it) |
| | "Karpathy Enhancement (v2)" block | → `skills: [karpathy-guidelines]` frontmatter |
| | Guardrails (no commit / soft-delete) | → `rules/core.md` (inherited, delete from body) |
| | "Notify system-architect to update STATUS" | → "report to the dispatching session; never write status docs yourself" |
| `product-manager` (63) | responsibilities, task/AC format, strict separation | **keep** (~40) |
| | restatements of `docs/phases/` mechanics | → pointer to `rules/docs.md` |
| | Guardrails block | → `rules/core.md` |
| `system-architect` (~50) | responsibilities, 3-option mandate, API/schema-before-mock, must-not | **keep** (~45) |
| | `packages/types` / `tradelunch.schema.sql` SSOT input | → replace with "the repo's actual SSOT, named in the task" (another project's SSOT leaked in) |
| `sonnet-writer` (524) | Responsibilities, Agent Boundaries, Ambiguity Policy, Research Memo Protocol, Completion | **keep** (~70) |
| | §1 Preserve reasoning, §2 Mathematical verification, §5 LaTeX quality, §6 Document structure | → `rules/writing/latex.md` (append as §13 "reasoning preservation") |
| | §Developer-Agent Style Constraints | delete — 11 bullets already in CLAUDE.md/code.md, irrelevant to prose |
| | §MUST NOT + §File Guardrails | → `rules/core.md` (inherited) |
| | §Example: GDA, §Example: Mathematical Issue, §Example: LaTeX Implementation (~120 lines) | → `x_agents/x_sonnet-writer-examples.md`. A Gaussian-discriminant-analysis walkthrough with no relation to a Korean careers book — direct evidence the agent was copied wholesale from another project. |
| `ml-engineer` (126), `mock-producer` (45), `test-engineer` (64) | whole body | → `x_agents/` (retire, §5) |
| — | new | `agents/researcher.md`, `agents/reviewer.md`, `skills/research-methodology/SKILL.md`, `skills/source-citation/SKILL.md` |

---

## 5. Agent roster

**Keep (4):**

- **`sonnet-writer`** — keep, and **keep the name exactly**. `STATUS.md` step 5 and `research-plan.md` §3.5 name it literally; renaming breaks a running pipeline. 524 → ~70.
- **`product-manager`** — keep, slim to ~40. STATUS.md step 3 is `RUNNING` and owned by pm.
- **`developer`** — keep, slim to ~40. No code yet (`src/` empty) but the owner runs `_scripts/` and will have Python; retiring and re-creating is churn. Upgrade: `skills: [karpathy-guidelines]`.
- **`system-architect`** — keep, slim to ~45. Fix the leaked SSOT reference.

**New (2):**

- **`researcher`** — the dominant live workstream has no agent. Serves **both** domains: `book/research/WS*` and `x_research.md` (PhD programs, labs, papers, venues) — shared methodology, differing schema supplied by the dispatching prompt. Encodes both incident-derived constraints: `model: fable` and **write the output file first, append one verified row at a time**.
- **`reviewer`** — has real subject matter today: STATUS.md step 6 ("Build + rule check") and 22 acceptance criteria (AC-R1..R10, AC-W1..W12) with no owner but the main session. Read-only; reports, never fixes.

**Retire (3) → `.claude/x_agents/`:**

- **`ml-engineer`** — its Core Workflow step 2 is literally **"Train model"**, and its rules mandate running controlled experiments to produce versioned artifacts. That is a standing instruction to do the one thing the user-level rule prohibits absolutely — and that rule file records that an agent "told only to design or validate" has already started training on its own initiative. No ML code in this repo. Retiring removes a live hazard.
- **`mock-producer`** — captures API/WS traffic into mocks for a Next.js dashboard that does not exist here.
- **`test-engineer`** — its entire output is forbidden by §19's suspension. A dispatchable agent whose job is prohibited is a trap.

Nothing is deleted; any of the three is restorable with a one-line move.

---

## 6. Agent↔rules contract

```markdown
---
name: <slug>
description: MUST BE USED for <trigger>. <one-line exclusion>.
tools: <minimal set>
model: <sonnet|opus|fable>
skills: [<preloaded skill>]        # only where the procedure is mandatory
effort: <medium|high>
---

You are a <role>.

## Responsibilities
- 3-6 bullets. What this agent produces.

## Inputs
- named artifacts only.

## Outputs
- named artifacts only. What it must NOT produce.

## Rules it operates under
- <rules file> — loads automatically when you open <file type>.
- (only pointers; never restate rule text)

## Boundaries (MUST NOT)
- 3-5 bullets, agent-specific only.
  Repo-wide prohibitions are inherited from CLAUDE.md + rules/core.md — not repeated here.

## Ambiguity
Unclear → STOP, emit [CLARIFICATION REQUIRED] <ambiguity> <information needed>, wait.
```

| Agent | tools | model | skills | effort |
| --- | --- | --- | --- | --- |
| `researcher` | `Read, Write, Grep, WebSearch, WebFetch` | `fable` | `[research-methodology, source-citation]` | `medium` |
| `sonnet-writer` | `Read, Write, Bash` | `sonnet` | `[source-citation]` | `medium` |
| `reviewer` | `Read, Grep, Bash` | `opus` | `[source-citation]` | `high` |
| `developer` | `Read, Write, Bash` | `sonnet` | `[karpathy-guidelines]` | `medium` |
| `product-manager` | `Read, Write` | `opus` | — | `high` |
| `system-architect` | `Read, Grep` | `opus` | — | `high` |

### Mechanical vs advisory — what is relied on for what

| Enforcement | Mechanism | Relied on for |
| --- | --- | --- |
| **Mechanical, hard** | `tools:` omission | `system-architect` and `reviewer` cannot Write/Edit because those tools are absent — the only *guaranteed* read-only. Honest caveat: `reviewer` has `Bash` for `latexmk` (AC-W1) and grep checks, and Bash can write files. Its body forbids edits, but that part is advisory. Accept it; the alternative is a reviewer that cannot run the build it must verify. |
| **Mechanical, hard** | `model:` | Fable-for-research-only enforced by `researcher: model: fable` + `sonnet-writer: model: sonnet`. A body sentence would be unenforceable at dispatch. |
| **Mechanical, hard** | `skills:` (F5) | Research methodology + citation schema. The deliberate upgrade over today's "read `.claude/authoring/book.md` before editing any `.tex`" — a body instruction the model may skip. Anything whose omission silently corrupts output goes here. |
| **Semi-mechanical** | `paths:` rules | Book voice and LaTeX mechanics. Strong but not absolute: fires on Read. Acceptable because step 5 structurally requires reading the chapter first. Not acceptable for prohibitions. |
| **Advisory only** | body sentences | Workflow ordering, boundaries, reporting format, ambiguity protocol. Nothing irreversible rests here. |

### `omitClaudeMd: true` — **use it nowhere.**

The point of cutting to ~70 lines is that inheriting 70 lines is cheap. Setting it on e.g. `sonnet-writer` would drop the never-train, no-commit and soft-delete rules — all incident-derived — unless each agent body restates them, reintroducing exactly the duplication being removed. Also, F5 describes it as skipping user/project/local **CLAUDE.md**; it does not establish whether `rules/` is suppressed too. Do not build on an unverified side effect.

---

## 7. The `rules/docs.md` problem

**Recommendation: `paths:`-scope it. Keep all 238 lines verbatim. Do not shrink, do not convert to a skill, do not retire.**

```markdown
---
paths:
  - "00.plan.md"
  - "00.tasks.md"
  - "01.status.md"
  - "01.rules.md"
  - "docs/phases/**/*.md"
  - "_docs/archive/**/*.md"
---
```

**Delta: −238 always-on lines — 49% of the entire 487-line budget, from a one-line frontmatter addition.** Enforcement power is *unchanged* for any repo that has those files, because every operation it governs begins with Reading the doc (§22.2 mandates exactly that).

Why not the alternatives:
- **Keep as-is** — 238 unconditional lines governing four files that do not exist, multiplied across every subagent (F4). Indefensible.
- **Shrink** — it is the owner's reasoned lifecycle spec with incident annotations ("learned the hard way 2026-09-05"). High-risk rewrite for a saving `paths:` gets free.
- **Convert to a skill** — a skill loads when invoked or judged relevant; *weaker* than `paths:` for something whose trigger is precisely "you opened a living doc". Also `pm` is running now and depends on it.
- **Retire** — breaks `product-manager` mid-flight and destroys portability; `docs.md` is the most reusable file in the harness.

**Caveat recorded.** §4's READ GUARD ("do not read `_docs/archive/` by default") ideally binds *before* the archive file is opened. Acceptable because §4 specifies three enforcement layers, and layer 2 is a banner *inside* each living doc — read when the agent opens `00.plan.md`, i.e. before it would follow an archive link. Including `_docs/archive/**/*.md` in the glob means that if an agent does open one, the guard loads and tells it to stop.

---

## 8. Portability

1. **Domain folders are self-contained drop-ins.** `rules/writing/` copies into a book repo, `rules/development/` into a code repo, the two research skills into a research repo. Each carries its own `paths:`, so it works on arrival with no wiring.
2. **No glob names this repo.** `**/*.tex`, `**/*.py`, `00.plan.md` — never `book/**`. A rule copied elsewhere fires on the same file types.
3. **Rules do not cross-reference agents.** Rule files reference other rule files and file types only. (The one exception — the model-allocation line in `core.md`, which names `sonnet-writer` — is marked in-file as repo-specific.)
4. **The unconditional core stays small and universal.** At ~70 lines it contains only things true in every repo the owner works in. A new repo can adopt it wholesale without inheriting a Next.js monorepo contract — which is precisely the failure mode this repo is in today.

`authoring/book.md` says "copy them into another repo's `.claude/`, and move them to `rules/` there if that repo's work is mostly authoring." This design performs exactly that prescribed move.

---

## 9. Risks, ordered by severity

**1. (High) Disrupting the live research pipeline mid-flight.** STATUS.md: step 3 `RUNNING`, steps 4/5/6 not started. `research-plan.md` §3.5 and AC-W1 reference `.claude/authoring/book.md` and `.claude/authoring/latex.md` by literal path; §3.5 instructs the writer to "Read `.claude/authoring/latex.md` before editing any `.tex`". Moving those breaks a written instruction to an agent that has not run yet.
*Mitigations, all three:* (a) leave 3-line forwarding stubs at the old paths; (b) execute **Phase 1 only** (which touches neither `authoring/` nor any agent) before the pipeline resumes, deferring Phase 2 until after step 6; (c) do not rename `sonnet-writer` or retire `product-manager`.

**2. (High) A `paths:`-scoped rule silently not firing.** The failure is invisible: confidently wrong output, nothing reports a missing rule. Two exposures. *(a)* A research run that never Reads a matching repo file — why research methodology is a **preloaded skill**, not a `paths:` rule; do not "simplify" it back into `rules/research/*.md`. *(b)* An agent reaching a `.tex` file via `cat`/`sed` in Bash rather than Read (F3) — mitigate with an explicit line in `sonnet-writer`'s body ("always open `.tex` with Read, never `cat`") and a `reviewer` check for `---`/`—` (AC-W3) and In-brief structure (AC-W8), which catches a non-firing voice rule after the fact.
*Verification before trusting the migration (per §19's "deliberate breakage" standard):* in a scratch session, Read a `.tex` and confirm `rules/writing/book.md` appears in context; Read `00.tasks.md` and confirm `rules/docs.md` appears; confirm neither appears in a session that opens only `book/research/*.md`. If any check fails, that file reverts to unconditional and the budget claim is revised.

**3. (High) Losing the Korean-voice / bilingual conventions in the move.** `authoring/book.md` is 236 lines of the owner's own writing, in Korean, eleven numbered principles each with a dated author directive. A "tidy-up" during the move — splitting into `structure.md` + `notation.md`, translating headings, condensing principle 9 — would silently degrade the book's voice, surfacing only chapters later.
*Mitigations:* (a) **the split is not performed** — one file, moved whole; (b) verbatim move, frontmatter + internal path rewrites the *only* sanctioned change; (c) verify with a diff showing only the frontmatter block and two changed link lines; (d) nothing deleted, recoverable from git.

**4. (Medium) Retiring an agent the owner still wants.** `ml-engineer` is the judgement call: the owner's user-level rule implies ML work happens, just on Colab. Retiring is still right (its workflow mandates local training; no ML code here), but it must be a **move to `x_agents/`**, never a delete, and reported so the owner can object.

**5. (Medium) `x_` soft-delete not actually removing a file from context.** F2 confirmed. If the migration `x_`-renames `rules/nexjts.md` in place, it costs 36 lines forever and the budget claim is false. Resolved by §4: retirement is a move **out of** `rules/`/`agents/`.

**6. (Low) Over-scoping the always-on core again.** The failure mode that produced today's 487 lines is "this might be useful someday". Countermeasure: a written admission test in `CLAUDE.md` — *a line is unconditional only if violating it is irreversible or incident-derived; everything else is `paths:` or a skill.* Re-measure after any future addition.

**7. (Low) `settings.local.json` drift.** Its allowlist still names `pnpm install`/`pnpm build`. Machine-local, not part of the committed harness, but worth one cleanup pass; `latexmk` belongs in it instead.

---

## Execution sequencing (derived — not execution tracking)

**Phase 1 — mechanical, zero pipeline risk, do now.** No file content rewritten; no agent touched.
1. Add `paths:` frontmatter to `rules/docs.md` (6 globs). No other edit.
2. Add `paths:` to `rules/python.md`, move → `rules/development/python.md`.
3. Create `.claude/x_rules/`; move `rules/nexjts.md`, `rules/x_rust.md`, `rules/x_typescript.md` into it.
4. Fold `rules/BASE.md` (3 lines) into `CLAUDE.md`; move `rules/BASE.md` → `x_rules/BASE.md`.
5. **Verify by deliberate breakage:** new session; confirm `docs.md`/`python.md`/`nexjts.md` absent from context; Read `00.tasks.md`, confirm `docs.md` appears.
   *Result: 487 → ~127.*

**Phase 2 — content restructure. Gate: after STATUS.md step 6, or immediately if the stubs in 2.2 are created first.**
1. Rewrite `CLAUDE.md` → ~45 lines per §4; create `rules/core.md` (~25) and `rules/development/code.md` (~40).
2. Move `authoring/book.md` → `rules/writing/book.md`, `authoring/latex.md` → `rules/writing/latex.md`, verbatim + `paths:` + link rewrites; leave 3-line forwarding stubs.
3. Write `skills/research-methodology/SKILL.md` and `skills/source-citation/SKILL.md`, extracting `research-plan.md` §0 + §2.7 as the portable core.
4. Create `agents/researcher.md` and `agents/reviewer.md` from the §6 template.
5. Slim `sonnet-writer` 524 → ~70; `developer`, `product-manager`, `system-architect` per §4. Move the three retired agents to `x_agents/`.
6. Verify: Read a `.tex` → `writing/book.md` + `writing/latex.md` present; dispatch `researcher` → methodology skill present in its context.
   *Result: ~127 → ~70.*

---

## OPEN QUESTIONS (owner)

1. **Does `omitClaudeMd: true` also suppress `rules/`?** F5 documents it as skipping CLAUDE.md only. The design uses it nowhere, so nothing depends on the answer — but a truly isolated writing agent later would need this measured first.
2. **Does `agents/x_foo.md` still register as dispatchable?** Unverified, so the design uses `x_agents/`. If known, `x_agents/` could collapse back to `agents/x_*.md`.
3. **Keep `rules/development/python.md` at all?** `src/` is empty and `pyproject.toml` has no code behind it. The design keeps it (`paths:`-scoped, 0 always-on cost, portable). Say the word and it moves to `x_rules/`.
4. **Should `x_research.md` (the PhD domain) get its own output schema** the way `book/research/` has `research-plan.md` §2? The `researcher` agent can serve both today via the dispatching prompt, but the PhD domain currently has a wish-list (7 items) rather than a schema. That is a pm/architect task, not part of this harness design.
