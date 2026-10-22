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

The command counts below describe the tree that carries this record: the cutover commit `8edc6487`
plus the review-pass commit that lands this text, each lane re-run after the review pass's last
edit.

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
Openings, Objects and Rooms. The condition is enforced by
`apps/editor/tests/lib/layout/layout-identity-boundary.test.ts` in the arch lane: it fails if editor or
project-model source references either allocator or the curve/dissolve planners that call them.

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
| `npm run test:fast` | 143 files, 1954 tests passed |
| `npm run test:heavy` | 9 files, 124 tests passed |
| `npm run test:arch` | 22 files, 173 tests passed |
| `npm test` (full suite) | 174 files, 2251 tests passed |
| `npm run test:api` | 11 files, 80 tests passed, 0 skipped (DB target `postgresql://localhost:5432/biskiq`, the default the API suites declare) |

The full suite is required, not optional: `apps/editor/test-lanes.ts` and
`apps/editor/tests/helpers/angled-plan-fixtures.ts` are in the change set, and
[the tests README's change-impact table](../../../../../apps/editor/tests/README.md#what-a-change-requires)
requires every lane such a change reaches plus the full suite at acceptance. `test:fast`,
`test:heavy` and `test:arch` sum exactly to the full suite (143 + 9 + 22 = 174 files; 1954 + 124 +
173 = 2251 tests), so no test sits outside a lane.

## What the plan asked, and what proves it

**§1 — captured, non-reusing identity.**

- One capture per operation, minted outside the document (`packages/layout-core/src/layout-id-capture.ts`),
  with every layout id an **accepted operation can create** derived from it. Proven by
  `apps/editor/tests/lib/layout/layout-identity-capture.test.ts` (5 tests covering all five guards
  from acceptance criterion 1): delete then recreate a Wall, an Opening and a Room-birthing chain
  with no identity returning; Undo then a different edit cannot recycle an id while replaying
  returns the captured ids; save/reload/edit neither refuses nor reuses a captured id; a
  byte-identical recreation still gets a new id; and occupancy *refuses* a captured id instead of
  suffixing it. The recreate step now also rebuilds the same gap *without* snaps, so the Junction
  ids it mints are genuinely compared with the deleted ones — the snapped rebuild reuses the
  surviving endpoints, and that is asserted as reuse rather than as a missed mint.
- The plinth path moves to the same capture: `nextLayoutPresetObjectId` derives the id and
  `planCommitLayoutObjectPresetWithId` refuses any disagreement between captured and derived id
  (`packages/layout-core/src/layout-preset-explicit.ts`), exercised by `layout-presets.test.ts`,
  `layout-precision-adapter.test.ts`, `scene-operation-acceptance.test.ts` and
  `unit-acceptance-conformance.test.ts`. `layout-presets.test.ts` also deletes a placed preset and
  re-places it at the same point, because that allocator's seed is occupancy-shaped
  (`layout-object-N`) and only the capture prevents a recycled identity there.
- The working level is an explicit captured intent input (`readLayoutWorkingLevel`,
  `packages/layout-core/src/layout-id-capture.ts`), which the Layout precision adapter enforces by
  refusing when the captured `levelId` is not the accepted Layout floor; the retained planners then
  read `document.floor`, whose `id` stays stable.
- The stale-capture guarantee does not rest on the nonce alone: an accepted edit moves the revision,
  and the acceptance coordinator refuses `stale-revision` before any planner runs, so a captured id
  from a superseded state cannot be replayed onto a newer document. Two id paths stay outside the
  capture by design and are named in the §1 scope section: `planDissolveJunction`'s curve knot, and
  `planCreateWallFirstOpening`'s optional caller-supplied `intent.id` (snapshot restore/import). The
  starter gallery's fixed `'starter-template'` nonce is the third, plan-sanctioned exception: template
  boot is deterministic by design and nonce-suffixed ids cannot collide with it.
- The condition that keeps the two occupancy allocators harmless is enforced, not remembered:
  `apps/editor/tests/lib/layout/layout-identity-boundary.test.ts` (arch lane) fails if
  `apps/editor/src` or `packages/project-model/src` ever references `nextWallCurveKnotId`,
  `nextInteriorAnchorId` or any of the curve/dissolve planners that call them.

**§2 — format 6 with a derived Wall role.**

- `LAYOUT_WALL_FIRST_FORMAT_VERSION = 6` and `KNOWN_LAYOUT_FORMAT_VERSIONS = [6]`
  (`packages/layout-core/src/layout-wall-first-types.ts`), so every other version fails
  `unsupported_format_version` rather than negotiating.
- The derived role comes from Room boundary membership as the reconciled document carries it
  (`layoutWallRoomMemberships`, `packages/layout-core/src/layout-wall-role.ts`); face extraction is
  the reason those boundaries are the reconciled faces, not a second authority the role reads. The
  authored field is gone from the Wall shape and codec keys — a payload that still carries `role`
  fails as `unknown_key`, pinned in `layout-wall-height.test.ts` — and `planWallRoleChange` /
  `planPartitionToBoundaryRoomBirth` are retired with no code reference (two comments still name the
  old planner by history).
- The pre/post differential holds: `t1s01-format6-differential.test.ts` compiles the six CLASS 5
  matrix fixtures and compares a neutral digest against values the header records as taken from the
  base revision `55683981` (format-5 code), while asserting the derived role is `bounding` and every
  portal relation stays admitted. What the digest excludes is deliberate and worth reading: `role`
  everywhere, and `cacheKey` because the Junction key embeds the role vocabulary. It is a regression
  guard whose expected values cannot be re-derived in-tree, not independent proof of the base
  revision's output. It is a whole-table kernel comparison, so it is a `heavy` file
  (`apps/editor/test-lanes.ts`) and runs in the heavy lane recorded above.
- Format 6's regeneration scope is covered: the starter gallery's fixed template ids
  (`apps/editor/src/lib/authoring/stage/starter-gallery.ts`), the curved-correspondence fixture
  (`apps/editor/tests/lib/layout/fixtures/curved-correspondence-repro.json`) and the affected suites
  are in the change set, and the fast/heavy lanes exercise them.
- Strict format (criterion 3): the version refusal is pinned at the shared reader and the editor
  admission path — `layout-wall-height.test.ts` (codec, by name, pure read) and
  `stage-source-admission.test.ts` (a Layout unit at `LAYOUT_WALL_FIRST_FORMAT_VERSION - 1`, i.e.
  format 5, refused through both `validateProjectEnvelope` and editor admission). The API Save path
  goes through the same `packages/project-model/src/units/validate.ts` reader and therefore inherits
  the refusal, but **no API-level test asserts a format-5 Layout refusal**: `save-units.test.mjs`
  proves the transaction and envelope contract, not the payload version. That gap is stated rather
  than papered over.

**§3 — legacy Layout type retirement.** Not implemented: filed as a stop-and-report below, with the
five blocking findings and the successor slice's scope.

**Criterion 4 — kernel invariants** are the heavy lane (9 files, 124 tests) plus the layout contracts
in the fast lane, green with the fixtures moved to format 6. No assertion was weakened where it
matters: the freeze test still asserts full per-row equality, the moved columns are pinned by exact
delta lists, and the OR-1 table's one-time re-emission is declared as an exception whose base-revision
comparison is recorded (see the evidence-integrity deviation below). One reference table was
re-emitted (OR-1); the P23B.4 table was **restored**, not re-frozen, with a separate expectation
column carrying its format-6 delta.

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
   the unreachability evidence and the retirement condition in the §1 scope section above. That
   condition is now enforced by an arch boundary test, so a future caller fails the lane instead of
   inheriting the hole. Two further id paths are named in that section: dissolve's curve knot (the
   planner already threads a capture but mints this knot from occupancy) and the Opening intent's
   optional caller-supplied id.
