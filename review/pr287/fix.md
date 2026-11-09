# PR #287 — Wall manipulation and unfolding: Stage 1 specification

**Status:** Stage 1 review artifact. **No production code has been changed.**
**PR head reviewed:** `4950c2eb` (`claude/spatial-world-t1-planning-3f4013`), 2026-11-09.
**Companion prototype:** [`interaction-review.html`](./interaction-review.html) — self-contained, open directly from disk.
**Stage 2:** not authorized. This document ends with an approve-to-build gate.

Read this with the owner handoff and screenshots `01`–`07`. Tags used throughout:

| Tag | Meaning |
|---|---|
| **[V]** | Verified by reading the code at the stated head. |
| **[S]** | Visible in an owner screenshot. |
| **[H]** | Hypothesis; needs a browser repro before changing production code. |
| **[D]** | Deliberate departure from the donor; rationale given. |
| **[O]** | Material owner decision required before implementation. |

---

## 0. Verdict

The PR's **architecture is sound**: an attempted gesture is display-only, a validated candidate compiles through the canonical planner, release writes one command and one history entry, and the unfold sheet is a development map over the canonical Wall rather than a second geometry authority. The recently fixed Circle ghost, curved silhouette de-striping, two-Wall topology identity and development mathematics should be preserved.

The **interaction layer is not mergeable yet**. The seven captures reduce to six defects and three missing states:

1. A refused Junction or Wall shows one Wall, or a pointer-to-origin reach, not the attempted network. **[S 01–02]**
2. Refused attempts keep proposal cobalt while the tag is coral, and the tag sits at the pointer, not the conflict. **[S 01–02, 04]**
3. Curved selection draws the canonical silhouette plus a second candidate contour. **[S 03]**
4. A new bend is not made active, and the only mark drawn is a four-way move cross; the planner's 0.35 m body tolerance is also used as the knot promotion radius. **[S 04; V]**
5. A curved open Wall has no rigid body move: body drag only bends. This is the current plan's grammar, and it is the grammar the owner proposes to reverse. **[V; O D1]**
6. `wallUnfold.enter` always anchors at station 0; `wallUnfoldAnchor` is test-only. `flip` re-requests a `face` camera move. The sheet has no Opening voids, no door, no ruler, no seam, and no complete as-built frame. **[V; S 05, 07]**

The missing states are: **whole-network refusal truth**, **accepted-with-warning**, and **a deliberate partial/peel state with reduced-motion and exact return**.

The recommended model is not a mechanical application of the owner's notes. Two proposals are challenged:

- The **donor is not evidence for Wall-editing grammar**. It is a museum viewer; its transferable evidence is the sheet, anchor, camera discipline, as-built and Opening presentation. Body-move / modifier-bend is justified by the current PR's contradiction and the owner's hypothesis, not by donor behavior.
- **Warnings must not become soft refusals.** An amber state is only for a candidate the canonical planner already accepts, or for a representable state whose only consequence is a deterministic Room re-derivation or a gap. Anything that needs a new connection/split/Room-identity semantic stays refused. **[O D2, D8]**

---

## 1. Evidence and method

| Source | Used for |
|---|---|
| `START_HERE.md` | Owner observations, proposed grammar, Stage 1/2 gate, required deliverables. |
| `screenshots/01`–`07` | The observed failures and the donor benchmark. |
| `prototypes/spatial-authoring/IMPLEMENTER-REFERENCE.md` | Sheet/peel/as-built/camera/selection rules; §§1–13. |
| `prototypes/spatial-authoring/app/journeys.js` (Journey A) | Executable donor choreography and the 222° benchmark. |
| `docs/roadmap/t1-spatial-world/expressive-walls/implementation-plan.md` | D1–D14, checkpoints 3/5/6, development map, display cut D11, edit policy D13, camera face D14. |
| `layout.adapter.ts`, `StageOverlay.svelte`, `refusals.ts` | Candidate and refusal production paths. |
| `wall-unfold*.ts`, `StageWallDevelopment.svelte`, `LayoutWallUnfold.svelte`, spatial route | Unfold state, sheet, camera and pick paths. |
| `interaction-review.html` | The proposed behavior, exercised with scripted pointer events. |

This is a **code-read review plus an executable design prototype**. No repository test suite was run in Stage 1. Root causes marked **[V]** are direct code facts at `4950c2eb`; **[H]** items need a browser repro in Stage 2 before edits.

### 1.1 Prototype verification (what was actually exercised)

The HTML was driven in the local browser with synthetic pointer events, not just inspected:

- connected Walls: wall move commits one history entry; a Junction dragged across Wall 3 shows the whole attempted network in coral and commits nothing; a 0.20 m near-miss commits with an amber "no connection" warning;
- bend: plain body drag moves the Wall and keeps zero knots; ⌘-drag adds one knot and makes it active; Delete removes it; dragging the Wall onto the partition refuses with "would lie on P1" and reverts;
- circle: Flat produces a 535 × 247 sheet with a hit-testable door; dragging the door changes its canonical station and records one history step; Inside/Outside flips the reading side without a camera; Done returns to `u = 0` and the entry view copy.

Known simplifications, stated in the demo: oblique 2.5D projection, no occlusion/depth, no canonical compiler, a radial ribbon approximation of the development map, and simplified neighbour deformation. The prototype does **not** prove production geometry, Room derivation, pick accuracy or camera behavior. It is a behavior contract, not a geometry oracle.

---

## 2. Traceability: donor → current → recommendation

### 2.1 Manipulation and feedback

