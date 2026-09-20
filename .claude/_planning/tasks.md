# `.claude/` harness restructure — TASK BREAKDOWN (pm, 2026-09-20)

Input spec: `harness-design.md` (system-architect). Verified facts: `harness-facts.md` (F1–F8).
This is a planning artifact only — nothing under `.claude/` has been created, moved or edited.

Status legend: `[ ]` TODO · `[~]` IN PROGRESS · `[x]` DONE. All tasks below are `[ ]`.

---

## How the always-on line count is measured (used by every measurement task)

**Scope of the budget: files under `<repo>/.claude/` ONLY.** The user-level
`/Users/tio/.claude/CLAUDE.md` and `~/.claude-school/.../MEMORY.md` also load as "project
instructions" but are outside this migration and outside the 487 figure. Both methods must use
this same scope, and they must AGREE to within 0 lines, else stop and reconcile.

**Method A — computed (deterministic).**
```bash
cd /Users/tio/Documents/project_job
# every rules file WITHOUT a `paths:` key in frontmatter, plus the repo CLAUDE.md
for f in .claude/CLAUDE.md $(find .claude/rules -name '*.md'); do
  head -5 "$f" | grep -q '^paths:' || wc -l "$f"
done | awk '{s+=$1; print} END {print "TOTAL", s}'
```

**Method B — observed (deliberate-breakage standard, §19).**
Open a FRESH session. Issue no Read/Bash. Enumerate the files named in the
`Contents of <path> (project instructions…)` system-reminder headers, **keeping only paths under
`/Users/tio/Documents/project_job/.claude/`**. `wc -l` each. Sum.

Baseline for "today" is already observed in the current session transcript (repo-scoped):
`.claude/CLAUDE.md` 124 + `rules/BASE.md` 5 + `rules/docs.md` 238 + `rules/nexjts.md` 36 +
`rules/python.md` 77 + `rules/x_rust.md` 2 + `rules/x_typescript.md` 5 = **487**.

Record every measurement in the phase checkpoint COMMIT MESSAGE. `01.status.md` does not exist
in this repo and this migration does not create it.

---

# Phase 1 — mechanical moves + `paths:` frontmatter

Zero pipeline risk: touches no agent, no `authoring/` file, no `book/`. Executable now.
Target: 487 → ~127.

### H1.0 — Record the Phase-1 baseline always-on line count
- Files touched: none (read-only).
- Operation: measure (Method A + Method B above).
- Owner: main session.
- Depends on: —
- AC-H1.0a: Method A prints `TOTAL 487`.
- AC-H1.0b: Method B, repo-scoped, enumerates exactly 7 files under `.claude/` and sums to 487.
  (User-level CLAUDE.md and MEMORY.md are present in the headers and are correctly excluded.)
- AC-H1.0c: A and B agree; both numbers are written into the H1.9 commit message.
- Rollback: n/a (read-only).

### H1.0b — Confirm which `.claude/` files are git-tracked
- Files touched: none (read-only).
- Operation: run `git ls-files .claude/` and `git status --short .claude/`.
- Owner: main session.
- Depends on: —
- AC-H1.0b1: the tracked/untracked status of every file under `.claude/` is listed.
- AC-H1.0b2: any file moved in Phase 1 that is UNTRACKED is flagged — it must be `git add`ed
  and committed BEFORE its move (otherwise the pre-move content is unrecoverable, violating
  soft-delete). Known from git status: `.claude/agents/sonnet-writer.md` is untracked (Phase 2).
- AC-H1.0b3: moves of tracked files use `git mv`; moves of untracked files use `mv` after the
  add-and-commit in AC-H1.0b2.
- Rollback: n/a (read-only).

### H1.1 — Add `paths:` frontmatter to `rules/docs.md`
- Files: `.claude/rules/docs.md` (in place, no move).
- Operation: **add frontmatter** only. Prepend exactly the 9-line block from design §7
  (`paths:` + 6 globs: `00.plan.md`, `00.tasks.md`, `01.status.md`, `01.rules.md`,
  `docs/phases/**/*.md`, `_docs/archive/**/*.md`). No other byte changes.
- Precheck: confirm `rules/docs.md` has NO existing frontmatter block (a second `---` block
  would corrupt the file).
- Owner: main session.
- Depends on: H1.0, H1.0b.
- AC-H1.1a: `git diff .claude/rules/docs.md` shows ONLY added lines, all of them the
  frontmatter block; zero deletions, zero modifications; line count 238 → 247.
- AC-H1.1b (deliberate breakage — PROBE, see Design gaps §G1): create
  `docs/phases/x_probe.md` containing one line; in a FRESH session, Read it; `rules/docs.md`
  appears in context. In another FRESH session that Reads only `book/research/STATUS.md`,
  `rules/docs.md` is ABSENT. Then move the probe to the scratchpad (soft-delete: move, not rm).
