---
paths:
  - "**/PLAN.md"
  - "**/STATUS.md"
  - "**/TASKS.md"
  - "**/*.plan.md"
  - "**/*.tasks.md"
  - "**/_archive/**/*.md"
  - "**/_archive/*.md"
  - "01.rules.md"
---

# Documentation Lifecycle Rule

Domain-local two-doc model: each independent work domain owns its own docs,
colocated with the work. Portable across projects and domains.

## 0. The model

```
<domain>/
├── PLAN.md      intent + schema + task list + acceptance criteria
├── STATUS.md    append-only progress log
└── _archive/    completed detail — moved here, never deleted; COMMITTED
```

`<domain>` is any independent work area (e.g. `book/research/`, `research/`)
— this rule names none of them; new domains get the same three pieces.
`01.rules.md` is a separate, repo-root, owner-only doc (§6); it is not part
of a domain.

**Why domain-local, not one root file:** forcing two independent domains into
one shared task file is what produced a 65 KB file with nothing archivable —
every `[x]` was already terse, the bulk was the open backlog itself.
Colocating PLAN/STATUS with the work they describe avoids the merge, and
keeps the `paths:` globs above portable (`**/PLAN.md` matches any domain).

**`_archive/` is committed, not gitignored.** Reversed 2026-09-20: two
`x_`-prefixed rule files turned out unrecoverable precisely because they were
gitignored. Archiving must never depend on local disk state.

## 1. When a living doc splits

LOC is a proxy for "one file = one responsibility," not the rule itself —
same standard as the repo's code-file threshold
(`rules/development/code.md` §Structure: 300 soft / 400 hard). This threshold applies to LIVING docs only — `PLAN.md`/`STATUS.md`/
their split siblings. It does NOT apply to research output or generated
artifacts (e.g. `book/research/analysis-memo.md` at 1261 lines is a valid
output artifact, not a living doc, and is exempt). Reference point:
`book/research/PLAN.md` at 219 lines needs no split.

- **`PLAN.md` ≤ ~300 lines.** Past that, split the largest self-contained
  unit out to a sibling file, leaving a stub in `PLAN.md` that carries the
  current state. Two split targets:
  - `TASKS.md` — when the task list is what grew.
  - `<unit>.plan.md` — when one work-unit's detail is what grew.
