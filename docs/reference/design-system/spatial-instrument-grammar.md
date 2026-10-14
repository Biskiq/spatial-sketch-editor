# Museum Editor — spatial-instrument grammar

> **#114 design reconciliation (2026-10-13):** the
> [shell contract](./editor-shell-and-visual-system.md) owns the ratified
> Conservatory direction. Camera markers, direct path editing and playback below
> consume that shell; UX3/V3 and split Path/Journey surfaces are historical.
> Truthful geometry, hit/manipulation laws, Camera evaluation and World readings
> remain intact. Advanced precision is capability depth, not permanent chrome.

**Status: soft-frozen destination reference for Stage-local representation and
interaction.** Feature designers use this with the
[shell contract](./editor-shell-and-visual-system.md) and their product/domain
brief. It makes the accepted working-surface grammar reusable without consulting
historical QA. Extending it requires an explicit reason for any changed rule.
It does not declare implementation or a production cutover.

## Responsibility boundary

| Authority | Decides |
| --- | --- |
| [Product/domain contracts](../../README.md), including [Camera](../components/camera-tour.md), [Scene transform semantics](../components/scene-content.md), [architecture](../architecture.md) and [F](../composition-execution.md) | What exists, identity, legal operations/constraints, ownership, validity, evaluation, source acceptance and session lifecycle |
| [Shell and visual system](./editor-shell-and-visual-system.md) | Persistent/contextual homes, lower-surface span, disclosure, material, semantic color/state roles, type/control roles, responsive composition and return/Preview behavior |
| **This reference** | How domain facts, direct spatial operations and their helpers communicate on Stage: truthful geometry, affordances, emphasis, precision/readout placement, layering, density, hit legibility and correspondence between readings |
| Feature/domain design | Which supported facts/operations matter for the task, the appropriate domain-specific instrument, and its conformant composition/hit policy |
| QA specimens | Falsifiable examples and calibration, not missing specification or mandatory drawing techniques |

These responsibilities compose; neither shell nor instrument grammar outranks a
domain about what an operation means. This is not a universal gizmo schema,
renderer/API prescription, new operation registry or navigation authority.
Layout, Scene, Camera and Experience may require different instruments.
The maintained editor's domain-specific graphics and input policies remain current
until their explicit cutovers.

## Spatial truth and affordance admission

A mark communicates a real authored fact, an evaluated relationship, a declared
operation, or explicitly temporary session context. Its shape and motion must tell
the truth about that category.

- Render architecture from canonical Layout output and contextual representation;
  use the domain's correspondence/inverse for supported editing. Do not rebuild
  architecture to obtain a convenient instrument.
- Show a Camera observer, target, projection or route from Camera evaluation.
  A target trace is not the observer's path unless the evaluated relationships
  actually coincide. Display, handles, estimates and execution must agree.
- A guide/handle must map to a supported operation and frame. A drawn circle,
  plane, axis or tangent must not imply an orbit, constant distance, collision
  boundary, tangent freedom or geometric constraint the domain does not possess.
- Schematic geometry is permitted when its role is clear: an unordered View constellation around a focus, a View-direction glyph, or station correspondence. It must not claim
  metric accuracy, Camera connectivity or authored identity it does not have.
- Distinguish accepted geometry from proposed/refused geometry and altered
  inspection readings. Do not represent a temporary reading as source movement
  or make a gap look like an executable connection.

A new handle must answer: **what fact does it address, who owns that fact, what
operation does a gesture request, and why is that relationship legible here?**
If the answer depends on inventing a domain constraint, the handle is not admitted.
An orientation or framing helper may remain passive if no corresponding operation
exists; it must then read as a helper, not a disabled-looking mystery grip.

## Semantic species and emphasis

