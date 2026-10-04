# Museum Editor — spatial-instrument grammar

**Status: soft-frozen destination reference for Stage-local representation and
interaction.** Feature designers use this with the
[shell contract](./editor-shell-and-visual-system.md) and their product/domain
brief. It makes the accepted working-surface grammar reusable without consulting
historical QA. Extending it requires an explicit reason for any changed rule.
It does not declare implementation or a production cutover.

## Responsibility boundary

| Authority | Decides |
| --- | --- |
| [Product/domain contracts](../../README.md), including [Camera](../components/camera-tour.md), [placement](../components/placement.md), [architecture](../architecture.md) and [F](../composition-execution.md) | What exists, identity, legal operations/constraints, ownership, validity, evaluation, source acceptance and session lifecycle |
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
- Schematic geometry is permitted when its role is clear: an unordered Set around
  a focus, a View-direction glyph, or station correspondence. It must not claim
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
position or pattern. A Camera anchor remains recognizable as an anchor when selected;
a Stop beat remains an event when aligned with that station. An Experience focus
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
defines Auto/Hints/Capture/Precise disclosure and Outside/Through/Plan homes.
The requirements below describe their Stage representation.

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

### Plan and View glyphs

Plan locates Views and Camera support at map scale. Directional glyphs used in
Set/Seam work are a schematic reading of evaluated framing, not permission to
invent a finite projection shape, FOV writer or route. The maintained Camera Plan's
framing restrictions remain current until cutover. Feature exposure follows the
destination's scoped Set/Seam disclosure, not a permanent graph blanket.

A Presentation's View constellation shows observer/direction/focus relationships.
Its focus connectors are reference links, not Camera edges; its schematic form
remains unordered. A Guide overview uses numbered Stop entry pins rather than
Camera-facing glyphs. Stop numbers are occurrence order, not Camera node order.
Co-located pins must retain true location plus distinct occurrence access; no
specific fan-out or stacking technique is mandated.

## Camera routes and Experience coordination projections

Camera supplies the route, authored interior anchors, generated endpoints/samples,
pace/stations and evaluated timing. Experience supplies occurrence order and its
local station-bound beats/holds. The shell owns when the selected Seam and its
local strip are disclosed. This reference owns their spatial/linked visual grammar.

| Representation | Stable meaning |
| --- | --- |
| **Restrained Camera route line with pace cues** | Actual supported Camera path; not Guide order or a fabricated straight connection |
| **Operative authored-anchor mark** (filled diamond baseline) | Authored manipulable interior anchor on Stage |
| **Quiet derived-helper mark** (hollow/dashed baseline) | Derived/read-only sample/helper, not an authored anchor or bindable station |
| **View/end marker** | Camera View or generated departure/arrival endpoint, never a second authored endpoint anchor |
| **Event/beat marker** | Experience-owned occurrence event, visibly distinct from a Camera station even when aligned |
| **Hold bar with duration** | Occurrence-local hold, not a copied Camera timing track |
| **Gap cue** | Missing supported travel with reason/repair; never a line that reads as a valid route |

Filled diamonds versus hollow/dashed derived markers are the accepted baseline for
the anchor/helper distinction, supported by both the written diagram and repeated
QA. Preserve that operative-versus-derived distinction through shape/line treatment,
labels and eligibility in both projections. Exact silhouettes may vary in a feature
design that preserves equally clear species and consistent counterpart meanings;
the distinction is mandatory, a universal diamond gizmo is not. Radii, dash lengths,
tick counts, frustum tints and event silhouettes are not frozen. Triangle versus
circular beat marks do not decide event ownership.

Local route and coordination projections show corresponding stations and event
attachments. Named authored stations are distinct from generated samples. A selected
beat/hold highlights its corresponding location without replacing canonical selection
for mere task focus. Route editing stays on Stage; the local strip displays stations
and authors Experience coordination, never a second path. This is a representation
rule over domain references, not a new station-binding format.

Camera infrastructure uses the shell's cyan/teal owner role plus line/shape/labels;
active selection/manipulation adds ochre locally. Experience events/holds have distinct
species and information rows. Neutral Guide-order connectors do not migrate onto
Stage as Camera topology. Shared infrastructure remains distinguishable from this
occurrence's coordination without arbitrary per-feature colors.

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
- [Experience synthesis](../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md)
  and [Design-QAs](../../../prototypes/integrated-experience-authoring/Design-QAs/):
  observer/target relationship, Outside/Through precision, unordered spatial/schematic
  Sets, Stop pins, scoped route species and mirrored station/event/hold projections.
- [Landed visual specifications](./design-specs.md), [Camera graphics/input contract](../components/camera-tour.md)
  and [placement adapters](../components/placement.md): existing exact geometry,
  selection, hit arbitration and cancellation policies in their maintained contexts.

No universal orbit, gizmo, hit priority, all-values rig or new domain constraint is
introduced. Exact instrument geometry and domain-specific alternatives remain
feature design choices within the truthful and legible relationship requirements.
