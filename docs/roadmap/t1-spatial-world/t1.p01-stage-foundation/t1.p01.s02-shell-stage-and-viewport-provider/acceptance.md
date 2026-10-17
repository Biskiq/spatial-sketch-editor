# T1.P01.S02 — acceptance record: Shell, Stage and viewport provider

**Slice:** T1.P01.S02 · **Status:** implemented and locally verified 2026-10-16 (parallel batch of
2026-10-16); **no acceptance recorded** — the merge gate on the then-current `main`, the S06
integration route and owner adjudication are still owed ·
**Plan:** [implementation-plan.md](./implementation-plan.md) (owns the criteria) ·
**Phase:** [T1.P01](../README.md)

`T1.viewport-projection@1` stays `ratified` with empty evidence: nothing here is an accepted
capability record, and no consumer may claim readiness from this slice. The
`F1.reference@1:references-v1` / `F3.channels@1:inspection-v1` prerequisites are accepted on `main`
as the plan requires; they are not this slice's evidence.

## What this increment implements

The plan's seam-first order, all four layers:

| Layer | Artifact |
| --- | --- |
| Projection/inverse and pose family | `packages/camera-core/src/viewport-math.ts` (column-major right-handed kernel), `packages/camera-core/src/viewport.ts` (`evaluateViewport`, pan/orbit/zoom/Fit/Bring-into-view intents, the exact orthographic Plan endpoint and the projective transition between readings, `projectWorld`, `pointerRay`, `intersectWorkingPlane`, `advanceViewport`, `rebaseViewportSource`) |
| Layout Plan representation | `packages/layout-core/src/layout-plan-representation.ts` (cut/projected/hidden/symbol streams, Layout-native `PlanSourceRef` correspondence, per-source membership with measured reasons, union `reveal`, `eligiblePlanFragments`) |
| Content identity | `packages/project-model/src/content-identity.ts` (`computeSourceContentId`) and its invariance suite |
| Stage host (the seam's host half) | `apps/editor/src/lib/authoring/stage/`: `source-admission.ts` (the one door a source passes, with the host's own Scene catalogue), `boot-state.ts` (create/open intent, `loading`/`ready`/`new`/`missing`/`forbidden`/`error`/`refused`/`diagnostics`), `starter-gallery.ts`, `camera-session.ts` (one output, one controller, one evaluator over the landed F.3 ticket protocol), `stage-session.ts`, `stage-facade.ts` (`T1.viewport-projection@1` as the public surface: projection, ray, working-plane intersection, overlays, instrument tasks, adapter registration, Plan evaluation, bring-into-view, content rebase), `plan-parameters.ts`, `stage-input.ts` (keyboard map, text-entry guard, drag tolerance, reduced-motion clock) |
| Shell (PLATE composition) | `apps/editor/src/lib/authoring/stage/shell/`: one persistent Threlte `StageCanvas` with explicit `PCFShadowMap` rendering canonical Layout and Scene through the visitor's own renderers, `StageCamera` (copies evaluated matrices, authors no pose), `StageOverlay` (contributions projected through the same evaluation), `StageInstrumentHost`, `EditorHead`, `EditorIndex`, `EditorCard` |
| Route | `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`: read-only boot, explicit source-JSON open, starter gallery / empty replacement behind a confirmation, one `ResizeObserver` measurement, keyboard/focus host, reduced motion, teardown of every registered disposer |
| Mint entries | `/`, `/editor` (compatibility redirect) and the hub's *New Project* navigate to `/project/<minted id>/spatial?create=1`, so a minted identity is never read as a missing one |

Read-only is a call-site guarantee, not a convention: the host reaches the project GET and no write
path (`editor-host-no-write.test.ts`), and Save/Load, F4 intents, history and publish stay with
S03/S04/T3 as the plan states.

## Evidence (measured on this checkout, 2026-10-16)

```text
apps/editor  npm run test:fast    119 files / 1,636 tests passed
apps/editor  npm run test:arch     19 files /   155 tests passed
apps/editor  npm run test:heavy     8 files /   118 tests passed
apps/editor  npm run check          0 errors, 0 warnings
```

Suites written with the increment, by the guarantee each owns:

