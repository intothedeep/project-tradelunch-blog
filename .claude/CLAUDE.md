# Claude Code Agent Rules

This repo is a **Korean LaTeX book + two research domains** (book-market
research under `book/research/`, PhD-program research under `x_research.md`).
Code is a minor/future concern (`src/` is currently empty).

## Priority order (tiebreaker)
correctness → simplicity → maintainability → explicitness → performance → abstraction quality

## Core principles
- **KISS + YAGNI** — simplest working solution first; no premature abstraction.
- **SRP** — one responsibility per module/function; split when multiple appear.
- **Functional core** — pure business logic; side effects at boundaries only.

## How this harness is organized
- **`CLAUDE.md`** — the global contract: priorities, principles, indexes. Always loaded.
- **`rules/`** — constraints: WHAT MUST HOLD. Loaded by file path (`paths:` frontmatter) or unconditionally (`core.md`).
- **`agents/`** — specialized roles: WHO does it, fixed model + minimal tool set. Loaded only when dispatched.
- **`skills/`** — repeatable workflows: WHAT ORDER things happen in. Invoked by name or when relevant.
- Routing rule: multi-agent orchestration belongs in a **skill**, not an agent body — orchestration runs only in the main session (subagents cannot dispatch; see `rules/core.md` Authority order).

## Reading files: `cat` by default, `Read` where a rule must load
`cat`/`sed -n` is the cheaper default and is preferred for browsing, greps and
quick looks. But `paths:` rules load on the **Read tool only** — a `cat` opens
the file with the rules silently absent. So use **Read** (not `cat`) for the
file types indexed below: `.tex/.bib/.sty/.cls`, `.py`/`pyproject.toml`, and the
living docs. Everything else: `cat` freely.

## Rules index (when each file loads)
- `rules/core.md` — always (unconditional prohibitions + authority order).
- `rules/docs.md` — when you open a living doc (`PLAN.md`, `STATUS.md`,
  `TASKS.md`, `*.plan.md`, `*.tasks.md`, `01.rules.md`, `_archive/**`).
- `rules/development/{code,python}.md` — when you open a source file
  (`.py`, `pyproject.toml`, `.ts/.tsx/.js/.jsx`, `.go`, `.rs`, `.sql`).
- `rules/writing/{book,latex}.md` — when you open a `.tex`/`.bib` file
  (`latex.md` also on `.sty`/`.cls`); book/LaTeX conventions load automatically.

## Skills index
- Orchestration (main session only): `research`, `write-book`, `review-book`.
- Preloaded into agents via `skills:` frontmatter: `research-methodology`,
  `source-citation`, `karpathy-guidelines`.

## Workflow cycle
Non-trivial / multi-step work only. Skip for trivial/single-file edits — do them
directly (KISS).

**The MAIN SESSION dispatches every agent.** No agent dispatches another
(`rules/core.md` Authority order), so an agent hands its output back; it never
"passes it on".

**And it does not do the dispatched work itself.** Once a task is an agent's, the
main session does not run that agent's searches, write that agent's output file, or
read the reference material written for that agent — doing so burns the orchestration
context that every remaining dispatch depends on. Reading to VERIFY a returned result,
and the end-of-task build below, are not the agent's work and stay allowed. If the urge
is "잠깐 내가 직접 확인해보지", that is a re-dispatch, not an exception.

1. **system-architect** — analyze, design.
2. **product-manager** — plan: split into atomic tasks with acceptance criteria in
   `PLAN.md`.
3. **main session** — dispatch `developer` / `researcher` / `sonnet-writer`, one
   task at a time; `product-manager` bg-updates the living docs (`rules/docs.md`).
4. **reviewer** — verify (build + acceptance criteria). Verification is its job,
   not the architect's.
5. **data-analyst** — when there is a choice to make, it lays out the options
   WITHIN its remit (analysis method, table design, source quality). Architecture
   options stay with `system-architect`; the final pick is the owner's.

Bounded by BOTH: (a) max 2 iterations, and (b) a state check — a cycle that
produces no completed, verified deliverable (a closed `[ ]`, or a written and
verified artifact) STOPs and reports. The count lives in the dispatch message
(`cycle N/2`), not in session memory; a third cycle needs the owner.

## System build phasing (MVP ladder)
For any system/app work. The schema is the contract; every phase ends in something
runnable, and a phase that produced only code is NOT done.

1. **MVP1 — shape.** Data structure, business flow, the tables, and the schema.
   Front end / simulation runs entirely on a **mock API + mock data** that satisfies
   that schema. Goal: prove the flow and the shape are right. No real pipeline yet.
2. **MVP2 — one real slice.** Build the real pipeline/API for **1-2 simple tasks**
   against the SAME schema, and show it can drop in where the mock was. Mock and real
   coexist; the mock stays as the fallback and as the contract's reference.
3. **MVP3 — core migrated.** Move the core working path onto the real
   implementation. Retire only the mocks whose paths actually migrated.
4. **Repeat** per capability — one at a time, never a big-bang migration.

Invariants:
- **Schema is the single contract.** Mock and real must satisfy the same one. If an
  MVP2 API cannot be built without changing the schema, that slice goes BACK to MVP1
  — do not fork the schema to make the API fit.
- **No pipeline before the flow is demonstrated on mocks.** Building plumbing for a
  flow nobody has run is the failure this ladder exists to prevent.
- **Mock data must be unmistakable and isolated** (own directory, marked values) so
  it can never be mistaken for real output.
- A phase opens only when the previous phase's exit criteria are closed (pm owns the
  criteria).

## Execution discipline
- Atomic commits; small, incremental, rollback-safe diffs.
- Comments explain WHY, not WHAT.

## End-of-task
1. Docs update, once, surgically (see `rules/docs.md`).
2. Run the build once, in the background: for `book/`, `latexmk -xelatex
   main.tex` from `book/`; not a web app.

**Who runs the build.** `sonnet-writer` compiles only to check its own edit and
reports what it saw. The AUTHORITATIVE build-and-verify pass belongs to
**`reviewer`** — its result is the one that decides PASS/ISSUE. The main session's
end-of-task build above is the final sanity run, not a second verification.

Living-doc lifecycle (two-doc model, split rule, archiving, read guards): `rules/docs.md`.