- AC-H1.1c (failure decision tree — do NOT revert on the first miss): if the FLAT probe
  `docs/phases/x_probe.md` does not fire, retry with a NESTED probe
  `docs/phases/sub/x_probe.md`.
  - nested fires, flat does not → glob semantics, not the mechanism: add `docs/phases/*.md` to
    the glob list and re-run. (This matters for real use: the design's own shard examples
    `docs/phases/p0.9.tasks.md` are FLAT.)
  - neither fires → `paths:` is not working here; revert H1.1, `rules/docs.md` stays
    unconditional, and the Phase-1 claim is revised to 487 → 365.
- Rollback: `git checkout -- .claude/rules/docs.md`.

### H1.2 — Add `paths:` to `python.md` and move it under `rules/development/`
- Files: `.claude/rules/python.md` → `.claude/rules/development/python.md`.
- Operation: `mkdir .claude/rules/development` + `git mv`, then **add frontmatter**
  (`paths: ["**/*.py", "pyproject.toml"]`). Content otherwise **verbatim** — the ONLY sanctioned
  content change is the added frontmatter block. No heading renumber, no wording edit.
- Precheck: confirm no existing frontmatter block.
- Owner: main session. BLOCKED BY owner decision **D3** (keep vs retire python.md).
- Depends on: H1.0b.
- AC-H1.2a: `git diff -M` reports the move as a rename with the added frontmatter as the only
  content delta (77 → 82 lines).
- AC-H1.2b (deliberate breakage): FRESH session, no Reads → `python.md` absent from context.
  FRESH session, Read `pyproject.toml` → `rules/development/python.md` present. (`pyproject.toml`
  is the trigger because this repo contains no `.py` file.)
- AC-H1.2c: F1 confirmed in practice — the file is still discovered from a subdirectory.
- Rollback: `git mv` back to `.claude/rules/python.md`; `git checkout --` the frontmatter.

### H1.3 — Create `.claude/x_rules/` and retire three rules by MOVE
- Files: `.claude/rules/nexjts.md` → `.claude/x_rules/nexjts.md`;
  `.claude/rules/x_rust.md` → `.claude/x_rules/x_rust.md`;
  `.claude/rules/x_typescript.md` → `.claude/x_rules/x_typescript.md`.
- Operation: **move verbatim**. Filenames unchanged, contents unchanged — ZERO sanctioned content
  changes. Retirement is the move OUT of `rules/`, not a rename (F2: an `x_` rename in place does
  NOT unload the file).
- Owner: main session.
- Depends on: H1.0b.
- AC-H1.3a: `.claude/rules/` contains no `nexjts.md`, `x_rust.md`, `x_typescript.md`;
  `.claude/x_rules/` contains all three; `git diff -M` shows pure renames, 0 content lines changed.
- AC-H1.3b (deliberate breakage): FRESH session → none of the three appears in the
  `Contents of …` headers. Contrast with the current session, where all three ARE present.
- AC-H1.3c: `.claude/x_rules/` is NOT nested under `.claude/rules/` (F1: rules discovery is
  recursive; nesting would keep them loaded).
- Rollback: `git mv` each file back into `.claude/rules/`.

### H1.4 — Fold `rules/BASE.md` into `CLAUDE.md`, retire the file, and repair stale pointers
- Files: `.claude/rules/BASE.md` → `.claude/x_rules/BASE.md`; `.claude/CLAUDE.md` (edited).
- Operation, three surgical parts:
  1. **move verbatim** `BASE.md` → `x_rules/BASE.md`.
  2. **surgical add** to `CLAUDE.md`: insert the workflow-cycle text as a ~3-line section. Agent
     names are folded **as they stand today** (`architect` / `pm` / `developer` / `ml-engineer`);
     renaming to the new roster is Phase 2 work (Design gaps §G3).
  3. **link rewrite** in `CLAUDE.md`: the "Language-specific rules" line currently names
     `rules/python.md`, `rules/nexjts.md`, `rules/docs.md`, `rules/BASE.md` as auto-loading, and
     Naming §10 names `rules/nexjts.md`. Three of those are false after H1.2–H1.4 and would stay
     false until H2.4 — possibly weeks, given the D5 gate. Rewrite those pointer lines to the new
     locations and loading modes. This is a link rewrite, the same sanctioned change
     `rules/docs.md` §2 permits during a move; no other `CLAUDE.md` content is rewritten in
     Phase 1.
  Do not regenerate `CLAUDE.md`.
- Owner: main session.
- Depends on: H1.2, H1.3 (both destinations must exist before their pointers are rewritten).
- AC-H1.4a: `git diff .claude/CLAUDE.md` shows only the inserted block plus the rewritten pointer
  lines; no other line changed; 124 → ≤127 lines.
- AC-H1.4b: the folded text preserves BASE.md's two operative statements — the multi-agent cycle
  order, and "skip for trivial/single-file edits".