```text
stage-source-admission   admission equals runtime preparation; refused/diagnostics/admitted distinct
stage-boot-states        create-vs-open boot, every outcome state, and the mint call sites
stage-session            one accepted source slot, the session epoch, teardown
stage-content-change     content change vs replacement: one installation, one rebase, adapters ended
stage-facade             the public seam: projection/ray/plane inverse, overlays, tasks, Plan eval
stage-consumer-probes    a T2-style and a T3-style adapter consuming the seam through the facade only
stage-input              the keyboard map, text-entry guard, drag tolerance, reduced-motion clock
stage-shell-composition  (arch) one Canvas, one renderer set, no camera authority outside the realizer,
                         one viewport measurement and no CSS scaling of the surface
editor-host-no-write     (arch) the route host reaches no write path
```

Host contention note: the first fast-lane runs on this checkout timed out in three unrelated,
pre-existing CPU-bound suites (`camera-output-conformance`, `p23b4-shared-derivation`,
`p23b8-d5-identity-falsifier`) while the machine's load average was ~90; each passes alone and the
lane is green when the host is not oversubscribed. One of them (`camera-output-conformance`, a
>10,000-sequence exhaustive walk that measures 2.3 s alone) now declares its own budget instead of
inheriting the 5 s default, because that default measured machine load rather than its invariants.

## What independent review changed

Two adversarial reviews (host/shell correctness; test evidence) ran after the implementation was
green. Both findings were real defects, and each is now pinned by a test that fails on it:

1. **The `new` boot state was unreachable in the product.** `bootIntentFromSearch` offers the
   starter gallery only for `?create=1`, and no entry appended it — so every minted project id was
   read as `open`, 404'd, and landed the creator on `missing` ("Project not found"). The three mint
   entries now mark their mint, and `stage-boot-states` walks the route sources to hold the call
   site (a green `bootIntentFromSearch` proves nothing if nobody passes the flag).
2. **A settled reading flip never settled in the host.** `state.reading` advanced only when some
   later intent happened to arrive, so `evaluation.settledReading` stayed `3d` after a completed
   Plan flip — the route's `aria-pressed` toggle never showed Plan pressed — and the reduced-motion
   clock was `Infinity`, which dated the transition at `Infinity` and made its progress `NaN`.
   `camera-session.evaluate` now advances the session state at the frame clock it is given, and a
   reduced-motion reading request is dated one transition *before* the frame that draws it, so the
   first frame after the request is the declared endpoint through the one settling rule.
3. The review's test-evidence findings were folded in: vacuous `toBeDefined` assertions replaced
   with behavioural ones, decomposition counts handed back to the Layout suites, the unknown-asset
   refusal made to name the asset, the older-format refusal added, and the consumer probes written.

## Independent architecture review — three rounds (`eb0d94a`, `7c801808`, and the round-three fixes)

Three independent reviews ran against pushed revisions. Every finding was traced end to end — AM-5,
the S02 plan, the seam contract, the suites — before anything changed; one round-one finding described
a claim the implementation never supported, and two later findings were regressions the preceding
fixes introduced.

| Finding | Verdict | Disposition |
| --- | --- | --- |
| 1. Plan representation vs rendered geometry | real gap between the contract's display language and what S02 draws | **owner decision (2026-10-16)**: reduced S02 visual contract approved; completion obligation recorded and unassigned, below |
| 2. `StageAdapter.hitProvider` declared but unused | real: a registered T2/T3 picker was unreachable | fixed (and the built-in Layout pick was broken in 3D too) |
| 3. Project load not bound to the session epoch | real: a late GET or admission could install over a replacement | fixed |
| 4. Gesture policies stored, not executed | real: refusal ignored, cancellation leaked the lease | fixed |
| 5. Drag could select what it was dropped on (round two) | real **regression**: the round-one `endGesture` cleared the press origin before `click` | fixed; event-sequence regression added |
| 6. 3D Wall picking still used the Plan cut height (round two) | real: the face was built from the cut fragment, so the Wall above 1.2 m was unpickable | fixed; upper-Wall regression added |
| 7. A fragment could answer for a sibling Wall span (round three) | real: each fragment tested the whole Wall, so an earlier span claimed a later one and returned its own `subRef` | fixed; multi-span correspondence + eligibility regression |
| 8. A refused second pointer could end the first gesture (round three) | real: end/cancel ignored pointer ownership, releasing the holder's lease | fixed; two-pointer regression |

### 1. Plan display and the Plan cut — owner decision: reduced S02 contract approved

