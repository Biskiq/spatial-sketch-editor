# T3.P02.S02 — hand-off: slice and Preview-entry optimization

**Slice:** T3.P02.S02 · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Review:** [implementation-review.md](./implementation-review.md) · **Record:**
[acceptance.md](./acceptance.md) (owns the evidence and the unrun rows)

```text
STATE:     implemented, reviewed (3 rounds), verified; owner acceptance PENDING; not merged, no closeout
BRANCH:    t3/p02-s02-integrated-final-gate (PR open)
COMMITS:   44990fad implementation · 035965e8 Preview-chrome fix · 6df26f3e journey spec ·
           f6de016d warm Preview entry · plus the review-fix commit on top of f6de016d
CLAIMS:    only what the acceptance record states at its recorded revision, on this machine
```

## What the slice delivers

1. **First Guide.** One `experience-guide-create` planner creates the first Guide and its entry Stop
   from an existing Presentation, and `experience-capture-bind` accepts an optional `firstGuide`
   payload so a capture installs View + Presentation + Guide + Stop as one accepted result with one
   undo payload. Reuse is explicit: a Guide points at a Presentation, it never copies its Camera.
2. **Real Camera handover/return.** Preview entry/exit goes through the F3 Camera-output ticket
   protocol (`enterPreview` / `returnPreview` / `cancelPreview`), not through unmount. A refused
   return re-acquires the host's inspection claim; a stale return token can neither restore a pose
   nor clear a newer owner. The Stage keeps selection, task focus and history across the session.
3. **Bounded Round 2 expression.** Capture lives in the shared dock only; the Guide instrument is
   invoked from the dock above the Stage; the Presentations column keeps its hint and its distinct
   "Capture and rebind". No new host authority, no new shell API, no API route, no format change.
4. **Warm Preview entry.** Preview is built once and reused; see below.

## The optimization effort

**Target set for this work:** repeat entry ≤ 50 ms, cold entry ≤ 300 ms, to the first correctly
painted frame; the 300 ms repeat figure this slice inherited is a baseline, not the goal.

**What the press actually paid.** Each entry created the visitor surface from scratch: the lazy
chunk, the Threlte `<Canvas>` and its WebGL renderer, the scene graph, room/wall shells, materials
and first frame — although a Camera handoff only needs a *run* (a ticket, a return token and an
interpreter over an already-admitted scene).

**What was eliminated, not accelerated.** The surface is built once, when the Experience lens opens
while the editor still owns the Camera, and is hidden, `inert` and `on-demand` between sessions. An
entry then assigns the entry's read, mints the run epoch and reveals the takeover. A hidden surface
holds no Camera claim, writes no source, takes no input and requests no frames.

**What was deliberately not done.**

- *Keeping the surface mounted and active* — it would hold the visitor run while the Stage authors.
- *Rebuilding per entry from a cached chunk* — that is the cost being removed.
- *A second canvas path or a parallel navigation model* — the phase forbids both; Camera evaluation
  still supplies every pose and FOV.
- *Rebuilding the hidden scene on every accepted edit* — the read is frozen per entry, so authoring
  does not re-adapt a scene nobody is looking at; the next entry supplies the current read.
- *Pre-warming at admission* — measured to block the first dock interaction; the cost stays behind
  the explicit lens choice.

**Run identity is preserved.** The reused surface keys its runtime on the entry's Camera epoch, so a
new entry recreates the interpreter and resets the Camera director's aim; epoch 0 (the warm-up
state) can never be an active run, because activity is `preview !== null`, not the epoch.

**Measured (idle host, 10 runs per row, press → first rendering opportunity):**

| row | median | p95 |
| --- | --- | --- |
| F10 S first entry in a fresh context | 67.7 ms | 113.0 ms |
| F10 S warm / repeat-use | 52.7 / 55.0 ms | 71.8 / 173.7 ms |
| F10 M first entry in a fresh context | 71.9 ms | 88.6 ms |
| F10 M warm / repeat-use | 44.0 / 46.7 ms | 54.8 / 57.4 ms |

F13 (10 enter/exit cycles): entry heap 9.54 MiB → 11.71 MiB, post-GC growth 2.16 MiB (≤ 5 MiB
hard), dwell median 1 205.8 ms, exactly one hidden surface per cycle, realm unchanged.

**The floor is the harness, not the work.** The mark is taken at the second rendering opportunity
after the run starts, which is 33 ms at 60 Hz before any work is counted; a repeat entry therefore
cannot read below that. The remaining milliseconds are state flush, the interpreter start and, when
the entry's read differs from the built one (the F10 rows' own capture makes it so), re-adapting the
room and wall shells — not a rebuild.

**What is not claimed.** No traced first frame (the contract's hard row needs trace attribution and
the standing H0 ruling); capture/bind completion ≤ 100 ms is unmeasured; no reference-machine row
exists, so every number is pre-flight on this host. There is no pre-change press → frame row in the
harness, so the improvement is the current measurement plus the code fact, never a measured delta.

## Review outcome

Three independent read-only rounds. Rounds 1–2 fixed the orphan-Stop refusal, the duplicate Capture
control, `openPreview`'s catch scope, the authoring chrome mounted over the isolated run, and the
refused-return recovery. Round 3 (on the warm entry) found the one real defect: a source replacement
kept the warm surface — and the replaced project's scene, geometry and program — alive behind the
editor, and an in-flight warm-up could install the replaced snapshot's read. `activate` now drops the
surface with its source and `warmPreview` rechecks the session token and the snapshot after its
import; the lens effect warms the new source. Focus on return, one stale spec comment and one
overstated sentence in the record were also fixed.

Known residual, accepted rather than hidden: if a replacement lands during the warm-up's own import,
the new source is not warmed again until the next lens effect or press, so that one entry is a cold
mount. It is correct, just not warm; it needs no state machinery to keep the fast path fast.

## Verification at the review-fix revision

```text
npm run check            0 errors, 0 warnings
npm test                 185 files, 2 396 tests passed
npm run test:arch        22 files / 176 tests — passes; the documentation-references contract is
                         5 s-timeout sensitive and failed three runs while host load averaged 70,
                         then passed 56/56 (4.1 s) with a raised timeout and reports no broken links
npm run test:heavy       9 files, 125 tests passed
integrated journeys      5 passed
F10/F13                  not re-measured after the review fixes — owner request (2026-10-23)
```

## Open items

1. **Owner acceptance** of the recorded evidence; the slice is not accepted here and closeout has not
   run, so P02 is closable, not closed, and P03/P04 are untouched.
2. **Perf re-measure at the final revision** if the owner wants the record's rows to match the
   review-fix commit: one clean `preview-lifecycle` pass (~10 min) and the table above is refreshed
   from that single run. Two partial post-fix rows exist (S first entry 47.8 ms, S warm 44.7 ms) but
   are not evidence on their own.
3. **Dispositions** for the unrun rows in the acceptance record: the Preview-then-source-replacement
   probe, the traced first frame and capture/bind completion, dense discovery/orientation fixtures,
   touch/coarse pointer, DOM reach without raycast, Experience paused editing, Ask Rule, and a
   browser Save/download/reload journey.
