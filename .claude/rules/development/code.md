---
paths:
  - "**/*.py"
  - "**/*.{ts,tsx,js,jsx}"
  - "**/*.go"
  - "**/*.rs"
  - "**/*.sql"
---

# Code conventions

## Structure & layering
- Module size: **300 lines = soft default** (smell threshold, proxy for SRP —
  the real test is "one file = one responsibility"). Over 300 = split OR
  justify; a single cohesive responsibility where splitting creates artificial
  seams may run to ~400; **400 = hard review line**. Multiple responsibilities
  → split regardless of count.
- Dependency direction, no reverse deps: **UI/API → Service → Domain (pure) →
  Infrastructure**.
- Monorepo DAG: **apps → packages → libs**. No circular deps.
- Composition over inheritance; DI required; avoid god classes / deep
  inheritance. OOP only for polymorphism, stateful domain models, or plugin
  systems.
- Least privilege: DB/network/file I/O isolated in an infra layer; domain
  logic performs no side effects.
- No duplicated logic; small, composable, single-purpose functions.
- Where a `feature/` vs `util/` split applies: `feature/` = business logic,
  `util/` = reusable helpers.

## Database
- Prefer **raw SQL** for clarity / performance-critical paths; ORM only for
  non-critical CRUD.
- Repository layer = thin abstraction. Transaction boundaries defined in the
  **service layer only**.

## Configuration
- All config env-based (`.env`); no hardcoded secrets/env values.
- Precedence: **env vars > config files > defaults**.

## Naming
- Functions: verb-based (`create`, `calculate`, `fetch`); data: noun-based
  (`user`, `order`).
- Booleans: `is`/`has`/`can` prefix. Avoid generic names (`data`, `temp`, `foo`).
- TS/JS imports: **no file extension**.

## Quality gate
- Before completion: lint + typecheck pass; no dead code / unused exports.