`evaluateLayoutPlan` yields `cut | projected | hidden | symbol` streams, per-source membership and
Reveal. `StageCanvas` takes `geometry: CompiledLayoutGeometry` and always renders that one canonical
set through the same runtime-safe adapters the visitor uses; the Plan *reading* is that geometry under
the exact orthographic endpoint. The representation therefore governs membership, Reveal, the Index
and hit eligibility — and it does **not** govern what pixels the Stage draws.

The reviewer is right that this is not the agent's call to move. The landed F3 language says Reveal
alters **display** and hit eligibility; this host changes hit eligibility only. Neither the approved
S02 implementation plan nor the current S04 plan explicitly assigns a Plan-cut renderer or the Sheet
that would drive it, so "S04 owns it" was an assertion the record did not support. It is withdrawn.

The two coherent options, both compatible with the invariants this slice keeps (one Canvas, one
Camera/projection authority, Layout-owned representation):

- **A — the reduced S02 visual contract.** S02 claims eligibility, membership, Reveal and the Index,
  not a Plan display contract. The cost is that the Plan reading draws the same geometry as 3D, so a
  source hidden above the cut is visible but not selectable until a Plan-cut renderer lands.
- **B — retain the Plan-display expectation in S02.** The Stage's Plan reading draws the
  representation's `cut` stream and withholds `hidden`/`projected` geometry, through the same Canvas
  and evaluation (a drawing selection, not a second renderer) — a larger change with its own
  regression set.

**Decided by the owner on 2026-10-16: option A.** S02 is not required to draw a Plan cut, and this
record does not claim one. The completion obligation — a Plan reading that draws the representation's
`cut` stream and withholds `hidden`/`projected` geometry, plus the Sheet that sets cut height and
depth — is recorded here as **unassigned**: no slice in the current roadmap owns a Sheet or a Plan-cut
renderer (S04 is Layout precision, not the Sheet), so the phase owner places it when the next shell
slice is planned. S02's acceptance does not depend on it. Until that slice lands, the Plan reading and
the 3D reading draw the same geometry, and a source above the cut or outside the finite depth is drawn
but not hit-eligible; Reveal restores eligibility without changing the drawing.

In the product's only boot document the distinction cannot be seen — the enclosure is four 3 m walls
plus a floor, all five sources `included`, 105 fragments, so drawn, eligible and reveal-able coincide
(verified in a browser against the live document).

### 2. Domain hit providers — real, fixed

`hitProvider` was declared on `StageAdapter`, documented as "eligible hit provider" in AM-5, and
never called: `resolveSourceHit` resolved only Layout Plan fragments against the datum plane. A T2 or
T3 adapter could register a 3D picker and nothing it offered was reachable, which would have made the
seam's consumer probes a lie.

While reproducing it, the built-in resolution turned out to be broken in the same way: it intersected
the *datum* plane and compared plan metres, so in the 3D reading the tested point sat on the floor
metres behind the surface under the pointer and a visible Wall could not be selected at all
(measured: the projected midpoint of a Wall resolved `no-fragment`). Fixing only the provider would
have left the shipped path unusable.

Both are fixed in `stage-facade`:

