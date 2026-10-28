# T5.P01.S02 — acceptance record: Shape reading and sizing

**Slice:** T5.P01.S02 · **Status:** **implemented — awaiting owner acceptance.** This record claims no
acceptance, merge, capability entry or gate state · **Plan:**
[implementation-plan.md](./implementation-plan.md) (outline; it owns the slice scope) · **Phase:**
[T5.P01](../README.md)

```text
STATUS      implemented on t5/p01-s02-shape-reading at be318264; not accepted
TIER        architecture-integration
ROUTE       ../t5.p01.s03-integrated-final-gate/acceptance.md
            the phase's final gate owns the integrated proof, browser journeys and battery rows
REVIEWS     T1: the Ink reading seam and the Stage host change (D5)
            T2: Scene-adapter and intent-call changes (D2); no planner, codec or unit-format change
CARRIED     Wall-face drawing waits for T1's face-frame query; the creator aligns an upright sheet
            by hand. Battery-mode performance and the integrated browser journey remain S03's.
```

## Delivered

**One Ink, contributed readings.** `stage-facade` declares the host capability `ink-readings-v1` and
exposes `inkReadings()` / `openInkReading()`. A contributed reading is a session a domain binding
owns: it receives the pointer phases and command keys of the open Ink task, publishes overlays and
form ghosts, and brings its own palette view. The host owns the ordered contribution list, not a
stroke, selection, history or writer. Layout keeps the one Ink task and its Wall and Opening
readings; its palette renders contributed readings beside them and delegates pointer, hover, key,
overlay and ghost phases to the selected session. A reading switch cancels the contributed session
before another opens.

**Shape reading.** The Scene binding contributes `shape` with its own palette. A closed stroke on
the floor datum or an upright sheet (X/Z/yaw) reads as a Shape. Line and Sketch keep the named points
(straight or smooth anchors); Box and Round read the stroke's bounding rectangle or ellipse. Winding
is canonicalized, and live validity is geometry-core's `validateProfile`; an invalid outline shows
the kernel issue in words and offers no Create. The depth phase offers a depth ray, an exact metre
field (blank is invalid, not zero), Flip side for an upright outline, and Create. Preview and Create
both run the existing `create-form` planner, so the shared Canvas ghost is the candidate the commit
installs. Create issues one intent, selects the created entity, writes one history entry and leaves
Undo/Redo with the same identity. The default material is `plaster-warm` and the name is `Shape`,
matching the native primitives.

**Per-axis sizing.** A selected form exposes three direct-manipulation size rays (Width, Height,
Depth) while no contributed task owns the pointer. A ray is session arithmetic over the form's own
`form.scale`; move previews through `set-form-size` and release commits one intent. The Card's
Width/Height/Depth fields remain the only writer for exact typed values and use the same operation.
Cancel, refusal and stale content add no history.

**Host correction required by the slice.** An accepted install closes a contributed task through the
session rather than `closeTask()`, so the facade's contributed-task owner is now cleared with the
task. Without that, every later no-task press and key was still offered to the retired Ink binding
and never reached the selection's direct manipulation.

## Verification at `be318264`

All commands ran on the feature branch. Results:

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings |
| `npm run build` | built, `@sveltejs/adapter-vercel` completed |
| `npm run test:fast` | 192 files / **2,561 tests** passed |
| `npm run test:arch` | 23 files / **188 tests** passed |
| `npx vitest run` on the 11 affected Stage/Layout/Scene suites | 11 files / **197 tests** passed |
| `npx vitest run tests/lib/authoring/shape-outline.test.ts tests/lib/authoring/shape-reading-adapter.test.ts` | 2 files / **13 tests** passed |

The two new focused files are [shape-outline.test.ts](../../../../../apps/editor/tests/lib/authoring/shape-outline.test.ts)
(conversion and validation) and
[shape-reading-adapter.test.ts](../../../../../apps/editor/tests/lib/authoring/shape-reading-adapter.test.ts)
(seam, floor creation, invalid refusal, upright Flip, size ray and Card writer through the real F.4
host). The affected run covered `stage-facade`, `stage-host-acceptance`, `stage-session`,
`layout-opening`, `layout-wall-manipulation`, `layout-drawing`, `layout-precision`,
`scene-composition-loop`, `scene-editing-surface`, `scene-proposal-lifetime` and the new suite.

The **heavy** lane was not run: no geometry-core, kernel or heavy correctness subject changed.
`npm test` (the complete suite) was not rerun as one command; `test:fast` and `test:arch` together
cover every non-heavy file at the same revision.

## Not run, and why

- **Browser design loop.** This checkout has no `.env`, local API/database or authenticated project
  fixture, and the repository has no dev route that mounts the production Stage with a project. The
  reading, rays, Card, refusals, narrow/short shells and reduced-motion pass therefore has **no
  real-browser observation** in this record. It stays owed to `T5.P01.S03`, the declared integration
  route.
- **Performance rows.** Live-reading, drag-preview and commit budgets are S02's evidence to plan,
  not a measured result here; the final gate owns the measurement and the battery rows.

## Deviations and decisions

- The approved plan was an **outline**. The seam shape was resolved as a declared host capability
  with adapter-owned sessions, as the plan requires; it adds no host document state.
- The outline's **Wall-face** item is out of scope because T1's face-frame query has not landed. The
  plan's fallback — an upright sheet aligned by hand — is what shipped. This is carried, not waived
  silently.
- No planner, Scene codec, unit format, F4, Head, Save or Camera behaviour changed. The Scene
  adapter only calls the existing `create-form` and `set-form-size` planners.
- The contributed-task owner correction in `stage-facade` is a Stage host change and needs T1's
  review with the seam.
- Browser and performance items above are limitations of this record, not passes.

## Remaining before acceptance

1. T1 review of `ink-readings-v1`, `openInkReading`, the palette delegation and the task-owner fix.
2. T2 review of the Scene-adapter contribution and the two existing planner call sites.
3. Owner acceptance of this record, and a PR merge under the repository's P1 merge rule.
4. `T5.P01.S03` closes the integrated browser journey, performance rows and the phase gate; no
   capability entry is claimed here.
