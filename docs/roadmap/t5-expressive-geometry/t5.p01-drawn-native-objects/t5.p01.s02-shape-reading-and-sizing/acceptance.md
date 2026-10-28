# T5.P01.S02 — acceptance record: Shape reading and sizing

**Slice:** T5.P01.S02 · **Status:** **implemented — awaiting owner acceptance.** This record claims no
acceptance, merge, capability entry or gate state · **Plan:**
[implementation-plan.md](./implementation-plan.md) (outline; it owns the slice scope) · **Phase:**
[T5.P01](../README.md)

```text
STATUS      implemented on t5/p01-s02-shape-reading at 86595afe; not accepted
TIER        architecture-integration
ROUTE       ../t5.p01.s03-integrated-final-gate/acceptance.md
            the phase's final gate owns exhaustive integrated acceptance and battery rows; the
            browser review below is diagnostic S02 evidence, not the gate's verdict
REVIEWS     T1: the Ink reading seam and the Stage host change (D5)
            T2: Scene-adapter and intent-call changes (D2); no planner, codec or unit-format change
CARRIED     Wall-face drawing waits for T1's face-frame query; the creator aligns an upright sheet
            by hand. Battery-mode performance rows remain S03's; the browser journey is recorded
            here as review evidence, not as the final gate's exhaustive acceptance.
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

## Verification at `86595afe`

All commands ran on the feature branch. Results:

| Command | Result |
| --- | --- |
| `npm run check` | 0 errors, 0 warnings |
| `npm run build` | built, `@sveltejs/adapter-vercel` completed |
| `npm run test:fast` | 193 files / **2,573 tests** passed |
| `npm run test:arch` | 23 files / **188 tests** passed |
| `npx vitest run` on the 11 affected Stage/Layout/Scene/Shape suites | 11 files / **196 tests** passed |
| `npx vitest run tests/lib/authoring/shape-outline.test.ts tests/lib/authoring/shape-reading-adapter.test.ts tests/lib/authoring/shape-palette.test.ts` | 3 files / **25 tests** passed |
| S02 UX journey, Playwright Chromium | 3 specs passed; **19 scenario rows** passed, 1 recorded not-run |

The three focused files are [shape-outline.test.ts](../../../../../apps/editor/tests/lib/authoring/shape-outline.test.ts)
(conversion and validation), [shape-reading-adapter.test.ts](../../../../../apps/editor/tests/lib/authoring/shape-reading-adapter.test.ts)
(seam, floor creation, live refusal, upright Flip and raised-V depth drags, invalid-depth recovery,
invalid typed depth recovered by a Plan pull, resize baselines, reading-switch protection, keyboard,
size ray/task takeover and Card writer through the real F.4 host), and
[shape-palette.test.ts](../../../../../apps/editor/tests/lib/authoring/shape-palette.test.ts)
(raw depth forwarding and hover-preserved fields). The affected run covered both Shape suites and
the palette suite plus `stage-facade`, `stage-host-acceptance`, `stage-session`, `layout-opening`,
`layout-wall-manipulation`, `scene-composition-loop`, `scene-editing-surface` and
`scene-proposal-lifetime`.

The **heavy** lane was not run: no geometry-core, kernel or heavy correctness subject changed.
`npm test` (the complete suite) was not rerun as one command; `test:fast` and `test:arch` together
cover every non-heavy file at the same revision.

## Browser UX review at `86595afe`

A real Chromium session drove the production Stage through a local API, a private PostgreSQL database
and an authenticated creator project. The clean run produced 20 revision-stamped scenarios
(19 passed, 1 intentional not-run observation) and screenshots:

- [evidence JSON](./evidence/2026-10-28/ux-review/t5-p01-s02-ux-evidence.json)
- [Room drawn and divided](./evidence/2026-10-28/ux-review/t5-s02-01-drawn-divided.png)
- [invalid outline](./evidence/2026-10-28/ux-review/t5-s02-03-invalid-outline.png)
- [depth phase cancelled](./evidence/2026-10-28/ux-review/t5-s02-04a-depth-cancel.png)
- [invalid typed depth](./evidence/2026-10-28/ux-review/t5-s02-04-invalid-depth.png)
- [Plan depth pull](./evidence/2026-10-28/ux-review/t5-s02-04b-depth-drag-plan.png)
- [Plan pull recovers validity](./evidence/2026-10-28/ux-review/t5-s02-04c-depth-recovered.png)
- [floor form and Card](./evidence/2026-10-28/ux-review/t5-s02-05-floor-created.png)
- [upright form](./evidence/2026-10-28/ux-review/t5-s02-08-upright-created.png)
- [reloaded project](./evidence/2026-10-28/ux-review/t5-s02-09-reloaded.png)
- [Preview](./evidence/2026-10-28/ux-review/t5-s02-10-preview.png)
- [900×700 shell](./evidence/2026-10-28/ux-review/t5-s02-11-narrow.png)
- [1024×600 shell](./evidence/2026-10-28/ux-review/t5-s02-11-short.png)

Passed in the browser, from an empty authenticated project:

- Draw and close a Room, divide it through both Walls, then place a Wall-hosted Window.
- Switch one Ink task between Wall, Opening and Shape without writing source; the readings remain
  discoverable in the same palette.
- A crossed outline names its issue live and disables Finish; Clear recovers. Backspace backtracks a
  live point and Enter closes the outline.
- Back to outline cancels the depth phase, restores the four live points, and writes no form.
- A typed `0` names the admitted range and disables Create; a Plan depth pull recovers validity and a
  subsequent Create succeeds. The 3D pull does the same.
- Create a floor form, size it exactly through Width/Height/Depth, Undo/Redo it as one history entry,
  then grow Width with the direct-manipulation ray.
- Create an upright form on a hand-aligned 3D sheet.
- Save, reload and recover both forms with their identities and both Rooms; Plan and 3D report the
  same form identities.
- Enter Preview after creating an Experience/Presentation, see the authored world, and leave with
  Escape.
- At 900×700 and 1024×600 with reduced motion, the Shape instrument fits, its body scrolls to Finish,
  and there is no horizontal overflow. No THREE, shader or uncaught errors were recorded.

**UX verdict.** The S02 creator workflow is functionally correct and usable in a real browser. No
confirmed defect remains after the two fixes above: the Shape reading is discoverable beside Wall
and Opening, refusals name what is wrong and what is admitted, pointer and keyboard paths agree,
Plan and 3D report the same authored identities, and the narrow/short shells stay operable. The
only polish observation is that at 1440×900 the depth instrument scrolls inside its capped body, so
a line can be clipped mid-height while scrolled; content remains reachable. Preview being
unavailable before an Experience exists is explicit product behaviour, not a defect.

The single not-run row is not a failure: before an Experience exists, Preview is deliberately
unavailable and names that reason. A separate journey creates the Experience/Presentation and then
exercises Preview.

## Not run, and why

- **Performance rows.** The performance mandate is suspended, so no benchmark was initiated and no
  live-reading, drag-preview, commit or first-load row is claimed. The final gate still owns those
  rows; an unmeasured row is never a pass.
- **Exhaustive final gate.** This is one diagnostic S02 journey, not the battery of epochs, browsers,
  touch input or published-preview checks that `T5.P01.S03` owns. It does not claim that gate.
- **Browser matrix.** The review used desktop Chromium at the recorded viewports only; Firefox,
  WebKit, touch devices and a deployed production origin were not exercised.
- **Preview depth.** Preview entry, visual fidelity and Escape return were observed; no pixel-parity,
  published-output or cross-device comparison was performed.

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

The real-browser review then found two creator-facing gaps, both fixed:

- The Plan floor depth handle projected onto the outline centre because the floor normal faces the
  Plan camera, so the advertised pull had no screen travel. It is now published up-screen by its
  depth at the evaluated plane scale, hit-tested at that same point and mapped back to metres; 3D
  keeps the world-axis ray. The journey covers invalid typed depth → valid Plan pull → Create.
- Create and Place selected their installed entity canonically, but the route mirrored the selection
  without reopening a dismissed Card, so a newly created form had no visible size controls. The
  route now reopens the Card only when the primary subject identity changes, not when the same
  dismissed subject is requalified by a revision.

A final code-review pass found one more path in that Plan fix: the screen-space fallback also ran
for an upright Shape, even though an upright extrusion is horizontal and still projects real screen
travel. The fallback is now gated on the Shape working plane as well as the camera. A regression
draws an oblique upright sheet, switches the camera to Plan, checks the handle stays on the
projected world axis, and drags it to a new depth. The browser Plan-depth scenario now asserts the
value change and Create state instead of only recording them. The committed evidence has 20 rows:
19 passed and one deliberate Preview-availability not-run.

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
- The browser review ran against a local authenticated fixture, not a production deployment; its
  results are diagnostic S02 evidence, not S03's exhaustive gate.
- Performance items above are limitations of this record, not passes.

## Remaining before acceptance

1. T1 review of `ink-readings-v1`, `openInkReading`, the palette delegation, the `hasWork` switch
   guard and the task-owner fix.
2. T2 review of the Scene-adapter contribution and the two existing planner call sites.
3. Owner acceptance of this record, and a PR merge under the repository's P1 merge rule. The phase
   register keeps S02 `proposed` because no release-list row exists: this record claims an
   implementation awaiting review, not release authorization.
4. `T5.P01.S03` closes the exhaustive integrated gate, the remaining browser matrix and performance
   rows; the S02 review recorded above does not substitute for it. No capability entry is claimed
   here.
