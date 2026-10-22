# T1.P02.S01 — acceptance record: Layout identity and format cutover

**Slice:** T1.P02.S01 · **Status:** implemented 2026-10-22 on
`t1/p02-s01-layout-identity-format-cutover` (batch E, E7) — §1 and §2 complete, §3 filed as a
stop-and-report; verification recorded below; not reviewed, not accepted, no acceptance recorded ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the scope and criteria) ·
**Phase:** [T1.P02](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

This record carries the verification evidence for the implemented slice: the plan's declared tier
with the exact commands and their actual counts, the plan items with the evidence that proves each,
and the deviations a reviewer must judge. It records **no acceptance**: `T1.P02.S01` has not been
reviewed or accepted, so it claims no gate state, no capability entry and no acceptance. It is not
the phase's final gate either — the deferred exhaustive proof routes to
[`T1.P02.S04`](../t1.p02.s04-integrated-final-gate/acceptance.md).

The command counts below are the committed tree's, each lane re-run after the last edit of the
commit that carries this record.

## Stop-and-report: legacy Layout type retirement (§3)

**Filed 2026-10-22. Outcome: the separation is larger than this slice.** The plan's §3 escape hatch
applies and is used rather than worked around: *"If that separation proves larger than this slice,
stop and report so it becomes its own slice before S02; do not carry it past the phase."* The
retirement did not land with the format-6 cutover. It was not half-migrated either — nothing was
renamed, relocated, re-exported, marked deprecated or moved behind a shim, and the deferred row now
records this condition in the [track README](../../README.md) (Deferred-retirement rows with exact
conditions) and the [retirement evidence row](../../planning-evidence.md#17-legacy-layout-typescodec-retirement-row).

### What blocks the retirement

1. **The legacy modules do not host only legacy document types.** Of the 46 modules in
   `layout-core/src`, 36 import `layout-types.ts`, 9 import `layout-codec.ts` and 2 import
   `layout-room-frame.ts`. The definitions wall-first modules take from `layout-types.ts` are live
   vocabulary, not legacy residue: `LayoutVec2` (129 files repo-wide), `LayoutObject` (13),
   `DraftSegment` (12), `LayoutOpening` (8), `DraftPath` (6) and `LayoutInteriorAnchor` (4). The
   wall-first codec itself
   (`layout-wall-first-codec.ts`) imports `DraftPath`, `DraftSegment`, `LayoutInteriorAnchor` and
   `LayoutDocumentValidationError` from the modules §3 would delete.
2. **The one canonical compiler is typed on them.** `layout-geometry.ts` declares
   `CompilerOpening = LayoutOpening`, types `CompilerRoomSource.room` as
   `Pick<LayoutRoom, 'id' | 'wallThickness' | 'floorThickness' | 'ceilingThickness'>`,
   `CompilerFloorSource` as `Pick<LayoutFloor, 'id' | 'elevation'>`, and `objects` as
   `readonly LayoutObject[]`; `layout-geometry-types.ts` derives `ArchProfileKind` and
   `CompiledOpening.kind` from `LayoutOpening`, aliases `CompilerBoundarySource` against
   `DraftPath`, and `layout-geometry-validation.ts` takes `LayoutRoom`/`LayoutFloor` parameters.
   Separating them is therefore a redesign of the compiler's input model — the same authored-schema
   work the retirement row already names as the reason this was tied to T1's first cutover — not a
   deletion, and it changes the type surface every renderer-facing compiled record is built from.
3. **Eight test files test the thing being deleted.** `compileLayoutGeometry` is compiled over in
   `layout-geometry.test.ts`, `layout-g2-fixtures.test.ts`, `layout-scale-compile.test.ts`,
   `layout-geometry-boundary.test.ts`, `wall-geometry-adapter.test.ts`, `wall-mesh-fixtures.ts`,
   `layout-g2-fixtures.ts` and `layout-scale-fixtures.test.ts`, through fixtures that build legacy
   documents directly: the g1 set (eight documents: rectangle, L-shape, auto-bezier, multiple
   openings, profile matrix, elevated floor, object matrix, invalid geometry), the 387-line g2
   fixture, the 283-line scale fixture and the 456-line wall-mesh fixture. The
   [tests README](../../../../../apps/editor/tests/README.md) forbids deleting legacy algorithm
   tests merely because project readers stopped accepting legacy documents, so these have to be
   reconstructed as wall-first documents with re-baselined expectations — wall-first derives Rooms
   from Walls and Junctions instead of authored boundaries and frames — and each distinct primitive
   they cover has to survive. That is re-fixturing evidence, not an import rewrite.
4. **The arch lane pins the ownership map.** `layout-geometry-boundary.test.ts` asserts
   `packageFilesDefining('export function compileLayoutGeometry')` is exactly `layout-geometry.ts`
   and compiles `createEmptyLayoutDocument()`/`validateLayoutDocument()` there. Retiring the adapter
   rewrites an unconditional architecture assertion, so the arch lane joins the successor's
   acceptance obligations rather than riding along in this pass.
5. **One live cross-track type reference remains.** `packages/project-model/src/project-layout-semantics.ts`
   types `LayoutRoomRegistryEntry` with `LayoutFloor`/`LayoutRoom` for the retained visitor renderer.
   The registry is empty by construction and every room-keyed lookup throws, but its owner is the
   parallel-track reader cutover, not T1's wall-first surface; T1 cannot retire those two types by
   itself.

### What remains (the successor slice's scope)

- Move the definitions wall-first modules import to owners: `LayoutVec2` to a neutral coordinate
  owner, `LayoutObject` to the wall-first document, `DraftPath`/`DraftSegment`/`LayoutInteriorAnchor`
  to a wall-first path owner, `LayoutOpening` to a compiler-owned opening-input record, and
  `LayoutDocumentIssue`/`LayoutDocumentValidationError` to a neutral issue module.
- Re-type `CompilerSource`, `CompilerFloorEntry`, `CompilerRoomSource`, `CompilerBoundarySource` and
  `CompilerOpening` on those owners, with no `Pick<LayoutRoom | LayoutFloor, …>` left, and re-point
  `layout-geometry-validation.ts` off the legacy room/floor parameters.
- Delete `layout-types.ts`, `layout-codec.ts`, `layout-room-frame.ts` and the
  `compileLayoutGeometry`/`legacyCompilerSource` adapter pair, with the legacy document entry
  points they export (`validateLayoutDocument`, `parseLayoutDocumentJson`,
  `createEmptyLayoutDocument`, `serializeLayoutDocument`, `validateLayoutDocumentGeometry`,
  `validateLineRoom`); move `normalizeLayoutRoomYaw` to its only live consumer,
  `packages/project-model/src/scene-planning/frame.ts`, and retire the dead `deriveLayoutRoomFrame`,
  `layoutRoomPoint` and `layoutRoomLocalPoint`.
- Re-fixture the eight `compileLayoutGeometry` test files onto wall-first documents with no weakened
  assertion, and rewrite `layout-geometry-boundary.test.ts` to assert the retired modules are absent
  instead of asserting where they live.
- Retire `LayoutRoomRegistryEntry`'s legacy room types with the parallel-track owner.
- Verification: `npm run check`, the fast, heavy and arch lanes and `npm run check:api`, because the
  canonical compiler's input model and the wall-first codec's segment model both change.

Sequencing: the retirement must land **before S02 starts** and must not be carried past the phase.
It is not authorized by batch E, and no slice row was added for it here — the
[phase register](../README.md#slice-register) and its authorization column are the phase owner's to
write.

### What was left intact

`layout-types.ts` (77 lines), `layout-codec.ts` (707) and `layout-room-frame.ts` (148), the
`compileLayoutGeometry`/`legacyCompilerSource` pair in `layout-geometry.ts`, every export of those
modules and every consumer of them are unchanged from the trusted base. `index.ts` still re-exports
them. No compatibility shim, deprecation marker or forwarding surface was added for them.

## §1 identity-capture scope: two allocators left outside the capture model

§1 routes every Layout identity an accepted operation can create through the operation's capture. The
plan's line that "the occupancy allocators remain only as the refusal check that a captured ID is
unused" holds for those kinds (Wall, Junction, Room, Opening, Object). Two allocators mint ids for
kinds no accepted operation creates today, derive them from the document, and are recorded here as
deliberately outside that model rather than silently converted or quietly claimed:

| allocator | id it mints | why it is outside §1 |
| --- | --- | --- |
| `nextWallCurveKnotId` (`layout-wall-centerline.ts`) | `{wallId}:knot:{n}` | reached only from the curve planners (`planConvertWallToCurve`, `planInsertWallCurveKnot`, `planBendWallCurveKnot`, the `resolveProposedCurveChain` path) and from `planDissolveJunction`'s curve branch, which already threads a capture but mints this one knot from occupancy |
| `nextInteriorAnchorId` (`layout-geometry-curve.ts`) | `{segmentId}:anchor:{n}` | single call site, `legacyBezierToAutoBezier`, which is uncalled |

**Evidence of unreachability**, checked on this working tree: none of those planners has a caller
outside `apps/editor/tests` — `apps/editor/src` and `packages/project-model/src` contain no
reference to any of them, the editor's Layout precision adapter has no curve-authoring intent, and
the retained planners refuse a curve outright with `curved_wall_unsupported`. So no accepted intent
allocates either id, and no Redo can replay one: the §1 hazard is a rejected identity being re-minted
by an undo/redo cycle, and a shape no operation can produce has no such cycle.

**Retirement condition** (recorded in both call sites' doc comments as well): the first
curve-authoring slice must take a capture there and derive `{n}` from the operation's nonce before
that intent ships. Counting occupancy re-mints a `{wallId}:knot:{n}` an earlier operation already
retired, which a captured tombstone would then refuse — the exact defect §1 removes for Walls,
Openings, Objects and Rooms.

## Verification evidence

**Declared tier** (from the plan's front matter): `VERIFICATION: architecture-integration` with
`INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md`. Below that tier, this slice is
not `exhaustive`; the phase's integrated result is `T1.P02.S04`'s obligation, and the plan's own
verification line adds `npm run check:api` with the DB-backed `npm run test:api` at zero skips because
the API admits Layout units through the shared package.

**Commands and counts** (run 2026-10-22 from the repository root unless stated; each exit status 0):

| command | result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings (svelte-check, app + tests) |
| `npm run check:layout-core` | clean (`tsc --noEmit`) |
| `npm run check:project-model` | clean (`tsc --noEmit`) |
| `npm run check:api` | clean (`tsc --noEmit`) |
| `npm run test:fast` | 143 files, 1952 tests passed |
| `npm run test:heavy` | 9 files, 124 tests passed |
| `npm run test:arch` | 21 files, 172 tests passed |
| `npm test` (full suite) | 173 files, 2248 tests passed |
| `npm run test:api` | 11 files, 80 tests passed, 0 skipped (DB target `postgresql://localhost:5432/biskiq`, the default the API suites declare) |

The full suite is required, not optional: `apps/editor/test-lanes.ts` and
`apps/editor/tests/helpers/angled-plan-fixtures.ts` are in the change set, and
[the tests README's change-impact table](../../../../../apps/editor/tests/README.md#what-a-change-requires)
requires every lane such a change reaches plus the full suite at acceptance. `test:fast`,
`test:heavy` and `test:arch` sum exactly to the full suite (143 + 9 + 21 = 173 files; 1952 + 124 +
172 = 2248 tests), so no test sits outside a lane.

## What the plan asked, and what proves it

**§1 — captured, non-reusing identity.**

- One capture per operation, minted outside the document (`packages/layout-core/src/layout-id-capture.ts`),
  with every planner-reachable layout id derived from it. Proven by
  `apps/editor/tests/lib/layout/layout-identity-capture.test.ts` (5 tests, all five guards from
  acceptance criterion 1): delete then recreate a Wall, an Opening and a Room-birthing chain with no
  identity returning; Undo then a different edit cannot recycle an id while replaying returns the
  captured ids; save/reload/edit neither refuses nor reuses a captured id; a byte-identical
  recreation still gets a new id; and occupancy *refuses* a captured id instead of suffixing it.
- The plinth path moves to the same capture: `nextLayoutPresetObjectId` derives the id and
  `planCommitLayoutObjectPresetWithId` refuses any disagreement between captured and derived id
  (`packages/layout-core/src/layout-preset-explicit.ts`), exercised by `layout-presets.test.ts`,
  `layout-precision-adapter.test.ts`, `scene-operation-acceptance.test.ts` and
  `unit-acceptance-conformance.test.ts`.
- The working level is an explicit captured intent input on the adapter path
  (`readLayoutWorkingLevel` in the Layout precision adapter), which refuses when the captured
  `levelId` is not the accepted Layout floor; the retained planners then read `document.floor`,
  whose `id` stays stable.

**§2 — format 6 with a derived Wall role.**

- `LAYOUT_WALL_FIRST_FORMAT_VERSION = 6` and `KNOWN_LAYOUT_FORMAT_VERSIONS = [6]`
  (`packages/layout-core/src/layout-wall-first-types.ts`), so every other version fails
  `unsupported_format_version` rather than negotiating.
- The derived role is compiled from face membership (`packages/layout-core/src/layout-wall-role.ts`,
  `layout-face-extraction.ts`), the authored field is gone from the Wall shape and codec keys, and
  `planWallRoleChange` / `planPartitionToBoundaryRoomBirth` are retired with no remaining reference.
- The pre/post differential holds: `t1s01-format6-differential.test.ts` compiles the six CLASS 5
  matrix fixtures and compares a role- and cacheKey-neutral digest against values recorded from the
  base revision `55683981` (format-5 code), while asserting the derived role is `bounding` and every
  portal relation stays admitted. This is the acceptance criterion 2 differential; it is a
  whole-table kernel comparison, so it is a `heavy` file (`apps/editor/test-lanes.ts`) and runs in
  the heavy lane recorded above.
- Strict format (criterion 3): the refusal is pinned in both readers — the wall-first codec and
  `packages/project-model/src/units/validate.ts`, which validates a Layout payload through the codec —
  and the API Save path is covered by `apps/api/tests/save-units.test.mjs` in the `test:api` run
  above.

**§3 — legacy Layout type retirement.** Not implemented: filed as a stop-and-report below, with the
five blocking findings and the successor slice's scope.

**Criterion 4 — kernel invariants** are the heavy lane (9 files, 124 tests) plus the layout contracts
in the fast lane, all green with fixtures moved to format 6 and no assertion weakened: the two frozen
reference tables were re-frozen as recorded findings (see the evidence-integrity deviation below),
and their tests now pin the delta rather than absorbing it.

**Criterion 5 — no behaviour change for creators** is evidenced by the authoring journeys in the fast
lane (precision, manipulation, plinth, Scene placement, Save, Undo/Redo) and by the format-6
differential. The F2 open timings at S and M are **not** measured here: they are owner-operated
measurements on the designated MacBook Air M2, no timing harness exists in this tree, and the tests
README is explicit that a passing correctness suite is not performance evidence. That obligation
stays open and is listed under outstanding obligations.

## Deviations a reviewer must judge

1. **§3 stop-and-report** — the legacy retirement is larger than this slice and becomes its own
   authorized slice before S02. See the five blockers and the successor scope above.
2. **Two allocators stay occupancy-derived** — `nextWallCurveKnotId` and `nextInteriorAnchorId`, with
   the unreachability evidence and the retirement condition in the §1 scope section above.
3. **A frozen reference was re-frozen as a recorded finding** — the OR-1 correspondence table
   (`p23b11-correspondence-reference.ts`) moved because captured identity changes ids; every moved
   row is enumerated with its justification in that module's header, and a nonce-locality property
   in its test now proves that a different nonce moves identity-bearing content only. The P23B.4
   observed reference keeps its pre-optimization columns untouched and records the format-6 verdict
   delta in a separate expectation table with an exact moved-row list
   (`p23b4-consumer-observations.test.ts`); the P23B verdict fixture says where its 12 re-derived
   digests came from. This is the one place a reviewer should look hardest: a reference that silently
   becomes a snapshot of the code under test stops being evidence.
4. **The working level is enforced at the intent seam**, not as a new parameter on every planner
   signature: the adapter refuses a captured level that is not the accepted floor, and the retained
   planners keep reading `document.floor`. Same guarantee, narrower diff.

## Outstanding obligations

- **F2 open timings at S and M** on the owner's MacBook Air M2 (E6 amendment) — not measured in this
  pass; no benchmark harness exists in the tree.
- **§3 retirement slice** — authorized separately, before S02, not carried past the phase.
- **Review and acceptance** — this record is evidence for that judgement, not the judgement.
