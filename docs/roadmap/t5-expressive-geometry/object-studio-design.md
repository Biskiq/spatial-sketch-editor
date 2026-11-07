# Object Studio — journeys and interaction specification

**UX part of the [T5 umbrella](./umbrella-plan.md) in PR #266.**
This replaces this file's earlier competing architecture. Approved
[shell](../../reference/design-system/editor-shell-and-visual-system.md) and
[spatial grammar](../../reference/design-system/spatial-instrument-grammar.md) remain authority;
this text specifies the proposed implementation target without claiming Studio is already shipped
or recording a separate owner-acceptance event. No additional T5 UX approval checkpoint is introduced.
Existing shell limitations are implementation work, not permission to remove
an entry journey or reduce modeling power.

## One Studio, two entries

Studio is focused object authoring on the shared Stage. World and Experience remain lenses;
Studio is an explicit scope with its own entry address and task-appropriate controls. Head keeps
project identity, Find, Undo/Redo and Save. One canonical selection drives Stage, Index and Card.
The visible name is **Object Studio**, the selected-form action **Edit in Studio**.

| Journey | Entry and context | Exit and persistence |
| --- | --- | --- |
| Existing World object | Select a supported native form → Edit in Studio. Keep its world pose and identity; frame through Camera; other Scene/Layout content is muted and non-pickable | Back to World returns to the same root with applied edits. It never inserts a copy. Save writes the same project. |
| Standalone creation | New object from `/`, Projects, or My Objects; `/studio` is the direct launcher. Open a normal empty-Layout project immediately in Studio, with Objects ready | Save preserves the project. Back to Projects makes it discoverable; Open in Studio resumes it. Place copy in World is a separate action. |
| New object while in World | Objects → New in Studio begins explicit creation in the current project using its normal support/placement intents; New object project is the separate standalone choice | An accepted new root enters Studio in place. Back to World keeps it there; no insertion on return. A different project uses the normal save/leave guard. |
| Saved library item | Open editable copy verifies an immutable My Objects item and seeds a new project with a new form identity | The snapshot stays unchanged. Save saves the new project; Save to My Objects creates another snapshot. Insert copy remains the direct World-placement action. |

These entries have the same available modeling tools. “Standalone” does not mean a reduced modeler;
“World-origin” does not mean a separate isolated copy. Imported models and primitives keep their
current whole-object capabilities; the first Studio capability is for native forms. Do not present
unsupported Edit shape or fabricate editable parts from Three children.

## World-origin journey

1. Keep ordinary quick Objects creation unchanged: Box/Round click or drag; Free draws and finishes;
   size afterward. Quick World creation never automatically enters Studio; explicit New in Studio
   does. Its Card has a visible Edit in Studio action and Find equivalent; it must not be discoverable only through an overflow.
2. Finish/cancel a pending stroke or manipulation before entering. Entry changes scope, not source.
   Start in Select with the same root selected. Capture a return record: project, origin lens,
   Camera inspection pose/reading intent, Index location/disclosure and initiating control.
3. Preserve object position, rotation and scale. Camera frames it while retaining viewing direction
   as far as valid framing permits. The target is never moved to the origin. Default Context is
   **World**; **Mat** hides surroundings without moving the target or changing support. The mat/grid
   is presentation, not a new Layout floor. Ordinary edit tools pick only the scoped object. A later
   reference-picking task may explicitly expose eligible context, with named purpose/owner and
   cancellation; it changes task focus, not canonical selection or edit reach.
4. Use the existing name, Width/Height/Depth and supported transform writers. In the first capability
   there are no empty advanced-tool promises. Later Edit outline, Draw hole, Stretch and Cut/Add
   appear only for admitted source capabilities. Stage readouts open the one Card writer.
5. Back to World ends the scope, revalidates the saved Camera return intent against the current
   source/output context, restores the valid Index location, and selects the whole root in Select.
   Reopen an earlier Objects browser without an armed object choice. Return keyboard focus to the
   initiating control or the root Card if that control no longer exists.

