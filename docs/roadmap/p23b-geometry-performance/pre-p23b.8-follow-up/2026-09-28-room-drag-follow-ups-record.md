# 2026-09-28 — whole-Room drag follow-ups: a one-session M1 before/after (with the frame series), rotation wired on the owner's reversal, two deletions

Status: ADVISORY, DEV-only, one machine, one session of work. Working tree only — **not committed**. No
baseline and no ratchet is read or written. Every millisecond below is one occurrence or one arm's own
distribution; nothing here may be summed across arms, classes or releases.

This pass answers three follow-up requests on the whole-Room drag slice. All three are implemented; the
one item that had been routed to the owner (rotation) was answered by the owner as **A — reverse
P23.14 Decision 7 and wire the gesture**, and is recorded as such in §3.

---

## 1. The M1 protocol can take a before/after in ONE session, with no pre-change tree

**Why it needed a mechanism at all.** Every recorded M1 absolute is session-conditioned: the same code
re-measured in a later session moved by ×0.38–×1.03 with no code change. A before/after taken across two
sessions — or across two checkouts — therefore measures the machine. The comparison the plan asks for
(§P4 item 16) is a WITHIN-SESSION one, and the change under test is already in the tree, so the tree has
to be able to run the OLD path on demand.

**The arm.** `apps/editor/src/lib/editor/layout/p23b-m1-room-drag-arm.ts` is a DEV-only switch with two
readings, consulted once per pointermove by the viewport:

```
transient   the shipped path: one proposal per move, no planner call, no compile, no install
per-move    the PRE-CHANGE path, verbatim: restore the frozen baseline and run the canonical
            planner per move, installing every intermediate candidate
```

The gate is the same one every capture-side instrument uses (DEV build **and** `__P2311_PERF__`), so a
production build pays one boolean and runs the shipped path; the arm cannot reach a product build and
changes no acceptance decision either way — the release still re-derives from the release coordinate
against the frozen baseline and writes exactly one history entry.

**The protocol.** The driver interleaves the arms **per attempt** on the whole-Room class only, and
records the arm against the action the attempt RESOLVED to. Interleaving is the drift control: a machine
that warms up, throttles or is otherwise re-conditioned mid-run moves both arms. `summarizeM1Arms`
(the record builder) then splits the class's measured population by arm and takes every row over that
arm's OWN actions, reusing the class's own summarizers — `summarizeContainmentByPath` over the
containment trees filtered to the arm, and `p23bM1GestureFramesFor` over the arm's action indices — so
no row is re-derived by a second rule. The record carries, per arm: the keyed mark and boundary rows, the
proxy release row with coverage, the gesture-frame series and the long-frame row; plus a signed
before/after table (`deltaMs = transient − perMove`, so negative means faster). A row only one arm
reported leaves the other cell **null**, never a zero. The class's own rows beside the block span both
arms and are flagged `mixed`.

`--arms` on the CDP runner (`tests/lib/bench/p23b-m1-browser-runner.cli.ts`) selects
`__P23B_M1_RUN_ARMS__()` instead of `__P23B_M1_RUN__()`.

**The one product module that learns anything.** The viewport reads the arm and nothing else. The
product-module guard in `p23b-m1-record.test.ts` was deliberately narrowed from "the viewport contains no
M1 anything" to exactly that: one import, one call, and an explicit list of forbidden symbols (no
recorder, no sampler, no observer, no registry, no raw global read). That is the deliberate relaxation
this request required, and it is asserted rather than assumed.

### 1.1 The per-gesture accounting (one real gesture, both arms, DEV/Chrome)

Real viewport, real pointer events through the harness host, `owner-40-curved-v1` at the shared ladder
zoom (19.292586186549904 px/m), one grid step of travel, 4 pointermoves then the release:

| arm | moves | `room-unit-proposal` | `preview-compile` | `mesh-prebuild` | move phase ms | release |
|---|---|---|---|---|---|---|
| `transient` (after) | 4 | **4** | **0** | **0** | **40.2** | 1 compile + 1 preparation (175.9 ms) |
| `per-move` (before) | 4 | 0 | **4** | **5** | **1006.6** | 1 compile + 1 preparation (286.4 ms) |

