# P23B measurement-only step — action containment and post-release re-capture

```text
STATUS:  CORRECTION PASS 1 (2026-09-25). The slice ranking in revision 1 is
         WITHDRAWN — it rested on attributing the 85–97 ms `restore-mesh-install`
         to the history commit's restore, and that attribution is refuted below
         by a deterministic test. No optimization slice is named by this record
         until a re-capture on a clean commit is made.
ROLE:    DEV-only, advisory measurement of where an accepted action's time goes,
         run before any P23B.6/P23B.7 optimization per the phase README's
         owner-authorized routing amendment (2026-09-25).
NOT:     a budget, a target, a regression gate, or a baseline. `g3-baseline.json`
         is neither read nor written here (`bench:record` remains its only
         writer); `BUDGETS` / `ENFORCED_BUDGET_METRICS` are unchanged.
```

## 0. What correction pass 1 changed

Review found that revision 1's headline ranking did not survive contact with the
code. Each finding and its disposition:

```text
F1  the commit re-installs live state; that is the leading cost, not rendering
    → the cause is confirmed in source (`HistoryController.commitLayout` →
      `host.replace` → `restoreLayoutPreviewSnapshot`), the record no longer
      routes it to P23B.6, and the cost is now split into three disjoint marks
      (§3). The COST is not yet re-priced: see §5.
F2  the 85 ms mesh install should have been nearly free; hit, miss or two
    pooled occurrences?
    → ANSWERED, and it refutes revision 1's reading: it is not a cache miss on
      the commit path (§4). The record no longer claims one.
F3  the `self` columns compared different populations
    → fixed: `self` is reported only when every occurrence could be priced, and
      its occurrence count is printed beside `total`'s (§2).
F4  `n` was occurrences, not actions, so a repeat was pooled silently
    → fixed: `total.count` is documented as occurrences, `actionsPresent` and
      `maxPerAction` are reported separately (§2), and a repeat is now visible.
F5  rule 2 was broken by the "~490 ms unnamed" subtraction
    → removed. The claim it supported (the curved wall-authoring release is
      largely unnamed) survives as a qualitative statement, without a number.
F6  no durable source for the numbers
    → accepted, and NOT yet satisfied: the capture ran on a dirty tree and the
      code has since changed, so revision 1's JSON cannot be re-derived from any
      commit. Nothing in this revision should be re-derived from that capture.
F7  smaller items — the "same work one tick later" claim is dropped (nothing
    showed it); the P23B.8 line is reworded to the actual argument (main-thread,
    reactive, Three-bound work, no cross-thread split today); the all-curved-40
    abort keeps its coverage limit and gains the perturbation note in §1.
```

## 1. Provenance and coverage

```text
capture      revision 1, 2026-09-25, on a DIRTY working tree at d9a56a2b
             (the measurement code was uncommitted; it landed as 9a0e3e35 and
             was then corrected as 570179ff). No artifact of that capture is
             committed, so its numbers are not reproducible and are NOT used
             for any claim in this revision.
machine      arm64 / Apple M2 / 8 logical CPUs / 16 GB RAM · OS 15.7.2
browser      Chrome 130 (Freebuff), DPR 1, viewport 1920x1200
population   warm-up excluded per path, accepted outcomes only — the interaction
             report's own rule, applied to containment
protocol     the committed `drive.ts` scripted capture, unchanged

owner-40-curved-v1        CAPTURED      selection 20, bend 20, plan-drag 20,
                                        wall-authoring 23, pan-zoom 52 actions
p23b-40-wall-straight-v1  CAPTURED      selection 20, plan-drag 20,
                                        wall-authoring 23, pan-zoom 52
p23b-40-wall-all-curved-v1 ABORTED      the driver's own guard: "action 94 did
                                        not complete within 6000 ms". The guard
                                        was NOT raised: it is part of the
                                        protocol, and comparability with P23B.0
                                        depends on it.
```

PERTURBATION NOTE (F7): the aborted action is a wall-authoring click on the
all-curved fixture, where the P23B.0 baseline records a 1,984.8 ms p50 for that
path before the abort. The capture ran with the harness panel open and the DEV
measurement switch on, which is the protocol's own configuration, but a single
6 s action is not evidence about the path's distribution and is recorded only as
a coverage limit.

## 2. What the containment model measures (corrected)

`apps/editor/src/lib/bench/p23b-containment.ts` binds each `p2311:` component
mark to the action **and outcome** whose own boundary interval encloses it, and
reports a tree per action. Rules, as corrected:

1. **Containment by interval, not proximity.**
2. **Never summed.** Every figure is one action's tree or a distribution over a
   group. `total.count` counts OCCURRENCES; `actionsPresent` and `maxPerAction`
   are reported beside it, so a mark that fires twice inside one action is
   visible rather than pooled into a single p50 (F4).
3. **Exclusive time only where every occurrence could be priced.** `self` is
   `null` unless all of a label's occurrences in the group had disjoint, fully
   contained children; otherwise `selfWithheld` states how many could not be
   priced. `self` and `total` therefore always describe the same population (F3).
4. **Three visible remainders.** `unbound` = inside the action, outside all of
   its boundaries. `unattributed` = outside every action, pooled by name.
   `ambiguous` = an attachment whose two intervals are IDENTICAL, where which
   encloses which is not decidable from timestamps. The third was added by this
   pass (F2): revision 1 silently decided such a pair, and that is how a nesting
   could be reported that the code's own call order cannot produce.

