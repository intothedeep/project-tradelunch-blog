# Claude Code Agent Rules

AI-assisted engineering workflow. Optimize for correctness, simplicity, maintainability.

## Priority Order (tiebreaker)

1. correctness → 2. simplicity → 3. maintainability → 4. explicitness → 5. performance → 6. abstraction quality

## Core Principles

- **Correctness first** — no guessing/hallucinating. If unclear → stop and ask. Explicit over implicit.
- **KISS + YAGNI** — simplest working solution first; no abstraction without proven need; no premature optimization.
- **SRP** — one responsibility per module/function; split when multiple appear.
- **Functional core** — business logic = pure functions (deterministic, no hidden state/global deps); side effects isolated at boundaries.
- **Least privilege** — DB/network/file I/O isolated in infra layer; domain logic performs no side effects.
- **Composition > inheritance**; DI required; avoid god classes / deep inheritance. OOP only for polymorphism, stateful domain models, or plugin systems.

## Structure & Layering

- Module size ≤ **300 lines** (recommended); split on multiple responsibilities.
- Dependency direction (no reverse deps): **UI/API → Service → Domain (pure) → Infrastructure**.
- Monorepo DAG: **apps → packages → libs**. No circular deps.

## Database (§7)

- Prefer **raw SQL** for clarity / performance-critical paths; ORM only for non-critical CRUD.
- Repository layer = thin abstraction. Transaction boundaries defined in **service layer only**.

## Configuration (§8)

- All config env-based (`.env`); no hardcoded secrets/env values.
- Precedence: **env vars > config files > defaults**.

## Naming (§10, §17)

- functions: verb-based (`create`, `calculate`, `fetch`); data: noun-based (`user`, `order`).
- boolean: `is`/`has`/`can` prefix. Avoid generic names (`data`, `temp`, `foo`).
- protobuf: `weatherbot[Name][Api|Ws][Hist]` / `weatherbot_[name]_[api|ws]_hist`
- folders: `use-api` / `use-ws` / `use-poll`
- files — api: `[method]-[name].api[.batch].ts`; parsing: `*.parsing.[api|ws].*`; ws: `*.ws.*`; mock: `mock.[api|ws].[source].[name].json`
- (Next.js / TS suffix rules live in `rules/nexjts.md`, `rules/typescript.md`.)

## Workflow Docs

Exactly **three** living root docs — fold work in, do not create per-feature variants:

- `00.plan.md` — product intent + roadmap + architecture decisions
- `00.tasks.md` — atomic task breakdown per phase
- `01.status.md` — progress log, one terse line per update, newest at bottom

Full lifecycle (archiving, stub format, `01.status.md` line style, **archive READ GUARD — do not read `_docs/archive/*` unless investigating history**) is defined in **`rules/docs.md`**.

## Execution Discipline

- Atomic commits; small incremental, rollback-safe diffs.
- Quality gates before completion: lint + typecheck + tests (logic layer) pass; no dead code / unused exports.
- Comments explain **WHY**, not WHAT.

## Agent Discipline (§18)

1. One small task at a time; simplest working version first.
2. No assumptions — only explicit requirements. If unclear → stop and request.
3. Every step produces working output; verify before next step.
4. Keep changes minimal and isolated; avoid redesign unless necessary.
5. Fail fast, fix immediately, continue incrementally.
6. If complexity grows or boundaries unclear → stop, reduce scope, re-apply SRP.

## rm -rf (soft-delete)

Never delete directly. Rename file/folder with `x_` prefix so the user can verify and remove manually.

## Jest & Docs (§19)

- Run tests once at the end. Update documentation surgically.

## File Read (§20)

- Inspect data structure first (`head`), then process (e.g. pandas).

## Language-specific rules

`rules/python.md`, `rules/rust.md`, `rules/nexjts.md`, `rules/typescript.md`, `rules/docs.md`, `rules/BASE.md` load automatically — consult them for stack details.
