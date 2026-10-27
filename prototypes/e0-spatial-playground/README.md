# E0 Spatial Playground

**Status:** disposable T5 E0 experiment, built from the
[E0 execution plan](../../docs/roadmap/t5-expressive-geometry/e0-execution-plan.md). Engineering
delivery only: the owner has **not** evaluated it, and it is **not** product-accepted. It selects no
production model, API, UX grammar, R1 scope or architecture. Do not import or promote anything from here.

**Question it serves:** does carrying a spatial idea across form, arrangement and revision help you
reach an intended result, or do competent explicit controls serve that intention just as well?

## Run

Requires Node 20+. The prototype has its own manifest and lockfile and is not a root workspace.

```bash
cd prototypes/e0-spatial-playground
npm install
npm run dev        # http://127.0.0.1:5197
npm run typecheck  # svelte-check
npm test           # vitest: model, file and example checks
npm run build      # typecheck + production bundle in dist/
```

`npx vite-node scripts/make-examples.ts` regenerates [`examples/`](./examples/) from the model commands.

## Owner walkthrough

1. Open the app and read **The brief** (reopen it with **Brief**). Write your intended character and
   focus in **Design notes**; they're saved with each file.
2. Choose an entry path: **Spatial idea first** or **Explicit controls**. Switch at any time from the
   top bar. Switching cancels anything in progress but keeps the design.
3. Make the first display and **Save** it (`e0-<path>-A-<time>.json`).
4. Click **Entrance** in the left panel to move to Entrance B. Nothing is rearranged automatically, and
   the main piece's pose is recorded for the "unchanged" check. Revise, then **Save** separately.
5. Judge both from **Plan** and from **Entrance view** (eye height, just outside the current entrance).
6. **Reset** to the fresh fixture and try the other path, then a transfer intention of your own.
7. Optional engineering check: Open a saved file and keep editing. Try Undo/Redo, Escape during a
   drag, a too-sharp corner and a bad file.

Use whatever operations serve the design. Finishing by placing pieces by hand is legitimate.

### The two entry paths

Both paths share the same document, evaluator, viewport, handles, numeric fields, following,
break-following and free placement. They differ only in how you get there:

| | Spatial idea first | Explicit controls |
| --- | --- | --- |
| Start | **Sketch a guide** or **Borrow placed positions**. The result becomes the active *context*: highlighted, with its points editable in place | **Draw guide** / **Borrow positions** select the new guide (preselection) |
| Build | The context bar offers **Make edge along it** and **Arrange pieces along it** | **Create edge…** / **Arrange…** with a *Source guide* field (prefilled, picker, **Pick in viewport**) |
| Revise | Selecting the edge or a following piece offers **Edit shared guide**, which re-enters the context. Context persists across selection changes until **Clear** or Escape | The same **Edit shared guide** in the inspector opens point handles and highlights. **Done editing** closes them |

**Engineering finding for your evaluation:** there is one guide per document, so the explicit
path's source is always unambiguous and is prefilled. After the source is chosen, the paths
converge. The remaining difference is a persistent context (always-on highlight and point handles,
and context-bar actions) against tools plus an inspector. Whether that is a creative difference or
only relocated controls is your judgment. The explicit path was not weakened to manufacture a
distinction.

### Controls

- **Pieces:** drag to move. Drag the gold handle in front of a selected piece to turn it (5° steps;
  Alt for 1°). X/Z/Turn fields commit on Enter or blur, and Escape restores the field. The light
  plaque and floor tick mark each piece's front.
- **Guide:** click floor points, then press Enter (Backspace removes the last point; Escape cancels).
  Drag points while the guide is in context or being edited. Double-click the guide to insert a point,
  or use the point list (−/+).
  **Borrow** copies the three centres once, in the order you click them. Moving pieces later doesn't
  move the guide.
- **Display edge:** select it. Gold handles set height (top, 3D only) and width (side). The fields
  edit the same values. Width and height are local to the edge; guide edits reshape it.
- **Arrange:** set the margins, a signed side offset, the order along the guide, and **Follow guide**.
  Follow is off by default. Without it, pieces are placed once as free poses and nothing is stored.
  With it, guide edits move the pieces. Re-arranging replaces all three slots, including exceptions.
- **Exceptions:** moving or turning a following piece previews "Break following and move"; release
  to accept, Escape to cancel. The other pieces keep their slots. **Follow guide again** rejoins.
  While the guide is highlighted, a grey ring marks a slot left open.
- **Views:** Plan (top view; +X right, Entrance A at the top) and 3D. Drag to orbit (3D) or pan (Plan);
  Shift- or right-drag pans; the wheel zooms. **Fit view**, **Entrance view**.
- **History:** ⌘Z / ⇧⌘Z (Ctrl on other platforms). Each accepted drag, numeric commit or button is one
  step. **Open** and **Reset** start fresh history.

