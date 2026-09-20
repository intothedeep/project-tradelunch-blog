---
name: review-book
description: Verification-only pass over a chapter that already exists — build check, acceptance-criteria check, review artifact. Does not fix anything; hands the classification back to the caller. Invoke as "/review-book <target>".
---

# Review Book

Orchestration for verification alone, for when the chapter content already
exists and only needs checking. Runs in the MAIN SESSION only, for the same
reason as `write-book`: subagents lack the `Agent` tool and cannot dispatch,
so orchestration cannot live inside an agent body.

Reference skill used by the dispatched agent (do not restate its content
here): `source-citation`.

## Steps

1. **Identify target.** Resolve the target chapter (`book/chapters/*.tex`) and
   its source research file(s) under `book/research/`.
2. **Build check.** Run `latexmk -xelatex main.tex` from `book/`. Record exit
   code and any "undefined references" / "multiply defined labels" warnings.
3. **Pre-screen.** Pull the AC IDs relevant to this target from
   `book/research/PLAN.md` §4 (`AC-R*` for research files, `AC-W*`
   for chapters) — cite IDs only, do not copy the criteria text; this list
   goes into the `reviewer` dispatch prompt in step 4.
4. **Review** — dispatch `reviewer` with the AC ID list from step 3.
   It checks `% src:` resolution per `source-citation`, runs each AC, and
   classifies every ISSUE as *implementation issue* (routes to
   `sonnet-writer`) or *reasoning issue* (routes to `researcher` /
   `data-analyst`).
5. **Artifact.** `reviewer` writes `book/reviews/<target>.md` (its `Write`
   access is scoped to exactly this path): PASS/ISSUE per AC ID, plus the
   implementation-vs-reasoning classification for each ISSUE.
6. **Report.** Return the artifact's summary to the caller.

## Boundary

This skill fixes nothing. It hands the PASS/ISSUE + classification back to
whoever invoked it — routing a fix (e.g. into `write-book`'s step 7) is the
caller's decision, not this skill's.