- **~400 lines is the hard review line** — split, or write in the doc why
  splitting would create an artificial seam (shared private context that
  can't be cut cleanly).
- **`STATUS.md` never splits; it rolls off** (§4) to `_archive/status.<range>.md`.
- **Do not pre-create split files.** A domain starts with `PLAN.md` +
  `STATUS.md` only. Split when the threshold is actually crossed, not before.

**Two safety rules once a split exists (a stale detail file is worse than none):**

1. **The stub is the truth.** If `PLAN.md`'s stub and a split file disagree,
   the stub wins. A stub carries current STATE (status word, open/done
   counts, the gating fact). When state changes, update the split file AND
   its stub in the SAME edit — never one without the other.
2. **No orphans.** Every split file has a stub in `PLAN.md`. A split file
   with no stub is a rule violation: fix by adding the stub or moving the
   file to `_archive/`.

Stub shape:

```markdown
### Task list — split out (2026-09-20)

> Current state: 4 open, 2 in progress. <!-- see TASKS.md -->
> Detail: [TASKS.md](./TASKS.md)
```

## 2. Archiving completed work

When a unit is fully `DONE` / `SHIPPED` / `SUPERSEDED`:

1. Cut its full detail from the living doc.
2. Paste it into a file under `_archive/`.
3. Leave only a stub in the living doc: title + status + one-line summary +
   link, guarded with `<!-- ARCHIVE: history-only -->`.

```markdown
### Deploy pipeline — DONE (2026-06-26)

> One-line summary of what shipped. <!-- ARCHIVE: history-only -->
> Detail: [_archive/deploy-pipeline.md](./_archive/deploy-pipeline.md)
```

**Never archive a feature/task set while any of its tasks is still open.**
Keep the not-done tasks live; move only completed sub-tasks.

Move mechanics (never delete) follow `rules/core.md`'s soft-delete rule, with
one archiving-specific addition: write the destination FIRST, read it back to
confirm, THEN cut it from the source. If unsure whether something is truly
done, leave it in the living doc.

## 3. Archive = cold storage (READ GUARD)

Treat `_archive/*` as history-only. **Do not read it by default.** Open a
file inside it only when:

- (a) the owner explicitly asks about a past decision or history, OR
- (b) the active stub is insufficient and the superseded detail is genuinely
  needed for the current task.

Otherwise the stub in the living doc is sufficient — do not follow the link.

Enforcement: (1) every archive link carries `<!-- ARCHIVE: history-only -->`;
(2) each living doc starts with the banner in §5; (3) this rule file.

## 4. `STATUS.md` line style

- One line per update, newest at the bottom, append-only.
- Short, concrete, informative — drop filler and hedging.
- Format: `<date> <area>: <what changed> (<ref>)`.
- No prose blocks, no multi-line entries. Existing verbose lines are
  rewritten to this style in place (no information lost).
- **Superseded line (the log's `deleted_at`, added 2026-09-05):** a reversed
  decision is not deleted or left bare. Strike it IN PLACE and append the new
  decision at the bottom:

  ```markdown
  ~~2026-09-04 db: old decision text~~ <!-- SUPERSEDED 2026-09-05 -->
  ```

  Both are required: the strike is for the reader (this log is scanned
  top-down; an uncorrected stale line gets acted on before the reader
  reaches the fix), the appended line is the chronology. Text is never
  removed. **Only strike a line whose WHOLE content is dead** — if just one
  clause went stale, append a correction and leave the line unstruck.
  Striking a mostly-true line hides live information (learned 2026-09-05: a
  line was struck whole over one stale trailing clause and had to be
  reverted).

- **Roll-off — `STATUS.md` ≤ ~150 lines soft, ~250 hard (added 2026-06-30,
  threshold added 2026-09-20).** A status log grows linearly forever, so
  unlike `PLAN.md` it is never split — it is rolled off. Past the soft line,
  move the oldest SETTLED lines (an era whose work is already archived) to
  `_archive/status.<range>.md` and leave a one-line pointer banner at the top
  of the living log. Past the hard line, roll off before appending anything
  new.
- **What stays live:** the current active cycle in full, plus any older line
  still load-bearing — an open question, an unreverted decision, a caveat
  later lines depend on. **Roll off whole eras, never a partial one**, and
  never split a superseded pair (§4): a struck line and the line that
  replaced it move together or not at all, or the archive shows a reversal
  with no correction.
- This is a MOVE — never drop lines. Write the destination first, read it
  back, then cut (§2).

## 5. Living-doc banners

`PLAN.md` (and any split sibling) starts with:

```markdown
> Completed items live in `_archive/` (cold storage — do not read unless
> investigating history). Split detail, if any, is linked from stubs below;
> a stub's state is the truth if it and the detail disagree.
```

`STATUS.md` starts with:

```markdown
> Completed items live in `_archive/` (cold storage — do not read unless
> investigating history). This doc holds the active + planned log only.
```

A split sibling (`TASKS.md`, `<unit>.plan.md`) starts with:

```markdown
> Split from `PLAN.md` (rules/docs.md §1). The PLAN.md stub is the truth if
> the two disagree; update both in the same edit.
```

## 6. `01.rules.md` — the owner's doc

- `01.rules.md` is where the PROJECT OWNER describes project rules in their
  own words. **Agents READ it; agents NEVER write it** — not to fix a typo,
  not to "sync" it, not to add a section. Any change is the owner's.
- `CLAUDE.md` stays the normative agent contract. Where the two overlap,
  `CLAUDE.md` CITES `01.rules.md` rather than restating the text — one copy
  of any rule sentence, never two.
- If `01.rules.md` and `CLAUDE.md` conflict: STOP and ask the owner; do not
  resolve it by editing either file.