- Registered providers are consulted in registration order against the **live** evaluation (`adapterContext`), before the built-in Layout fallback, and the first claim wins. The host invents no cross-domain priority it cannot measure; Layout keeps its deterministic within-Layout order (Wall, Opening, object, floor, then source identity). A stale candidate is refused before any provider is asked, and a disposed registration loses reach.
- The built-in pick is screen-space against the **drawn** geometry, through the one live evaluation: the fragmented footprint, a Wall's drawn face, a floor's interior, with the same CSS-pixel tolerance (`PLAN_HIT_TOLERANCE_CSS_PX = 8`) and no datum-plane round trip. (Round two replaced the face's extent and the reported world point — see finding 6.)

Tests: `stage-facade` — "lets a domain adapter claim a candidate the Layout Plan resolves to
nothing" (provider reach, order, decline, stale refusal, dispose) and "selects the visible Wall in
the 3D reading, where a datum-plane pick lands metres away" (top edge and mid-face).

### 3. Asynchronous source-load race — real, fixed

The route created a private `AbortController` that nothing ever cancelled, and `fetchOutcome` swallowed
the abort. Neither the load nor the admission after it was bound to the session epoch: a GET that
completed after a replacement (or after teardown) installed its document and mounted a stage no one
would dispose, and a `?create=1` starter boot could be overwritten by the slower cloud answer.

Fixed with the mechanism the session contract already names:

- `runBoundLoad(session, start)` registers the read in the session's own cancellation registry and aborts it exactly once on replacement or teardown; it returns the value only while the epoch it started under is still current, otherwise `null`.
- `session.isCurrent` is false after `dispose()`, so a completion that lands after teardown cannot activate.
- The route awaits `runBoundLoad`, re-checks `isCurrent` after the asynchronous admission, and refuses `activate` once `tornDown` is set.

Tests: `stage-session` — "drops and aborts a cloud load when a replacement or teardown takes the
stage" (abort once, registry empty, `null` result, live load still answers); `stage-shell-composition`
— "binds the project read to the session, so a stale load cannot install" (the call site, no private
`AbortController`).

### 4. Gesture lifecycle and transition policy — real, fixed

`GestureTransitionPolicy` was stored on the lease and never run, `acquireGesture` refusals were
ignored by the route (the drag started anyway), `pointercancel`/`lostpointercapture` had no handler
so a browser-cancelled gesture kept its lease (and the next stray move panned with samples from it),
and a reading flip left those samples moving the view — the exact T2.S03 dependency.

Fixed while keeping one gesture owner:

- The facade runs the live lease's policy once per **accepted** `set-reading` intent, before the projection changes: `cancel-on-reading-change` releases, the other two keep the lease (a refused or duplicate request runs nothing). S02 has no proposal writer, so `suspend-proposal`'s withheld proposal is reported, not invented.
- The route acts on a refusal (`acquisition.kind !== 'granted'` stops the press before capture), and every ending — pointer up, pointer cancel, lost capture, Escape — goes through one `endGesture()` that releases once; a move under a lease that no longer exists drops its samples.

Tests: `stage-facade` — "runs the live gesture policy once when a reading change is accepted"
(cancel before the frame draws the flip, continue survives, a refused request changes nothing);
`stage-session` — the three policies and their exactly-once release; `stage-shell-composition` —
"holds the gesture contract at the route" (refusal branch, cancel/lost-capture handlers, the single
`endGesture`, and the post-flip drop).

### 5. Drag-versus-click event ordering — a round-one regression, fixed

The round-one consolidation made one `endGesture()` the single ending path and had it clear the press
origin. That is wrong for the browser's order: `pointerdown` → `pointerup` → `click`. By the time the
click arrived the origin was gone, so the drag-suppression check was skipped and a pan or orbit ending
over geometry selected it (or reported that nothing was selectable). A pointer capture released
implicitly after `pointerup` would have cleared it a second way.

Fixed by separating the two state machines that were being conflated:

- `createStagePressTracker()` in `stage-input` owns the drag-versus-click decision. `end()` is a normal
  pointer ending and keeps the decision for the click; `abort()` is an interruption (pointer cancel,
  capture lost while the pointer is down, Escape, a policy cancel) and refuses the click that may still
  be dispatched; `decide()` consumes it, so one press authorises at most one selection.
- `endGesture()` now ends the **gesture** only (drag samples and the lease), and `abortGesture()` is the
  interruption path that also aborts the press. `onLostPointerCapture` aborts only while the pointer is
  still down (`drag !== null`), because implicit release after `pointerup` is the normal ending.

The regression is pinned at the event sequence, not at the tolerance: `stage-input` — "suppresses the
click that follows a drag, using the real pointer order" drives `begin → end → decide(far)` and fails
if the pointer-up ending clears the decision (verified by restoring that line); plus the interruption
and one-press-one-selection cases. `stage-shell-composition` holds the call site: `onPointerUp` calls
`press.end()` and never `press.abort()`.

### 6. 3D Wall picking still used the Plan cut height — real, fixed

The round-one picker built a Wall's face from `PlanFragment.elevationMeters`. For a 3 m Wall with the
default 1.2 m cut the fragment sits **at the cut**, so the pickable face was 0–1.2 m while the drawn
Wall runs to 3 m — a click high on the visible Wall missed, and the Plan cut was silently deciding 3D
picking. The reported world point had the same defect: a horizontal plane at the fragment's elevation
is not on a vertical Wall.

Fixed without a second geometry authority:

- `pickSurfacesOf(fragment, compiledGeometry, datum)` separates **surface** from **cut**: a Wall's faces
  come from its compiled `solidSpans` (`datum + bottomY` … `datum + topY`, the records the mesh
  builders draw), falling back to the Wall's own `height` over the fragment's line when no solid span is
  compiled. Everything else keeps its fragment geometry as a flat surface. Eligibility, streams and
  identity still come from the Plan evaluation, so a Wall above the cut is pickable without becoming a
  different subject.
- The world point for a face hit intersects the face's own vertical plane (normal perpendicular to the
  span; the frame's yaw is the span's direction, so the basis cannot collapse on a wall aligned with a
  world axis) and is clamped to the span, keeping the ray's height. Flat fragments keep the
  horizontal-plane answer, with the first drawn point as the parallel-ray fallback.

