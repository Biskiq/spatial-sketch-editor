# T5.P01.S02 — acceptance record: Shape reading and sizing

**Slice:** T5.P01.S02 · **Status:** **implemented — awaiting owner acceptance.** This record claims no
acceptance, merge, capability entry or gate state · **Plan:**
[implementation-plan.md](./implementation-plan.md) (outline; it owns the slice scope) · **Phase:**
[T5.P01](../README.md)

```text
STATUS      implemented on t5/p01-s02-shape-reading at 5428e66b; not accepted
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
overlay and ghost phases to the selected session. A reading switch refuses while the contributed
reading holds live points or a chosen depth, naming the reason; an explicit cancel or clear makes
the switch available and writes nothing.

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
and never reached the selection's direct manipulation. Opening any task also ends a no-task direct
manipulation gesture — a live size ray releases its lease instead of stranding it.

## Verification at `5428e66b`

All commands ran on the feature branch. Results:

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings |
| `npm run build` | built, `@sveltejs/adapter-vercel` completed |
| `npm run test:fast` | 193 files / **2,571 tests** passed |
| `npm run test:arch` | 23 files / **188 tests** passed |
| `npx vitest run` on the 13 affected Stage/Layout/Scene/Shape suites | 13 files / **215 tests** passed |
| `npx vitest run tests/lib/authoring/shape-outline.test.ts tests/lib/authoring/shape-reading-adapter.test.ts tests/lib/authoring/shape-palette.test.ts` | 3 files / **23 tests** passed |

The three focused files are [shape-outline.test.ts](../../../../../apps/editor/tests/lib/authoring/shape-outline.test.ts)
(conversion and validation), [shape-reading-adapter.test.ts](../../../../../apps/editor/tests/lib/authoring/shape-reading-adapter.test.ts)
(seam, floor creation, live refusal, upright Flip and raised-V depth drags, invalid-depth recovery,
resize baselines, reading-switch protection, keyboard, size ray/task takeover and Card writer through
the real F.4 host), and
[shape-palette.test.ts](../../../../../apps/editor/tests/lib/authoring/shape-palette.test.ts)
(raw depth forwarding and hover-preserved fields). The affected run covered both Shape suites and
the palette suite plus `stage-facade`, `stage-host-acceptance`, `stage-session`, `layout-opening`,
`layout-wall-manipulation`, `layout-drawing`, `layout-precision`, `scene-composition-loop`,
`scene-editing-surface` and `scene-proposal-lifetime`.

The **heavy** lane was not run: no geometry-core, kernel or heavy correctness subject changed.
`npm test` (the complete suite) was not rerun as one command; `test:fast` and `test:arch` together
cover every non-heavy file at the same revision.

## Not run, and why

- **Browser design loop.** This checkout has no `.env`, local API/database or authenticated project
  fixture, and the repository has no dev route that mounts the production Stage with a project. The
  reading, rays, Card, refusals, narrow/short shells and reduced-motion pass therefore has **no
  real-browser observation** in this record. It stays owed to `T5.P01.S03`, the declared integration
  route.
- **Performance rows.** Live-reading, drag-preview, commit and Stage first-load growth budgets are
  S02's evidence to plan, not a measured result here; the final gate owns the measurement and the
  battery rows.

## Review corrections

The first independent review round found seven concrete defects, all fixed here with regressions
for the creator-visible paths:

- The depth handle intersected the drawing plane itself, so every drag collapsed to the minimum
  depth; it now measures the closest approach to the axis (`shape/ray.ts`).
- Per-axis sizing divided the desired dimension by the already-scaled extent, so every resize after
  the first on an axis was wrong; the unscaled outline extent is now the baseline.
- A clockwise stroke kept its drawn order, so bounds, depth handle and preview refused it even
  though Create via typed depth worked; conversion now returns the canonical outline.
- An unreadable outline did not name its issue until Finish, and an invalid typed depth left Create
  enabled; both refusals are live and Create refuses until the depth parses.
- Switching readings silently discarded a live contributed outline; the switch now refuses while
  the reading reports work.
- Blank sheet fields committed zero; they now use the shared exact-number rule.
- The palette rewrote typed fields on every hover-published revision; it now rewrites only on a
  real sheet or depth change.

A second round found four more, also fixed here:

- The palette's local parse stopped invalid depth text from reaching the session, so Create stayed
  enabled over an older value; it now forwards the raw text and Create commits the field first.
- The upright depth handle used the drawn V centre, not the standing body's midpoint, and Flip side
  left it on the unextruded normal; both now follow the body the planner creates.
- Plane and sheet changes discarded live points or depth without notice; they now refuse until the
  reading is cleared, and backing out of the depth phase restores the effective value.
- The Layout palette carried a hard-coded `shape` data hook; contributed readings now need no
  Layout edit to appear.

PR review then found two lifecycle gaps, fixed with regressions:

- A successful depth-handle drag left an earlier invalid typed depth's validity flag set, so Create
  stayed disabled; the drag now restores validity.
- A live no-task size ray kept its gesture lease when another task opened; the host now runs the
  existing `taskClosed` path as a task takes the pointer, so the lease is released and no scale
  commits.

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

1. T1 review of `ink-readings-v1`, `openInkReading`, the palette delegation, the `hasWork` switch
   guard and the task-owner fix.
2. T2 review of the Scene-adapter contribution and the two existing planner call sites.
3. Owner acceptance of this record, and a PR merge under the repository's P1 merge rule. The phase
   register keeps S02 `proposed` because no release-list row exists: this record claims an
   implementation awaiting review, not release authorization.
4. `T5.P01.S03` closes the integrated browser journey, performance rows and the phase gate; no
   capability entry is claimed here.
