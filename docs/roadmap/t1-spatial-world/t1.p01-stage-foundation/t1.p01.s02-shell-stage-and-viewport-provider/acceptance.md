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

## Independent architecture review of the pushed revision (`eb0d94a`)

A second independent review, of the revision pushed for re-review, raised four P1 hypotheses against
the host. Each was traced end to end — AM-5, the S02 plan, the seam contract and the suites —
before anything changed. Three were real S02 defects; the fourth described a claim the
implementation never supported and is now narrowed rather than "fixed".

| Finding | Verdict | Disposition |
| --- | --- | --- |
| 1. Plan representation vs rendered geometry | not an S02 defect; an overstated claim | claim narrowed, owner for the missing half named |
| 2. `StageAdapter.hitProvider` declared but unused | real: a registered T2/T3 picker was unreachable | fixed (and the built-in Layout pick was broken in 3D too) |
| 3. Project load not bound to the session epoch | real: a late GET or admission could install over a replacement | fixed |
| 4. Gesture policies stored, not executed | real: refusal ignored, cancellation leaked the lease | fixed |

### 1. Plan representation and rendering — claim narrowed, not a defect

`evaluateLayoutPlan` yields `cut | projected | hidden | symbol` streams, per-source membership and
Reveal; `StageCanvas` takes `geometry: CompiledLayoutGeometry` and always renders that one canonical
set through the same runtime-safe adapters the visitor uses. The Stage's Plan *reading* is that same
geometry under the exact orthographic endpoint — AM-5 requires exactly this ("render canonical Layout
and existing Scene through runtime-safe adapters"; "one persistent Threlte Canvas/Stage serves all
readings"), and S02's scope adds Plan evaluation beside the renderer, not a second cut drawing. A
plan-cut renderer is not in this slice: the cut height and its Sheet are S04's, and Section/peel/lift
stay out of AM-5.

What the review was right about is the *claim*, not the code: the representation governs membership,
Reveal and hit eligibility, and it does **not** govern what pixels the Stage draws. In the product's
only boot document (the starter gallery) that gap cannot be observed — the enclosure has four walls
and a floor and all five sources are `included`, so drawn, eligible and reveal-able coincide; verified
in a browser against the live document (all five membership rows `included`, 105 fragments, picking
resolves those same sources). Where it *would* be observable is a document with content above the cut
or outside the finite depth: such a source is drawn (canonical geometry) but not hit-eligible, and
Reveal restores eligibility without changing the drawing. That is a known, recorded non-claim of this
increment, not a wiring defect. The `stage-shell-composition` test now states the division of labour
it can hold (one geometry input to the Canvas; eligibility and the Index come from `stage.plan()` and
`planView.membership`, the same call the hit path makes) instead of implying a representation-driven
renderer.

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
- The built-in pick is screen-space against the **drawn** geometry, through the one live evaluation: the fragmented footprint, a Wall's face between datum and top edge, a floor's interior, with the same CSS-pixel tolerance (`PLAN_HIT_TOLERANCE_CSS_PX = 8`) and no datum-plane round trip. The resolved world point is the pointer's ray on the fragment's own height, not the floor beneath it, with the fragment's first drawn point as the honest fallback when that ray is parallel.

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

### Verification of this revision

The §7.4 contract on this tree, at the pushed revision (base `origin/main` = `74367936`, no
behind-commits; `apps/editor` unless noted):

```text
npm test                 146 files / 1,917 tests passed
npm run test:arch         19 files /   158 tests passed
npm run test:fast        119 files / 1,641 tests passed
npm run test:heavy         8 files /   118 tests passed
npm run check             0 errors, 0 warnings
npm run build             completed (@sveltejs/adapter-vercel)
npm run check:layout-core / check:project-model / check:camera-core   tsc --noEmit, clean
git diff --check <base>..<head>   clean
```

`check:api`/`test:api` are not re-run for this revision: no `apps/api` file, project-model reader,
schema or contract changed here, and this pass adds no DB-backed behaviour to the slice.

Browser observation (Vite dev server on the S02 checkout, starter-gallery boot, 1086×826 CSS stage):

- The starter boot renders four Walls and the floor in the Index, one Canvas, and the Plan ⟷ 3D switch reports `aria-pressed` for the settled reading (3D at boot, Plan after a flip).
- Picking was measured in the page against the production facade with the live document and its own evaluation (the attached preview webview does not composite, so `requestAnimationFrame` — and with it the route's per-frame evaluation — is starved; this is an environment limit, not a host behaviour, and the probe is why it is disclosed rather than claimed as a full UI pass). 3D: a mid-band click resolves `wall`, a lower click resolves `room-floor`, frame corners resolve `no-fragment`, which the datum-plane pick could not do (it named the floor under a Wall and resolved no Wall at all). Plan: the same facade reports `projection-kind: plan-orthographic` and resolves `room-floor`; no second renderer or transform appears.
- The Plan presentation is the orthographic reading of the same geometry: 105 fragments, membership `included` for all five sources, and Reveal has nothing to restore in the starter document. What a cut drawing does with excluded sources remains the recorded non-claim above.

Limitations of this pass, stated as such: no full keyboard/screen-reader pass; no cloud-backed
replacement observed in the browser (no API origin in this environment — the race is proved at the
session and call-site level); the preview webview produced no frames for screenshot capture.

## What this increment does not implement

- **Plan-cut rendering.** The Stage draws one canonical geometry set in both readings; the
  `cut | projected | hidden | symbol` streams and membership govern hit eligibility, the Index and
  Reveal. A source above the cut or outside the finite depth is drawn but not selectable, and Reveal
  restores eligibility without changing the drawing. Rendering the cut itself belongs to the Sheet
  work (S04), not to S02.
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