| Area | Evidence | Current #287 | Observed effect | Recommended | Tag |
|---|---|---|---|---|---|
| Junction preview | Owner screenshots 01–02; current adapter | `attemptedWallGesture` builds **one** Wall (`[frame.start, frame.end]` with one endpoint moved). `candidatePreviews` returns that attempt as `role: 'subject'` plus a refusal tag at `pointerPoint`. Incident neighbours are absent. | A two-Wall change is previewed as one Wall; the "reach" reads as the whole change; the tag is at the hand. | Build the attempted network: move the Junction, move every incident Wall's shared endpoint, and draw all of them as one refused candidate. Mark the conflict at the actual segment intersection. Never draw a pointer-to-origin segment. | [S][V] |
| Refusal colour | 01–02, 04; `StageOverlay.svelte` CSS | `.candidate .candidate-edge` uses `--overlay-ghost` (cobalt) for both `subject` and `affected`; only `.refused` is coral. A refused attempt is emitted as `subject`, with a separate `refused` tag. | Cobalt attempt + red tag: two meanings, one gesture. | One colour one meaning. A refused attempt is **coral as a whole**; an accepted proposal is cobalt; a warning is an amber tag/note on a cobalt or committed ochre object. | [S][V] |
| Refusal location | 01–02, 04 | Tag at `pointerPoint` or `attemptPoint`; no conflict marker. | The creator cannot see which Wall/segment refused. | A conflict marker at the real intersection/overlap, a short coral leader if the tag must be offset, and the offending segment emphasised. The tag may say "Wing would cross Wall 3" at the crossing. | [S] |
| Refusal words | 01, 04; `refusals.ts` | `wallRefusalWords` covers many codes but falls back to "This change cannot be applied." The bend preview path passes `planned.code`; a reachable bend code is unmapped. | Screenshot 04's generic sentence; 01's generic sentence vs 02's specific one. | Map every code reachable from Wall/Junction/bend/Opening gestures. Keep the default only as a logged last resort; tests assert specific words for each reachable code. | [S][V] |
| Curved silhouette | 03 | Canonical selected Wall draws its ochre silhouette while the bend candidate draws a band outline; `wallProposalPaper` publishes the whole proposed Wall, not a centerline. | Double contour, ambiguous "which is the Wall". | While a Wall gesture is live, suppress the canonical body silhouette and draw **one** dashed candidate centerline. The selected ochre body returns on cancel/commit. Keep the as-built/reference separate. | [S][H] |
| Bend handle | 04; `markDescriptors` | Curved Walls publish no permanent knots; only the active/dragging knot is drawn. A new bend commits without setting `activeKnot` (only a subsequent click on an existing knot sets it). The active glyph uses `cross: true` (four-way move). | After a bend there is no visibly editable point; when one appears it reads as "move", not "bend". | A new bend becomes active **as soon as it is inserted** (live during the drag, active after release) and is drawn as a bend mark: point + tangent tick, not the four-way cross. Only active/hovered knots are drawn. Delete/Backspace removes the active knot. | [S][V] |
| Knot promotion | 04; `layout.adapter.ts` | `BEND_BODY_TOLERANCE_METERS = 0.35` is used for the nearest-knot search and for `wallStationNearPoint`; also used as the body band. | A world-space 0.35 m radius changes with zoom and steals presses far from the visible mark. | Point marks (knot, Junction, jamb) use a **screen-space 10 px** promotion radius; the Wall body uses a screen band (`max(6 px, half-thickness in px + 4 px)`). Keep 0.35 m only as a geometric fallback for ray/plane sampling, never for mark promotion. | [V] |
| Curved body move | Owner handoff A; current adapter | Body press on a curved open Wall opens a bend; there is no plain-drag translate. | A bent Wall cannot be moved without editing its shape; the creator adds bends accidentally. | Plain body drag = rigid translation of the whole Wall (endpoints, knots, and shared Junctions). Modifier (⌘/Ctrl) or armed Bend = insert a bend at the grabbed station. This reverses plan D1. | [V][O D1] |
| Straight body move | Current adapter | Straight Wall body already has a rigid move (`mode: 'move'`) with a normal-distance drag. | Works; preserve it. | Keep; unify the curved path with it so both use one translation contract and one history entry. | [V] |
| Junction availability | Owner handoff A; 01–02 | Junction end marks exist on a selected Wall; a hover Junction candidate exists. The refusal path is the failure, not necessarily the absence of the gesture. | The gesture works but its preview lies. | Preserve Junction/Opening precedence; do not hide Junction marks when a Wall is selected. If 3D picking is unreliable, keep the precise edit in Plan and expose the same values in the Card. **[H]** Repro before changing reading gates. | [H] |
| Snap | 04; plan D-snap | Grid/axis snap exists; bend insertion snaps by station. | A bend can land a few centimetres off the visible line; the handle is not obviously snapped. | Show the snap chip (`Grid 0.25 m`, `Axis`, `Wall`, `Junction`); snap the inserted knot to the Wall centerline at insertion, then to the grid/axes while dragging. Do not silently connect to another Wall; connection requires an explicit Junction snap. | [V] |
| History | Current adapter | Accepted gestures commit one command; refused samples install no preview/history. | Correct principle; keep. | Exactly one entry per accepted release, including multi-knot moves; zero for refusal/cancel; Undo restores the whole network, not one Wall. | [V] |

### 2.2 Unfolding, sheet and camera

