# Optimization directions for the three measured targets — a proposal to rule on

```text
STATUS: TAKEN AS EXPANDED SCOPE, RUN, AND ITSELF MEASURED. The owner authorized these directions as
expanded scope for this PR ("The proposals are authorized as expanded scope for this PR"). All three
"first moves" below were taken; the results are recorded in
./2026-09-27-D4-D5-D6-live-attribution-record.md, and they REVISE two of this proposal's own premises:

  D4  first move taken (per-Wall accounting). Outcome: the REUSE branch, not the ruling branch — 36 of
      40 Walls are already reused inside each preparation. The measured cost is the per-Wall VALUE
      COMPARISON of the whole generation (61–68 ms of each 72–81 ms preparation).
  D5  candidate implemented, proven output-identical, and MEASURED SLOWER at this input's real k
      (up to 2.2×) — then reverted. The premise this proposal called "the one target where the mechanism
      is already read from the code" was wrong: the cost is the READS (12.1× over the same values as
      plain objects), not the pair scan's order of growth.
  D6  falsifier run: NEGATIVE. The idle surface paces at 16.67 ms p50, so the post-release wait is NOT
      surface pacing. The cold live action that followed is SUPERSEDED: the steady-state protocol run
      with the split in place finds 0.0 ms of restore and 0.0 ms of commit after a release in all 38
      class rows on both runtimes, both landing INSIDE the release. The wait is 1.6-5.3 ms of
      scheduling, the Plan render (17-52 % of it), and a tail of 47-78 % (Electron) / 43-59 % (Chrome)
      after the page's last attributed mark. See
      ./2026-09-27-M1-release-to-presented-split-record.md.

Everything below stands as the DIRECTION this pass executed; read it with those records beside it.
```

```text
AUTHORITY: NONE — HISTORICAL. This was a DIRECTION PROPOSAL, not a decision, not a plan and not an
implementation. It names what each of the three measured targets needs first, what is already authorized
inside it and what is not, and what single measurement would make each one decidable. It changes no
scope: the follow-up's authority stays "DEV-only instrumentation; if a product module must be touched,
STOP and report", and the owner's standing constraint (no new cache, no Worker, no WASM) is treated as
binding.

SOURCE OF EVERY NUMBER: ./2026-09-27-M1-R1-corrections-and-attribution-record.md §3 (the corrected
session's own rows). Session conditioning applies throughout (§2.5 of that record): the ratios are the
durable findings, the absolute milliseconds are not, and any before/after must be taken in ONE session.
```

## 0. The three targets, and the one-line direction for each

| target | measured | durable finding | first move | ends in |
| --- | --- | --- | --- | --- |
| **D4** whole-Room preview | `mesh-prebuild` 6×/action at 61.8 / 70.5 ms self; 4 in 5 frames ≥ 50 ms | 6 full generations prepared per accepted action, vs **1** at 12.7 ms for one wall | DEV-only: record the per-wall reuse accounting (`built` / `reused` / `refusedByReason`) inside a whole-Room drag | a ruling: transform-aware reuse (product, ratchet-relevant) **or** a one-line call-site fix |
| **D5** pointer-move snap | `snap-wall-index` 173.2 / 231.3 ms self, 13× the straight control, 1×/action, provably outside the release | curved walls fall to an **O(k²) diameter scan over the wall's own sample endpoints** | implement the exact O(k log k) replacement (hull + rotating calipers) in `packages/layout-core` — PRODUCT code, needs authorization | a byte-identical faster extent merge, or a reverted attempt |
| **D6** post-release wait | 150.8–214.0 / 183.0–195.2 ms on the curved fixture for **every** class, taps included; not bounded by the proxy | the wait is a property of the FIXTURE + SURFACE, not of the gesture or its JS | the FALSIFIER: idle/no-gesture presented-frame cadence on the same surface | either "measured surface artifact" (and P23B.8 loses its big unexplained wait) or a real cost to hand P26 P6/P1 |

```text
THE ONE THING THAT MUST NOT BE SKIPPED: on all three, the cheap measurement comes before the fix. D4's
two possible fixes differ by a factor of "one line" vs "a redesign", and only the reuse accounting
separates them. D6's fix may not exist at all if the wait is the measurement surface pacing itself.
D5 is the one target where the mechanism is already read from the code and the fix's correctness is
provable, which is why it is sequenced first.
```

## 1. D4 — the whole-Room move: stop preparing six generations per action

**What the code does today** (`apps/editor/src/lib/editor/layout/`):

