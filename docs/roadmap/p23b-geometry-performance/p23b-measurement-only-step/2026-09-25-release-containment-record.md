# P23B measurement-only step — action containment, post-release re-capture and ranking (2026-09-25)

```text
STATUS:  MEASUREMENT RECORD — DEV-only, advisory, separate from the baseline.
         Owner-authorized routing amendment (phase README, 2026-09-25): P23B.7 S1
         extended to the wall-authoring release + P23B.6 S1, run BEFORE any
         P23B.6/P23B.7 optimization. This record ends at the ranking and stops
         for the owner's ruling.
ADVISORY: one machine, one session. No budget, no enforced metric, no wall-clock
         threshold. `g3-baseline.json` is neither read nor written by this step
         (`bench:record` remains its only writer); `BUDGETS` and
         `ENFORCED_BUDGET_METRICS` are unchanged.
```

## 1. What changed, and why

The `p2311:` component marks were collected with
`performance.getEntriesByType('measure')` and reported **pooled per fixture
session** (`nestedMarks`), so a figure such as "mesh-prebuild 89.6 ms p50" had no
action attached to it: it spanned rigid edits, bends, authoring clicks and
warm-up alike, and `markNestingNote` forbids summing pooled distributions.

This step binds each mark to the **action and outcome whose boundary interval
encloses it** and reports a containment tree per action:

| Piece | Where |
|---|---|
| Containment model (pure) | `apps/editor/src/lib/bench/p23b-containment.ts` |
| Boundary intervals in the ledger | `p23b-interaction-measure.ts` (`samples[].start/end`) |
| New release-path marks | `LayoutPlanViewport.svelte`: `selection-hit`, `gesture-commit`, `authoring-release` |
| Harness build + mirror + export | `/dev/perf/p23b` (`__P23B_CONTAINMENT__`, `__P23B_CONTAINMENT_SUMMARY__`, "Download measurement record JSON") |
| Proofs | `tests/lib/bench/p23b-containment.test.ts` (8), `tests/lib/layout/p23b-measurement-marks-wiring.test.ts` (5) |

Rules the record obeys, each because it is what makes the tree honest:

1. **Containment, not proximity** — a mark belongs to an action only when its own
   interval is inside one of that action's recorded boundary intervals.
2. **Never summed** — every figure below is one action's tree or a distribution
   over a group (count / p50 / p95). No parent is reported as the sum of its
   children; no group is a total.
3. **Two visible remainders** — a mark inside an action's span but outside all of
   its boundaries is reported as `unbound` on that action; a mark outside every
   action is pooled under `unattributed`, named and counted, never guessed.
4. **Exclusive time only where containment holds** — `self` is
   `total - sum(children)` only when the children are pairwise disjoint and each
   is fully inside; otherwise `self` is `null` with the reason stated (see
   `gesture-commit` below, which reports `null` for exactly this reason).

## 2. Provenance

```text
commit         d9a56a2b (tree dirty: the measurement code below is committed with
               this record; the capture ran on that working tree)
policy commit  c11938fe
machine        arm64 / Apple M2 / 8 logical CPUs / 16 GB RAM
OS             15.7.2 (build 24G325) · node v26.7.0
browser        Chrome 130 (Freebuff), DPR 1, viewport 1920x1200
protocol       the committed `drive.ts` scripted capture, unchanged: shared px/m
               ladder (19.29 px/m), 25 accepted actions per path, 5 per path
               excluded as warm-up, every action verified against the live ledger
population     warm-up excluded per path, ACCEPTED outcomes only — the
               interaction report's own rule, applied to containment so a
               containment figure and the boundary figure beside it describe the
               same actions
units          milliseconds; `n` is the number of contributing actions
```

## 3. Coverage — and one abort (honest limit)

```text
owner-40-curved-v1 (owner-responsiveness)     CAPTURED — selection 20, bend 20,
                                              plan-drag 20, wall-authoring 23,
                                              plan-pan-zoom 52 actions
p23b-40-wall-straight-v1 (control)            CAPTURED — selection 20, plan-drag 20,
                                              wall-authoring 23, plan-pan-zoom 52
                                              (bend is not applicable: no knots)
p23b-40-wall-all-curved-v1                    ABORTED at action 94 — the driver's own
                                              guard: "action 94 did not complete within
                                              6000 ms" (wall-authoring). No containment
                                              record exists for it; the 6000 ms
                                              `ACTION_TIMEOUT_MS` was NOT changed, because
                                              changing it would change the protocol and
                                              break comparability with P23B.0.
```