## 3. The commit cost, now split (mechanism; numbers pending)

Source, confirmed: `PlanWorkspace.commitLayoutTransaction` captures the snapshot
and hands it to the history boundary; `HistoryController.commitLayout` compares
it (`matches`) and then calls `host.replace(next)`, which runs
`restoreLayoutPreviewSnapshot`. So one accepted release contains three
separable costs, and they are now three disjoint marks:

```text
commit-capture   captureLayoutPreviewSnapshot(layoutPreview)   (PlanWorkspace)
commit-matches   host.matches(before, next)                    (history controller)
commit-replace   host.replace(next) → restoreLayoutPreviewSnapshot
```

`gesture-commit` now has disjoint children, so its own exclusive time becomes
computable — item 5 of revision 1's own ranking, and F1's precondition.

## 4. The review's question, answered: the restore does NOT miss the mesh cache

Two deterministic tests (no browser, no timing) settle F2, and they refute
revision 1:

```text
`layout-transient-preview.test.ts` — measured:
  a capture holds `state.geometry` BY REFERENCE, so consecutive captures hand the
    restore one and the same geometry object;
  an isolated `restoreLayoutPreviewSnapshot(live snapshot)` re-derives NOTHING —
    the first restore already hits the wall-mesh cache;
  the production commit step, verbatim (capture the live state, hand it to
    `store.commitLayoutTransaction`), re-derives NOTHING either;
  a restore after a fresh capture of the same live geometry also re-derives
    nothing.
```

So "the commit's restore rebuilds all 40 wall meshes" is false in process, and
the 85–97 ms `restore-mesh-install` of revision 1 is unexplained by it. The
browser record's shape for that pair (a `mesh-prebuild` of 85–89 ms carrying 80
`standalone-wall-build` marks, with `restore-mesh-install` nested *inside* it) is
also internally inconsistent with the call order, which is exactly the ambiguity
rule 4 now reports instead of deciding. **What is still open:** which restore the
browser's full rebuild actually belongs to, and why it happens in the app while
the same step reuses the cache in process. The honest next step is to read the
RAW intervals of that pair (start/end, not nested labels) in a re-capture, with
§1's provenance satisfied.

## 5. What still holds from the measurement

```text
· containment by interval, with `unbound` and `unattributed` buckets that made
  the between-action undo/re-seed restores visible as fixture cost rather than
  action cost (they are the restore family in `unattributed`);
· `self: null` with a stated reason wherever contained marks overlap, instead of
  a subtracted guess;
· UN-1 re-derived by symbol: the planner, `deriveInstallBundle` and the
  preview-install commit all sit INSIDE `plan-apply`; P23B.1's line anchors are
  stale and were not used;
· the preflight ceiling corroborated against the owner's own numbers: the
  whole-document gate measures 1.6 ms (straight control) and 7.0 ms (owner-40
  curved) total per accepted move, self 1.5 and 3.6–3.9 ms — consistent with the
  recorded 1.7 / 7.8 / 9.9 ms per move, now attached to an action and an outcome
  instead of pooled per session;
· no production telemetry (the marks ride the shipped DEV + `__P2311_PERF__`
  gate) and no baseline write.
```

Every other figure in revision 1's boundary and node tables came from the
superseded capture with superseded aggregation semantics. They are deliberately
NOT reproduced here (F5, F6): a number that cannot be re-derived from a commit,
and that was computed by a summary that mixed populations, does not belong in a
record that other people rank work from.

## 6. Ranking — WITHDRAWN

```text
Revision 1 ranked P23B.6 first on "render-geometry build/install dominates".
That conclusion depended on the restore cost, which F1 relocated to the commit
path and F2 then failed to attribute at all. So:

  · no slice is named first by this record;
  · the routing question for the owner is unchanged in form, not answered:
    if the commit/history path is the leading cost, P23B.7 S6 (per-gesture
    preview-install/reactive work) or a bounded history-path fix owns it, and
    taking it before P23B.6 needs the sequence amended;
  · P23B.7's gesture-scoped topology gate remains NAMED and NOT FIRST on the one
    figure that survived review: single-digit ms per move against a release two
    orders larger;
  · P23B.8 has no measured demand, argued from the shape of the work
    (main-thread, reactive, Three-bound, no cross-thread split today) rather than
    from a threshold — and NOT from "no cost is large", which the pre-correction
    numbers contradicted;
  · P23B.6 is neither named first nor excluded. Its case has to be made on a
    re-captured record whose commit path is priced.
```

A re-rank needs, in order: a clean-commit capture (§1, F6), the raw intervals
read for the restore pair (§4), and `gesture-commit` exclusive time from the
split marks (§3).

## 7. Reproduction

```bash
npm run dev:editor            # DEV server on the working tree
open http://localhost:5173/dev/perf/p23b
# window >= ~1250 px wide (the shared view must fit the fixture's target box)
# "Run scripted capture" → then "Download measurement record JSON"
npm test -w @portfolio/editor -- tests/lib/bench/p23b-containment.test.ts \
  tests/lib/layout/p23b-measurement-marks-wiring.test.ts \
  tests/lib/editor/layout/layout-transient-preview.test.ts
```
