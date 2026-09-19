# Tech-debt ledger — deferred defects

**Audience:** the implementer of a future slice (today: **P24**) plus whoever triages
a bug report against this repository.
**Purpose:** record a defect that is **understood, reproduced and deliberately not
fixed yet** — with the evidence needed to fix it without re-deriving it.
**Not** a plan, not a status tracker and not current working-tree state: those live in
[`docs/roadmap/README.md`](../../roadmap/README.md) and
[`docs/operations/current.md`](../current.md).

Entry template:

```text
## TD-n — <one-line defect>
Status        open | fixed (<commit>) | superseded
Found         date + how it was found
Defer to      slice + why it is not urgent
Symptom       user-visible behaviour, exactly as observed
Reproduce     recipe (and the probe that proved it, if temporary)
Root cause    files/lines, layered primary → latent
Broke when    commit evidence
Why green     which tests would have had to exist to catch it
Fix options   options with tradeoffs + the option that must NOT be taken
Then add      acceptance tests the fix owes
```

---

## TD-1 — Floor-supported placement is unreachable in canonical (wall-first) projects: no camera, primitive, light or asset can be placed

**Status:** open — **deferred to P24**.
**Found:** 2026-09-17, by manual test of *new project → draw a Room → Camera → Plan →
Add Camera*. Reported with a console dump of unrelated Svelte warnings.
**Defer to:** P24. Nothing in P24 depends on it, but P24's placement work
(`P24.2` floor support / resolution reasons) is the natural owner: this defect *is* the
floor-support contract failing on the canonical document format. **P23.14–P23.16 must
not "fix" it incidentally** — it is format semantics, not shell polish.

### Symptom

In a project created by the editor's own **New Project** boot:

- Ribbon `Add Camera` / `Add camera` → Toolbar arms and the status bar says
  `Click any tagged room floor to place a camera`.
- Clicking **inside a drawn Room** — in Camera · Plan or Camera · 3D — produces
  `Click a tagged room floor` on the status bar and **creates nothing**. No camera node,
  no history entry, no error, no toast. The click is simply refused.
- The same refusal applies to the Scene-3D **primitive**, **light** and **asset**
  placement branches. (Layout-level `Place` presets — Column / Platform / Plinth — are a
  different path and still work.)
- The Room itself is fine: it draws in Scene · Plan, Camera · Plan and 3D, is selectable,
  and the Plan hit-test resolves it.

**Why it looks like "the Timeline lanes show up differently"** (the report this came
from): with zero nodes there is no camera flow, so the Camera Timeline renders its
no-sequence state (header + empty `288px` body, `No sequence yet`) and never its lane
surface — see [`../design/P23.14-shell-design-context.md`](../../roadmap/p23-layout-depth/p23.14-shell-visual-system/context/shell-design-context.md)
§3. TD-1 is what keeps the node count at zero.

### Reproduce

Fresh guest project (`/projects` → New Project), Scene · Plan · Layout → `Rect Room`,
drag a rectangle, then Camera · Plan → `Add Camera` → click the room interior.
Legacy/room-first documents (the frozen `/museum/editor` relic, or any pre-P23 imported
layout) behave correctly — this is **format-gated**, not global.

The probe that proved it was a **temporary** vitest file
(`tests/lib/editor/tmp-wallfirst-camera-placement.test.ts`, deleted after use) that built
a closed 4×3 boundary chain with `planWallChain(..., { close: true })` — one reconciled
Room — and asserted:

```text
✓ the wall-first room registry is empty (has/get false, frames throw)
✓ the compiled Plan hit DOES resolve the room (so only the registry gate fails)
× Camera Plan Add Camera can never commit a node in a wall-first document
  Error: Unknown project layout room: room.5:4:face14:wall-chain-1-F14:…
    ❯ Object.localPoint            packages/project-model/src/project-layout-semantics.ts:107
    ❯ EditorNavigationGraphMutator.createPendingNavigationNodeAt
                                   apps/editor/src/lib/editor/store/navigation-graph-mutator.svelte.ts:347
```

### Root cause

Two layers. The first is what the user sees; the second is what a naive fix would hit.

**Layer 1 — the acceptance predicate is room-first, and the canonical format's room
registry is empty *by design*.**

`createLayoutRoomRegistry(layout)` returns the **empty** registry for a wall-first
document:

- `packages/project-model/src/project-layout-semantics.ts:36` —
  `if (isWallFirstLayout(layout)) return createEmptyLayoutRoomRegistry();`