A completed-pair result: the two captured fixtures are the **curved owner-40** and
the **all-straight control**, so the curvature contrast the ranking needs is
present; the size-40 all-curved matrix cell is the missing third.

## 4. Acceptance boundaries — the inside of one release (p50 over accepted actions)

```text
path            fixture   input    release            svelte-flush        browser-frame
                                  total / self        total / self        total / self
plan-drag-edit  owner     42.7     216.5 / 214.2      88.2 / 80.5         90.0 / 1.8
plan-drag-edit  straight  34.7     214.7 / 211.5      18.2 / 14.1         20.1 / 2.1
bend-knot-edit  owner     44.0     221.3 / 211.9      91.4 / 83.8         93.0 / 1.7
wall-authoring  owner      0.2     700.3 / null       0.2 / 0.1          14.3 / 2.1
wall-authoring  straight   0.2     271.7 / null       0.2 / 0.2           7.5 / 2.4
selection       owner    193.3     25.5 / 4.1         90.4 / 226.6*       90.5 / 1.9
```

`*` the selection flush `self` exceeds its own `total` by rounding of p50s taken
on different actions; it is reported as measured, not reconciled.

The post-release pair is the deferred re-capture asked for in this step (the
S-8-corrected harness, which starts both boundaries where the synchronous input
ended): on the owner's rigid edit the flush is **88.2 ms p50 (self 80.5)** and the
next frame adds **1.8 ms** on top of it; on the straight control the same pair is
18.2 / 2.1. That reverses P23B.0's disposition A **for this record only**, and it
mainly serves P23B.6.

## 5. Nested marks, attributed (p50 over accepted actions)

```text
mark                        owner: rigid / bend / authoring      straight: rigid / authoring
p2311:gesture-commit        167.5 / 169.7 / — (self null)       179.6 / — (self null)
p2311:restore-mesh-install   85.4 /  85.3 / 88.5                96.4 / 97.0
p2311:baseline-restore       85.6 /  85.6 / 89.1                96.5 / 97.2
p2311:mesh-prebuild          17.6 /  17.9 / 85.2                21.6 / 22.2
p2311:acceptance-compile     14.7 /  15.1 / —                   11.5 / —
p2311:preview-compile         —   /   —   / 21.9                —   / 12.6
p2311:preflight-topology      7.0 /   7.0 / — (self 3.9 / 3.6)   1.6 (self 1.5) / —
p2311:plan-apply             41.8 /  42.5 / — (self 1.5 / 1.6)  30.5 (self 0.7) / —
p2311:topology-pre/post       3.3 /  3.2 · 3.1 / 3.2 (self ~1) 0.2 / 0.2
p2311:face-extraction         2.9 /   2.9 / —                   0.1 / —
p2311:room-geometry-compile   6.7 /   6.7 / 9.2                 6.7 / 6.8
p2311:architecture-snap-res   4.4 /   4.8 / —                   2.5 / —
p2311:selection-hit          12.8 /   —   / —                  15.4 / —
p2311:authoring-release        —   /   —   / 700.3               —   / 271.7
p2311:pointermove-rigid/bend   ~0 (80 marks)                    ~0 (80)
```

Measured remainders (the rule-3 machinery doing its job):

```text
unbound (inside the action, outside its boundaries), owner bend-knot-edit:
  p2311:next-frame-latency p50 17.5 (80) · p2311:svg-flush-latency 0.2 (42) ·
  p2311:pointer-cadence 16.5 (60)

unattributed (outside every action), pooled per fixture and never attributed:
  owner-40:    baseline-restore 22.4 (75) · restore-reactive-write 22.4 (75) ·
               plan-render-model 3.2 (248) · restore-project-clone 0.2 (75) ·
               svg-attributes 0.1 (19,603) · and the four ~0 restore sub-marks
  straight-40: the same family (restore/clone/mesh-install/plan-render-model)
```