### 1.2 THE FRAME SERIES — the full arm protocol, one session, no pre-change tree

This is the row the previous record listed as NOT established. It is now measured, and it is a real
frame series per arm rather than a per-gesture accounting.

**The run.** `2026-09-28-M1-arms-chrome-leg.json` (1.9 MB, same directory — the raw capture's per-action
`postRelease` label lists folded to counts by the same throwaway pruner the earlier legs used; every row
quoted here and every aggregate row is untouched): the protocol at
`--budget-ms 10000` on the headless Chrome-for-Testing leg, one harness tab forced through
`about:blank` → the URL, viewport 1500×1000 DPR 1, DEV build, commit `33d532f5` with the tree dirty
(the change under test is uncommitted, which is the point of the arm), Apple M2 / 16 GB / macOS 15.7.2.
19 class rows, **4,457 presented frames**; clock calibration residual **0.265 ms** (taken before and
after the run). The published source text is the tree the reader has.

**The population.** The whole-Room class (`p23b-m1:whole-room-move-bridge`) over the four committed
fixtures (both 40-Wall matrix cells, the owner payload, the connected curved grid), split by arm:
**40 accepted actions per arm** (10 per fixture), warm-up actions excluded per path, release coverage
**1 in both arms**. The arms are interleaved per attempt, so the two columns are one session's drift
apart, not two.

**The series.** `gestureFrames` — the `requestAnimationFrame` callback interval inside each measured
drag's own bracket (pointerdown → the action resolving), correlated with the product marks. It is a
PROXY (not presented-frame latency, not paint time, not GPU work), and it is arm-separable because the
builder filters the registry by the arm's action indices:

| arm | intervals | p50 | p95 | max | ≥ 50 ms | ≥ 100 ms |
|---|---|---|---|---|---|---|
| `transient` (shipped) | 246 | **17.2 ms** | 253.0 ms | 882.8 ms | **19.9 %** | 15.9 % |
| `per-move` (pre-change) | 245 | **166.2 ms** | 510.3 ms | 826.1 ms | **82.0 %** | 66.1 % |