| Area | Donor evidence | Current #287 | Observed effect | Recommended | Tag |
|---|---|---|---|---|---|
| Anchor | Donor 222° sheet anchored at the place being studied; gold anchor dot; camera inset. | `wallUnfold.enter(wall, anchorStation = 0)`; Card calls `enter(compiledWall)` so the anchor is always 0. `wallUnfoldAnchor` (Opening → view centre → start) is implemented but unused in production. | Sheet unrolls from an arbitrary end, away from the creator's view. | Pass a computed anchor: selected Opening centre on this Wall → station nearest the view-centre ray → canonical start (open Walls, headless fallback). For closed Walls, wrap the anchor; the display cut stays opposite. Never default to 0 when a view centre exists. | [V][S 05][O D5] |
| Camera on entry | Donor uses a face view for the sheet; explicit focus. | `enter` issues one `face` request and animates `u: 0 → 1` over `FOLD_SECONDS = 1`. | A forced fit is acceptable for an explicit Unfold, but not for a peel/scrub. | One `face` fit is allowed only on an explicit **Unfold** action. A drag/peel open, a scrub, a side flip and a partial stop never move the camera. Done/Refold restores the recorded entry pose and reading exactly. | [V][O D5] |
| Camera on flip | Donor used camera choreography; owner explicitly rejects a spin. | `flip(wall)` calls `#requestFace(wall, state, state.u)` → the route records entry and issues another `face`. | Inside/Outside unexpectedly moves the camera. | Flip is a **display-only** side change. No camera request. The sheet's station reading direction reverses about the anchor; the as-built stays put. This is a deliberate departure from the donor's camera move. | [V][D][O D6] |
| Partial/flat | Donor 222° partial unroll; Flat stop; station ruler; as-built ring. | Development map exists; `u` controls the sheet. No peel/dog-ear; `Flat`/`Half` jumps; sheet is built with `buildDevelopedWallMesh(..., { thickness, height, spans })`. | Partial works mathematically but has no physical peel affordance; the sheet is visually a smooth ribbon with no working-surface detail. | Keep the development map. Add a peel handle at the anchored edge with the donor's 260 px full-open mapping, magnetic stops at 0 / 0.5 / 1, a dog-ear shadow, and no camera motion. Reduced motion snaps instantly. | [V][S 06] |
| Sheet fidelity | Donor: top/perimeter contours, wall grid, door/window voids, labels, station ruler, seam ticks, as-built ring + top line + verticals. | Sheet mesh has **no Opening voids**. Opening contours are only on one face with four edges (`openingCount * 4`); as-built is two horizontal rings + one top line, no verticals/label; no ruler/seam. | The sheet cannot be a working surface: openings are lines, the as-built is detached, scale is unreadable. | Build the sheet as a real developed surface: perimeter/top/bottom, seam and cut ticks, station ruler with canonical (wrapped) stations, Opening voids with sill/head/jamb and a door leaf, anchor pin, registration lines to the as-built, a complete as-built frame (base ring, top ring, verticals, label). | [V][S 05,06,07] |
| Opening mapping | Donor labels openings, supports measure/edit without moving the view. | Unfolded pointer press picks the sheet and selects a canonical Opening via `developmentOpeningIdentity`; canonical marks remain behind the hidden Wall. `unfoldCanonicalStation` adds `anchorStation` and is test-only. | A creator can select a door on the sheet but cannot see/edit it there; the canonical↔sheet station mapping may be anchor-relative while the display map is cut-relative. | Press a void/door on the sheet → select the canonical Opening; drag body slides, jamb resizes; commit through the existing Opening planner with the canonical offset/width. Draw the preview on the sheet and the as-built. Refuse with Opening-specific words at the Opening. Verify the mapping against the development cut (H1). | [V][S 06][O D7] |
| As-built | Donor dashed ring, top line, verticals, "top is 20 cm below the ceiling" note. | Two rings at `datum + 0.03` and `datum + height + 0.24`, plus one top line; no verticals or label. | The as-built floats and does not read as the original Wall. | Base ring at datum, top ring at height, verticals at a fixed sample interval, subdued dashed ink, "as built" label, registration lines at Openings. Add the ceiling note only when the Scene provides a real ceiling relation; never invent it. | [V][S 05,06] |
| Exit / exact return | Donor "Escape rolls it back"; "every number is measured along the real wall". | `#requestReturn` restores the entry state; Done/Refold exists. | The principle is right; the flip and fold paths violate camera preservation. | Done/Refold: `u = 0`, camera pose + reading exactly the entry, selection preserved, no history. Escape during peel/scrub cancels to the previous stop (or entry when fully open). Removing the Wall or replacing the document invalidates and returns with a notice; never guess a nearby Wall. | [V][S 06] |
| Scene objects | Donor shows Scene items "passive here" and real anchored relations. | Not represented on the sheet; no attachment contract. | A sheet that becomes a working surface will invite the question. | Out of #287. Define a future Scene attachment contract (Wall id + station + height + side + object id); do not project nearby Scene objects or build an attachment system silently. **[O D7]** | [S 06] |
| Slider copy | Donor uses "Unrolled", "Flat", "Inside/Outside", "Square 3D". | `LayoutWallUnfold.svelte` labels the range **"Curvature"** and prints `u * 100%`; at fully flat it reads "Curvature 100%". | The label says the opposite of the state. | Label "Unfold" (0% folded, 100% flat) or "Unfolded"; show "Flat" at 100%; keep Flat/Half/Inside-Outside/Done; add an accessible description. | [V][S 05] |

### 2.3 Deliberate deviations from the donor

| Donor behavior | Recommendation | Why |
|---|---|---|
| Camera moves into a face view and can swing 180° for the other side. | Fit once on explicit Unfold; never move for scrub/peel/flip; Done returns exactly. | The owner's working surface must stay put; a camera spin destroys the anchor relationship and disorients. The sheet's reading direction, not the camera, carries Inside/Outside. **[O D6]** |
| Unroll is a viewer gesture with a gold anchor dot and a camera inset. | Editor exposes a Card + peel handle; anchor pin and as-built stay visible. | Authoring needs a stable, discoverable control and keyboard access, not a viewer's guided journey. |
| "UNROLLED · VIEW ONLY". | "UNROLLED · OPENINGS EDITABLE" (or a short "Edit openings" chip). | #287 explicitly makes the sheet the working surface for Openings; "view only" contradicts D13. |
| As-built includes a scene-specific ceiling note. | Include it only with a real ceiling relation from the Scene. | Do not fabricate spatial claims from an approximation. |
| The donor's 222° sector is chosen for the Rotunda. | The sector is `222°` for the demo benchmark, but production uses the available Wall length and the anchor; the stop is a percentage, not a fixed arc. | A fixed 222° would clip arbitrary Walls. |

---

## 3. Interaction contract

### 3.1 Activation and priority

One pointer-down resolves exactly one subject. Priority, highest first:

1. **Active bend point** — within 10 CSS px of the active mark.
2. **Opening on the sheet** — inside a drawn void/door/jamb (sheet mode).
3. **Junction** — within 10 CSS px of a visible end/junction mark.
4. **Wall body** — within the screen band of the sampled centerline.
5. **Room label / other subject** — existing Stage precedence.
6. **Empty** — navigation.

Hover reveals a mark and its label; selection does not preempt a nearer mark. Only the active or hovered knot is drawn; no permanent knot constellation. The modifier state is read on pointer-down and fixed for the gesture (changing it mid-drag does not change the gesture). The press point is stored in world coordinates with a grab offset, so the Wall/knot does not jump on the first move.

### 3.2 Gesture grammar

| Gesture | Straight open Wall | Curved open Wall | Closed Wall | Junction | Opening |
|---|---|---|---|---|---|
| Plain body drag | Rigid translate both endpoints; incident Walls follow. | Rigid translate endpoints **and all knots**; no new bend. | Existing D8 translate; radius grip unchanged. | — | — |
| ⌘/Ctrl-drag body (or Bend armed + drag) | Insert one bend at the grabbed station; drag it. | Insert one bend at the grabbed station; multiple allowed. | Not applicable; do not bend a closed Wall. | — | — |
| Drag active/hovered knot | — | Adjust that knot; one history entry on release. | — | — | — |
| Drag Junction mark | Both incident Walls' shared endpoint follows; neighbours stretch/rotate through the existing Junction planner. | Same; preserve the curved neighbour's knots in world space. | If supported by the planner, the existing Circle junction behavior; otherwise refuse specifically. | — | — |
| Drag Opening body / jamb (sheet) | — | — | — | — | Slide / resize; canonical planner; preview on sheet + as-built. |
| Drag peel edge | — | — | — | — | — |
| Scrub / Flat / Half | — | — | — | — | — |

**Modifier alternatives (required):**

- `B` toggles **Bend armed** for the next body gesture; a visible Bend button in the Card reflects the state; `Esc` disarms. This is the keyboard-accessible alternative to ⌘.
- Touch: press-and-hold (≈300 ms) on the body arms Bend and shows a ring; releasing without moving disarms. Alternatively, the Card's Bend button remains the discoverable path. Do not require a modifier on touch.
- Platform: ⌘ on macOS, Ctrl on Windows/Linux; both are accepted; the UI copy names the current platform's key.

