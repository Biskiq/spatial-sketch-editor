# Museum Editor — destination shell and visual-system contract (PLATE)

**Status: soft-frozen destination shell authority.** This document is the complete
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

World and Experience share four persistent landmarks and a contextual lower task
home. Their identity and relative hierarchy remain recognizable across lenses.

```text
HEAD — Museum Editor · project · World | Experience · active Experience · history/save · Preview
INDEX / locator       STAGE — dominant spatial work       CARD — selected identity
                      contextual lower task home
```

| Landmark | Shared responsibility | World expression | Experience expression |
| --- | --- | --- | --- |
| **Head** | Persistent project/application context, lens switch, save/history and Preview | App actions and source-history access; Paper details below | Active Experience identity in context; the same app and project actions |
| **Index** | Where am I, and where is that thing? Locator and orientation, not a primary property editor | Local place/level path, relation-aware surroundings, subject Search and Browse | Presentations and relevant relationships, including Guide awareness where present |
| **Stage** | Continuous spatial truth, focused readings, spatial instruments and direct manipulation | Architecture, objects, inspection, drafting and manipulation | Presentation focus and View markers, Stop entry pins, Camera Path geometry or Journey Cues by posture |
| **Card** | What is canonically selected, what does it mean here, and what owns/reaches beyond this use? | Quiet identity; invoked structure/reach disclosure | One inspector for the selected Presentation, View, subject, Stop, Guide edge, path point or Cue |
| **Lower task home** | Contextual work at the lower working edge, with span chosen by information structure and selection identity kept in the Card | One **World Instrument** for the invoked task | One shell-owned **Experience Deck**: Guide sequence, Camera Path topology or Journey time |

The wide shell has Index left, dominant Stage center and Card right. The Card is a
stable vertical landmark; its lower strata or width may compress when spatial work
needs room, but its canonical identity remains legible or directly recoverable.
It never morphs into the horizontal task surface. Head remains compact; Index and
Card are quiet supporting surfaces rather than equally weighted dashboards.

The lower task home is a shared composition principle, **not interchangeable task
semantics**. World Instrument is subject/task procedure. Experience Deck is extended
editorial order and local transition work. One does not inherit the other's control
layout, vocabulary, dimensions or lifecycle. Both remain attached to the shared
shell and preserve Stage dominance.

### Contextual lower-surface span

The lower home has **one composition grammar with task-appropriate span**. Its
horizontal extent follows the information that must be read and worked on together,
not the lens name, technical complexity or number of uses affected by an edit.

- **Local work** stays attached to the central Stage working region and consumes
  the width its task needs. An Opening procedure, measurement, source edit or
  repair does not earn shell breadth merely by exposing advanced controls.
- **Breadth work** may occupy the lower band beneath **Index + Stage + Card**
  when horizontal order, neighboring comparison or linked relationships materially
  require that continuity. The Experience Guide, Camera Path and Journey Decks are canonical examples. Their upper Index/Card landmarks retain their meanings;
  occupying the band beneath them is not itself sidebar collapse or an ownership change.

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

**The Experience Deck stays bounded**: compact Stop chips or a single path/time
lane, sized from content, never a large empty panel or half the window (§0.8.1).
After semantic span is decided, overlay, crop or minimal layout reallocation,
exact dimensions and responsive thresholds remain implementation/usability choices.
They must preserve spatial memory and never imply Camera navigation.

### Persistent breadth and contextual depth

At rest, project/lens identity, useful orientation, Stage and canonical Card identity
persist. Full Browse/Search depth, recovery rows, Look actions, Details, task surfaces,
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

The Card always represents canonical selection, not the current tool, host,
inspection or task focus. Its identity header remains visible in the normal panel
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

The following rules refine World authoring in the Paper reading, including its
surrounding shell. **They do not change Experience's Card or Deck.** They allow a
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
| **Card** | Identity/name, kind, up to three read-only key facts, a condition only while true, Look, Details and a scoped ⋯ list |
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