- `:84–88` states why: *"A wall-first Layout carries no Room frames, and a world-local
  Scene carries no `roomId` references (codec-enforced), so resolution never consults a
  frame"*. The empty registry's `has()` is `() => false`, `get()` is `() => undefined`,
  and `point`/`localPoint`/`pointInFrame(roomId)` **throw**.
- The editor installs exactly that registry at boot and after every layout mutation
  (`apps/editor/src/lib/editor/app/EditorApp.svelte:1460`, `:1564` →
  `store.updateRooms`), so re-deriving it can never help: **the emptiness is a function of
  the document format, not of staleness.**

The two camera-placement consumers both gate on that registry:

| Consumer | Gate |
|---|---|
| Camera · Plan — `apps/editor/src/lib/editor/camera-plan/CameraPlanViewport.svelte:272` (`beginPlaceCamera`) | `const entry = store.rooms.get(candidate.roomId); if (!entry) { setStatusMessage('Click a tagged room floor'); return; }` |
| Camera · 3D — `apps/editor/src/lib/editor/EditorSelection.svelte:969–975` (place-camera branch) | `findPlaceableFloorIntersection(intersections, undefined, (id) => store.rooms.has(id))` → `null` → same message |

Neither layer upstream is broken: the compiled geometry **does** produce the room-floor
polygon (`findPlanHitRoom(geometry.queries, [2, 1.5])` returns the canonical room id —
`packages/layout-core/src/layout-geometry.ts:1141`), and 3D **does** tag the floor mesh
`editorSurface: { type: 'floor', placeable: true, roomId }`
(`apps/editor/src/lib/editor/layout/LayoutPreviewScene.svelte:278`). Only the registry
membership check refuses.

**Layer 2 — the placement command itself is room-first, so it cannot be repaired by
loosening the predicate alone.**

`apps/editor/src/lib/editor/store/navigation-graph-mutator.svelte.ts:342–349`:

```ts
const node: SceneNavigationNode = {
  id: nodeId,
  roomId,                                             // ← Room ownership
  …
  position: this.host.rooms.localPoint(roomId, eyeWorld),      // ← throws today
  cameraTarget: this.host.rooms.localPoint(roomId, targetWorld),
```

On an empty registry `localPoint` throws `Unknown project layout room: …`
(proved above). And even a "successful" room-owned write would be **rejected by the
Scene codec**: world-local documents must never carry Room ownership anywhere —
`packages/project-model/src/scene-codec/index.ts:150–151`, `parse-document.ts:141–143`,
enforced at the project level by `project-codec.ts:118` (`scene_not_world_local`) and
`validateProjectSceneRooms`. The node would make the project unsaveable.

### When it broke

Not a regression from any single "camera" change: the **document format moved under the
placement code**, which was already room-first.

