# Museum Editor — destination shell and visual-system contract (PLATE)

> **Unified design ratified by the owner (2026-10-13, #114).** Conservatory Round 2
> is the accepted minimum UX and visual direction for World and Experience. Round 2
> was delivered at `8ead6b148e404f38a6ff91db7801ad1a6fa35426`; the exact reviewed
> artifact is `426698573e883bc3a16b265ff9efc5be744c5fec`, including the subsequent
> Index-highlight CSS refinements (`41a4c4dd` and `42669857`). The owner reviewed the
> initial workspace, dense Presentation/View states, long Guides and representative
> World shell. [Conservatory](../../../prototypes/experience-ux-alternative/README.md)
> supplies reproducible UX evidence; **this document owns the promoted contract**.
> UX3/V3 and the former Experience V2 shell are historical design/functional
> evidence. Paper §0.8.4 retains World authoring depth. This ratification changes
> destination design, not production implementation or persisted formats.

**Status: owner-ratified destination shell authority.** This document is the complete
contract for new Museum Editor shell design: composition, disclosure, information
homes, material, typography, control hierarchy, state language and return behavior.
Future feature design extends this shell. A proposed shell change must identify and
justify the rule it changes; a feature brief must not casually reinterpret it.

The destination is **World | Experience over one project**. This is design authority,
not a claim of production implementation or authorization to cut over the editor.
The maintained editor's current composition is described in the
[landed shell contract](../components/shell.md); its implementation remains current
until explicit migration. Prototype adoption and production delivery have their own
plans and acceptance gates.

| State | Meaning after #114 |
| --- | --- |
| **Accepted destination** | Conservatory's unified shell, visual language and Experience authoring principles, promoted below; Paper's accepted World depth in §0.8.4 |
| **Implemented production** | The landed shell and domain contracts still describe the editor until their explicit cutovers; this PR changes no application code |
| **Preserved semantics/architecture** | Domain ownership, Camera evaluation, validity, source history and isolation remain governed by their owners |
| **Deferred depth/refinements** | Advanced authoring remains reachable in future delivery; optional UX improvements below are not unfinished design gates. #115 plans parallel tracks; it does not implement them |

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
The distinct LayoutDocument/SceneDocument encodings and existing frame/transform
contracts, including Room-local conversions where applicable, are unchanged. The
ratified world-local placement with explicit internal frames remains the destination;
this shell ratification introduces no mandatory Room frame or transform migration.

The shell preserves these invariants:

- **One project and one continuous Stage.** Plan, 3D and focused spatial readings
  show the same world; a lens or reading change does not launch another application.
- **One canonical selection value.** It is one identity, or an explicit set where
  the domain supports sets. Stage, Index, Card, subject Search, Details references
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

World and Experience share Head, a collapsible Index, dominant Stage, a contextual
overlay Card and an invoked task instrument. Their identity and hierarchy remain
recognizable across lenses; Card and instrument are absent when their context is absent.

```text
HEAD — Museum Editor · project · World | Experience · active Experience · history/save · Preview
INDEX / locator       STAGE — dominant spatial work
                      contextual overlay CARD · invoked task instrument
```

| Landmark | Shared responsibility | World expression | Experience expression |
| --- | --- | --- | --- |
| **Head** | Persistent project/application context, lens switch, save/history and Preview | App actions and source-history access; Paper details below | Active Experience identity in context; the same app and project actions |
| **Index** | Where am I, and where is that thing? Locator and orientation, not a primary property editor | Local place/level path, relation-aware surroundings, subject Search and Browse | Presentations and relevant relationships, including Guide awareness where present |
| **Stage** | Continuous spatial truth, focused readings, spatial instruments and direct manipulation | Architecture, objects, inspection, drafting and manipulation | Camera View placement/framing, contextual paths and playback |
| **Card** | What is canonically selected, what does it mean here, and what owns/reaches beyond this use? | Quiet identity/facts; invoked structure/reach disclosure | One contextual inspector for the selected Presentation, View, subject, Stop, transition or path point |
| **Task instrument** | Work invoked at the Stage's lower working edge; selection identity stays in the Card | One **World Instrument** for the invoked procedure | One active **Guide context**, integrating Stop composition, Cut/Travel, path authoring and playback |

The wide shell has Index left and Stage as the working ground. Card overlays the
Stage edge instead of reserving a permanent inspector column. Opening/closing it
does not reflow or implicitly reframe the Stage. There is no empty Card at rest.
Selected identity remains legible or directly recoverable when the Card is closed
or compressed. Index collapse preserves location, selection and access to its
contents. Head stays compact; supporting surfaces do not become equal dashboards.

The lower task home is a shared composition principle, **not interchangeable task
semantics**. World Instrument is subject/task procedure. Guide context is editorial
composition, transition work and playback. One does not inherit the other's control
layout, vocabulary, dimensions or lifecycle. Both remain attached to the shared
shell and preserve Stage dominance.

### Contextual lower-surface span

The lower home has **one composition grammar with task-appropriate span**. Its
horizontal extent follows the information that must be read and worked on together,
not the lens name, technical complexity or number of uses affected by an edit.

- **Local work** stays attached to the central Stage working region and consumes
  the width its task needs. An Opening procedure, measurement, source edit or
  repair does not earn shell breadth merely by exposing advanced controls.
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
Full Browse/Search depth, recovery rows, Look actions, Details, task surfaces,
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

**Select → Look or Details → Instrument → Precision.**

### Ordinary World and the Context Index

Ordinary World answers where I am, what surrounds the subject, what is selected
and how to reach elsewhere. It shows a useful project/location path, nearby
relation-aware context, Search/Browse, a minimal identity Card and the world.
Source/use counts, component trees, attachment detail, precision, cross-lens
references and specialist machinery are not permanently exposed.

The Index uses only non-empty relevant groups such as **Bounds, Openings on bounds,
Located here, Overlays, Attached here**. A Wall may bound several Spaces; an Opening
is hosted by a Wall; an object may merely be located in a Space; a Zone may overlap
Spaces. Location, indentation, ownership and source identity remain distinct.
Project, structures, levels and Room/Space orientation must scale beyond one museum
or one level without teaching a fabricated containment model.

Browse exposes wider project breadth without changing selection. If the selected
subject lies outside the browsed context, show a conditional **Selected elsewhere**
recovery row with identity/location; there is no permanent selection pin.

Subject Search explains visibility reasons and keeps four operations separate:

| Operation | Effect |
| --- | --- |
| **Select** | Change canonical identity only |
| **Open location** | Change Index browsing context |
| **Bring into view** | Request viewpoint motion through Camera/navigation |
| **Reveal / Include / Face** | Invoke an available temporary World inspection |

Actions operate on their own result; navigation, location and inspection need no
prior selection. Selecting a result never silently moves the Camera or activates
inspection. A result can be outside the frame, behind opened architecture or otherwise
hidden without becoming invalid or replacing the selected identity.

### Look, Details and the World Instrument

**Look** is a capability-driven door into spatial procedure for the selection/context.
A curved Wall may offer Face, Unroll or Section; a Ceiling Lift or Look up; an Opening
Face host or Section through here. A subject with no useful spatial reading needs no
Look affordance. Look may sit beside selected Stage geometry, but is shell interaction,
not a world entity or a Camera object.

**Details** exposes identity, source, composition and relationships. Its verbs are
explicit: **Expand** reveals information, **Focus** deepens task context, **Select**
changes canonical identity, and **Open task** invokes specialist work. Entity names
alone do not secretly select. Source uses, internal components and attachments retain
those distinctions. Do not fabricate selectable component identity where the model
only supports internal task focus.

One **World Instrument** appears because work is invoked, never merely because a
selected subject has advanced capabilities. Its coherent home is at the Stage's lower
edge. It names the task and its technical target, including when that target differs
from selection: an Opening stays selected while its host Wall is unrolled; an object
stays selected while a component is task focus. Complexity gathers around that task.

A spatial Instrument and its temporary reading activate and deactivate together.
There is no active Unroll, Section, Reveal or Lift whose Instrument is hidden.
Non-spatial component or repair work uses the same task home without becoming another
composition editor. Precision deepens the current task; it is not an application mode.

### Temporary readings, precision and refusal

Temporary readings show the same source under a changed reading, retain an as-built
relationship and visibly explain temporary state. They must not look like duplicated
geometry, authored displacement, deletion, damage or visitor behavior. Labels explain
legibility honestly, including which axes are to scale or foreshortened. Exact model
values remain exact regardless of the current projection.

The [spatial-instrument grammar](./spatial-instrument-grammar.md#direct-manipulation-and-precision)
defines truthful handles, active/read-only emphasis and readout placement. The World
Instrument supplies the non-pointer precision writer; it is not another selection
or an excuse to expose duplicate writers.

Refuse invalid edits locally with the proposed value, reason and useful correction
where available. Accepted geometry remains visible; refused proposal geometry is
separately transient. Do not clamp silently, commit then roll back, add history noise,
clear selection or obscure the writer. Corrections are deliberate actions, never
automatic repairs. Only valid acceptance creates the logical source edit.

### Shared source and repair

Owner, Source and Reach appear where the proposed operation needs them. For a source
finish change, the Instrument can name the source, selected use, affected uses and
acceptance scope while the Card keeps the placed object selected.

Broken relationships are discoverable with a proportional parent warning. Repair
machinery appears on invocation and distinguishes selecting the broken entity, focusing
it as a task, previewing a candidate and changing the relationship. Show missing identity
honestly; offer deliberate host selection, detachment or leaving unresolved where
supported. Never match by repeated name, proximity, nearest object or apparent containment.

### World Paper authoring (§0.8.4)

<a id="084-world-paper-authoring-destination"></a>

The owner-accepted Paper proposal and this section remain the authority for
**World Paper authoring depth**. Conservatory updates the shared shell treatment:
overlay Card, collapsible Index, forest/gold/neutral visual roles and invoked
instrument presentation. Those amendments supersede the proposal's permanent
Card allocation and old shell calibration; they do not replace its drafting,
precision or advanced procedures with Conservatory's representative World mockup.
The original [Paper proposal](../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md)
keeps its accepted rationale and specimens as written. PA0–PA12 is an inactive
prototype plan, not the next work mandate.

The following rules refine World authoring in the Paper reading. They allow a
small read-only facts line at World rest, assign permanent pointer families and drafting
state, and replace the older World history/status surfaces. The shared selection,
ownership, progressive disclosure and return laws still apply.

Paper is a reading of World's one Stage: plan Paper or a wall laid flat through Face/
Unroll. It is not another lens, document or workspace with independent state. It draws
Layout and Scene and owns no source data. Reading settings are view/session state,
never source or Undo.

| Region | Paper responsibility |
| --- | --- |
| **Head** | App menu with Settings, Keys and Hide side panels; lens switch; Undo/Redo with a verb label; save; Preview. No Head search or separate history-list panel |
| **Index** | Place/level, relation groups, subject Search and Browse. No tools, measures, capability search or task state |
| **Stage furniture** | Reading cluster, pointer rail, scale bar and datum key; one invoked lower Instrument. No World status rail or persistent message band |
| **Pointer rail** | What the pointer does; never facts, procedure steps or Apply |
| **Card** | Contextual overlay with identity/name, kind, up to three read-only key facts, a condition only while true, Look, Details and a scoped ⋯ list; no permanently allocated column |
| **World Instrument** | One of Find, Dimensions, a procedure or a Look session, changing in place; no subject-results browser |

**Permanent pointer families.** The rail is **Select · Draw · Opening · Place ·
Measure · More**, compact and attached to the Paper edge rather than another sidebar.
A family needs a distinct pairing of pointer target and gesture
result, armable with nothing selected, able to find its own target or refuse in words.
Frequency or familiarity never earns a slot. Variants stay inside their family; a
new permanent slot needs an owner ruling.

- **Draw** authors architectural geometry on a working plane: Wall chains, rectangles,
  circles or polygons.
- **Opening** cuts an embedded opening in an eligible host's coordinates. Joining
  Spaces may be a consequence, not its definition; a niche need not connect Spaces.
- **Place** places an item at a point and dispatches to Layout or Scene ownership.
- **Measure** produces temporary distances/angles, not authored annotations.
- **More** opens capability Find.

Tools stay armed until Esc or Select. Arming never changes selection; what a gesture
makes becomes selected. A tool option strip contains only defaults for the next thing
and a fading key hint, never existing facts, procedure steps or Apply. Opening retains
its family while it has its distinct embedded-cut grammar; catalogue-only openings or
a universally shared host modifier would require an explicit family reconsideration.

**Walls and hosts.** Draw authors Walls, not a preselected boundary/division/free-standing
role. Layout derives and explains the resulting role: enclosing Walls bound; a Wall
that encloses nothing is free-standing; a Wall across an enclosed Room divides it and
produces derived Room topology. Preview that role at the gesture and describe it in
Card/Index relations. Role changes follow geometry, never Make-bounding or
Make-free-standing commands. Rooms remain derived; no Room geometry becomes editable.
Divide room remains a findable procedure using Wall authoring and consequence planning.
A Makes chooser is earned only by another authored primitive, never by Wall roles.
The [Layout ownership contract](../architecture.md#ownership-current-source-of-truth)
owns the encoding cutover and its remaining migration choices.

Opening and hosted Place items seek eligible hosts, project onto host axes, name host
classes and refuse ineligible hosts in words. With a host or one of its Openings selected,
the selected host is preferred and wins ties. Preferred host is task focus, not a new
selection. Tools remain armed between hosts; there is no duplicate Add opening verb.

**Capability placement.** Capabilities register id, label/synonyms, family/form,
subject/host kinds, owner, consequence class, precision schema, legibility, order and
key. Placement follows that description, rather than a feature hand-placing chrome:
unchanged source means a reading/app setting; pulling already legible geometry means
handles/tags; a new pointer grammar requires permanent-family admission; a chosen
subject gives contextual capability; steps, multiple parameters, validation,
consequences or Apply require an Instrument procedure. Every capability is also
findable in Find. This is a placement rule, not a persisted-format schema.

**Card facts and discovery.** The name is the Card's one writable fact. Other facts
are doors to their owner: a settled measure opens Dimensions on that field, a derived
fact opens Details, and a true condition offers Repair, Resume or Bring into view.
During work the Card keeps accepted values. No third verb row follows Look/Details;
nothing on the Card arms a tool. A supported kind change sits on the kind fact itself;
a Wall role has no kind chooser. Other subject actions live in one fixed-order scoped
list shared by Card ⋯, context menu and Find's **For …** group. Usage never re-ranks it.

Index Search/Browse find subjects and retain the separate result verbs above.
**Find**, in the Instrument, finds tools, variants, actions, procedures, readings,
checks, keys and settings. It lists no subjects, never selects, and opening/browsing it
never moves the Camera. Its contextual scope comes from selection. Choosing a
capability hands off to that capability's owner. Each discovery home may have at most
one query-carrying handoff row to the other, never a second result list.

**Precision ladder.** Precision remains invoked:

1. **Direct:** drag a legible handle, with snap marks at the snap point. Valid release
   commits one undo step; invalid release cancels with none.
2. **Read:** live length, angle, offset or clearance tags accompany the gesture.
3. **Type at the gesture:** digits turn the live tag into numeric entry. Commit once;
   Esc restores the transient value, then cancels; blur never commits.
4. **Dimensions:** every settled writable measure of the selection in one Instrument,
   with units, keep-anchors and refusal at the field.
5. **Procedure:** parameters, validation and consequences, accepted on Apply.

Dimensions is the one settled-measure writer. A live gesture owns its transient
parameter; the corresponding Dimensions field only displays it until that gesture
ends. Each accepted field edit or procedure produces one undo step. Undo/Redo is
unavailable while a proposal/gesture is live and says why. Options needing several
source changes wait for an atomic composed plan, never several disguised undo steps.
Supported sets expose Align/Distribute through Dimensions and their scoped list.

Pulling legible geometry is done on Stage, not through Move/Rotate/Scale commands.
Every move validates. Topology-changing gestures preview consequences and commit
once on release without an Apply interruption. Cautions/refusals stay near the
pointer or field that caused them.

**Drafting state.** **Scale · Grid · Snap** remain legible as three words beside the
Paper ⟷ 3D switch. Off states are words, not color alone. Scale opens detents and
Fit all as Camera framing requests. Grid/Snap toggle their one fact and name the
interval/increment in force; a held snap-suspending modifier is reflected in the word.
A fourth drafting-state word needs an owner ruling: admission requires changing how
a distance reads or where the next point lands. No messages, hints, history, tool
state or motion settings belong in that cluster.

The **Sheet** owns configuration: grid ladder, snap increments/targets, labels,
dimension display, rulers, cut height and what to show. It displays grid/snap on/off
read-only and shows Layout's datum rather than owning it. Grid is one fact across
Paper surfaces; on a wall laid flat it is Wall grid, and off reveals real wall
material under the [paper rule](#material-and-working-surfaces-44).
Reduce motion and Motion speed live in Settings. The World status rail is retired.

**Instrument and consequences.** Find, Dimensions, procedures and Look share one
lower task surface, one state at a time. Its appearance never automatically moves
the Camera or covers the reading cluster. If it obscures its subject, its header
can offer an explicit Bring into view. Do not hide an active spatial reading by
switching away from its Instrument; resolve the task through its unwind/return rule.

Local consequences are the Stage preview. Expand consequence disclosure only when
earned: other identities created/retired, splitting/merging, changed membership or
connectivity, another level, or changed resolution of Camera/Experience references.
Use **Creates · Keeps · Splits · Moves (derived) · Connects · Elsewhere · one undo
step**, with read-only counts from owners. Focusing a consequence row emphasizes
that identity as view-only; selection stays unchanged.

**Paper ⟷ 3D continuity.** The switch requests a tilt through Camera about the current
target, keeping scale. Paper settles azimuth to the nearest 90° detent; 3D returns
to the last working elevation, not a remembered pose. It never refits, retargets,
rescales, changes lens or creates another viewport state. Selection, Card, Index,
armed tool, open work, history, grid and snap survive. A reading flip continues work;
it is not a lens crossing.

Keys, exact geometry, prototype mechanisms, fixture values and new domain schemas
are not fixed by this Paper contract. The production keymap belongs to its planner.

## Experience expression (§0.8.1)

<a id="081-finalized-experience-shell-expression"></a>

**Ratified 2026-10-13 (#114):** Conservatory replaces the former Experience shell
expression. The earlier V2 reconciliation, UX0–UX7 plan and UX3/V3 proposal remain
[historical evidence](#design-evidence), with their original rationale and Git
provenance. Their inspector/Deck layouts and PNG boards no longer direct design.

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

Head retains project/active Experience context, World | Experience, source
Undo/Redo and Preview. Search/Browse belongs to the locator; Head is not a
second task toolbar. History remains chronological and labelled by source action;
the prototype's snapshot Undo is not promoted.

Index locates Presentations, their Views and Guides, with progressive disclosure
and search for dense collections. It collapses without losing selection or
location. A Guide's open-context indication is distinct from selected identity.
There is no permanent Scene inventory or property editor; Stage and the shared
World locator provide subject reach. Context links explicitly Open or Select
their target; the Card's context remains canonical selected identity.

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

Stage is the ordinary spatial subject browser. Shared Search/Browse also reaches
hidden, off-screen, logical and keyboard-only subjects through canonical selection;
Bring into view is a separate Camera request.

Subject identity, deliberate Presentation creation and **Used in Experience**
precede deeper capability. Behaviors, visitor offers, audition and configuration
are invoked contexts, not permanent control inventories. Subject selection,
Presentation selection and task focus remain distinct. Existing valid capabilities
are preserved even when Conservatory does not demonstrate their full depth.

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
useful regression evidence. Conservatory demonstrates a minimum authoring loop,
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

Both lenses use forest-green framing/instruments, gold attention and neutral
working surfaces from the shared visual grammar. Thumbnail-led authoring,
light Stop items within the dark Guide context, quiet spatial context and
progressive disclosure provide one coherent application. World-specific tools
keep their own procedures within this language.

### Experience design acceptance

Conservatory's interactive scenarios and documented creator journeys supply the
primary UX acceptance language. Reproduce states and assess interaction outcomes;
screenshots can support review but do not establish pixel/layout equivalence.

| Reproducible scenario | Expected UX |
| --- | --- |
| **Empty Experience** — prototype scenario menu | A clear creation door, useful Stage, no empty Card or assumed open Guide |
| **Presentation/View authoring** — select/create a Presentation, place/capture a View | Thumbnail comparison, explicit Default/use, spatial Camera composition and deliberate capture |
| **Dense View collections** — 20/50-View and many-Presentation scenarios | Find/inspect every View without losing selected identity or spatial context; counts are stress fixtures, not product limits |
| **Guide closed/open** — open from Index, inspect a related Presentation/View, close | One active context; it stays available during related work and dismisses its own playback/helpers together |
| **Long Guide composition/playback** — 15/30-Stop scenarios | Sequence/insert/revisit/reorder with orientation; Cut/Travel and scrub/Follow use the same Camera evaluation |
| **Look through and Camera return** — enter from Plan/3D, compose, Update or Exit | Reviewable capture frame, explicit acceptance/discard and correct authoring return; selecting alone never navigates |
| **Stage visibility** — Show controls with/without an open Guide | Quiet context and reachable active geometry; toggles change disclosure only |
| **World/Experience continuity** — switch with a World subject selected, invoke Measure | Shared shell/identity/Camera, distinct World procedure and Experience composition; no inferred capture |

The owner accepts the current prototype despite Index collapse inconsistencies,
Camera visibility edge cases and Selection-only behavior. Guide horizontal
scrolling, overview timeline, Card positioning, responsive density and aesthetics
are **non-blocking refinement opportunities** for production. They are not
unfinished ratification gates, and #114 does not modify Conservatory to solve them.

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
| **Paper** | Spatial Stage, expressed as dark **cutting mat** for model/depth work or light **vellum** for measured drawing |
| **Instrument** | Invoked controls acting on the work: forest task surface, neutral working items and restrained edges |

The mat gives depth, artwork and geometry a dark ground. Vellum makes measured
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
the shell does not become nested dashboard cards. Spatial marks and Paper handles
retain the precision and legibility requirements of their domain grammar.

**Grid and wall sheet.** At reference architectural scale, Paper has a 1 m minor/
5 m major grid on a `1, 2, 5 × 10^n` ladder, major five times minor. Decimate by
projected CSS-pixel spacing: target at least 16 px, fade from 16 to 8 px and suppress
below 8 px. Anchor to the world/floor datum with a stable origin across interval
changes. It is drawing state, never a Camera mode or a reason to delay navigation.

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
| Mat / background / minor and major grid | `#1D3A33` / `#152C26` / `#2B5147` and `#3C6A5C` |
| Camera infrastructure / active context | Restrained leaf green (`#4f8f6c` reference), reinforced by shape/line; no mandatory competing blue/teal shell hue |
| Selection/manipulation and current playback moment | Gold (`#d4ad45`, dark ink `#74560c` reference), local contour and quiet tint; selection and playback retain different shape/text cues |
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

### State and control hierarchy (§18.3)

| State | Required distinction |
| --- | --- |
| **Hover** | Perceptual lift in chrome; restrained edge/tint below selection on Stage |
| **Armed** | Named tool/instruction and distinct active-context treatment; never a selected-identity gold echo |
| **Selected** | Coherent identity contour/edge and quiet fill across its representations |
| **Keyboard focus** | Independent visible non-hue focus cue, using focus-visible behavior |
| **Pressed/toggled or active lens/reading** | Quiet recess, edge and inset rule; does not become selection |
| **Task focus / reference / candidate** | Named context and distinct emphasis, never a selected-identity echo |
| **Authored / derived** | Distinct glyph, line or read-only treatment, especially anchors/stations |
| **Temporary inspection / ghost / Preview** | Explicit temporary or execution context; no apparent source mutation |
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
for measures, coordinates, references and time. Conservatory's serif/sans
distinction is accepted visual evidence; particular fonts and prototype pixel
sizes are not mandatory. Sentence-case section titles and clear hierarchy
separate content identity from operating instructions.

Surfaces consume semantic family/size/weight/leading and control roles. Preserve
the existing independent product-wide type/control scaling mechanism rather
than introducing component-local metrics. Primary acceptance, ordinary controls,
utilities and inline actions retain distinct roles; pressed/selected state does
not invent a size tier. Density is calibrated as a complete composition with
long names, thumbnails, precision values and keyboard focus visible.

The earlier 9/10/11/12/13/15/20 px ladder, 30/26/24/20 px control heights and
fitted Tool Tray micro-tier describe prior calibration and landed evidence.
They do not force Conservatory's destination into the previous chrome or permit
tiny ordinary text. Production metrics remain unchanged until an explicit
visual-system cutover; new calibration must preserve contrast, usable targets
and semantic hierarchy.

Preserve settled identity and Plan drafting/icon semantics where those tools
apply. A shell change does not require a wholesale icon redraw. Wall/shape/Opening
icons remain distinguishable from the marks they produce; derived Rooms do not
become authored primitives through a retained shape icon.

### Accessibility and motion

Keyboard navigation, disclosures and precision controls need non-pointer paths.
Focus remains visible independent of selection/armed state. Contrast applies to quiet
metadata too; quietness comes from hierarchy, not unreadable ink. Coarse-pointer
interactive targets need at least 44 × 44 px without changing semantic roles.
Reduced motion changes presentation, not endpoint meaning, access or source truth.

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
and retain accepted source edits. World inspection and Browse/Search procedure park;
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
| Spatial work | Cancel writer/drag proposal → leave precision for the Instrument → Put it back and deactivate reading/Instrument together → rest |
| Non-spatial component/repair work | Cancel writer/picker → leave precision for task focus → Instrument overview → close Instrument → rest |
| World Paper | Field → live gesture → procedure proposal → Find/Dimensions → armed tool to Select → Look session through Put it back → selection → rest, unwinding one applicable level at a time |

Paper's field cancellation leaves the tool armed. Ordinary rest has no destructive
Esc action. Return controls/crumbs must be obvious; exact control geometry is open.

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

At narrow desktop width the Index becomes an invoked sheet behind a compact
location control; Card becomes an invoked sheet behind a selected-identity control.
Stage stays dominant, with the active lower task surface in a coherent home.
Conditional recovery appears if current context cannot identify the selected subject.
Experience Index may compress during invoked work, while Card identity remains
legible/recoverable and the Guide instrument stays attached to Stage.

For World Paper, location and identity controls live in Head. Hide side panels uses
this same composition at any width. Sheets overlay Stage without resizing it;
opening a procedure closes the Card sheet. The scoped list remains reachable from
context menu/Find. Rail, reading cluster, scale bar and datum key remain available,
and the Instrument never covers the drafting words.

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
| Overlay Card positioning and wide World instrument arbitration | Paper/Unroll/Section precision and return remain reachable; the prototype's shrink-to-title suggestion is not a prescribed production solution |
| Index collapse, Camera visibility edge cases and Selection-only behavior | Non-blocking owner-accepted refinement opportunities; preserve identity, reach and truthful Camera representation |
| Domain-specific instrument geometry, occlusion aids and overlap disambiguation | Follow [spatial-instrument grammar](./spatial-instrument-grammar.md); preserve truthful relationships, semantic species and reachable operations without inventing constraints |
| Station-bound Cue comprehension | Verify Cues remain understandable after path-point moves, pace changes and shared-path edits; binding/ownership semantics are fixed |
| Deep coordination/scripting shell | Retain domain semantics and focused invoked editing; no new language or timeline inferred from the mock |
| Dense View collections | Thumbnails and truthful spatial Camera markers stay discoverable; grouping/filtering does not invent authored relationships |
| Camera Path interpolation | Drawn geometry follows the Camera evaluator; any smoothing is a Camera evaluation decision, not a shell control |
| Exact keyboard-focus treatment | Independent visible non-hue focus remains required; the demo's two-tone ring is a candidate, not a mandated measurement |
| Accent-tinted pressed fill reconsideration | The recessed/edge/inset baseline remains; no second treatment is introduced by a feature |
| Mat ↔ vellum transition timing and wipe/crossfade | Prevent flicker, preserve continuous spatial meaning and reduced-motion endpoints; demo timings are not product law |
| Production representation of temporary reading/parked session payloads | No authored inspection state, hidden active task or second Camera history |

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
- Lens parking, explicit revalidated Resume, spatial return and Preview exit following
  their different contracts, without source or identity surprises.

Interactive Conservatory scenarios and creator journeys lead Experience UX acceptance;
Paper requirements and V2 A–F retain their specialized behavioral roles.
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
| [Conservatory Round 2](../../../prototypes/experience-ux-alternative/README.md), [rationale](../../../prototypes/experience-ux-alternative/design-rationale.md) and [scenarios](../../../prototypes/experience-ux-alternative/scope-and-critique.md) | Accepted unified UX, Experience authoring and shared visual-shell evidence at the revision recorded above; promoted rules live here, mock mechanisms do not |
| [World final synthesis](../../../prototypes/world-experience-shell-round/design/design-synthesis.md) and [World QA package](../../../prototypes/world-experience-shell-round/QA-package/) | Prior shared/World shell record; valid discovery, procedure and return rationale survives, conflicting shell treatment is superseded |
| [Experience UX reconciliation](../../../prototypes/integrated-experience-authoring/design/experience-ux-reconciliation.md) and [Experience Design-QAs](../../../prototypes/integrated-experience-authoring/Design-QAs/) | Historical 2026-10-11 Experience design; useful behavioral rationale, no current visual acceptance authority |
| [UX3/V3 proposal](../../roadmap/p25-experience/design/experience-ux-v3/README.md), [inactive plan](../../roadmap/p25-experience/design/experience-ux-v3/implementation-plan.md) and [generated boards](../../../prototypes/experience-ux-v3/README.md) | Superseded independent proposal, rationale and Git provenance; no active implementation or PNG-equivalence gate |
| [Experience V2 final synthesis](../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) | Superseded 2026-10-01 Experience record (Set, Peek/Overview, Seam, Coordinate); provenance only. Its boards were retired 2026-10-11 except the two Camera precision specimens; Git history keeps the rest |
| [World Paper proposal](../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md) | Accepted World-only refinements, owner rulings and schematic rationale |
| [P26 surface calibration acceptance](../../roadmap/p26-spatial-depth/design/visual-system-refinement/qa/ACCEPTANCE.md), [specification](../../roadmap/p26-spatial-depth/design/visual-system-refinement/specification-plan.md) and [prototype journeys](../../../prototypes/spatial-authoring/README.md) | Mat/vellum/grid/state calibration and deep World interaction evidence; shortcuts are not production mechanisms |
| [Shell ratifications](./editor-shell-ratifications.md) and [Atlas](./editor-shell-atlas/index.html) | Existing role-system and state evidence; the Atlas's landed composition does not redefine this destination |
