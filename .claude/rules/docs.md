# Documentation Lifecycle Rule

How the three living docs stay small, and how completed work is archived
without bloating context. This rule is portable across projects.

## 1. Three living docs (root)

Exactly three, no per-feature variants:

- `00.plan.md` — product intent, roadmap, architecture decisions.
- `00.tasks.md` — atomic task breakdown per phase.
- `01.status.md` — sequential progress log.

These hold **active work only**. Completed work moves to the archive.

## 2. Archiving completed work

When a phase/feature is fully `DONE` / `SHIPPED` / `SUPERSEDED`:

1. Cut its full detail from the living doc.
2. Paste it into an archive file under `_docs/archive/`.
3. In the living doc, leave only a **stub**: title + status + a one-line
   summary + a link to the archive file.

Stub shape:

```markdown
### Phase A — Deploy (Vercel + Supabase) — DONE (2026-06-26)
> One-line summary of what shipped. <!-- ARCHIVE: history-only -->
> Detail: [_docs/archive/plan.phase-A.md](./_docs/archive/plan.phase-A.md)
```

Archive file naming: `<doc>.<phase-slug>.md`
(e.g. `plan.phase-A.md`, `tasks.phase-D.md`).

`_docs/` is gitignored (local-only archive) — the archive is cold storage on
disk, not committed. The living docs (with stubs) are the committed truth.

## 3. Partially-done features

- Keep the feature title in the active doc.
- Under it, keep **only the not-done tasks**.
- Move completed sub-tasks to that feature's archive file.
- **Never archive a feature while any of its tasks is still open.**

## 4. Archive = cold storage (READ GUARD)

This is the part that keeps context small. Treat `_docs/archive/*` as
history-only. **Do not read it by default.**

Open an archive file ONLY when:

- (a) the user explicitly asks about a past decision or history, OR
- (b) the active stub is insufficient and a superseded detail is genuinely
  needed for the current task.

Otherwise the one-line stub in the living doc is considered sufficient — do
not follow the link.

Enforcement (three layers):

1. Every archive link carries an inline `<!-- ARCHIVE: history-only -->`
   guard comment.
2. Each living doc starts with a one-line banner (see §6).
3. This rule file, which overrides inferred behavior.

## 5. `01.status.md` line style

- One line per update, newest at the bottom, append-only.
- Each line must be short, concrete, and informative — drop non-critical
  words (filler, hedging, redundant context).
- Format: `<date> <area>: <what changed> (<commit/ref>)`
- No prose blocks, no multi-line entries.
- The status log is NOT archived; it stays whole but stays terse. Existing
  verbose lines are rewritten to this style in place (no information lost).

## 6. Living-doc banner

Each of the three docs starts with one line directly under its title:

```markdown
> Completed items live in `_docs/archive/` (cold storage — do not read unless
> investigating history). This doc holds active + planned work only.
```

## 7. Soft-delete safety

Per the repo "rm -rf" rule, archiving is a **move**, not a delete: content is
relocated to `_docs/archive/`, never destroyed. If unsure whether something is
truly done, leave it in the living doc.
