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
Experience owns Presentations, Guide occurrences/order, beats, holds, continuation
and contextual orchestration. Typed resources remain independently owned.

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
| **Stage** | Continuous spatial truth, focused readings, spatial instruments and direct manipulation | Architecture, objects, inspection, drafting and manipulation | Working Set, Camera rig/routes, Stop entry pins and local spatial coordination |
| **Card** | What is canonically selected, what does it mean here, and what owns/reaches beyond this use? | Quiet identity; invoked structure/reach disclosure | Stable semantic strata for meaning, Camera use and occurrence scope |
| **Lower task home** | Contextual work at the lower working edge, with span chosen by information structure and selection identity kept in the Card | One **World Instrument** for the invoked task | One shell-owned **Experience Deck** for Guide order, Seam and coordination |

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
  require that continuity. Guide Overview, Seam bookends and local coordination
  are canonical examples. Their upper Index/Card landmarks retain their meanings;
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

**Peek is the shallow posture of the same shell-owned Deck**, with a compact rail
at the Stage edge; it need not paint the full breadth required by Overview/Seam.
This preserves a recognizable lower landmark without a large empty panel.
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

Experience uses the shared shell to author visitor meaning and encounter. It does
not create a parallel shell or renderer. The following distinctions are visible,
not merely data-model facts:

| Concept | Meaning and owner |
| --- | --- |
| **Presentation** | Reusable visitor meaning, focus and participation; Experience-owned |
| **Camera View** | Reusable framing; Camera-owned even when authored here |
| **Set** | One Presentation's unordered uses of Camera Views, with Presentation-local roles |
| **Stop** | One stable Guide occurrence referencing a Presentation; distinct from that Presentation and from a runtime visit |
| **Seam** | The transition between adjacent occurrences into the following Stop; local Guide work referencing Camera support |

**View progression ≠ Guide order ≠ Camera connectivity.** No visual graph or order
strip may imply otherwise.

### Scale × Depth

Scale asks **what am I working on?** Depth asks **how much instrument do I need?**
They are independent, not a mandatory ladder through all contexts.

| Scale contexts | Independent depth examples |
| --- | --- |
| Subject, Presentation, Camera View, Stop occurrence, Guide/Seam | Camera: Auto → Hints → Capture → Precise; Seam: route/pace → Coordination → Precision |

Changing scale does not force technical depth. Camera precision is directly reachable
from a View without a Guide, and broad Guide context does not require precision.

### Ordinary Presentation and its Card

Ordinary Experience shows Index, a dominant 3D Stage and a quiet Card, with no full
Deck, global timeline or Camera rig. No Guide means no Guide rail. A Guide that
exists earns quiet Peek awareness rather than an automatically expanded workspace.

Selecting a World subject exposes its relation to Experience. **Present this**
deliberately creates or opens a Presentation; lens switching creates nothing. A fresh
Presentation initially shows **Meaning · Focus · Show** plus an explicit
**Add behavior or offer** entry. Content earns additional **Happens**, **Visitor can**
and **Guide** strata; empty slots are not permanent machinery. Preview requires no
Guide or authored Camera graph.

The Card is a structured semantic surface: identity/target and shared-use reach at
the top, meaning/focus, Camera Show/View facts where relevant, supported behavior or
visitor offers, and Guide/use relations. It declares **Presentation**, **Camera View**
or **This Stop** honestly. Lower strata collapse; the header stays stable. Its vertical
structure does not turn into the Deck.

A Stop Card distinguishes this occurrence's entry View, Cut/Travel, pace invocation,
continuation, Gate and visitor choices from the shared Presentation's meaning and
Camera facts. Repeated occurrences may differ without duplicating shared meaning.
Opening a shared meaning/View writer from a Stop makes its owner and wider reach
legible and invokes the Ask Rule before acceptance.

### Set representation and visibility

A Set is a **Presentation-local unordered constellation**, not numbered Views or a
filmstrip. Views are located around their actual focus on Stage and schematically
around that focus when disclosed inside an occurrence. Names and supported roles
such as Entry, cue use, visitor choice or suggested framing explain each use. Use
roles are Experience facts; View pose/projection remain Camera facts.

A Show list in the Card is an inventory/door to those uses, not a sequence. Spatial
focus connectors and schematic constellation links cannot be read as Camera edges.
Coexisting Views create no route, progression or Stop. Shared-use labels disclose
reuse without creating extra View identities.

| Context | Stage disclosure |
| --- | --- |
| Ordinary Presentation, 3D or Plan | Only the working Presentation's Set, at the appropriate spatial scale |
| Guide overview | Numbered Stop entry pins only; no View constellations, entry-facing glyphs or Camera topology |
| Expanded occurrence | That occurrence's Presentation Set, spatially on Stage and schematically inside the occurrence |
| Seam | Possible origin Views, destination entry View and relevant Camera relationships for that Seam |
| Explicit connectivity inspection | Wider Camera connectivity only by a separate request |

