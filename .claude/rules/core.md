# Core rules (unconditional — loads every session, no `paths:`)

## Authority order (권한 순서 — 트리의 뿌리)
~/.claude/CLAUDE.md > MEMORY.md (소유자 피드백 메모리) > 01.rules.md
  > .claude/CLAUDE.md > rules/core.md > rules/<domain>/* > agents/* > skills/*

- 자식은 부모를 절대 덮어쓰지 않는다.
- MEMORY.md는 소유자가 직접 준 지시의 기록이다 — 저장소 파일보다 상위이고, 더 최근
  날짜가 이긴다. 저장소 규칙과 어긋나면 저장소 쪽을 고친다 (2026-09-20).
- 충돌하면 로컬에서 해결하지 말고 STOP하고 소유자에게 묻는다.
- 규칙 문장은 정확히 한 곳에만 존재한다. 다른 곳은 인용만 한다.
- 서브에이전트는 서브에이전트를 디스패치하지 않는다 (`tools:`에 `Agent` 금지).

## Prohibitions (irreversible or incident-derived)

- **Never train deep-learning models locally.** `~/.claude/CLAUDE.md` owns this
  rule — its scope, the classical-ML carve-out (owner, 2026-09-20) and what local
  checks are allowed. Read it there; it is not restated here.
- **Soft-delete only.** Never `rm`. Rename with `x_` prefix so the owner verifies
  and removes manually.
- **Subagents never `git commit` / `git push`.** The main session (or the owner) commits.
- **Tests are SUSPENDED** (owner directive, 2026-09-04). Do not write `*.test.*` /
  `*.spec.*` files or run a test runner. The Jest config, where present, is
  deliberately unused — NOT dead code. Verify behavior instead by DELIBERATE
  BREAKAGE against the real system: trigger the failure, observe it, clean up.
- **Model allocation** <!-- repo-specific -->: reasoning roles (research,
  analysis, planning, architecture, review) → Opus; writing/implementation roles
  (`sonnet-writer`, `developer`) → Sonnet. Do not send writing to a reasoning
  model. Cap parallel research agents at 2-3 — six at once died to rate limits
  twice (owner, 2026-09-20).
- **Write-first, append-verified.** A long-running agent writes its output file
  FIRST, then appends each row only after verifying it. A rate-limit kill then
  loses at most one row, not the whole run.
- **Doc edits are surgical.** Never regenerate a whole living doc from scratch —
  another session may share this checkout. Full lifecycle: `rules/docs.md`.
- **Worktree agents:** `git reset --hard main` before starting.
- **Never hard-DELETE DB rows.** `deleted_at` tombstone; mask at read.

## Agent discipline
- One small task at a time; verify each step before starting the next.
- Fail fast — fix immediately, continue incrementally; do not batch fixes.
- If scope or boundaries blur, stop, shrink scope, re-apply SRP.

## Ambiguity
Unclear → STOP and ask. Never guess or assume; explicit over implicit.

## Admission test for this file
A line belongs in `core.md` only if violating it is irreversible or
incident-derived. Everything else is `paths:`-scoped (`rules/<domain>/`) or a skill.