```text
refreshLayoutPreview(state)                       // the single production caller of applyCompiledLayout
└─ applyCompiledLayout(state, buildLayoutPreviewModel(state.project.layout))
   ├─ referenceGeometry = state.geometry          // the live generation IS passed as the reference
   ├─ installWallMeshes(state, result.geometry, referenceGeometry)
   │  └─ resolveWallMeshes(geometry, reference)
   │     ├─ key = wallMeshCacheKey(geometry); hit → return        (0 work)
   │     └─ miss → p2311Measure('mesh-prebuild', prepareWallMeshes(key, referenceKey))
   └─ resolveWallMeshes(...).issues
prepareWallMeshes(generation, referenceGeneration)  // prepared-wall-meshes.ts
  ├─ cached in `derivedWallMeshes` (WeakMap keyed by the generation's cache key)
  └─ buildWallMeshesByRoom(..., reference)          // per-Wall value comparison, reuse when EQUAL
     └─ stats = { built, reused, refusedByReason }  // RECORDED NOWHERE in M1's capture
```

So the reuse machinery already exists, the reference is already passed, and the per-wall comparison
already happens — inside the very call the mark times. What the capture does **not** say is how many of
the generation's walls were reused and, where none were, *why*.

**The first move (authorized: DEV-only, no product module).** Have the M1 harness read the existing
`PreparedWallMeshSet.stats` for each prepare inside a class's window and report, per class:
`prepares`, `wallsBuilt`, `wallsReused`, `refusedByReason` (summed, with the refusal keys as the
package already names them), beside the existing `mesh-prebuild` row. This is a reading of a value the
product already computes — no new measurement surface, no new retention.

**What each outcome decides, before anyone writes a fix:**

```text
(a) reused ≈ 0, refusedByReason ≈ { inputs-differ: N }  → the geometry genuinely changed per frame.
    Then the cheap fix does not exist and the real question is the one below.
(b) reused 0 with NO refusal recorded, or a reference that never reaches the prepare → a call-site /
    identity-key defect, and the fix is small. This is exactly the shape P23B.6 S3 and the
    `p23b7-mesh-identity-regression` suite exist to catch, so it is unlikely but must be excluded
    by measurement rather than assumed.
(c) reused > 0 but the row is still 62–70 ms → what is left is the changed walls' own build, and the
    target becomes "how much of the generation actually changed per preview".
```

**If (a) holds, the two candidate directions — both PRODUCT, both needing a ruling:**

```text
D4-1  TRANSFORM-AWARE REUSE. A whole-Room move changes each wall's PLACEMENT, not its shape. A wall
      whose canonical span values are equal up to a rigid transform could reuse its prepared mesh under
      that transform instead of rebuilding. This is the candidate that matches the evidence (the same
      40 walls, moved), and it is the one that most likely needs a retained shape-space set — i.e. it
      lands on the P23B.5 reuse ratchet and on the identity rules P23B.6/P23B.7 established. It is
      therefore a RULING, not a patch, and it may be refused on retention grounds.
D4-2  DEFER THE 3D PREPARATION OUT OF THE DRAG. The 3D wall meshes are installed on every preview
      update. If no consumer reads `wallMeshesByRoom` during the drag (answerable by READING the
      consumers — in scope, and the first thing to do if (a) holds), then the smallest correct change is
      to prepare once at the meaningful point rather than per pointer move. This is a product SEMANTIC
      change (a preview that no longer keeps 3D state current), so it needs the owner even though it is
      small.
```

**Do NOT** propose "cache the meshes": that is forbidden by the standing constraint and it is also the
wrong shape — the walls were moved, so a value-keyed cache misses by construction.

## 2. D5 — the wall-snap extent: exact, single-module, provably-equivalent

**What the code does today** (`packages/layout-core/src/layout-snap.ts`):

```text
wallSnapIndex(geometry)                    memoized per geometry object (`derivedWallSnapIndex`)
└─ p2311Measure('snap-wall-index', dedupeWallSpans(wall spans))
   └─ group by `wallKey ?? segmentId`, then per wall: mergeWallGroup(key, segmentId, list)
      ├─ provenTraversalExtent(list)       O(k): the extent the compiled distances already PROVE
      │  └─ withinChordTolerance(...)      O(k)
      ├─ if proven && within tolerance → done (this is the STRAIGHT control's 13.3 ms path)
      └─ else farthestEndpointPair(endpoints)     O(k²) — every span endpoint against every other
```

The quadratic scan is exactly the **curved** case: a curved wall carries its sample spans, so `k` is
the wall's own sample count and `k²` grows with it. That is why the identical 40-wall document reads
13.3 ms straight and 173.2 ms all-curved, one occurrence per accepted action.

**Direction.** The farthest pair of a point set is a *diameter* query, and the diameter of a point set
is attained by two vertices of its convex hull. Compute the hull (O(k log k)) and the diameter by
rotating calipers over the antipodal pairs (O(h)) — the result is **exactly** the same pair, not an
approximation, so for straight walls nothing changes and for curved walls the chord the collinearity
test sees is the same chord.

