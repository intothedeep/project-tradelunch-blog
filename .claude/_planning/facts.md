# Verified facts — Claude Code rules/agent loading (fetched 2026-09-20 from code.claude.com/docs)

These are VERIFIED, not assumptions. Design against them; do not re-litigate them.

## F1. `.claude/rules/` is auto-discovered RECURSIVELY
"Place markdown files in your project's `.claude/rules/` directory... All `.md` files are
discovered recursively, so you can organize rules into subdirectories like `frontend/` or
`backend/`." → `rules/writing/latex.md` IS discovered. Subdirectories work.

## F2. Rules WITHOUT `paths:` frontmatter load EVERY session
"Rules without a `paths` field are loaded unconditionally and apply to all files."
Loaded at launch with the same priority as `.claude/CLAUDE.md`.
EMPIRICAL CONFIRMATION: this session's context contains ALL SIX current rules files,
including the soft-deleted `rules/x_rust.md` and `rules/x_typescript.md`.
→ The `x_` soft-delete prefix does NOT remove a file from context. It still costs tokens.

## F3. `paths:` frontmatter gives real conditional loading
```markdown
---
paths:
  - "book/**/*.tex"
  - "book/**/*.bib"
---
```
"These conditional rules only apply when Claude is working with files matching the
specified patterns." Globs: `**/*.ts`, `src/**/*`, `*.md`, brace expansion
`src/**/*.{ts,tsx}` supported.
CAVEAT (important): "Path-scoped rules trigger when Claude reads files matching the
pattern, **not on every tool use**." A `cat` via Bash does not reliably trigger them;
the Read tool does. Any rule that MUST be obeyed unconditionally cannot rely on `paths:`.

## F4. Subagents inherit the whole CLAUDE.md hierarchy, including rules
A subagent's startup context includes "every level of the CLAUDE.md hierarchy the main
conversation loads, including ~/.claude/CLAUDE.md, project rules, CLAUDE.local.md,
managed policy files".
→ Subagents do NOT get a smaller context by default. Every agent pays for every
unconditional rule.

## F5. Agent frontmatter fields available (full list)
name*, description*, tools, disallowedTools, model (sonnet|opus|haiku|fable|full id|inherit),
permissionMode, maxTurns, **skills** (preload skill content at startup), mcpServers, hooks,
memory (user|project|local), background, **omitClaudeMd** (skip user/project/local CLAUDE.md),
effort (low|medium|high|xhigh|max), isolation (worktree), color, initialPrompt, experimental.
→ `omitClaudeMd: true` lets a writing agent skip the dev contract entirely.
→ `skills:` preloads full skill content into a subagent — an alternative to "agent reads
   rules file X at start" (which is only an instruction Claude may or may not follow).

## F6. Skills vs rules (the docs' own guidance)
"Rules load into context every session or when matching files are opened. For
task-specific instructions that don't need to be in context all the time, use skills
instead, which only load when you invoke them or when Claude determines they're relevant."

## F7. Both `./CLAUDE.md` and `./.claude/CLAUDE.md` are read as project instructions
Having both means both load. This repo has only `.claude/CLAUDE.md` (good). The draft's
suggestion to add a root `CLAUDE.md` too would duplicate, not replace.

## F8. `claudeMdExcludes` setting can skip specific CLAUDE.md/rules paths by glob
Configurable at user/project/local/managed layer; arrays merge. Useful escape hatch.

---

# Repo reality (measured 2026-09-20)

- `.claude/` = 1 CLAUDE.md (124 lines), 7 agents, 6 rules, 2 authoring docs, 1 skill.
- Auto-loaded every session today: CLAUDE.md 124 + BASE 5 + docs 238 + nexjts 36 +
  python 77 + x_rust 2 + x_typescript 5 = **~487 lines of unconditional context**.
- `src/` EMPTY. `docs/` EMPTY. `papers/` EMPTY. No `package.json`, no monorepo, no
  `apps/`, no DB. `pyproject.toml` exists but `src/` has no code.
- The repo IS: `book/` (35 XeLaTeX Korean chapters + 8 parts + preamble + main.tex),
  `book/research/` (WS1-WS6 market research + STATUS.md + research-plan.md +
  merged-index.md + analysis-memo.md), `dossier/` (yaml), `_scripts/` (4 shell helpers),
  `x_research.md` (PhD program research brief — target schools, GRE, papers, labs).
- CONTRADICTION: `.claude/CLAUDE.md` says the authoring rules stay out of `rules/` because
  "this repo has no books and no .tex". The repo is ~90% book and .tex. Inverted.
- DEAD WEIGHT in the always-on contract: `rules/nexjts.md` (36 lines of Next.js/React/
  Tailwind for `apps/dashboard_client_web`, which does not exist here), the CLAUDE.md
  Database §7 / Configuration §8 / monorepo-DAG / Jest §19 / mock-producer sections.
- `rules/docs.md` (238 lines, the single largest always-on cost) governs
  `00.plan.md` / `00.tasks.md` / `01.status.md` / `01.rules.md` and `docs/phases/` —
  **none of those files exist in this repo**.
- Agents: no `researcher` agent exists, although research is the dominant live workstream.
  `sonnet-writer.md` is 524 lines — rules copied INTO the agent (the exact anti-pattern
  the owner's draft names). `mock-producer` (45 lines, haiku) and `test-engineer`
  (64 lines) have no subject matter in this repo (tests are suspended by §19 anyway).
- TWO research domains, not one: (1) book market research `book/research/WS*`,
  (2) PhD program/paper research `x_research.md` + empty `papers/`. Any `rules/research/`
  must serve both.
- `settings.local.json` allowlist mentions `pnpm install` / `pnpm build` — also vestigial.

# Owner constraints (from memory + CLAUDE.md, binding)
- Model allocation: Fable = research/analysis ONLY; LaTeX writing = `sonnet-writer`
  (Sonnet); planning = `product-manager` (Opus). Reason: Fable hit weekly+session rate
  limits with 6 parallel agents. Long-running agents must write their output file FIRST
  and append as they verify.
- NEVER train ML models locally (user-level rule, applies to subagents too).
- Soft-delete only: never `rm`, rename with `x_` prefix.
- Tests suspended (§19). Jest config is deliberately unused, NOT dead code.
- Subagents never `git commit` / `git push` (§22.1).
- `01.rules.md` is owner-owned; agents never write it.
