# DD-2-12 writer fixes (2026-10-28)

- Source: `dd.review.md` (not edited). Writer-route findings only.
- Posts: `apps/blog_agent/posts/projects/utrgv/ddpm-from-scratch/NN-*/`. `x_*` folders untouched.
- Line count = body lines by the C13 awk command in `dd.plan.md`, after the fix, against the limit.
- Checks after the edits: redaction grep 0, Korean 0, em dash 0, semicolon 0 (all posts, `figures.md` included).

| ID | What changed | File | Lines after |
| --- | --- | --- | --- |
| 1 | 18 list lines became 6 one-line W2 lines. grep: 6 one-line, 0 list | `04-*/04-time-inside-the-unet.md` | 53 / 83 |
| 4 | Mission and Vision of "Near t and far t" re-cut, all sentences 15 words or fewer. Numbers 0.076 and 0.713 unchanged | `04-*/04-time-inside-the-unet.md` | 53 / 83 |
| 5 | Jump variance now β′ in 07: formula row 3, mean formula, value row, name table, heading. Code identifier `beta` kept. 09 already used β′ | `07-*/07-sampler-250-calls.md` | 105 / 109 |
| 6 | RS7 label line only: `hold1k`, `attn32`, `drop2late`, `w64h4` and the line colors glossed. Caption, bullets and the w64h4 question left for the owner | `10-*/10-experiments-starter-to-final.md` | 119 / 120 |
| 7 | RS3 caption "six steps" to "nine boxes". Label line glosses base, lvl4, attn8, attn16, tdim256, w96, rb2, floor, sanity, SD3h, t12h, FID@1k, p, δ, m, t, yellow boxes | `00-*/00-overview.md` | 74 / 95 |
| 8 | RS6 label line: black = B3 shared first 6 h, orange = T (constant learning rate, EMA weights), blue = O (one-cycle, raw weights), solid seed 0, dashed seed 1. Read from the source page "Memorization signal" legend and CSS colors | `10-*/10-experiments-starter-to-final.md` | 119 / 120 |
| 13 | Loss sentence and code block moved after the U-Net figure U01, before its W2 line. The block was already after H05 in its own section, so it moved to the U01 section | `01-*/01-why-diffusion-why-unet.md` | 48 / 64 |
| 14 | Removed the "Step numbers inside the drawing" sentence at 3 places | `05-*/05-attention-what-it-adds.md` | 67 / 104 |
| 16 | Added "The footer's Attention page is the full-flow section of post 5." to the H47 note line. `figures.md` already said so | `06-*/06-query-key-value-and-heads.md` | 83 / 110 |
| 17 | R10a note now says the PNG label reads "C3b: C with 2 residual blocks, base width 56" | `11-*/figures.md` | not a body line |
| 18 | Rows for 0.0121, 0.9766 and μ +1.254 now cite `dd_schedule.json` rows t = 501, 497 and `sampler_jump.beta_prime`, plus the arithmetic. ε̂ and x̂0 rows kept (no data file, drawn noise) | `07-*/figures.md` | not a body line |
| 19 | "may keep scores steady", plus one reason sentence | `05-*/05-attention-what-it-adds.md` | 67 / 104 |
| 20 | Caption first sentences cut to 14 and 13 words (03 caption, 07 caption) | `03-*/03-inside-the-unet.md`, `07-*/07-sampler-250-calls.md` | 77 / 96, 105 / 109 |
| 23 | SLURM written out | `00-*/00-overview.md` | 74 / 95 |
| 24 | FID@5k phrasing in 00 and 10 unified to "Fréchet Inception Distance on 5,000 samples (FID@5k)". 00 "base network" to "starter network". 10 "holdout" to "held-out" (matches 08) | `00-*`, `10-*` | 74, 119 |
| 25 | `figures.md` RS5 note: 43.9 and 20.9 are 3-seed means, RI3 21.16 is seed 0. 08 label line adds "3-seed means" | `08-*/figures.md`, `08-*/08-evaluation-two-errors-and-fid.md` | 102 / 129 |
| 26 | RI1 label line: s0, s1, B arms, val_log, colors, line styles. H03 label line: tdim | `10-*/10-experiments-starter-to-final.md` | 119 / 120 |
| 30 | C2 to C9 glossed one by one, copied from 11 | `08-*/08-evaluation-two-errors-and-fid.md` | 102 / 129 |

## Skipped

| ID | Route | Reason |
| --- | --- | --- |
| 2, 9, 10, 11, 21, 22, 27, 28, 29, 12, 15, 3 | main, owner or developer | Not writer edits. 12 waits for the #138 reading. 3 waits for Q-DD12 |

## Notes

- RS7 label line gloss includes `w64h4` because the figure shows it. Whether to keep it in the figure stays an owner decision (list item 4).
- RS6 color mapping (blue = O, orange = T) comes from `a03_results_tips.html` CSS (`.go` = `--s-c` blue, `.gt` = `--s-base` orange) and fits the gap values (O 0.0025, T 0.00227). Please check once by eye.
- 01 finding 13: the code was already below H05. It now sits below U01 as the finding asks.

## Round 2: owner decisions 4, 6, 7 (#142), 2026-10-29

| ID | What changed | File | Lines after |
| --- | --- | --- | --- |
| 12 | First person removed: 00 "I do not count it", "I changed only the network", "a rule that I wrote", "I do not call it an effect". `grep -nwE "I\|I'm\|I've\|me"` = 0 in all 12 post bodies. "my runs" and "my network" kept. The `I` in 09 `figures.md` is the identity matrix | `00-*/00-overview.md` | 74 / 95 |
| 22 | `desc` of 00, 01, 02, 03, 04, 05, 07, 08, 09 split into sentences of 15 words or fewer. Same meaning. 06, 10, 11 already passed | those 9 posts | 00 74, 01 48, 02 97, 03 77, 04 53, 05 67, 07 105, 08 102, 09 75 |
| 4 | Already fixed in round 1 (sentence 15 words or fewer) | `04-*` | 53 / 83 |
| 6 (RS7) | One body line added: the 12-hour run named w64h4 is outside the 10,000,000-parameter cap, kept for the record only. Verdict lines untouched | `10-*/10-experiments-starter-to-final.md` | 120 / 120 |

Checks: redaction grep 0, 15-word check shows only the old 01 line 77 ("Why" label counted), C13 counts 00 74, 01 48, 02 97, 03 77, 04 53, 05 67, 06 83, 07 105, 08 102, 09 75, 10 120, 11 62 (all within limit).
