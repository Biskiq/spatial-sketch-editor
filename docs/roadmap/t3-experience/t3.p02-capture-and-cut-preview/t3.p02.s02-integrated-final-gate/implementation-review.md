# T3.P02.S02 — implementation review

**Slice:** T3.P02.S02 · **Plan:** [Integrated final gate](./implementation-plan.md) (owns the criteria) ·
**Acceptance:** [acceptance.md](./acceptance.md) (owns the result) · **Status:** implementation reviewed;
owner acceptance pending. This record states what was built, the bounded decisions the plan deferred to
review, what the two independent review rounds found, and how each finding was resolved. It claims no
acceptance, gate state, phase closure or commit for the slice.

## What was built

```text
slice     first Guide, real Camera handover/return, bounded Round 2 Capture/Guide expression
revision  f6de016d (implementation 44990fad, Preview-chrome fix 035965e8, journey spec 6df26f3e,
          warm-Preview entry f6de016d) + review fix fffe1c5a
writers   packages/project-model/src/units/planning.ts            additive Experience intent
          apps/editor/src/lib/authoring/experience/commands.ts     typed intents
          apps/editor/src/lib/authoring/experience/preview-handover.ts  new handover sequencing
          apps/editor/src/lib/authoring/stage/camera-session.ts   existing-session handoff methods
          apps/editor/src/lib/authoring/experience/ExperienceSurface.svelte  dock, first Guide, playback
          apps/editor/src/routes/project/[projectId]/spatial/+page.svelte   Preview entry/exit, chrome guard,
                                                                  warm surface lifetime
          apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte  run epoch, activity, hidden reuse
          apps/editor/src/lib/visitor/VisitorCameraDirector.svelte  per-run aim reset
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

### Warm Preview entry

A repeat entry used to rebuild the whole visitor surface — chunk, renderer, scene graph, textures and
first frame — on the press path. Nothing about the Camera handoff requires that. The surface is now
built once, at the Experience lens while the editor still owns the Camera, and stays hidden, inert and
rendering on demand; a Preview session only starts its run. Concretely:

- the visitor chunk, renderer and scene are built when the Experience lens opens, so the first press
  does not pay them;
- leaving Preview hides the takeover (`hidden`, `inert`, `on-demand`) instead of destroying it, and
  the source read it was built from is frozen so accepted authoring edits do not rebuild a hidden scene;
- the run identity is the entry's Camera epoch, not the component lifetime: a new epoch recreates the
  interpreter and resets the Camera director's aim, so a reused surface still starts a fresh run;
- no ownership changes: the Camera claim is taken and returned exactly as before, and the hidden
  surface holds no claim, writes no source and takes no input.

This is a rendering decision, which the phase explicitly leaves to the host: unmounting was never the
ownership protocol. Its price is one live visitor renderer (and its scene) while the editor is open
after the Experience lens has been used. While hidden it is put in on-demand rendering, `hidden` and
`inert`, so it paints nothing, can take no input and is not exposed to assistive technology; that is
a mode of the renderer, not a frame assertion, and the specs check the hidden/inert state and the
single surface rather than counting painted frames. A source replacement drops the surface (the
chunk stays cached) instead of keeping another project's scene alive, and the next lens entry warms
the new source.

Measured on an idle host at this revision, press → first rendering opportunity of the run (10 runs per
row, median / p95): S fixture 67.7 / 113.0 ms first entry in a fresh context, 52.7 / 71.8 ms warm,
55.0 / 173.7 ms repeat-use; M fixture 71.9 / 88.6 ms, 44.0 / 54.8 ms, 46.7 / 57.4 ms. That is the
entry's own floor: the mark is taken at the second rendering opportunity after the run starts, so
33 ms of the S repeat-use row is this harness's own frame budget at 60 Hz before any work is counted.
The S repeat-use p95 outlier (173.7 ms) is a single 263.8 ms sample in a row whose median is 55.0 ms;
no row shows work proportional to the scene, which is the point of not rebuilding it.

The harness has no press → frame row from before this change, so the improvement is stated as the
current measurement and the code fact that the press path no longer creates a surface; it is not
recorded as a measured before/after delta. The measurement is an opportunity, not a traced image; the
acceptance record states that limitation rather than calling it a compositor-verified frame.

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
warm surface          built at the Experience lens, hidden/inert between sessions, run identity by
                      Camera epoch; the read is frozen per entry so hidden surfaces do not rebuild
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

Independent passes read the change as one diff; rounds 1–2 reviewed the slice, round 3 (two
reviewers, opposite directions) reviewed the warm-Preview entry. No file was edited by a reviewer.

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
round 3  medium a source replacement kept the warm surface (its old scene, geometry and program alive)
                and could race an in-flight warm-up into installing the replaced snapshot
         minor  focus stayed on the Exit control inside the now-inert takeover after a return
         minor  a stale spec comment still said the surface "came and went"
         minor  the record claimed the press path was "the run only", although a changed read re-adapts
                the layout shells
         clean  no claim held or observed while hidden, no input or a11y reach, epoch 0 never active,
                fresh run per entry, no stale frame at reveal, specs assert what they prove
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
8. `activate` drops the warm surface with the source it was built from, and `warmPreview` rechecks the
   session token and the boot snapshot after its import, so a replacement neither keeps another
   project's scene alive nor installs a replaced snapshot's read; the lens effect warms the new source.
9. `closePreview` blurs a focused control inside the takeover, restoring the focus-to-document the
   unmount used to give.
10. The spec comment and the performance prose now say what the code does: the surface is kept warm
    rather than disposed, and a changed read re-adapts the layout shells on entry.
11. Two hardening notes were considered and declined as unreachable in ordinary use and outside the
    bounded host patch: the director's key guard when `document.activeElement` is null, and a
    redundant static-attribute assertion in the journey spec.

## Self review of the review fixes (owner request)

At the owner's request the fixes were re-read hunk by hunk instead of being re-measured. What that
check established:

- `activate` clears the surface, its view and its read in the same synchronous block that nulls
  `preview` and disposes the facade, so no frame can render the replaced scene and the takeover's
  `{#if}` unmounts exactly as it did when unmounting *was* the exit path.
- `warmPreview` captures the session token and the snapshot **before** its `await` and re-checks both
  after it; the install block is synchronous, so it either lands before a press (which then owns the
  surface) or bails. `openPreview`'s own post-import checks are unchanged.
- Clearing `previewSurface` re-arms the lens effect, so a replacement warms the new source; no other
  reader treats a non-null surface as a live session (activity is `preview !== null`).
- The blur only fires when the focused element is inside `.preview-takeover`, so Escape, lens switch
  and a source-change return cannot steal focus from anywhere else.
- No new import, export, route, binding or authority was introduced, which is why the arch and boundary
  lanes are unaffected by the fix.

One residual found and left as is: if a replacement lands *during* the warm-up's import, the in-flight
run bails and `previewWarming` stays true until its `finally`, so no second warm is attempted and the
next entry pays the (cached-chunk) mount once. It is correct — the press path still loads, checks and
hands over — and avoiding it would need extra state purely to keep one entry warm.

## Verification

`VERIFICATION: exhaustive`. Commands and results are recorded in the
[acceptance record](./acceptance.md#verification-record); that record owns the numbers, the tested
revision and the rows that remain unrun. No focused run is presented as acceptance evidence.

## Limits this review does not waive

The owner-operated reference-machine measurement, its trace method, the dense 20/50-View and 15/30-Stop
browser fixtures, touch/coarse-pointer journeys and a browser Save/download/reload journey are not
claimed here. The [acceptance record](./acceptance.md) lists every unrun row explicitly.
