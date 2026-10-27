# E0 — Owner-evaluated spatial creation playground

**Status:** proposed implementation-ready experiment plan; documentation only. E0 has not been
implemented or evaluated. Merging this PR does not authorize execution; the owner must separately
commission the prototype. The owner is the sole E0 product decision-maker.

**Question:** does carrying a spatial idea across form, arrangement and revision help the creator
achieve an intended result, or do competent explicit controls serve that intention just as well?

## 1. Authority and experimental boundary

Reconciled against `main` at `ec9bc07a`. The [G0 ratification][ratification], live
[architecture obligations][architecture] and [T5 E0 boundary][e0-boundary] govern this plan.
They ratify disciplined creative freedom, contextual creation and dependable revision, **not** a
particular guide/band prototype, representation, UX or R1 sequence. [Historical G0 §10][g0-e0]
supplies the experimental questions; its concrete fixture and research protocol are recommendations.

The owner's current commission replaces §10.1's provisional recruitment, cohorts, statistical
thresholds and scheduled return with direct owner evaluation. No staff-hour budget, mandatory
external study or calendar delay gates E0. Its cost envelope is the capability boundary below:
one local application, one analytic geometry route, one creative job and no production integration.

Retain §10's questions about intended creation, transfer, variation, following, exceptions and
reopen. **Core E0 tests shared revision and one deliberate exception.** It does not settle the
historical fixture's host removal/repair, copy lifetime or cross-platform claims. Those are explicitly
deferred, not recorded as passed. No successful owner walkthrough releases R1 or selects its scope.

The [native creative-depth proof agenda][proofs] and [Native Form Lab][lab] provide useful revision,
geometry and history evidence. Reuse small proven pieces, not the Lab's full modeler. Its
handles-versus-operation drawer is precedent, not evidence of a distinct creative workflow.
Owner judgment can select a next investment; broader learnability or competitive claims need
separate evidence. External testing may be recommended later, never required for E0 closeout.

## 2. The creative challenge: a welcoming display that must change

### 2.1 Outcome brief shown before the controls

> Arrange a small exhibition of three pieces. Make the main piece the clear focus from the entrance,
> with two supporting pieces and a low continuous display edge that makes the collection feel
> intentional. Keep the display within the marked floor and the shaded arrival area clear. Choose
> an asymmetric layout you would actually want to show; the supporting pieces need not stay evenly
> spaced or identically oriented.
>
> After you are happy with it, the entrance moves to the adjacent side. Keep the main piece at its
> chosen position and orientation. Revise the rest so the collection still reads as one display
> from the new entrance and the new arrival area is clear. Preserve one other quality you value
> in your first design—such as openness, rhythm or a particular bend—and explain any compromise.

This brief specifies a result, a changed external condition and something worth preserving. It
never asks the owner to draw a guide, use Arrange, detach an object or execute a prescribed sequence.
The solution may begin with the display edge, with placed exhibits or with an imagined empty space.
Finishing by manual placement is legitimate. If the shared guide is unnecessary or obstructive,
that is evidence against the contextual hypothesis rather than failure to follow the exercise.

**Supplied fixture:** a 6 m square floor, three distinct box-based exhibits (one visually identifiable
main piece), a shaded arrival patch and a marked entrance direction. No prebuilt edge or guide.
Use floor X/Z coordinates: initial patch `x = -0.6…0.6, z = -3…-1.8`; revised patch
`x = 1.8…3, z = -0.6…0.6`. Switching Entrance changes only this context and its view cue; nothing
is automatically rearranged. The main piece's initial pose is the owner's choice, then preserved
in the revision. Default exhibit footprints of 0.45 m square and heights of 1.0/0.6/0.4 m suffice.
Start the free pieces at (−1,0), (0,0) and (1,0) with zero yaw, the first being the main piece.
These are editable-layout props, not a catalogue or import system.

The band is a low display edge: default width 0.20 m and height 0.30 m, freely adjustable within
valid geometry. The patch is a brief-specific visual requirement, not a building-code, accessibility
or collision-clearance guarantee. Check it in Plan; inspect focus/grouping from the entrance in 3D.
A simple entrance-view preset shares the existing prototype camera controls, not a new Camera system.

### 2.2 What counts as a useful result

Before acting, the owner names the intended visual character and which piece should be the focus.
Keep the first and revised designs as separate JSON files. Assess:

- **Outcome:** all pieces and the display edge exist; the shaded patch stays clear; the owner can
  see and identify the intended focus from each entrance and considers the grouping coherent.
- **Revision:** the main piece's chosen pose is unchanged; the new layout satisfies the revised
  brief. Compare the extra quality the owner wanted to preserve with what survived or was abandoned.
