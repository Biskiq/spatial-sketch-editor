# T2.S8 U5 — Professional Material Library (acceptance report)

**Historical record:** #406 merged with functional acceptance and open visual and interaction
findings. The review follow-up below records the disposition at merge. [#405](https://github.com/Biskiq/spatial-sketch-editor/issues/405)
tracks the remaining findings for forward U5 correction.

**Branch:** `t2-s8-u5-professional-library`

**Base:** `main@88aab2898` (T2.S8 U4, Finish Card #404)

**Plan-first commit:** `83603d7f6` — `T2.S8 U5: professional Library plan`

**Implementation commit:** `ff8e90be4` — `T2.S8 U5: professional Library`

**Reviewed head:** `a268f69fe` — all required CI checks green.

**Authority:** the S8 implementation plan, the approved #399 appearance prototype (D1, D8, D9),
the existing Library/Finish infrastructure, and completed U1–U4/U8.

## What shipped

- `StageLibrary.svelte`: the external Library sheet opened by the dock Library key, `L`, and Paint's
  browse action. It sits above the Index, keeps the lower dock usable, traps focus, restores it on
  close, and handles the detail → draft → sheet Escape chain.
- Kind rail for Materials, Objects, Artwork and Lights; source switches All, Curated, This project;
  family categories; search; Favourites, Textured, Plain colour, Metal, Matte, Glossy and Used here
  filters; explicit empty and refusal states.
- 21 curated entries in 20 D1 cards: Concrete is one card with Matte / Polished chips and a stable
  key while its variant changes.
- Detail pane: FinishTile preview, base, family, effective sheen, metalness, usage count, changes,
  image warning, target note, Apply, Use for Paint, Select all n, Customise… and favourite.
- Project Finish inspection uses the established Finish Card reach; Select all n is a selection,
  not a write.
- D9 seam: a non-destructive sheen draft with a visibly marked local preview. Opening or stepping
  it issues no authoring call. Apply is disabled until the draft differs from the current sheen and
  the target wears the draft's Finish; Apply is one accepted `scene-finish-patch` with one Undo.
- Paint integration: **Use for Paint** arms the normal Paint path through `pickMaterialKey`; it never
  assigns. Closing from Paint returns to the tray.
- Finish Card and thumbnail integration: project Finishes use the accepted scene Finish tile
  service; catalogue cards use 256 px masters only.
- Every Library close path (header, scrim, dock, Objects pick, applying/selecting) drops a draft;
  the dock Library key now toggles the sheet closed as the armed key promises.

## Acceptance evidence

| Acceptance | Evidence |
| --- | --- |
| Library navigation and filtering work | Browser QA at 1440×900 and 1024×768 opened the sheet from the dock, switched All / Curated / This project, filtered a family, searched, cleared filters and reached each kind shelf. At 1024 the materials grid rendered 8 columns with no detail and 5 columns with the 260 px detail pane, 21 cards, no horizontal overflow. |
| 21 curated materials scannable at 1024 px | The Curated source reported 20 D1 cards built from 21 entries; the Concrete card exposes Matte / Polished. Browser QA counted 21 cards in All and no horizontal scrolling. |
| Opening the Library causes no unnecessary full-resolution texture fetches | The Library browse model never reads a texture URI. Grid and detail render `FinishTile`; project detail showed a blob tile from the scoped Finish service, with no `background-image` URL. Network logs after opening the Library showed only `material-tiles/*` masters and script/font traffic; the only `/textures/*` requests were the Stage's initial scene render before the Library opened. |
| Draft previews produce no project writes | Service tests open and step a draft with an empty accepted-history list. Browser QA opened Customise on a project Satin Finish: Apply was disabled with “That sheen is already set. Choose another.”, the project Finish and Undo state did not change, and the sheet clearly read “Preview only · nothing written”. |
| Applying a draft uses the established authoring path with correct Undo/Redo | Service tests assert exactly one `scene-finish-patch` for in-place, just-this and curated materialization, then Undo restores the previous project state. Browser QA changed a project Finish through the draft (Matte), saw Library close with one Undo, Undid it back to Satin, and saw Redo become available. |
| Paint, Finish Card and thumbnail integration | Browser QA used the Finish Card to create a project Finish, then inspected it in This project with usage 1 and Select all 1. **Use for Paint** closed the sheet, armed Paint (the dock key read pressed), showed the Paint tray and left Undo disabled; it arms through `pickMaterialKey` + the route's Paint arm and never assigns. |
| Responsive layout, keyboard accessibility, empty/refusal states | Dialog semantics, focus trap/restore, Escape ordering and button-only actions are implemented. Browser QA saw the no-artwork empty state, no-match empty state, disabled Apply with its refusal reason, and a disabled Customise when no other sheen is reachable. |

## Owner review follow-up — #405 (2026-11-23)

The owner accepted U5's functionality and recorded six visual/interaction differences from the approved
[#399 appearance prototype](https://github.com/Biskiq/spatial-sketch-editor/pull/399) in
[#405](https://github.com/Biskiq/spatial-sketch-editor/issues/405). They are **not waived**: they are
deliberately deferred to the consolidated post-U7 QA PR. No visual-parity work was done on this branch.

| #405 finding | Classification | Disposition |
| --- | --- | --- |
| Workspace footprint (prototype bounded inside Stage; production near-full workspace; <=760 px bottom sheet not exercised) | **Confirmed U5 parity gap** | Deferred to #405; final QA covers desktop, 1024 and narrow/coarse-pointer. |
| Category hierarchy (families nested under Materials versus production's flat rail plus filter chips) | **Confirmed U5 gap** | Deferred to #405. |
| Card anatomy (square image window, borders, two-line names, overlay metadata versus production's smaller thumbnails and one-line names) | **Confirmed U5 gap** | Deferred to #405. |
| All-source grouping (compact project/library shelves with **See all** before the curated gallery) | **Confirmed U5 gap** for source grouping; the **My library** shelf's data is **U7, not yet delivered** | Grouping presentation returns with the post-U7 QA; no U7 placeholder or transfer work was added. |
| Card-click semantics (context choice plus `⤢` detail and Shift-keep-open versus click always opening detail) | **U5 interaction deviation requiring an explicit owner ruling** | Deferred to #405; not treated as a CSS-only fix. |
| Detail presentation (square interactive inspection preview and Sphere/Flat/Tile + Studio/Grazing/World selectors versus production's static 178×128 tile) | **U5 gap** for the static preview; the geometry/light selector component is **U6/E7 inspection work, not delivered** | Deferred; the final QA decides whether the interactive inspection lands there or with U6. |
| No screenshots and no <=760 px browser pass in U5 evidence | **U5 verification gap** | Deferred to the final QA's side-by-side prototype/production capture at desktop, 1024 and narrow/coarse-pointer. |
| Sheen-only, non-writing Customise draft versus D9's full editor draft | **Not a U5 defect** — the deliberate U5 seam | U6 owns the full Material editor; U5 adds no placeholder. |

U5's completed functionality, contracts and tests are unchanged by this classification. The temporary
`u5-library-plan.md` is removed at closeout; the accepted functional rules are promoted to
[Scene content](../../../reference/components/scene-content.md#material-and-light-semantic-gaps)
and the S8 status, and this report remains the retained acceptance evidence for the deferred parity
debt. The visual anatomy is not promoted while #405 is open.

## Verification

Commands run from `spatial-sketch-editor` (all exit 0):

- `npm run check` — 0 errors, 16 pre-existing warnings in 6 files.
- `npm run test:arch` — 38 files, 358 tests passed.
- `cd apps/editor && npx vitest run tests/lib/authoring/library` — 3 files, 21 tests passed.
- `cd apps/editor && npx vitest run tests/lib/authoring/spatial-route-gesture.test.ts` — 121 tests passed, including the Library object/artwork placement paths against the external sheet.
- `npm run build` — production client and server bundles built with adapter-vercel.

Browser QA used the editor-only dev server at `http://localhost:5173/project/u5qa/spatial?create=1`
in a guest session. `npm run dev:local` could not start because the Docker daemon was unavailable, so
cloud sign-in/save and the API-backed flows were not exercised. No screenshots were taken; behaviour
was checked through the preview's accessibility tree, DOM state and network log. The ≤760 px bottom
sheet was not separately driven.

## Findings fixed on the branch

- The Library sheet sat below the 20-z Index; raised the scrim and sheet above it so the sheet owns
  the whole workspace and its cards are clickable.
- Scrim covered the dock although the plan keeps the dock usable; it now ends above the lower column.
- The dock's armed Library key did not close the sheet; it now toggles through the route's Library
  command.
- Draft Apply could be armed on the already-current sheen for an overridden project Finish; the
  draft now refuses to Apply until its step changes, with a specific no-alternative message.
- Customise is disabled when no other reachable sheen exists, rather than opening a dead end.
- Project detail thumbnails no longer fall back to a full-resolution catalogue URI.
- Closing through the dock or an Objects pick left a stale draft; every close path now clears it.

## Boundaries

U5 delivers the Library UX only. U6's advanced Material editor, U7's transfer and any visible future
placeholder shelves are not implemented. The sheen draft is the deliberate U5 seam U6 replaces;
its no-write and one-Undo contract is what this work fixes.