Directional View glyphs at disclosed Set/Seam depth describe framing orientation;
they do not turn Guide overview into a Camera graph or establish new projection data.

### Experience Deck: shell ownership and Guide density

The **Experience shell owns one stable bottom Deck**. Its disclosure posture and
outer composition stay recognizable regardless of which Guide occurrence or Seam
is active. Guide contents populate it; a child editor does not replace it with its
own workbench. It occupies the lower shell span beneath the working regions when
expanded: Overview, Seam and coordination qualify for the shared breadth rule.
It is not an instrument trapped inside the Card or Index. The groups inside it
retain useful sizes rather than expanding every field to fill that span.

| Posture | Composition and purpose |
| --- | --- |
| **Peek** | A very shallow rail at the Stage edge: current occurrence/position and quiet Guide awareness. It overlays or minimally occupies the edge; no full workspace resize |
| **Overview** | A Deck heading with Guide/order context and position, then occurrence cards along editorial order. Stage supplies spatial occurrence locations |
| **Seam** | The same Deck forms two adjacent occurrence bookends around a wider central Seam instrument; unrelated occurrences compress strongly |

No Guide means no Deck rail. Adding the first Stop starts Peek, not a full-height
Deck. Expanding is creator intent. Exact heights, crop/dock behavior and spacing
remain implementation/usability choices; the stable lower home and relative rank do not.

Overview is a **fisheye**, not equal-width cards or a text-only strip:

- **L0:** compact identity/position for distant occurrences.
- **L1:** thumbnail, title, entry View name and warning state where relevant.
- **L2:** expanded occurrence with Presentation summary, unordered View constellation
  and Guide-specific details.

The active occurrence expands as appropriate; nearby occurrences may stay L1 and
distant ones compress toward L0. Expansion to L2 is its own context, not forced by
every selection. Repeated Presentations keep separate Stop identities and positions,
with shared-use context exposed without implying a fork. Neutral editorial connectors
belong in the Deck; they must not become spatial Camera routes on Stage.

The Deck supplies **editorial order**; Stage supplies **spatial occurrence location**;
Card supplies **semantic identity, ownership and scope**. These complementary homes
must compose together. Showing isolated controls or equal cards does not satisfy the
Guide overview requirement.

### Seam triptych and information homes

Opening a Seam changes the Deck posture, **not the Camera standpoint or Stage reading**.
Inspecting a relationship is different from editing its spatial support. Draw route,
anchor manipulation or route repair may explicitly request a useful Plan reading,
with a return crumb through Camera/navigation. Plan is preferred for route work,
not a compulsory consequence of opening the Seam.

The Seam composition is a triptych with compressed unrelated order at its sides:

| Home | Required information |
| --- | --- |
| **Origin bookend** | Prior Stop and Presentation identity, possible origin Views, and each origin's supported/gap status |
| **Central Seam instrument** | Seam identity into the following Stop; Cut/Travel; aggregate reachability/spatial status; Camera route summary and pace; Coordinate entry or active coordination depth |
| **Destination bookend** | Following Stop and Presentation identity, with that Stop's entry View clearly named |
| **Stage** | Scoped spatial route support, View positions, authored anchors, derived points, gap location, spatial pace cues and direct manipulation |
| **Card** | Canonical target and property owner/reach; details of the active occurrence-local beat/hold or Camera edit when needed |

Card can compress to its identity header during path work and expand for semantic
editing. It does not absorb the triptych or become a duplicate route/coordination
control panel. A task detail can describe a beat under **This Stop** while keeping
that Stop's canonical identity; task focus need not manufacture another selection.

Travel asks whether **every View the visitor may legitimately occupy at the end of
the origin Stop** can reach the destination entry View. Show per-origin status and
an aggregate such as “reachable from 2 of 3 Views.” Fixing one origin does not claim
all are fixed. Multiple origins are not merely decoration around one tested route.

**Cut** is occurrence-local entry policy and creates no Camera edge; no spatial
connection is drawn across the world. **Travel** references supported Camera
connectivity and cannot fabricate motion. Missing support remains an explicit gap.
Camera owns route geometry and pace; Experience owns the occurrence's choice/use and
coordination. Shared route/pace edits must disclose their reach.

### Local coordination and Camera/Experience responsibilities

Normal Seam depth shows route, pace and spatial status without a temporal strip.
**Coordinate**, or existing coordination on that Seam, exposes a compact local strip
inside the **central Seam panel**. The bookends and shared shell remain, and Stage
stays dominant. Coordination is not a fourth permanent workspace or a global timeline.