**Reconciled 2026-10-11 (PR #113) — locked for PR #114.** This expression adopts the
[Experience UX reconciliation](../../../prototypes/integrated-experience-authoring/design/experience-ux-reconciliation.md)
and its [six QA boards](#experience-qa-boards), with the adjudications recorded here. It
supersedes the 2026-10-01 expression (Set, Peek/Overview/fisheye L0–L2, Seam triptych,
Coordinate strip, Auto/Hints/Capture ladder) wherever they differ. It reorganizes exposure
only: every accepted C9 capability keeps its semantics and remains reachable. The unified
prototype still shows the earlier expression until PR #114 implements this one; it is
not shipped. Change it only for a concrete contradiction found during implementation.

Experience uses the shared shell to author visitor meaning and encounter. It does not
create a parallel shell, renderer, Camera system or selection store.

> **World provides things. A Presentation gives them visitor meaning. Views decide how
> they are seen. The Guide decides when they are met. A Camera Path decides how the
> Camera moves. A Journey decides what happens during that movement. Preview shows only
> the result.** Keep the big picture spatial and quiet; reveal precision where asked.

| Concept | Meaning | Owner |
| --- | --- | --- |
| **Presentation** | A reusable visitor-facing moment: focus on one or more subjects, a region or the environment, plus its Views. Not a container, Scene group or Camera target | Experience |
| **View** | One Camera composition used by a Presentation. A Presentation's Views are **unordered**; exactly one is its **Default View** (the `entry` role) when it has Views | Pose: Camera · use/role: Experience |
| **Stop** | One occurrence of a Presentation in a Guide, with occurrence-local entry policy, Next, pacing, Gate and choices. Editing a Stop never silently edits the shared Presentation | Experience |
| **Guide** | An optional ordered sequence of Stops | Experience |
| **Guide edge** | The directed, resolved Next continuation out of one Stop (the former *Seam*): **Cut** or **Travel**. Its identity is the pair *(from Stop, resolved Next destination)* — order-default, an explicit nonadjacent destination, End (no outgoing edge), or invalidated/needs-repair — never positional Deck adjacency. It references Camera support; it owns no geometry. Authored Go/detour visitor choices resolve Stops at run time and are not Guide edges | Experience |
| **Camera Path** | Camera-owned movement between two Views (a Camera connection): generated endpoints, authored interior **path points**, pace, evaluation. Reusable by any Guide edge whose origin/entry Views it connects | Camera |
| **Journey** | The timing of one Camera Path as played for a Guide edge **from one selected origin (the nominal Journey)**: Camera movement time plus Experience pauses, with Cues | Experience over Camera evaluation |
| **Cue** | An occurrence-local Experience moment: the invocation beats and holds sharing one **(Guide edge, Camera connection, station)** triple, where station is departure, path point, named marker or arrival. Its name comes from the named station/marker, else from its first action; its time is derived, never authored. No persisted Cue entity | Experience |

**View relation ≠ Guide order ≠ Camera connectivity ≠ Journey time.** No representation
may imply one from another. A Cue never authors a Camera pose: a turn mid-path is Camera
Path work, and a Cue may only align with it.

### Information homes

**Stage communicates spatial structure; Card communicates the selected item's detail and
operations; Deck communicates sequence, topology or time by posture.** Only one posture
is visually dominant, and only one entity inspector is shown at a time.

| Context | Stage | Index | Card (canonical selection) | Lower Deck |
| --- | --- | --- | --- | --- |
| **Presentation** ([QA 3](#experience-qa-boards)) | Focus mark plus compact named **View markers** around it; ★ on the Default | Presentations; Guide row; `+ Present` | Presentation: Focus, Views list (★ Default), Guide use, `+ Capture view`, menu | Guide Deck if a Guide exists |
| **View** (QA 3) | Same constellation, selected marker emphasized | Same | View: rendered Camera preview, Look through, Set as Default, Edit Camera, Rename, Remove from Presentation; owning Presentation summary beneath | Same |
| **Scene subject** ([QA 5](#experience-qa-boards)) | The subject's own geometry, selected | Same, plus `Browse World` | Subject: identity, Present this, **Used in Experience**, `+ Add behavior`, `+ Visitor interaction` | Same |
| **Guide / Stop** ([QA 4](#experience-qa-boards)) | Numbered Stop entry pins; the selected Stop's resolved entry View. No Camera paths | Guide row selected | Stop: Presentation link, Entry, Next, Movement summary, `Edit movement` | **Guide Deck**: ordered Stop chips with Cut/Travel edge chips, `Edit Guide` |
| **Guide edge** | Origin and destination entry Views only | Same | Edge: `A → B`, **Cut \| Travel**, origin coverage, `Edit Camera Path` | Guide Deck, edge selected |
| **Camera Path posture** ([QA 1](#experience-qa-boards)) | View endpoints, path, path points; `+ Path point`. No Cues | Path \| Journey switch; **From** origins with connected/gap status | Camera Path (pace, used by) or Path point (Remove point, Camera at this point, Look through, used by) | Straightened path topology, no time |
| **Journey posture** ([QA 2](#experience-qa-boards)) | Quiet path, endpoints, Cue markers; Camera rig during Rehearse. No path handles | Same switch; total time and Cue count | Cue: At, Pause, Actions, `Edit cue`, Look through | Time axis with Cues, playhead and `Rehearse` |
| **Edit Camera** | The precise Camera instrument (Outside/Through/Plan) | Unchanged | Camera View facts and reach | None, or the one active tape |
| **Preview** ([QA 6](#experience-qa-boards)) | Visitor runtime only | — | — | — |

### Head and Index

Head keeps the shared shell's responsibilities: project/active Experience identity, World |
Experience, Undo/Redo with verb labels, and **one Preview control with a scope menu**
(Presentation, Guide, Experience-wide). There are no other Preview entries in Index, Deck,
Card or Presenter. The boards omit Undo/Redo; it stays. No fabricated save status.

The Experience Index is a locator: **Presentations** and **Guide** rows, a single
`+ Present` creation action and `Browse World`. It holds no permanent Scene-object
inventory and no editors. It echoes only the canonical selection; a Presentation related
to a selected Scene subject is never painted as selected. In Camera Path/Journey posture its
header becomes **Camera Path** with the **Path | Journey** switch. Path posture lists the
**From** origin Views of the selected edge with connected/gap status (the multi-origin
coverage); choosing one chooses the connection being edited.

### Presentation, Views and Default View

Creation has **one canonical action, `+ Present`**, which captures the current eligible
composition as a new Presentation with one Default View, in one history step. A selected
Scene subject offers **Present this**, the same model with that subject as focus and Camera's
recommended framing. There are no permanent `+ Presentation`, `Present environment` or
`Present region` species; region and environment are focus operations. Presenting from a
Plan reading asks for explicit visitor intent (compose in 3D, or use the plan as a visitor
View, or cancel) and never captures Plan silently. Lens switching and inspection create nothing.

Views are unordered. On Stage they are **compact markers placed semi-spatially around the
Presentation focus**: bearing/side preserved in the current Stage orientation, distance
compressed, no metric claim, no numbers, arrows or sequence. Stage never shows a wall of
thumbnails. The Default carries a restrained ★ and its name, not a banner. Selecting a
marker or a Views-list row selects that View use and shows its **faithful rendered Camera
preview in the Card**; it moves no Camera. Look through and Edit Camera are explicit.

A Presentation Card shows identity, Focus, the Views list (the keyboard inventory, ★ on the
Default), Guide use and `+ Capture view`; its menu holds Rename, Advanced authoring and
Remove. It keeps one compact ordinary **Add explanation** entry, visible even when no
explanation exists, which opens the existing focused explanation writer; once authored,
the entry becomes a quiet summary that reopens it. Other narration, behaviors and offers
are not ordinary fields: when authored they earn one quiet summary that opens Advanced authoring. A View Card shows the View, its preview and its
operations, then the owning Presentation as context, not as a second editor.

Default is shared by every use of the Presentation; a Stop's Specific View entry overrides
it locally. Default is an entry role, not an exclusion rule: it remains eligible as a
visitor View choice, including when the visitor entered through another View. A Presentation without Views is valid ("No View · uses current viewpoint"). An
unset Default and a missing referenced View are distinct named states. **Remove from
Presentation** unlinks one use and discloses its Default, Stop-entry, Cue and Travel
consequences; it never deletes Camera truth used elsewhere or picks a replacement silently.

### Scene subjects

**The Stage is the primary Scene browser:** a visible subject is normally clickable.
`Browse World` (and Head search) opens the shared World locator for hidden, occluded,
tiny, off-screen, logical or keyboard-only subjects; it selects through the same
selection authority and moves no Camera unless a navigation verb is chosen.

The subject Card leads with identity and kind, then **Present this**, then **Used in
Experience** (each Presentation, Stop or Experience-wide use and what it does), then
`+ Add behavior` and `+ Visitor interaction`. Capability selection, audition and
configuration appear **only after** one of those is invoked, for the one chosen operation.
No capability inventory, Play/Stop/On/Off rows or adapter controls rest on the Card.
**Scene subject selection and Presentation selection remain distinct identities.**

### Guide, Stops and Guide edges

No Guide means no Guide Deck. **Add to Guide** creates one Stop and selects it. The **Guide
Deck** is the single Guide home: `GUIDE · name · n Stops`, compact named Stop chips in order
(number, Presentation name, optional entry-View image), outgoing edge chips per Stop, and
`Edit Guide`. An edge chip names the Stop's resolved continuation: order-default Cut/Travel,
an explicit destination (`→ C`), End, or needs-repair. An inter-chip connector is drawn
only when the resolved destination is the adjacent Stop; a nonadjacent destination is shown
on the outgoing Stop's own chip, never as a false adjacency. It stays bounded, a shallow band rather than half the window. There is no
Peek/Overview/Expand vocabulary, no expanded L2 occurrence and no second Guide editor.
`Edit Guide` is the deliberate order posture: move, repeat and remove Stops in one context
menu, with Undo.

Selecting a Stop edits that occurrence in the Card: Presentation link (Open Presentation),
**Entry** (Presentation Default · Specific View · Keep current viewpoint), **Next**,
**Movement** summary and `Edit movement`, which selects the edge. *Presentation Default* is
an entry **policy**; Stage labels the resolved View by its own name. Pacing, dwell, Gate and
visitor choices sit under deliberate Stop detail.

Selecting an edge edits the resolved continuation's movement: **Cut \| Travel**, the aggregate origin coverage
("reachable from 2 of 3 Views") and `Edit Camera Path`. Edge selection is revalidated
against the resolved Next on every read: a stale pair clears or reports needs-repair and is
never silently retargeted to a positional neighbor. **Cut** creates no Camera edge.
**Travel** is the explicit Camera-owned preparation that reuses existing Camera Paths and
creates only missing direct ones; gaps remain explicit. Ordinary Guide editing never draws
Camera Paths across the Stage. There is no graph editor: branching is shown only through the
outgoing chip's destination indicator.

### Camera Path and Journey postures

`Edit Camera Path` enters one task with two postures over the same connection; switching
posture changes neither selection nor Camera. Opening it does not move the authoring view.

**Path posture edits geometry on Stage.** Show View endpoints (● with frustum), the evaluated
path and small unlabeled path points (○); the selected point has the amber ring (◎). Points
are added only through the armed **`+ Path point`** action; ordinary clicks never create
geometry. Points drag directly. A selected point's Card offers Remove point, **Camera at
this point** (a preview evaluated by the Camera kernel at that station, with Look through)
and Used by. The path's own Card carries its one **Pace** writer and shared-use reach. The
Deck is a straightened topology overview (endpoints, points, selection mirrored with Stage),
without time, Cues, narration or holds. No `Anchor N` labels, coordinate panel or
Curve/Smooth controls unless Camera exposes a real author-facing mode. Draw only the
geometry the evaluator actually follows.

**Journey posture edits time and Cues for one selected origin's nominal Journey.** The origin
is shown and changeable within Journey posture, without a round-trip through Path posture.
Stage keeps the path quiet and handle-free, shows
Cue markers (◆) at their stations and, during Rehearse, the moving Camera rig. The Deck is a
real time axis from 0:00 to the derived total, with Cues placed by evaluated time and a
playhead; its header names the Guide edge and the selected origin, since one Camera
connection may serve several Guide occurrences. A selected Cue's Card shows its name, the
Guide occurrence and shared Camera reach, **At** (derived), **Pause** (the summed hold
durations at its station, with hold count when more than one), **Actions** and `Edit cue`.
With one hold, Pause edits that hold directly; with several, **Edit holds** inspects or
edits the individual holds — a summary-field edit never silently consolidates, deletes or
replaces distinct authored holds. Moving a Cue rebinds its beats to another station within
the same Guide edge and Camera connection, as one validated history transaction that updates
every constituent beat together with each invoked Activity's station binding, or refuses
without mutation; an occupied destination station refuses rather than merging. Selection
follows a successful move, and Undo restores the previous grouping. A Cue never stores seconds. Deep Cue editing is a deliberate posture.
**Total = Camera movement time + pauses**, derived from the same Camera evaluation and
coordination timing used at run time; there is no second animation model. Rehearse and
runtime agree for identical invocation inputs; a visitor departing early or from another
eligible View may observe different times without anything being broken. The total does not
imply every visitor action has completed.

**Rehearse is editor playback; Preview is the visitor run.** Rehearse plays and scrubs one
Journey through Camera evaluation, moving a rig marker while the authoring view stays
put. Look through at the playhead is explicit. Rehearse writes no source and executes no
visitor actions; it marks Cues as they pass.

### Camera View precision

`Edit Camera` from a View opens the precise Camera task (Outside, Through, Plan) at the
current standpoint, with one active grip tape, the Camera Card and explicit return; see
[Camera framing instruments](./spatial-instrument-grammar.md#camera-framing-instruments).
Recommended framing (formerly Auto/Hints) is an invoked option, not a ladder; capture is
`+ Capture view`. A selected View's movement-speed preference is advanced Camera request
detail, never a Guide pace writer.

### Advanced authoring

One invoked **Advanced authoring** home per Presentation/Experience reaches narration and
captions, behaviors and lifecycle, visitor offers and availability, automatic View switching
(formerly "Automatic View cue", renamed so *Cue* means Journey Cues only) and suggestions.
Its writers are the existing ones. Repair notices route to their exact owner. The final
deep Cue/scripting shell is deliberately unresolved; implementations use a focused Card
editor and invent no workspace, language or timeline.

### Visitor Preview

Preview is the museum experience, not the editor with panels hidden. It removes Head,
lenses, Index, Card, Deck, grid, Camera geometry and every author term (Presentation, View,
Default, Stop number, Cue, capability names). The visitor sees content, **Back** and **Next**,
alternate Views as semantic choices labelled by their names (thumbnails optional), offers and
exactly one restrained **Exit Preview**. It runs the actual runtime and renderer; generated
board artwork is not a fidelity target.

### Experience visual language

Experience consumes the shared [material, color, type and state roles](#visual-and-state-grammar-07):
warm ivory working surfaces, charcoal type, teal for Camera infrastructure, small amber for
selection and the active manipulation, thin borders, minimal shadow, compact controls, a
dominant Stage, a contextual Card and a bounded Deck. Avoid glossy dashboard styling,
heavy cards, gradients, floating tool clusters and dense Stage labels. Stage carries no
numbers, capability lists, timing labels, Camera parameters or scripting text.

### Experience QA boards

The boards in [`Design-QAs/`](../../../prototypes/integrated-experience-authoring/Design-QAs/)
are **acceptance guardrails for information homes, hierarchy, selected-entity semantics,
visible-versus-disclosed capability, posture, terminology and Camera/Experience separation**.
They are not pixel specifications. Generated assets, lighting, icons, exact spacing,
incidental labels and the Head's project chip establish nothing. Where an image conflicts with
this text, the text wins.

| Board | Guards | Interpretation note |
| --- | --- | --- |
| `qa-1-camera-path.png` | Direct path geometry, Path vs Journey, endpoint/point/selection species, From coverage, no timing | Curvature drawn only if the evaluator follows it |
| `qa-2-journey.png` | Time over movement, no path handles, Rehearse/scrub, shallow Cue summary | Cue *At* is derived; the Deck shows the selected origin's nominal Journey and names its Guide edge and origin, and the Cue Card discloses the Guide occurrence |
| `qa-3-presentation-views.png` | Focus, compact View markers, ★ Default, preview in Card, `+ Present` | The owner summary beneath the View is context, not a second inspector |
| `qa-4-guide-stops.png` | One Guide home, Stop vs edge, Cut/Travel, no Camera paths | The Stage label must name the resolved View, not "Presentation Default". Edge chips show resolved outgoing continuation (order-default, explicit destination, End, needs-repair); connectors only join truly adjacent destinations |
| `qa-5-scene-subject.png` | Stage browsing, `Browse World`, usage before capability, closed disclosure | The highlighted Index row is drift; no related Presentation is selected |
| `qa-6-visitor-preview.png` | Isolation, Back/Next, View choices in visitor language, one Exit Preview | Use the real renderer |
| `camera-precision-outside.png`, `camera-precision-through.png` | Edit Camera precision postures, truthful observer/frustum, one tape, explicit return | Retained from the 2026-10-01 set; their Index/Head/status-line chrome is superseded by this section |

## Visual and state grammar (§0.7)

<a id="071-authority-and-evidence-for-the-destination"></a>

The product character comes from structure, material, type and interaction:
professional spatial work with warm surfaces, restrained technical ink and compact
controls in a quiet engineered chassis. Rich capability gathers around the current
question instead of making every region louder. Plan and 3D retain the same visual
system; alternate themes must preserve its hierarchy and semantics.

### Material and working surfaces (§4.4)

PLATE has exactly three material classes; a task name is not a new material class.

| Class | Role |
| --- | --- |
| **Chassis** | Persistent Head, Index, Card and Deck shell: pale, stable, quiet, mostly square, separated by alignment, hairlines and tonal steps |
| **Paper** | Spatial Stage, expressed as dark **cutting mat** for model/depth work or light **vellum** for measured drawing |
| **Instrument** | Controls acting on the work: compact manufactured edges, small radii, mechanically attached to the shell/Stage |

The mat gives depth, artwork and geometry a dark ground. Vellum makes measured
architecture the drawing subject. Ink and ochre are mark/state roles, not additional
materials. Section, Unroll or precision can use a measured vellum reading without
creating another shell. A camera route on Plan uses the same Paper as World drafting;
Experience does not invent a separate theme or drawing surface.

A 1 CSS px inset perimeter separates Paper from chassis without reducing the canvas
rectangle or changing Camera aspect, pointer mapping or overlay coordinates. It
intercepts no picking and covers neither edge controls nor focus indicators.
Major chassis surfaces have no decorative shadows or nested floating dashboard
cards. Instrument controls may have about 3 px radius and Paper handles about 2 px;
use roles and restrained edges, not pills as a general style. Occurrence cards are
semantic order items inside the Deck, not permission to turn all shell panels into cards.

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

| Role | Destination calibration |
| --- | --- |
| Vellum | `#F3F4EE` |
| Chassis main / recessed or armed / hover | `#EEEDE8` / `#E2E0D8` / `#F0EFE9` |
| Instrument surface | `#F8F8F4` |
| Primary technical / reference dimension ink on light surfaces | `#202422` / `#3E4440` |
| Light overlay ink/halo | `#F3F4EE` |
| Paper grid minor / major | `#9FB2A2` at 0.28 / `#809984` at 0.45 |
| Mat / background / minor and major grid | `#1D3A33` / `#152C26` / `#2B5147` and `#3C6A5C` |
| Camera infrastructure | Restrained cyan/teal; the existing Camera accent role is `#347D89` |
| Selection/manipulation core / dark boundary on light surfaces | `#E5A020` / `#8A5B10`; quiet fill at 0.10 over the local surface |
| Clearance caution | `#F7EDE8` surface, `#C85A48` accent, `#3A241D` body, `#7E2718` action |
| Refusal | `#FDF3F0` fill, `#7E2718` text, terracotta edge |
| View-only displacement | `#56707C`, dashed |

Values are separate semantic roles even when equal. Minor luminance calibration for
contrast is allowed; do not incidentally recolor caution, history, branding or return
by changing selection. The drafting sheet matches vellum so rolling a Wall does not
read as a material replacement. Intentionally open gaps retain their distinct open
state, not refusal by default.

**Canonical selection has the strongest ochre treatment; active lens is neutral.**
The lens switch uses a quiet pressed/active chassis cue, never a competing amber
selection. Task focus, referenced subjects and repair candidates are distinguishable
without selecting them. Branding/history tape never carries selection.

Selection is a persistent contour and quiet tint, never a page flood. On paper use
the dark boundary; on the mat use the ochre core; variable content may need a two-tone
stroke/halo. The sheet/grid remain visible. Manipulation emphasizes the active handle,
affected edge and measurement rather than every dimension or the entire Card.
Unselected architecture and Camera context remain quiet enough for selection to read.

### State and control hierarchy (§18.3)

| State | Required distinction |
| --- | --- |
| **Hover** | Perceptual lift in chrome; restrained edge/tint below selection on Stage |
| **Armed** | Neutral material sink, full normal ink; no amber outline, accent edge or label-weight jump |
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

Use a warm humanist sans for UI and a narrow mechanical mono for measures,
coordinates, compact references, timestamps and precision. Headings gain rank
through structure and weight, not inflation.

The nominal ladder is **9 / 10 / 11 / 12 / 13 / 15 / 20 px at scale 1**: mono ticks,
engraved/meta, compact readouts, rows/controls, property values, panel headings and
exceptional project identity. Surfaces consume family/size/weight/leading **roles**,
not literals. Existing calibrated identity and fitted rail roles are scoped outcomes,
not permission to add arbitrary sizes.

| Control role | Scale-1 height / horizontal padding | Type role | Use |
| --- | --- | --- | --- |
| **lg** | 30 / 9 px | control | Primary actions |
| **md** | 26 / 9 px | control | Head and forms |
| **sm** | 24 / 8 px | utility | Utilities, tabs and icon controls |
| **xs** | 20 / 6 px | utility | Inline row actions |

Control type is the 12 px role; utility type is the 10 px role. Height, padding
and type travel together through the role system; pressed state is not a new role.

Type and control scales are independent product-wide factors, applied at the document
root so derived tokens re-evaluate there. Standard row roles retain the calibrated
29 px row, 12 px text, 10 px mono reference and 18 px disclosure affordance/26 px target;
section labels use the quiet engraved tier. These are role-system baselines, not
fixed Index/Card/Deck dimensions or measurements to extract from historical QA.

The maintained 44 px Tool Tray has a scoped fitted micro-tier: 7 px group, 8 px tool,
6 px opt-in floor only where a group word cannot fit. Do not generalize that floor to
ordinary typography or force the destination rail into obsolete group vocabulary.
Destination rail fitting consumes the role system and its actual pointer-family
composition. The retained project identity role calibrates to 14 px; it does not
require growing the Head band.

Preserve settled identity and Plan drafting/icon semantics where those tools still
apply. General icons stay in the existing family; a new shell does not license a
wholesale redraw. Wall/shape/Opening icons remain distinguishable from the marks
they produce; the Plan Door cue is perpendicular three-dash ink, not its toolbar icon.
Derived Rooms are not restored as authored primitives by retaining a shape icon.

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
Experience's Edit Guide, Camera Path/Journey postures and precise Camera procedure use the same rule.
Parking authors nothing and owns no Camera snapshot/history.

Returning shows **current selection and Camera standpoint at ordinary lens rest**.
World has no active Instrument or inspection; Experience may show the compact Guide Deck for an existing Guide but does not reopen
Edit Guide, Camera Path/Journey or precision work. The toggle restores no
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
Experience Index may compress to a spine during Camera Path/Journey work, while Card identity
remains legible/recoverable and the Deck still belongs to the shell.

For World Paper, location and identity controls live in Head. Hide side panels uses
this same composition at any width. Sheets overlay Stage without resizing it;
opening a procedure closes the Card sheet. The scoped list remains reachable from
context menu/Find. Rail, reading cluster, scale bar and datum key remain available,
and the Instrument never covers the drafting words.

Shell resizing, Deck expansion or sheet presentation is **layout behavior**: it
must not imply a Camera fit, pan, fly-to or authored Camera change. Preserve the
standpoint and spatial memory as the visible rectangle changes. Explicit spatial
operations may request framing through Camera; layout changes cannot smuggle in
that request. Breakpoints, exact widths/heights and Deck crop/docking mechanics
are implementation/usability choices, not raster-derived product rules.

## Open implementation and usability choices (§0.3 · §0.7.6)

Only the choices below remain open; they do not reopen the shell architecture.

| Choice | Fixed constraint |
| --- | --- |
| Initial precise Camera posture: Through or Outside | Both are available, use the same Camera authority, and keep authoring distinct from Preview |
| Deck crop/docking, exact dimensions and density thresholds | The Experience Deck stays bounded with one posture at a time and Stage dominance; layout changes never navigate |
| Domain-specific instrument geometry, occlusion aids and overlap disambiguation | Follow [spatial-instrument grammar](./spatial-instrument-grammar.md); preserve truthful relationships, semantic species and reachable operations without inventing constraints |
| Station-bound Cue comprehension | Verify Cues remain understandable after path-point moves, pace changes and shared-path edits; binding/ownership semantics are fixed |
| Deep Cue/scripting shell | A focused Card editor meanwhile; no new workspace, language or timeline until designed |
| Dense View constellations | Markers stay unordered and semi-spatial; clustering/label-on-hover only if real density requires it |
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
- Experience's unordered Views with one Default, compact Guide Deck with Stop/edge
  inspectors, Camera Path and Journey postures with Rehearse, and usage-first Scene
  subjects, as complete compositions rather than a checklist of controls.
- Camera geometry/evaluation distinct from Experience order/coordination, with
  explicit scope and gaps, generated/authored distinctions and no legacy Timeline model.
- Coherent material, typography, controls, selection/active-lens hierarchy, accessible
  state distinctions and local precision/refusal.
- Lens parking, explicit revalidated Resume, spatial return and Preview exit following
  their different contracts, without source or identity surprises.

Reference images calibrate relative hierarchy, information homes, spatial instruments
and visual grammar. Exact pixels, fixture values, names/counts, incidental wording,
generator artifacts and prototype shortcuts are not product contracts. Repeated
composition supported by written design is meaningful evidence, not optional because
it appears in a raster. Implementation experiments may vary only within the fixed
constraints above.

## Design evidence

These retained artifacts explain rationale and supply specimens; they are not a
fallback specification that a future designer must reopen or an authority cycle.

| Evidence | Role |
| --- | --- |
| [World final synthesis](../../../prototypes/world-experience-shell-round/design/design-synthesis.md) and [World QA package](../../../prototypes/world-experience-shell-round/QA-package/) | Shared/World design record and all ten composition/disclosure specimens |
| [Experience UX reconciliation](../../../prototypes/integrated-experience-authoring/design/experience-ux-reconciliation.md) and [Experience Design-QAs](../../../prototypes/integrated-experience-authoring/Design-QAs/) | Experience design record (2026-10-11) and the eight canonical specimens indexed in [§0.8.1](#experience-qa-boards) |
| [Experience V2 final synthesis](../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) | Superseded 2026-10-01 Experience record (Set, Peek/Overview, Seam, Coordinate); provenance only. Its boards were retired 2026-10-11 except the two Camera precision specimens; Git history keeps the rest |
| [World Paper proposal](../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md) | Accepted World-only refinements, owner rulings and schematic rationale |
| [P26 surface calibration acceptance](../../roadmap/p26-spatial-depth/design/visual-system-refinement/qa/ACCEPTANCE.md), [specification](../../roadmap/p26-spatial-depth/design/visual-system-refinement/specification-plan.md) and [prototype journeys](../../../prototypes/spatial-authoring/README.md) | Mat/vellum/grid/state calibration and deep World interaction evidence; shortcuts are not production mechanisms |
| [Shell ratifications](./editor-shell-ratifications.md) and [Atlas](./editor-shell-atlas/index.html) | Existing role-system and state evidence; the Atlas's landed composition does not redefine this destination |
