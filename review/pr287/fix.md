# PR #287 — Wall manipulation and unfolding: Stage 1 specification

**Status:** Stage 2 implementation contract, authorized 2026-11-09. Stage 1 evidence is preserved
below; Stage 2 changes S0–S7 and does not weaken canonical validation.
**PR head reviewed:** `4950c2eb` (`claude/spatial-world-t1-planning-3f4013`). Work proceeds from
`18014c0d`; the PR stays draft and unmerged.
**Companion prototype:** [`interaction-review.html`](./interaction-review.html) — self-contained, open directly from disk.

Read this with the owner handoff and screenshots `01`–`07`. Tags used throughout:

| Tag | Meaning |
|---|---|
| **[V]** | Verified by reading the code at the stated head. |
| **[S]** | Visible in an owner screenshot. |
| **[H]** | Hypothesis; needs a browser repro before changing production code. |
| **[D]** | Deliberate departure from the donor; rationale given. |
| **[O]** | Material owner decision; approved where marked in §9, with only D4 still conditional. |

---

## 0. Verdict

The PR's **architecture is sound**: an attempted gesture is display-only, a validated candidate compiles through the canonical planner, release writes one command and one history entry, and the unfold sheet is a development map over the canonical Wall rather than a second geometry authority. The recently fixed Circle ghost, curved silhouette de-striping, two-Wall topology identity and development mathematics should be preserved.

The **interaction layer is not mergeable yet**. The seven captures reduce to six defects and three missing states:

1. A refused Junction or Wall shows one Wall, or a pointer-to-origin reach, not the attempted network. **[S 01–02]**
2. Refused attempts keep proposal cobalt while the tag is coral, and the tag sits at the pointer, not the conflict. **[S 01–02, 04]**
3. Curved selection draws the canonical silhouette plus a second candidate contour. **[S 03]**
4. A new bend is not made active, and the only mark drawn is a four-way move cross; the planner's 0.35 m body tolerance is also used as the knot promotion radius. **[S 04; V]**
5. A curved open Wall has no rigid body move: body drag only bends. This is the current plan's grammar; the owner has **approved reversing it** (D1). **[V; D1 approved]**
6. `wallUnfold.enter` always anchors at station 0; `wallUnfoldAnchor` is test-only. `flip` re-requests a `face` camera move. The sheet has no Opening voids, no door, no ruler, no seam, and no complete as-built frame. **[V; S 05, 07]**

The missing states are: **whole-network refusal truth**, **a deliberately narrow accepted-with-warning state**, and **a deliberate partial/peel state with reduced-motion and exact return**.

The recommended model is not a mechanical application of the owner's notes. Two proposals are challenged:

- The **donor is not evidence for Wall-editing grammar**. It is a museum viewer; its transferable evidence is the sheet, anchor, camera discipline, as-built and Opening presentation. Body-move / modifier-bend is justified by the current PR's contradiction and the owner's approved direction, not by donor behavior.
- **Warnings must stay rare and non-obvious.** Amber is only for a canonical-accepted candidate whose meaningful consequence is not visible in the preview. In #287 that means an unconnected near-miss that could be mistaken for a snap; ordinary Room-area changes, stable Room re-derivation, ordinary Opening edits and other predictable valid edits are **neutral**, never amber. Anything needing a new split/merge/overlap/connection semantic is refused. **[D2/D8 approved, narrowed]**

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

This is a **code-read review plus an executable design prototype**. No repository test suite was run in Stage 1. Root causes marked **[V]** are direct code facts at `4950c2eb`; **[H]** items are verified during Stage 2 by focused browser spot checks or tests before edits.

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
| Curved body move | Owner handoff A; current adapter | Body press on a curved open Wall opens a bend; there is no plain-drag translate. | A bent Wall cannot be moved without editing its shape; the creator adds bends accidentally. | Plain body drag = rigid translation of the whole Wall (endpoints, knots, and shared Junctions). Modifier (⌘/Ctrl) or armed Bend = insert a bend at the grabbed station. **D1 approved.** Route the move through `LAYOUT_WALL_MOVE_KIND` / `planRigidWallMove`, which already carries a curved chain; do not hand-edit knots. | [V][D1 approved] |
| Straight body move | Current adapter | Straight Wall body already has a rigid move (`mode: 'move'`) with a normal-distance drag. | Works; preserve it. | Keep; unify the curved path with it so both use one translation contract and one history entry. | [V] |
| Junction availability | Owner handoff A; 01–02 | Junction end marks exist on a selected Wall; a hover Junction candidate exists. The refusal path is the failure, not necessarily the absence of the gesture. | The gesture works but its preview lies. | Preserve Junction/Opening precedence; do not hide Junction marks when a Wall is selected. If 3D picking is unreliable, keep the precise edit in Plan and expose the same values in the Card. **[H]** Repro before changing reading gates. | [H] |
| Snap | 04; plan D-snap | Grid/axis snap exists; bend insertion snaps by station. | A bend can land a few centimetres off the visible line; the handle is not obviously snapped. | Show the snap chip (`Grid 0.25 m`, `Axis`, `Wall`, `Junction`); snap the inserted knot to the Wall centerline at insertion, then to the grid/axes while dragging. Do not silently connect to another Wall; connection requires an explicit Junction snap. | [V] |
| History | Current adapter | Accepted gestures commit one command; refused samples install no preview/history. | Correct principle; keep. | Exactly one entry per accepted release, including multi-knot moves; zero for refusal/cancel; Undo restores the whole network, not one Wall. | [V] |