**Release semantics:**

- Accepted: one command, one history entry, toast "Applied: …".
- Accepted with warning: one command, one history entry, amber toast + Card note; the note persists until the next gesture, not a blocking dialog.
- Refused: revert to the gesture baseline, no history; the attempted network remains visible as a coral settled state with the conflict tag until the next press or Escape. The last valid sample is not frozen as a commit candidate.
- Cancel (Esc / pointercancel): revert, no history, clear the attempt.
- Invalid→valid→invalid during one drag: every move revalidates; never keep a stale valid ghost next to an invalid attempt.

**Bend insertion details:**

- The new knot's station is the press station on the Wall, not the pointer's perpendicular projection after the first move. The pointer offset is preserved.
- The new knot becomes active on press (so it is immediately editable) and remains active after commit. A click on an existing knot activates it; a click elsewhere clears it.
- Delete/Backspace removes the active knot (one history entry); straighten removes all knots (one entry); active knot coordinates are shown in the Card.
- Snapping: at insertion, snap to the Wall centerline; while dragging, snap to grid, Wall axes, Junctions and other Wall centerlines, with a named snap chip. A snap to another Wall that would create a connection must be an explicit Junction snap, not an incidental grid hit.

### 3.3 Visual grammar and copy

| State | Geometry | Tag / note | Meaning |
|---|---|---|---|
| Selected / accepted | Ochre body, ochre selection | None or neutral | This is the committed Wall. |
| Proposal | Cobalt dashed; moved Wall solid-ish, affected neighbours thinner; length deltas | Cobalt snap chip | This is what release would commit. |
| Accepted with warning | Cobalt proposal; after commit ochre | **Amber** tag/note at the consequence (Room label, gap midpoint) | Representable, but the consequence must be said. |
| Refused | **Coral whole attempted network**; offending segment emphasised | Coral tag at the real conflict | Release writes nothing; the attempt is evidence, not a proposal. |
| As-built | Subdued grey dashed | "as built" | The canonical Wall, not a second geometry. |
| Sheet | Vellum, wall grid, ruler, seam, anchor pin | "UNROLLED · OPENINGS EDITABLE" | A working view of the Wall. |

**Copy deck:**

- Scrub label: **Unfold**; output `0%` = folded, `100%` = flat; stop label **Flat** at 100%.
- Controls: `Flat` · `Half` · `Flip to Outside` / `Flip to Inside` (the label names the other side) · `Done`; helper "No view moves; Openings edit in place."
- Warning near-miss: `0.20 m gap to Wall 1 — no connection.`
- Warning Room: `Room 1 area 24.0 → 22.0 m². No topology change.` (Only if the planner actually accepts the Room re-derivation.)
- Refusal crossing: `Wing would cross Wall 3. Move it clear.`
- Refusal overlap: `Wing would lie on Wall 1. Move it clear.`
- Refusal Opening: `Door D1 would end 0.32 m past the 4.72 m Wall. Move it 0.32 m earlier or narrow it.`
- Refusal Room: `This would break Room 1. Move the Wall back or split the Room deliberately.`
- Refusal fallback: never shown for a reachable code; log the code and keep the sentence as a last resort for unknown future codes.

The tag must name the **moved** subject first (`Wing would cross Wall 3`), not whichever wall the loop visited first. The prototype implements this by passing the moved Junction/Wall set into validation.

---

## 4. Validation and topology

### 4.1 The three tiers

| Tier | Definition | Examples | Presentation | Write? |
|---|---|---|---|---|
| **Accepted** | Canonical planner accepts; no semantic surprise. | Move a Wall into free space; acute corner; concave Room; narrow but clear gap; ordinary Opening slide/resize. | Cobalt proposal → ochre commit. | Yes. |
| **Accepted with warning** | Canonical planner accepts **and** the consequence is deterministic and explainable. | Room area changes; Room re-derivation with stable identity; a near-miss that stays unconnected; a Junction snap that connects two Walls and re-nodes at an existing point; a Wall endpoint landing on another Wall with an explicit Junction snap. | Amber tag/note; geometry stays a proposal (cobalt) until commit. | Yes, after owner approval of the wording and semantics. |
| **Refused** | No canonical state exists, or accepting would invent a connection/split/Room identity. | Crossing without a node; collinear overlap; self-intersection; duplicate Junction; zero-length Wall; interior contact without connection; closed-Wall external connection; Room identity loss; implicit Room splitting; arbitrary overlap/fold. | Coral whole attempted network + conflict at the real feature. | No; no history. |

**Rule:** a warning is a classification of an already-valid candidate, not a relaxation of canonical validation. Never call a validator with warnings enabled in a way that admits an invalid document.

### 4.2 Smallest safe relaxations

1. **Audit over-refusal of unusual but valid shapes.** Concave rooms, acute angles, narrow gaps, collinear adjacent Walls and a Wall along another's extension are valid if the planner compiles them; they must not be refused for looking unusual. Add characterization tests for each.
2. **Warn on Room consequences only where identity is stable.** A Room area change is not a refusal; a changed Room identity or a lost/merged Room is a refusal until an explicit split/merge semantic exists.
3. **Near-miss is not a connection.** A gap ≥ the connection tolerance is accepted with `no connection`; do not silently snap. If the creator wants a connection, they must land on the Junction snap.
4. **Do not accept crossings/overlaps.** A planar layout cannot represent two Walls crossing without deciding whether they connect, split, or pass in different planes. That decision is a new topology semantic, not a #287 bug fix. Refuse.
5. **Explicit Junction snap for a T-contact.** If the planner supports noding a Wall at an interior point, the snap must be visible and named ("Connect to Wall 2"); the resulting Room re-derivation is a warning, not a silent topology change.
6. **Closed Walls are not implicitly connectable.** An external Wall touching a closed Wall is refused unless the existing planner explicitly supports the connection; do not invent it.

### 4.3 Refusal taxonomy and examples

| Code family | Example | Words | Conflict marker |
|---|---|---|---|
| `unconnected_crossing` / `collinear_overlap` / `self_intersection` | Wing moved across Wall 3 | "Wing would cross Wall 3." | The crossing point / overlap span. |
| `duplicate_junction_point` / `duplicate_joined_wall` | Two Junctions land on the same point | "That would put two Junctions in one place." | The duplicate point. |
| `junction_degree_not_two` | Three Walls forced into one Junction without noding | "This Junction cannot carry three Walls here." | The Junction. |
| `room_identity_lost` / `room_reconciliation_rejected` | Wall moved until Room 1 vanishes | "This would break Room 1." | The Room label / lost boundary. |
| `opening_*` | Door pushed past the Wall end | Opening-specific, with overrun metres | The Opening edge. |
| `zero_length_wall` | Endpoint dragged onto the other | "A Wall cannot be zero length." | The collapsed Wall. |
| `unsupported_geometry` / `curved_wall_unsupported` | Bend on a shape the planner cannot represent | "This shape is not a valid Wall layout." plus the reason | The offending span/knot. |

