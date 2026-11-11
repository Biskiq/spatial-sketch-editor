# T1 S2 — Space conversion technical spike

**Status:** evidence complete for the draft spike PR. This is not production acceptance, an F4
result or an SP1 implementation.

**Base:** `d764d2eb` — the current `origin/main` when the spike worktree was created. It contains the
merged PR #290 (`d812afe9`). The approved plan named `d037fe0f`; `main` advanced by the docs-only
#297 before this branch was cut. Both commits contain the S2 authority.

**Authority:** [T1 next batch](../README.md) and its [implementation slices](../implementation-prs.md)
(S2), approved by merged PR #290.

**Scope:** test-only harness and this report. No production code, schema/format change, editor
integration, UI, SP1 implementation or approved-roadmap edit. No T2-owned file was touched.

**Evidence:** `apps/editor/tests/lib/layout/spikes/s2-space-conversion.test.ts` and its test-only
harness `s2-space-conversion.ts`. Run:

```sh
cd apps/editor
npx vitest run tests/lib/layout/spikes/s2-space-conversion.test.ts
```

Result on this branch: **13 tests passed, 0 failed**.

The suite labels every result as **production** (a real exported `layout-core` API) or
**simulation** (a synthetic candidate or harness policy). A simulation is feasibility evidence,
never production acceptance.

## Verdict

The S2 behaviours are executable and pass **in fixtures**:

- An exterior-Wall erase can keep the same Room record — id, name, thicknesses, object association,
  surviving Opening and intended boundary — through a virtual edge.
- Redrawing that edge through the real `planWallChain` preserves the same Room id and returns an
  all-Wall boundary.
- A shared-Wall erase still produces production's ordinary 2→1 merge.
- Removing the last Wall retires the unsupported Space and clears its object association.
- Snapshot Undo/Redo restores exact states; reconciliation replay is deterministic.
- The approved fallback is **not necessary**.

The zero-new-field hypothesis (R0) does **not** survive full boundary-authoring feasibility. It
preserves identity and supports a one-Wall restore, but the production compiler rejects the open
boundary, the certified world index refuses it, the existing polygon helper returns a wrong
triangle, and two adjacent erased Walls collapse their corner. The recommendation for SP-plan is
therefore **R1: keep the existing Room as the Space, add explicit virtual-edge records, and consume
them in the compiler and world index in the SP1 format bump**.

## Results

| S2 requirement | Fixture result | Kind |
| --- | --- | --- |
| Opened Room keeps id, name, thicknesses, associated content and intended boundary through one virtual edge | PASS — same `room-gallery`; 4-edge composed outline; 24 m² | Simulation |
| Redrawing the Wall restores a fully enclosed Room with the same id | PASS — same id, all-Wall boundary, no derived edge; codec, compiler and certified index all succeed | Production planner over a simulated open baseline |
| Shared Wall removal still merges Rooms | PASS — `room-left` survives, `room-right` retires, both object associations remap | Production |
| Final Wall removal retires an unsupported Space | PASS — no Room, no edge, object association cleared; codec and compiler accept the empty result | Simulation |
| Undo/Redo and reconciliation deterministic | PASS — exact canonical JSON through undo/redo; same-capture replay byte-identical; other-capture replay keeps the Room id and topology | Snapshot simulation (not F4 wiring) |
| Fallback probe | PASS — production retire-then-redraw gives a **new** Room id, unlike the surviving-Room path | Production |

### Independent production verdicts for an open Room

These are deliberately not collapsed into one “valid” answer. A polygon-producing compile would not
have been sufficient evidence either; the compiler produces no Room at all.

| Production gate | Verdict |
| --- | --- |
| Structural codec (`validateWallFirstLayoutDocument`) | **Accepts** the open Room: the boundary refs exist and the record is structurally valid. |
| Geometry compiler (`compileWallFirstLayoutGeometry`) | **Rejects** it as a Space: blocking `disconnected_boundary`, `roomCount: 0`. |
| Certified world index (`ensureLayoutWorldIndex`) | **Refuses** it: no certified index. |
| Face extraction | `0` faces, as expected for an open Wall chain. |
| Existing `roomBoundaryPolygon()` helper | **Wrong answer**: it assumes contiguous boundary refs and returns a 12 m² triangle instead of the intended 24 m² rectangle. |
| Explicit `virtualEdges` key on Room | **Rejected** by the codec as `unknown_key`; an explicit-edge encoding is a format change. |

The restore probe is equally explicit: `planWallChain` succeeds over a *synthetic* open-Room
baseline and preserves the id through the existing 1→1 correspondence. That is a feasibility result
for the production planner, not a production path — nothing in production creates that baseline
today. The editor/F4 transaction that would call it is out of scope and not proved.

## R0 / R1 / R2