```text
THE ONE REAL RISK, stated because it is the whole risk: `farthestEndpointPair` breaks ties by
`lexicographicallySmaller` when two pairs have the same squared distance. A calipers implementation
must reproduce that tie-break exactly (enumerate all antipodal pairs attaining the maximum, then apply
the same lexicographic order) or curved extents can flip between two equally valid chords and change
output. The guard rails already exist and are the acceptance test:
  packages/layout-core tests · `layout-snap.test.ts` · `layout-snap-extent-parity.test.ts`
  the P23B.11 conditional-gate rows (the closed S4/S5 evidence) must stay byte-identical
  `npm run test:arch` + the heavy lane, and a same-session A/B of `snap-wall-index` before/after
WHY THIS ONE IS WORTH DOING FIRST: single module, no retention, no cache, no new owner, correctness
provable, and the payoff is the largest priceable term in the drag — on a cost that is a scan SHAPE,
which is the same reason the Worker/WASM case fails (§4.2 of the corrections record).
```

**Alternative, if the owner prefers no algorithm change:** memoize the per-wall extent against the
wall's span-set identity instead of recomputing it. It would be faster still for repeated geometry, but
it is a retention decision (new memo owner) and therefore a ruling, and it does not help the FIRST
derivation of a mutated wall — which is the frame the owner feels. Stated for completeness, not
recommended.

## 3. D6 — the post-release wait: falsify it before pricing it

**What is measured.** On the curved fixture every class waits 150.8–214.0 ms (Chrome) / 183.0–195.2 ms
(Electron) between the end of its synchronous release and the next presented frame; straight waits
23.0–56.0 ms. The two tap classes wait ~170–195 ms while doing ~85 ms of release work, and the
`browser-frame` proxy (18.4–34.5 ms) does not bound it. No retained page-side row explains it, and the
trace retains event COUNTS only, not durations.

**Step 1 — the falsifier (authorized; harness/CDP only).** The wait being a property of the fixture and
the surface, and identical in magnitude for gestures that do almost nothing, is also what measurement
PIPELINE pacing looks like on a headless/offscreen surface. Two cheap controls settle it:

```text
(a) IDLE CADENCE: with no gesture running, sample the presented-frame cadence on the same surface, same
    protocol, both runtimes. If the surface presents every ~150–200 ms when the page is doing nothing,
    D6 is the measurement surface and the row must be relabelled as such — which would REMOVE the
    largest unexplained wait from P23B.8's decision instead of explaining it.
(b) NO-OP INTERACTION: a press/release that changes no geometry, in the same class shape as a tap, to
    measure release→presented with ~0 ms of release work. The tap classes are already close to this;
    making it explicit removes the "the release still did something" objection.
```

**Step 2 — if the falsifier fails (the wait is real), price it.** The runner already subscribes to the
trace; it keeps counts. Retaining DURATIONS for the render/paint/commit events it already observes
(`Paint`, `PrePaint`, `Layerize`, `AnimationFrame::Render`, `::StyleAndLayout`, `::Script::Execute`,
`UpdateLayoutTree`, `Layout`) plus the presented-frame timestamps splits the wait into three parts:
release-end → paint-end → commit → presented. That is a runner change (test tooling, DEV-only), still
inside the follow-up's authority, and it is the measurement P26 P6/P1 would need before anyone could
attribute the stage.

**What must NOT happen:** nobody attributes D6 to the 3D adapter, to the GPU, to SVG/Plan template cost
or to a Worker until Step 1 has been excluded and Step 2 has priced the stage. The decisions record
already routes the mechanism to P26 P6/P1; this proposal only supplies the measurement it needs.

## 4. Sequencing, and what each step costs the owner

```text
1  D5 extent merge            code change in `packages/layout-core` — needs authorization + a ruling on
                              who owns the parity guard rails. Smallest, exactest, largest payoff. If
                              the owner wants one change tried on this evidence, this is it.
2  D4 reuse accounting        DEV-only, no product module: extends the M1 class row with the stats the
                              product already computes. Cheap, and it converts D4 from "one plausible
                              story" into "one of three decidable cases".
3  D4-2 consumer read         reading only: does any consumer read the 3D wall meshes during a drag?
                              Answers whether the smallest semantic change is even available.
4  D6 falsifier               harness/CDP only: idle cadence + no-op interaction. Cheap, and it may
                              reduce the P23B.8 entry question rather than enlarge it.
5  D6 stage pricing           runner change (trace durations) — only if step 4 fails. NOT TAKEN: step 4's
                              falsifier came back negative, but the split run then showed the wait's
                              page-side part is over by p50 11-89 ms, so the remaining 47-78 % is a
                              stage the page has no mark for. Step 5 is now the one measurement that
                              would price it.
ORDER REASON: 1 pays for itself in the same session it is measured in; 2 and 4 are cheap measurements
that change what the expensive fixes should be; 3 is free.
```

```text
WHAT THIS PROPOSAL DOES NOT DO. It enters no scope, sets no threshold and touches nothing. It does not
argue for a Worker or a WASM core — on this evidence it argues the opposite (§4.2 of the corrections
record), and step 4 could remove the main reason anyone might once P23B.8's decision on compute-bound
grounds. No cache, no ratchet write, no baseline is proposed anywhere above; the two D4 product
candidates are named as RULINGS precisely because they would touch retention.
```