### 2.2 Unfolding, sheet and camera

| Area | Donor evidence | Current #287 | Observed effect | Recommended | Tag |
|---|---|---|---|---|---|
| Anchor | Donor 222° sheet anchored at the place being studied; gold anchor dot; camera inset. | `wallUnfold.enter(wall, anchorStation = 0)`; Card calls `enter(compiledWall)` so the anchor is always 0. `wallUnfoldAnchor` (Opening → view centre → start) is implemented but unused in production. | Sheet unrolls from an arbitrary end, away from the creator's view. | Pass a computed anchor: selected Opening centre on this Wall → station nearest the view-centre ray → canonical start (open Walls, headless fallback). For closed Walls, wrap the anchor; the display cut stays opposite. Never default to 0 when a view centre exists. | [V][S 05][O D5] |
| Camera on entry | Donor uses a face view for the sheet; explicit focus. | `enter` issues one `face` request and animates `u: 0 → 1` over `FOLD_SECONDS = 1`. | A face request changes orientation; that violates the owner's preserve-the-view rule. | **Preserve camera orientation exactly** (yaw/pitch/roll/up). On explicit **Unfold**, only pan, fit/zoom and target recentring may change; no `face`, orbit or roll. Record the entry pose before any fit. A drag/peel open, scrub, side flip and partial stop make **no** camera request. Done/Refold restores the entry pose and reading exactly. | [V][D5 approved] |
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
| Camera moves into a face view and can swing 180° for the other side. | Preserve orientation on explicit Unfold; permit only pan/fit/zoom; never move for scrub/peel/flip; Done returns exactly. | The owner's working surface must stay put; a camera spin destroys the anchor relationship and disorients. The sheet's reading direction, not the camera, carries Inside/Outside. **[D5/D6 approved]** |
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
| Accepted with warning | Cobalt proposal; after commit ochre | **Amber** tag/note only at a non-obvious connectivity consequence (near-miss/gap) | Canonical-accepted, but a meaningful consequence is not visible in the preview. |
| Refused | **Coral whole attempted network**; offending segment emphasised | Coral tag at the real conflict | Release writes nothing; the attempt is evidence, not a proposal. |
| As-built | Subdued grey dashed | "as built" | The canonical Wall, not a second geometry. |
| Sheet | Vellum, wall grid, ruler, seam, anchor pin | "UNROLLED · OPENINGS EDITABLE" | A working view of the Wall. |

**Copy deck:**

- Scrub label: **Unfold**; output `0%` = folded, `100%` = flat; stop label **Flat** at 100%.
- Controls: `Flat` · `Half` · `Flip to Outside` / `Flip to Inside` (the label names the other side) · `Done`; helper "Entry may pan, fit or zoom only; orientation stays fixed; Openings edit in place."
- Warning near-miss: `0.20 m gap to Wall 1 — no connection.`
- Room/area change: **neutral**, not amber — `Room 1 24.0 → 22.0 m²` is an ordinary accepted update. Stable re-derivation is also neutral; a lost/merged Room is a refusal.
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
| **Accepted** | Canonical planner accepts; no semantic surprise. | Move a Wall into free space; acute corner; concave Room; narrow but clear gap; **ordinary Room-area change**; stable Room re-derivation; ordinary Opening slide/resize; a **named** explicit Junction snap. | Cobalt proposal → ochre commit; Room area simply updates. **Neutral, never amber.** | Yes. |
| **Accepted with warning (rare)** | Canonical planner accepts **and** one meaningful consequence is genuinely non-obvious from the preview. In #287 the only such case is an unconnected near-miss at the connection tolerance that could be mistaken for a snap. | A 0.20 m gap that stays unconnected; no implicit Junction. Do **not** include ordinary area changes, stable re-derivation, predictable edits or a visible named snap. | Amber tag/note at the gap; geometry stays a proposal (cobalt) until commit. | Yes; one command, one history entry. |
| **Refused** | No canonical state exists, or accepting would invent a connection/split/Room identity. | Crossing without a node; collinear overlap; self-intersection; duplicate Junction; zero-length Wall; interior contact without connection; closed-Wall external connection; Room identity loss; implicit Room splitting; arbitrary overlap/fold. | Coral whole attempted network + conflict at the real feature. | No; no history. |

**Rule:** a warning is a classification of an already-valid candidate, not a relaxation of canonical validation. Never call a validator with warnings enabled in a way that admits an invalid document.

### 4.2 Essential invariants vs unsupported capabilities

The current refusal rules mix two different things. Keep the first; do not present the second as a rejected product goal.

**Essential invariants for #287 (keep):**

1. **One canonical writer.** Every accepted gesture compiles through the canonical planner; no editor-only geometry, no second writer, no warning that admits an invalid document.
2. **Single-level planar topology.** Two Walls may not cross or collinearly overlap without a node; a Wall may not self-intersect. The representation has one plan level and no layering/stacking semantic.
3. **Junction integrity.** No zero-length Wall, duplicate Junction point, duplicate joined Wall, or silently invented three-way Junction. The planner's junction-degree rule remains authoritative.
4. **Room identity.** A gesture may not silently lose, merge, split, rename or reconnect a Room. Stable area changes and stable re-derivation are allowed and neutral; identity loss is refused.
5. **Opening containment.** An Opening must stay within its Wall and retain its identity; no implicit resize to make an invalid offset fit.
6. **No implicit connection or split.** A near-miss stays disconnected unless the creator lands on the named Junction snap; an overlap does not silently create a connection or a new Room.