Source edits invalidate Camera-output tickets. Store the desired return pose/reading as a session
intent, not a reusable ticket. Ask Camera to realize it using a current claim; never write matrices
or tween the Camera in the shell. If the old reading/location is no longer valid, return to the
nearest valid scope, explain the fallback and offer Fit. Do not restore a deleted subject or old
selection from another project.

If Undo/delete removes the scoped root, show Object unavailable with Choose object, Return and the
ordinary Undo/Redo actions; clear invalid selection and cancel the task. Do not silently scope the
next entity. Explicit Undo/Redo that restores the same root may requalify that root; it does not
restore an obsolete gesture, Camera ticket or a second selection value.

Choosing an Experience lens while in Studio first resolves the pending task, exits Studio and
keeps canonical subject identity according to the existing lens-crossing contract. Studio does not
capture a View, edit a Guide or inherit a private Experience selection. Preview uses the normal
isolated visitor takeover and returns through the same qualified Camera protocol.

## Standalone lifecycle and URLs

The launcher mints one project identity and navigates to the existing spatial route with
`create=1&entry=studio`. After baseline admission it removes the one-time `create` marker; it must
not mint another project on refresh/back/forward. The Studio posture is session/navigation state.
An optional `object=<entity-id>` addresses an explicit root within the loaded project; it is not
an authorization token or a new durable reference format.

| Open state | Required behavior |
| --- | --- |
| New empty project | Studio mat, no selected-object Card, Objects open. Box/Round/Free use existing creation intents and datum support. The first accepted form becomes the scoped root. |
| Saved project with explicit valid root | Load through ordinary F2 admission and enter that root. No name/array-order guess. |
| Saved project with one eligible root and no requested root | Enter that form. This is an entry convenience, not persisted ownership. |
| Multiple eligible roots and no requested root | Show a compact root chooser using the existing locator vocabulary; choosing one enters Studio. No geometry or hierarchy changes. |
| Saved project with no eligible root | Show No editable objects with Create object here, New object project and Open World. Create here is an explicit ordinary creation task; never replace the existing project or insert silently. |
| Explicit target missing or unsupported | Explain the unavailable target and offer Choose object or Open World. Never silently choose a different object. |
| Project missing, forbidden, malformed or unavailable | Keep existing distinct load states. Do not convert a failed open into a new Studio project. |

The initial Studio has one active root scope, not a one-object-per-project rule. **New object here**
resolves pending work, temporarily enters creation scope and uses the normal creation/support
intents; the newly accepted root becomes active. Cancel restores the previous scope/selection.
**Choose object** switches to another eligible root in the same project without a Save/navigation
ceremony. Update the session/URL target, reframe through Camera and preserve the return origin.
Only an explicit **New object project** switches projects through the existing guard. Each accepted
root is ordinary placed Scene source; there is no unplaced draft document. **Add part** later names
the active assembly destination and is visibly different from creating another independent root.

Head Save writes all accepted project source with the ordinary login, capture, conflict and retry
behavior. A nonempty unsaved object cannot disappear on navigation. An empty project can leave
without a new Studio-specific save ceremony. Pending previews and session history are not saved;
the saved-state indicator never claims they are. Source download/open remains the existing recovery
path, not a separate fixture format.

Projects is the first draft-discovery home. Every normal project row offers **Open in Studio** in
its action menu and **Open World**; opening Studio can select a root as above. No Studio project
kind, hidden source metadata, “In progress” library table, or persistent workspace flag is required.
Direct entry exists on `/` and Projects as **New object**, distinct from ordinary **New project**.
A dedicated draft filter may be designed later without blocking save/resume today.

## Copy, placement and return are different actions

| Action | Source and effect |
| --- | --- |
| Save | Captures the current accepted project; does not create a library item or place anything elsewhere. |
| Save to My Objects | Creates an immutable accepted-source snapshot; no project history result or live linkage. |
| Open editable copy | Seeds an independent new project from a verified snapshot with a new identity; leaves the library item untouched. |
| Insert copy | Places a detached copy into the current World through the existing destination planner and one F4 result. |
| Back to World (existing placed root) | Exits scope in place; never duplicates. |
| Place copy in World (object project) | Captures supported source, opens a chosen different/new destination project and starts ordinary placement; click accepts a new destination identity. |
| Open this project in World | Changes the current project's posture and keeps its existing root; no insertion. This is the explicit same-project choice. |

