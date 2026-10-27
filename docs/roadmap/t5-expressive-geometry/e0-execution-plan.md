# E0 — Owner-evaluated spatial creation playground

**Status:** implementation-ready prototype plan for review. This PR changes documentation only;
E0 has not been implemented or evaluated. Implement it only on a subsequent instruction.

**Decision-maker:** the product owner is the sole E0 product decision-maker. Deliver working software
that the owner can explore, compare and reject. Recruitment, cohorts, statistical thresholds,
staff-hour budgets and calendar delays are not prerequisites or acceptance gates.

**Question:** can a creator carry one spatial idea across making a form, arranging objects and
revising both, with less reconstruction of intent and understandable exceptions? Or do competent
explicit object/source controls already provide the better workflow?

## 1. Reconcile the research brief with the owner commission

This plan operationalizes [G0 §10 at its reviewed revision][g0-e0]. The owner's current commission
**supersedes §10.1's provisional study protocol for E0**: eight participants, matched onboarding,
counterbalancing, six-of-eight thresholds, percentage improvements and delayed-return scheduling
are removed. It also replaces the former plan's hour caps and formal evidence collection. These
were research assumptions, not durable architectural decisions. No amendment to production contracts
or R1 registration is made here.

| G0 question / existing evidence | How this E0 answers it |
| --- | --- |
| §10.1: context reused across form and arrangement | A continuous guide-based creation path and a competent object-first path in the same playground; compare complete creative sequences, not control locations |
| §10.1: transfer, irregularity and creative ownership | Start from a blank floor or an existing arrangement; create a different result of the owner's choosing using the same interactions |
| §10.1: following, exceptions and return | Edit a shared guide, detach a member, reopen saved work and deliberately repair a missing source; the owner explains expected consequences before trying them |
| §10.2: shared source lifecycle | Small real evaluator, stable keys, snapshot Undo, source-only JSON, copy isolation and visible refusal; focused checks rather than engine/platform certification |
| §10.2: contour, precision ordering and source comparisons | Deferred. No second representation, deformation engine or boolean kernel is needed to answer the shared-context question |
| §10.3: finish with a decision | Owner verdict: keep, simplify, reject or request one specifically named follow-up; observed failure and useful behavior are recorded without prescribing R1 |

The [native creative-depth proof agenda][proofs] supplies useful revision/identity questions.
[Native Form Lab][lab] already supplies working prototype patterns for drawing, evaluator-backed
preview, snapshot history and JSON; its handles-versus-operations Review drawer is precedent, not
proof of a different workflow. [Shape focus][shape] is design evidence, not a shaping implementation
that E0 must finish. Reuse small useful pieces; do not import either prototype's full capability set.

Owner evaluation can select a product direction and reveal defects. It cannot establish general
learnability, market demand or superiority over current editors. External creator testing and a
current-editor comparison may be recommended for a specific unresolved claim later; neither blocks
E0 completion. A later revisit is useful if the owner wants it, with no required waiting period.

## 2. The experiment: spatial idea first versus object first

**Moving Band and Arrange controls into the viewport is insufficient.** Both paths will use the same
viewport, numeric controls and geometry. The proposed difference is the unit of attention and its
continuity: an active spatial guide can remain the subject while several kinds of result are made
and revised. Object-first creation instead starts with a result and explicitly selects its source.
There is no claim that this distinction is inherently new or necessarily better.

Build one playground with two freely switchable entry paths:

| Sequence | Spatial idea first | Object first |
| --- | --- | --- |
| Begin with empty space | Click a guide on the floor; it becomes active spatial context, without choosing a form family | Choose Create band or Arrange objects; draw or pick the source guide as part of that action |
| Make more than one kind of result | With the guide still active, add a band, then select objects and arrange them along it; changing selection does not require reconstructing the guide choice | Create a band and an arrangement through explicit actions, each with a source field and viewport picking. Existing guides are reusable and may be prefilled when unambiguous |
| Begin with existing work | Pick objects in an explicit order and Use their positions as a guide; use that guide for a band or another arrangement | Create a guide from the same ordered positions, then select it as the source of each desired result |
| Revise the spatial idea | Select either result and choose Edit shared guide; the guide and all its following consumers become the visible edit scope | Select the result, open its Source, then Edit guide. The same affected consumers and handles appear; no graph navigation required |
| Depart locally | Move a member independently or alter only a band's width/height, with the scope visible | The same local changes and explicit break-following choices are available |