The default "This change cannot be applied." is removed from every reachable path. Tests should enumerate the codes the adapter can produce and assert a specific sentence.

### 4.4 Examples the prototype encodes

- Dragging the lower-right Junction so the Wing crosses Wall 3: **refused**, whole Wing + affected Walls coral, conflict at the crossing, no history.
- Dragging the same Junction to a 0.20 m gap: **accepted with warning**, amber "no connection", no topology change.
- Dragging the Wall onto the partition: **refused** ("would lie on P1"), no history.
- Moving a Wall 0.5 m left: **accepted**, one history entry; the connected neighbour stretches; the Room area updates.

---

## 5. Unfolding contract

### 5.1 Anchor

`wallUnfoldAnchor` is the intended policy and is already implemented; **wire it**:

1. If a selected Opening belongs to this Wall, use its centre station.
2. Else use the station nearest the view-centre ray (project the view centre onto the Wall/plan; do not use the camera eye as a station).
3. Else use the canonical start (open Wall) or wrap 0 (closed), as a deterministic headless fallback.

At entry, `createWallUnfoldState` sets `cutStation = wrap(anchor + L/2)` for closed Walls (D11); the display cut never moves the canonical seam. The store currently calls `enter(wall, 0)`; fix the call site and add a test that the anchor is not 0 when the view centre or a selected Opening exists. **[V]**

### 5.2 Camera

- Record `entry = { pose, reading }` **before** the first camera request.
- On explicit Unfold, one `face` fit is allowed (the current behavior); the fold animation may run on the declared clock.
- On **peel/scrub/flip/partial stop**: no `face`, no `set-view`, no `recordEntry` overwrite.
- On Done/Refold: issue exactly one `set-view` to the recorded entry pose and reading; do not fit again, do not guess.
- If the document changes or the Wall disappears: invalidate, return to the entry pose with a notice, no nearby-Wall substitution.
- Reduced motion: `u` jumps to the target, no 1 s animation; camera fit (if explicitly requested) uses the app's reduced-motion camera path.

### 5.3 Side and reading direction

`flip` is `flipWallUnfoldSide` only. The sheet's station axis reverses about the anchor; the as-built, camera and Room stay put. The displayed face label says `Inside` or `Outside`; the station ruler and Opening labels remain canonical. **Do not** call `#requestFace`. This deliberately differs from the donor's 180° camera move; the sheet itself communicates the side. **[D][O D6]**

### 5.4 Sheet coordinate system and Opening mapping

The sheet uses one station domain:

