# T1.P02.S05 — Legacy Layout retirement: implementation plan

**Slice:** T1.P02.S05 · **Status:** approved — owner-authorized and released 2026-10-23 ·
**Phase:** [T1.P02](../README.md#slice-register) · **Track:** [T1](../../README.md) ·
**Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md) ·
**Acceptance:** [record](./acceptance.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
```

## Outcome and eligibility

Retire the legacy authored Layout document surface while keeping the format-6 wall-first
reader, identities, canonical compiler and compiled behavior. This discharges S01's
[stop-and-report](../t1.p02.s01-layout-identity-and-format-cutover/acceptance.md#recovery),
not a second format cutover. S01 is shipped; this successor must be independently accepted
and merged before S02 starts. Register order is **S01 → S05 → S02 → S03 → S04**; existing
slice IDs and S04's final-gate identity stay intact.

The [owner release](../../../../reference/decisions/post-batch-e-authorization-2026-10-23.md) authorizes this slice;
implementation starts per the release list (`docs/roadmap/now.md`). Recheck
consumed gates/scopes at that trusted base and follow the runbook cycle check. The recovered S01 acceptance
at commit `302f966d48faf1f63d2b089cec31bca43582f178`, sections “What blocks the retirement”
and “What remains”, supplies the measured starting evidence; remeasure callers rather than
assuming its import counts remain current.

## Ownership and bounded write surface

T1 owns the Layout vocabulary and compiler cutover in `packages/layout-core/src/`, its
public exports and the affected editor/kernel tests. Repoint actual consumers wherever
needed, with affected-owner review. Bounded cross-track exceptions are
`packages/project-model/src/project-layout-semantics.ts` and
`packages/project-model/src/scene-planning/frame.ts`: their legacy imports prevent complete
retirement. Their reviewers are named: **T3** (reader/Camera) for the registry facade and
**T2** (Scene) for `scene-planning/frame.ts`. T2.P02.S02 also extends `scene-planning/` in
parallel, so before touching `frame.ts` record the writer (this lane), the expected patch base
and the T2 reviewer in the baton; whichever lane merges second rebases onto the other and
reruns its complete gate. This is not permission to redesign those domains or remove their
facades wholesale.

**Known affected surface (2026-10-23 inventory at `93ec96ca`; step 1 remeasures).** Every
importer the inventory finds is in scope, not only the files named here. On the trusted base
the legacy symbols reach about 45 `packages/layout-core/src` modules (mostly through
`LayoutVec2`/path types), `project-model` (`project-layout-semantics.ts` and `scene-planning/frame.ts` need edits;
`scene-planning/{operations,support}.ts` import only `LayoutVec2` from the package root and
`units/{envelope,types,validate}.ts` only wall-first symbols, so they need no edit while the
neutral modules stay exported from the `layout-core` root barrel), five
editor authoring modules (`adapters/layout.adapter.ts`, `adapters/layout/{adapter-support,
instrument,precision}.ts`, `stage/starter-gallery.ts`), `apps/editor/perf/lib/fixtures.ts`
and roughly 110 editor test/helper/fixture files. `layout-portals.ts`
(`projectLayoutPortalRelations`, `portalOpeningHasRoomPair`) types only the legacy document,
has no callers and is deleted with its `index.ts` export. Documentation that describes the
retiring modules (`docs/reference/architecture.md`, `diagrams/architecture.md`,
`diagrams/overall-flow.md`) is updated after the cutover.

No new drawing, schema number, legacy reader, migration, alias, forwarding shim, Room frame,
Camera model, shell or persisted state is introduced. Curved-authoring identities remain
outside accepted intents under the existing tripwire; this slice preserves curve algorithm
coverage without authorizing curve UI.

## Implementation sequence

1. **Inventory and coverage map.** Record every import/export of the retiring modules and
   legacy document entry points, including tests, registry consumers and the architecture
   assertions. Map each removed fixture assertion to its wall-first successor and the same
   defect it detects. Preserve full dense/exhaustive cases; equivalent assertion text alone
   is not successor evidence ([test doctrine](../../../../../apps/editor/tests/README.md#successors-and-deletion)).
2. **Assign the live vocabulary.** Move `LayoutVec2` to a neutral coordinate module;
   `LayoutObject` to the wall-first document owner; `DraftPath`, `DraftSegment` and
   `LayoutInteriorAnchor` to a wall-first path module; the opening input record to the
   compiler input owner; `LayoutDocumentIssue` and `LayoutDocumentValidationError` to a
   neutral issue module. Use descriptive owned modules, not a relocated legacy barrel; the
   package root `index.ts` exports them like any other owned module.
   Repoint `layout-wall-first-types.ts`, `layout-wall-first-codec.ts`, compiler/geometry
   modules and all consumers directly. Keep value/issue behavior and import boundaries.
3. **Retype the one compiler.** In `layout-geometry.ts`, `layout-geometry-types.ts` and
   `layout-geometry-validation.ts`, express `CompilerSource`, `CompilerFloorEntry`,
   `CompilerFloorSource`, `CompilerRoomSource`, `CompilerBoundarySource` and
   `CompilerOpening` on the live owners; eliminate `Pick<LayoutRoom | LayoutFloor, …>`
   coupling and legacy room/floor validation parameters. Preserve
   `compileWallFirstLayoutGeometry` → the single canonical `compileLayoutGeometrySource`
   dataflow, topology/Junction/Room reconciliation and renderer-facing records.
4. **Migrate the bounded cross-track consumers.** Move `normalizeLayoutRoomYaw` into
   Scene's `scene-planning/frame.ts` owner without changing its numerical behavior.
   Remove the legacy `LayoutFloor`/`LayoutRoom` dependency from `LayoutRoomRegistryEntry`
   with T3's reader/Camera review. Inspect all registry consumers before choosing its
   minimal surviving type: current registries are empty, explicit room lookups refuse,
   and absent-frame point conversions are identity. Preserve those behaviors and the
   world-local Scene reader's refusal of authored `roomId`. Do not manufacture live
   Room frames or silently change Camera evaluation. If the facade cannot lose those
   types without domain redesign, stop and report for an explicit scope decision before
   deleting them; S02 stays blocked.
5. **Re-fixture, then remove.** Convert the legacy compiler fixture/test family to
   wall-first documents and expectations explained by topology-derived Rooms:
   `layout-geometry.test.ts`, `layout-g2-fixtures.test.ts`, `layout-scale-compile.test.ts`,
   `layout-geometry-boundary.test.ts`, `wall-geometry-adapter.test.ts`,
   `wall-mesh-fixtures.ts`, `layout-g2-fixtures.ts`, `layout-scale-fixtures.test.ts`
   under `apps/editor/tests/`, plus the legacy document sources `__fixtures__/layout-g1-fixtures.ts`
   and `__fixtures__/layout-scale-fixtures.ts` and their downstream consumers
   (`wall-mesh-builder.test.ts`, `wall-mesh-watertight-matrices.test.ts`,
   `junction-matrix.test.ts`, `junction-partition.test.ts`, `shared-walls.test.ts`) and any
   further consumer step 1 finds. `tests/helpers/**` edits trigger the test manual's
   every-lane-plus-full-suite rule. Preserve g1's rectangle, L-shape, auto-bezier, multiple
   openings, profile matrix, elevation, objects and invalid geometry, and every distinct
   g2/scale/mesh primitive. Before editing any fixture, capture compiled-output observations
   for every converted case on the trusted base (a committed, deterministic snapshot or
   differential artifact) and cite its commit/path in the acceptance record, so semantic
   re-fixturing is distinguishable from unintended compiler change. A primitive that cannot be expressed
   is a stop-and-report, not deleted coverage or a legacy compatibility path.
6. **Delete the old surface.** Remove `layout-types.ts`, `layout-codec.ts`,
   `layout-room-frame.ts`, `layout-portals.ts`, `compileLayoutGeometry`/`legacyCompilerSource`,
   their exports in `index.ts`, and legacy document creation/parse/serialize/validation entries,
   including `LayoutIssue`, `LayoutValidationResult`, `LayoutDocumentValidationResult` and
   `validateLayoutRoomGeometry` unless step 2 assigns a live owner.
   Retire `deriveLayoutRoomFrame`, `layoutRoomPoint` and `layoutRoomLocalPoint`;
   retain only live, newly owned algorithms. Update documentation that describes the
   retired implementation after the actual cutover, without presenting levels or
   structures as landed.
7. **Enforce ownership.** Change `layout-geometry-boundary.test.ts` from pinning the old
   adapter/module map to proving its absence, one canonical compiler and wall-first
   consumers. Add negative and positive controls for new boundary assertions. Search
   the entire affected graph for lingering legacy imports and public entry points.

## Verification and acceptance

Iteration follows affected fast contracts and complete dense/heavy contracts. Before
acceptance record exact revision, commands, results, fixture coverage mapping, intentional
semantic deltas, the pre-removal observation artifact and T3/T2 review of both cross-track
exceptions. The declared tier routes
integrated exhaustive proof to S04; it does not narrow the implementation-PR merge gate.
Follow [the test contract](../../../../../apps/editor/tests/README.md#what-a-change-requires):
root `npm run check` / `npm run build`, affected shared-package checks, fast, heavy,
full editor `npm test`, unconditional arch, `npm run check:api` and DB-backed
`npm run test:api` with zero skips. Record the DB target without credentials. Root
checks never stand in for API checks. Do not weaken assertions to make retirement pass.

Acceptance requires:

- Every retiring module/export and authored legacy entry is absent; current readers stay
  format 6 only, with no migration or compatibility path, and no unowned shim remains.
- Wall-first codec/issue behavior and identities are preserved; equivalent compile cases
  retain topology, curves, Junctions, source correspondence, Rooms and renderer geometry,
  with each necessary fixture delta justified rather than blindly re-frozen.
- Each legacy algorithm assertion has a defect-equivalent successor in its appropriate
  lane; the full kernel/architecture/mesh and visitor/public boundaries pass.
- Registry refusal/identity-frame behavior, Scene yaw math, Camera callers and current
  project/API admission and Save/reload remain correct through their actual call sites.
- The retirement condition is discharged in the T1 track/evidence row only after accepted
  implementation; S02 readiness names the merged retirement revision. No gate is provided.

This plan adds no performance waiver. Use the ratified on-demand performance contract if
compiler behavior/work changes materially; correctness counts are not latency evidence.
S01's still-unrun F2 S/M timings remain assigned to S04 on the designated M2, unchanged.
S04 remains the final gate; acceptance here closes neither phase nor track.