The contextual path must support **draw → form → arrangement → result-led revision** and
**arrangement → borrowed guide → form**. The latter tests whether context can be discovered from
existing work instead of merely exposing a predetermined procedural recipe. Borrowing is an explicit
snapshot of ordered positions, not inferred design intent or a new live dependency back to those
objects. This avoids cycles when the objects are later arranged on that guide.

Keep the object-first path competent: preselection, source reuse, viewport picking, numeric edits,
Undo and persistent relationships remain available. No intentional extra clicks or hidden shortcuts.
Both paths may converge on the same interaction after a source is chosen; preserve that convergence.
If the advantage reduces to a convenient shortcut or control placement, report that and keep the
shortcut. Do not rename it a new creative language.

The owner should ask: did the guide remain a useful subject, or become another mode to remember?
Could I start from either space or existing work? Did I revise what I meant without reconstructing
how it was built? Did the object-first controls express the same intention just as naturally?

## 3. What the owner can actually do

### 3.1 Common playground and interaction rules

Use a floor grid, a central table/sculpture and a few simple objects, with Plan and oblique 3D views.
Plan is convenient for drawing; 3D verifies volume and placement. Pointer operations project onto the
floor plane; orbit/pan/zoom never edits geometry. Fit view and Reset example are always available.
Provide Blank floor (table/support context only, no authored guides or results) and Display example
starts, not separate bespoke scenes for each comparison.

- **Draw a guide:** click two or more floor points; Enter finishes, Escape cancels. Click an existing
  segment to insert a point; drag a point or enter X/Z to revise it; Delete removes the selected point
  while at least two remain. Show the draft line and point order. Freehand recognition is unnecessary.
- **Borrow a guide:** select placed objects in order, show numbered centers and a connecting preview,
  then Use positions. The guide captures those centers once. Moving a sampled object later does not
  change it. Reordering is explicit through reselection; no inferred sorting or curve fitting.
- **Use a guide as context:** highlight it and show its name plus Clear context. Keep it active while
  changing object selection. Selecting another guide replaces it deliberately. Escape first cancels
  a draft; otherwise it clears active context. Active context is session UI, not saved authored truth.
- **Make a band:** preview a rectangular-section ribbon along the guide; adjust width and height by
  handles or numeric fields, then Create. Initial values are 0.20 m wide and 0.60 m high. The preview
  names the guide and offers Follow guide or Make independent. Following is an explicit choice,
  never a consequence of a snap. Independent creates a private guide copy, still editable.
- **Arrange existing objects:** select the objects, choose/use a guide and adjust start/end margins.
  Preview evenly spaced centers and tangent orientations; Apply accepts one change. Follow guide is
  an explicit choice. Without it, accept poses only and keep the objects free. The same controls are
  available from the object-first command list.
- **Revise a visible result:** select a band or following member. Distinguish Band dimensions,
  Edit shared guide and Move this object. Guide editing highlights every following consumer before
  dragging. A following object's move offers Break following and move; cancel leaves it unchanged.
  Do not silently turn a local move into a shared-guide edit or maintain an invisible override.
- **Make an exception:** break following for one object while preserving its world pose, then freely
  move/rotate it. The remaining members retain their slots rather than closing the gap. To include
  it again, select the desired set and explicitly reapply Arrange; preview any redistribution.
- **Relate to a support:** optionally pick an endpoint and a movable support marker, then Follow
  support. Store its current offset so attaching does not jump. Moving that support changes the
  endpoint, and the band/arrangement follow. Merely drawing near it creates no relation.