Use the shell's [semantic color/state roles](./editor-shell-and-visual-system.md#semantic-color-64)
and [state hierarchy](./editor-shell-and-visual-system.md#state-and-control-hierarchy-183).
This document assigns their spatial expression; it does not define another palette.
Domain accents, axis hues and selection are separate roles. Existing axis conventions
may identify X/Y/Z; they do not become arbitrary feature-selection colors.

| Species/state | Stage expression |
| --- | --- |
| **Canonical selection** | Coherent identity contour/boundary and permitted handles; remains distinct from a referenced focus or a task target |
| **Task focus** | Named relationship/component/host and local instrument emphasis without selecting that identity |
| **Hover** | Restrained preview below selection emphasis; does not grant selection or unsupported handles |
| **Reference/context** | Quiet line/shape/label, not the selected-identity treatment |
| **Authored control** | Distinct operative glyph and interaction where supported |
| **Derived helper** | Lighter/hollow/dashed or explicitly read-only treatment; cannot masquerade as an authored control |
| **Active manipulation** | Strong local emphasis on the active grip, edited edge/relationship and affected measure, rather than every value or the whole model |
| **Temporary inspection** | Explicit reading/state label and retained as-built relationship; neither damage nor a second authored object |
| **Proposal/refusal** | Separate transient geometry and local reason; accepted source and selection remain visible |
| **Snap/guide** | Relation shape and text at the winning location, with state distinct from selection and refusal |

Owner/state cannot depend on hue alone. Reinforce through shape, line, icon, label,
position or pattern. A Camera path point remains recognizable as a path point when selected; a Journey Cue
remains an Experience event when aligned with that station. An Experience focus
reference does not select the World subject it references. Keyboard focus stays
visible independently of all of these states.

Instrument geometry is subordinate to the spatial work while still legible and
reachable. Passive helpers are restrained; active work gains local contrast and
rank. Avoid glowing graph blankets, opaque full-frustum fills or a field of equally
strong measurements. Surface-relative ink/halos preserve contrast on both mat and
vellum without flooding the drawing.

## Direct manipulation and precision

A spatial grip appears where its edited axis/relationship reads clearly in the
current projection. A visual handle must not promise precise control on an axis
that is nearly edge-on, foreshortened ambiguously or otherwise misleading. Withhold
or provide a clearly explained alternate control, preserving exact numeric access
in the shell's designated writer. Domain-specific fallback mechanics remain with
the domain/feature, not a universal angle threshold here.

Show dimensions, numeric tapes and live tags close to the gesture/relationship
that gives them meaning. State units and datum/frame when needed. Exact values do
not become approximate because a reading is foreshortened. Labels must say which
axes are to scale; a measured relationship and a schematic relationship cannot
share an unexplained appearance.

At precise Camera depth, **only the active grip displays its numeric tape**. Other
passive grip geometry and quiet accepted facts may remain visible. This does not
ban multiple useful architectural dimensions: the general rule is one active writer
with local emphasis, not one label on the entire Stage. World Paper's live tags and
Dimensions follow the [Paper precision contract](./editor-shell-and-visual-system.md#084-world-paper-authoring-destination).

Each precision operation has a non-pointer path to the same domain writer. A
surface may open that writer or display its value, never expose a second simultaneous
writer. Gestures, numeric entry, validity, acceptance and Undo follow domain/F
contracts. In particular, last-valid live Camera feedback is not permission to
silently clamp a refused source proposal. Explain the unaccepted candidate and
preserve the accepted result.

Snap marks describe the winning relation at the snap point. Cautions and refusals
appear near the responsible pointer/field with a readable reason and a deliberate
correction where supported. A clearance cue does not invent collision avoidance
or blocking semantics; only domain validation can make an edit invalid.

## Layering, occlusion and hit legibility

Compose layers by semantic purpose rather than a universal list of z-index numbers:
world/drawing context → passive references → canonical selection and task relations
→ active grips/gesture feedback → associated readouts. Shell controls, menus and
scope decisions remain distinct above the spatial instrument. This is emphasis and
interaction rank, not permission to draw all geometry through architecture.

Preserve meaningful spatial occlusion while keeping the active editable relationship
understandable. When a helper is obscured, a feature may use a truthful projected
cue, local contrast treatment or an explicit alternative control. It must not
silently move Camera, substitute selection or falsify a world position to improve
legibility. A displaced annotation has an unambiguous attachment to its true subject.

Feature/domain input policies declare eligible hit classes and arbitration. The
common requirements are:

- Passive world/reference graphics and derived route samples cannot intercept
  a gesture meant for the active operation.
- Hidden, inactive or ineligible helpers have no live hit targets.
- Hover, click and drag-entry resolve the same eligible target predictably;
  visible emphasis must not advertise a different winner from the hit policy.
- Enlarged screen-space hit areas may aid reachability without implying larger
  geometry; same-class overlap needs understandable disambiguation.
- A precise grip or proposal cannot accidentally fall through into unrelated
  selection/navigation. Domain pointer capture/cancellation remains authoritative.
- Orientation utilities, spatial grips and shell controls remain distinguishable
  and cannot steal one another's gestures.

Do not impose one cross-domain node/anchor/object priority. The maintained Camera
and placement contracts already have different hit policies; a feature preserves
or deliberately designs its applicable policy within these requirements.

## Density and correspondence between readings

Shed secondary annotation, repeated labels and passive helpers before obscuring the
primary editable relationship, selected identity or active grip/value. Resolve dense
labels and co-located markers without changing their authored positions or inventing
identity. A referenced occurrence still needs a way to be distinguished and reached.
Do not claim conformance from markers existing outside the visible/reachable region.

Plan, 3D, Outside, Through and temporary readings are projections of the same facts.
They may use different suitable graphics without changing identity, ownership, units
or operation meaning. A glyph does not need identical screen geometry everywhere;
it does need a consistent semantic role. Switching reading cannot secretly capture,
retarget, create connectivity or introduce an alternate evaluator.

Linked spatial and schematic/temporal projections expose correspondence through
matching stable references and emphasis. Their screen positions need not align.
Station focus, counterpart highlighting and task focus do not change canonical
selection unless an explicit Select action does so. A transformed World reading
retains its as-built relationship and honest measured-axis labels.

## Camera framing instruments

The [Camera contract](../components/camera-tour.md) defines View intent, legal
framing/projection operations, routes and evaluation. The
[Experience shell](./editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)
defines visual capture and Look through → compose → deliberate Update View/Exit.
The requirements below describe supported Camera instruments when invoked;
Outside/Plan precision remains advanced depth rather than a mandatory primary shell.

### Outside: observer and framing relationship

Outside exposes the **Camera observer in spatial context**, with its relationship
to target/focus and framing legible and directly manipulable through supported
Camera operations. Observer position/height, target/direction and framing geometry
must correspond to the evaluated View. Show a crisp, restrained viewing volume or
other truthful framing representation where relevant; it stays subordinate to the
world. An inset may show the resulting image without replacing the Stage or Card.

The circular guide around the focus in the Outside specimen expresses the need to
make the observer–target/framing relationship legible and operable. **A literal ring
is not required, and no orbit constraint is promoted.** A circular/arc guide is valid
only when it truthfully describes a declared active operation, geometric reference
or measurement and makes that role clear. It must not imply that every View sits on
an authored orbit, has constant target distance, or shares a hidden movement path.
Free observer placement, aim or lens work cannot be reduced to such a constraint
merely to resemble the specimen. Equivalent supported guides/grips may express the
same relationship more clearly.

### Through: the image as framing instrument

Through uses the evaluated View image as the working surface. A frame gate and
supported horizon/height, lens and target/crosshair grips make the framing task
legible. Their geometry and drag meaning must correspond to the actual Camera
operation; decorative corners are not proof that framing is editable. Only the
active grip has its numeric tape. Editor chrome, canonical View/scope Card and
explicit return distinguish Through from visitor Preview.

### Plan and View markers

Plan locates Views and Camera support at map scale. Directional View markers are a
schematic reading of evaluated framing, not permission to invent a finite projection
shape, FOV writer or path. The maintained Camera Plan's framing restrictions remain
current until cutover.

View markers locate the **actual evaluated observer and aim**, with legible
Camera relationships across Plan and 3D. Screen-sized glyphs and density aids may
clarify them without implying a false metric position, authored orbit, order or
connectivity. Presentation thumbnails and an accessible inventory reach every
View even when markers overlap. Default/entry roles are explicit, not inferred
from marker arrangement. Guide Stop labels are occurrence context, not Camera
node order. The old compressed constellation is historical UX evidence.

## Camera Paths and Journey projections

<a id="camera-routes-and-experience-coordination-projections"></a>

Camera supplies the path (connection), authored interior path points, generated
endpoints/samples, pace, stations and evaluated timing. Experience supplies the Guide edge's
choice of Cut/Travel and its station-bound Cues and pauses. The shell decides when
path editing, playback and advanced coordination are disclosed in the invoked Guide
context ([PLATE §0.8.1](./editor-shell-and-visual-system.md#081-finalized-experience-shell-expression)).
This reference owns their spatial and linked visual grammar.

| Representation | Stable meaning |
| --- | --- |
| **Camera Path line** | The geometry the Camera evaluator actually follows; never Guide order or a fabricated connection. Draw curvature only if evaluation curves |
| **View endpoint** (● with frustum, View name) | A Camera View or generated departure/arrival; never a second authored endpoint |
| **Path point** (open ○ example) | Authored, manipulable interior point; hit-eligible only while its editing operation is disclosed |
| **Selected path point** (gold ring example) | The one active manipulation target, with canonical identity echoed in its contextual Card |
| **Cue marker** (◆ example) | Occurrence-local Experience coordination at a station, when advanced coordination is disclosed; distinct from a Camera point |
| **Camera rig** | The evaluated Camera during playback; read-only unless an explicit Camera operation is invoked |
| **Gap cue** | Missing supported Travel with reason/repair; never drawn as a valid path |

Shape carries the species: ● Camera endpoint, ○ Camera path point, ◆ Experience Cue. Derived
samples are not marked at all, so an open circle always means an operative path point.
This replaces the earlier filled-diamond anchor baseline; the operative-versus-derived and
Camera-versus-Experience distinctions it protected are unchanged. Exact radii and
silhouettes are not frozen.

Path geometry is edited directly on Stage. Point insertion is deliberate and
distinguishable from selection; exact gesture/arming is a delivery choice.
Playback reads the same evaluated geometry with an explicit editing lifecycle.
The old straightened topology lane and separate Journey Deck are not required
destination surfaces. Advanced coordination retains station identity: departure,
an authored path point, named marker or arrival, never a generated sample. A Cue
binds within its Guide occurrence and Camera support rather than to authored
seconds. Pace/geometry edits preserve that binding or report an explicit invalid
reference. Any disclosed time position derives from Camera evaluation plus
Experience pauses; no shell-owned animation or second path editor is introduced.

Camera infrastructure uses the shared green role plus line/shape; active selection
and manipulation add gold locally. Guide-order context cannot masquerade as
Camera topology. In the Guide instrument, transitions show resolved continuation
(see PLATE §0.8.1): a connector between adjacent chips is drawn only when the resolved
destination is that neighbor.

## Temporary feedback and task lifecycle

Guides, snap winners, live measurements, proposal/refusal geometry and task-specific
helpers exist only while their relevant task/state is active. Clear stale emphasis
and hit targets on completion, cancellation, lost capture, task exit and teardown.
Read-only generated points may remain as current route context while that route is
disclosed; this rule does not delete canonical generated world geometry or erase
valid contextual facts when one gesture ends.

Temporary World inspection communicates its changed reading and as-built relationship
and stays coupled to its World Instrument. Lens parking deactivates that procedure;
Resume revalidates it. Preview removes authoring infrastructure and restores its
entry authoring context on exit. The shell's
[return/parking/Preview contract](./editor-shell-and-visual-system.md#082-parked-procedure-and-lens-return)
owns those lifecycles; this reference requires visible graphics and hit eligibility
to follow them. It creates no separate spatial return state.

## Conformance and specimens

A feature design must identify its domain facts/operations, then show truthful
geometry, eligible grips, semantic species, active/passive rank, local precision,
readable density, hit/occlusion policy and return/cancel behavior in its relevant
readings. A control list, decorative rig, matching label or literal ring is insufficient.
QA must inspect actual visible relationships and reachable gestures as well as
source/identity/transaction behavior.

The following artifacts retain rationale and visual evidence; their literal drawing
techniques are optional within the semantic species and distinctions above:

- [World synthesis](../../../prototypes/world-experience-shell-round/design/design-synthesis.md)
  and [QA package](../../../prototypes/world-experience-shell-round/QA-package/):
  temporary readings, measured-axis honesty, selection/task distinction, one writer,
  local refusal, repair and narrow task continuity.
- [Experience UX reconciliation](../../../prototypes/integrated-experience-authoring/design/experience-ux-reconciliation.md)
  and [Design-QAs](../../../prototypes/integrated-experience-authoring/Design-QAs/):
  historical Camera/coordination distinctions and advanced Outside/Through
  precision specimens; their old shell/constellation layouts are superseded.
- [Conservatory](../../../prototypes/experience-ux-alternative/README.md): accepted
  visual Camera authoring, direct Stage paths, contextual visibility and integrated
  Guide playback, promoted into PLATE; its mock evaluator is not a contract.
- Landed visual specifications (removed with the editor shell in #115), the
  [Camera graphics/input contract](../components/camera-tour.md) and the
  [Scene transform adapters](../components/scene-content.md): existing exact
  geometry, selection, hit arbitration and cancellation policies in their
  maintained contexts.

No universal orbit, gizmo, hit priority, all-values rig or new domain constraint is
introduced. Exact instrument geometry and domain-specific alternatives remain
feature design choices within the truthful and legible relationship requirements.
