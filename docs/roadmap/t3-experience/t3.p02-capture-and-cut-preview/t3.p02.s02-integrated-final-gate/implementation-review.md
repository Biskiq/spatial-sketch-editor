# T3.P02.S02 — implementation review

**Slice:** T3.P02.S02 · **Plan:** [Integrated final gate](./implementation-plan.md) (owns the criteria) ·
**Acceptance:** [acceptance.md](./acceptance.md) (owns the result) · **Status:** implementation reviewed;
owner acceptance pending. This record states what was built, the bounded decisions the plan deferred to
review, what the two independent review rounds found, and how each finding was resolved. It claims no
acceptance, gate state, phase closure or commit for the slice.

## What was built

```text
slice     first Guide, real Camera handover/return, bounded Round 2 Capture/Guide expression
revision  6df26f3e (implementation 44990fad, Preview-chrome fix 035965e8, journey spec 6df26f3e)
writers   packages/project-model/src/units/planning.ts            additive Experience intent
          apps/editor/src/lib/authoring/experience/commands.ts     typed intents
          apps/editor/src/lib/authoring/experience/preview-handover.ts  new handover sequencing
          apps/editor/src/lib/authoring/stage/camera-session.ts   existing-session handoff methods
          apps/editor/src/lib/authoring/experience/ExperienceSurface.svelte  dock, first Guide, playback
          apps/editor/src/routes/project/[projectId]/spatial/+page.svelte   Preview entry/exit, chrome guard
          tests/lib/experience/{first-guide,preview-handover}.test.ts
          perf/flows/{preview-lifecycle,integrated-journeys}.spec.ts
```

### First Guide

`experience-guide-create` is one deterministic Experience planner: it creates the first Guide and its
initial distinct Stop from an existing Presentation, names the Guide the Experience's explicit
`entryGuideId`, and writes Guide, Stop and entry role in one candidate with one change and
correspondence set. `experience-capture-bind` gains an optional `firstGuide` payload so a capture
installs View + Presentation + Guide + Stop as **one** accepted result and one undo payload. Reusing a
Presentation creates a fresh Stop identity that enters the Presentation's own View: no Camera pose or
FOV is copied and no Connection is manufactured. Every refusal (second Guide, missing Default View,
duplicate captured identity, unknown continuation target, invalid entry View, Stop naming neither an
existing Guide nor the first Guide) returns before the candidate exists, so no history or source write
happens. Undo restores the prior entry Guide and both units; Redo replays the captured ids.

### Real Camera handover and return

Preview now enters through the landed F3 Camera-output protocol: the Stage's inspection run is replaced
by a `role: 'preview'` run through the ordered handoff, which issues the Camera-owned return token. The
handover refuses when the Stage holds no inspection claim, so Preview can never take an output without a
return context. While Preview holds the output the Stage has no ticket, so no Stage intent can present
against it. Exit returns the output to the inspection run under a strictly newer epoch; a source change
runs the protocol's rebase, ends both claims and voids the return, so exit restores nothing instead of
reinstating a stale pose. A delayed completion, cancel or return that names a spent ticket is refused as
`not-owner` and cannot clear a newer owner. The Preview session still evaluates through the shared
Experience lowering/interpreter and Camera authority; it writes no source, selection or history.

`apps/editor/src/lib/authoring/experience/preview-handover.ts` is pure sequencing — run-epoch and token
minting plus the host's two transitions. It adds no ownership state: `CameraSession` remains the one
holder of `ticket` and `preview`. No new host authority or general shell API was added.

### Bounded Round 2 expression

- The Experience dock is the lower working edge: `Select` (the pointer tool), `Capture` and `Guide`.
  Every key submits through the surface's one F4 acceptance port.
- `Capture` has exactly one home (the dock). The Presentations column keeps its explanatory hint and
  no longer duplicates the operation; "Capture and rebind" remains a distinct Presentation operation.