- **Explore:** place/duplicate simple box objects, change their size/color/yaw, create another guide
  and band, and duplicate an entire connected group as an independent variation. A group copy remaps
  its internal keys; an external support binding is broken at its last position and disclosed.
  Duplicate guide group previews the chosen guide, its bands and arrangement members (including
  detached exceptions); optionally include its support. No reusable-definition library is needed.
- **Recover:** Undo/Redo, Save JSON, Open JSON, remove a support/guide and repair or detach its
  dependents. Show the affected objects and reason for an unresolved link; never silently attach
  to a replacement with a similar name or position.

Every continuous drag is one Undo step. Numeric edits commit on Enter or field confirmation; Escape
restores the prior value. Creating a band/arrangement uses an explicit preview acceptance; ordinary
valid point, dimension and object drags commit on release without a confirmation ritual. Invalid
changes keep the last accepted result, retain an editable draft and explain the specific problem.
Switching entry paths, resetting or opening a file cancels a draft before changing context. Use
keyboard/numeric equivalents for precision, but do not commission a full accessible-shell rebuild.

### 3.2 Useful freedom and honest limits

The starter example has one guide, one band and three objects; those are **not quotas**. Allow extra
points, multiple guides/bands and explicitly selected member sets with the same small primitives.
That is cheap variation through existing operations, not another modeling subsystem. Allow asymmetry,
independent exceptions and different starting orders. A table is visual context; collision avoidance
is manual, not falsely presented as a clearance solver.

Keep the geometry envelope clear: open planar polylines; rectangular band sections; positive finite
width/height; nondegenerate segments; no self-intersecting or overlapping band footprint. Use mitered
joins with a finite limit (four half-widths); refuse tighter corners with a request to widen the
corner angle. For overlapping offsets, suggest narrowing the band or separating its segments.
Zero-length segments, reversals and invalid spacing are refused. Validate each band individually;
different objects may intentionally overlap. Units are metres. No arbitrary 10 m square or
3–6-point ceiling is necessary.

Closed loops, curved/freehand paths, variable sections, booleans, arbitrary mesh editing, contour
sculpting, surface hosts and automatic fitting remain outside this E0. If one repeatedly prevents
the owner from expressing the intended spatial idea, record the actual blocked example and decide
whether it merits a focused follow-up. Do not preemptively build the capability or conceal the limit
with a prepared animation. Do not keep polishing the safe demo while ignoring that failure.

## 4. Minimal technical design and location

**Proposed location:** a new `e0-spatial-playground` directory under the existing
[prototypes directory][prototypes]. It does not exist yet. Keep it independently runnable with its
own package manifest/lockfile and outside root npm workspaces, production imports and public guides.
Use the existing Native Form Lab's Vite + Svelte 5 + Threlte/Three setup as a donor. Copy only the
small viewport/input and useful numeric/history pieces, with provenance notes; do not depend on its
app state or build a shared framework. Use its compatible dependency versions as the starting point.
No new geometry library, server, AI, worker or production adapter is required.

The future prototype README must give executable setup/run commands from its directory:

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

Provide those scripts and print the actual local URL. A fresh checkout must reach the playground
without accounts or other services. Add a link in the prototype index when implementation exists.
Do not add a broken executable route or empty prototype scaffold in this documentation PR.

### 4.1 Small modules, one evaluation path

| Module responsibility | Minimum contents |
| --- | --- |
| Model | Experiment format version; maps of supports, guides, bands, objects and arrangements keyed by non-reused IDs; only authored values and references |
| Geometry | Polyline length/sampling, offset footprint, validity checks, band extrusion and member poses; pure inputs → geometry/diagnostics |
| Editing | Draft versus accepted state, typed local edit functions, synchronous validation, snapshot Undo/Redo; context/selection held separately |
| View and controls | Shared renderer/picking/handles; spatial-context entry path and explicit action list over the same edit functions |
| Files and examples | JSON validation/load/save; Blank floor and Display example factories; connected-group copy/remap |