- **Creative control:** a personally chosen asymmetry/spacing/turn is possible, not merely a pleasing
  default. Record a blocked intention even if a workaround finishes the brief.
- **Process:** where did the creator have to reconstruct the design in terms of sources, operations
  or relationships? Where did shared context remove that translation, and where did it cause surprise?

Clearance and retained pose are checkable facts; focus, coherence and retained character are owner
judgments with concrete before/after examples. There is no aesthetic scoring, completion-time target
or automatic winner. Correct geometry alone cannot pass the product question; preference alone
cannot excuse lost work or a result that misses the brief.

## 3. A fair comparison of creative workflows

Use one application with two entry paths, shared rendering, geometry and editing capabilities:

| Spatial idea first | Competent explicit controls |
| --- | --- |
| Draw a guide or capture the ordered positions of already placed pieces; keep that spatial context active while making the edge and arranging pieces | Begin with Create edge or Arrange; draw, borrow or pick the same reusable guide as the source |
| Select a visible edge or following piece and Edit shared guide; highlight all affected results before revising | Select the result, inspect its source and Edit guide, with the same affected-result highlights and handles |
| Maintain the chosen context while changing selection; clear or replace it explicitly | Offer preselection, viewport source picking and unambiguous source prefill; do not force rediscovery or redraw |
| Make one result independent when the brief calls for it | The same following, manual placement and independence controls remain available |

A continuous spatial context and the ability to start from existing placement are hypotheses about
how creators pursue a design. Merely relocating controls is not enough. **Do not build a weaker
explicit path to manufacture a distinction.** Both paths can converge once the source is chosen;
if they do, retain the simpler interaction or useful shortcut without claiming a new creative language.

Try the same outcome brief from a fresh fixture in each path, in whichever order the owner chooses.
Do not require identical geometry, operations or number of clicks. Compare each design with its
stated intention and revised brief; a different but successful design is not a fidelity failure.
Switch paths on a saved design as a diagnostic if useful, but do not substitute that for trying to
create a result. Note familiarity/order effects without turning this into a study protocol.

To test transfer, the owner then changes one meaningful design intention—for example a close,
intimate grouping instead of an open display, or placing the pieces first and shaping the edge
around them. Use existing primitives and a fresh/reset file; no second themed prototype is needed.
Record whether the same vocabulary carries, including when explicit placement is the better answer.

## 4. Minimum core and capabilities that must earn inclusion

### 4.1 Required to answer this challenge

| Core capability | Why it earns its place |
| --- | --- |
| One editable open planar guide, one real band and three supplied movable pieces | Two different consumers of one spatial source are the minimum test of composition; a solitary extrusion would only test modeling controls |
| Draw/edit guide and snapshot ordered piece positions into a guide | Allows edge-first and placement-first solutions. Borrowing is cheap coordinate capture, not inference or a live reverse dependency |
| Optional guide-following arrangement, free positioning/yaw, and one-member break-following | The changed brief requires preserving a chosen piece while revising the group. Without a local exception, coupling could win only on a contrived all-move-together task |
| Shared-guide edit from either result, local band dimensions and visible scope | Tests revision of the intended result without reconstructing a construction history |
| Plan/3D, numeric inputs, real preview/refusal, Undo/Redo and JSON reopen | Lets the owner judge spatial results, try alternatives and trust that accepted work survives; these are experimental integrity, not a production foundation |

The core admits one guide/edge composition per document. Extra guide points, arbitrary valid shape,
width/height and free object poses remain available; the output is not a fixed preset. Revisit this
boundary only if an actual intended result needs more than one edge. Saving and reopening alternatives
is sufficient for this experiment; no in-app variant manager or connected-group copy is needed.

### 4.2 Optional relationship depth — not core acceptance

None of the following is an automatic next increment or a hidden prerequisite. After the core
walkthrough, the owner may commission **one named extension only when its decision value is clear**:

| Capability omitted from core | Evidence that could justify it | Cheaper question to answer first |
| --- | --- | --- |
| Support→guide→result following | The owner repeatedly wants the display to follow a moving host, rather than intentionally recompose it | Move the guide directly when the entrance changes; does that already serve the job? |
| Missing-source freeze, repair/rebind and lifetime recovery | A promising admitted dependency actually needs source replacement during the intended workflow | Refuse deletion of an in-use guide and reject invalid imports, preserving accepted work |
| Independent connected-group copy/remapping | Comparing simultaneous variations is essential to judging the design | Save the alternatives as separate files |
| Multiple guides/bands, added/deleted members or richer spacing rules | A recorded creative intention cannot be expressed with the edge and supplied pieces, even using local exceptions | Free placement and a changed guide; preserve the blocked example if these are insufficient |