These are **representation invariants for #287**, not universal statements that the product must never support the excluded shape.

**Unsupported topology capabilities (explicit follow-on, not rejected):**

- **Permissive overlaps / arbitrary crossings.** The owner's requested permissive-overlap direction is a real product goal, but a single-level planar document cannot represent it without deciding layer/stacking, connectivity and Room semantics. Keep refusing it in #287.
- **Explicit Room split/merge** and deliberate Room re-identification.
- **T-connections / closed-Wall external connections**, unless the existing planner already supports the exact case.
- **Three-or-more-way Junctions** and duplicate/stacked Junction semantics.
- **Crossing Walls that pass without connecting** (a bridge/underpass representation).

In #287, label these as `unsupported_topology` / `needs_topology_decision` where possible, and use copy such as **"Overlapping Walls need a layering decision; not available yet."** Do not tell the creator the design is invalid. File the follow-on with its own schema, commands, refusal semantics and Room model; do not smuggle it in as an amber warning or a validator relaxation.

**Safe corrections within #287:**

1. **Audit over-refusal of unusual but valid shapes.** Concave Rooms, acute angles, narrow gaps, collinear adjacent Walls and a Wall along another's extension are valid if the planner compiles them. Add characterization tests; do not refuse for looking unusual.
2. **Near-miss is not a connection.** A gap at or above the connection tolerance is accepted; a genuinely ambiguous near-miss gets the single amber warning with explicit `no connection`. Do not silently snap.
3. **Explicit Junction snap.** A visible, named snap is a neutral accepted edit; if the resulting Room identity changes, refuse rather than warn.
4. **Closed Walls.** An external Wall touching a closed Wall stays refused unless the planner already supports the connection; do not invent it.

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

**Classify every refusal.** `unconnected_crossing`, `collinear_overlap` and `self_intersection` are **unsupported topology capabilities** in #287 (follow-on), not proof that the shape is invalid. `room_identity_lost`, duplicate Junction, zero-length Wall and Opening containment are **essential invariants**. The remaining `unsupported_geometry` cases are capability limits with a named reason. The distinction belongs in the code/copy, not only this document.

The default "This change cannot be applied." is removed from every reachable path. Tests should enumerate the codes the adapter can produce and assert a specific sentence.

### 4.4 Examples the prototype encodes

- Dragging the lower-right Junction so the Wing crosses Wall 3: **refused**, whole Wing + affected Walls coral, conflict at the crossing, no history.
- Dragging the same Junction to a 0.20 m gap: **accepted with warning**, amber "no connection", no topology change.
- Dragging the Wall onto the partition: **refused** ("would lie on P1"), no history.
- Moving a Wall 0.5 m left: **accepted**, one history entry; the connected neighbour stretches; the Room area updates. **Neutral; no amber.**
- Ordinary Opening slide/resize and stable Room re-derivation: **neutral**; no warning.

---

## 5. Unfolding contract

### 5.1 Anchor

`wallUnfoldAnchor` is the intended policy and is already implemented; **wire it**:

1. If a selected Opening belongs to this Wall, use its centre station.
2. Else use the station nearest the view-centre ray (project the view centre onto the Wall/plan; do not use the camera eye as a station).
3. Else use the canonical start (open Wall) or wrap 0 (closed), as a deterministic headless fallback.

At entry, `createWallUnfoldState` sets `cutStation = wrap(anchor + L/2)` for closed Walls (D11); the display cut never moves the canonical seam. The store currently calls `enter(wall, 0)`; fix the call site and add a test that the anchor is not 0 when the view centre or a selected Opening exists. **[V]**

### 5.2 Camera orientation and entry

- Record `entry = { pose, reading }` **before** the first camera request.
- On explicit **Unfold**, **preserve camera orientation exactly** (yaw, pitch, roll and up). The only permitted changes are **pan, fit/zoom and target recentring**; one bounded fit may frame the sheet. No `face`, orbit, roll or other orientation change.
- The current `#requestFace` behavior does not meet this rule. Replace it with an orientation-preserving fit, or issue no camera request at all; do not reinterpret `face` as a fit.
- On **scrub/peel/side flip/partial stop**: no camera call of any kind — no `face`, no fit, no `set-view`, no `recordEntry` overwrite. The same applies when a peel opens the sheet.
- On Done/Refold: issue exactly one `set-view` to the recorded entry pose and reading; do not fit again, do not guess.
- If the document changes or the Wall disappears: invalidate, return to the entry pose with a notice, no nearby-Wall substitution.
- Reduced motion: `u` jumps to the target, no 1 s animation; an explicitly requested entry fit is instant and still orientation-preserving.
- Acceptance: camera orientation (including up) is equal before and after entry, scrub, peel and either side; only position/zoom may differ on explicit entry. Both sides of a circular Wall are demonstrated from the same orientation.

### 5.3 Side and reading direction