This is a suggested separation for a small prototype, not five packages or a plugin API. Use a
single application and the simplest local file organization. Re-evaluate the whole small example
on an edit; rebuild/dispose changed meshes correctly. Add incremental machinery only if an observed
stall prevents owner exploration and a local fix is insufficient. No production architecture decision
is inferred from this choice.

### 4.2 Authored values and deterministic behavior

- A **guide** stores keyed X/Z points and, optionally, an endpoint's support ID plus offset. A
  **support** stores its floor position. Moving it resolves the endpoint as support position + offset;
  all other guide points stay authored independently. No relation solving or dependency cycles.
- A **band** stores guide ID, width, height and color. An independent band owns a separate guide copy.
  Geometry is the extruded offset polygon. Generated triangles, render handles and current selection
  are never saved.
- An **object** stores ID, box dimensions, color and free pose. An **arrangement** stores guide ID,
  ordered slot records naming objects, active-follow flags and start/end margins. An object follows
  at most one arrangement; moving it to another requires an explicit preview and retires/clears
  its previous slot reference.
- For N slots, guide length L and margins a/b, slot i lies at
  `a + i * (L - a - b) / (N - 1)`; a single slot uses the interval midpoint. Margins must be nonnegative
  and leave a positive interval. Use the outgoing segment tangent at an interior corner. Detaching
  or deleting a member retires its slot without renumbering survivors; deletion clears the retired
  slot's object reference. Explicit re-Arrange rebuilds the selected slot set and previews the new
  spacing; no automatic count-regeneration semantics.
- For a missing source, retain the last resolved guide coordinates/member poses as explicit recovery
  values at deletion. Render that frozen state with an unresolved label. Block changes requiring
  the missing source, allow unrelated work, and offer Pick replacement or Keep independent. Repair
  previews any jump and names the affected dependents before acceptance. Reusing a name never
  resolves an old ID. Undo restores the deleted source/keys.
- Copying a connected group remints all copied IDs and internal references, including retired slots;
  copying does not accidentally follow the original. This is a one-off independent variant, not
  schema migration, provenance infrastructure or a definition/instance system.

Apply an edit to a draft copy, evaluate and validate it, then accept it atomically into one snapshot
history entry. Rejected drafts and canceled gestures never enter history. Undo followed by a new
edit clears Redo. Reset, load, Undo and entry-path switch cancel the current gesture, so a later
pointer-up cannot commit the old draft. Everything is synchronous; do not invent background jobs
or stale-worker protocols merely to test their cancellation.

Save only accepted experiment data, including deliberate recovery values. Open parses and validates
into a temporary value before replacing the current document; a bad file leaves current work intact.
Opening starts a fresh history and clears session context. Unknown format versions are refused with
an explanation; E0 needs no migration system. Regenerate all meshes after a real browser reload.
Missing references are loadable only as explicit unresolved records, never silently repaired.

## 5. Coherent build increments

These are implementation work chunks for the disposable prototype, **not production slices**. Do
not register them in the phase/gate/release lists. Each leaves something runnable; carry correctness
along with the interaction rather than adding a hardening phase after a polished mockup.

| Increment | Build | Completion check |
| --- | --- | --- |
| A — Make and revise real form | Standalone scaffold, floor/Plan/3D views, draw/edit polyline, band evaluator, explicit source controls, preview/refusal and snapshot Undo/Redo | Draw a guide from blank, create a band, change width and a point, cancel an invalid edit and Undo the last accepted change; geometry really responds |
| B — Carry one guide across results | Primitive placement/selection, arrangement sampling, spatial-context continuity, direct result→guide editing, visible affected scope, member detachment and support endpoint binding | Make band + arrangement on one guide, revise from either result, move support and keep one exception still. Repeat via object-first controls without losing capabilities |
| C — Start elsewhere and return | Ordered-position borrowing, multiple guides/results, independent group copy, missing-source repair and JSON Save/Open | Begin from placed objects, make a band using their sampled guide; create an independent variation; reload a saved following/exception state and repair a removed source |
| D — Deliver the owner playground | Complete the walkthrough below through UI, focused correctness checks, clear controls/limits/run instructions and concise findings with useful saved examples | Owner can run both entry paths, depart from the example and judge the tradeoffs; no scripted result or developer-only state manipulation is required |