**Brief checks** report only the checkable facts: edge exists, arrival area clear, within the marked
floor, and main pose unchanged since the entrance switch. Focus, coherence and the preserved quality
are your judgment. Record them in Design notes or the [decision note](./DECISION-NOTE.md).

## What is implemented (plan §4.1 / §5)

- **Model** ([`src/model/`](./src/model/)): one open guide with keyed points, one band (width/height),
  one following arrangement (guide ID, start/end margins, signed side offset, per-piece slot and
  follow flag) and three stable pieces with free poses. Metres and radians on the X/Z floor.
- **Evaluator** ([`evaluate.ts`](./src/model/evaluate.ts)): a pure function used by previews,
  acceptance and reopened files. The band is an offset polygon with miter joins, extruded to height.
  - **Refusals:** zero-length (< 1 cm) or reversing segments, self-crossing guides, miters beyond
    4 half-widths, offsets that fold over on short segments, overlapping band sides, and
    non-finite or non-positive sizes. Each refusal says whether to widen a corner, narrow the band
    or separate segments.
  - **Slots:** placed at `a`, `(a+L−b)/2` and `L−b`, offset by `d·(−tz, tx)`, using the outgoing
    tangent at an exact corner. A following piece's yaw aligns its local +X with the tangent.
- **Session** ([`session.ts`](./src/model/session.ts)): snapshot history and one editable draft.
  Rejected drafts keep a reason and leave accepted state and history untouched. An epoch counter
  abandons in-flight gestures on Undo, Redo, Open, Reset, Escape and path switch, so a late
  pointer-up can't commit an obsolete draft.
- **File** ([`file.ts`](./src/model/file.ts)): saves only authored values, IDs and follow flags.
  It never saves meshes, selection, context or history. Open parses and validates the file
  (version, IDs, references, geometry) before it replaces anything.
- **Refusal instead of repair:** deleting or replacing a guide used by the edge or arrangement is
  refused. There is no object deletion, rebind or reference repair.

**Tolerance:** positional checks use 0.1 mm (`TOL = 1e-4` m). Drags round to 1 cm and turns to 5°
(1° with Alt).

**Tests** ([`tests/`](./tests/)):
- Hand-calculated straight and right-angle band outlines, and slot positions on straight and corner guides.
- Each refusal class.
- Preview/commit agreement.
- A shared revision with a detached piece unchanged.
- Undo, then a new edit clears Redo.
- A stale gesture after Undo/Open can't commit.
- JSON round-trip keeps source, IDs and following.
- Malformed, unknown-version, missing-ID and invalid-geometry files are rejected without mutation.
- Both examples satisfy the checkable brief facts.

## Limitations and deliberate shortcuts

Recorded honestly. None of these is a production direction.

- **Scope:** core only. Optional relationship depth (plan §4.2) is deliberately absent: support
  following, repair/rebind, connected-group copy, and multiple guides or bands. Closed loops,
  snapping, collision and clearance solving are absent too.
- **Arrangement rule:** the middle slot always sits halfway between the margins, so uneven spacing
  comes only from the guide's shape, from margins or from breaking following. While following, yaw
  is locked to the tangent; turning a piece individually breaks following for that piece.
- **Free Arrange:** Arrange without **Follow guide** drops any earlier following relationship.
  Re-arrange with Follow replaces the earlier exceptions. The panel says so before you apply.
- **Undo with a draft:** while a draft (preview or rejected) is open, Undo discards only the draft.
  A new gesture during a rejected draft continues from that draft, and accepting it takes one step.
- **Main-pose reference:** the check's reference is session-only. It is captured when you switch to
  Entrance B and lost on Open or Reset. To compare across files, compare the saved JSON.
- **Clearance check:** footprint overlap with the shaded patch, where touching counts as blocked.
  The floor check includes band miter corners. Pieces may intentionally overlap the edge or each
  other; that is not flagged.
- **3D overlays:** guide lines and handles draw through geometry so they stay reachable. In
  Entrance view they can clutter the read, so **Clear** the context to judge the display.
- **Height handle:** not draggable in Plan (no vertical axis there). Use the field.
- **Design notes:** saved in the JSON. This is a small addition to the plan's stored fields, so
  intention and compromise travel with each alternative.
- **No Threlte:** the donor's own viewport uses plain three.js, and so does this one. There are
  no workers, solver or incremental evaluation; the small document is recomputed and its meshes
  rebuilt and disposed on each change.
- **Browser coverage:** desktop pointer only, verified in the Chromium-based Claude app browser at
  1440×900. There is no touch/pen tuning, small-screen layout or platform matrix.
- **Examples:** [`examples/original.json`](./examples/original.json) and
  [`examples/revised.json`](./examples/revised.json) come from the engineering walkthrough. They
  are not owner designs or evidence of creative value.