`flip` is `flipWallUnfoldSide` only. The sheet's station axis reverses about the anchor; the as-built, camera and Room stay put. The displayed face label says `Inside` or `Outside`; the station ruler and Opening labels remain canonical. **Do not** call `#requestFace` or any camera request. Demonstrate both sides: flip to Outside and back to Inside; both are the same canonical Wall, with mirrored sheet readings and identical camera orientation. This deliberately differs from the donor's 180° camera move; the sheet itself communicates the side. **[D][D6 approved]**

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

Only the selected Wall unfolds. **Opening geometry and canonical Opening identity are in scope:** the sheet addresses the same Opening id, with the same writer, through selection, slide, jamb resize, Undo, flip, scrub and save/reload. No editor-only Opening clone, no remapped identity, no second writer.

Rooms, other Walls, and general Scene objects remain in the 3D Scene; no Scene object is projected onto the sheet in #287. A future contract may attach a Scene object to `(wallId, station, height, side)` and draw an anchored marker on the sheet; nearby objects must never be silently treated as attached. General Scene-object attachment is explicitly out of #287; Opening support is not. **[D7 approved]**

---

## 6. Implementation slices

Each slice is independently reviewable, keeps canonical validation intact, and ends with tests. Do not implement slices before owner approval.

### S0 — Characterization and transport

- Pin the current behavior of: junction refusal candidate ids/roles/geometry; bend refusal candidate; knot activation after commit; unfold anchor; entry/`flip` camera calls; sheet mesh vertex/opening contour counts; `Curvature` copy.
- **Modifier transport.** `StagePointerIntent` currently exposes only `shift` (`stage-facade.ts`), and the host builds the intent with `shift: event.shiftKey` (`spatial/+page.svelte`). Add `metaKey`/`ctrlKey` (or one platform-neutral `alternateShape` captured at **pointer-down**) and carry it through `down`/`move`/`up`/`cancel`. Pin the host construction and the layout adapter's read; a modifier change mid-drag does not change the gesture.
- **Curved rigid translation.** `LAYOUT_WALL_MOVE_KIND` (`wallId`, `deltaX`, `deltaZ`) already delegates to `planRigidWallMove`, which carries a curved chain — knots and span controls receive the same delta and sampled geometry is translated exactly (tests: `layout-curve-planners.test.ts` “translates a curved Wall without changing its shape”; `layout-curve-proposals.test.ts` curved proposal). Characterize a connected curved Wall with ≥2 knots, one shared Junction, and an Opening: one command, knot count/length/Opening station preserved, neighbours follow, one history entry.
- Verify **[H1]** (closed-Wall sheet station vs cut) and **[H2]** (which refusal code produces the generic sentence) with a focused browser spot check or a test; capture only what is needed to decide.
- Minimal modifier-input plumbing is part of this slice. This slice is the safety net for every later diff.

### S1 — Preview truth

- Replace the single-Wall `attemptedWallGesture` with a pure `attemptedNetwork` that accepts the moved Junction/Wall and returns every changed Wall's endpoints/frames; use it for both accepted and refused proposals.
- Emit refused candidates as `role: 'refused'` for the **whole** network; add a zero-geometry conflict marker with the label at the true intersection/overlap; remove the pointer-to-origin reach and pointer-anchored tag.
- Map every reachable refusal code to specific words; name the moved subject first.
- Tests: multi-Wall Junction drag, invalid→valid→invalid, whole-network roles, conflict point, no history, no "cannot be applied" for reachable codes.
- Files: `layout.adapter.ts` (`attemptedWallGesture`, `candidatePreviews`, bend/wall/junction branches), `refusals.ts`, `StageOverlay.svelte` (roles/classes), tests.

### S2 — Gesture grammar and handles

- Plain body drag on a curved open Wall routes through `LAYOUT_WALL_MOVE_KIND` / `planRigidWallMove`; the canonical planner translates the whole chain and connected neighbours. Do not hand-edit knots in the adapter. Modifier/armed bend inserts one knot; preserve straight-wall behavior.
- Transport `metaKey`/`ctrlKey` (or `alternateShape`) through `StagePointerIntent`; plain body drag never inserts a knot, even if the modifier is released mid-drag.
- New knot active immediately; active glyph = bend mark, not `cross`; point promotion 10 CSS px; body band in px; delete/straighten.
- Suppress the canonical body silhouette while a live Wall gesture draws one dashed centerline.
- Preserve Junction/Opening precedence; do not hide Junction marks when a Wall is selected; repro the reading gate before changing it.
- Tests: move-with-knots (count unchanged), add bend (one knot, active), multiple bends, delete, straighten, overlap refusal, priority overlap, snapping.
- Files: `layout.adapter.ts` (`bend*`, `markDescriptors`, `hit` resolution, `BEND_BODY_TOLERANCE_METERS`), `precision.ts` (`LAYOUT_WALL_MOVE_KIND` / `planRigidWallMove` call), `stage-facade.ts` + `spatial/+page.svelte` (modifier transport), `StageOverlay.svelte` (bend glyph), tests.

### S3 — Copy, controls, motion

- `Curvature` → `Unfold`; 100% reads `Flat`; aria-valuetext "N percent unfolded"; helper copy; unbold/fix the "UNROLLED · VIEW ONLY" chip.
- Reduced-motion path in `animateTo`; no 1 s fold under `prefers-reduced-motion`.
- Toast/note copy for warning vs accepted vs refused.
- Tests: DOM text/aria, reduced-motion state transitions.
- Files: `LayoutWallUnfold.svelte`, `wall-unfold-store.svelte.ts`, `StageWallDevelopment.svelte` (chip copy), tests.

