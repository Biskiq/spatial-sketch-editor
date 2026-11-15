# T1 A7.1 — Pointed Opening profile (`layout.opening-hosted`)

**Authority:** T1 next-batch roadmap rev 3, A7 (Tier 0) — "Pointed Opening profile … one control
over one planner". Base `main` @ `825efc1e` (PR #350). Short plan, as the slice requires.

## Goal

Enable the **Pointed** profile in the Opening Ink plate. The profile, planner, validation and
geometry already exist; this slice connects the plate's one control to them and proves the
resulting Door and Window journeys through the real authoring pipeline.

No new Opening kind, planner, geometry algorithm, document field, format version or authoring
path. Format 7 and the canonical `pointed` encoding are untouched.

## What already exists (inspection)

- **Schema.** `LayoutWallOpening.profile` is `'rectangular' | 'rounded' | 'pointed'` in both the
  authored types and the compiler types (`layout-wall-first-types.ts`,
  `layout-geometry-types.ts`).
- **Planner.** `planCreateWallFirstOpening` writes `intent.profile ?? 'rectangular'`;
  `planUpdateWallFirstOpening` patches `profile` through the same canonical candidate gates.
  `WallFirstOpeningIntent` and `WallOpeningPatch` already carry it.
- **Adapter.** `opening-planners.ts` validates the three profiles and forwards `profile` to the
  create planner. `InkOpeningProfile` already includes `pointed`; the Opening placement session
  reads `memory.openingOptions.profile` for both preview and acceptance.
- **Other surfaces.** The precision palette (`LayoutOpeningPalette.svelte`) already offers
  Pointed, and `layout-opening-adapter.test.ts` already commits one pointed window by typed
  offset. The unreachable piece is the Ink plate's disabled button.
- **Validation.** `validateWallFirstOpeningSet` → `buildArchProfile` refuses a pointed head whose
  rise (half the width) exceeds the Opening height; the create/update planners refuse the whole
  candidate and write nothing.
- **Geometry.** `buildArchProfile` gives pointed the top boundary
  `[0, height − rise], [width/2, height], [width, height − rise]` with `rise = width/2`. The
  compiler attaches that `profileShape` to the Opening and its lintel section; the wall mesh
  builder adds the apex as a clip knot so the 3D lintel underside reaches it; Plan overlay,
  Unroll and picking read the same `topBoundary`.

## Change

1. **Ink plate.** `InkPlate.svelte`'s Pointed button becomes an actionable profile option beside
   Square and Arch: `aria-pressed` follows `snapshot.opening.profile`, and its click calls the
   same `setOpening(openingKind, 'pointed')` helper the other two use. That helper calls
   `inkSurface().controller.setOpeningOptions`, the one adapter-owned writer of the next
   placement's kind, profile and metrics. No DOM-local default, no second planner, no document
   write.
2. **Ledger truth.** `layout.opening-hosted`'s summary states the three profiles. A7 introduces
   no new capability id, so this is the existing row updated, not a new one.

## Acceptance (A7 wording, made concrete)

- **Creation, both kinds.** Choosing Pointed in the plate and placing a Door and a Window on a
  Wall face commits `profile: 'pointed'` with the plate's metrics; the accepted Opening compiles
  with the canonical pointed `profileShape` (apex at half width, full height).
- **Editing.** The existing Card measure writer (width, height, offset, sill) updates a pointed
  Opening without changing its profile and recompiles the pointed head; Undo/Redo replay the same
  Opening id. An edit that would make the head rise exceed the height is refused in words and
  writes nothing.
- **Preview/commit parity.** The ghost's profile, offset and width shown before the press are the
  values acceptance writes; one press is one history entry.
- **Undo/Redo.** Undo removes the pointed Opening; Redo restores the same id and bytes.
- **Save/Load.** The accepted document round-trips through `captureUnitSave` +
  `readUnitEnvelopeForSave` + `admitSource` with the pointed profile intact.
- **Plan/3D.** The compiled geometry carries the pointed profile shape and lintel; the existing
  Plan/3D priority journey covers selecting a pointed Opening in both readings. Browser QA views
  the drawn pointed head in Plan and through the aperture in 3D.

## Files

- `apps/editor/src/lib/authoring/world-toolbar/InkPlate.svelte` — enable Pointed.
- `apps/editor/tests/lib/authoring/layout-opening-adapter.test.ts` — pointed Door/Window creation
  through the Ink controller, preview/commit parity, geometry, Card edit, refusal, Undo/Redo,
  Save/Load.
- `apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts` — the mounted plate's Pointed
  control is enabled and drives the real Ink surface (call-site proof).
- `capabilities.json` — `layout.opening-hosted` summary.

## Out of scope

- A profile control for an already-selected Opening. No such control exists for Square or Arch
  either; the plate writes the next placement's remembered options, and the Card's writers remain
  measures only. Adding one is a design decision, not this slice.
- An independent pointed rise. The canonical profile fixes `rise = width/2`; a shallower or
  steeper head is a schema change.
- The World toolbar registry's planned-tool option data, which still marks Pointed disabled but is
  never rendered for a landed tool (Arc remains flagged there since A3 for the same reason).
- Visitor surfaces, format changes, new capabilities ids.

## Risks

1. **Rise is fixed at half the width.** A pointed Opening narrower than twice the desired head
   height is the only shape available; accepting that is the canonical profile, not a defect.
2. **`height < width/2` refuses.** The creator reads the existing planner refusal and nothing is
   written; this slice adds no fitting rule.
3. **The plate sets authoring defaults, not the selected record.** That is the established
   behaviour of its Kind and Profile rows; this slice does not change it.

## Checks

- Focused: the two affected editor suites; `npm run check`; `npm run check:layout-core`;
  `npm run test:arch`; `npm run test:fast`; `npm run build`.
- Focused browser QA of the creator journey in Plan and 3D.

## Open issues

Checked the open tracker before starting: #337, #336, #335, #334 (look/light pointer leases), #284
(Height Sheet), #280 (Experience lens), #273 (wall-draw-close perf selectors). None belongs to
the Opening profile slice; nothing is folded in.