Tests: `stage-facade` — "picks the Wall above the Plan cut, where the cut fragment is shorter than the
Wall": the fragment is asserted to be a `cut` fragment at the cut elevation while the compiled Wall is
higher, then clicks at 85 % and 98 % of the Wall's height must resolve that Wall, report a world point
at the clicked height, and put it on the Wall's own span line (perpendicular offset < 5 cm). Restoring
the cut-extent pick makes this test fail.

### 7. Fragment correspondence on a multi-span Wall — real, fixed

Round two's `pickSurfacesOf` read every solid span of a Wall from every fragment of that Wall. A
Wall split by an Opening (or, in this compiler, by any of its sampled solid spans) therefore had
fragments that could claim a *different* span's surface and report their own `interval`: clicking the
second span returned the first span's sub-ref, and a span the Plan excluded stayed reachable through
an eligible sibling.

Fixed by making correspondence the first rule: a Wall fragment's pick surfaces are the compiled
solid spans whose `startDistance`/`endDistance` equal the fragment's own `interval` (within 1e-6 m),
keeping that span's full drawn height, so a lintel starts at the door head rather than at the datum.
A fragment whose interval the compiled snapshot no longer emits is tested at its **own** line and full
Wall height, never at a neighbour's span. Identity, streams and eligibility still come from the Plan.

Test: `stage-facade` — "picks only the span its own fragment names, on a Wall split by an Opening"
builds the enclosure with a real door through the retained opening planner, then (a) clicks every Wall
placement's own midpoint at its own compiled span's mid-height and requires the returned `subRef` to
equal that fragment's interval, and (b) excludes the farthest span with a lateral span and requires
that its midpoint resolves `no-fragment`, with the excluded interval absent from the eligible set.
Restoring the whole-Wall surfaces makes it fail with `[0, 0.25]` returned for the `[0.25, 0.5]` span.

### 8. Pointer ownership of the gesture — real, fixed

A refused second `pointerdown` was reported and ignored, but `pointerup`/`pointercancel` ended
whatever gesture was live without asking which pointer it belonged to, so a second pointer's release
could release the first pointer's lease; its later `click` could also reach the press decision.

Fixed by giving the press tracker ownership: `begin` records the pointer, `end`/`abort` answer only
for their own pointer, `refuse` marks a pointer whose lease was refused, and `decide` neither selects
for a refused pointer nor consumes the owner's decision when another pointer's click arrives. The
route passes `event.pointerId` at every transition, marks the pointer on a lease refusal, and gates
`onLostPointerCapture` on the owning pointer.

Test: `stage-input` — "keeps one pointer’s press when a second pointer is refused" (second pointer's
`end` changes nothing, its click is refused without consuming the owner's decision, and the
lease-refusal mark is honoured); `stage-shell-composition` holds the call sites (`press.end(event.pointerId)`,
`press.refuse(event.pointerId)`, the owner guard on lost capture). Dropping the ownership check from
`end` makes the two-pointer test fail.

### Verification of this revision

The §7.4 contract, run on the merged tree these results describe (after those runs, only this record
changed; the positive-control adjustment described below is included in them). Round-one results were
measured at `90aa6729`; round two after merging `origin/main` = `94283377` (T3.P01.S02), zero
behind-commits; round three on that same tree with no further merges. All figures below are the
round-three re-run, `apps/editor` unless noted, and were produced with the workspace `vitest` binary
the npm scripts invoke (the package manager's dependency verification cannot resolve the `@portfolio/*`
workspace links against the public registry here, so it was bypassed rather than the scripts changed):

```text
npm test                 151 files / 1,957 tests passed   (includes the heavy lane below)
npm run test:arch         20 files /   161 tests passed
npm run test:fast        123 files / 1,678 tests passed
npm run test:heavy         8 files /   118 tests passed   (covered by the full run above)
npm run check             0 errors, 0 warnings
npm run build             completed (@sveltejs/adapter-vercel)
npm run check:layout-core / check:project-model / check:camera-core / check:api   clean
npm run test:api          39 tests / 0 failed / 0 skipped
```