### S4 — Anchor and camera

- Compute and pass the anchor at every `enter` call site; wire `wallUnfoldAnchor` with the selected Opening centre and the view-centre station.
- Replace `enter`'s `#requestFace` with an **orientation-preserving** entry fit (pan/fit/zoom only) or no camera request. `flip` stops calling `#requestFace`; scrub/peel make no camera calls; no `recordEntry` outside the first Unfold; Done issues exactly one return.
- Demonstrate and test both faces: `Inside` and `Outside` at the same orientation, mirrored sheet readings, no camera executor call on either flip.
- Tests: anchor priority, closed wrap, entry orientation quaternion/up unchanged, entry pan/fit/zoom allowed, no camera on flip/scrub/peel, both sides, entry restoration bit-for-bit, removal invalidation.
- Files: `wall-unfold-store.svelte.ts`, `+page.svelte` (executor/call sites), `wall-unfold.ts`, `wall-unfold.test.ts`, page tests.

### S5 — Sheet fidelity and Opening editing

- Draw opening voids/door/sill/head/jamb; station ruler, seam/cut ticks, anchor pin, registration lines; complete as-built frame.
- **Preserve Opening identity:** the sheet addresses the same canonical Opening id, selection, offset/width and writer as the 3D Wall. No editor-only clone, no remapped id, no second writer.
- Map canonical↔sheet stations through the verified cut origin; add inverse pick for door/jamb; preview on sheet + as-built; commit through the existing Opening planner.
- Tests: meshes contain void boundaries (not just contour pairs), door leaf orientation, ruler wrap at L, as-built verticals, seam-crossing Opening, door slide/resize round-trip, identity preserved across flip/scrub/Undo/save/reload, refusal at the Opening.
- Files: `StageWallDevelopment.svelte`, `wall-unfold-pick.ts`, `layout-core` wall-development API (possibly a holes/spans option), `+page.svelte` unfolded press, tests. This is the largest slice; split into S5a (sheet) and S5b (Opening edit) if review size matters.

### S6 — Peel, keyboard, touch

- 260 px peel, dog-ear, magnetic stops, Esc cancel, reduced-motion instant.
- `B`/Bend button, ⌘/Ctrl detection, touch long-press; focus order and keyboard-only journey.
- Tests: drag mapping, snap stops, cancel, touch gesture, keyboard operation.
- Files: `wall-unfold-store.svelte.ts`, `+page.svelte` press handling, `LayoutWallUnfold.svelte`, tests.

### S7 — Focused browser QA, docs and owner handoff

- Run focused manual browser spot checks for the changed interactions and visual states. Full
  Playwright capture, exhaustive journeys, scripted E2E replay and bulk screenshots/video are not
  required and need explicit owner authorization.
- Update `docs/reference/components/layout.md` and the plan's checkpoint notes; record deviations
  (camera, warnings). Recreate screenshots only where a targeted state is useful evidence.
- No merge; no production schema/validator relaxation. Owner performs final manual acceptance.

---

## 7. Acceptance tests

### 7.1 Automated (Vitest)

| # | Test | Assertion |
|---|---|---|
| 1 | Junction drag, valid | Candidate contains the pressed Wall + every incident/affected Wall; roles are `subject`/`affected`; release commits one command; Undo restores the whole network. |
| 2 | Junction drag, invalid | Candidate roles are all `refused`; every incident Wall is present; conflict marker is at the true intersection; no segment ends at the pointer/origin; release leaves canonical JSON and history unchanged. |
| 3 | Invalid → valid → invalid | Every move revalidates; the last sample is never a stale commit candidate; no frozen ghost. |
| 4 | Curved body move | Plain drag routes through `LAYOUT_WALL_MOVE_KIND` / `planRigidWallMove`; every knot and span control shifts by the same delta; knot count, length and Opening stations unchanged; no bend added; one history entry. |
| 5 | Modifier bend | ⌘/Ctrl captured at pointer-down reaches the layout adapter through `StagePointerIntent` and adds exactly one knot at the press station, active immediately; release commits one entry; Delete removes it. |
| 6 | Multi-bend | Two or more knots can be added, moved, deleted and the Wall straightened; move preserves all knot offsets. |
| 7 | Priority | Overlapping knot/Junction/Opening/body hits choose knot > Opening > Junction > body at 10 px; a 12 px miss falls through. |
| 8 | Warning near-miss | A 0.20 m gap commits with a warning; canonical topology is unchanged; the toast says "no connection"; no implicit Junction. |
| 9 | Neutral Room / predictable edits | A Room-area change commits with **no amber**; stable re-derivation and ordinary Opening slide/resize are neutral; identity loss is refused, not warned. |
| 10 | Anchor | Selected Opening centre wins; else the view-centre station; else start; closed Walls wrap; anchor is not 0 when a view centre exists. |
| 11 | Both sides + flip camera | Flip Inside↔Outside changes the sheet reading and face label; both sides address the same canonical Wall/Openings; the camera executor receives **no** request; entry orientation/pose/reading stay unchanged. |
| 12 | Exit | Done/Refold returns `u = 0` and the exact entry pose/reading; no history; removal invalidation returns with a notice. |
| 13 | Station mapping | Open and closed Walls, an Opening at the seam, and a door slide/resize round-trip canonical ↔ sheet; the result matches the development map's cut origin (H1). |
| 14 | Sheet | Mesh has real Opening voids (boundary loops), a door leaf, sill/head/jamb, ruler labels wrapped at L, seam ticks, as-built verticals; no Opening appears on the wrong face. |
| 15 | Reduced motion | Under reduced motion, `u` reaches the target without a 1 s animation; camera fit is instant. |
| 16 | Save/load/visitor parity | Warning/accepted states serialize; reload, Undo and visitor view produce the same canonical JSON and Room derivation. |
| 17 | Entry orientation | Explicit Unfold may pan/fit/zoom but camera orientation (yaw/pitch/roll/up) is unchanged; scrub/peel make no camera call; Done restores exactly. |
| 18 | Modifier transport | `metaKey`/`ctrlKey` survives every pointer phase; releasing the modifier mid-drag does not change the gesture; the keyboard/Bend path produces the same command. |