For cross-project placement, resolve pending work, Save the source project successfully, then capture
the supported form-library payload from its accepted source. Choose the origin, another owned
project or a new project through Projects. One active host switches projects; transport is a frozen
session payload identified by source project/revision/content and destination epoch. Do not put
source bytes in a URL, browser history or a durable scratch store. No library item has to be created.
On the destination, revalidate the payload, resource availability and support through `place-form-copy`.
Its commit creates one independent entity; Undo removes that insertion only.

Cancel before switching stays in Studio. Cancel a destination placement leaves the destination
unchanged and offers **Return to object**, reopening the saved source/root. Refresh during transfer
may discard the uncommitted placement; it cannot lose the saved object. A failed source Save keeps
the object project open; a failed destination load leaves a visible retry/return path. Never claim
cross-project Save/insertion is one distributed transaction. The first payload is the existing
single-form payload; assembly transfer waits for its canonical library/closure capability.

Opening a single-form snapshot uses `place-form-copy` in the new empty project's datum at X/Z zero
and yaw zero, with captured evaluated contact and a fresh entity ID. This retains the library's
shape source; it does not claim to recover a world pose that payload 1 never stored.

## Shared surfaces and progressive tools

| Surface | Studio expression |
| --- | --- |
| Head | Same project, saved state, Find and chronological Undo/Redo. World/Experience remain lens controls; crossing resolves the task. |
| Scope strip | Object name, **Object Studio**, Context World/Mat, and origin-appropriate return. Standalone uses Back to Projects plus Place copy in World; existing World root uses Back to World. |
| Stage | One viewport and Camera output initially. 3D on entry; object-local Plan/elevation readings invoked by supported tasks. No mandatory second viewport. |
| Dock | Select, Measure, Eraser and Objects; architectural Ink is absent in this scope. Later modeling tasks are invoked from supported actions and own one palette/procedure. Advanced depth may add explicit tools; do not fit every operation into the initial four dock entries. |
| Card | Root or component identity, frame and reach, supported ordinary properties. One numeric writer per fact. Readout click/focus opens it; blur never commits a pending modeling value. |
| Index | First capability: root scope/location only. Assemblies: bounded **Parts** navigation for this object, with parent breadcrumb and keyboard search; no chronological Undo tree and no global World outline replacement. An invoked construction/dependency view is a different task surface. |

Whole versus part reach is always legible. After assemblies, root selection acts on the entire
placed object; part selection names its parent and affects that part only. Add part names the
assembly destination even when a leaf is selected. Breadcrumb Up changes the current object scope;
Back to World exits Studio. Selecting a part does not automatically move Camera. No transient local
selection substitutes for the canonical F.1 component selection.

For existing size rays, pointer release commits one valid edit and Escape cancels. Profile/holes,
control-surface, parameter/binding, Repeat, Stretch and Cut/Add edits use a reviewable pending task: **Apply**, **Discard**, and **Continue editing**
on attempted exit. An exit may offer **Apply and return** only when the candidate is valid. Discard
affects the pending change only; earlier accepted work remains in history. Apply is disabled during
validation and names a refusal when invalid. Escape unwinds pending gesture/task, then Studio;
browser/project navigation uses the same pending-work policy. No invisible commit on blur or exit.
Undo/Redo during a pending modeling task first asks for Apply/Discard/Continue through that same
policy; it never operates an experimental task history or discards accepted edits invisibly.

Source operations remain editable without requiring construction-order knowledge for an ordinary
edit. Supported source-role hits open the owning operation; an invoked **Refinements** list locates
operations even when no visible fragment survives. The first operation capability exposes named
Edit/Remove and dependent diagnostics, without reorder. The entry may start under More, but an
active modeling task keeps its needed controls visible. A failed upstream edit can adjust/remove
an affected operation in the same pending candidate before Apply; no invalid intermediate accept
or destructive restart is required.

