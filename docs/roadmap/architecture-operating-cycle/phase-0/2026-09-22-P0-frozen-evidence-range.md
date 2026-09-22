# Phase 0 — frozen retrospective evidence range

```text
STATUS:    FROZEN 2026-09-22 under owner-authorized Phase 0
ROLE:      coordination input for the open cycle stage. Not a plan, not a contract,
           not a status tracker, not a second authority.
OWNER:     coordination workspace (meta/phase0)
AUTHORITY: docs/operations/architecture-cycle.md is the sole live meta-state authority
```

Both architecture reviewers receive **exactly** this range. Neither may extend, narrow or
re-derive it independently; a range change is a coordination decision, recorded here.

## Exact range

```text
base  f8411f7f0dc8cd0bb8e05683259d7c2aa6a9fdbb  2026-09-08
      "P22 shipped: hosted acceptance closeout, archive plan, P23 next"
end   b5f75e7ecba5149ed03a26237402ba5a41266372  2026-09-22
      "P23.16 — whole-product integration verification (+ TD-3 / #35) (#73)"
span  f8411f7..b5f75e7 — 432 commits, 36 merge commits
```

## Included PR range

**45 merged PRs:** #1–#5, #9, #11, #13, #17–#25, #27, #30, #45–#51, #54–#71, #73.

26 landed as PR merge commits (`Merge pull request #N`); 19 landed squash-style with `(#N)` in
the subject. PR numbering is project-wide, so gaps are expected.

## Selection rationale

- **P23 is the range.** It is the phase the owner closed on 2026-09-22, so it supplies the
  retrospective evidence set.
- **Base = the P22 close.** That commit is P23's declared dependency boundary ("P22 complete,
  including hosted cold-visitor acceptance") and literally hands off to P23 ("P23 next"). It is a
  single unambiguous boundary rather than an inferred slice start.
- **45 merged PRs** sits inside the canonical plan's 30–60 meaningful-PR window, and the window is
  coherent — one product phase — rather than an arbitrary PR count.
- **End = PR #73**, the P23.16 gate and closeout land. It excludes PR #74 by construction.
- History is inspected as it actually operated. Nothing in the range was cleaned, squashed or
  reordered to make the retrospective tidier.

## Explicitly outside evidence scope

- **PR #74 (`877a7f0`)** — the P23B roadmap wiring. Outside the range; P23B proposals are future
  work, never retrospective evidence.
- **P26 research and planning artifacts** — future-phase planning.
- **P24 / P25 planning proposals that landed inside the range** (the P24 reconciliation PRs #1–#5
  and later planning merges). They are proposals for future phases, not landed convention; treat
  them as non-evidence unless a change there describes behaviour that actually landed.
- **This file and the phase-0 workspace index** — coordination scaffolding, not evidence.

## Historical contracts used for comparison

Compare every candidate against the contract **authoritative at the time of the occurrence**, not
against today's text, retrieved as of the commit under review (`git show <commit>:<path>`):

- `docs/reference/architecture.md`
- `docs/reference/north-star.md`
- `docs/reference/components/*.md` — assets · camera-tour · persistence · placement · scene-codec ·
  scene-content · shell · theme
- `docs/reference/design-system/editor-shell-and-visual-system.md` (with its ratifications annex) —
  the durable shell contract, established by P23.14 mid-range
- `AGENTS.md` hard rules
- `apps/editor/tests/README.md` — the test contract and lane semantics

These contracts were themselves revised **inside** the range (notably the #59 docs restructure and
the P23.14 shell-contract promotion), so the applicable authority changes across the window and must
be resolved per candidate. This is what separates newly formed precedent from a rule that was
written and not followed.

## Coverage and known limitations

- **Merged-PR granularity.** 432 commits across 45 PRs; intermediate branch commits inside a PR are
  reviewed only as part of that PR's diff, not individually.
- **19 of 45 PRs landed squash-style**, collapsing per-slice chronology. PR review discussion is not
  in Git and is consulted only if owner adjudication needs it.
- **The window is temporal, not topical.** Parallel-phase work (P24 reconciliation, later
  P26-adjacent docs) falls inside it and is excluded per the scope rule above.
- **Pre-range P23 research is excluded.** P23 research and proposal commits (for example `82bb74d`
  "P23 research") predate the base. They are proposals, not landed convention.
- **P23.15 landed by rebase under an owner decision**, so part of its history is reachable through
  the pushed `closed/p23.15` tag rather than a pre-rebase ancestry; the range endpoints are `main`
  commits and the rebased work is on `main`.
- **Planning documents are not evidence.** The range contains plans, reconciliations and proposals.
  Only landed behaviour and the contracts as they stood count.
- **The mechanical control pass has been run** (coordination workspace, 2026-09-22) and is written
  to `./mechanical-control-pass.md`, kept separate from the structural-workflow diagnostic. It
  measured three structural sets at exactly this range's two endpoints and classified nothing; its
  "unchanged" results are two-endpoint readings, not whole-range histories. Candidates and
  classification remain the reviews' and the owner's, and the pass was not used to narrow the range
  or to pre-empt either review.

## Method ownership

The candidate form, the A/B/C/D classification, adjudication and the workflow lane's decision
sequence stay owned by
[`../../architecture-operating-cycle-plan.md`](../../architecture-operating-cycle-plan.md) §8 and are
deliberately not restated here. Reviewers generate candidates only and never ratify architecture.
