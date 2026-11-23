# T2.S8 U3 — Colour coats (plan)

**Status:** plan-first commit of U3's draft PR. Tier 1 (contract detail inside the hard rules; no
persisted-format change). Deleted at merge once its enduring rules are promoted (see *Promotion*).

**Authority:** the approved appearance study (#399, decision **D3**: "a colour applied with Paint
keeps relief and sheen and becomes a deduplicated derived Finish … following the palette"), its
implementation rule *one coat Finish per base and colour*, and the S8 owner rulings in
[implementation-plan.md](./implementation-plan.md#owner-rulings-on-the-u-design-2026-11-22). U2
(#401) left the seam: `PaintColourPort` in `finish-authoring.svelte.ts`; the Colours tab appears as
soon as a port is supplied.

## Goal

Paint's Colours tab works. A colour painted on a surface or object keeps what the target wears —
relief (normal), sheen (roughness/metalness/occlusion maps and factors) and tiling — and replaces
only its colour. Equivalent coats share one derived Finish; palette coats follow the palette.

## Design

### The coat recipe (pure, in `@portfolio/project-model/scene-planning`)

A **coat** of colour `c` (a palette follower `{slot}` or a literal `#rrggbb`) over a target's
**source Finish** `S = (base, overrides)` is the Finish

```
base      = S.base
overrides = S.overrides
            with color      = c
            with maps.color = null   when S's base recipe binds a colour image
                              absent when it does not (an override image is dropped)
```

Every other override (roughness, metalness, occlusion, normal scale, mapping, other map
bindings) is kept byte-for-byte. Nothing new is persisted: `color: {slot}` and `maps.color: null`
are existing `pbr-metallic-roughness/v1` override vocabulary, so the Scene format, its validator
and every reader are unchanged.

**Source Finish per target:**

| Target wears | Source |
| --- | --- |
| curated `c` (entity `materialId`, surface `{materialId}`, or a pristine instance) | `{ catalogue: c }`, no overrides |
| project Finish `p` | `p.base`, `p.overrides` |
| nothing (an unassigned Layout surface) | `{ catalogue: 'plaster-warm' }` — the catalogue the Layout default look and `resolveSceneSurfaceLook`'s fallback already read |
| a model's own materials | **refused** — there is no Finish whose relief could be kept: "A model's own materials take no colour. Paint a material first." |

Coating a coat re-derives from the same base, so `Oak · Sage` painted Rose is exactly `Oak · Rose`.

### Dedupe

Identity is **canonical equality of `(base, overrides)`**, ignoring id and name. Before creating a
Finish the planner reuses the first project instance (document order, never a pristine one) with
the same identity; one request that coats many targets with the same source creates at most one
Finish. Ten unassigned walls painted Sage make one Finish; ten Oak walls and ten Concrete walls
make two. A slot follower and a literal of the same hex are different coats (the design's rule:
*colour is a palette slot or a literal*).

### Naming

`<material> · <colour>`: the catalogue label of a catalogue base (the planner's existing
`labelForMaterial`), or for a resource base the source Finish's name up to its first ` · `; the
colour is the slot's name or the literal's uppercase hex. A taken name gets the existing
`nextFinishName` suffix. Names are display-only; renaming or regenerating names on palette rename
is U4's naming rule, not U3's.

### One planner, one intent, one Undo

New F.4 intent **`scene-colour-coat`**, payload `{ colour, entityIds, surfaces }` (exactly one
of the two lists non-empty, as one Paint stroke paints one kind), targets = the exact entity
references or exact Layout surface references (same checks as `scene-finish-assign` /
`scene-surface-finish-assign`).

The editor and the planner share one pure function, `planColourCoats(scene, recipes, colour,
targets, labelFor)`, returning per target the reused Finish id or a *new-coat index*, plus the
ordered list of new coats. The editor allocates exactly that many `scene-finish` ids; the planner
re-runs the function on the accepted snapshot and refuses a count mismatch (`missing-allocation` /
`unexpected-allocation`), so the two can never disagree. Assignment then reuses the existing
`assignOne` (entities, pristine collection) and the surface-assignment writer; the write is
refused `no-change` when every target already wears its coat. Grant: changed entities or surface
keys, added materials, removed (collected pristine) materials.

### Palette following

Followers already resolve through the palette at render, thumbnail (U1 resolves followers into
`BoundInputs`, so the tile key changes with the colour) and inspection time; removing a slot
already literalizes its followers (`literalizePaletteFollowers`). U3 adds no palette code; it adds
tests that a slot edit recolours every Sage coat and that a removed slot leaves coats at its last
colour.

### Editor wiring

- `createColourCoatPort(services, …)` (new, `look/colour-coat-port.ts`) implements
  `PaintColourPort`: `paintEntities`, `paintSurfaces` (one `scene-colour-coat` acceptance each)
  and `isAlready` (every target's current Finish already equals its coat identity — no write, the
  painter's "Already Sage" line).
- The spatial page passes it as `colourCoat`, which turns on the Colours tab (U2's rule).
- **Hover feedback.** The painter's consequence line reads `Sage on this Wall face · keeps Walnut
  Wood relief and sheen` for a colour pick (the relief clause only when the source binds a normal,
  roughness or occlusion image), instead of the material wording `… replaces …`. A model's own
  materials under a colour pick show the refusal line in place, and the stroke skips them. Cobalt
  hover outlines are unchanged.
- **Dropper.** Sampling a coat arms its colour (slot or literal), as in the prototype; sampling
  anything else arms the Finish as today.
- Recents and favourites already record colours (`noteUsedColour`).

## Scope

In: the coat recipe, dedupe, planner + intent, port, Colours tab enablement, consequence wording,
coat-aware dropper, tests. Out (boundaries): Brush, layered materials, Finish Card/Colour modes
(U4), Library (U5), editor/align/import (U6), transfer (U7), any shell redesign. Materials painting
is untouched.

## Checks

- project-model unit: recipe per source kind (curated with/without colour image, project with
  override image, resource base, unassigned surface, model-own refusal); dedupe (ten surfaces → one
  Finish; mixed sources → one per source; existing equal Finish reused; slot ≠ literal); coat over
  coat; allocation mismatch refusals; `no-change`; pristine collection on models; Scene validates.
- palette: slot set recolours coats (resolved colour), slot remove literalizes.
- save/reopen: a coated envelope round-trips through the unit codec unchanged.
- editor: port + painter (`stage-host-tools`): colour stroke = one acceptance = one Undo/Redo;
  `isAlready`; consequence wording; tray shows two tabs with a port.
- thumbnails: a coat's U1 tile key differs from its source's and changes with the slot colour.
- Materials painting tests stay green unchanged. `npm run check`, `npm test`, focused browser QA.

## Promotion

At merge, the coat rule (recipe, source table, dedupe identity, naming) is promoted into the
Scene/Rendering reference contract next to the Finish model, and this plan is deleted.

## Risks

- Unassigned-surface base `plaster-warm` adds plaster's roughness relief that the flat default did
  not show; it is the catalogue the default already names and is reversible.
- Derived Finishes accumulate (no garbage collection of unused coats); matches today's project
  Finish lifecycle (unused-only remove is U4/U5's).
- Coat names do not follow a slot rename until U4's naming rule.