### 7.2 Focused manual browser spot checks

These are short, targeted checks by an agent or the owner, not an exhaustive automated journey or a
capture requirement. Full browser journeys need explicit owner authorization.

**A. Connected rectangle** (screenshots 01–02)
Select a Wall → drag its body 0.5 m: whole network preview; release; Undo. A Room-area change is **neutral**; no amber. Drag the lower-right Junction into Wall 3: full coral attempted network, conflict at the crossing, specific words, release writes nothing. Drag to a 0.20 m gap: the single amber warning, commit, reload; topology unchanged. Escape cancels. Verify the tag names the moved Wall first.

**B. Bent Wall** (screenshots 03–04)
Plain drag moves the bent Wall without adding a knot. ⌘/Ctrl-drag adds a bend at the grabbed station; the new knot is active and drawn as a bend mark; drag it; Delete removes it; add two knots; straighten. During the gesture there is one dashed centerline, no double contour. Drive the Wall into the partition: specific "would lie on" refusal, no history. Hover/selection priority is unambiguous at a knot/Junction overlap.

**C. Circle + Opening** (screenshots 05–07)
Select the Rotunda Wall and its door; Unfold. Sheet anchors at the door (or the view-centre station), not station 0. Entry may pan/fit/zoom only; orientation is preserved. Scrub 0 → 0.5 → 1: no camera call. Flip to Outside, then to Inside: both sides show the same canonical Wall and mirrored readings, with no camera call. Drag the door along the sheet and resize the jamb: preview on sheet + as-built; commit; Undo; save/reload; the canonical Opening id is unchanged. Done returns exactly to the entry pose/reading. Repeat with a seam-crossing Opening.

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
| H4 | Room re-derivation is deterministic for every accepted candidate. | Save/reload/visitor parity for area changes, stable re-derivation, T-connections and near-misses. | Refuse identity changes or require an explicit Room decision; do not warn around a lost Room. |
| H5 | Whole-network preview cost on 40 Walls. | Measure candidate build/paint at 12 and 40 Walls; budget one frame. | Reuse compiled neighbours / simplify affected geometry; never drop truth. |
| H6 | 3D Junction picking is reliable enough. | Repro with the camera at oblique angles; compare Plan and 3D. | Keep precise Junction editing in Plan and expose values in the Card; do not silently gate. |
| H7 | `buildDevelopedWallMesh` can carry voids without a core API break. | Prototype the holes option and run the development tests. | Split S5; propose a core API change rather than an editor-only mesh. |
| H8 | Warning fatigue / meaning. | Five-creator hallway test on the prototype and the real build. | Warnings are already limited to an ambiguous near-miss; if still fatiguing, make that a neutral “no connection” label and keep only refusals. Never add area warnings. |

**The prototype cannot settle** occlusion, depth, true perspective foreshortening, canonical Room derivation, pick tolerance in 3D, or save/reload. Those are Stage 2 focused browser/automated checks.

---

## 9. Owner decisions (only material ones)

### D1 — Reverse the body-drag grammar **[Approved]**

**Decision:** plain body drag = rigid translate for straight **and** curved open Walls, through the canonical `LAYOUT_WALL_MOVE_KIND` / `planRigidWallMove` path; ⌘/Ctrl or armed Bend = add a bend at the grabbed station. New bend active immediately.

**Why:** the current grammar makes "move a bent Wall" impossible without adding another bend, and it is the direct cause of the owner's "no rigid move affordance" finding. The modifier is a deliberate shape action; moving is the common action.

**Alternative:** keep body-drag = bend, modifier = move. Rejected: it preserves the accidental-bend problem and makes the common operation hidden.

**Consequence:** changes plan D1; needs copy/onboarding (`Bend (B)` button, `B` toggle) and tests that a move never changes knot count.

### D2 — Amber accepted-with-warning **[Approved, narrowed]**

**Decision:** keep one **rare** amber tier only for an ambiguous, canonical-accepted **near-miss/no-connection** that could be mistaken for a snap. Ordinary Room-area changes, stable re-derivation, predictable valid edits and a visible named Junction snap are **neutral**, not amber. Never use amber to admit an invalid document.

**Why:** the owner wants creative freedom, but routine edits must not feel provisional. A warning must carry information the preview cannot; otherwise it is noise.