- The Guide instrument is invoked from the dock and sits above it, centred on the Stage
  (`.lens-surface`), instead of the superseded right-hand column placement.
- The Head and Index are authoring chrome and are **not mounted** while Preview owns the output; they
  remount on return with the same selection and history. Without this, Undo/Save/selection in the Head
  would remain a second writer over a source the isolated run does not own.
- The first Guide's label field doubles as the capture-side request: a non-empty label asks Capture for
  the first Guide, an empty one keeps the capture Guide-free. That is the one place the request is
  expressed; there is no mode and no second Capture control.

## Decisions the plan left to this review

```text
entry stop            the first Guide's entry Stop is its initial Stop (the only Stop it has); later
                      Stops are added through the existing stop-create intent
entry Guide           set only when the first Guide is created, never inferred for other Presentations;
                      Guide-free capture and Preview stay possible
Stop membership       a Stop must join a Guide; a payload naming neither an existing Guide nor the
                      first Guide is refused rather than installing an unreachable Stop
Preview epoch         minted over max(epochFloor, current claim, host counter) so ownership never moves
                      backwards; at the protocol ceiling the handoff refuses instead of reusing an epoch
return token          derived from session epoch + run epoch; it identifies the return context but is
                      never trusted as a claim by itself
cancel                the host has no Preview cancel path: exit either returns or, after a rebase, finds
                      no claim and restores nothing. Cancellation is a protocol capability the tests
                      exercise; the host does not use it to avoid a second exit semantics
failure paths         the lazy visitor chunk loads before ownership moves; a failed load, a changed
                      source or a disposed facade leaves the Stage owning the output
```

## Independent review

Two independent passes read the change as one diff. No file was edited by a reviewer.

```text
round 1  major  capture-bind accepted a Stop with guideId:null and no firstGuide, installing a Stop no
                Guide orders (unreachable in Preview)
         minor  Capture had two homes (dock and Presentations column)
         minor  openPreview's catch claimed the Stage kept the output after ownership could have moved
         note   nextPreviewRunEpoch at the protocol ceiling surfaces the protocol's refusal wording
         clean  no return-context-less takeover; rebase/stale-owner paths; atomicity and history;
                planner refusals; Guide-free payload compatibility
round 2  medium the Head and Index stayed mounted over the isolated run (authoring chrome reachable
                while Preview owns the output)
         minor  closePreview committed to leaving before the return was known; a refused return left the
                Stage with no inspection claim
         minor  two journey-spec comments claimed more than their assertions proved
         clean  handoff/return protocol use, facade epoch order, first-Guide identity and Camera
                non-copy, authorship/authority and boundary suites
```

Resolution, all in this slice:

1. The orphan-Stop payload is refused before the candidate exists, with a refusal probe that tampers the
   payload and asserts no history entry.
2. The Presentations-column Capture button was removed; the dock is the single home.
3. `openPreview` catches only the dynamic import, rechecks the session and facade after the await, and
   the handover refuses when the Stage holds no claim — so its message is true on every path.
4. The epoch-ceiling behaviour is documented in the helper as a refusal rather than a silent reuse.
5. The Head and Index are unmounted while Preview holds the output; the journey spec asserts their
   absence, along with the surface and dock.
6. A refused return re-acquires the host's inspection claim through the facade before reporting, so the
   Stage is never left without a claim after a newer owner claimed the output.
7. The journey spec now asserts the isolation it describes and proves reuse with the Presentation card's
   own fact list (one View), not only row text.

## Verification

`VERIFICATION: exhaustive`. Commands and results are recorded in the
[acceptance record](./acceptance.md#verification-record); that record owns the numbers, the tested
revision and the rows that remain unrun. No focused run is presented as acceptance evidence.

## Limits this review does not waive

The owner-operated reference-machine measurement, its trace method, the dense 20/50-View and 15/30-Stop
browser fixtures, touch/coarse-pointer journeys and a browser Save/download/reload journey are not
claimed here. The [acceptance record](./acceptance.md) lists every unrun row explicitly.