- **Open Wall:** `sheetStation = canonicalStation - anchor`, clamped to the Wall's available span; inverse `canonical = anchor + sheetStation`.
- **Closed Wall:** shortest signed difference from the anchor, wrapped modulo `L`; inverse wraps.
- **Display cut:** the development map cuts opposite the anchor. If the map's `s` is measured from the cut, the helper must use the cut origin, not the anchor. This is **[H1]**: `unfoldCanonicalStation` currently adds `anchorStation` and is test-only, while `developmentOpeningIdentity` uses the development's own station. Reproduce with an Opening that crosses the seam (the donor's Rotunda has one) before changing any mapping. Do not change the canonical writer to compensate.

**Opening edits on the sheet:** the sheet is the addressed surface while unfolded. Pressing a void/door selects the canonical Opening; sliding the body changes its offset, dragging the jamb changes its width; both feed the existing Opening planner with canonical values. Preview is drawn on the sheet **and** on the as-built; refusal is at the Opening edge with Opening-specific words. Canonical marks behind the sheet are suppressed; there is no second writer and no editor-only geometry.

### 5.5 Sheet content (minimum for #287)

- Perimeter: developed top and bottom edges, seam/cut ticks at both ends.
- Station ruler: every metre (minor) and 5 m (major), canonical stations wrapped at `L`; the anchor pin labelled "view anchor" at station `s`.
- Wall grid/material: subdued; the sheet remains unlit vellum so shading cannot imply the wrong surface.
- Openings: real voids (not just contours), sill/head/jamb, a door leaf for doors, the Opening label and dimension; selected Opening highlighted.
- As-built: base ring at datum, top ring at height, verticals at a fixed sample interval, dashed subdued; "as built" label; registration lines from each Opening to its as-built place.
- Scale note: "Flat sheet · stations and heights to scale" at `u = 1`; "Partial unfold · heights true · widths follow the curve" otherwise.
- Focus/selection: the unfolded Wall is the only subject; other Walls/Rooms remain in the Scene, not on the sheet.

### 5.6 Peel

- Drag the anchored edge; full open at 260 CSS px (`WALL_UNFOLD_DRAG_CSS`), matching the donor.
- Magnetic stops: 0, 0.5, 1 within the declared tolerance; releasing below the close threshold folds back silently; otherwise the sheet stays where left.
- A dog-ear/shadow reads as paper being peeled, not a modal. No camera motion. Esc cancels to the previous stop; a second Esc/Done folds.
- Keyboard: the Card range and Flat/Half/Inside-Outside/Done are the accessible path; the peel is an optional affordance.
- Reduced motion: no fold animation, no dog-ear flourish; snap instantly.

### 5.7 Scene scope boundary

Only the selected Wall unfolds. Rooms, other Walls, and Scene objects remain in the 3D Scene; no object is projected onto the sheet in #287. A future contract may attach a Scene object to `(wallId, station, height, side)` and draw an anchored marker on the sheet; nearby objects must never be silently treated as attached. This is explicitly out of #287. **[O D7]**

---

## 6. Implementation slices

Each slice is independently reviewable, keeps canonical validation intact, and ends with tests. Do not implement slices before owner approval.

### S0 — Characterization (tests only)

- Pin the current behavior of: junction refusal candidate ids/roles/geometry; bend refusal candidate; knot activation after commit; unfold anchor; `flip` camera calls; sheet mesh vertex/opening contour counts; `Curvature` copy.
- Add a browser repro for **[H1]** (closed-Wall sheet station vs cut) and **[H2]** (which refusal code produces the generic sentence).
- No production change. This slice is the safety net for every later diff.

### S1 — Preview truth

- Replace the single-Wall `attemptedWallGesture` with a pure `attemptedNetwork` that accepts the moved Junction/Wall and returns every changed Wall's endpoints/frames; use it for both accepted and refused proposals.
- Emit refused candidates as `role: 'refused'` for the **whole** network; add a zero-geometry conflict marker with the label at the true intersection/overlap; remove the pointer-to-origin reach and pointer-anchored tag.
- Map every reachable refusal code to specific words; name the moved subject first.
- Tests: multi-Wall Junction drag, invalid→valid→invalid, whole-network roles, conflict point, no history, no "cannot be applied" for reachable codes.
- Files: `layout.adapter.ts` (`attemptedWallGesture`, `candidatePreviews`, bend/wall/junction branches), `refusals.ts`, `StageOverlay.svelte` (roles/classes), tests.

### S2 — Gesture grammar and handles

- Plain body drag on a curved open Wall translates endpoints + knots; modifier/armed bend inserts one knot; preserve straight-wall behavior.
- New knot active immediately; active glyph = bend mark, not `cross`; point promotion 10 CSS px; body band in px; delete/straighten.
- Suppress the canonical body silhouette while a live Wall gesture draws one dashed centerline.
- Preserve Junction/Opening precedence; do not hide Junction marks when a Wall is selected; repro the reading gate before changing it.
- Tests: move-with-knots (count unchanged), add bend (one knot, active), multiple bends, delete, straighten, overlap refusal, priority overlap, snapping.
- Files: `layout.adapter.ts` (`bend*`, `markDescriptors`, `hit` resolution, `BEND_BODY_TOLERANCE_METERS`), `StageOverlay.svelte` (bend glyph), tests.

### S3 — Copy, controls, motion

- `Curvature` → `Unfold`; 100% reads `Flat`; aria-valuetext "N percent unfolded"; helper copy; unbold/fix the "UNROLLED · VIEW ONLY" chip.
- Reduced-motion path in `animateTo`; no 1 s fold under `prefers-reduced-motion`.
- Toast/note copy for warning vs accepted vs refused.
- Tests: DOM text/aria, reduced-motion state transitions.
- Files: `LayoutWallUnfold.svelte`, `wall-unfold-store.svelte.ts`, `StageWallDevelopment.svelte` (chip copy), tests.

### S4 — Anchor and camera

- Compute and pass the anchor at every `enter` call site; wire `wallUnfoldAnchor` with the selected Opening centre and the view-centre station.
- `flip` stops calling `#requestFace`; no `recordEntry` outside the first Unfold; Done issues exactly one return.
- Tests: anchor priority, closed wrap, no camera on flip/scrub/peel, entry restoration bit-for-bit, removal invalidation.
- Files: `wall-unfold-store.svelte.ts`, `+page.svelte` (executor/call sites), `wall-unfold.ts`, `wall-unfold.test.ts`, page tests.

### S5 — Sheet fidelity and Opening editing

- Draw opening voids/door/sill/head/jamb; station ruler, seam/cut ticks, anchor pin, registration lines; complete as-built frame.
- Map canonical↔sheet stations through the verified cut origin; add inverse pick for door/jamb; preview on sheet + as-built; commit through the existing Opening planner.
- Tests: meshes contain void boundaries (not just contour pairs), door leaf orientation, ruler wrap at L, as-built verticals, seam-crossing Opening, door slide/resize round-trip, refusal at the Opening.
- Files: `StageWallDevelopment.svelte`, `wall-unfold-pick.ts`, `layout-core` wall-development API (possibly a holes/spans option), `+page.svelte` unfolded press, tests. This is the largest slice; split into S5a (sheet) and S5b (Opening edit) if review size matters.

### S6 — Peel, keyboard, touch

- 260 px peel, dog-ear, magnetic stops, Esc cancel, reduced-motion instant.
- `B`/Bend button, ⌘/Ctrl detection, touch long-press; focus order and keyboard-only journey.
- Tests: drag mapping, snap stops, cancel, touch gesture, keyboard operation.
- Files: `wall-unfold-store.svelte.ts`, `+page.svelte` press handling, `LayoutWallUnfold.svelte`, tests.

### S7 — Browser acceptance and docs

- Recreate screenshots 01–07 as passing journeys; update `docs/reference/components/layout.md` and the plan's checkpoint notes; record any deviations (camera, warnings).
- No merge; no production schema/validator relaxation.

---

## 7. Acceptance tests

### 7.1 Automated (Vitest)

| # | Test | Assertion |
|---|---|---|
| 1 | Junction drag, valid | Candidate contains the pressed Wall + every incident/affected Wall; roles are `subject`/`affected`; release commits one command; Undo restores the whole network. |
| 2 | Junction drag, invalid | Candidate roles are all `refused`; every incident Wall is present; conflict marker is at the true intersection; no segment ends at the pointer/origin; release leaves canonical JSON and history unchanged. |
| 3 | Invalid → valid → invalid | Every move revalidates; the last sample is never a stale commit candidate; no frozen ghost. |
| 4 | Curved body move | Plain drag changes both endpoints and every knot by the same delta; knot count unchanged; no bend added; one history entry. |
| 5 | Modifier bend | ⌘/Ctrl-drag adds exactly one knot at the press station, active immediately; release commits one entry; Delete removes it. |
| 6 | Multi-bend | Two or more knots can be added, moved, deleted and the Wall straightened; move preserves all knot offsets. |
| 7 | Priority | Overlapping knot/Junction/Opening/body hits choose knot > Opening > Junction > body at 10 px; a 12 px miss falls through. |
| 8 | Warning near-miss | A 0.20 m gap commits with a warning; canonical topology is unchanged; the toast says "no connection"; no implicit Junction. |
| 9 | Warning Room | A Room area change commits with the exact old→new area; if Room identity changes, the planner refuses and the test expects a refusal, not a warning. |
| 10 | Anchor | Selected Opening centre wins; else the view-centre station; else start; closed Walls wrap; anchor is not 0 when a view centre exists. |
| 11 | Flip camera | `flip` changes `side` and the sheet, but the camera executor receives **no** request; entry pose/reading stay unchanged. |
| 12 | Exit | Done/Refold returns `u = 0` and the exact entry pose/reading; no history; removal invalidation returns with a notice. |
| 13 | Station mapping | Open and closed Walls, an Opening at the seam, and a door slide/resize round-trip canonical ↔ sheet; the result matches the development map's cut origin (H1). |
| 14 | Sheet | Mesh has real Opening voids (boundary loops), a door leaf, sill/head/jamb, ruler labels wrapped at L, seam ticks, as-built verticals; no Opening appears on the wrong face. |
| 15 | Reduced motion | Under reduced motion, `u` reaches the target without a 1 s animation; camera fit is instant. |
| 16 | Save/load/visitor parity | Warning/accepted states serialize; reload, Undo and visitor view produce the same canonical JSON and Room derivation. |

### 7.2 Browser journeys

**A. Connected rectangle** (screenshots 01–02)
Select a Wall → drag its body 0.5 m: whole network preview; release; Undo. Drag the lower-right Junction into Wall 3: full coral attempted network, conflict at the crossing, specific words, release writes nothing. Drag to a 0.20 m gap: amber warning, commit, reload; topology unchanged. Escape cancels. Verify the tag names the moved Wall first.

**B. Bent Wall** (screenshots 03–04)
Plain drag moves the bent Wall without adding a knot. ⌘/Ctrl-drag adds a bend at the grabbed station; the new knot is active and drawn as a bend mark; drag it; Delete removes it; add two knots; straighten. During the gesture there is one dashed centerline, no double contour. Drive the Wall into the partition: specific "would lie on" refusal, no history. Hover/selection priority is unambiguous at a knot/Junction overlap.

**C. Circle + Opening** (screenshots 05–07)
Select the Rotunda Wall and its door; Unfold. Sheet anchors at the door (or the view-centre station), not station 0. Scrub 0 → 0.5 → 1: camera pose unchanged. Inside/Outside flips the reading, camera unchanged. Drag the door along the sheet and resize the jamb: preview on sheet + as-built; commit; Undo; save/reload. Done returns exactly to the entry pose/reading. Repeat with a seam-crossing Opening.

**D. Accessibility and motion**
Keyboard-only: tab to Unfold, scrub, Flat/Half, Inside/Outside, Done; `B` arms Bend; Esc cancels; Delete removes a knot. Touch: long-press arms Bend; no modifier required. Reduced motion: no fold animation. Focus remains visible and the Card is reachable.

**E. Persistence/visitor parity**
For each warning state, save, reload, and open the visitor view; canonical JSON, Room areas, Opening positions and as-built geometry match. Any divergence demotes the state from warning to refusal.

---

## 8. Residual uncertainties and falsification probes

| # | Uncertainty | Probe | If falsified |
|---|---|---|---|
| H1 | Closed-Wall sheet station is anchor-relative vs cut-relative. | Add an Opening crossing the seam; compare `unfoldCanonicalStation` with `developmentOpeningIdentity` and the developed mesh. | Use the cut origin in the mapping; do not change the writer. |
| H2 | Which reachable bend code yields "This change cannot be applied." | Instrument the bend refusal path; enumerate codes; force each. | Add the missing map entry; add a regression test for every code. |
| H3 | A curved neighbour's knots after a Junction drag. | Drag a shared Junction of a curved Wall; inspect knot world positions, length and undo. | If the planner cannot preserve the curve, restrict the gesture or propose a new semantic; do not hand-edit knots. |
| H4 | Room re-derivation is deterministic for every warning candidate. | Save/reload/visitor parity for area changes, T-connections and near-misses. | Refuse the state or require an explicit Room decision. |
| H5 | Whole-network preview cost on 40 Walls. | Measure candidate build/paint at 12 and 40 Walls; budget one frame. | Reuse compiled neighbours / simplify affected geometry; never drop truth. |
| H6 | 3D Junction picking is reliable enough. | Repro with the camera at oblique angles; compare Plan and 3D. | Keep precise Junction editing in Plan and expose values in the Card; do not silently gate. |
| H7 | `buildDevelopedWallMesh` can carry voids without a core API break. | Prototype the holes option and run the development tests. | Split S5; propose a core API change rather than an editor-only mesh. |
| H8 | Warning fatigue / meaning. | Five-creator hallway test on the prototype and the real build. | Reduce warnings to Room area only; keep gaps as neutral labels. |

**The prototype cannot settle** occlusion, depth, true perspective foreshortening, canonical Room derivation, pick tolerance in 3D, or save/reload. Those are Stage 2 browser/automated tests.

---

## 9. Owner decisions (only material ones)

### D1 — Reverse the body-drag grammar **[O]**

**Recommendation:** plain body drag = rigid translate for straight **and** curved open Walls; ⌘/Ctrl or armed Bend = add a bend at the grabbed station. New bend active immediately.

**Why:** the current grammar makes "move a bent Wall" impossible without adding another bend, and it is the direct cause of the owner's "no rigid move affordance" finding. The modifier is a deliberate shape action; moving is the common action.

**Alternative:** keep body-drag = bend, modifier = move. Rejected: it preserves the accidental-bend problem and makes the common operation hidden.

**Consequence:** changes plan D1; needs copy/onboarding (`Bend (B)` button, `B` toggle) and tests that a move never changes knot count.

### D2 — Amber accepted-with-warning **[O]**

**Recommendation:** add the amber tier only for canonical-accepted states with a deterministic consequence (Room area/re-derivation, near-miss/no connection, explicit Junction connect). Never use it to admit an invalid document.

**Why:** the owner wants creative freedom; warnings preserve truth without silently relaxing topology.

**Consequence:** new visual role/class, copy tests, save/reload/visitor parity tests; if a consequence cannot be proven deterministic, it stays refused.

### D3 — Whole-network refusal display **[O]**

**Recommendation:** a refused attempt draws the whole attempted network in coral, with the conflict at the real feature, even though release cannot commit it. The attempt is display-only evidence.

**Why:** a refusal the creator cannot see is indistinguishable from an input that never arrived; screenshots 01–02 are exactly this.

**Consequence:** new `attemptedNetwork` builder; performance cap; never a pointer-to-origin reach.

### D4 — Junction availability while a Wall is selected **[O]**

**Recommendation:** keep Junction drag available whenever a Junction mark is visible, in both readings if picking is reliable; preserve knot > Opening > Junction > body priority.

**Why:** moving a shared Junction is the natural way to change two Walls; hiding it behind selection or Plan-only makes the connected case feel broken.

**Consequence:** if 3D picking fails H6, keep precise editing in Plan and mirror values in the Card; do not invent a 3D-only Junction authority.

### D5 — Camera discipline for unfolding **[O]**

**Recommendation:** one `face` fit on explicit Unfold only; no camera on scrub/peel/flip/partial stop; Done returns exactly to the recorded entry pose/reading; reduced motion instant.

**Why:** the owner explicitly wants the original view preserved; the donor's camera choreography is a viewer behavior, not an authoring requirement.

**Consequence:** remove `flip`'s `face` call; add a camera-call spy test; document the departure.

### D6 — Inside/Outside without a camera spin **[O]**

**Recommendation:** flip the sheet's reading direction about the anchor; camera unchanged; label the displayed face. Deliberate departure from the donor's 180° move.

**Why:** a camera spin loses the anchor and disorients; the sheet itself can communicate the side.

**Consequence:** station ruler/Opening labels must remain canonical; test both sides and seam crossings.

### D7 — Sheet scope **[O]**

**Recommendation:** in #287, add Opening voids/door/ruler/seam/as-built/peel and sheet Opening editing. Do **not** add Scene object projection/attachment; define only a future contract.

**Why:** the sheet must be a coherent working surface, but a cross-domain attachment system is a separate product decision.

**Consequence:** possibly a `layout-core` holes option (S5); Scene attachment out of scope.

### D8 — Room semantics **[O]**

**Recommendation:** area changes and stable re-derivations are warnings; identity loss/merges/splits/implicit connections are refusals. Broader permission needs a separate split/merge semantic.

**Why:** Room identity is canonical; a warning must not hide a lost Room.

**Consequence:** parity tests; if H4 fails, demote to refusal.

---

## 10. Approve-to-build checklist

- [ ] Owner has decided **D1–D8**; no implicit approval from this document.
- [ ] Stage 2 scope is the slices above; no merge.
- [ ] Baseline tests recorded green at the PR head; H1/H2 repros attached.
- [ ] No canonical validator relaxation; warnings are display-only classifications of accepted candidates.
- [ ] S0 characterization merged before S1; each later slice is independently reviewable.
- [ ] Automated tests 1–16 pass; browser journeys A–E pass, including save/reload and visitor parity.
- [ ] Screenshots 01–07 recreated as expected states; no generic refusal for reachable codes.
- [ ] Reduced motion, keyboard-only, touch and modifier alternatives verified.
- [ ] Performance budget for a 40-Wall network measured; no dropped preview truth.
- [ ] Reference docs updated; deviations (camera, warnings, "openings editable") documented.
- [ ] Owner explicitly authorizes Stage 2 implementation.

**Stop here.** No production code is changed by this Stage 1 artifact.

---

## Appendix A — File and symbol map

| File | Symbols/regions | Relevance |
|---|---|---|
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` | `attemptedWallGesture` (L361), `BEND_BODY_TOLERANCE_METERS` (L500), `markDescriptors` (L1956), curved knot branch (L1998–2022), bend commit (L1680–1725), `candidatePreviews` (L5613), wall refusal (L5681), bend refusal (L5759), junction preview (L5829) | Preview truth, grammar, handles, refusals. |
| `apps/editor/src/lib/authoring/adapters/layout/refusals.ts` | `wallRefusalWords`, `openingRefusalWords` | Copy mapping; generic fallback. |
| `apps/editor/src/lib/authoring/stage/shell/StageOverlay.svelte` | candidate markup L182–227, CSS L415–438, `refusalAtPointer` L144 | Roles, colour, tag placement, conflict marker. |
| `apps/editor/src/lib/layout/wall-unfold.ts` | `wallUnfoldAnchor` (L110), `createWallUnfoldState` (L135), `unfoldAmountFromDrag` (L155), `snapWallUnfoldAmount` (L163), `flipWallUnfoldSide` (L190), `wallUnfoldEditPolicy` (L267), `unfoldCanonicalStation` (L302) | Anchor, stops, side, edit policy, station mapping. |
| `apps/editor/src/lib/authoring/layout/wall-unfold-store.svelte.ts` | `enter` (L88), `setU` (L107), `flip` (L112), `FOLD_SECONDS` (L59), `#requestFace` (L188), `#requestReturn` (L195) | Anchor call site, camera requests, fold animation. |
| `apps/editor/src/lib/authoring/adapters/layout/LayoutWallUnfold.svelte` | `percent` L16, label L27, controls L42–45 | "Curvature" copy, stops, a11y. |
| `apps/editor/src/lib/authoring/stage/shell/StageWallDevelopment.svelte` | `buildReference` L150, `openingCount` L201, opening contours L286, sheet geometry | As-built frame, sheet content, openings. |
| `apps/editor/src/lib/layout/wall-unfold-pick.ts` | `buildWallUnfoldDisplay` L75, `buildDevelopedWallMesh` call L86, `openingBands` L115, `pickWallUnfoldSheetPoint` (unused in production) | Display build, inverse pick, opening identity. |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` | unfold executor L749–785, `unfoldedPointerPress` L1993, press routing L2238, click guard L2693 | Camera authority, sheet press, selection. |
| `apps/editor/tests/lib/layout/wall-unfold.test.ts` | anchor L403–413, station L661, camera/entry tests | Existing invariants; do not weaken. |
| `apps/editor/tests/lib/authoring/layout-candidate-preview.test.ts` | wall/junction/bend preview tests | Add whole-network/refusal tests here. |

## Appendix B — Prototype map

Open `review/pr287/interaction-review.html` directly (no build, no server). Three scenarios:

1. **Connected Walls** — drag a Wall or a Junction; see the whole candidate network; accepted (ochre/cobalt), warning (amber), refused (coral + conflict); reset/Undo.
2. **Bent Wall** — plain drag moves; ⌘/Ctrl-drag or `Bend (B)` adds; active knot edit/remove/straighten; snap; refusal at the partition.
3. **Circular Wall + Opening** — select the Wall, unfold, scrub, Inside/Outside, drag the door, Done; as-built, ruler, seam, anchor pin.

The demo deliberately labels its 2.5D approximation. It is the behavior contract, not a geometry proof.

## Appendix C — Critical review of this artifact

- The first prototype's fixed symmetric axonometric collapsed the developed sheet to a line when the anchor tangent matched the view axis. It was replaced with an asymmetric projection and a door-side default anchor; the flat sheet is now 535 × 247 and the door is hit-testable. This is a demo-only fix, not a production camera recommendation.
- The first `nearestOnCurve` implementation sampled only control points, so a straight Wall's middle could not be grabbed and its mid-span refusal was missed. It now projects onto segments; the straight Wall is sampled for validation. Production must use its existing sampled frames, not this demo helper.
- The demo's neighbour deformation is simplified; the production contract must verify curved-neighbour knot behavior (H3).
- The warning threshold (0.25 m) and the 0.12 m overlap threshold are demo values, not proposed production tolerances. Production must use the planner's connection tolerance and a named snap.
- The prototype does not model Room derivation, save/reload, visitor parity, depth/occlusion or touch. Those are explicit Stage 2 tests.
- The demo's "Inside/Outside" reverses the sheet's station direction; production must verify ruler/label consistency and seam-crossing Openings before shipping.

If any of these assumptions is rejected, the corresponding slice changes; the core recommendation (whole-network truth, rigid move, active bend, viewpoint-relative anchor, camera discipline, honest sheet) does not.