3. **One frozen table was re-emitted, one was restored** — the OR-1 correspondence table
   (`p23b11-correspondence-reference.ts`) was re-emitted once at the cutover, because captured
   identity changes every planner-minted id. That is a declared exception to the module's own
   "never regenerate over changed code" rule: the module states the exception, then records the
   field-by-field comparison of all 24 rows against base revision `55683981` (9 rows identity-only,
   2 lineage-order, 1 fidelity flip, 15 unchanged apart from trailing commas), and a nonce-locality
   property in the test proves a different nonce moves identity-bearing content only. The P23B.4
   observed reference was **restored**, not re-frozen: its pre-optimization columns are back
   byte-identical to `HEAD` and the format-6 verdicts live in a separate expectation column with an
   exact 15-row delta test (`p23b4-consumer-observations.test.ts`). The P23B verdict fixture says
   where its 12 re-derived digests came from. This is the one place a reviewer should look hardest: a
   reference that silently becomes a snapshot of the code under test stops being evidence.
4. **The working level is enforced at the intent seam**, not as a new parameter on every planner
   signature: the adapter refuses a captured level that is not the accepted floor, and the retained
   planners keep reading `document.floor`. Same guarantee, narrower diff.
5. **The API's format-5 refusal is inherited, not API-tested** — the Save path shares the units
   reader, but no `apps/api` test feeds a format-5 Layout payload. Adding that one case is the obvious
   follow-up if criterion 3 must be proved end-to-end rather than at the shared reader.

## Outstanding obligations

- **F2 open timings at S and M** on the owner's MacBook Air M2 (E6 amendment) — not measured in this
  pass; no benchmark harness exists in the tree.
- **§3 retirement slice** — authorized separately, before S02, not carried past the phase.
- **Review and acceptance** — this record is evidence for that judgement, not the judgement.