**R0 — zero new fields.** Open, ordered Wall refs; virtual edges derived from consecutive-ref gaps.
It keeps one record and needs no Room field, but it fails the full Space requirement:

- compiler `disconnected_boundary` and zero compiled Rooms;
- no certified world index;
- `roomBoundaryPolygon()` silently drops each Wall's end vertex and returns the wrong area;
- two adjacent exterior Walls erased with a corner collapse into one straight gap (12 m² instead of
  24 m²), and the intermediate Junction is pruned;
- the editable-edge simulation can compose the right 26 m² and 25 m² outlines, but the production
  helper still reports 13 m² and 12 m². The geometry model is expressible; the production consumers
  are not.

R0 therefore proves simple derived-gap **identity preservation**, not full boundary-authoring
feasibility. It is not the SP-plan recommendation.

**R1 — explicit virtual edges.** A test-local `virtualEdges` list on the Room preserves every erased
stretch and its endpoints. The adjacent-Wall probe keeps two edges and the intermediate `j-c`
Junction, composes a closed 24 m² boundary, and keeps `wall-a`/`wall-d` as the surviving Walls. The
real codec rejects the key today (`unknown_key`), so R1 requires the format bump SP1 already plans.
It gives the compiler and world index an explicit edge to consume instead of asking them to infer
one from a gap.

**R2 — separate overlay/collection.** Design assessment only, not fixture-proved. It is larger than
R1 for this problem: `LayoutObject.roomId` and portal relations validate against the `rooms`
collection, so a second collection would need a new reference kind or duplicated Room records. It
does not solve the compiled-boundary problem by itself.

## Exact production changes required for SP1

Ordered by module; none is implemented here.

1. **Removal/reconciliation branch** — when a removed Wall bounds exactly one Room and at least one
   boundary Wall survives, keep that Room and record the erased stretch as a virtual edge. Shared
   Walls keep the ordinary 2→1 merge; zero surviving Wall refs retire. Virtual-edge anchor Junctions
   must survive the removal planner's reference-only pruning.
2. **Types and codec** — add the explicit virtual-edge record (ordered, endpoint Junction ids) and
   the stated overhead intent to the Space/Room shape; bump the format with strict refusal of the
   previous reader and no migration. `LayoutObject.roomId` and portal relations keep pointing at the
   same one record.
3. **Compiler** — consume virtual edges when building the Room floor/ceiling boundary and its
   polygon; the current `disconnected_boundary` path must become a valid open Space rather than no
   Room.
4. **World index** — certify an open boundary by composing Wall refs plus virtual edges, and include
   the virtual edges in the exact positive-face key/correspondence.
5. **Polygon consumers** — `roomBoundaryPolygon()` and every area/bounds consumer that assumes
   contiguous boundary refs must include the gap endpoints or read the composed boundary. The
   spike's 12 m²-versus-24 m² result is the concrete failure.
6. **Re-close** — no additional reconciliation change was observed: `planWallChain` already
   preserves the id through 1→1 geometry once the open baseline is accepted. Re-prove this after the
   format, compiler and index changes.
7. **Editor intent and UI** — opening/restoring, handle gestures, overlap stop and overhead controls
   remain SP1 work. Deferred and out of scope.

## Fallback verdict

**The approved fallback is not necessary.** The surviving-Room path keeps identity and content and
restores through the real planner; the explicit-edge shape preserves the multi-edge boundary. The
fallback — keeping only name and id through a re-close — would give up the open-interval identity,
the intended boundary and the associated content. The production retire-then-redraw probe confirms
the loss: the redrawn Room gets a new id. A fallback would only be justified if SP-plan rejected the
format change, and SP1 already requires one.

## Recommendation for SP-plan

1. Keep **one** persistent subject: the existing Room record is the Space. Do not add a second
   entity, a synthetic “virtual Wall”, or a boundary-ref union that changes every `wallId` consumer.
2. Encode the boundary as ordered Wall refs plus **explicit virtual-edge records**; derive nothing
   that SP1 must edit. Add the overhead intent in the same format bump.
3. Implement the removal branch, codec/types, compiler, world index and polygon consumers in that
   order. Reuse the existing 1→1 correspondence for re-close; do not add a new conversion planner.
4. Carry these fixtures into SP1 as regression evidence, and add the multi-edge and editable-edge
   cases the spike exposed.
5. Bump the format to 8 with strict refusal; no migration.

## Limits

- Core-only fixtures. No editor session, F4 acceptance, UI, browser or visitor path was exercised.
- `AuthoringHistory` proves exact snapshot restoration only; it does not prove editor transaction
  wiring or one-gesture history entry in the shell.
- Virtual edges are modelled as straight segments between surviving Junctions.
- R2 is a design assessment, not an executable comparison.
- A failed proof is a valid spike result; R0's full-boundary failure is reported as such rather than
  hidden behind the passing identity fixtures.
