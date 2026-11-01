# Museum Editor — destination shell and visual-system contract (PLATE)

> **Production shell Round 2 ratified by the owner (2026-10-23, PR #181).** The
> [production shell wireframe, Round 2](../../../prototypes/production-shell-wireframe/README.md)
> (reviewed at `9621b1cd`) and its departures D1–D16 are the authoritative destination
> shell and visual/interaction language. This document owns the promoted contract; the
> [ratification record](../decisions/production-shell-round-2-ratification-2026-10-23.md)
> owns each departure's disposition, the supersession map and the retained alternatives.
> Round 2 supersedes every conflicting earlier shell treatment: Conservatory (#114),
> Paper §0.8.4 and this document's own earlier composition. Conservatory's Experience
> semantics (Presentation, View, Guide, Stop, Cut/Travel, Camera ownership) are domain
> behavior, not shell design, and are unchanged. The wireframe is accepted visual and
> behavioral evidence; its mock mechanisms are not contracts. This ratification changes
> destination design, not production implementation or persisted formats.

**Status: owner-ratified destination shell authority.** This document is the complete
contract for new Museum Editor shell design: composition, disclosure, information
homes, material, typography, control hierarchy, state language and return behavior.
Future feature design extends this shell. A proposed shell change must identify and
justify the rule it changes; a feature brief must not casually reinterpret it.

The destination is **World | Experience over one project**. This is design authority,
not authorization to cut over the editor. PR #115 removed the earlier full authoring
shell and its descriptive composition contract. T1.P01.S02 restores a partial,
read-only Stage shell; it does not implement this destination composition. Later
tracks still need to build the unified shell against this contract. Prototype adoption
and production delivery have their own plans and acceptance gates.

| State | Meaning after Round 2 |
| --- | --- |
| **Accepted destination** | The Round 2 unified shell, promoted below: Head, scope-model Index, Stage, overlay Card and one lower column (dock → palette → Instrument); the rays-and-points manipulation vocabulary and mark language; the pointer-tool roster; Experience authoring in the same shell with the #114 Experience semantics |
| **Implemented production** | Partial read-only Stage shell from T1.P01.S02 and the landed T1 adapters (including the Dimensions instrument; the pointer rail is planned, not landed). The unified composition and its authoring behavior remain unimplemented; landed behavior is current until a consuming slice cuts it over (see the [ratification record](../decisions/production-shell-round-2-ratification-2026-10-23.md#cutover-and-landed-behavior)); this ratification itself implements no product UI |
| **Preserved semantics/architecture** | Domain ownership, Camera evaluation, validity, source history and isolation remain governed by their owners |
| **Deferred depth/refinements** | Feature-level decisions, retained alternatives and open usability problems are listed under [Open implementation and usability choices](#open-implementation-and-usability-choices-03--076); they are not unfinished shell gates. #115 plans parallel tracks; it does not implement them |

Read the shared shell, then the expression for the lens being designed. The visual
and return rules apply to both. For direct spatial work, also use the
[spatial-instrument grammar](./spatial-instrument-grammar.md) and the feature's
domain contract. Historical syntheses and QA are retained as
[design evidence](#design-evidence); compliance with this contract requires no
reconstruction of those rounds.

## Authority and invariants

Authority is **by concern**, not a ranking that puts shell design above domain truth.

| Concern | Authority |
| --- | --- |
| Shell composition, disclosure, information homes, material, typography, control metrics and state grammar | This document |
| Stage representation, handles/helpers, precision readouts, layering, hit legibility and correspondence between readings | [Spatial-instrument grammar](./spatial-instrument-grammar.md), consuming this document's visual/state roles and domain operations |
| Product direction and semantic ownership | [North Star](../north-star.md), [architecture](../architecture.md), the [ratified decision record](../decisions/northstar-ratification-2026-09-27.md) and its [World \| Experience refinement](../decisions/world-experience-reconciliation-2026-09-29.md) |
| Common identity, persisted units, channels, acceptance and release shapes | [F composition/execution](../composition-execution.md) |
| Domain validity, identity, Camera evaluation, persistence and history | Their routed [component contracts](../../README.md); shell exposure consumes their operations |
| Current implementation, delivery sequence and acceptance evidence | Landed contracts, active plans and QA in their respective scopes; none silently changes this destination |

World exposes Layout/Scene source truth, composition and intrinsic capability, plus
Camera inspection. Experience composes visitor meaning and occurrences and may expose
Camera authoring. Neither lens is a new semantic document. Layout owns architecture
and its runtime-safe representation; Scene owns objects and world presentation;
Camera owns Views, connectivity, routes, framing, projection and evaluation;
Experience owns Presentations, Guide occurrences/order, Cues and their pauses,
continuation and contextual orchestration. Typed resources remain independently owned.
The distinct LayoutDocument/SceneDocument encodings and the current frame/transform
contracts are unchanged. The ratified world-local placement with explicit internal
frames remains the destination; this shell ratification introduces no mandatory Room
frame or transform migration. The editor's Room-local conversion code was removed by
#115 with the editor shell.

The shell preserves these invariants:

- **One project and one continuous Stage.** Plan, 3D and focused spatial readings
  show the same world; a lens or reading change does not launch another application.
- **One canonical selection value.** It is one identity, or an explicit set where
  the domain supports sets. Stage, Index, Card, Find, Details references
  and both lenses resolve that value. There are no parallel lens selections.
- **Selection is distinct from task focus.** Keyboard focus, a technical host,
  component focus, a reference, a repair candidate and temporary geometry are not
  substitute selections.
- **One Camera/navigation authority.** Framing requests, reading transitions,
  navigation, route evaluation and spatial return use it. Shell surfaces do not own
  another graph, Camera history or independent pose/FOV interpolation.
- **One architectural compiler.** Drawing and contextual representation consume
  canonical Layout output; a shell reading does not reconstruct architecture.
- **Authored truth excludes session state.** Selection, armed tools, temporary
  inspection, proposal geometry, shell disclosure and reading settings are not
  serialized as source. Generated Camera endpoints and geometry stay derived;
  authored connection anchors are interior only.
- **One chronological source history**, tagged by owning authority and exposed with
  verb labels. Valid accepted commands/gestures produce one logical history result.
  Cross-domain acceptance follows F.4. Cancellation,
  navigation, spatial return and reading settings are not Undo.
- **Visitor isolation.** Preview is visitor execution with isolated session state;
  visitor/public-release chunks exclude editor selection, history, gizmos and
  authoring machinery. Runtime-safe domain evaluation is shared, not forked.

### One writable owner per fact (§2.12)

The visual host decides how a control paints; the lens/task context decides what
is exposed. Every writable fact has one exposed control owner. Another surface
may display it or open that owner, but must not mount a second writer. Mutually
exclusive postures may expose the same operation through a deliberate host gate.
A Card header and its body always describe the same canonical target, with each
property's actual owner made clear when relevant.

Reusing a component preserves its behavior and domain ownership, not its previous
layout grammar. Clear inherited layout rules that conflict with the new host;
verify the composed surface. New shell surfaces consume semantic material, type
and control roles rather than component-local numbers. A new role requires a
conscious system change. Fit and legibility constraints outrank obsolete numbers;
re-derive and validate a metric when its original context no longer applies.

## Shared shell (§0.8)

<a id="08-accepted-destination-shell--unified-world--experience-direction-2026-10-01-pr-111"></a>

World and Experience share Head, a collapsible Index, a dominant Stage, a contextual
overlay Card and one **lower working edge** that grows upward from a dock. Their identity
and hierarchy remain recognizable across lenses; Card, palette and Instrument are absent
when their context is absent. **The Stage is the workspace:** every other surface is
small, floats over the Stage or disappears.

```text
HEAD — ☰ app menu · project · World | Experience · active Experience · [location chip when the Index is collapsed] · Find ⌘K · Undo/Redo · saved · Preview
INDEX (collapses to nothing)   STAGE — dominant spatial work; reading control, Height Sheet (World), state pill
                               contextual overlay CARD
                               lower working edge, bottom up: DOCK → armed tool's PALETTE → invoked INSTRUMENT
```

| Landmark | Shared responsibility | World expression | Experience expression |
| --- | --- | --- | --- |
| **Head** | Persistent project/application context, lens switch, **Find**, save/history and Preview | App menu (viewing preferences, Settings, Keys), source-history access with verb labels, Find | Active Experience identity in context; the same app and project actions |
| **Index** | Where am I, and where is that thing? Locator and orientation, not a primary property editor | **Scope model**: one scope at a time with crumbs, sibling menus and kind facets; relation-aware contents | Presentations and relevant relationships, including Guide awareness where present |
| **Stage** | Continuous spatial truth, readings, spatial marks and direct manipulation | Architecture, objects, inspection, drawing and manipulation; reading control, Height Sheet, state pill | Camera View placement/framing, contextual paths and playback |
| **Card** | What is canonically selected, what does it mean here, and what owns/reaches beyond this use? The one writer for ordinary facts | Identity, editable facts, Look, scoped ⋯ list; advanced fields under More | One contextual inspector for the selected Presentation, View, subject, Stop, transition or path point |
| **Dock and palette** | Pointer tools: what the pointer does next | Select · Ink · Slice · Eraser · Brush · Measure, then Library | Select · Place a View · Path, then Capture and Guide |
| **Instrument** | Work invoked at the lower edge that needs room; selection identity stays in the Card | Library and repair only | One active **Guide context**, integrating Stop composition, Cut/Travel, path authoring and playback |

The wide shell has Index left and Stage as the working ground. Card overlays the
Stage edge instead of reserving a permanent inspector column. Opening/closing it
does not reflow or implicitly reframe the Stage. There is no empty Card at rest.
Selected identity remains legible or directly recoverable when the Card is closed
or compressed. **A collapsed Index takes no width** and its location moves into the Head
(or, in the retained alternative, a minimal edge arrow); collapse preserves location,
selection and access to its contents. Head stays compact; supporting surfaces do not
become equal dashboards.

The lower working edge is a shared composition principle, **not interchangeable task
semantics**. The World Instrument (Library, repair) is subject/task procedure. Guide
context is editorial composition, transition work and playback. One does not inherit the
other's control layout, vocabulary, dimensions or lifecycle. Both remain attached to the
shared shell and preserve Stage dominance.

### The lower working edge

The lower edge is one column. The **dock** sits at the bottom; the armed tool's **palette**
rises directly above it; an invoked **Instrument** rises above the palette. The palette
never grows sideways, and a tool never opens a second row of controls.

- **Dock and palette material.** Both use the dark forest Instrument material with thin
  white icons, so they read as one instrument over any Stage. The armed tool sits on a
  soft ivory key with a dark icon. Tool colour survives only as a 2 px mark under an icon
  and is never a state colour. Controls are icon-first with tooltips (name, key hint);
  palette controls carry no words at rest.
- **Arming.** Clicking a tool, its key or Find's Arm verb arms it. Arming never changes
  selection; what a gesture makes becomes selected. Tools stay armed until Esc or Select.
  A control that is not a tool, such as the Height Sheet, never arms a tool.
- **Palette collapse is explicit.** Clicking a tool arms it and opens its palette. Clicking
  the armed tool again collapses or reopens the palette, and a small collapse control at
  the palette's foot does the same. Choosing an option or drawing never closes it, and the
  chosen option is remembered. **Esc collapses the open palette before it disarms the
  tool.** A faint caret above the armed key says the palette is collapsed (the recommended
  cue; showing nothing is a retained alternative).
- **Instrument.** The Instrument appears because work is invoked, never because a selected
  subject has advanced capabilities. It is reserved for tasks that need room: the
  **Library** (objects, art, materials, lights, and import with Place or Trace), repair,
  and in Experience the Guide. Edit shape, Erase acceptance, Slice depth and Dimensions are
  not Instruments: they live on the object, at the gesture, in the state pill or in the
  Card.
  An Instrument never automatically moves the Camera or covers the reading control and
  drafting words; if it obscures its subject, its header can offer an explicit Bring into
  view. Do not hide an active spatial reading by switching away from its pill; resolve the
  task through its unwind/return rule.

### Contextual lower-surface span

The lower home has **one composition grammar with task-appropriate span**. Its
horizontal extent follows the information that must be read and worked on together,
not the lens name, technical complexity or number of uses affected by an edit.

- **Local work** stays attached to the central Stage working region and consumes
  the width its task needs. A Library placement, repair or source edit does not earn
  shell breadth merely by exposing advanced controls.
- **Breadth work** may use more of the Stage's lower working edge
  when horizontal order, neighboring comparison or linked relationships materially
  require that continuity. Long Guide composition is an example. Index and Card
  retain their meanings; width does not create a second instrument or change ownership.

A feature claiming breadth must show what information must remain simultaneously
legible, why a local span would fragment or cramp that relationship, and how the
composition preserves Stage dominance, canonical Card identity and the Index's
locator role. Edit reach alone is insufficient. A World task can qualify on the
same grounds, but no existing small World procedure is required to become broad,
and breadth creates no new domain authority or permanent workbench.

Owning a broad slot does not stretch sparse contents. Internal groups size from
their information; remaining space supplies separation and legibility. Keep span
stable within a task posture rather than jumping with hover, grip activation or
small content changes. A deliberate task/depth change can require a different span.

**The Guide instrument stays contextual and bounded**: recognizable Stop items,
transition controls and playback orientation, sized from the task, never a large
empty panel or permanent global bar (§0.8.1). The former full-shell Deck span and
mandatory separate Path/Journey lanes are superseded. After semantic span is decided,
crop, density and arbitration with the overlay Card,
exact dimensions and responsive thresholds remain implementation/usability choices.
They must preserve spatial memory and never imply Camera navigation.

### Persistent breadth and contextual depth

At rest, project/lens identity, useful orientation and Stage persist. Selection
has a consistent identity echo and an accessible Card, without an empty inspector.
Full Find and Index depth, recovery rows, Look actions, Details, task surfaces,
precision, repair and edit-reach disclosure appear when context or creator action
requires them. Capabilities do not earn permanent chrome simply by existing.

Head owns application actions, not a second task toolbar. Index locates subjects;
Card explains the selected identity; Stage carries spatial work; the lower surface
carries the invoked task. A feature must choose its home by that responsibility.

### Canonical identity and state

A selected identity is echoed consistently in its Index occurrence, Stage geometry
where applicable, and Card. A reference to it, an active task or an authored relation
must not masquerade as a second selection. Group headings and relation occurrences
are visually distinct from selectable entities; nesting is never ownership.

Names lead for named subjects. Compact references remain complete; names may ellipsize
under pressure with the full name available in the Card. Raw canonical IDs belong
behind Technical details. Repeated names are disambiguated by identity and location,
never silently matched. Explicit sets use one Card identity with count, kinds and
shared extent; they do not introduce another selection store.

### Card identity, owner, source and reach

The Card represents canonical selection, not the current tool, host,
inspection or task focus. Its identity header remains visible when the Card is open
and survives compression as a selected-identity control. It can describe related
facts without changing the header's target.

| Question | Meaning | Disclosure |
| --- | --- | --- |
| **Identity** | What thing or supported set is selected? | Persistent name/reference and kind |
| **Owner** | Which domain owns this property or operation? | Legible in semantic strata and at an ownership decision |
| **Source** | Where does this fact come from? | Details or the decision that depends on provenance |
| **Reach** | What does this particular proposed edit affect? | Before consequential acceptance; shared uses remain distinguishable from this use |

These facts are independent. A shared source may participate in local work; owner
or provenance alone does not announce edit reach. Do not coat every World field
with ownership glyphs. Experience may keep target and shared-use scope in its header
because shared meaning and occurrence-local work are central there.

An edit reaching beyond the current use invokes the **Ask Rule**: explain the
reach and require an explicit scope decision before acceptance. Offer shared update,
local specialization or a fork only where the domain actually supports it. A
scope prompt does not invent inheritance, placement overrides or fork semantics.

## World expression

World stays calm until creator action requires depth:

**Sketch or select → manipulate on the Stage → type in the Card → Look or Details →
an Instrument only for invoked procedures.**

The 3D world is the main workspace. Start simple, draw naturally, manipulate directly
and reveal precision and complexity progressively.

### Direct manipulation: rays and points

Objects, walls, openings, platforms, roofs and the Slice share one manipulation
vocabulary, defined in the [spatial-instrument grammar](./spatial-instrument-grammar.md#rays-and-points):
a thin dashed white line says "a transformation is available here", a small open
arrowhead says which way it drags, a small white point is an anchor, and the live value
appears **only on hover or drag**. Gold disks, XYZ gizmos and permanent W/D/H text are
retired. The shell requires:

- **Progressive size by default.** Width, depth and height appear when the creator clicks
  the scale point; an always-shown alternative is retained for close-range work, and a
  zoom-dependent rule (rays shown when the subject is large enough on screen) is a
  permitted later refinement. Handles never stack into unreachable targets at overview
  zoom.
- **Support-aware change.** Resizing keeps an object's base on its support and grows
  height upward; things resting on it ride along and settle when their support goes.
  Nothing is blocked by category, imported assets included; the live tag names the verb
  (for example "Height 1.10 · base stays"). Which fit behaviour a given object kind has
  is a Scene-domain and feature decision.
- **Admission by domain.** A handle exists only for an operation its owning domain
  supports. The shell does not admit a wall-curve, thickness, sill or eave handle that the
  domain cannot evaluate (grammar: [affordance admission](./spatial-instrument-grammar.md#spatial-truth-and-affordance-admission)).
- **The Card types the same fact.** Dragging expresses intent; the Card field writes the
  same fact with the same refusal (see [Card facts](#card-facts-and-the-one-writer)).

The earlier absence of a detailed 3D object-authoring design is closed at the level of
vocabulary and shell composition. The Scene
[transform and validation semantics](../components/scene-content.md) remain the kernel
contract; the editor-side adapters removed by #115 are re-established in the consuming T2
slice with T1 Stage integration, each admitting only handles its domain supports.

### Ordinary World and the Context Index

Ordinary World answers where I am, what surrounds the subject, what is selected
and how to reach elsewhere. It shows a useful project/location path, nearby
relation-aware context, Find and the Index, a minimal identity Card and the world.
Source/use counts, component trees, attachment detail, precision, cross-lens
references and specialist machinery are not permanently exposed.

**Scope model.** The Index shows one scope at a time (structure, Level, room) as a crumb
path whose segments open sibling menus, with kind facets that flatten a scope ("every
object on First floor"), capped lists with Show more, and a room's contents in groups. It
scales to dense projects (many structures, Levels, rooms, walls and objects) without
teaching a fabricated containment model. It is a navigation projection of Layout and
Scene: it never changes ownership, and an outline tree is not the Index.

Within a room's contents, the Index uses only non-empty relevant groups such as **Bounds, Openings on bounds,
Located here, Overlays, Attached here**. A Wall may bound several Spaces; an Opening
is hosted by a Wall; an object may merely be located in a Space; a Zone may overlap
Spaces. Location, indentation, ownership and source identity remain distinct.

Browse exposes wider project breadth without changing selection. If the selected
subject lies outside the browsed context, show a conditional **Selected elsewhere**
recovery row with identity/location; there is no permanent selection pin.

### Find

**Find** lives in the Head (⌘K or Ctrl+K in the wireframe, production key map open; reachable from anywhere, including while a field has
focus) with live grouped suggestions. One door reaches subjects, places, tools, readings
and commands, and every result states its verb, so selecting is never confused with going:

| Verb | Effect |
| --- | --- |
| **Select** | Change canonical identity only; scope and Camera are untouched |
| **Go to** | Open that place in the Index and request framing through Camera; an explicit navigation request |
| **Show** | Present a reading, an Index filter or an available temporary inspection |
| **Arm** | Arm a tool; selection unchanged |
| **Do** | Run an action from the selection's scoped list (the "For …" group) |
| **Run** | Run a command or open a procedure |

Matches in the current scope rank first; subject overflow hands off to the Index filter
with its query, never a second result list. Actions operate on their own result;
navigation, location and inspection need no prior selection. Selecting a result never
silently moves the Camera or activates inspection. A result can be outside the frame,
behind opened architecture or otherwise hidden without becoming invalid or replacing the
selected identity, and its row explains why (hidden, off-screen, behind opened
architecture). Find lists capabilities and subjects but never selects by being opened or
browsed, and opening it never moves the Camera. Every capability registered
under [capability placement](#world-authoring-084) is findable here.

### Look, Details and invoked tasks

**Look** is a capability-driven door into spatial procedure for the selection/context.
A curved Wall may offer Face, Unroll or Section; a Ceiling Lift or Look up; an Opening
Face host or Section through here. A subject with no useful spatial reading needs no
Look affordance. Look appears as icons at the foot of the Card and in the scoped ⋯ list;
it is shell interaction, not a world entity or a Camera object.

**Details** exposes identity, source, composition and relationships. Its verbs are
explicit: **Expand** reveals information, **Focus** deepens task context, **Select**
changes canonical identity, and **Open task** invokes specialist work. Entity names
alone do not secretly select. Source uses, internal components and attachments retain
those distinctions. Do not fabricate selectable component identity where the model
only supports internal task focus.

Invoked work has three homes, chosen by what the work is:

| Work | Home |
| --- | --- |
| Pointer work with an immediate result (draw, slice, erase, paint, measure, manipulate) | Dock tool, its palette, Stage marks and the Card; no Instrument |
| A **temporary reading** (Slice, Section, Face, Unroll, Lift, Focus, Look through, Edit shape's roof-local section is a reading-control segment, not a pill) | A **state pill** on the Stage naming the reading, its few controls and **Put back** |
| A procedure that needs room, steps or validation (Library import and placement, repair; in Experience, the Guide) | The Instrument |

A temporary reading and its pill activate and deactivate together; there is no active
Unroll, Section, Reveal, Lift or Slice whose pill is hidden. The pill or Instrument names
the task and its technical target, including when that target differs from selection: an
Opening stays selected while its host Wall is unrolled; an object stays selected while a
component is task focus. Non-spatial component or repair work uses the Instrument without
becoming another composition editor. Precision deepens the current task; it is not an
application mode.

### Temporary readings, precision and refusal

Temporary readings show the same source under a changed reading, retain an as-built
relationship and visibly explain temporary state. They must not look like duplicated
geometry, authored displacement, deletion, damage or visitor behavior. Labels explain
legibility honestly, including which axes are to scale or foreshortened. Exact model
values remain exact regardless of the current projection. Temporary readings are never
source; the near-wall cutaway, X-ray overhead and Focus height are viewing state.

The [spatial-instrument grammar](./spatial-instrument-grammar.md#direct-manipulation-and-precision)
defines truthful handles, active/read-only emphasis and readout placement. The **Card**
supplies the non-pointer precision writer; it is not another selection or an excuse to
expose duplicate writers.

Refuse invalid edits locally with the proposed value, reason and useful correction
where available. Accepted geometry remains visible; refused proposal geometry is
separately transient. Do not clamp silently, commit then roll back, add history noise,
clear selection or obscure the writer. Corrections are deliberate actions, never
automatic repairs. Only valid acceptance creates the logical source edit.

### Shared source and repair

Owner, Source and Reach appear where the proposed operation needs them. For a source
finish change, the Ask Rule's scope decision names the source, selected use, affected uses
and acceptance scope where the edit is made (the Card, an acceptance bubble or the
Library) while the Card keeps the placed object selected.

Broken relationships are discoverable with a proportional parent warning. Repair
machinery appears on invocation and distinguishes selecting the broken entity, focusing
it as a task, previewing a candidate and changing the relationship. Show missing identity
honestly; offer deliberate host selection, detachment or leaving unresolved where
supported. Never match by repeated name, proximity, nearest object or apparent containment.

### World authoring (§0.8.4)

<a id="084-world-paper-authoring-destination"></a>

Round 2 owns World authoring's tools, palettes, Card, readings and precision. The Paper
proposal's rail, pointer families, Dimensions ladder step and status cluster are
superseded where the [ratification record](../decisions/production-shell-round-2-ratification-2026-10-23.md#supersession-map)
says so; its domain rules (Wall roles derived from geometry, host preference, capability
placement, the Ask Rule, refusal in words) survive below. PA0–PA12 is an inactive
prototype plan, not the next work mandate. The original
[Paper proposal](../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md)
keeps its rationale and specimens as written.

The 2D reading is a reading of World's one Stage: floor plan, or a wall laid flat through
Face/Unroll, drawn as paper or shaded by an application viewing preference. It is not
another lens, document or workspace with independent state. It draws Layout and Scene and
owns no source data. Reading settings are view/session state, never source or Undo.

| Region | Responsibility |
| --- | --- |
| **Head** | App menu (viewing preferences including paper or shaded, Settings, Keys); lens switch; Find; Undo/Redo with a verb label; save; Preview. No separate history-list panel |
| **Index** | Scope-model locator and Browse. No tools, measures, capability search or task state |
| **Stage furniture** | Reading control (2D \| 3D with a ▾ for the rest), the drafting words, the scale bar, the Height Sheet and, while a temporary reading is active, its state pill. No World status rail or persistent message band |
| **Dock and palette** | What the pointer does; never facts, procedure steps or Apply |
| **Card** | Contextual overlay: identity/name, kind, editable facts, a condition only while true, Look, scoped ⋯ list and More; no permanently allocated column |
| **Instrument** | Library or repair, one at a time; no subject-results browser |

**Permanent pointer tools.** The dock is **Select · Ink · Slice · Eraser · Brush ·
Measure**, with the **Library** beside it. A tool needs a distinct pairing of pointer
target and gesture result, must be armable with nothing selected, and must find its own
target or refuse in words. Frequency or familiarity never earns a slot. Variants stay
inside the tool's palette; a new permanent slot needs an owner ruling.

- **Select** picks and manipulates. Dragging a legible mark pulls the fact it addresses;
  empty-Stage drag orbits or pans per reading.
- **Ink** is the one Pen: palette options Sketch · Line · Box · Round. It reads the surface
  it lands on (ground, a raised sheet or a wall face; Tab re-reads in the same undo step)
  and the stroke. Open chains read quietly. A **reading chip** appears only for an
  ambiguous closed stroke, states the reading before anything is committed, and offers the
  next readings in order (for example Room, Raised platform, Walls only; on a raised sheet,
  Deck, Canopy roof, Walls on this height). Readings are limited to what the owning domains
  support; the chip never offers an operation a domain lacks, and Rooms stay derived.
  **Shape** is one more reading on the chip: an ordinary editable outline object in Scene
  that its height ray pulls into a solid; Scene decides whether and how a Shape is stored, and no format is implied. There is no Object Pen and no category chosen
  before drawing. A circle on a wall face is read by the wall (a round opening) without a
  chip. A future smarter Pen only improves the first reading and the chip order; it keeps
  the one-undo-step re-read, never commits an interpretation silently across domains, and
  never becomes a second tool. A temporary **Shape intent** toggle in the Ink palette is a
  retained alternative.
- **Slice** has two modes: a horizontal cut at the Sheet height (pill "Cut at h · depth", no Section or Face) and a drawn vertical Slice, which is drawn like the Pen: a finite straight segment with a start and an end, a
  45° soft snap and a live length tag, previewing a translucent yellow plane and depth
  volume that cuts only within its extent. End points redraw the line, the line moves it,
  and a depth ray sets how deep it reads. Its state pill (depth · Flip · Face · Put back)
  appears while the cut exists; Section and Face apply to a drawn Slice only. Slice is **temporary inspection**: never source, always
  with Put back. Section and Face the cut are readings of the same Camera, available only
  while a slice exists.
- **Eraser** erases a click at once with Undo. Scrub and lasso mark things in red dashes;
  one **acceptance bar** beside the gesture applies or cancels. A **filter disclosure**
  (a funnel in the palette: "Erase only", a kind grid and "Erase every kind") limits
  kinds; an active filter shows a badge on the funnel and on the dock key, a "leaves out …"
  line in the bar and a hint tag when a filtered kind is touched. Erasing, per the owning domains, sets hosted
  things aside, lets derived Rooms follow their walls, leaves roofs as repairable loose
  ends and names Experience references without re-pointing them. A **bubble** asks only
  where consequences cross domains; up to three simple things go at once. Topology
  consequences are named in the toast and are one undo away.
- **Brush** is a permanent tool: one swatch of colours and materials, a dropper, and a
  face or whole-room scope. A change to a shared source follows the Ask Rule.
- **Measure** produces temporary heights and distances (angles when a feature needs them), not authored annotations.
- **Library** holds objects, art, materials, lights and import with Place or Trace. It is
  an Instrument, opened from beside the dock or Find. A placed item dispatches to Layout or
  Scene ownership and seeks eligible hosts where it needs one.

Tools stay armed until Esc or Select. Arming never changes selection; what a gesture
makes becomes selected. A palette contains only defaults for the next thing, never
existing facts, procedure steps or Apply.

**Walls and hosts.** Ink authors Walls, not a preselected boundary/division/free-standing
role. Layout derives and explains the resulting role: enclosing Walls bound; a Wall
that encloses nothing is free-standing; a Wall across an enclosed Room divides it and
produces derived Room topology. Preview that role at the gesture and describe it in
Card/Index relations. Role changes follow geometry, never Make-bounding or
Make-free-standing commands. Rooms remain derived; no Room geometry becomes editable.
Divide room remains a findable procedure using Wall authoring and consequence planning.
The [Layout ownership contract](../architecture.md#ownership-current-source-of-truth)
owns the encoding cutover and its remaining migration choices.

An Opening is cut in an eligible host's coordinates by Ink on a wall face or by a Library
placement. Joining Spaces may be a consequence, not its definition; a niche need not
connect Spaces. Opening and hosted items seek eligible hosts, project onto host axes, name
host classes and refuse ineligible hosts in words. With a host or one of its Openings
selected, the selected host is preferred and wins ties. Preferred host is task focus, not a
new selection. Tools remain armed between hosts.

**Height Sheet.** The Sheet is a thin vertical slider docked on the right (it can swap
sides) that answers "at what height". It never owns Layout's datums; it shows them. Its
ticks tell three things apart: **Levels** (long, structural, authored), **found surfaces**
(short, on qualified horizontal tops) and **pins** (round, manual working checkpoints that
are never Levels). Labels appear on hover or drag and the snap name shows while dragging.
A pin is placed from the knob, with a one-time hint after the first raised surface. A
Level is created only by an explicit action, never inferred from a surface or a pin.
Raising the Sheet arms nothing. Under Focus, the Sheet's plane is drawn as an outline
instead of a tint. Whether pins persist is a domain decision; until one is made they are
session state.

**Reading control.** **2D | 3D** is the primary segmented control. Behind a ▾ sit eye
level, elevations, projection (axonometric or perspective), roofs-from-above and Lift.
Section and Face the cut are offered only while a slice exists, so Section is never a
disabled item. The reading, appearance and projection are separate settings over the one
Camera. Overhead authoring uses X-ray, and while the creator works inside a room in 3D the
near-side walls are cut away and click-through, sparing the selection's own host wall. Both
are viewing state, with no Camera change.

**Edit shape.** A roof's profile is edited directly on the roof, in a roof-local section
drawn on it with white joint points, small midpoint **＋** marks and a gold profile, with
exact joint values in the Card. While editing, the reading control becomes **3D | Section**
(`1` and `2` in the prototype): Section is a roof-local reading of the same Camera, with
the same selection, profile, history and Done. It is not the floor plan and not a second
roof model. A floating section editor over the 3D Stage is a retained alternative.

**Capability placement.** Capabilities register id, label/synonyms, family/form,
subject/host kinds, owner, consequence class, precision schema, legibility, order and
key. Placement follows that description, rather than a feature hand-placing chrome:
unchanged source means a reading/app setting; pulling already legible geometry means
marks and tags; a new pointer grammar requires permanent-tool admission; a chosen
subject gives contextual capability; steps, multiple parameters, validation,
consequences or Apply require an Instrument procedure. Every capability is also
findable in Find. This is a placement rule, not a persisted-format schema.

<a id="card-facts-and-the-one-writer"></a>

**Card facts and the one writer.** The Card is the one writer for ordinary facts. The name
is writable; ordinary dimensions (length, angle, width, depth, height, offsets and the
like) are editable fields in place, with refusal shown inside the field; advanced fields
(for example Wall thickness) sit under **More**. Each settled fact has one Card field.
Marks write the same fact with the same domain refusal; during a live gesture the gesture
owns its transient parameter and the corresponding field only displays it until the
gesture ends. Dimensions stay owned by their domain: Layout for walls, openings, roofs,
rooms and Levels, Scene for objects and art. The Card never holds tool state and nothing
on it arms a tool.

Other facts are doors to their owner: a derived fact opens Details, and a true condition
offers Repair, Resume or Bring into view. A supported kind change sits on the kind fact
itself; a Wall role has no kind chooser. Look icons sit at the Card's foot. Other subject
actions live in one fixed-order scoped list shared by Card ⋯, the context menu and Find's
**For …** group; usage never re-ranks it. *In Experience* appears only when something
uses the subject. The Card has no wide editing posture and no Dimensions Instrument.

**Precision ladder.** Precision remains invoked:

1. **Direct:** drag a legible mark, with snap marks at the snap point. Valid release
   commits one undo step; invalid release cancels with none.
2. **Read:** the live value tag accompanies the gesture (hover or drag only).
3. **Type at the gesture:** digits turn the live tag into numeric entry. Commit once;
   Esc restores the transient value, then cancels; blur never commits.
4. **Card:** every settled writable measure of the selection, with units, keep-anchors and
   refusal at the field, and More for advanced fields.
5. **Procedure:** parameters, validation and consequences accepted on Apply, in an
   Instrument. Reserved for work that truly has steps, such as import.

Each accepted field edit or procedure produces one undo step. Undo/Redo is
unavailable while a proposal/gesture is live and says why. Options needing several
source changes wait for an atomic composed plan, never several disguised undo steps.
Supported sets expose Align/Distribute through the Card and its scoped list.

Pulling legible geometry is done on Stage, not through Move/Rotate/Scale commands.
Every move validates. Topology-changing gestures preview consequences and commit
once on release without an Apply interruption. Cautions/refusals stay near the
pointer or field that caused them. Expand a consequence disclosure only when earned:
other identities created/retired, splitting/merging, changed membership or
connectivity, another level, or changed resolution of Camera/Experience references.
Use **Creates · Keeps · Splits · Moves (derived) · Connects · Elsewhere · one undo
step**, with read-only counts from owners, in the acceptance bar or bubble beside the
gesture. Focusing a consequence row emphasizes that identity as view-only; selection
stays unchanged.

**Drafting state.** **Grid · Snap** remain legible beside the 2D | 3D control. Off
states are named words struck through, not color alone. Grid and Snap are fixed values: 1 m minor and 5 m
major lines, and a 0.5 m free-point increment. Zoom never changes either value; it
only thins the drawing. A held snap-suspending modifier is reflected in the word. Scale
is a reading rather than a toolbar word: the Plan ruler carries it, Scale detents live
in Find, and zoom in, zoom out and Fit form the lower-right cluster. A fourth
drafting-state word needs an owner ruling: admission requires changing how a distance
reads or where the next point lands. No messages, hints, history, tool state or motion
settings belong in that cluster. Grid is one fact across 2D surfaces; on a wall laid
flat it is Wall grid, and off reveals real wall material under the
[paper rule](#material-and-working-surfaces-44). Viewing preferences (2D appearance,
Height Sheet side, reduced motion, motion speed) stay in the app menu's Viewing and
Settings groups. A later grid or snap preference has one named seam to extend; the word
**Sheet** now means only the Height Sheet. The World status rail is retired.

**2D | 3D continuity.** The switch requests a tilt through Camera about the current
target, keeping scale. 2D settles azimuth to the nearest 90° detent; 3D returns
to the last working elevation, not a remembered pose. It never refits, retargets,
rescales, changes lens or creates another viewport state. Selection, Card, Index,
armed tool, open work, history, grid and snap survive. A reading flip continues work;
it is not a lens crossing.

Keys, exact geometry, prototype mechanisms, fixture values and new domain schemas
are not fixed by this contract. The wireframe's key map is evidence; the production
keymap belongs to its planner.

## Experience expression (§0.8.1)

<a id="081-finalized-experience-shell-expression"></a>

**Ratified 2026-10-13 (#114), shell re-based 2026-10-23 (Round 2).** Conservatory's
Experience semantics below are unchanged; its chrome, layout and visual treatment are
superseded by the Round 2 shared shell. The earlier V2 reconciliation, UX0–UX7 plan and
UX3/V3 proposal remain [historical evidence](#design-evidence), with their original
rationale and Git provenance. Their inspector/Deck layouts and PNG boards no longer
direct design.

Experience authors visitor meaning and occurrences in the shared shell. Camera
owns Views, framing, projection, connectivity, path geometry and evaluation;
Experience owns Presentation use/roles, Guide composition, Stops, holds and
continuation. Selecting a View, Stop or related subject does not move the Camera.

| Concept | Preserved contract |
| --- | --- |
| **Presentation** | A reusable visitor-facing composition about subjects, a region or the environment; not a Scene container or Camera target |
| **View** | A Camera composition used by a Presentation. Camera owns the composition; Experience owns its use and Default/entry role |
| **Guide / Stop** | An optional Guide orders distinct Stop occurrences of Presentations. Repeated visits may differ without changing the shared Presentation |
| **Transition / Guide edge** | Experience continuation with Cut/Travel policy, resolving the actual destination; it references Camera support and owns no movement geometry |
| **Camera Path** | Camera-owned movement support between Views, with generated endpoints and authored interior connection anchors; reusable independently of Guide order |
| **Coordination / Cues** | Experience timing, actions and pauses evaluated over Camera movement. They author no pose, route or second animation model |

View relationships, Guide order, Camera connectivity and invocation time remain
distinct. The prototype's arrays, path keys, fixed glide durations, View field
names and storage locations are not format decisions. F owns common persisted
and cross-domain shapes, with exact interfaces ratified alongside first consumers.

### Information homes

**Stage carries spatial work, Card the selected identity and its contextual
operations, and the invoked Guide instrument composition and playback.**

| Context | Stage | Card | Task instrument |
| --- | --- | --- | --- |
| **Empty / ordinary Experience** | The world and useful orientation; no assumed active Guide | Absent without inspection context | Absent until invoked |
| **Presentation / View** | Truthful Camera markers and direct spatial manipulation where supported | Presentation thumbnails/Default/uses, or selected View image and Look through/capture operations | An already-open Guide may remain available |
| **Scene subject** | Its own geometry and canonical identity | Subject identity, deliberate Present this and usage; deeper capability on invocation | Existing context stays distinct from selection |
| **Guide / Stop** | Relevant entry Views and context, with visibility disclosure | Selected occurrence, included Views, holds and continuation | One active Guide: Stop sequencing, transitions and playback |
| **Transition / Camera Path** | Evaluated path and direct editing of authored interior points | Movement policy, Camera reach, selected point or repair | The same Guide context; no mandatory topology/Journey workbench |
| **Look through / Follow** | The evaluated Camera image, with an explicit authoring exit | Only relevant identity/actions; composition remains reviewable | Playback uses the same invocation and clock |
| **Preview** | Isolated visitor execution | — | — |

### Head and Index

Head retains project/active Experience context, World | Experience, Find, source
Undo/Redo and Preview. Find reaches Presentations, Views, Guides, tools and commands with
the same verbs as in World; Head is not a second task toolbar. History remains
chronological and labelled by source action; the prototype's snapshot Undo is not promoted.

Index locates Presentations, their Views and Guides, with progressive disclosure
and search for dense collections. It collapses to nothing without losing selection or
location, leaving a Head chip. A Guide's open-context indication is distinct from selected
identity. There is no permanent Scene inventory or property editor; Stage and the shared
World locator provide subject reach. Context links explicitly Open or Select
their target; the Card's context remains canonical selected identity.

The Experience dock is the same lower-edge column as World: **Select**, **Place a View**
and **Path** (available while a Guide is open) as pointer tools, then **Capture** (what you
see becomes a View) and **Guide**, which opens the Guide instrument. Look through adds a
gold capture frame; Preview is a takeover. The height Sheet is not shown in Experience;
whether View placement needs a working height is open.

### Presentation, Views and Default View

Creation starts from a subject through **Present this**, or from a composed
standpoint through the Experience creation action. Both create the same concept;
there are no mandatory object/environment/region species. Plan authoring makes
View placement and aim deliberate; it never silently captures a drafting reading
as a visitor image. Exact labels and capture gestures may be refined in delivery.

Presentation authoring leads with **thumbnails and direct capture**. Its Views
stay discoverable and comparable under density; a keyboard inventory and contextual
filtering may support the visual collection. Display order does not imply Guide
order or Camera connectivity. Default View is an explicit shared entry role;
Stop-local inclusion/order does not silently change it. A Presentation without
Views, an unset Default and a missing View reference remain distinct honest states,
rather than being removed to match a prototype fixture.

A View is composed spatially: place/aim the Camera, look through, compose visually,
then deliberately **Update View or Exit**. Selecting a thumbnail/marker selects
identity only. Look through enters an authoring Camera context; unaccepted changes
are provisional. Update accepts a validated Camera edit with its actual use/reach
disclosed. Exit/Esc discards the provisional edit and returns through Camera to
the authoring reading and standpoint. Source Undo and spatial return stay separate.

**What the creator sees through the Camera is what the captured View represents.**
The reviewed capture frame, saved framing/projection and thumbnail agree about
the composition, including aspect. Authoring helpers are distinguishable from
visitor content. Card/instrument occlusion must leave that frame reviewable.
Production must establish this through the real Camera and rendering contracts,
rather than adopting the prototype's canvas resizing or extra WebGL contexts.

Removing a Presentation use or View discloses Default, Stop and movement
consequences. It does not delete Camera truth used elsewhere or silently choose
a replacement. Shared updates follow the Ask Rule.

### Scene subjects

Stage is the ordinary spatial subject browser. Shared Find and the Index also reach
hidden, off-screen, logical and keyboard-only subjects through canonical selection;
Bring into view is a separate Camera request.

Subject identity, deliberate Presentation creation and **Used in Experience**
precede deeper capability. Behaviors, visitor offers, audition and configuration
are invoked contexts, not permanent control inventories. Subject selection,
Presentation selection and task focus remain distinct. Existing valid capabilities
are preserved even when the prototypes do not demonstrate their full depth.

### Guide, Stops and Guide edges

**A Guide is an invoked authoring context, not a permanent global bar.** It opens
deliberately from a Guide or relevant composition action. There is **one active
Guide context at a time**. It may stay open while inspecting/editing related
Presentations and Views; a selection change alone does not dismiss it or select
the Guide. Closing it ends its instrument, playback and Guide-only Stage helpers
together. Stored Guides remain authored truth.

The instrument integrates recognizable Stop items, reorder/insert/repeat/remove
operations, Cut/Travel, Camera Path access and playback. Long Guides retain
orientation, reach and practical sequencing without requiring another Guide
editor. Horizontal scrolling and overview-timeline presentation remain refinable.

A Stop visibly **visits a Presentation**. Its included Views, occurrence-local
sequence/entry and holds can differ from another visit; editing them preserves
the Presentation's Default and other occurrences. Concrete encoding, legacy
entry-policy migration and first-consumer interfaces belong to T3/F planning,
not the mock shot-list structure.

Continuation resolves actual Experience semantics. Guide order may supply its
default, but accepted explicit continuation, Gates and visitor choices are not
abolished by the mock's simple Next rule. A nonadjacent destination, End, gap or
needs-repair is named honestly. A connector represents adjacency only when the
resolved destination is that neighbor. Changing entry/exit Views re-resolves
Camera support and discloses changed reach/gaps; it does not drag an unrelated
path into a new relationship.

**Cut** performs no Camera travel and creates no movement geometry. Existing
Camera support remains independently inspectable/editable where supported; Cut
does not delete it or transfer its ownership. **Travel**
uses Camera-owned support; reuse, preparation and gaps follow Camera/domain
validity. Experience does not reconstruct routes from Stop tiles.

### Camera Path and Journey postures

The accepted destination integrates path authoring and playback into the Guide
context. The former separate Path topology and Journey Decks remain historical
functional evidence, not required new workspaces.

**Direct path editing happens on Stage.** Show evaluated movement geometry,
truthful View endpoints and authored interior points. Insertion is a deliberate,
legible operation; selection and empty-space clicks never secretly author geometry.
Dragging/removal validates through Camera and discloses affected uses/coordination.
Generated samples and endpoints are never a second authored anchor set.

**Play, pause, scrub and Follow** read one invocation through Camera evaluation.
Outside observation may show an evaluated Camera marker; Follow looks through
that same Camera and exits to the prior authoring standpoint. Playback/scrubbing
writes no source. Timing incorporates Experience holds over Camera movement,
not a separate Guide animation. Editing geometry and playback must have an
explicit lifecycle, rather than leaving a stale clock running over changed source.

Guide context and selection control Stage visibility: relevant Views, paths,
frustums and labels appear progressively; ordinary work does not display every
Guide route. Visibility is editor session disclosure, not authored Camera truth
or visitor behavior. Hidden context cannot make the active operation unreachable.
Exact Selection-only behavior and visibility defaults are refinement opportunities.

### Camera View precision

Visual Camera manipulation and Look through are the ordinary authoring path.
Existing legal Camera precision, Outside inspection, supported Plan operations
and recommended framing remain capabilities under the
[Camera framing grammar](./spatial-instrument-grammar.md#camera-framing-instruments).
Their advanced exposure is deferred; numeric precision is not forbidden by the
prototype's simplified lens/height controls. No new constraint, orbit or evaluator
is inferred from a grip or specimen.

### Advanced authoring

Narration/captions, behaviors, offers, automatic View changes, Gates, branching,
mid-route coordination and richer precision retain their domain semantics and
useful regression evidence. The prototypes demonstrate a minimum authoring loop,
not their removal. Their interaction depth needs future track slices; it does
not reopen the accepted shell or become an unfinished #114 design gate.

Existing Cues retain station-based binding through Camera support; the mock's
suggestion to drop beats at a time does not authorize authored seconds, arbitrary
scripts, a Cue entity/schema or a new timeline. Deep authoring must fit invoked
contexts and the single-writer/ownership rules.

### Visitor Preview

Preview runs the visitor experience with isolated session state and no editor
machinery. Guided and free exploration use the same authored world,
Presentations and Camera Views through their owners. Their exact entry,
availability and return policies require domain planning; prototype switches
and end-of-tour behavior are not automatically ratified semantics.

Visitor controls use visitor meaning, with an obvious Exit Preview. Preview exit
restores the authoring context through its authorities. Look through and Follow
remain authoring contexts and do not impersonate visitor execution.

### Experience visual language

Both lenses use the same material, mark language and state roles from the shared visual
grammar: forest framing and instruments, ivory armed keys, gold selection, white
available-transform marks and neutral working surfaces. Thumbnail-led authoring, light
Stop items within the dark Guide context, quiet spatial context and progressive disclosure
provide one coherent application. World-specific tools keep their own procedures within
this language.

### Experience design acceptance

The [Round 2 wireframe](../../../prototypes/production-shell-wireframe/README.md)
(its **Author an Experience** tour and Experience journey) supplies the visual and
interaction acceptance language for Experience in the shared shell. Conservatory's
scenarios below remain the reproducible Experience *scenario fixtures* (what to
reproduce), including the 20/50-View and 15/30-Stop stress cases Round 2 does not
rebuild; Conservatory's chrome, layout and visual treatment are superseded. Reproduce
states and assess interaction outcomes; screenshots can support review but do not
establish pixel/layout equivalence.

| Reproducible scenario | Expected UX |
| --- | --- |
| **Empty Experience** — prototype scenario menu | A clear creation door, useful Stage, no empty Card or assumed open Guide |
| **Presentation/View authoring** — select/create a Presentation, place/capture a View | Thumbnail comparison, explicit Default/use, spatial Camera composition and deliberate capture |
| **Dense View collections** — 20/50-View and many-Presentation scenarios | Find/inspect every View without losing selected identity or spatial context; counts are stress fixtures, not product limits |
| **Guide closed/open** — open from Index, inspect a related Presentation/View, close | One active context; it stays available during related work and dismisses its own playback/helpers together |
| **Long Guide composition/playback** — 15/30-Stop scenarios | Sequence/insert/revisit/reorder with orientation; Cut/Travel and scrub/Follow use the same Camera evaluation |
| **Look through and Camera return** — enter from Plan/3D, compose, Update or Exit | Reviewable capture frame, explicit acceptance/discard and correct authoring return; selecting alone never navigates |
| **Stage visibility** — Show controls with/without an open Guide | Quiet context and reachable active geometry; toggles change disclosure only |
| **World/Experience continuity** — switch with a World subject selected, arm Measure | Shared shell/identity/Camera, distinct World tools and Experience composition; no inferred capture |

The owner accepts the prototypes despite Camera visibility edge cases and
Selection-only behavior. Guide horizontal scrolling, overview timeline, Card
positioning, responsive density and aesthetics are **non-blocking refinement
opportunities** for production. They are not unfinished ratification gates.

### Experience QA boards

The [UX3/V3 generated PNGs](../../../prototypes/experience-ux-v3/README.md) and
[earlier Design-QAs](../../../prototypes/integrated-experience-authoring/Design-QAs/)
remain superseded rationale/specimens. Their acceptance wording is historical;
none defines current acceptance through pixels, layout equivalence or mandatory
old information homes. Existing functional QA remains useful for selection,
history, Camera/Experience ownership, cancellation and visitor isolation.

## Visual and state grammar (§0.7)

<a id="071-authority-and-evidence-for-the-destination"></a>

The product character comes from structure, material, type and interaction:
professional spatial work with forest-green framing, neutral working surfaces,
gold attention, restrained technical ink and compact controls. Rich capability gathers around the current
question instead of making every region louder. Plan and 3D retain the same visual
system; alternate themes must preserve its hierarchy and semantics.

### Material and working surfaces (§4.4)

PLATE has exactly three material classes; a task name is not a new material class.

| Class | Role |
| --- | --- |
| **Chassis** | Shared frame: forest Head, quiet neutral Index and contextual light Card; identity and orientation separated by alignment, hairlines and tonal steps |
| **Paper** | Spatial Stage, expressed as dark **cutting mat** for model/depth work or light **vellum** for measured drawing; top-down and flat readings render as paper or shaded by an application viewing preference |
| **Instrument** | Controls acting on the work: the dark forest **dock and palettes** with an ivory armed key, the forest task surface of the Library, repair and Guide, neutral working items and restrained edges |

The mat gives depth, artwork and geometry a dark ground, with a Paper surface around the work. Vellum makes measured
architecture the drawing subject. Ink and ochre are mark/state roles, not additional
materials. Section, Unroll or precision can use a measured vellum reading without
creating another shell. A camera route on Plan uses the same Paper as World drafting;
Experience does not invent a separate theme or drawing surface.

A 1 CSS px inset perimeter separates Paper from chassis without reducing the canvas
rectangle or changing Camera aspect, pointer mapping or overlay coordinates. It
intercepts no picking and covers neither edge controls nor focus indicators.
Overlay Card and task instrument may use restrained elevation and rounding to
remain legible over Stage. Exact radii/shadows are calibration choices, not
copied pixels. Stop cards are semantic composition items in the Guide instrument;
the shell does not become nested dashboard cards. Spatial marks
retain the precision and legibility requirements of their domain grammar.

**Grid and wall sheet.** Paper draws fixed 1 m minor and 5 m major lines; there is no
zoom-driven interval ladder. Decimate the **drawing** by projected CSS-pixel spacing:
each level is fully inked at 16 px and above, fades from 16 to 8 px and is suppressed
below 8 px. On Paper a 25 m reference appears only while the 5 m level is suppressed, and
obeys the same rule. The 3D mat applies the same fade per pixel, from each pixel's own
projected spacing, so near ground keeps 1 m, farther ground 5 m and the far ground 25 m.
Both directions of a level share one weight from the denser direction, so they leave together
and the farthest ground is plain, never one direction of lines. The 25 m level cross-fades in as the 5 m level fades out, so a zoom never passes
through a band with no reference (R217.S19). The mat is subdivided and pushed back four depth
steps, so a floor on the datum holds in motion with the near plane at its floor. Anchor to the
world/floor datum with a stable origin across zoom changes.
Paper's grid is a bounded sheet around the work: the datum bounds of Layout and
Scene, expanded by 5 m and rounded outward to 5 m, or a 20 × 20 m sheet
around the target for an empty project. The sheet is intersected with the visible
coverage so a zoomed-in view cannot generate unbounded lines; it grows with the work and
never moves the Camera. The mat's grid covers the finite mat, which the Camera's ground
reach sizes; it has no line geometry and no line budget. Inside the same sheet around the work the
3D ground is a finite surface in Paper's own colour, with rounded corners and Paper's grid inks at Paper's opacities. Outside it
the Stage is plain forest with no lines and no horizon. An empty project's surface is 20 × 20 m around world zero. It is
one unlit draw, follows Layout and Scene with a live candidate, keeps the lattice world-anchored, and never reads or moves the Camera.
It is drawing state, never a Camera mode or a reason to delay navigation.

The **paper rule** is fixed: a Wall wears the drafting sheet when it is the settled
subject of a Face session, straight or curved, or is off its footprint, and keeps
it as the reading tilts back to 3D. **Wall grid off** overrides that sheet and shows
real wall material in every reading/curvature; view-only displacement still has a
slate dashed footprint. On, wall distance/height carries the calibrated vellum grid,
including partly peeled and inside/outside readings. End/reveal faces stay plain
rather than suggesting a false measurement surface. Generated grid coordinates are
display-only. Paper and selection compose; selection does not replace the sheet.

### Semantic color (§6.4)

| Role | Accepted meaning / reference calibration |
| --- | --- |
| Forest frame / primary action | Deep green (`#11291f` / `#22503c` reference); Head, invoked instruments and contextual commit |
| Neutral working surfaces | White Card, pale stone Index and light Paper (`#ffffff` / `#f5f6f4` / `#e9ebe6` reference) |
| Guide composition items | Light neutral Stop items on the forest instrument |
| Primary technical / reference dimension ink on light surfaces | Dark neutral ink, contrast-calibrated (`#1b201c` reference) |
| Light overlay ink/halo | `#F3F4EE` |
| Paper grid minor / major | `#9FB2A2` at 0.28 / `#809984` at 0.45 |
| 3D background, inside and outside the drawn ground | `#152C26` |
| 3D ground plate and its grid | Paper's ground and grid tokens, never separate values |
| Default physical Wall | `#F1E6CF`, half unlit and untoned so it reads the same in the Stage and Preview; never over an authored material |
| Camera infrastructure / active context | Restrained leaf green (`#4f8f6c` reference), reinforced by shape/line; no mandatory competing blue/teal shell hue |
| Selection, the held anchor and current playback moment | Gold (`#d4ad45`, dark ink `#74560c` reference), local contour and quiet tint; selection and playback retain different shape/text cues. Gold means selected geometry (or the point being held), never hover, an available action or inspection |
| Armed tool | Soft **ivory** key (`#f3f0e4` reference) with a dark icon on the dock material; tool colour is only a 2 px mark under an icon |
| Available transformation | **White** dashed line, open arrowhead and anchor point over a dark halo ([mark language](#spatial-mark-language)) |
| Temporary inspection (Slice and its depth) | Translucent **yellow** plane or volume (`#f2d000` reference) with the state pill; distinct from gold by hue, translucency and the pill |
| Marked for erasing | **Red** dashes (`#d0412d` reference), only while the Eraser is in use |
| Live value | Dark tag, mono text, shown only on hover or drag |
| Visitor-facing Preview / deliberate View update | Gold accent at the explicit action, distinguishable from selected identity |
| Clearance caution | `#F7EDE8` surface, `#C85A48` accent, `#3A241D` body, `#7E2718` action |
| Refusal | `#FDF3F0` fill, `#7E2718` text, terracotta edge |
| View-only displacement | `#56707C`, dashed |

Values are separate semantic roles even when equal. Swatches calibrate the accepted
family, not a requirement to reproduce every prototype token. Calibrate for
contrast; do not incidentally recolor caution, history, branding or return
by changing selection. The drafting sheet matches vellum so rolling a Wall does not
read as a material replacement. Intentionally open gaps retain their distinct open
state, not refusal by default.

**Canonical selection has the strongest identity contour; active lens is neutral.**
The lens switch uses a quiet pressed/active chassis cue, never a competing amber
selection. Task focus, referenced subjects, playback and repair candidates remain
distinguishable without selecting them. Branding/history never carries selection.

Selection is a persistent contour and quiet tint, never a page flood. On paper use
contrast-safe gold ink; on the mat use the gold core; variable content may need a two-tone
stroke/halo. The sheet/grid remain visible. Manipulation emphasizes the active handle,
affected edge and measurement rather than every dimension or the entire Card.
Unselected architecture and Camera context remain quiet enough for selection to read.
Cut poché on Paper takes no tint: its black ink stays, with `#74560c` under a `#d4ad45` core.

### Spatial mark language

Each mark tells you what kind of state you are looking at; none is decoration. The
[spatial-instrument grammar](./spatial-instrument-grammar.md#rays-and-points) owns how
the marks are drawn and arbitrated; this table owns what each role means.

| Mark | Means | Never means |
| --- | --- | --- |
| **Gold outline and translucent gold volume** | Selected geometry | Available actions, hover, inspection |
| **Thin white dashed line with a dark halo** | A transformation is available here (axis ray, rotation ring, track, dimension line) | Geometry |
| **Small white open arrowhead** | Which way that line drags | A button |
| **Small white point** | An anchor: wall end, joint, slide position on a track, the scale point. It turns gold while held | Selection |
| **Translucent yellow plane or volume** | Temporary inspection: the Slice and its depth | Source; it is never saved |
| **Red dashes** | Marked for erasing, only with the Eraser | Errors elsewhere |
| **Dark tag, mono text** | The live value, only on hover or drag ("Height 1.10 · base stays") | Permanent W / D / H text |

The halo is a dark under-stroke beneath every white mark, so lines and arrows stay legible
on pale walls, on the gold selection and on the dark grid without a second colour.
Retired: large knob disks, XYZ gizmos, permanent W/D/H labels, gold joint buttons and the
Card's wide editing posture. Red and yellow are never the only cue: the Slice has its
pill, the Eraser its bar, and a filter a text line. Task focus (for example Focus height)
keeps its own emphasis distinct from gold and yellow; under Focus the Height Sheet's plane
becomes an outline so it does not wash out the focused story.

### State and control hierarchy (§18.3)

| State | Required distinction |
| --- | --- |
| **Hover** | Perceptual lift in chrome; restrained edge/tint below selection on Stage |
| **Armed** | Named tool and distinct active-context treatment: the ivory key on the dark dock, with the palette open or collapsed; never a selected-identity gold echo |
| **Selected** | Coherent identity contour/edge and quiet fill across its representations |
| **Keyboard focus** | Independent visible non-hue focus cue, using focus-visible behavior |
| **Pressed/toggled or active lens/reading** | Quiet recess, edge and inset rule; does not become selection |
| **Task focus / reference / candidate** | Named context and distinct emphasis, never a selected-identity echo |
| **Authored / derived** | Distinct glyph, line or read-only treatment, especially anchors/stations |
| **Temporary inspection / ghost / Preview** | Explicit temporary or execution context (yellow plane or volume with a state pill and Put back); no apparent source mutation |
| **Disabled** | Legible unavailability and reason where needed, distinct from quiet enabled controls |
| **Caution / refusal / destructive** | Separate warning, blocked proposal and consequential-action semantics |

Shape, line, pattern, text, icon and position reinforce color. A refused proposal
outranks active-value styling locally but preserves keyboard focus and canonical
identity. View-only displacement is slate/dashed and described as set aside, not an
error merely because geometry appears moved. Stale gesture emphasis clears on
completion, cancellation, lost pointer capture or closing its writer.

Project/lens context, reading, contextual task, tool, identity and immediate gesture
have different visual jobs. Do not flatten them into equally prominent buttons.
Identity and meaning lead; advanced controls and metadata are subordinate. Strong
emphasis is local to the current decision. Destructive/consequential actions come
after ordinary information and use deliberate labels. Context help, empty states
and refusal reasons teach locally; Card is not a documentation dashboard.

Primary acceptance is emphasized at the active decision. Ordinary actions,
utilities and relation links use progressively quieter treatments; a list of
references must not become a stack of primary buttons. Segmented controls use
the pressed/active baseline, not selection color. Destructive action and refusal
retain their own semantic roles; disabled controls cannot look like quiet enabled
ones. Rank follows the action's consequence and context, not the feature's accent.

### Typography and control roles (§7)

Use a legible operational sans for controls and supporting context, with a
restrained display treatment for authored names/content and mono/tabular roles
for measures, coordinates, references and time. Round 2's serif display for authored
names (project, Experience) against a system sans is accepted visual evidence; particular
fonts and prototype pixel sizes are not mandatory. Sentence-case section titles and clear hierarchy
separate content identity from operating instructions.

Surfaces consume semantic family/size/weight/leading and control roles. Build one
independent product-wide type/control scaling mechanism rather than introducing
component-local metrics (the landed mechanism was removed by #115 with the editor
shell). Primary acceptance, ordinary controls,
utilities and inline actions retain distinct roles; pressed/selected state does
not invent a size tier. Density is calibrated as a complete composition with
long names, thumbnails, precision values and keyboard focus visible.

The earlier 9/10/11/12/13/15/20 px ladder, 30/26/24/20 px control heights and
fitted Tool Tray micro-tier describe prior calibration and landed evidence.
They do not force the destination into the previous chrome or permit
tiny ordinary text. There is no landed production shell to preserve after #115 —
the previous calibration was removed with the editor shell — so PLATE calibrates
fresh metrics at its rebuild, preserving contrast, usable targets and semantic
hierarchy.

Preserve settled identity and Plan drafting/icon semantics where those tools
apply. A shell change does not require a wholesale icon redraw. Wall/shape/Opening
icons remain distinguishable from the marks they produce; derived Rooms do not
become authored primitives through a retained shape icon.

### Accessibility and motion

Keyboard navigation, disclosures and precision controls need non-pointer paths.
Focus remains visible independent of selection/armed state. Contrast applies to quiet
metadata too; quietness comes from hierarchy, not unreadable ink. Coarse-pointer
interactive targets need at least 44 × 44 px without changing semantic roles; marks stay
visually small while their hit areas grow. Round 2's 22–26 px hit discs and 14 px bands
are fine-pointer prototype values, not a coarse-pointer target. Every hover reveal needs
a touch and keyboard path, and every mark needs at least 3:1 non-text contrast on both
pale walls and the dark Stage (unmeasured in the wireframe).
Reduced motion changes presentation, not endpoint meaning, access or source truth; the
wireframe's 140–220 ms entry fades must honour `prefers-reduced-motion`.

**Motion speed** selects movement policy, including teaching-then-fast or brisk/instant
behavior. **Reduce motion** independently forces presentation duration to zero, hides
timed captions and stops CSS transitions without changing the selected speed; the
system preference still initializes and works independently. Both use Camera evaluation
for spatial movement. Instant is not a substitute for the accessibility control.
World Settings is their assigned home; no World status-rail control survives.

## Return, parking and Preview (§0.8.2)

<a id="082-parked-procedure-and-lens-return"></a>

### Lens crossing and foreign selection

A lens toggle changes authoring intention only. Project identity, canonical selection,
Camera standpoint and spatial orientation carry. It captures no View, creates no
Presentation or relation, opens no Guide, moves no Camera and infers no subject.
An explicit cross-lens action may deliberately change lens and selection together;
the toggle itself never does.

| Selection carried across | Honest destination behavior |
| --- | --- |
| World subject → Experience | Keep that World identity selected; explain exposure, show relevant Presentation/Stop references with explicit Open actions, and offer deliberate Presentation creation where supported |
| Presentation or Stop → World | Keep the Experience identity selected and inert for unsupported World editing; show references with explicit Select/Open-in-Experience actions; do not restore an old World selection |
| Camera View → World | Keep the View identity and Camera ownership. World may inspect; durable edits delegate to Camera through Experience's authoring controls. Do not select its framed subject or capture another View |

An unselected referenced object on Stage remains unselected. Neither Presentation
focus, Stop focus, framed subject nor previous lens selection substitutes for the
current identity.

### Parking and explicit Resume

**Park is inactive remembered session context.** On lens exit, cancel unaccepted
writers/drags, deactivate invoked task surfaces and temporary readings together,
and retain accepted source edits. World inspection and Find, Index and invoked-task state park;
Experience's invoked Guide, path/playback and precise Camera contexts use the same rule.
Parking authors nothing and owns no Camera snapshot/history.

Returning shows **current selection and Camera standpoint at ordinary lens rest**.
World has no active Instrument or inspection; Experience does not automatically
reopen a Guide, path/playback or precision context. The toggle restores no
old Browse context, task, selection, reading or Camera pose.

Resume is explicit in relevant Look/Details, condition or Experience task context.
It is available only after the original canonical identity is selected and targets/
configuration are revalidated against current source. Missing or invalid targets
produce an explanation or valid fresh work, never silent retargeting. Changed
selection is not replaced to resume a task; unaccepted proposals never resume.

A resumed surface and its reading activate together from the **current standpoint**.
Any Face/Bring into view is a separate Camera request. Put it back uses canonical
navigation's current invocation return context and cannot rewind movement performed
in the other lens. Session payload/storage remains an implementation choice.

### Spatial return and procedural unwind

Put it back restores the expected spatial reading and standpoint through Camera/
navigation; the shell does not keep a second viewpoint history. Temporary reading
state may accompany that authority's return context without becoming authored truth.
Accepted edits survive procedural exit. Esc cancels/unwinds; it is never Undo.

| Context | Esc progression |
| --- | --- |
| Spatial work (Experience and shared) | Cancel writer/drag proposal → leave precision for the Card → Put it back and deactivate the reading and its pill together → rest |
| Non-spatial component/repair work | Cancel writer/picker → leave precision for task focus → Instrument overview → close Instrument → rest |
| World authoring | Menus and popovers → Preview → a pending erase → a live drag or Ink stroke → reading chip → Edit shape → Look through → the Instrument → a temporary reading (Put it back) → Slice → Focus → **the armed tool's open palette (collapse)** → the armed tool (back to Select) → selection → rest, unwinding one applicable level per press |

Field cancellation leaves the tool armed. Collapsing the palette precedes disarming the
tool. Ordinary rest has no destructive Esc action. Return controls/crumbs must be
obvious; exact control geometry is open. The wireframe's full order is evidence; the
production keymap belongs to its planner.

### Preview takeover

Preview is execution, not another authoring mode or a Through-camera overlay.
Authoring infrastructure disappears; visitor session state never writes source.
Exiting restores authoring lens, selection, Card context, Stage standpoint and open
inspection/task context through their authorities. Unlike a lens return, Preview
exit restores the authoring context from which it was entered.

## Responsive and narrow behavior (§22)

Compress redundant metadata before identity, location, active work and usable Stage.
Preserve complete compact references, useful names, disclosure and selection under
dense structure, repeated names and long names. Multi-level projects, shared Walls,
many objects/Views and reduced desktop height must not require another shell.

At narrow desktop width the Index becomes an invoked overlay that starts collapsed, behind
a compact location control; Card becomes an invoked sheet behind a selected-identity
control. Stage stays dominant, with the active lower task surface in a coherent home.
Conditional recovery appears if current context cannot identify the selected subject.
Experience Index may compress during invoked work, while Card identity remains
legible/recoverable and the Guide instrument stays attached to Stage.

**Targets.** The editor targets **small laptop and iPad** (landscape and portrait).
Phones are out of scope for the editor; Preview has a Phone frame because visitors may use
phones. In World, location lives in the Head chip while the Index is away. Overlay Index
and Card sheets overlay Stage without resizing it; the overlay Index ends above the dock
row and its scrim leaves the dock usable; opening a procedure closes the Card sheet. The
scoped list remains reachable from context menu/Find. The dock, palette, reading control,
drafting words, scale bar and Height Sheet remain available, and the Instrument never
covers the drafting words. Every hover reveal has a touch path (value tags while
dragging, a tap on the scale point, the Sheet's snap name while dragging, a visible edge
affordance on `hover: none` devices).

Shell resizing, instrument expansion or sheet presentation is **layout behavior**: it
must not imply a Camera fit, pan, fly-to or authored Camera change. Preserve the
standpoint and spatial memory as the visible rectangle changes. Explicit spatial
operations may request framing through Camera; layout changes cannot smuggle in
that request. Breakpoints, exact widths/heights and instrument crop/docking mechanics
are implementation/usability choices, not raster-derived product rules.

## Open implementation and usability choices (§0.3 · §0.7.6)

The following choices remain open within the ratified constraints; they do not
reopen shell acceptance or create unfinished design gates.

| Choice | Fixed constraint |
| --- | --- |
| Advanced Camera precision exposure | Visual composition/Look through is the ordinary path; supported precision uses Camera and stays distinct from Preview |
| Guide scrolling, overview timeline, crop/docking and responsive density | One invoked Guide context, integrated composition/playback and Stage dominance; layout changes never navigate |
| Overlay Card positioning and wide Instrument arbitration | Section/Unroll/Face readings, the reading control and return remain reachable, and the Card never covers an Instrument; the prototype's shrink-to-title suggestion is not a prescribed production solution |
| Camera visibility edge cases and Selection-only behavior | Non-blocking owner-accepted refinement opportunities; preserve identity, reach and truthful Camera representation |
| Domain-specific instrument geometry, occlusion aids and overlap disambiguation | Follow [spatial-instrument grammar](./spatial-instrument-grammar.md); preserve truthful relationships, semantic species and reachable operations without inventing constraints |
| Station-bound Cue comprehension | Verify Cues remain understandable after path-point moves, pace changes and shared-path edits; binding/ownership semantics are fixed |
| Deep coordination/scripting shell | Retain domain semantics and focused invoked editing; no new language or timeline inferred from the mock |
| Dense View collections | Thumbnails and truthful spatial Camera markers stay discoverable; grouping/filtering does not invent authored relationships |
| Camera Path interpolation | Drawn geometry follows the Camera evaluator; any smoothing is a Camera evaluation decision, not a shell control |
| Exact keyboard-focus treatment | Independent visible non-hue focus remains required; the demo's two-tone ring is a candidate, not a mandated measurement |
| Accent-tinted pressed fill reconsideration | The recessed/edge/inset baseline remains; no second treatment is introduced by a feature |
| Mat ↔ vellum transition timing and wipe/crossfade | Prevent flicker, preserve continuous spatial meaning and reduced-motion endpoints; demo timings are not product law |
| Production representation of temporary reading/parked session payloads | No authored inspection state, hidden active task or second Camera history |

### Retained alternatives (Round 2)

The wireframe's Compare menu kept these presentation alternatives live. The recommended
option is the destination default; the alternative is a candidate a consuming slice may
adopt on evidence, as a named decision, without reopening the shell.

| Question | Default (ratified) | Retained alternative |
| --- | --- | --- |
| Collapsed Index | Head location chip (shows where you are, works on touch) | Minimal translucent edge arrow, tap zone on touch; the owner's choice between the two, with the chip favoured |
| Collapsed palette cue | Faint caret above the armed key (small and faint; size calibrated at implementation) | No cue |
| Width · depth · height | Progressive: click the scale point | Always shown, plus a possible zoom-dependent rule |
| Pen and ordinary shapes | Context first: Shape is one more reading on the chip | A temporary Shape intent toggle in the Ink palette, if field use shows long runs of ordinary shapes |
| Eraser kinds | Filter disclosure in the palette (owner choice) | Kind chips in the acceptance bar, the lighter answer for occasional use |
| When erasing asks | Only across domains; up to three simple things go at once | Also when hosts, rooms or roofs are affected |
| Roof Section 2D | Takes the Stage as a roof-local reading | Inset editor over the 3D Stage, expandable |
| Tool colour mark | Shown as a 2 px mark under the icon | Off |

Considered and **not** retained as candidates: dimension lines beside the front edges
(they converge and crowd small objects), the round 1.1 knob disks (retired), edge grips for
architecture (a small target with no touch affordance), the Card editing posture for
Edit shape, the outline-tree Index, a Dimensions Instrument, a persistent Object Pen and
Conservatory/Paper-era chrome. They reopen only through a named design decision that
answers the stated reason.

### Open usability problems (Round 2)

Recorded from the wireframe's browser pass; each belongs to the consuming slice's design
loop, not to an unfinished shell gate.

- Wall thickness by gesture is fiddly at overview zoom; the Card field is the real path and
  the arrow may belong only to close zoom.
- Curved Walls are specified, not built (a hollow midpoint would bend a free Wall); Rooms
  and hosted Openings need curved geometry from Layout first.
- The Section inset covers the Stage's lower right where the Sheet's foot and zoom controls sit.
- iPad landscape is tight with the Index, a selection and the Ink palette all open; iPad
  portrait was checked only scaled down.
- The near-wall cutaway is automatic, with no hold-to-see-outside.
- Portrait Preview crops authored Views; Look through needs aspect safe-area guidance or
  per-aspect framing.
- Similar names in dense projects need thumbnails or hover highlight beyond room and Level context.
- Experience hides the Height Sheet; whether View placement needs a working height is open.
- Non-text contrast of every mark and the touch targets above are unmeasured.
- The configuration container for a later grid/snap preference, snap targets, labels,
  rulers and cut height is undecided; pin persistence is a domain question.

Internal-component selectable identity and shared-source/local-override semantics
remain domain questions. Use capabilities and scope choices the domains declare;
this shell does not resolve their future formats. Layout's Wall-role migration and
intentionally non-enclosing-ring choice remain with Layout, not with a shell designer.
Production key bindings belong to delivery planning.

## Conformance test for future design

A feature/domain brief plus this document must suffice to design a conformant shell.
Its proposal must make these outcomes visible together:

- Shared Head/Index/Stage/Card continuity, with one canonical selection and correct
  ownership across both lenses and narrow desktop.
- Calm resting context, purposeful disclosure and the correct lens-specific task
  home; richer capability does not create permanent parallel chrome.
- Experience's thumbnail-led Views with deliberate Default, visual capture/Update/Exit,
  one invoked Guide with Stop/transition composition, direct Stage path editing and
  integrated playback, and usage-first Scene
  subjects, as complete compositions rather than a checklist of controls.
- Camera geometry/evaluation distinct from Experience order/coordination, with
  explicit scope and gaps, generated/authored distinctions and no legacy Timeline model.
- Coherent material, typography, controls, selection/active-lens hierarchy, accessible
  state distinctions and local precision/refusal.
- One lower column (dock → palette → Instrument) with explicit palette collapse and Esc
  unwinding one level at a time; the Instrument only for Library, repair and the Guide.
- The mark language of rays and points: gold only for selection, white for available
  transformation, yellow for temporary inspection, values only on hover or drag, and no
  handle for an operation its domain cannot perform.
- The Card as the one writer for ordinary facts, with marks writing the same fact and the
  same refusal.
- Lens parking, explicit revalidated Resume, spatial return and Preview exit following
  their different contracts, without source or identity surprises.

The Round 2 wireframe's interactive states and guided tours lead acceptance of shell
composition, visual language and interaction; Conservatory's scenarios remain Experience
scenario fixtures, and V2 A–F retains its specialized behavioral role.
Reference images support relative hierarchy, information homes, spatial instruments
and visual grammar. Exact pixels, fixture values, names/counts, incidental wording,
generator artifacts and prototype shortcuts are not product contracts. Repeated
composition is assessed against the promoted written contract and interaction
expectations; superseded PNG layouts are not acceptance gates. Implementation experiments vary within the fixed
constraints above.

## Design evidence

These retained artifacts explain rationale and supply specimens; they are not a
fallback specification that a future designer must reopen or an authority cycle.

| Evidence | Role |
| --- | --- |
| [Production shell wireframe, Round 2](../../../prototypes/production-shell-wireframe/README.md), its [design note](../../../prototypes/production-shell-wireframe/DESIGN-NOTE.md), [atlas](../../../prototypes/production-shell-wireframe/atlas.html) and [walkthrough](../../../prototypes/production-shell-wireframe/story.html) | **Primary accepted visual and behavioral evidence** for the shell, at the revision recorded above; promoted rules live here, mock mechanisms (snapshot Undo, painter's SVG, heuristic stroke reading, centroid Slice cut, mock Camera) do not |
| [Conservatory Round 2](../../../prototypes/experience-ux-alternative/README.md), [rationale](../../../prototypes/experience-ux-alternative/design-rationale.md) and [scenarios](../../../prototypes/experience-ux-alternative/scope-and-critique.md) | Superseded for shell composition, chrome and visual treatment by Round 2; retained as Experience semantics evidence and reproducible scenario fixtures (dense Views, long Guides) |
| [World final synthesis](../../../prototypes/world-experience-shell-round/design/design-synthesis.md) and [World QA package](../../../prototypes/world-experience-shell-round/QA-package/) | Prior shared/World shell record; valid discovery, procedure and return rationale survives, conflicting shell treatment is superseded |
| [Experience UX reconciliation](../../../prototypes/integrated-experience-authoring/design/experience-ux-reconciliation.md) and [Experience Design-QAs](../../../prototypes/integrated-experience-authoring/Design-QAs/) | Historical 2026-10-11 Experience design; useful behavioral rationale, no current visual acceptance authority |
| [UX3/V3 proposal](../../../prototypes/experience-ux-v3/design/README.md), [inactive plan](../../../prototypes/experience-ux-v3/design/implementation-plan.md) and [generated boards](../../../prototypes/experience-ux-v3/README.md) | Superseded independent proposal, rationale and Git provenance; no active implementation or PNG-equivalence gate |
| [Experience V2 final synthesis](../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) | Superseded 2026-10-01 Experience record (Set, Peek/Overview, Seam, Coordinate); provenance only. Its boards were retired 2026-10-11 except the two Camera precision specimens; Git history keeps the rest |
| [World Paper proposal](../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md) | Rationale and specimens. Its rail, pointer families, Dimensions step, status cluster and Sheet configuration home are superseded by Round 2; its domain rules (derived Wall roles, host preference, capability placement) survive in §0.8.4 |
| [P26 surface calibration acceptance](../../../prototypes/spatial-authoring/design/visual-system-refinement/qa/ACCEPTANCE.md), [specification](../../../prototypes/spatial-authoring/design/visual-system-refinement/specification-plan.md) and [prototype journeys](../../../prototypes/spatial-authoring/README.md) | Mat/vellum/grid/state calibration and deep World interaction evidence; shortcuts are not production mechanisms |
| [Shell ratifications](../../archive/technical/editor-shell/ratifications.md) and [Atlas](../../archive/technical/editor-shell/atlas/index.html) | Existing role-system and state evidence; the Atlas's landed composition does not redefine this destination |

## Product convergence destination

**Owner-ratified destination, 2026-10-22, PR #173.** See the
[ratification record](../decisions/product-convergence-ratification-2026-10-22.md). This prepares feature
integration within the ratified shell, not a complete new shell design.
[Review manifest](../../archive/roadmap/coordination-2026-10/product-convergence-2026-10-21-amendments.md).

An object with admitted parts offers part selection as deeper Card capability on invocation,
keeping the placed subject's identity visible and distinct from Presentation selection. An
object without admitted parts offers whole-object or point explanation. Experience owns the
annotation and its uses; the Card makes that reach discoverable without copying Scene state.
Relationship facts distinguish independent, attached, needs-review and unresolved state. Repair
controls are truthful about available operations: Detach requires an evaluable pose; Re-pick,
explicit placement or delete remain available according to the consuming domain's policy.
Proximity never implies following.

**Feature design loop, owner direction 2026-10-22.** Precise placement, grouping, responsive
behavior and instrument details are designed in the consuming slice: draft → review → build →
real browser observation → revise. Carry explicit states for ordinary use, selection, refusal,
repair, keyboard access and narrow viewports. Keep the ratified shared shell composition,
material, typography, control metrics, state language, return and accessibility rules. A proposed
departure is a named design decision for owner review. No full cross-feature layout needs to be
frozen before the next engineering plans. The Round 2 wireframe is the accepted visual and
behavioral reference for that design; its chrome is evidence, and its mock mechanisms are
never adopted as implementation.