**Consequence:** new visual role/class, copy tests, and a negative test that area/predictable edits stay neutral. Save/reload/visitor parity applies to the one warning state; if it cannot be proven deterministic, make it neutral or refuse it — never widen the tier.

### D3 — Whole-network refusal display **[Approved]**

**Decision:** a refused attempt draws the whole attempted network in coral, with the conflict at the real feature, even though release cannot commit it. The attempt is display-only evidence.

**Why:** a refusal the creator cannot see is indistinguishable from an input that never arrived; screenshots 01–02 are exactly this.

**Consequence:** new `attemptedNetwork` builder; performance cap; never a pointer-to-origin reach.

### D4 — Junction availability while a Wall is selected **[O]**

**Recommendation:** keep Junction drag available whenever a Junction mark is visible, in both readings if picking is reliable; preserve knot > Opening > Junction > body priority.

**Why:** moving a shared Junction is the natural way to change two Walls; hiding it behind selection or Plan-only makes the connected case feel broken.

**Consequence:** if 3D picking fails H6, keep precise editing in Plan and mirror values in the Card; do not invent a 3D-only Junction authority.

### D5 — Camera discipline for unfolding **[Approved]**

**Decision:** on explicit Unfold, **preserve camera orientation exactly**; only pan, fit/zoom and target recentring may change. No camera on scrub/peel/flip/partial stop; Done returns exactly to the recorded entry pose/reading; reduced motion instant and orientation-preserving.

**Why:** the owner explicitly wants the original view preserved. The donor's face fit is a viewer behavior; a face/orbit change violates the authoring requirement even once.

**Consequence:** replace `enter`'s `face` request with an orientation-preserving fit or none; remove `flip`'s `face` call; add orientation and camera-call spy tests; document the departure.

### D6 — Inside/Outside without a camera spin **[Approved]**

**Decision:** flip the sheet's reading direction about the anchor; camera orientation unchanged; label the displayed face. Demonstrate **both** Inside and Outside on the circular Wall. Deliberate departure from the donor's 180° move.

**Why:** a camera spin loses the anchor and disorients; the sheet itself can communicate the side.

**Consequence:** station ruler/Opening labels must remain canonical; both sides address the same canonical Opening identity; test both sides and seam crossings.

### D7 — Sheet scope and Opening identity **[Approved]**

**Decision:** in #287, add Opening voids/door/ruler/seam/as-built/peel and sheet Opening editing, preserving the **existing canonical Opening id and writer**. Do **not** add general Scene object projection/attachment; define only a future contract.

**Why:** the sheet must be a coherent working surface, and Opening geometry without stable identity would create a second address for the same door. A cross-domain Scene attachment system is a separate product decision.

**Consequence:** possibly a `layout-core` holes option (S5); identity tests across selection/edit/flip/Undo/reload; general Scene attachment out of scope.

### D8 — Room semantics **[Approved, narrowed]**

**Decision:** ordinary area changes and stable re-derivation are **neutral**; identity loss, merges, silent splits and implicit connections are refusals. Broader permission needs a separate split/merge semantic. The owner's **permissive-overlap** direction is preserved as an explicit follow-on capability, not rejected by the #287 refusal.

**Why:** Room identity is canonical, and routine area updates are visible and expected; warning them would be noise. Overlap needs a new layer/topology decision, not a warning.

**Consequence:** neutral-area tests; identity-loss refusal tests; follow-on documented with its own schema/commands; if H4 fails, refuse identity changes rather than warning.

---

### 9.1 Stage 2 implementation status (2026-11-09)

Committed on `claude/spatial-world-t1-planning-3f4013` after `18014c0d`:

- **S0:** `metaKey`/`ctrlKey` survive every pointer phase; curved body translation uses `LAYOUT_WALL_MOVE_KIND` / `planRigidWallMove`.
- **S1:** refused Wall/Junction attempts render one coral whole-network candidate at the real conflict; settled refusals retain that geometry.
- **S2:** plain body drag moves; Meta/Ctrl is captured at pointer-down; hidden knots promote within 10 CSS px; a new/edited knot becomes active; the active bend glyph is drawn.
- **S3/S4:** Unfold copy is corrected, Flat reads at 100%, side labels name the other side, reduced motion is instant, entry records the settled pose without a `face` request, and flip/scrub/peel make no camera request. Done remains the only camera return.
- **S5a:** the developed mesh has real Opening voids; Opening identity is addressable through the void at the current `u`, including a seam-crossing band; the sheet draws a door leaf and a complete as-built base/top/vertical frame without duplicate Opening contours.
- **S5b:** a press on an Opening void selects the canonical Opening and arms a sheet edit. Plain body drag slides it; a press within 12 CSS px of a projected jamb resizes that jamb. A closed Wall wraps the slide and may grow the width across the seam (only the whole circumference is refused). The Stage rebuilds its developed mesh from display-only preview state; release commits exactly one `layout-opening-measure` intent to the same canonical Opening id, and an unmoved press commits nothing. Jamb proximity is measured at mid-height; a seam-crossing jamb past `L` addresses the drawn strip end.
- **S6:** `B` and the Card's Bend action arm the next body press; the Card peel uses the 260 px mapping and magnetic stops. The peel is Card-based, not a drag at the sheet edge; touch long-press is not implemented (the Bend action is the touch-visible alternative).
- **S7:** QA policy updated; focused app launch is clean with no console errors. No Wall/Opening existed in the fresh project, so gestures, both sides, save/reload and visitor parity remain owner checks.