The strip has distinct **Route/stations · Beats · Holds** information homes. The
Camera route/station row is quiet orientation; the event row shows occurrence-local
beats; the hold row shows occurrence-local durations. A selected beat/hold exposes
its binding and reach in the Card. The central panel carries extended relation/time
structure rather than forcing that structure into vertical Card fields.

The [route/station instrument grammar](./spatial-instrument-grammar.md#camera-routes-and-experience-coordination-projections)
defines Stage route, authored-anchor, derived-helper, View/end, beat/hold and gap
species, plus spatial/temporal correspondence. The lower strip must visibly compose
those relationships, not merely contain controls with matching labels. It consumes
the shared semantic color/state roles; it does not invent another palette or graph.

Spatial and temporal projections reference **one authored relationship**. Stable
station references are departure, an authored anchor, arrival or a named marker.
A beat binds to the station rather than an independently authored seconds value;
its attachment survives route-pace changes. Generated intermediate points cannot
become station references. Mirror corresponding station/event emphasis in both
projections without equating their geometric screen positions.

**Path geometry is edited only on Stage.** The strip displays Camera stations and
lets Experience coordination be authored; it never becomes a second route editor.
Invocation time mapping evaluates through Camera. Existing coordination does not
silently retarget if its referenced station or route becomes unavailable; domain
validation/repair remains authoritative.

The destination has **no permanent global Camera Timeline**, five Camera track
lanes, duplicate scrubber or generic video-editor workbench. The maintained
editor's legacy Timeline is a landed implementation description, not the source
of Seam composition or Experience ownership.

### Progressive Camera precision

Camera disclosure proceeds through:

| Depth | What it exposes |
| --- | --- |
| **Auto** | Derived framing |
| **Hints** | Near/far, side, height, look-at and movement intent |
| **Capture** | Explicit creation of a reusable Camera View |
| **Precise** | A direct Camera instrument on Stage with Camera-owned facts and reach in the Card |

Precise depth has three available postures on the **same Camera View/route**:

- **Outside:** see the observer in the room to work on architecture relationship,
  height, distance, target or route. A subordinate framed-view inset may assist it.
- **Through:** look through the View; the image becomes the framing instrument,
  with frame gate, horizon/height, lens and target grips as supported.
- **Plan:** work on spatial relationships, connectivity, routes and anchors.

The posture switch belongs to this local Camera task. The
[Camera framing instrument grammar](./spatial-instrument-grammar.md#camera-framing-instruments)
defines truthful observer/target representation, framing grips and active-grip tapes.
The Outside specimen's circle is one possible guide, not a required orbit constraint.
Chrome and Card remain visible in Through so it is unmistakably authoring, with an
explicit spatial return. Through and Outside are both available; the initial posture
is a usability choice. Capture is deliberate, never an effect of lens switching or
inspection.

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
Experience's invoked Deck/Seam and precise Camera procedure use the same rule.
Parking authors nothing and owns no Camera snapshot/history.

Returning shows **current selection and Camera standpoint at ordinary lens rest**.
World has no active Instrument or inspection; Experience may show Peek for an
existing Guide but does not reopen Guide or precision work. The toggle restores no
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
Experience Index may compress to a spine during dense Seam work, while Card identity
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
| Deck crop/docking, exact dimensions and density thresholds | Peek stays quiet; Overview/Seam retain their composition and Stage dominance; layout changes never navigate |
| Domain-specific instrument geometry, occlusion aids and overlap disambiguation | Follow [spatial-instrument grammar](./spatial-instrument-grammar.md); preserve truthful relationships, semantic species and reachable operations without inventing constraints |
| Station-bound coordination comprehension | Verify behavior remains understandable after anchor moves, pace changes and shared-route edits; binding/ownership semantics are fixed |
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
- Experience's unordered Set, fisheye Guide occurrences, Seam triptych and local
  station/beat/hold coordination as complete compositions, not a checklist of controls.
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
| [Experience V2 final synthesis](../../../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md) and [Experience Design-QAs](../../../prototypes/integrated-experience-authoring/Design-QAs/) | Experience design record and canonical Presentation, Guide, occurrence, Seam, coordination and precision specimens |
| [World Paper proposal](../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md) | Accepted World-only refinements, owner rulings and schematic rationale |
| [P26 surface calibration acceptance](../../roadmap/p26-spatial-depth/design/visual-system-refinement/qa/ACCEPTANCE.md), [specification](../../roadmap/p26-spatial-depth/design/visual-system-refinement/specification-plan.md) and [prototype journeys](../../../prototypes/spatial-authoring/README.md) | Mat/vellum/grid/state calibration and deep World interaction evidence; shortcuts are not production mechanisms |
| [Shell ratifications](./editor-shell-ratifications.md) and [Atlas](./editor-shell-atlas/index.html) | Existing role-system and state evidence; the Atlas's landed composition does not redefine this destination |
