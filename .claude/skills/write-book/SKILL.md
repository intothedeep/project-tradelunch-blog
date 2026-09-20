---
name: write-book
description: End-to-end chapter pipeline — scope, research, analysis, LaTeX implementation, build, review, and bounded fix-reroute. Use when a book chapter has missing/\todo{} content to fill from sourced research. Invoke as "/write-book <chapter target>".
---

# Write Book

Orchestration for a full chapter pass. Runs in the MAIN SESSION only: every
subagent below lacks the `Agent` tool, so a subagent cannot dispatch another
agent — a skill is the only invocable, repeatable home for this procedure.

Reference skills used by the dispatched agents (do not restate their content
here): `research-methodology`, `source-citation`.

## Steps

1. **Scope.** Read the chapter's requirements (`book/research/PLAN.md`
   §3 for that chapter) and the current `.tex` file — open it with the **Read**
   tool, never `cat` (`CLAUDE.md`, "Reading files").
   Identify what is missing: `\todo{}` slots, unfilled sections.
2. **Research** — dispatch `researcher`. Output: a research artifact
   under `book/research/`. Skip this step if the needed research already
   exists there.
3. **Analysis** — dispatch `data-analyst`. Output: an analysis memo
   (e.g. `book/research/analysis-memo.md`) deciding which tables go in and
   fixing which sources back each claim. Skip if not needed for this target.
4. **Implement** — dispatch `sonnet-writer`. Output:
   `book/chapters/<n>-<slug>.tex`. The writer edits the existing chapter IN
   PLACE — the diff must show additions only (PLAN.md AC-W12).
5. **Build.** Run `latexmk -xelatex main.tex` from `book/`. Confirm exit 0.
   This is a gate, not the verification — `reviewer` owns that (step 6).
6. **Review** — dispatch `reviewer`. Output:
   `book/reviews/<target>.md` (PASS/ISSUE per AC, per `source-citation`
   check). **Never skip this step.**
7. **Route on outcome.**
   - PASS → done, report to the caller.
   - ISSUE → classify each: *implementation issue* (wrong LaTeX, missing
     `% src:`, broken build) → back to step 4 (`sonnet-writer`); *reasoning
     issue* (unsupported claim, wrong source, bad table design) → back to
     step 2 or 3 (`researcher` / `data-analyst`). After any fix, re-enter at
     step 5 (build).

## Termination bound (mandatory)

At most **2** fix-and-re-review iterations of step 7. If an iteration resolves
NO ISSUE, STOP and report to the owner instead of looping. This is the only
unbounded loop in the harness, and this bound is why the workflow lives in a
skill rather than as prose in an agent body.
