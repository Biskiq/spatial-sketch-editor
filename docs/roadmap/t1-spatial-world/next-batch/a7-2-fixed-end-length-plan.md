# T1 A7.2 — Fixed-end choice on Wall Length

**Authority:** T1 next-batch roadmap rev 3, A7 (Tier 0) — "fixed-end choice on Card Length … one
control over one planner". Base `main` @ `17d86b00` (PR #352). Short plan, as the slice requires.

## Goal

Expose the explicit **Start / End** fixed endpoint beside the editable Length field in the selected
straight Wall's Card. Start stays the existing default; choosing End keeps the end and moves the
start. The choice is editor-local: it is not persisted, not part of the document, and not history.

No new solver, planner, document field, format version, geometry authority or capability id. The
Stage's length ray keeps its existing start-fixed pointer semantics.

## What already exists (inspection)

- **Controller.** `createLayoutInstrument` owns `fixedEndpoint` (default `'start'`) with
  `fixedEndpoint()` / `setFixedEndpoint()`. Both the typed length and typed angle commits pass it to
  `wallManipulationIntent`, so the intent carries `fixed` explicitly and never infers an anchor.
- **Intent and planner.** `layout-wall-length` payload is `{ wallId, length, fixed }`;
  `wallLengthPlanner` forwards `fixedEndpoint` to the retained `planExactWallLength`, which moves
  exactly the opposite Junction, carries every incident Wall, and gates the whole candidate through
  the canonical Opening-set, Room and identity validators.
- **Which subjects expose Length.** `layoutWritableFacts` offers `length` only for a straight, open
  Wall. A closed Wall offers radius/diameter; a curved open Wall offers neither length nor angle, so
  no editable Length control exists there to place a choice beside.
- **No writer on switching.** `setFixedEndpoint` only writes the controller's own state: it mints no
  operation id, takes no gesture lease, builds no intent and touches no document or history.

## Change

1. **Card control.** `LayoutCardFields.svelte` renders a compact two-option segmented control in the
   Length field's label row, `aria-pressed` following `instrument.fixedEndpoint()`. A click calls
   `setFixedEndpoint('start' | 'end')` and nothing else; `refresh()` re-reads the endpoint. An accepted
   edit rebuilds the controller for the same Wall, so the Card carries the chosen anchor across that
   rebuild rather than silently reverting to Start; a newly selected subject starts on Start. The
   control is shown only when the subject is a Wall and the writer offers a `length` field, which
   excludes Openings, curved Walls and closed Walls.
2. **Tests.** A focused Card suite proves the control's presence, default, call-site and no-write
   behaviour; the existing typed Wall-manipulation suite gains both endpoints end-to-end, the
   shared-Junction reach, Opening/Room identity, an atomic refusal with End chosen, Undo/Redo, and a
   no-write check for switching the choice under a real host.
3. **Docs.** This plan. No capability ledger row changes: A7.2 adds no capability id and no existing
   row names the Card's fixed endpoint.

## Acceptance (A7 wording, made concrete)

- **Both endpoints.** Start fixed keeps the start Junction and moves the end; End fixed keeps the end
  and moves the start. Each is one `layout-wall-length` install with the exact typed length.
- **Shared Junction consequences.** The moved Junction is the Wall's opposite end; every Wall that
  shares it follows, and the neighbour's far Junction does not move.
- **Opening and Room identity.** The hosted Opening and the enclosing Room keep their ids; the
  Opening's authored offset and width are preserved (or the whole candidate refuses).
- **Refusal atomicity.** An edit that leaves the hosted Opening unfit refuses in the planner's words,
  writes no source, adds no history entry and leaves the endpoint choice as it was.
- **Undo/Redo.** Undo restores the exact prior document; Redo reinstates the same Wall, Opening and
  Room ids and bytes.
- **No write on switching.** Changing Start/End changes neither the canonical source nor history,
  and submits no intent.
- **Browser QA.** The real Card shows the choice beside Length for a straight Wall, hides it for a
  curved and a closed Wall, and a typed length with End chosen moves the start.

## Files

- `apps/editor/src/lib/authoring/adapters/layout/LayoutCardFields.svelte` — the choice and its state.
- `apps/editor/tests/lib/authoring/layout-card-fixed-endpoint.test.ts` — new focused Card suite.
- `apps/editor/tests/lib/authoring/layout-wall-manipulation.test.ts` — typed-path acceptance.
- `docs/roadmap/t1-spatial-world/next-batch/a7-2-fixed-end-length-plan.md` — this plan.

## Out of scope

- The Stage length ray's anchor and the pointer gesture: they keep their landed start-fixed meaning.
- An Angle-side endpoint control or any Angle/transform UI expansion. Angle continues to honour the
  same controller endpoint because that is the existing shared solve, not a new control.
- Persisting the choice in the document, a session store, or across selection changes.
- A fixed-end choice on curved or closed Walls, which have no editable Length.
- Visitor surfaces, format changes, new capability ids.

## Risks

1. **A per-selection reset.** The controller is rebuilt when the selection changes, so the choice
   returns to Start for a newly selected Wall. That matches "editor-local, not persisted".
2. **End-fixed length moves the Opening in world space.** Openings are authored by offset from the
   Wall's start, so moving the start shifts them with the Wall; identity and measures are preserved.
3. **The choice also anchors typed Angle.** That is the controller's existing single explicit
   endpoint; A7.2 exposes it beside Length and adds no second angle control.

## Checks

- Focused: the new Card suite and `layout-wall-manipulation.test.ts`; `npm run check`;
  `npm run test:arch`; `npm run test:fast`; `npm run build`.
- Focused browser QA of the Card choice in Plan, including a curved and a closed Wall.

## Open issues

Checked the open tracker before starting: #353 (shadow artifacts / Artwork picking), #337, #336,
#335, #334 (pointer leases and look.light bugs), #284 (Height Sheet), #280 (Experience lens), #273
(wall-draw-close perf selectors). None belongs to the A7.2 slice; nothing is folded in.