An advanced construction/dependency view, operation reordering or surface-element tools may be
introduced when their source semantics are admitted. They are not forbidden by “no history tree”
or hidden permanently behind More. A source program view is distinct from chronological Undo.
Such a task can use the lower Instrument's breadth rule, while the Card retains selected identity
and each fact has one exposed writer. A graph is a possible authoring surface, not a prerequisite
or an alternative semantic source.

Parameters and Repeat are invoked tasks of the selected assembly. Parameter fields show units and
edit reach; a driven fact opens its binding/driver instead of a competing value writer. Repeat names
the template, axis, count, spacing and selected member, with Suppress/Restore and Make independent.
Members remain reachable in Parts when suppressed. A source parameter that affects multiple parts
previews all affected work and applies once. A linked definition uses explicit Edit all linked uses
or Make this instance independent; an ordinary instance override names that narrower reach.

Create surface/Edit controls exposes the control-surface family's real limits: faceted, fixed grid,
height along the local normal, zero thickness. A task-local control set is qualified by source
revision and is not a second object selection or durable face binding. Numeric fields and handles
write the same controls. Surface and solid operations are offered from the declared result class;
unsupported Cut/Add is explained rather than converted or guessed.

Sections through a current body are future inspection/refinement tools, distinct from editing the
generator outline. If they show holes or multiple contours, display those honestly; disable only
the unsupported operation, not Studio. Full-Stage versus inset Section and reshape/Keep mechanics
remain a bounded later UX/design task. The prototype's mandatory split and first-section choice
are not approved product requirements.

## Growth of the workspace

The first viewport, single-root task and bounded Parts navigation are initial delivery choices.
They are not restrictions on future multi-object operations, nested assembly editing, control-set
selection, relationships or linked spatial readings. Domain-supported sets use the canonical F.1
selection model; controls that are only task focus remain explicitly subordinate to that selection.
External-reference picking temporarily exposes eligible context without silently widening edit reach.
Independent roots can coexist now; joining them later is an explicit domain operation.

Richer tools may use a visible object-local workplane, construction view or an invoked wider task
surface. Additional linked views need Camera-qualified outputs, shared selection and the same
source/evaluation; they cannot introduce a second camera authority or another writable scene.
This plan specifies no multi-viewport implementation. One Stage means coherent spatial work, not
that expert learning or all future tools must fit the first viewport arrangement. Preserve the
approved shell's information ownership, not incidental limitations of its current components.

## Responsive and accessibility acceptance

Use existing shell metrics, material roles and spatial marks. At 1440×900, 820×1180 and 1280×720,
the object, return action and selected identity remain visible or directly recoverable. Collapse
Index/Parts and disclose Card on demand; do not squeeze in a second pane or cover the object with
two competing lower instruments. The same operation has keyboard/numeric and coarse-pointer paths;
no hover-only entry or drag-only return.

Verify keyboard traversal through entry, Card values, Apply/Discard, library actions and return;
focus returns to the initiating control or an explicit valid successor. Respect reduced motion
through Camera's policy. Context visibility cannot change picking eligibility, source, history or
resource ownership. A regular laptop's observed interaction problems must be reported; historical
prototype timing numbers are not proof of responsiveness.

## Implementation target

The first capability delivers direct standalone entry, in-place World editing, explicit scope and
same-project root switching, 3D-first entry with invoked readings, Projects-based discovery and
honest return/copy placement. Later Parts, Parameters/Repeat, linked edit reach, surface controls
and Refinements are specified with their consuming capabilities; no empty tool surface lands early.
This creates no semantic authority, kernel dependency or private animation infrastructure.

The [umbrella acceptance cases](./umbrella-plan.md#first-capability-studiodual-entry) define completion.
Existing shell implementation gaps are integration work; they do not justify World-only Studio,
forced project separation or an unsaved experiment. A genuine hard-rule conflict is reported through
the existing workflow. There is no extra UX decision round before starting from the merged plan.