Non-browser verification at the implementation head: `npm run check --workspace @portfolio/editor` reports 0 errors (4 pre-existing Visitor warnings); the focused suites report 126/126 passing, including 8 new cases for the sheet Opening mapping (slide, both jambs, closed-seam wrap, minimum width, circumference refusal and edge tolerance). No full Playwright/E2E or bulk capture was run, by policy.

## 10. Approve-to-build checklist

- [x] Owner approved **D1**, **D2/D8 narrowed**, **D3**, **D5**, **D6** and **D7**; **D4** remains conditional on the repro.
- [x] Owner authorized Stage 2 implementation from `18014c0d`; scope is the slices above; no merge.
- [ ] Baseline tests recorded green at the implementation head; H1/H2 verified.
- [ ] No canonical validator relaxation; warnings are display-only classifications of accepted candidates, and area/predictable edits stay neutral.
- [ ] S0 characterization (including `StagePointerIntent` modifier transport and canonical curved translation) merged before S1; each later slice is independently reviewable.
- [ ] Automated tests 1–18 pass; focused manual browser spot checks A–E cover both sides, save/reload and visitor parity where practical.
- [ ] Targeted states inspected; no generic refusal for reachable codes. Bulk screenshot recreation is not required.
- [ ] Reduced motion, keyboard-only, touch and modifier alternatives verified.
- [ ] Performance budget for a 40-Wall network measured; no dropped preview truth.
- [ ] Reference docs updated; deviations (camera, warnings, "openings editable") documented.
- [x] Owner explicitly authorized Stage 2 implementation with the focused-QA policy.

**Owner acceptance remains a manual browser check after implementation.** No merge without it.

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
| `apps/editor/src/lib/authoring/stage/stage-facade.ts` | `StagePointerIntent` L305 (currently only `shift`) | Add `metaKey`/`ctrlKey` (or `alternateShape`) transport; keep it stable across phases. |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` | pointer intent construction L2280 (`shift: event.shiftKey`) | Pass platform modifiers at pointer-down and through move/up/cancel. |
| `apps/editor/src/lib/authoring/adapters/layout/precision.ts` | `LAYOUT_WALL_MOVE_KIND` L101, `wallMovePlanner` L473 | Reuse the canonical move planner for curved body drag; do not write knots in the adapter. |
| `packages/layout-core/src/layout-wall-first-precision.ts` | `planRigidWallMove` L353 | Existing curved-chain translation; characterize and test, no schema change. |
| `apps/editor/tests/lib/layout/layout-curve-planners.test.ts` | rigid movement L752 | Curved translation preserves knots, span controls, shape and length. |
| `apps/editor/tests/lib/layout/layout-curve-proposals.test.ts` | curved proposal L185 | Whole-chain preview and reshaped neighbours. |

## Appendix B — Prototype map

Open `review/pr287/interaction-review.html` directly (no build, no server). Three scenarios:

1. **Connected Walls** — drag a Wall or a Junction; see the whole candidate network; accepted (ochre/cobalt), the one rare warning (amber near-miss/no connection), refused (coral + conflict); reset/Undo. A Room-area update is neutral.
2. **Bent Wall** — plain drag moves through the canonical rigid move; ⌘/Ctrl-drag or `Bend (B)` adds; active knot edit/remove/straighten; snap; refusal at the partition.
3. **Circular Wall + Opening** — select the Wall, unfold, scrub, flip to Outside and back to Inside, drag the door, Done; as-built, ruler, seam, anchor pin, same canonical Opening.

The demo deliberately labels its 2.5D approximation. It is the behavior contract, not a geometry proof.

## Appendix C — Critical review of this artifact

- The first prototype's fixed symmetric axonometric collapsed the developed sheet to a line when the anchor tangent matched the view axis. It was replaced with an asymmetric projection and a door-side default anchor; the flat sheet is now 535 × 247 and the door is hit-testable. This is a demo-only fix, not a production camera recommendation.
- The first `nearestOnCurve` implementation sampled only control points, so a straight Wall's middle could not be grabbed and its mid-span refusal was missed. It now projects onto segments; the straight Wall is sampled for validation. Production must use its existing sampled frames, not this demo helper.
- The demo's neighbour deformation is simplified; the production contract must verify curved-neighbour knot behavior (H3).
- The warning threshold (0.25 m) and the 0.12 m overlap threshold are demo values, not proposed production tolerances. Production must use the planner's connection tolerance and a named snap.
- The prototype originally emitted an amber Room-area warning. That was **removed** after D2/D8 narrowing: ordinary area changes are neutral; only the ambiguous near-miss remains amber. Close-knot warnings were also removed as predictable.
- The prototype does not model Room derivation, save/reload, visitor parity, depth/occlusion or touch. Those are explicit Stage 2 tests.
- The demo's "Inside/Outside" reverses the sheet's station direction and draws a face chip; both sides are reachable and use the same Opening. Production must verify ruler/label consistency, canonical Opening identity and seam-crossing Openings before shipping.

If any of these assumptions is rejected, the corresponding slice changes; the core recommendation (whole-network truth, rigid move, active bend, viewpoint-relative anchor, camera discipline, honest sheet) does not.