| Commit | Date | Effect |
|---|---|---|
| `d5ec0df` — P23.1 (PR #9) | 2026-09-10 | `createLayoutRoomRegistry()` starts returning the **empty** registry for wall-first layouts (`2c9b04d`, 2026-09-09, defined the helper but left it unwired) → every `rooms.has/get/point` gate silently becomes `false`/`undefined`/throw |
| `d1705b7` — P23.3 (PR #19) | 2026-09-11 | the canonical wall-first Layout + world-local Scene pair becomes the **New Project boot** → from here *every new project* is affected |
| `69206f5` — P17/P18 | earlier | the `(id) => store.rooms.has(id)` predicate in `EditorSelection.svelte` predates all of this; it was simply never revisited |

So the user's "since P23 began" is exact: the defect is as old as the wall-first boot,
and no P23 slice has had camera placement on its acceptance list.

### Why the suite is green

- `apps/editor/tests/lib/editor/app/live-rooms.test.ts` — the only test that pins camera
  placement end-to-end — boots `createEmptyLayoutPreviewState()` (the **legacy** blank
  document, *not* the canonical boot) and drafts a Room with `commitLayoutDraftRoom`
  (legacy). It proves the registry seam works for room-first documents and says nothing
  about the canonical pair.
- `p23-3-new-project-boot.test.ts` covers the canonical boot but not placement.
- Evidence-class warning, same shape as P23.13's residue: these tests pin *individual
  seams* (`registry sync`, `predicate`, `createPendingNavigationNodeAt` in isolation).
  No test crosses **canonical boot → placement → committed node**, which is the only
  place the two layers meet. Add that crossing when TD-1 is fixed.

### Not the cause: the `ownership_invalid_mutation` console warnings

The report included many Svelte warnings of the form *"Mutating unbound props
(`cameraPlan`, at `CameraPlanViewport.svelte:665:3`)"* from `onPointerMove:664`,
`onPointerLeave:788`, and the `onMount` writes at `:188`/`:204`. Those are real but
**unrelated and harmless**: `cameraPlan` is a `$state` object owned by `EditorApp` and
passed to `CameraPlanWorkspace` → `CameraPlanViewport` **by value**, so the child's
`cameraPlan.hover = …` / `cameraPlan.planView` writes work but are flagged in dev. The
defect above reproduces with **zero** console output, because a refused placement is a
status message, not an exception. Treat the warning as a separate, low-priority cleanup
(e.g. `bind:cameraPlan` or moving the writes behind callbacks) — do **not** read it as
the bug.

### Blast radius (canonical wall-first projects only)

| Surface | Effect |
|---|---|
| Camera node placement — Plan and 3D | **dead** (`CameraPlanViewport.svelte:272`, `EditorSelection.svelte:969`) |
| Scene primitive placement — 3D | **dead** (same predicate, `EditorSelection.svelte:992`) |
| Scene light placement — 3D | **dead** (`EditorSelection.svelte:1011`) |
| Scene asset placement — 3D | **dead** (`EditorSelection.svelte:1041`; message reads `Click a tagged room floor to place`) |
| `store.focusRoom(id)` | always `false` (`editor-store.svelte.ts:2090`, `!this.rooms.has(id)`) |
| `LayoutRoomRegistry.point/getRequired/localPoint` for a canonical room id | **throws** (`project-layout-semantics.ts:95–107`) — any new caller inherits this trap |
| `isWorldPointInsideRoomXZ` (`editor-camera-path.ts:64`) | returns `false` (documented fallback: caller uses world ownership) — correct behaviour, not a defect |
| Camera authoring *beyond* placement (connect, sequence, timing, framing, Timeline) | **unreachable**, because there is no way to author the first two nodes. Not itself broken |
| Layout editing (`Rect Room`, Walls, Openings, `Place` presets, Arrange) | unaffected |
| Plan/3D Room rendering, selection, Scene footprints | unaffected |

### Fix options for P24

**Option A — make placement world-local for canonical documents (recommended framing).**
A wall-first-aware placement command that commits `roomId: undefined` and stores the
already-correct world-space eye/target (the identity frame is supported today:
`pointInFrame(undefined, p) === p`), with the acceptance check moved from *registry
membership* to the evidence that already resolves — the compiled `room-floor` polygon in
Plan, the `editorSurface`-tagged floor mesh in 3D. This is the direction the format
already declares ("Scene/Camera physical placement is project/world-local",
`north-star.md` §1084–1087) and it is what P24.2's floor-support resolver needs anyway.

**Option B — synthesize identity-frame registry entries for canonical rooms.** Cheaper
(`createLayoutRoomRegistry` returns entries whose `floor` is the wall-first `floor` and
whose points are the world points), but **insufficient alone**: the placement command
would still write `roomId` into a world-local Scene, which the codec rejects. It would
have to be paired with stripping `roomId` — at which point it buys nothing over A, while
keeping room-first ownership semantics alive in a format that forbids them.

**Must not do:** relax the Scene codec (or the wall-first Project validator) to accept
`roomId` on world-local records, and do not "fix" the symptom by special-casing
`rooms.has()` to return `true`. Both would produce documents Save/Publish rejects, or
silently room-owned data in a world-local world.

Whatever the choice, the **refusal copy** is part of the fix: `Click a tagged room floor`
becomes misleading once a Room is not the unit of placement authorization. P24.2 already
owes reasoned refusals for unsupported/unresolved floors (`docs/roadmap/p24-scene-staging/slices/2026-09-10-P24-minimum-child-plans.md`),
so reuse that vocabulary rather than inventing a second one.

### Then add (acceptance tests the fix owes)

1. **Canonical boot → place → commit:** a wall-first document with one reconciled Room +
   `beginCameraPlacement()` + the floor hit ⇒ exactly one unsequenced node, one history
   entry, `roomId` **absent**, world-space eye/target finite.
2. **Round trip:** that project passes `validateProject` and Save/Publish
   (no `scene_not_world_local`, no `unknown_room`).
3. **Both surfaces:** Camera · Plan and Camera · 3D reach the same result for the same
   floor point.
4. **Legacy is untouched:** the existing `live-rooms.test.ts` room-first behaviour and the
   frozen relic keep passing, including the throw-free `rooms.point/getRequired` contract
   for room-first documents.
5. **Refusal is honest:** clicking outside any Room still refuses, with a reasoned message
   and no history entry.

### Related

- [`../north-star.md`](../../reference/north-star.md) — world-local placement target.
- [`../components/camera-tour.md`](../../reference/components/camera-tour.md) — Camera Plan contract
  ("Add Camera needs a room-floor hit" is the premise this defect invalidates).
- [`../components/placement.md`](../../reference/components/placement.md) — placement/grounding.
- P24.2 — shared floor placement, honest transforms, resolution reasons.

---

## TD-2 — Inspector numeric fields announce `:invalid` while holding legal values (step base ≠ `min`)

**Status:** open — **deferred to whoever next owns Inspector numeric entry** (P24 or a later
Inspector slice).
**Found:** 2026-09-19, by reading the accessibility tree of a populated Inspector during P23.14
shell QA (recorded there as finding **F4**).
**Defer to:** the slice that owns numeric entry semantics. The fix changes arrow-key increment
behaviour, which is Inspector entry design, not shell polish — P23.14 records it and deliberately
does **not** "improve" increments incidentally.

### Symptom

Open any Room, Wall Opening, Object or placed-property selection and read the Inspector with an
assistive technology (or `:invalid` in the DOM): fields whose displayed value is perfectly legal —
`0.1`, `0.3`, `3.75` — are announced as **invalid**. Visually nothing is wrong (no stylesheet
paints `:invalid`), so this is an AT-truth defect: a screen-reader user is told the model is in a
state it is not in.

### Reproduce

Scene · Plan → draw a Room → select it → read `Wall thickness`, `Floor thickness`,
`Ceiling thickness`, `Floor height`; then select a placed Object and read `Width / Depth /
Height / Radius`. Probe: in the browser console, `[...document.querySelectorAll('.inspector
input[type=number]')].map(i => [i.value, i.validity.stepMismatch])` — legal values report
`stepMismatch: true`.

### Root cause

The rows set a **`min` that is not on the `step` grid**, and per the HTML spec the step base is
the `min` attribute when present:

```html
<input type="number" min="0.001" step="0.05" …>   <!-- base 0.001 → 0.1, 3.75 off-grid -->
<input type="number" min="0.05"  step="0.05" …>   <!-- base 0.05  → fine -->
```

17 rows carry `min="0.001"` (`EditorInspector.svelte:2357–2362, 2587–2591, 2645–2649, …`); the
`min="0.05" step="0.05"` and `min="0" step="0.05"` rows are correct. The values themselves are
legitimate (a 0.001 m floor is the intent), so this is a constraint-expression bug, not a data bug.

### Why the suite is green

The test suite drives these fields through `onchange` handlers and state assertions; nothing
reads `validity.stepMismatch` or the accessibility tree, and no CSS targets `:invalid`, so the
defect is invisible to every existing check. P23.14's shell tests only assert styling/source shape.

### Fix options

- **Option A (recommended):** align `min` to the step grid (`min="0"` or `min="0.05"`) and rely
  on the existing `onchange` clamp to keep authored values positive. Smallest change; keeps
  arrow-key increments at 0.05 m.
- **Option B:** `step="any"` — legal arithmetic is unrestricted, but arrow-key stepping becomes
  1 (integer) unless a JS key handler supplies the increment. Choose only with an explicit
  increment decision.
- **Must not do:** migrate these fields onto a custom numeric component as part of an unrelated
  slice, or add `:invalid` styling that paints the false state — both freeze wrong semantics
  behind a design decision.

### Then add

1. A test that asserts `stepMismatch === false` for every numeric field the Inspector can render
   with a legal authored value (parameterised over the panel families, not one hard-coded row).
2. An increment test: arrow-up from a legal value lands on the next grid value and stays legal.
3. If Option B is taken, a keyboard test proving the documented increment still applies.

### Related

- P23.14 QA record finding **F4** — [`../../roadmap/p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md`](../../roadmap/p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md)
- Durable shell contract §0.4 (implementation debt, not design) — [`../../reference/design-system/editor-shell-and-visual-system.md`](../../reference/design-system/editor-shell-and-visual-system.md)
- [`../../../apps/editor/src/lib/editor/EditorInspector.svelte`](../../../apps/editor/src/lib/editor/EditorInspector.svelte) — the covered rows.
