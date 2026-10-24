# T3.P02.S02 — hand-off: slice and Preview-entry optimization

**Slice:** T3.P02.S02 · **Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Review:** [implementation-review.md](./implementation-review.md) · **Record:**
[acceptance.md](./acceptance.md) (owns the evidence and the unrun rows)

```text
STATE:     implemented, reviewed (4 rounds), verified at the merged revision; owner acceptance PENDING;
           performance and unrun rows deferred by owner ruling (2026-10-24); not merged, no closeout
BRANCH:    t3/p02-s02-integrated-final-gate (PR open)
COMMITS:   44990fad implementation · 035965e8 Preview-chrome fix · 6df26f3e journey spec ·
           f6de016d warm Preview entry · plus the review-fix commit on top of f6de016d ·
           bf6b2e1f merge of origin/main 0b96c577 · the round-4 fix commit (branch HEAD, git log -1)
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
holds no Camera claim, writes no source, takes no input, and (round 4, F1) issues no WebGL draw
calls, which a browser journey counts.

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
| F10 starter, labelled S first entry in a fresh context | 67.7 ms | 113.0 ms |
| F10 starter, labelled S warm / repeat-use | 52.7 / 55.0 ms | 71.8 / 173.7 ms |
| F10 starter, labelled M first entry in a fresh context | 71.9 ms | 88.6 ms |
| F10 starter, labelled M warm / repeat-use | 44.0 / 46.7 ms | 54.8 / 57.4 ms |

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

## Review outcome, round 4

The owner's acceptance review raised F1–F5 on the merged tree; all are fixed in the round-4 fix commit (see the
[implementation review, round 4](./implementation-review.md#acceptance-review-round-4)). F1: the hidden warm
surface no longer ticks, requests frames or starts a run while inactive, now a browser zero-draw check. F2:
the Guide key scopes to the Guides column; the Presentation facts stay in the lens inspector (no host Card
seam; a deferred T1 seam). F3: five refusal contracts. F4: merged origin/main. F5: the F10 spec now seeds
its fixtures, and the recorded rows are relabelled as the starter workload.

## Verification at the merged revision (bf6b2e1f plus the round-4 fix commit)

```text
npm run check                       1825 files, 0 errors, 0 warnings
npm test                            185 files; 2403 passed, 2 failed of 2405 (5 s timeouts under load ~58);
                                    both pass in isolation: documentation references 25/25, P23B.11 36/36
npm run test:arch                   22 files, 178 tests passed
npm run test:heavy                  9 files, 125 tests passed
npm run build                       exit 0
check:project-model / check:camera-core / check:layout-core / check:api   exit 0
test:api (biskiq-t3, 5435/8789)    12 suites, 95 tests, 95 passed, 0 failed, 0 skipped; stack torn down
integrated journeys (chromium)      6 passed (49.2 s), against the documented preview on 127.0.0.1:4173
first-guide.test.ts / visitor-camera-director.test.ts   12 / 9 passed
preview-lifecycle.spec.ts           --list only (6 tests); not run, by owner request
```

The full record, with the DB target and the reasons for the two earlier API attempts, is the
[acceptance record](./acceptance.md#verification-record).

## Open items

1. **Owner acceptance** of the recorded evidence. Open: the owner re-reviews and records acceptance. The slice
   is not accepted here; because a gate row is deferred, it can only be accepted as `owner-override`.
   Closeout has not run; P02 is closable, not closed; P03/P04 are untouched.
2. **Performance:** deferred by the owner ruling of 2026-10-24 (acceptance record, Owner ruling, Scope A):
   the traced first frame, capture/bind completion, the absent M-workload F10 rows, the F13 re-measure at the
   final revision, the reference-machine run and H0 ruling, and the Stage initial-load delta.
3. **Unrun rows:** deferred by the same owner ruling (Scope B): the Preview-then-replacement probe, the dense
   20/50-View and 15/30-Stop fixtures, touch/coarse pointer, DOM reach without raycast, Experience paused
   editing, Ask Rule, the browser Save/download/reload journey, the partial shared-Camera row and the
   Travel/detour browser rows.