The restore family in `unattributed` is the between-action undo/re-seed the
protocol performs — it is a fixture-reset cost, not an action cost, and the
record says so instead of folding it into the nearest edit.

## 6. Ranking — which slice each measured cost belongs to

```text
1  P23B.6 (rendering / mesh + GPU cone) — THE LEADING NAMED COSTS
   restore-mesh-install 85.4-97.0 ms p50 inside every accepted release, on the
   CURVED OWNER AND THE STRAIGHT CONTROL ALIKE; mesh-prebuild 17.6-85.2 ms p50;
   preview-compile 12.6-21.9 ms p50; room-geometry-compile ~6.7-9.2 ms p50. The
   named interior of a release is dominated by build-and-install of render
   geometry, and the post-release flush (self 80.5 ms on the owner) is the same
   work arriving one tick later.

2  P23B.7 (interaction) — REAL BUT SMALL, AND NOT FIRST
   preflight-topology self is 1.5 ms per accepted move on the straight control and
   3.6-3.9 ms on the curved owner; the whole-document gate cannot be worth more
   than single-digit ms per move against a ~215 ms release. architecture-snap-
   resolution is 2.5-4.8 ms, selection-hit 0.1-15.4 ms, preview-install p50 0.
   Running the gesture-scoped topology gate first would optimize ~2% of the
   release. This record names the gate; it does not name it first.

3  P23B.8 (Worker + Rust/WASM decision) — NO MEASURED DEMAND
   Nothing in this capture puts a single named cost into the tens of milliseconds
   where a Worker/WASM boundary would pay for itself; the synchronous release is
   dominated by mesh/restore work that has no cross-thread split today.

4  NEW NAMED FINDING — the wall-authoring release is the one unnamed majority
   owner curved 700.3 ms p50 vs straight 271.7 ms p50, with only mesh-prebuild
   (85.2), baseline-restore (89.1), preview-compile (21.9) and room-geometry-
   compile (9.2) named inside it: roughly 490 ms of the curved authoring release
   is not named by any mark yet. Wall authoring also has no `plan-apply` boundary
   by construction, which is why `authoring-release` was added here.
   A follow-up that prices that remainder is justified; an optimization that
   guesses at it is not.

5  OPEN — gesture-commit cannot be exclusive-priced yet
   gesture-commit is 167.5 / 179.6 ms p50 and reports `self: null` because its
   enclosed marks overlap, which is the honest answer rather than a subtracted
   guess. Splitting it into disjoint child marks (history write vs install) is
   the prerequisite for pricing the commit+history path the owner called out.
```

Corroboration of the owner's own finding: `preflight-topology` measures
1.6 ms (straight) and 7.0 ms (owner-40 curved) per accepted move, consistent with
the 1.7 / 7.8 / 9.9 ms per move recorded in the P23B.0 baseline — the same cost,
now attached to an action and an outcome instead of pooled.

## 7. What this record does NOT claim

- Not a budget, not a target, not a regression gate. Nothing here is enforced.
- No end-to-end interaction gain: the timings are DEV-harness measurements on one
  machine in one session, with the harness panel open.
- No GPU claim: mesh/restore timings are CPU marks; GPU upload and painted
  presentation are not implied.
- No all-curved-40 cell: that capture aborted on the driver's 6000 ms action
  guard (§3). The curved family is represented by the owner-40 fixture.
- No production telemetry: the marks ride the shipped DEV + `__P2311_PERF__` gate
  (`packages/layout-core/src/p2311-perf.ts`), and nothing was added to a `/museum`
  chunk.

## 8. Reproduction

```bash
npm run dev:editor            # DEV server on the working tree
open http://localhost:5173/dev/perf/p23b
# window >= ~1250 px wide (the shared view must fit the fixture's target box)
# "Run scripted capture" → the driver hosts each fixture, performs the fixed
# protocol and summarizes per fixture; then "Download measurement record JSON"
npm test -w @portfolio/editor -- tests/lib/bench/p23b-containment.test.ts \
  tests/lib/layout/p23b-measurement-marks-wiring.test.ts
```