Per fixture, the same series (p50 of the arm's drags): `p23b-40-wall-straight-v1` 17 vs 167 ms ·
`p23b-40-wall-all-curved-v1` **34 vs 357 ms** · `owner-40-curved-v1` 17 vs 192 ms ·
`connected-curved-grid-v1` 17 vs 68 ms. The two arms carry a similar long tail because the bracket
INCLUDES the release and the commit, which are the control and are unchanged; the p50 and the ≥50 ms
share are therefore the informative statistics, and both separate the arms cleanly on every fixture.

**What each arm paid per accepted action** (mark occurrences ÷ that arm's actions, pooled over the four
fixtures — the marks are the mechanism behind the series):

| mark | `transient` | `per-move` |
|---|---|---|
| `p2311:room-unit-proposal` | 4.00 (the new work) | absent |
| `p2311:preview-compile` | **1.00** | **5.00** |
| `p2311:mesh-prebuild` | **1.00** | **6.00** |
| `p2311:baseline-restore` | **1.00** | **6.00** |
| `p2311:curve-sampling` | 295 | 1,355 |

**The control.** The release row is unchanged by construction, and the measurement says so: release p50
per fixture 13.6 / 30.5 / 14.8 / 15.0 ms under `transient` against 13.7 / 27.0 / 14.5 / 14.3 ms under
`per-move`, coverage 1.0 in both. The arm changes what the pointermoves cost, never what commits.

### 1.3 What this run does NOT establish

- **One runtime.** This is the Chrome leg; the Electron leg of the arms run was not spent. The protocol
  is runtime-agnostic (`--arms` on the same runner) and the pair is what the M1 leg pair reports.
- **The long-frame row is class-scoped, not arm-scoped.** The builder is handed ONE long-animation-frame
  window per class and passes it into each arm row, so the arms' long-frame distributions are identical
  by construction (80 frames, p50 162.3 ms, 73 over 100 ms) and only their COVERAGE is arm-keyed
  (10 releases touched, per arm). Read that row as the class's. Making it arm-separable would need the
  observer to open a window per arm — a change to the capture, not to this comparison.
- **The presented-frame (compositor) side is class-level.** The runner's release→presented correlation
  is taken over the class's mixed population, as designed.
- **Not a baseline.** No budget, no threshold, no ratchet move, no `g3-baseline.json` read or write.

---

## 2. Two now-unused per-move signals deleted

The plan's own item 10 says: keep `drag.candidateValid`'s semantics **or delete its write sites
deliberately** — do not leave a flag that is written and never read as if it were a signal.

- **`LayoutRoomUnitDrag.candidateValid` is deleted** (declaration and doc, the pointer-down initialiser,
  the per-move reset, and both write sites in the viewport). It recorded a per-move planner verdict that
  no production renderer ever read, and a transient drag has no per-move planner call to consult. The
  release verdict is the planner result at the release coordinate and nothing else. The only surviving
  `candidateValid` in the repo is the unrelated snap-result field in `layout-snap.ts`.
- **The per-member group-bounds highlight is deleted** from `buildPlanInteractionProjection`. It read
  `interaction.roomUnitDrag.groupRoomIds` against the INSTALLED model, so under the transient contract it
  was anchored to the frozen baseline and stopped following the pointer — a stationary decoy. The moving
  unit is drawn by the gesture's own attempt (`withRoomUnitMoveIntent`), which rigidly transforms every
  member's outline.

Both are guarded, not merely removed: the gesture suite asserts the drag session carries no
`candidateValid` field and that no `group-move-bounds` bounds are drawn during a live group drag
(re-adding the block makes the count 2 and fails), while the transient suite remains the authority for
"every member Room is drawn, moved".

---

## 3. ROTATION: reversed and wired (owner ruling, 2026-09-28)

The deviation was that room-drag rotation was unwired. Two blockers were named in the previous record,
and the owner answered the question it raised: scope **A** — offer rotation on the wall-first Room unit,
reversing P23.14 Decision 7, with the release re-deriving. The locked decision's own reason was that a
canonical Room has no authored yaw, so "a rotation gesture has no honest result to commit"; the honest
result now exists, and it is the canonical planner's.

**What the gesture does, in one line.** A rotate drag of a selected wall-first Room rigidly rotates the
Room's whole boundary graph — its Junctions, its Walls' centerlines and spans, and the objects associated
with the moving set — about a pivot, and the release re-derives ONE canonical candidate at the release
ANGLE against the frozen baseline, exactly as the translate gesture re-derives the release DELTA.

- **Core (the committed result).** `planWallFirstRoomRotation(document, roomId, pivot, yaw)` — the same
  isolation policy, the same `roomUnitMoveCandidate`-style mapping (`rotateRoomUnitMoveCandidate`) and the
  same canonical gates as `planWallFirstRoomMove`, with `no_op` for a zero angle and the canonical
  rejections otherwise. `proposeWallFirstRoomUnitRotation` is its overlay partner: the candidate, sampled
  through the one canonical sampler.
- **Editor (preview and release).** `previewWallFirstRoomRotation` installs the planner's own document
  through the one existing install point (one bundle, one compile — the preview cannot describe a rotation
  the release would not commit). `transientRoomUnitRotation` returns the render-only attempt; the
  viewport's wall-first rotate branch draws it per pointermove and installs nothing, and its release runs
  ONE planner call at the release angle. Nothing about what commits changed for translation, and a
  rotation commits exactly what a translation does: one history entry, exact Undo.
- **Reachability (what was actually missing).** The arm and handle are now offered for a selected Room in
  EITHER document kind: the Room id falls back to the live selection when there is no legacy registry to
  consult (a wall-first document has no `floors`), and the handle is anchored to the COMPILED outline via
  `roomTopCenter`, so no legacy Room registry is needed. `rotationHandleScreenPoint` is exported so paint,
  the hover state and the hit test that starts the gesture resolve to one identity. Pointer-down still
  runs the gesture's own eligibility policy, so this is the same offer-then-hint behaviour the move
  gesture has — not a promise that every Room is rotatable.
- **What survives Decision 7** is pinned by the rewritten negative test
  (`tests/lib/editor/layout/layout-room-rotation.test.ts`, now 5 tests): a legacy line-format Room keeps
  its own authored-yaw arm and handle; a wall-first Room gets NO legacy vertex handles (the reversal adds
  a unit gesture, not legacy vertex editing); and no affordance is drawn without a wall-first context or a
  selection. The reversal is asserted, not implied.
- **A new parity gate for the rotation preview (P0.3b).** The P0.3 negative result rules out exactly one
  drawing rule — "the baseline's canonical points, rotated" — so rotation is drawn the other legitimate
  way: RESAMPLE the rotated centerline through the same sampler the release uses. The added differential in
  `p23b-room-unit-proposal-parity.test.ts` asserts the consequence over the committed fixtures: the drawn
  attempt IS the release planner's candidate **point for point**, and the attempt proposes exactly the
  Walls `plan.changedWallIds` reports. That is stronger than the translation path's equivalent, which
  needs the extra "never resampled" assertion beside it.
- **The one caveat, recorded.** Because Wall sampling density is not rotation-invariant, the ghost's ink
  density can differ from the baseline's own ink by a sample on a curved Wall. It is a redraw difference
  and never a geometry difference: the release re-derives and commits the planner's candidate either way.

---

## 4. What is and is not established

- **Established:** the arm mechanism exists, is DEV-gated, cannot reach production, is covered by unit
  tests, and produces a real within-session before/after; the per-arm **frame series** and per-action
  accounting now exist for the Chrome leg of the full protocol (§1.2), with the release unchanged; two
  dead per-move signals are deleted and guarded; and rotation is wired end to end with a release
  re-derive, a rewritten negative test, and a release-equivalence parity gate.
- **NOT established:** the Electron leg of the arms run; an arm-separable long-frame incidence; the
  presented-frame row per arm. None of these is available from this capture, and none is claimed.
- **Not a baseline.** No budget, no threshold, no ratchet move, no `g3-baseline.json` read or write.

## 5. Gates on this tree

- `apps/editor` `npm run check` — **0 errors, 0 warnings**. The typecheck earned its keep here: the
  rewritten rotation test had imported a type-only symbol from the wrong module, which `vitest` cannot
  see (it strips types) and `svelte-check` can; corrected, and green.
- Focused suites: `layout-transient-room-unit.test.ts` **15/15**, `layout-room-rotation.test.ts` **5/5**,
  `layout-room-move-gesture.test.ts` **17/17**, `p23b-m1-room-drag-arm.test.ts` **6/6**,
  `p23b-m1-record.test.ts` **31/31**, `p23b-m1-frame-timing.test.ts` **9/9**, `plan-overlays.test.ts`
  **20/20**, `layout-interaction.test.ts` **33/33**, `p23b-room-unit-proposal-parity.test.ts` **4/4**
  (the rotation release-equivalence differential included).
- `npm test` — **366 files (364 passed, 2 skipped), 5,169 passed / 4 skipped** in 74.6 s.
- `npm run test:arch` — **23 files, 254 passed**.
- `npm run test:heavy` — **8 files, 93 passed**.
- `npm run test:perf` — **9 files, 64 passed / 1 skipped**; the P0.4 added-vs-removed margins this session
  were 159.7×, 214.9×, 285.7× (the same test read 136–197× in the earlier session — session-conditioned,
  as every absolute here is). One perf-lane invocation failed once immediately after the heavy lane and
  did not reproduce on two subsequent runs with no code change in between; nothing is attributed to it.
- The two tests that had to change are deliberate and **strengthened rather than weakened**: the viewport's
  `previewWallFirstRoomMove` count now pins the arm branch separately (exactly one call inside it, exactly
  one outside it), and the M1 product-module rail pins the one thing the viewport is allowed to learn
  (one import, one call, and an explicit forbidden-symbol list).