An extension must name the blocked intention, expected benefit and extra state/interaction it needs,
and be available fairly in both entry paths. It is not included just because source data could
support it. If the core already answers the question negatively, stop rather than adding relationship
machinery. Deferring these tests does not waive identity/repair obligations for a later real consumer.

Closed loops, freehand recognition, booleans, arbitrary mesh edits, contour sculpting and automatic
fitting are outside this E0. No geometry-engine campaign, general object editor, library, import
system, color/material editor or production integration is required.

## 5. Core implementation contract

### 5.1 Location and small design

Create `e0-spatial-playground` under the existing [prototypes directory][prototypes] only when execution
is commissioned. Use an isolated manifest/lockfile and the Native Form Lab's Vite/Svelte 5/Threlte
setup as a small donor. Keep it outside root workspaces, production imports and public routes. Its
README must supply `npm install`, `npm run dev`, `npm run typecheck`, `npm test` and `npm run build`,
with the actual local URL. No account, service or new geometry dependency is needed.

A few local files suffice: experiment model; pure band/arrangement evaluator; draft/history/file
helpers; shared viewport and the two entry paths. Re-evaluate the small document synchronously.
Dispose replaced meshes correctly. No workers, solver, general graph, incremental framework or
production F/Camera/Stage adapter. These choices are disposable, not a selected product architecture.

Store an experiment version, entrance state, optional keyed guide points, optional band dimensions,
and three stable object records with dimensions and free poses. For a following arrangement store
its guide ID, start/end margins, signed side offset and each object's fixed slot index plus following
flag. No support records, retired-member registry, recovery caches or group-copy subsystem are needed
in core.

Band geometry is an extruded offset polygon. Reject zero-length/reversing segments, self-intersection,
overlapping offsets, nonfinite/nonpositive dimensions and miter joins beyond four half-widths. Explain
whether to widen a corner angle, narrow the band or separate segments. Validate each band; intentional
overlap between separate pieces is not a global scene error. Units are metres; no fixed point quota.

For three arrangement slots on guide length L with nonnegative margins a/b, use distances
`a`, `(a + L - b) / 2`, `L - b`; require `L > a + b`. Offset centers sideways from the sampled guide
by `d * (-tangentZ, tangentX)`, initially d = 0.50 m, so pieces can stand beside the display edge.
The same signed offset control serves both entry paths; it is placement, not a clearance solver.
Use the outgoing tangent at an exact corner.
Detaching captures that object's evaluated pose and disables its follow flag, leaving the other
slots unchanged. Re-Arrange previews replacement of all three slots; canceled changes preserve
exceptions. Object IDs never depend on mesh indices or proximity.

### 5.2 Concrete interactions and correctness

- **Guide:** click floor points; Enter finishes, Escape cancels. Drag/numerically edit X/Z, insert
  on a segment or remove a point while two remain. Borrow by selecting the three pieces in order,
  previewing numbered centers and accepting Use positions. This samples positions once; later
  piece motion does not move the guide. Borrowing is offered before creating the edge/arrangement;
  replacing an in-use guide is outside core, so use Reset or reopen a saved alternative instead.
- **Create edge:** use active context or choose the guide explicitly. Preview width/height; Create
  accepts the band with the visible promise that guide edits reshape it. Numeric fields and handles
  edit dimensions locally. There is no hidden attachment caused by snapping.
- **Arrange:** choose the guide, preview margins, side offset and all three poses, then Apply.
  Follow guide must be selected deliberately; otherwise accept free poses only. Both paths offer
  the same choice.
- **Revise:** selecting the edge or a following object exposes Edit shared guide and highlights both
  consumers. Moving/rotating a following piece offers Break following and move; preview/cancel keeps
  the consequence clear. Other pieces do not redistribute. Free movement/yaw is always available.
- **Context:** show the active guide's name/highlight and Clear context. Changing object selection
  keeps it; Escape cancels a draft first, otherwise clears context. Session context is never saved.
- **Environment:** Entrance switches between the two brief patches/views without moving the design.
  Fit view and Plan/3D share the same document. A reset starts the supplied fixture afresh; it does
  not secretly run the creative task. Save first if keeping an alternative.

Every accepted drag is one snapshot Undo step; numeric edits commit on Enter/confirmation. Cancel
and rejected geometry leave accepted state/history unchanged, with an editable draft and a useful
reason. Preview and acceptance use the same evaluator. Undo/new edit clears Redo. Undo, Open, Reset
and path switching cancel active gestures so a later pointer-up cannot commit an obsolete draft.
Reset and Open start fresh history; they are explicit document replacement, not claimed Undo steps.