`test:api` ran without a `DATABASE_URL` in this environment; the five API suites reported zero
skips, so no DB-backed case was silently dropped.

**Reconciliation with `main`.** The merge brought T3.P01.S02's conditional Save. One S02 arch
positive control pinned the writer symbols in `project-persistence.ts`, and `saveProject` has moved
out of that module with T3's transport. The control now asserts the two pending-cloud-save writers
this module still carries and that `saveProject` is no longer called there; the guarantee it exists
for is unchanged and still tested — the spatial host reaches **no** write path, and the predicate is
still shown to flag a real writer module and a synthetic call site. No S02 production file changed
for the merge.

Browser observation (Vite dev server on the S02 checkout, starter-gallery boot, 1086×826 CSS stage):

- The starter boot renders four Walls and the floor in the Index, one Canvas, and the Plan ⟷ 3D switch reports `aria-pressed` for the settled reading (3D at boot, Plan after a flip).
- Picking was measured in the page against the production facade with the live document and its own evaluation (the attached preview webview does not composite, so `requestAnimationFrame` — and with it the route's per-frame evaluation — is starved; this is an environment limit, not a host behaviour, and the probe is why it is disclosed rather than claimed as a full UI pass). 3D: a mid-band click resolves `wall`, a lower click resolves `room-floor`, frame corners resolve `no-fragment`, which the datum-plane pick could not do (it named the floor under a Wall and resolved no Wall at all). Plan: the same facade reports `projection-kind: plan-orthographic` and resolves `room-floor`; no second renderer or transform appears.
- The round-two upper-Wall case in the same page, on the starter document (3 m Walls, 1.2 m cut): the Wall's Plan fragment is a `cut` fragment at 1.2 m, a click there resolves `wall` at `y = 1.2`, a click at 90 % of the Wall's height resolves the same Wall at `y = 2.7`, and a click at 99 % resolves it at `y = 2.97`. Before this round the two upper clicks resolved nothing: the face stopped at the cut.
- The Plan presentation is the orthographic reading of the same geometry: 105 fragments, membership `included` for all five sources, and Reveal has nothing to restore in the starter document. What a cut drawing does with excluded sources is the owner decision above (reduced contract approved; renderer unassigned).
- The two round-three cases were not re-observed in the browser, and are not claimed as if they were: `onLostPointerCapture` and a refused second pointer need real multi-pointer capture input the webview does not produce, and the multi-span Wall case needs a door authored in the page. Both are pinned in `stage-input`, `stage-facade` and `stage-shell-composition`, including that removing the correspondence filter or the pointer-ownership check fails them.

Limitations of this pass, stated as such: no full keyboard/screen-reader pass; the drag-versus-click
and gesture-lifecycle sequences are pinned by tests at the state machine and call-site level rather
than by synthesized pointer capture in this webview; no cloud-backed replacement observed in the
browser (no API origin in this environment — the race is proved at the session and call-site level);
the preview webview produced no frames for screenshot capture.

## What this increment does not implement

- **Plan-cut rendering.** The Stage draws one canonical geometry set in both readings; the
  `cut | projected | hidden | symbol` streams and membership govern hit eligibility, the Index and
  Reveal. A source above the cut or outside the finite depth is drawn but not selectable, and Reveal
  restores eligibility without changing the drawing. A Plan-cut **drawing** is not part of S02 by the
  owner decision recorded above, and its completion obligation is recorded there as unassigned — not
  moved to S04, which does not own a Sheet.
- Save (T3's conditional Save), F4 intents, Undo/Redo, history and replacement baselines (S04), any
  Layout or Scene editing, Camera authoring, publish, and Preview/visitor parity beyond the shared
  renderers the Stage reuses.
- `T1.viewport-projection@1`'s capability record: the plan leaves the output unaccepted until its
  integration route and adjudication.

## Owed before any acceptance

The complete merge gate in [`apps/editor/tests/README.md`](../../../../../apps/editor/tests/README.md)
on the then-current `main` (arch lane unconditional), the DAG/consumer-probe rows as an accepted
capability record, the integration route through
[S06](../t1.p01.s06-integrated-final-gate/implementation-plan.md), and owner adjudication of that
record. When they exist, their tier, tested revision, commands and results belong here.