If B only changes where controls sit, revise the contextual sequence before adding polish. If C
requires a general graph, kernel or complex reference platform, simplify the mechanism or expose the
unsupported case. Stop for an owner scope decision only when the creative question cannot be answered
within these primitives; do not use an artificial hour limit as the decision. Do not expand to a
second engine to rescue an interaction that has not demonstrated value.

## 6. Runnable owner walkthrough

The eventual README should reproduce this sequence with the final control labels. No facilitator,
recruitment, timed session or postponed return is required. Keep the walkthrough available beside
free exploration; it is a way to expose behavior, not the only permitted path.

1. **Start and make.** Run the prototype; choose Blank floor and Spatial idea first. Draw an open
   guide around the table, finish it, create a 0.20 m × 0.60 m band with Follow guide explicitly
   selected. Change height with a handle and width numerically. Inspect it in 3D.
2. **Carry the idea.** Place/select three boxes and arrange them on the still-active guide, with
   start/end margins of 0.30 m and Follow guide selected. The guide should not need to be redrawn or
   rediscovered. Pick the band, Edit shared guide and drag a point. Predict and inspect both results.
3. **Keep a deliberate exception.** Break the middle object's following, move/rotate it, then edit
   the guide again. It stays put; the remaining members retain their slots. Alter band height alone
   and verify that this changes neither the guide nor the objects.
4. **Move context.** Attach the first endpoint to the support marker with Follow support. Move the
   marker; the endpoint, band and following objects respond, while the exception and free table do
   not. Undo, Redo and cancel a drag. Explain the scope from the visible cues.
5. **Try the explicit path.** Reset to Display example, which supplies a table, support, an unbound
   guide and three free boxes. Use Object first to create the band and arrangement with that guide.
   Revise and detach as above. Switch entry paths on the same document. Is there a real difference
   in carrying intent, or just different access to the same sensible actions?
6. **Reverse the starting point.** Start blank, place three or more boxes in an irregular arrangement
   of your own, select them in order and Use positions. Make a band from that guide. Move an original
   box: the sampled guide correctly stays still. Explicitly arrange a chosen set along it if desired.
   Compare the equivalent source-building sequence through Object first.
7. **Depart from the demo.** Add a point, another band with different dimensions, or a second guide.
   Duplicate a connected group independently and edit it; the original stays unchanged. Create a
   deliberately irregular result rather than reproducing a target. Note any useful intention blocked.
8. **Return and recover.** Save JSON, reload the browser and open it. Verify dimensions, source
   links and the detached object's pose; keep editing. Delete a support or guide. Inspect the frozen
   unresolved result, try explicit repair or Keep independent, then Undo. Try opening malformed JSON;
   current work must survive. Make an invalid tight corner and recover without losing accepted work.

The Display example uses floor coordinates (−2,−1) → (−2,1) → (2,1), a support marker at the first
point and a central 2 m × 1 m table. Objects start free beside it. The example is generated from the
same editable model as blank creation; it must not contain bespoke behaviors or baked final results.
The owner may save alternate examples and switch order freely; this is not a controlled study.

## 7. Completion checks and decision

### 7.1 Engineering ready for owner review

Verify the following at the prototype's own scale. Use a small set of deterministic model/geometry
checks and a real browser walkthrough, not production conformance machinery.

