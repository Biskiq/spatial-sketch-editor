# T2.P01.S01 — independent review evidence

**Slice:** T2.P01.S01 · **Status:** in progress; independent implementation review and fixes recorded 2026-10-16; focused T1/Layout sign-off recorded; owner acceptance pending
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns the criteria
**Phase:** [T2.P01](../README.md) · **Register:** [slice register](../README.md#slice-register)
**PR:** [#130](https://github.com/Biskiq/spatial-sketch-editor/pull/130) · branch `T2-P01-S01`

This is review evidence, not slice acceptance, closeout, a capability registration or permission to
merge. The owner requested an independent review and direct in-scope repairs, stopping before
closeout or merge. The owner subsequently authorized the focused T1/Layout role review recorded
below; it was performed by a distinct reviewer agent, not self-signed by the implementation agent.

## Scope and tested source

Reviewed the approved S01 plan and [T2 contracts](../contracts.md), the actual compiler/query
records, F1 reference/frame interfaces, Scene codec, definition policy, retained renderer/loader,
and consumers/tests. All edits stayed in the designated `batch-2026-10-16/T2.P01.S01` worktree.
`F1.reference@1:references-v1` was already accepted at the trusted base; `ee463d0b` is an ancestor.
Cycle check: T2.P01.S01 is not a listed T1 exposure; no cycle window was opened or changed.

Review baseline: `665b328bf1ef0f4a7b9be0c345be5a6d38570225`.
Tested implementation and tests: **`29fd21e307b5cbbc26700c8016961013b8b2feaf`**. The later evidence
commit changes documentation only. Verification tier remains **affected-subsystem**, with
[T2.P01.S04](../t2.p01.s04-bounded-composition-loop/implementation-plan.md) as its exhaustive
integration route. No F4 registration, editor gesture integration, source-format migration,
compiler mutation or cross-worktree edit was introduced.

## Substantiated findings and fixes

| Priority | Finding | Final behavior and proof |
| --- | --- | --- |
| P1 | Same-height supports from different floor contexts collapsed into one implicit choice. A middle elevation could also bridge two supports farther apart than tolerance. | Deduplication requires the same floor context and pairwise elevation equivalence. Separate legal contexts still require a choice; tolerance-chain and array-reversal regressions pass. |
| P2 | Length-prefixed identity encoding is not lexical source-ID order; fragments of one source had unstable ties and nonunique choice keys. | Compare source/Room/floor/record IDs directly; use collision-safe identities only for choice lookup. Unequal-length source IDs and reversed same-source fragments prove ordering and unique fragment identity. |
| P1 | Last-writer Maps hid contradictory duplicate Room/floor facts; three collinear or nonfinite boundary points could manufacture support or silently disappear. | Refuse conflicting facts/correspondence and unusable containing boundaries. Both fact orders refuse; compiled input stays read-only. |
| P1 | The planner omitted F1 qualification/baseline evidence, retained only the first witness, accepted support for another point, and changed stale-query refusal into invalid-value. | Capture explicit snapshot/frame qualification, compare support/frame snapshots independently of compile generation, retain every witness plus exact F1 derived source references and definition/contact metadata, verify the query point, and preserve stale-generation refusal. Frame-owner revision remains opaque and independent of snapshot content identity. |
| P1 | Degenerate/self-intersecting footprints, invalid defaults/material references, unverified model contact and non-upward support could return candidates. | Require a simple finite footprint, verified model provenance, valid normalization/up normal, native analytical contact agreement, and a candidate accepted by the landed Scene codec. The codec result validates but never replaces the structural candidate. |
| P2 | Finite yaw operands could overflow during composition; a remainder-based reduction can disagree with the point matrix for huge angles. Exclusion reasons with equal codes hashed in input order. | Trigonometric angle reduction keeps composition finite and consistent with the frame matrix. Metadata ordering compares exclusion code then reason. |
| P1 | The piano exclusion had no reproduced geometric evidence, leaving its declared normalized footprint/contact unchallenged. | Real r186 GLTF/Meshopt geometry disproves admission; the inventory records the observed mismatch and keeps the piano excluded. |

The implementation locations are the
[Layout query](../../../../../packages/layout-core/src/layout-floor-support.ts),
[Scene planner](../../../../../packages/project-model/src/scene-planning/place-object.ts),
[frame math](../../../../../packages/project-model/src/scene-planning/frame.ts),
[footprint admission](../../../../../packages/project-model/src/scene-planning/footprint.ts), and
[editor policy/inventory](../../../../../apps/editor/src/lib/authoring/scene/object-definition-policy.ts).

## Evidence

- Six focused contracts / **74 tests pass**: floor support, placement candidate, placement frame, definition
  metadata identity, editor definition policy and retained-model geometry verification.
- `P24A_REQUIRE_PIPELINE=1 npm test`: **125 files / 1,671 tests pass**, zero skips, including the
  compiler suites, exhaustive/heavy correctness and all six asset-pipeline tests. The final run
  used the ordinary full-suite command and existing timeouts.
- `npm run test:arch`: **15 files / 137 tests pass**; Layout, project-model, Camera and visitor
  import/isolation boundaries remain green. Both package barrels are append-only against the PR
  base; package exports/dependencies, compiler tolerances and existing queries are unchanged.
- `npm run check:layout-core`, `npm run check:project-model`, `npm run check:camera-core`: pass.
  `npm run check`: **0 errors / 0 warnings**. `npm run build`: pass; retained dependency unused-import
  advisories remain nonblocking.
- A real raised-floor compile feeds query → chooser → planner → strict project serialization and
  parsing. Equivalent Plan/3D X/Z prepares identical candidates despite a mesh hit Y of 9,999.
  Nonzero origin/yaw/elevation round trips and huge finite yaw/matrix parity pass.
- A frozen populated Scene fixture proves canonical Camera nodes/connections, textures, materials,
  clusters and existing entities stay exact across box/cylinder/sphere and synthetic verified-model
  placement. No `roomId` is created. A two-Room real compile pins the current single-datum property.
- The retained r186 piano geometry test applies `defaultScale: 0.032` once through the real
  GLTFLoader, Meshopt decoder and retained clone/disposal helpers. Corrected X/Z bounds are
  **1.4825150338836297 × 2.524 m**, versus declared **1.48 × 1.59 m**; minimum Y is
  **0.0000507284917601325 m**, versus declared zero. WebP textures alone are substituted for the
  geometry check; it establishes exclusion, not material correctness or model-ready admission.
  Source scene ownership/transforms remain unchanged. Other catalogue models remain explicitly
  excluded pending verification; only analytical box/cylinder/sphere are admitted by host policy.

One initial full-suite run alongside build/check jobs hit the existing 5-second exhaustive
Camera-output timeout. Its whole contract passed alone (11 tests), then two ordinary full-suite
runs passed without changing its cases or timeout; the last run covers the final code above.

Final diff re-review found no additional substantiated in-scope implementation defect. No floor
support, definition evidence or frame identity is added to persisted Scene records. Host capture
of the actual accepted source, owner-resolved frame conversion, asset readiness and final acceptance
revalidation remain S02/S03 integration responsibilities, not claims made by these pure tests.

## Focused independent T1/Layout review — 2026-10-16

**Sign-off recorded:** [reviewer-authored evidence](./independent-review.md), by distinct reviewer
agent `/root/t1_layout_review`, authorized by the owner's focused review request. This is a scoped
T1/Layout role review, not a claim that a repository T1 owner approved the PR, and not overall
slice acceptance. Reviewed baseline **`3b66feb325137945c797bef4c0e2ebf746c34d5f`** (implementation
**`29fd21e307b5cbbc26700c8016961013b8b2feaf`**) plus this change's four threshold evidence tests.
No substantiated production defect was found; no behavioral repair was required.

The review confirms the append-only Layout-native exports and **1e-6 m boundary/coplanar** /
**1e-9 per-component up-normal** policy without compiler/legacy-query changes. It confirms same-floor
context equivalence for the current compiled world-frame, single-level format, pairwise elevation
comparison, exact source-first canonical elevation, retained witnesses, and deterministic explicit
ambiguity. Future level/instance/frame contexts need an explicit contract update before reuse.
Query-point comparison permits Euclidean round-trip drift without snapping the world pose.

Four added regressions prove Euclidean corner membership (rather than a rectangular halo),
inclusive coplanarity preserving exact canonical Y, component-wise normal limits, and near/far
query-point drift preserving exact composed X/Z. The final focused run passes **6 files / 78 tests**;
architecture checks pass **15 files / 137 tests**. Layout, project-model and Camera package checks
pass; final editor check reports **0 errors / 0 warnings**, and production build passes (the existing
dependency unused-import advisories remain nonblocking). The final complete run:

```sh
P24A_REQUIRE_PIPELINE=1 npm run test -w @portfolio/editor -- --maxWorkers=2
```

passes **125 files / 1,675 tests**, zero skips, including heavy correctness, compiler suites and all
asset-pipeline cases. The suite's tests and timeouts are unchanged; only worker concurrency was
limited. Before that rerun, an unrestricted final run concurrent with build/check work timed out in
the existing Camera exhaustive and Layout correspondence-reference contracts (123 files / 1,673
other tests passed). Both contracts then passed in the complete reduced-concurrency run. The
pre-addition baseline full run also passed 125 files / 1,671 tests. This is affected-subsystem review
evidence, not the future merge gate against then-current main.

Source changes only confirm the reviewed policy in a comment; contract and plan wording now
reflect the sign-off. Verification covers the implementation at `29fd21e3` plus the two test-file
additions in the commit carrying this evidence; all other changes are review documentation.

## Remaining gate

No closeout or merge was performed. Slice and phase status remain in progress. The complete
repository merge gate, including API checks and DB-backed tests with zero skips, must run against
then-current main before any merge. API/DB runs and browser journeys were not required or claimed
for this affected-subsystem review: no API, Save/Load, host/UI or delivery wiring changed.
T2.P01.S04 still owns integrated phase acceptance.