- AC-H1.4c: `.claude/rules/BASE.md` no longer exists; `.claude/x_rules/BASE.md` is byte-identical
  to the pre-move file (`git diff -M` = pure rename).
- AC-H1.4d: `grep -n 'rules/nexjts\|rules/BASE\|rules/python\.md' .claude/CLAUDE.md` → 0 hits.
- AC-H1.4e: every path named in `CLAUDE.md` resolves to a file that exists.
- Rollback: `git mv` BASE.md back; `git checkout -- .claude/CLAUDE.md`.

### H1.5 — Phase-1 verification sweep (deliberate breakage, single fresh session)
- Files: none (read-only probing).
- Operation: verify.
- Owner: main session (fresh-session inspection cannot be delegated — a subagent reports its own
  inherited context, per F4, not the main session's).
- Depends on: H1.1, H1.2, H1.3, H1.4.
- AC-H1.5a: FRESH session, zero Reads → the repo-scoped headers name exactly ONE file:
  `.claude/CLAUDE.md`. No `docs.md`, no `python.md`, no `nexjts.md`, no `x_rust.md`, no
  `x_typescript.md`, no `BASE.md`. (User-level CLAUDE.md + MEMORY.md remain present and are out
  of scope.)
- AC-H1.5b: positive triggers both fire (AC-H1.1b probe, AC-H1.2b `pyproject.toml`).
- AC-H1.5c: the user-level never-train rule and the repo `.claude/CLAUDE.md` are still present
  unconditionally — no prohibition was lost.
- Rollback: n/a.

### H1.6 — Re-measure always-on line count after Phase 1
- Files: none.
- Operation: measure (Method A + Method B, repo-scoped).
- Owner: main session.
- Depends on: H1.5.
- AC-H1.6a: Method A and Method B agree.
- AC-H1.6b: the total is ≤ 130 and ≥ 120 (design claims ~127). If outside that band, record the
  actual number and the discrepancy; do NOT adjust the files to hit the number.
- AC-H1.6c: the measured delta vs 487 is recorded verbatim in the H1.9 commit message.
- Rollback: n/a.

### H1.9 — Phase-1 checkpoint commit
- Files: everything under `.claude/` changed by H1.1–H1.4.
- Operation: `git add` **explicit paths only** (`.claude/CLAUDE.md .claude/rules .claude/x_rules`)
  — never `git add -A`/`-u`. `book/` and `book/research/*` are uncommitted WIP and must not be
  swept in (§22.1 incident).
- Owner: **main session ONLY**. Subagents never commit (§22.1).
- Depends on: H1.6.
- AC-H1.9a: `git show --stat HEAD` lists only paths under `.claude/`; zero `book/` paths.
- AC-H1.9b: the commit message contains the before (487) and after (measured) line counts from
  H1.0 and H1.6.
- AC-H1.9c: `git status --short` still shows the pre-existing `book/` modifications as
  uncommitted — untouched.
- Rollback: `git revert <sha>` (preferred, preserves history) or `git reset --soft HEAD~1`.

---

# Phase 2 — content restructure

Gate: see decision **D5**. Split into **2a** (safe now — no kept agent body is edited) and **2b**
(the four kept agent bodies — must wait for STATUS.md step 6 DONE; see Design gaps §G4).
Target: ~127 → ~70.

### H2.0 — Baseline-commit every untracked `.claude/` file BEFORE any Phase-2 edit
- Files: `.claude/agents/sonnet-writer.md` (untracked, 524 lines) + anything else flagged in
  AC-H1.0b1.
- Operation: `git add` the explicit paths, commit as-is, no content change.
- Owner: main session.
- Depends on: H1.9.
- AC-H2.0a: `git ls-files .claude/` lists every file under `.claude/`; `git status --short
  .claude/` is empty.
- AC-H2.0b: the committed `sonnet-writer.md` is 524 lines, unedited.
- AC-H2.0c: no file outside `.claude/` is in the commit.
- Rationale (blocking): H2.10 rewrites this file 524 → ~70. Without a baseline commit the original
  is unrecoverable — a soft-delete violation.
- Rollback: `git reset --soft HEAD~1` (file returns to untracked, content intact).

### H2.0m — Record the Phase-2 baseline always-on line count
- Operation: measure (Method A + Method B). Owner: main session. Depends on: H2.0.
- AC-H2.0m1: matches H1.6's number exactly (nothing drifted between phases). If not, stop and
  find the intervening change.
- Rollback: n/a.

## Phase 2a — rules, skills, new agents, retirements

### H2.1 — Move `authoring/*` → `rules/writing/*` (verbatim)
- Files: `.claude/authoring/book.md` → `.claude/rules/writing/book.md`;
  `.claude/authoring/latex.md` → `.claude/rules/writing/latex.md`.
- Operation: **move verbatim**. The ONLY sanctioned content changes are (1) the added `paths:`
  frontmatter (`book.md`: `**/*.tex`, `**/*.bib`; `latex.md`: `**/*.tex`, `**/*.bib`, `**/*.sty`,
  `**/*.cls`) and (2) rewriting internal relative path references for the new depth. **Not one
  Korean sentence changes.** No split, no translation, no condensing, no heading renumber.
- Precheck: confirm NEITHER file already has a frontmatter block (prepending a second `---` block
  would corrupt both).
- Owner: main session (highest-risk edit in the migration, design §9 risk 3 — not delegated).
- Depends on: H2.0.
- Order (mandatory): write the destination, READ IT BACK, then remove the source.
- **H2.1 and H2.2 land in ONE commit** — between the move and the stub, `research-plan.md` §3.5's
  literal path is broken.
- AC-H2.1a (primary, locale-safe): for each file,
  `diff <(tail -n +N .claude/rules/writing/book.md) <(git show HEAD:.claude/authoring/book.md)`
  where N = frontmatter length + 1 → the only differences are the ≤3 rewritten link lines.
  Deleted non-frontmatter lines = 0.
- AC-H2.1b (secondary): `LC_ALL=en_US.UTF-8 grep -o '[가-힣]' <file> | wc -l` is IDENTICAL before
  and after for both files.
- AC-H2.1c: line counts 236 → 236+frontmatter and 156 → 156+frontmatter.
- Rollback: `git mv` back to `.claude/authoring/`; `git checkout --` the frontmatter.

### H2.2 — Create 3-line forwarding stubs at the old `authoring/` paths
- Files: **create new** `.claude/authoring/book.md`, `.claude/authoring/latex.md`.
- Operation: create new, 3 lines each: "Moved to `.claude/rules/writing/<name>.md` (2026-09-20).
  It now loads automatically when a `.tex` file is opened."
- Owner: main session.
- Depends on: H2.1 (same commit).
- Rationale: `research-plan.md` §3.5 and AC-W1 reference these literal paths; the pipeline is
  mid-flight (design §9 risk 1).
- AC-H2.2a: both files exist, ≤4 lines each, and name the new path correctly.
- AC-H2.2b: `.claude/authoring/` is NOT under `.claude/rules/` — FRESH session confirms the stubs
  do not appear in context (cost 0).
- AC-H2.2c: `grep -rn 'claude/authoring' book/research/` — every hit resolves to an existing file.
- Rollback: move both stubs to `.claude/x_authoring/` (soft-delete).

### H2.3 — Create `rules/core.md` and `rules/development/code.md` (destinations first)
- Files: **create new** `.claude/rules/core.md` (~25 lines, UNCONDITIONAL — no `paths:`);
  **create new** `.claude/rules/development/code.md` (~40 lines, `paths:` per design §2).
- Operation: create new, content moved from `CLAUDE.md` per the design §4 migration map.
  `CLAUDE.md` is NOT cut in this task — temporary duplication is intentional and correct.
- Owner: main session.
- Depends on: H2.0m. (Independent of H2.1/H2.2.)
- AC-H2.3a: `core.md` contains all nine unconditional items from design §3: never-train-ML,
  no-commit/push by subagents, soft-delete/never-rm, tests-suspended §19, model allocation,
  write-file-first-then-append, no hard-DELETE DB rows, unclear→STOP, §22.2/§22.3 one-liners.
- AC-H2.3b: `core.md` has NO `paths:` frontmatter (F3 caveat: prohibitions cannot be path-scoped).
- AC-H2.3c: `code.md` HAS `paths:` frontmatter and contains zero prohibitions.
- AC-H2.3d: for every line the design maps out of `CLAUDE.md`, that line's substance is present in
  `core.md` or `code.md` — checked item-by-item against the §4 table before H2.4 runs.
- AC-H2.3e: `core.md` ≤ 30 lines.
- Rollback: move both new files to `.claude/x_rules/` (soft-delete, never rm).

### H2.4 — Rewrite `.claude/CLAUDE.md` to ~45 lines
- Files: `.claude/CLAUDE.md` (rewrite).
- Operation: **rewrite** per design §4. Cut only the blocks whose destination already exists and
  was read back in H2.3/H2.1. Delete-and-invert the "Authoring rules (NOT auto-loaded)" section,
  replacing it with the rules index including `rules/writing/`. Update agent names to the new
  roster here (deferred from H1.4).
- Owner: main session.
- Depends on: H2.3 (destinations must exist and be verified first), H2.1, H2.2.
- AC-H2.4a: ≤50 lines.
- AC-H2.4b: every cut block is present in `core.md`, `code.md`, `rules/docs.md`, `x_rules/nexjts.md`
  or `rules/writing/*` — enumerate the §4 table row by row; unmatched rows = 0.
- AC-H2.4c: no sentence appears in both `CLAUDE.md` and a `rules/` file (one copy of any rule,
  per `rules/docs.md` §8).
- AC-H2.4d: contains the admission test verbatim (design risk 6): "a line is unconditional only if
  violating it is irreversible or incident-derived; everything else is `paths:` or a skill."
- AC-H2.4e: contains no claim that this repo has no books and no `.tex`.
- AC-H2.4f: H2.3 + H2.4 land in ONE commit — no commit may exist where a prohibition is in neither
  `CLAUDE.md` nor `core.md`.
- AC-H2.4g: every path named resolves to an existing file; every agent named exists in
  `.claude/agents/`.
- Rollback: `git checkout -- .claude/CLAUDE.md` (it is tracked; original is at H1.9).

### H2.5 — Write the two new skills
- Files: **create new** `.claude/skills/research-methodology/SKILL.md` (~70),
  `.claude/skills/source-citation/SKILL.md` (~25).
- Operation: create new, extracting `book/research/research-plan.md` §0 + §2.7 as the portable core.
  Read-only on `research-plan.md` — do not edit it.
- Owner: main session.
- Depends on: H2.0m. Parallel with H2.1–H2.4.
- AC-H2.5a: `research-methodology` covers all eight named procedures (candidate profile, recency
  tags, compensation hierarchy, dedup by `company_slug`, verification enum, selection log,
  write-first-append-per-row, never read `dossier/`).
- AC-H2.5b: `source-citation` defines both emitted forms (`[S-WS3-12]`, `% src: S-WS3-12`) and the
  AC-W6 check, and is referenced by all three consumers without restating the text.
- AC-H2.5c: FRESH session → neither SKILL.md appears in the `Contents of …` headers (skills are
  on-demand, cost 0).
- AC-H2.5d: `book/research/research-plan.md` is unmodified (`git diff` empty for it).
- Rollback: move each skill directory to `.claude/x_skills/`.

### H2.6 — Create `agents/researcher.md` and `agents/reviewer.md`
- Files: **create new** `.claude/agents/researcher.md` (~60), `.claude/agents/reviewer.md` (~50).
- Operation: create new from the design §6 template and §6 frontmatter table.
- Owner: main session.
- Depends on: H2.5 (skills must exist to be named in `skills:`).
- AC-H2.6a: `researcher` frontmatter is exactly `tools: Read, Write, Grep, WebSearch, WebFetch` /
  `model: fable` / `skills: [research-methodology, source-citation]` / `effort: medium`.
- AC-H2.6b: `reviewer` frontmatter has no `Write` and no `Edit` in `tools:`; body states it reports
  and never fixes.
- AC-H2.6c: neither body restates any rule text — only pointers (design §6).
- AC-H2.6d: neither sets `omitClaudeMd` (design §6: use it nowhere).
- AC-H2.6e (deliberate breakage, subagent context): dispatch `researcher` with the probe prompt
  "list every file and skill named in your startup context; do no other work" — **one turn only**
  (`maxTurns: 1` if supported). Output names `research-methodology` and `source-citation`, and
  names `rules/core.md`. It must NOT name `rules/docs.md` or `rules/writing/book.md`.
  *Noted exception:* this is a Fable dispatch for a non-research purpose; a one-turn context probe
  is a sanctioned one-off under the Fable-for-research-only allocation, not a precedent.
- AC-H2.6f: `researcher` body instructs write-the-output-file-first-then-append (incident-derived).
- Rollback: move both files to `.claude/x_agents/`.

### H2.7 — Retire three agents by MOVE to `.claude/x_agents/`
- Files: `.claude/agents/ml-engineer.md` → `.claude/x_agents/ml-engineer.md`;
  `mock-producer.md` → `.claude/x_agents/mock-producer.md`;
  `test-engineer.md` → `.claude/x_agents/test-engineer.md`.
- Operation: **move verbatim**, filenames unchanged, zero content changes. Not `agents/x_*.md`
  (OQ2 unverified — do not gamble).
- Owner: main session. BLOCKED BY owner decision **D4** (retire `ml-engineer`: yes/no).
- Depends on: H2.0.
- AC-H2.7a: `git diff -M` = three pure renames, 0 content lines changed.
- AC-H2.7b: `.claude/x_agents/` is not nested under `.claude/agents/`.
- AC-H2.7c (PASSIVE check only): in a FRESH session, the agent listing (`/agents` or equivalent)
  does not include `ml-engineer`, `mock-producer` or `test-engineer`. **Never dispatch
  `ml-engineer` to test this** — its workflow step 2 is literally "Train model", the exact hazard
  the retirement removes.
- AC-H2.7d: all three files are readable and byte-identical to their pre-move versions.
- Rollback: `git mv` each back into `.claude/agents/`.

### H2.8 — Phase-2a verification sweep
- Owner: main session. Depends on: H2.2, H2.4, H2.5, H2.6, H2.7.
- AC-H2.8a: FRESH session, zero Reads → repo-scoped headers name exactly TWO files:
  `.claude/CLAUDE.md` and `.claude/rules/core.md`.
- AC-H2.8b: FRESH session, Read `book/chapters/11-industries-companies.tex` →
  `rules/writing/book.md` AND `rules/writing/latex.md` both appear.
- AC-H2.8c: FRESH session, Read only `book/research/STATUS.md` → neither writing rule appears,
  nor `docs.md`, nor `python.md`.
- AC-H2.8d: the H1.1 probe and H1.2 `pyproject.toml` triggers still fire.
- AC-H2.8e (OPTIONAL): `latexmk -xelatex main.tex` in `book/`. The migration touches nothing under
  `book/`, so this verifies nothing about the migration and it rewrites `book/main.pdf` (on the
  do-not-touch list). Run only if the owner wants an independent sanity build.
- Rollback: n/a.

### H2.8m / H2.9 — Re-measure, then Phase-2a checkpoint commit
- H2.8m operation: measure (Method A + B). Depends on: H2.8.
  - AC-H2.8m1: A and B agree; total ≤ 80 and ≥ 60 (design claims ~70).
  - AC-H2.8m2: actual number recorded; files are NOT tweaked to hit the target.
- H2.9: `git add` explicit `.claude/` paths only, never `-A`. **Main session ONLY.**
  - AC-H2.9a: `git show --stat HEAD` lists only `.claude/` paths.
  - AC-H2.9b: commit message carries 487 → H1.6 number → H2.8m number.
  - AC-H2.9c: `book/` modifications remain uncommitted.
  - Rollback: `git revert <sha>`.

## Phase 2b — slim the four kept agent bodies (GATED)

**Gate: STATUS.md step 6 = DONE.** `product-manager` owns step 3 (RUNNING) and `sonnet-writer`
runs step 5 — editing either mid-flight changes an agent that is about to be, or is being,
dispatched. See Design gaps §G4.

### H2.10 — Slim `sonnet-writer.md` 524 → ~70; extract examples and LaTeX sections
- Files: `.claude/agents/sonnet-writer.md` (rewrite);
  §1/§2/§5/§6 → appended to `.claude/rules/writing/latex.md` as §13;
  the three ~120-line Example blocks → **create new** `.claude/x_agents/x_sonnet-writer-examples.md`.
- Operation: write destinations first, read back, then cut from the agent (soft-delete §7).
  The agent NAME `sonnet-writer` does not change.
- Owner: main session. Depends on: H2.0 (baseline commit), H2.9, gate.
- AC-H2.10a: filename and frontmatter `name:` are still exactly `sonnet-writer`.
- AC-H2.10b: ≤80 lines; retains Responsibilities, Agent Boundaries, Ambiguity Policy, Research
  Memo Protocol, Completion.
- AC-H2.10c: every cut line exists in `rules/writing/latex.md` §13 or in
  `x_agents/x_sonnet-writer-examples.md` — cut lines with no destination = 0.
- AC-H2.10d: body contains "always open `.tex` with Read, never `cat`" (design risk 2b).
- AC-H2.10e: frontmatter `model: sonnet`, `skills: [source-citation]`.
- AC-H2.10f: no repo-wide prohibition is restated in the body (inherited from `core.md`).
- AC-H2.10g: appending §13 to `rules/writing/latex.md` does not disturb its frontmatter or any
  Korean line (re-run AC-H2.1a's diff against the H2.9 commit).
- Rollback: `git checkout -- .claude/agents/sonnet-writer.md` (baseline at H2.0); move the two
  destination files to `x_`.

### H2.11 — Slim `developer.md`, `product-manager.md`, `system-architect.md`
- Files: the three agent files (rewrite), destinations per design §4.
- Operation: rewrite to the §6 template. `developer`: add `skills: [karpathy-guidelines]`, drop the
  inline Karpathy block, replace "notify system-architect to update STATUS" with "report to the
  dispatching session; never write status docs yourself". `product-manager`: replace `docs/phases/`
  restatements with a pointer to `rules/docs.md`. `system-architect`: replace the leaked
  `packages/types` / `tradelunch.schema.sql` SSOT reference with "the repo's actual SSOT, named in
  the task".
- Owner: main session. Depends on: H2.10, gate.
- AC-H2.11a: each file ≤50 lines and follows the §6 section order.
- AC-H2.11b: `grep -rn 'tradelunch\|packages/types' .claude/agents/` returns 0 hits.
- AC-H2.11c: `developer` frontmatter names `karpathy-guidelines` in `skills:`; the inline v2 block
  is gone; `skills/karpathy-guidelines/` itself is UNMODIFIED.
- AC-H2.11d: no Guardrails/soft-delete/no-commit block remains in any of the three bodies.
- AC-H2.11e: `product-manager` still states it never writes STATUS and never writes `01.rules.md`.
- Rollback: `git checkout --` each file (baseline at H1.9/H2.9).

### H2.12 / H2.13 — Phase-2b verification, re-measure, checkpoint commit
- H2.12 AC-a: dispatch each of the 6 agents with the one-turn context-probe prompt (AC-H2.6e
  style); each names `rules/core.md` and its own declared skills, and nothing it should not inherit.
- H2.12 AC-b: FRESH-session always-on set is unchanged from AC-H2.8a (agent bodies cost 0 — F4
  applies to rules, not agent files).
- H2.12 AC-c: `.claude/agents/` contains exactly 6 files; `.claude/x_agents/` contains exactly 4
  (3 retired + the sonnet-writer examples).
- H2.13: measure, then `git add` explicit `.claude/` paths, **main session ONLY**; commit message
  carries the final number. Rollback: `git revert <sha>`.

---

## Dependency order / critical path

```
H1.0 ─┐
H1.0b ┴─> H1.1 ─┐
       ├> H1.2 ─┤        (H1.1, H1.2, H1.3 run in PARALLEL — disjoint files)
       └> H1.3 ─┴> H1.4 ─> H1.5 ─> H1.6 ─> H1.9 ✅ COMMIT
                                              │
                                    H2.0 ─> H2.0m
                                     │        │
        ┌────────────────────────────┼────────┴──────────┬──────────────┐
        │                            │                   │              │
   H2.1+H2.2 (one commit)         H2.3 ─> H2.4      H2.5 ─> H2.6     H2.7 (needs D4)
        │                            │                   │              │
        └──> (H2.4 also needs H2.1/H2.2) ────────────────┴──────────────┴> H2.8 ─> H2.8m ─> H2.9 ✅ COMMIT
                                                                                              │
                                                          ═══ GATE: STATUS step 6 DONE ═══
                                                                                              │
                                                                    H2.10 ─> H2.11 ─> H2.12 ─> H2.13 ✅ COMMIT
```

**Strictly serial:** H1.2+H1.3 → H1.4 (destinations must exist before their pointers are
rewritten). H1.4 → H1.5 → H1.6 → H1.9. H2.0 → everything in Phase 2 (soft-delete baseline).
H2.3 → H2.4 (destination before cut; one commit). H2.1 → H2.2 (one commit). H2.5 → H2.6 (skills
before `skills:` references). H2.10 → H2.11 (sonnet-writer is the riskiest; land it alone).

**Parallelizable:** {H1.1, H1.2, H1.3}. {H2.1+H2.2}, {H2.3+H2.4}, {H2.5+H2.6}, {H2.7} — four
independent 2a strands, joining at H2.8. (H2.4 additionally waits on H2.1/H2.2 for its rules index.)

**Critical path:** H1.0b → H1.3 → H1.4 → H1.5 → H1.6 → H1.9 → H2.0 → H2.3 → H2.4 → H2.8 → H2.9
→ [GATE] → H2.10 → H2.11 → H2.13.

**Ownership note (chicken-and-egg):** all fresh-session verification is inherently **main session**
— a subagent reports its own inherited context (F4), not the main session's. The `reviewer` agent
cannot own Phase-2 verification because H2.6 creates it; it can own verification only from H2.12
onward, and even then not the fresh-session checks.

---

## Blocking decisions (owner)

| # | Decision | Options | Default if silent | Blocks |
| --- | --- | --- | --- | --- |
| **D1** | Measure whether `omitClaudeMd: true` also suppresses `rules/`? (design OQ1) | measure now / defer | **Defer.** Design uses it nowhere. | nothing |
| **D2** | Use `agents/x_foo.md` instead of a separate `x_agents/` dir? (design OQ2) | verify-then-collapse / keep `x_agents/` | **Keep `x_agents/`.** Unverified; F2 showed the same assumption already false for rules. | nothing (H2.7 proceeds with `x_agents/`) |
| **D3** | Keep `rules/development/python.md`? (design OQ3) | keep (`paths:`-scoped, 0 cost, portable) / retire to `x_rules/` | **Keep.** | **H1.2** (if "retire", H1.2 becomes a move into `x_rules/` and AC-H1.2b is dropped) |
| **D4** | Retire `ml-engineer` to `x_agents/`? (design risk 4 — reported so you can object) | yes / no | **Yes, retire.** Its workflow step 2 is literally "Train model", which the user-level rule prohibits absolutely. Move, not delete; one-line restore. | **H2.7** |
| **D5** | Phase-2 gate | (a) run 2a now, 2b after STATUS step 6 / (b) hold all of Phase 2 until step 6 | **(a).** Run 2a now — no kept agent body is edited in 2a, and H2.1+H2.2 land as one commit so the `authoring/` paths are never broken. 2b is hard-gated on step 6 DONE regardless. | **H2.1–H2.9** (2a start) and **H2.10–H2.13** (2b) |
| **D6** | Define an output schema for `x_research.md` (PhD domain)? (design OQ4) | now / later | **Later.** Separate pm/architect task, not part of this migration. | nothing |

---

## Do-not-touch list

- **The agent NAME `sonnet-writer`** — `STATUS.md` step 5 and `research-plan.md` §3.5 name it
  literally. Slim the body (H2.10); never rename the file or the `name:` field.
- **`product-manager`** — mid-flight, owns STATUS step 3 (RUNNING). Not retired, not renamed; body
  slimmed only after the D5 gate.
- **Every Korean sentence in `authoring/book.md`** — verbatim move only (H2.1). No split, no
  translation, no condensing of principle 9. Verified by diff (AC-H2.1a).
- **`.claude/settings.json`** — 22 lines, unchanged.
- **`.claude/settings.local.json`** — vestigial `pnpm` entries noted in design risk 7; OUT OF SCOPE
  for this migration.
- **`.claude/skills/karpathy-guidelines/`** — referenced by H2.11, contents unchanged.
- **Anything under `book/`** — including `book/main.pdf`, `book/research/*` (uncommitted WIP),
  `research-plan.md`, `STATUS.md`. Read-only throughout. Never in a commit from this migration.
- **`01.rules.md`** — owner-owned; does not exist here and this migration does not create it.
- **`00.plan.md` / `00.tasks.md` / `01.status.md`** — not created by this migration.
- **`dossier/`, `_scripts/`, `x_research.md`, `pyproject.toml`** — untouched.
- **The user-level `/Users/tio/.claude/CLAUDE.md`** — outside the repo and outside this migration.
- **No test files** (§19 suspended). **No local ML training**, ever.

---

## Design gaps

**G1 — The `docs.md` acceptance check as written is unexecutable.**
Design §9 risk 2 prescribes "Read `00.tasks.md` and confirm `rules/docs.md` appears". That file does
not exist in this repo and this migration is forbidden from creating it. Resolution adopted in
AC-H1.1b: a throwaway probe `docs/phases/x_probe.md`, Read, then moved to the scratchpad. A flat
probe may also expose a glob-semantics issue (`**/` may require ≥1 intermediate directory), which
matters because the design's own shard examples (`docs/phases/p0.9.tasks.md`) are FLAT — decision
tree in AC-H1.1c. Same substitution for `python.md`: no `.py` file exists, so `pyproject.toml` is
the trigger (AC-H1.2b).

**G2 — `authoring/` stub cost is asserted, not derived.** Design §2 lists `authoring/*` as
"outside auto-discovery". True today, but if the stubs ever move under `rules/` they load (F1,
recursive). AC-H2.2b makes it an observed check rather than an assumption.

**G3 — Phase-1 step 4 mixes phases, and Phase 1 leaves stale pointers.** Design's sequencing says
fold `BASE.md` "agent names updated", but the new roster (`researcher`, `reviewer`; retired
`ml-engineer`) does not exist until Phase 2 — H1.4 folds names AS-IS and defers the rename to H2.4.
Separately, the design does not notice that `CLAUDE.md` names `rules/python.md`, `rules/nexjts.md`
and `rules/BASE.md` as auto-loading; after H1.2–H1.4 those are false and would stay false until
H2.4 (weeks, under the D5 gate). H1.4 part 3 repairs them as a link rewrite — the same sanctioned
change `rules/docs.md` §2 allows during a move.

**G4 — The Phase-2 gate does not cover agent bodies.** Design §9 risk 1 mitigation (b) defers
Phase 2 until after step 6, but mitigation (a) (forwarding stubs) is presented as sufficient to
proceed. The stubs only mitigate the `authoring/` PATH references. They do nothing for slimming
`product-manager` (owns step 3, RUNNING NOW) or `sonnet-writer` (runs step 5). Resolution: Phase 2
is split into 2a (no kept-agent body edited) and 2b (the four kept agent bodies — hard-gated on
step 6 DONE). Surfaced as decision D5.

**G5 — `sonnet-writer.md` is untracked (git status `??`).** The design's 524 → ~70 rewrite would be
irreversible without a prior commit — a soft-delete violation (§7: the destination must exist
before the source is cut, and git is the recovery path named in design risk 3(d)). H2.0 makes the
baseline commit a hard prerequisite. Check H1.0b for any other untracked `.claude/` file.

**G6 — The 487 → 127 → 70 figures are targets, not commitments.** H1.6 and H2.8m record the
MEASURED number with a tolerance band. If a number misses, the plan records the miss; files are
never tweaked to hit a target (AC-H1.6b, AC-H2.8m2). If AC-H1.1c's decision tree ends in "neither
probe fires", `rules/docs.md` reverts to unconditional and the Phase-1 claim drops to 487 → 365.

**G7 — The design's verification method double-counts.** The 487 figure is repo-scoped, but the
`Contents of …` headers also carry the user-level CLAUDE.md and MEMORY.md. Any observed count must
filter to `<repo>/.claude/` or it will never reconcile with the computed count. Fixed in the
Method B definition and in AC-H1.5a / AC-H2.8a.