Refuse deleting a guide still used by the edge or arrangement; explain why, without dropping work.
The core does not offer object deletion or rebind. Parse/validate JSON before replacing current state;
invalid geometry, missing IDs, unknown versions or malformed input leave current work intact. Save
accepted authored values, IDs and follow flags only, never generated meshes, selection or history.
A real browser reload/Open regenerates the same result and permits further edits. General unresolved
reference repair is deliberately not implemented; refusal supplies an honest core boundary.

## 6. Build increments and outcome-led owner walkthrough

These are disposable prototype work chunks, not registered production slices:

| Increment | Runnable delivery | Exit check |
| --- | --- | --- |
| A — Express a layout | Shared fixture/views; supplied piece positioning/yaw; draw or borrow a guide; real band; explicit source controls; preview/refusal and snapshot Undo | From an empty composition the owner can make a personally intended edge and grouping, not just load a finished display |
| B — Compare creation and revision | Active-context path; same competent explicit path; arrangement/following; shared edit scope and local exception | Both can attempt the entrance-change brief while preserving the focal piece; no baseline capability is withheld |
| C — Return and decide | JSON Save/Open, focused correctness checks, instructions and saved original/revised examples | Reopened work remains editable; the owner can complete the challenge, try a different intention and record a verdict |

Optional relationship-depth work does not block C. If the contextual path only relocates controls,
report that finding rather than automatically rebuilding it until it looks novel. Stop for an owner
scope decision if the intended job cannot be answered with the core primitives, or if completing it
would require general geometry/relationship machinery. Otherwise finish the core and let evidence,
not elapsed hours or a feature-completeness checklist, determine the next investment.

**Owner run:** install/start using the future prototype README; read the outcome brief in §2 before
using the controls. Make and save the first display, naming the quality to preserve. Switch Entrance,
revise to the changed brief, then save separately. Judge the two outcomes from Plan and the entrance
view. Try the other entry path from the same initial fixture, and then a personally chosen transfer
intention. Use whichever available operations serve the design; there is no mandatory modeling recipe.

Finally reload/Open an accepted result and continue revising. Try Undo/Redo, cancel a change, create
an invalid tight corner and try a bad file. These are a short engineering check after creative work,
not the definition of success for the creative challenge. There is no facilitator, mandatory waiting
period, participant recruitment or formal evidence dataset.

## 7. Review readiness and decision

Engineering delivery requires working geometry, both fair entry paths and the complete core loop.
Use a few deterministic checks: hand-calculated straight/right-angle band dimensions and member
positions; preview/commit agreement; shared revision with a detached piece unchanged; Undo/new edit
and canceled gestures; JSON roundtrip retaining source/IDs/following and rejecting a bad file without
mutation. Document a numerical tolerance appropriate to the metre-scale fixture. Run the browser
walkthrough and the prototype's build/typecheck/tests, plus repository-required docs/architecture
checks for its implementation PR. No platform matrix, production benchmarks or synthetic failure
infrastructure. Investigate actual visible stalls or leaks if encountered.

Lost accepted work, silent retargeting, invalid accepted geometry or unequal comparison capability
blocks readiness. A visible refusal of an unsupported action is honest; it is still recorded if it
blocks the intended result. E0 establishes neither production correctness nor long-session scale.

Deliver run instructions, original/revised JSON examples and a short decision note:

1. Intended result and preserved quality; whether each path achieved the brief after revision.
2. Concrete moments where context helped, merely saved a click, demanded reconstruction or caused
   surprise; any intention abandoned and why. Record order/familiarity limits without scoring people.
3. Owner verdict: keep specific behavior, simplify to explicit controls, revise the job, defer or
   reject. The owner may stop on a negative result; useful prototypes do not require positive claims.
4. Relationship-depth questions deferred; any **one** proposed extension with its observed need,
   cost in added mechanisms and separate authorization still required.

The owner records product acceptance separately from engineering readiness. Core E0 may close with
optional depth explicitly deferred. Preference or a scripted demonstration alone cannot establish
creative value; the outcome and revision supply the evidence. Broader creator/competitive testing
remains optional follow-up to a named claim.

No production source model, API, kernel, UX grammar, integration, R1 scope, slice count or release is
selected. Preserve the runnable evidence if useful; do not promote snapshot history, whole-document
recomputation or experiment JSON into production because they were convenient here.

[ratification]: ../../reference/decisions/t5-g0-ratification-2026-10-27.md
[architecture]: ../../reference/architecture.md#expressive-creation-and-revision-destination
[e0-boundary]: ./README.md#e0-next-experimental-decision-gate
[g0-e0]: ./g0-reconciled-proposal/README.md#10-earliest-evidence-earn-the-workflow-and-the-architecture-together
[proofs]: ../../../broad-research/native-creative-depth/proof-agenda.md
[lab]: ../../../prototypes/native-form-lab/README.md
[prototypes]: ../../../prototypes/README.md
