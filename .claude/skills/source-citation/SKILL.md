---
name: source-citation
description: Shared citation contract between a research writer, a document writer, and a reviewer — source-ID format, where the source table lives, and how unverifiable or conflicting claims are marked. Use whenever emitting or checking a factual claim that needs a traceable source.
---

# Source Citation

## ID format

`[S-<TAG>-<n>]` — `<TAG>` is the workstream/task tag from the dispatching prompt (e.g.
`WS3`); `<n>` is sequential starting at 1 within that tag. IDs are never reused or
renumbered after emission, even if the row they cite gets deleted.

## Where the table lives

The final "Sources" section of the research output file named in the task, one row per ID:

```
[S-<TAG>-<n>] <title> | <URL> | published: YYYY-MM-DD or edition | accessed: YYYY-MM-DD | type: <type>
```

`<type>` is a short enum such as `official | posting | aggregator | blog | gov | list |
paper | news | anecdotal` — the dispatching prompt may extend or narrow this list.

## In generated documents (e.g. LaTeX)

Every factual sentence carries a same-line comment pointing back to its source ID(s):

```latex
% src: S-WS3-12
```

Multiple sources: comma-separate the IDs in one comment. No brackets inside the comment.

## What needs a citation

Any number, date, named person/program/policy, quoted requirement, ranking, or existence
claim. Connective prose and the writer's own recommendations do not — mark those
`inference` (research files) instead.

## Unverifiable claims — never silently drop

- In a research file: tag `[UNVERIFIED]`, set `verification: unverifiable` on that row, and
  list it under `open_questions:`.
- In a generated document: write `\todo{미확인: ...}` in place of the claim — never a bare
  unsourced sentence.

## Conflicting sources — never silently pick one

Two credible sources disagreeing is a FINDING, not a problem to resolve by taste. Picking
the one you like and moving on destroys the signal that the claim is contested.

- In a research file: record both IDs on the same row and tag it `[CONFLICT]`:
  `{claim per A} [S-WS3-8]; contradicted by {claim per B} [S-WS3-9] [CONFLICT]`.
  Set `verification: partial`, and list the row under `open_questions:`.
- Exception — the source hierarchy settles it outright: a first-party page beats an
  aggregator restating it. Cite the first-party source, keep the loser's ID on the row,
  and no `[CONFLICT]` tag.
- If only the DATE differs (the same fact, restated later), that is recency, not conflict:
  cite the newer and drop the older.
- In a generated document: `\todo{출처 상충: ...}` naming both IDs. Never present one side
  as settled.

## Reviewer check

Every `% src:` ID in a generated document must resolve to a row in a Sources table under
the research directory named in the task. Every `[S-...]` ID inside a research file must
resolve to its own Sources section. Flag any ID that does not resolve, and any factual
sentence with no `% src:` comment at all. Flag a `[CONFLICT]` row that is missing from
`open_questions:`, and any claim a document states flatly that its research file marked
`[CONFLICT]`.
