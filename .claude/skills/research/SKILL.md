---
name: research
description: Orchestrate a multi-workstream sourced research effort — scope, plan, parallel dispatch, merge, analysis. Use when starting a new research pass across several non-overlapping workstreams. Invoke as "/research <topic or workstream set>".
---

# Research

Orchestration for a multi-workstream research pass. Runs in the MAIN SESSION
only: every subagent below lacks the `Agent` tool and cannot dispatch another
agent — a skill is the only invocable, repeatable home for this procedure.

`researcher` preloads both `research-methodology` and `source-citation`
(do not restate their content here).

## Steps

1. **Scope.** Define the workstreams (WS) and their non-overlap rule: one
   canonical owner per entity, a precedence order for overlaps, and which
   seed lists each WS excludes from the others (see
   `book/research/PLAN.md` §0 for the pattern this follows).
2. **Plan** — `product-manager` writes the plan: per-workstream schema
   (fields, enums, caps), acceptance criteria (`AC-R*`), and the dedup /
   precedence rule from step 1.
3. **Dispatch** — `researcher` agents, ONE per workstream. Each gets
   its own schema slice, its own output file path, and the other workstreams'
   seed lists to exclude.
4. **Merge and verify** — `product-manager` checks `AC-R1..Rn` across
   all workstream files, resolves dedup conflicts by the step-1 precedence
   rule, and writes a merged index file (e.g. `book/research/merged-index.md`).
5. **Analyze** — `data-analyst` produces the analysis memo from the
   merged/verified data.

## Rules this skill operates under (owned elsewhere — cited, not restated)

- Which model each role runs on: each agent's `model:` frontmatter (`rules/core.md`
  Model allocation). Never name a model in this file.
- The concurrency cap on parallel `researcher` dispatches: `rules/core.md`.
- Write-first / append-per-verified-row: `research-methodology` §1.
- Search budget, query tactics and source-quality tells: `research-methodology` §2, §3.
- The main session orchestrates and does not do a dispatched agent's work itself:
  `.claude/CLAUDE.md` Workflow cycle. It applies here at every step — do not run a
  workstream's searches or write its output file to "just check one thing".
