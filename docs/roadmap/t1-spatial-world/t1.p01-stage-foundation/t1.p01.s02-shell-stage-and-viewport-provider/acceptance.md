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

## What this increment does not implement

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
