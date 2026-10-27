# T1.P02.S06 — acceptance record: Performance foundation — CLOSED STUB

```text
AUTHORITY: NONE — the phase README owns slice status; this stub records acceptance and recovery.
STATUS:    ACCEPTED 2026-10-27 (owner-authorized AC-qualified disposition) and SHIPPED on PR #190.
REVISION:  product candidate d89554b1; milestone pass measured with harness 25d61deb; attribution
           harness 9df3f668. No product source changed after d89554b1 (docs and perf harness only).
TIER:      architecture-integration, narrowed by the owner direction of 2026-10-26 to the
           decision-driven milestone gate; the integrated exhaustive proof remains T1.P02.S04.
PHASE:     T1.P02 remains active; S04 is its declared final gate. S02 stays held until S06 is
           accepted AND merged.
NOT:       battery certification · production-scale or rare-tail statistics · grid-XL timing ·
           draw-call or L cold-open Target certification · T3 ownership sign-off.
```

**Plan:** [implementation-plan.md](./implementation-plan.md) (closed stub) · **Phase:**
[T1.P02](../README.md) · **Register:** [phase slice register](../README.md#slice-register) ·
**Contract:** [performance budgets and the milestone method](../../../../reference/components/performance.md)

`T1.P02.S06` was an owner-authorized, released child of T1.P02
([record](../../../../reference/decisions/performance-foundation-authorization-2026-10-24.md)). Its
measurement method, optimizations and evidence are landed; this slice provides no gate for another
slice and is not the phase's final gate.

## Delivered

A decision-driven performance method and the measured work it directed, without changing canonical
geometry, the authored format, Plan/Stage semantics or the visitor boundary. No package was admitted.

- **Measurement method (owner-ratified 2026-10-26).** A peak-first bench over the real browser and
  the shipped interaction: S/M/L grids with cold and warm cache states, input→presented-result
  correlation, machine/browser provenance, the full E5 correctness matrix, and an adaptive decision
  policy (minimum three independent runs; extension only while a row's rule is undecided; no
  pointer event counted as a sample). The milestone pass is recorded below; Bench 1, Bench 2 and the
  diagnostics keep their original meanings (see **Comparability**).
- **Indexed compile (D.1/H3).** Cache keys are built once from their parts and embed nested keys by
  reference; the Room × Opening, Wall × Opening, Wall × query-AABB and face × Room joins, the
  topology Junction × Junction / Wall × Wall loops and the plan-box lookups are indexed.
- **One check per fact on the accept path (D.2/H2),** and one compile per accepted result: admission
  compiles over the same retained session instead of a second cold compile, with no attested
  hand-over and no new authority.
- **Incremental compile (D.3/H1).** `createLayoutCompileSession` retains per-entity values and the
  authored inputs they were computed from; unchanged entities install by reference through the one
  compiler and one assembly. Keys carry host geometry, Floor datum, fallback thickness and sampling
  derivation, so retention is proved rather than assumed.
- **Retained Stage representation (D.3/H4).** One imperative subtree per representation, one mesh per
  compiled Wall/object keyed by `cacheKey`, swapped in place and released in the same update; the
  per-entity Svelte component pair is gone.
- **Shadow and idle (D.6/H9).** One shadow pass per reported dependency change (`autoUpdate = false`),
  context-restore handling, and no self-invalidating camera frame, so the Stage stops re-rendering
  at rest for no input change.
- **Plan interaction locality and compiler-delta maintenance (owner-directed 2026-10-26).** Pan and
  repeated reads retain the evaluated Plan instead of re-planning from the camera target; picking
  uses a spatially indexed, per-generation pick index; accepted edits derive the next Plan from the
  compiler-certified source delta, with the declared order maintained instead of globally sorted and
  fragments/membership assembled only where output changed.
- **Persistent representation takeover for the admitted Layout source.** See
  [Persistent representation takeover](#persistent-representation-takeover).

T3-owned surfaces touched (reviewed): `packages/project-model/src/units/**`, the editor Stage
admission (`stage/source-admission.ts`, `stage/host-acceptance.ts`) and the shared Stage/visitor
rendering files. `packages/layout-core/**` is T1-owned under S06.

## S06 milestone gate (owner direction, 2026-10-26)

**Verdict: pass.** The gate ran end to end on the designated machine: **15/15 decision-row groups
(27 recorded verdicts) passed**, the pass was complete and uncontaminated (`aborted: false`,
`contaminated: false`, `acceptanceEvidence: true`), and E5 ran in the same pass over all seven
workloads.

```text
pass        2026-10-26T22-49-48-537Z-milestone-s06-156 ($HOME/biskiq-perf-results/, outside Git)
duration    2,632.7 s (43.9 min): setup 13.1 s, cool-down 360 s, L 740.9 s, M 335.0 s, S 267.7 s,
            E5 851.2 s, transferred rows 64.6 s
machine     Apple M2 8-core / 16 GiB, macOS 24.6.0, Node v26.7.0, 1920×1080 CSS at DPR 1, network N1,
            branded Chrome 156.0.8078.48 (matches perf/chrome-pin.json), load 2.33/4.38,
            no thermal warning, Low Power Mode off, AC power (the manifest's only deviation)
revisions   product d89554b1 · benchmark harness and manifest 25d61deb (dirtyTree: false)
workloads   verified; digests recorded with the pass
```

Decision rows (warm; each figure the slowest of three independent run p95s):

| Tier | F3 input→preview | F4 accepted commit | F8 Undo/Redo | F3 frame p95 | EVAL per edit |
| --- | --- | --- | --- | --- | --- |
| grid-S | **16.3** ms (33) | **17.49** ms (100) | **14.3** ms (100) | **16.7** ms (16.7) | — |
| grid-M | **16.3** ms (50) | **25.51** ms (100) | **12.21** ms (100) | **16.8** ms (20) | **1.3** ms (8) |
| grid-L | **16.34** ms (100) | **93.61** ms (200) | **21.63** ms (200) | Target, recorded | — |

F2 open: S cold/warm 172.0/91.9 ms (300), M 565.2/501.8 ms (800), L cold 5,064.4 ms — the 6.0 s hard
budget is met and the 2.0 s Target is missed (Target miss, not a gate failure). F7 S/M pooled p95
16.7 ms after extending those two rows to five runs at the display floor. F13 over ten cycles:
2.40/2.20, 2.54/2.37 and 2.50/2.49 MiB at S/M/L against 10; retained per accepted edit at L 1.27 MiB
against Bench 1's 6.0–6.2 MiB; geometries, textures, programs, DOM nodes and listeners return to
baseline every cycle.

**E5 correctness and locality.** Six semantic-independence cells and the fixed-view comparison all
show **0 differing pixels** before and after the fixed edit; the museum positive control changes
**3,120 pixels**, so the check can see a change. Programs (14) and textures (34) are constant, shadow
work is flat, and D3/D10 match H3/H10. Draws: museum 1,447, H3/D3 3,542, H10/D10 10,526, C3 4,679,
C10 15,443 — above the 2,500 L Target at both ×10 variants (known H6 one-mesh-per-Wall path).

**Comparability — Bench 1 → Bench 2 → milestone.** Bench 1 is 10 runs/state at `1c5e530c` (Chrome
155); Bench 2 is the 3-run **diagnostic** at `e8cc2fc0` (Chrome 155, dirty tree, E5 completed
separately); the milestone is the pass above (Chrome 156). All three ran on AC, and Bench 2 medians
are not milestone p95s.

| Row | Bench 1 | Bench 2 (diagnostic) | Milestone |
| --- | --- | --- | --- |
| F3 L | 164–166 ms (p95 216–233) | 15.5 ms median, max 25.0 | **16.34 p95** |
| F4 L | 636–670 ms | 94–116 median, max 151 | **93.61 p95** |
| F8 L | 519–536 ms | 37–51 median, max 88.5 | **21.63 p95** |
| F4 / F8 M | 139–141 / 95–111 ms | 24.6–37.5 / 7.4–10.8 | **25.51 / 12.21 p95** |
| F4 / F8 S | 27–30 / 29.4 ms | max 28.9 / 14.4 | **17.49 / 14.3 p95** |
| F2 L cold | 5,186 ms | 5.16 s | **5,064 ms** |
| F13 L per edit | 6.0–6.2 MiB | not comparable | **1.27 MiB** |
| H10 draws | 10,398 | 10,526 | **10,526** |

**What this does not certify.** This is **S06 milestone acceptance**, not production-scale, grid-XL,
realistic-L or rare-tail certification; small-sample p95/p99 are not estimates of rare tails. A.6,
the delayed-preview proof, F2 repeat-use, F7 cold/repeat-use, grid-XL, realistic-L and the sweep
latency rows were **not measured** and are named in the manifest — no omitted row may be read as a
pass. The contract's designated-machine condition is battery; every pass ran on AC, so the result is
certified for the recorded AC reference condition only. F3 L logged 3 long tasks across three runs,
so the ≤ 1-per-drag Target is **not demonstrated**; the L frame Target's p99 33.3 ms is inside its
50 ms bound.

**Remaining performance targets and structural limits.** L cold open is still 5.06 s against the
2.0 s Target; L draw submission is 10,526–15,443 calls against 2,500 (H6); the commit envelope is
still whole-document work (C10 canonicalises 8.85 MB and reads 6.06 M snapshot properties), so F4
grows with document size; F2 M cold keeps only 29 % headroom. None is a hard-gate breach, and none
was addressed by changing product code.

## Persistent representation takeover

The accepted Layout source moved onto session-owned persistent structures: blocked persistent
vectors, augmented persistent AVL maps, shared static ID/incidence directories, current-source
views, fat spatial partitions with reinsertion, retained materialized views, lazy flat adapters and
session-owned historical roots. The competing persistent/spatial/dataflow representations, the
fixed-refit versus adaptive-centroid comparison and the full cost model are owned by the
[architecture dossier](../../broad-research/spatial-computation-architecture.md); the exact
before/after work tables, allocations, retained-heap observations, oracle digests, revision and
machine are in the [checked-in evidence](./evidence/persistent-2026-10-25/README.md).

On the 100,002-entity Room fixture a local move copied 57,144 source slots, 171,432 Map entries,
1,386,774 spatial buffer bytes, 2,287,343 query slots and 92,859 compiled/list slots on the base
path; the retained path copies 512 bounded vector slots and allocates 215 map nodes and 161 vector
nodes. The semantic work for that edit is three Walls, two Junctions, two Openings and one Room —
eight evaluations, not "two or three entities in total". Exact rectangle overlap is expressible as
4D dominance; the selected index guarantees logarithmic **maintenance**, not logarithmic queries for
arbitrary distributions, which stays a measured engineering choice rather than an optimality claim.
No Rust/WASM, inverse journal, serialized ID or Merkle format was introduced. Source immutability,
authoritative accepted source, canonical byte identity, full JSON output and rendering remain
distinct contracts.

That takeover passed the complete editor suite (202 files / 2,524 tests), the architecture lane (22
files / 180 tests), the heavy lane (11 files / 138 tests), all package checks and the build, and
review round 3 found the implementation correct in the reviewed scope with step acceptance withheld
pending the benchmark — which the milestone gate then supplied.

## Post-Bench-2 attribution (2026-10-27)

Owner-directed targeted comparison of Bench 2's revision `e8cc2fc0` against the frozen candidate
`d89554b1`, same spec, machine and pinned browser: medians of three paired rounds (post-edit pick
one paired session). It is an attribution check, not a pass. Raw measurements and the reproduction
command are in [evidence/attribution-2026-10-27](./evidence/attribution-2026-10-27/README.md).
Classification uses I6: only eliminated or reused work is a reduction; deferred work is counted where
it went.

| Finding | Bench 2 → candidate | What the counter proves | I6 class |
| --- | --- | --- | --- |
| Continuous pan (L) | 37.05 → 18.10 ms task per move; 3.48 → 1.70 s per 94 moves | candidate records zero `plan:*`/`plan-pick:*` work during the pan; the old route rebuilt the Plan key from the camera target and called `stage.plan()` on every change | **Eliminated** |
| Continuous pan (S) | 4.09 → 3.12 ms per move | same elimination, smaller absolute saving | **Eliminated** |
| Repeat pick (L) | 24.0 → 17.3 ms wall; 40.0 → 30.3 task | no index build; 35–37 node tests, 640–680 projections per click | **Eliminated** (per generation) |
| Late-order pick (L) | 52.7 → 16.1 ms wall; 62.2 → 26.9 task | 75 node tests and 1,048 projections instead of a full-order scan | **Eliminated** |
| First ordinary pick (L) | 23.0 → 54.0 ms wall; 44.1 → 79.3 task | builds 3,917 nodes, 147,126 union comparisons and 11,396 fragments inside the click | **Moved** into the first read |
| First ordinary pick (S) | 4.2 → 6.5 ms wall | the same build at small scale; about 2.3 ms of it is the index | **Moved** |
| Local edit (L) | 170.2 → 173.3 ms task; first presentation 102.1 → 100.1 | derivation is local (8 sources, 1 delta, 0 unrelated comparisons) but 420 Wall / 196 Room / 225 Junction slots, 1,289 aggregate reads, 1,357 merges and 1,036 membership rows remain | **Unchanged** |
| Local edit (S) | 27.5 → 35.0 ms task | about 7.5 ms slower in all three paired runs, inside every budget | **Regressed** (small sample) |
| First pick after a commit (L, n=1) | 31.5 → 23.4 ms wall; 40.7 → 42.7 task | rebuilds 3,919 nodes, 151,230 comparisons and 11,403 fragments | **Deferred** |

**Structurally better, invisible to current latency rows.** Plan derivation is now proportional to
the certified source delta with declared order preserved; the proof is the work ledger and
equal-output differentials, not wall time, because compile materialisation, membership assembly and
the commit envelope still precede presentation. Pan CPU more than halves while L and S pan frame p95
is 16.7 ms with zero long tasks on **both** revisions — the rAF proxy sits on the display floor, so
the saving is headroom and predictability, not a frame-rate gain.

**Unchanged.** End-to-end edit, Undo/Redo and Open remain whole-project; the object unit has no
persistent root; envelope canonicalisation and the flat SHA-256 are `Ω(bytes)`; draw submission is
unchanged; L cold open remains the named Target miss.

## Reconciliation, follow-ons and closeout readiness (2026-10-27)

**Milestone coverage limit, carried into the contract.** The milestone suite has no canvas-pick row
and no pick-after-commit row, and its F7 pan/zoom row is a scripted key/wheel loop rather than a
continuous pointer drag — which is why the attribution, not the gate, found the pick trade-off and
the deferred rebuild. The
[owning contract](../../../../reference/components/performance.md#s06-milestone-decision-method-owner-amendment-2026-10-26)
records the limit and the two rows future performance slices must carry: a **continuous pointer-pan
CPU row** and a **pick-after-commit row** that counts index builds and fragment materialisations.
Neither is an S06 obligation or a new hard budget.

**T3/T2 shared-boundary review (2026-10-27, independent agent). Verdict: the seams pass; no blocking
defect.** Reviewed: Plan retention and the live-target protocol, the compiler-delta certificate,
Stage admission and the qualified handoff, immutable capture and codec sharing, and visitor
isolation plus shared-renderer compatibility. Recorded preconditions and limits:

1. retention must keep describing the content generation it was derived from (a generation token,
   not merely a changed flag);
2. the bounded lateral span is `O(N)` per pan, so the pan gain is a constant-factor elimination, not
   an asymptotic one;
3. the pick index build is charged to the first click after a generation change;
4. the 52-entry admitted-history cache is a count bound, not a measured byte bound;
5. shadow invalidation triggers on identity, so an equal-but-new object costs one extra pass.

Targeted verification: 239 fast tests, 13 heavy tests, 53 arch tests, and no `visitor/` →
`$lib/authoring` import. Omissions, named rather than implied: no benchmark, browser, E5, framebuffer
or full-lane rerun. Full review detail is recoverable from the [review-handoff stub](./review-handoff.md).

**Owner disposition — ratified 2026-10-27.**

```text
RULING      Accept T1.P02.S06 as AC-qualified.
SCOPE       The 2026-10-26 milestone gate on the designated MacBook Air M2 (16 GB), Chrome
            156.0.8078.48, N1 1920×1080 at DPR 1, AC power, Low Power Mode off, candidate
            d89554b1: 15/15 decision rows (27 verdicts) pass, full E5, 2,632.7 s.
DEVIATION   The contract's designated-machine condition is "on battery with Low Power Mode off";
            the milestone ran on AC. This disposition qualifies the result as AC-only and does
            NOT certify the battery condition.
DEFERRED    Battery qualification of these rows, routed to S04's integrated gate on the same
            machine; no new S06 obligation and no budget change.
NOT CLAIMED battery certification · grid-XL timing · production-scale or rare-tail statistics ·
            L cold-open Target · draw-call Target · ultimate geometry/rendering ceiling · T3
            ownership sign-off
EFFECT      S06 is accepted and closed by routine slice-closeout; the performance-first halt
            lifts only when S06 is accepted AND merged.
RATIFIED    owner, 2026-10-27 — acceptance and routine slice-closeout authorized together.
```

**Owned follow-ons.** None is an S06 acceptance obligation, none releases a scope, and none creates
or changes a budget.

| ID | Follow-on | Owner | Trigger | Verification boundary |
| --- | --- | --- | --- | --- |
| FO-1 | Maintain the pick index across a compile generation instead of rebuilding it, and make the first pick after an edit responsive | T1 (the performance scope that owns Plan picking) | The first-click cost in S02/S03 drawing traces, or a planned pick row | Pick-after-commit row plus `plan-pick:*` build counters; equal-hit differential against the whole scan; any hard budget needs an owner amendment |
| FO-2 | Reduce whole-project compile materialisation, membership assembly and the commit envelope on an accepted edit | T1 compiler/representation; T3 review if capture, admission or F4 semantics move | F4/F8 local-edit rows in S02, or the next compile-path slice | Existing `compile:aggregate-*`, `materialize:*`, `plan:output-membership` counters and the F4 row; no budget change without owner ratification |
| FO-3 | Characterise the small-project fixed overhead behind the S edit regression | T1 | S edit rows in the next performance-bearing slice | Paired S/L run of the same attribution spec; a recorded cause, not a new gate |
| FO-4 | Give the admitted-history cache a byte budget or a measured retention bound | T3 (owner of the admitted-source lifetime) | Before history depth is raised or a memory claim is made | Measured retention at the shipped bound |
| FO-5 | Carry continuous pointer-pan CPU and pick-after-commit evidence into future performance slices | Owner of the next performance slice | Any slice claiming interaction-locality gains | The two rows named in the contract's post-milestone limit; report-only until an owner sets a budget |

## Verification still owed

```text
T1.P02.S04   integrated exhaustive proof; battery qualification of the S06 rows; grid-XL timing and
             functional clause; the sweep latency rows; S01's still-unrun F2 S/M open timings
Targets      L cold open (2.0 s Target, 5.06 s measured), L draw submission (2,500 Target, 10,526-
             15,443 measured), F3 L long-task Target (not demonstrated) — all owner-visible misses,
             none a hard-gate breach
Follow-ons   FO-1 … FO-5 above, none owed by S06
```

## Entry points

```text
implementation  packages/layout-core/src/layout-geometry.ts          canonical compiler + session
                packages/layout-core/src/layout-geometry-reuse.ts    retained store
                packages/layout-core/src/layout-geometry-keys.ts     cache keys
                packages/layout-core/src/layout-geometry-delta.ts    compiler-certified source delta
                packages/layout-core/src/layout-plan-box-index.ts    indexed plan-box queries
                packages/layout-core/src/layout-plan-representation.ts   Plan representation
                packages/layout-core/src/layout-junction-identity.ts indexed Junction identity
                packages/project-model/src/units/acceptance.ts       admission
                apps/editor/src/lib/authoring/layout/plan-pick-index.ts  pick index
                apps/editor/src/lib/authoring/stage/stage-facade.ts  Plan retention, pick wiring
                apps/editor/src/lib/authoring/stage/host-acceptance.ts   admission + history cache
                apps/editor/src/lib/render/layout-wall-representation.ts
                apps/editor/src/lib/render/layout-object-representation.ts
                apps/editor/src/lib/render/shadow-invalidation.ts
validation      apps/editor/tests/lib/layout/t1s06-incremental-compile.test.ts
                apps/editor/tests/lib/layout/t1s06-plan-box-index.test.ts
                apps/editor/tests/lib/layout/layout-plan-locality.test.ts
                apps/editor/tests/lib/render/shadow-invalidation.test.ts
harness         apps/editor/perf/bench.ts · apps/editor/perf/lib/early-stop.ts
                apps/editor/perf/lib/milestone.ts · apps/editor/perf/attribution/attribution.spec.ts
```

## Recovery

```text
git show e676a363:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/acceptance.md
anchor  e676a363  (last commit holding this record's full body, including the ratification)
 tag    closed/T1.P02.S06 → e676a363 (local only — not pushed)
```

The plan, review handoff, characterization and scale-reconciliation anchors are the same commit; each
stub names its own path. P1 recovery requires a **merge commit**: the merge owner verifies every
anchor is reachable from `main` after the merge. A squash or force-push would degrade those recovery
lines to `git fetch origin refs/pull/190/head && git show e676a363:<path>`.

## Preservation report

```text
CLOSEOUT PRESERVATION — T1.P02.S06 (2026-10-27)
prose compacted:                 5   acceptance record, implementation plan, review handoff,
                                     characterization and scale reconciliation → stubs at their paths
reference promotions:            1   the milestone method, coverage limit and post-milestone rows are
                                     owned by docs/reference/components/performance.md (landed with the
                                     amendment, before this close)
renderable evidence archived:    0 files   (evidence is JSON/text + manifests: kept live by shape,
                                     not archived)
evidence stubs / manifests:      0   evidence/attribution-2026-10-27 and evidence/persistent-2026-10-25
                                     stay live and are linked from this stub
transient artifacts removed:     0
historical anchor:               e676a363 · tag closed/T1.P02.S06 (local only — not pushed)
new live → archive prose links:  0
manual-owed verification rows:   1   battery qualification (owner disposition above; routed to S04)
remaining deferred items:        5   FO-1 … FO-5, owned above
permanent stubs added:           5   (the owner-ratified cost: one per closed prose artifact)
```
