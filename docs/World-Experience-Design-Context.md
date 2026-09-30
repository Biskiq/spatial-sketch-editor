# World | Experience — context for the next design phase

**Status:** compact design input, not a shell design or a competing architecture
contract. The live owners are the [North Star](./reference/north-star.md),
[architecture](./reference/architecture.md), [F contract](./reference/composition-execution.md),
[Camera contract](./reference/components/camera-tour.md), and
[shell/visual-system contract](./reference/design-system/editor-shell-and-visual-system.md).
The [product model](./World-Experience-Model.md) supplies behavior intent;
the [architecture synthesis](./World-Experience-Architecture-Synthesis.md) is
reconciliation provenance. Current Scene | Camera shell behavior remains
landed until an explicit cutover.

## Must preserve

- One project with World | Experience creator-facing lenses; World is not a
  `WorldDocument`. Layout, Scene, Camera, Experience, typed resources, project
  coordination and execution session remain distinct authorities.
- One Camera authority for Views, connectivity/routes, framing/projection and
  movement evaluation, including edits exposed through Experience controls.
  Cut invents no spatial edge; Travel resolves a supported route or reports a gap.
- World source truth separate from Experience presentation and Preview/session
  state. Transient inspection is not an authored View until explicitly captured.
- Presentations without a Guide; Experience-wide Interactions without a
  Presentation; repeated Stops referencing one Presentation. Guide order is
  separate from Camera spatial topology and legacy node order has no second
  writable life after cutover.
- Presentation identity, Stop occurrence identity and session visit/run identity
  remain distinct. Activities invoke real domain capabilities, optionally
  through reusable performance resources.
- One coherent selection, history and atomic project-acceptance path across
  lenses. Unresolved authored bindings remain visible and repairable; required
  Preview/publication behavior needs executable closure.
- One semantic lowering/execution path for Preview and visitor delivery,
  runtime-safe domain evaluation, and visitor/editor isolation. Runtime state
  never mutates authored World truth.
- T1's continuous viewport/projection seam for authoring. T3 data may advance
  alongside T1/T2; rich Activities wait for their specific real capabilities.

## Open to the designer

- World | Experience shell composition and transition between lenses.
- Navigator and Inspector hierarchies, including Presentation browsing and
  selection.
- Guide placement, Camera control exposure and contextual bottom deck.
- Plan/3D/continuous-view presentation and contextual inspection instruments.

These choices must retain the shell contract's visual roles, state language,
canonical identity and one writable control owner per fact. Current panel
placements and the Scene | Camera axis do not prescribe the replacement.

## Design / Prototype V2 hypotheses

1. Promoting an interior View into a Guide Stop may change entry framing alone
   or imply a supported explanation entry point. Test the creator and visitor
   meaning before naming a checkpoint policy.
2. A detour may suspend its parent Presentation invocation or constitute ordinary
   departure/re-entry. Test lifecycle, narration and Activity continuity in the
   integrated shell before selecting a default.

**Exact baton:** design the World | Experience information architecture and
interaction/visual shell against these constraints, then test the two hypotheses
in integrated Prototype V2. Do not treat this context as a T1/T2/T3
implementation plan or a production cutover.