| Check | Sufficient evidence |
| --- | --- |
| Geometry is real and correct | Straight and right-angle bands have expected width/height and finite valid mesh data; known line lengths give expected member positions. Independent hand-calculated examples, not the evaluator checking itself. Use a documented numeric tolerance appropriate to metre-scale inputs |
| Both paths have equal capability | Create matching authored inputs through both paths and obtain matching geometry, relationships and exceptions; switches change session UI only |
| Revision and recovery are trustworthy | Shared edit affects intended consumers; detached/deleted slots do not retarget; support removal/replacement diagnoses; independent copies do not change the original |
| Undo and cancellation work | One drag/creation is one Undo entry; canceled/invalid drafts change nothing; Undo/new edit clears Redo; Reset/Open during a draft prevents its later commit |
| Persistence is genuine | Export accepted source, reload, import and regenerate the same values/IDs/relationships; malformed/version-incompatible files leave current work intact; unresolved state remains explicit |
| The playground can be explored | Full UI walkthrough and an owner-chosen variation run in the owner's normal browser, including repeated revisions. Fix visible stalls or accumulating discarded meshes if encountered; report the device/browser and actual limitations |

Build/typecheck and the focused prototype tests must pass; run the repository's required documentation
and architecture checks when opening the implementation PR. Do not add cross-engine/CPU matrices,
percentile latency budgets, memory-plateau certification, 100-edit benchmark campaigns, performance
telemetry pipelines or synthetic worker-crash tests. A specific observed failure may justify a
focused measurement. No performance claim is made beyond the exercised example and browser.

Lost accepted work, silent retargeting, acceptance of invalid geometry or a nonfunctional comparison
blocks delivery as ready. Correct visible refusal is acceptable within the declared envelope.
A known unsupported shape is a product finding, not permission to fake the result.

### 7.2 Owner decision and sufficient record

Deliver the runnable link/commands, this walkthrough, a couple of saved examples and a short findings
note: what works, what is prepared, what is unsupported, bugs/limitations and the actual comparisons
worth trying. Capture a short screen sequence only if it clarifies a finding. No event-logging schema,
time coding, research dataset, preference score or evidence dossier is required.

The owner evaluates whether context continuity is useful, consequences are legible, local exceptions
are comfortable, reverse-start creation transfers, and enough freedom exists to make something
personally intended. Record the concrete moments supporting the verdict, not numerical pass scores.

| Owner verdict | Closeout |
| --- | --- |
| Spatial idea first earns its continuity | Keep the specific demonstrated behaviors and name remaining questions; do not infer a general intent language |
| Explicit controls work as well or better | Prefer them; retain any useful contextual shortcut without claiming workflow differentiation |
| Relationships help but active context is confusing | Keep explicit following/source reuse; simplify or remove sticky context |
| The playground exposes a meaningful creative gap | Name the attempted result, why the current primitives cannot answer it and the smallest follow-up the owner wants; no automatic engine expansion |
| Evidence is unconvincing or the direction is unwanted | Record rejection or uncertainty and stop; a polished prototype is not an obligation to proceed |

E0 closes when the playground is technically reviewable and the owner records a direction or an
explicit decision to stop/defer. Engineering completion and product acceptance remain distinct.
External testing may follow at the owner's choice; it does not hold this closeout open. Implementers
must not substitute their preference for the owner's decision.

Production representation, APIs, domain integration, kernels, final UX, supported scale and R1 scope,
slice count and release remain open. Snapshot history, small-scene recomputation and experiment JSON
are disposable choices. No code is promoted because it exists. Preserve runnable evidence if useful;
record what should be discarded before any separately authorized production work.

[g0-e0]: https://github.com/Biskiq/spatial-sketch-editor/blob/f1a3cf553a5bba26c5bbdbe3761cf234ece1f938/docs/roadmap/t5-expressive-geometry/g0-reconciled-proposal/README.md#10-earliest-evidence-earn-the-workflow-and-the-architecture-together
[proofs]: ../../../broad-research/native-creative-depth/proof-agenda.md
[lab]: ../../../prototypes/native-form-lab/README.md
[shape]: ../../../prototypes/native-object-shaping/README.md
[prototypes]: ../../../prototypes/README.md
