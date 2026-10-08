# Museum Editor V2 Experience UX Reconciliation
## Model, Shell, Visual Language, and QA Guardrails

**Status:** Design synthesis / reconciliation proposal for final adjudication in PR #113  
**Purpose:** Give the planner a single coherent interpretation of the Experience model and the new six-image QA set before updating canonical references and preparing the implementation overhaul.

This document synthesizes the product direction reached during the post-C9 UX review. It should be reviewed against the current prototype, accepted C9 behavior, existing shell references, and older V2 design boards.

The QA images are **design guardrails, not pixel-perfect implementation specifications**. Where this synthesis or a new QA board conflicts with an older Experience-authoring board, the new reconciliation is intended to supersede the older interaction expression after explicit adjudication.

---

# 1. Product model

The revised Experience model is:

```text
WORLD
  Scene subjects / architecture

EXPERIENCE
  Presentation
    Focus
    Views[]
    Default View

  Guide
    Stops[]
      references Presentation
      entry policy / resolved entry View

CAMERA
  Views
  Camera Paths between Views

JOURNEY
  timing + Experience Cues layered over Camera movement

PREVIEW
  visitor-facing execution of the authored Experience
```

The primary authoring flow is:

```text
World subject
    ↓
Presentation / Views
    ↓
Guide / Stops
    ↓
Camera Path
    ↓
Journey / Cues
    ↓
Visitor Preview
```

Each layer should have one clear responsibility.

---

# 2. Core concepts

## 2.1 Presentation

A **Presentation is a reusable visitor-facing moment**.

It answers:

> What is being presented to the visitor?

A Presentation is not merely a wrapper around one Scene object.

It may concern:

- one object,
- several objects,
- part of a room,
- a larger architectural composition,
- or an environmental/spatial subject.

For example, an entire rotunda may be one Presentation without requiring a synthetic `Rotunda` Scene object.

Presentation Focus remains grounded in World/Scene truth.

A Presentation owns:

- semantic focus,
- a set of Camera Views,
- one Default View.

It does **not** own:

- Guide order,
- Camera movement geometry,
- Journey timing,
- global Scene objects.

## 2.2 Views

A **View is a Camera composition associated with a Presentation**.

Views answer:

> How can the visitor see this Presentation?

Views are:

- unordered,
- spatially related to the Presentation focus,
- reusable Camera compositions.

A Presentation has one **Default View**, which is its ordinary opening composition unless a Stop overrides entry behavior.

Example:

```text
Presentation: Piano

★ Default overview
Under the lid
Keyboard detail
Side view
```

Views are not Guide steps and should not be presented as a sequence.

## 2.3 Stop

A **Stop is one occurrence of a Presentation in a Guide**.

```text
Presentation: Piano
        ↓
Guide: Hall tour
        ↓
Stop 3: Piano
```

The Presentation remains reusable.

The Stop owns occurrence-specific Guide behavior such as:

- position in Guide order,
- entry policy,
- next relationship,
- occurrence-level controls.

Editing a Stop must not silently mutate shared Presentation meaning.

## 2.4 Guide

A **Guide is an ordered sequence of Stops**.

```text
Intro → Rotunda → Piano → Gallery exit → Finish
```

Guide authoring answers:

> In what order does the visitor encounter these Presentations?

The Guide does **not** own Camera geometry.

Connections between Stops may request movement semantics such as:

```text
Cut
Travel
```

but Camera remains responsible for the actual View-to-View movement.

## 2.5 Camera Path

A **Camera Path is Camera-owned spatial movement between Views**.

Conceptually:

```text
View A ───── Camera Path ───── View B
```

This relationship should not fundamentally belong to a Guide edge.

A Guide edge may use a Camera Path, but Camera owns:

- path geometry,
- Camera evaluation,
- View-to-View connectivity.

This allows the same Camera infrastructure to eventually support movement:

- between different Stops,
- between Views inside one Presentation,
- from other Experience mechanisms,

without inventing another Camera system.

## 2.6 Journey

A **Journey is the Experience timing layer over Camera movement**.

Camera Path answers:

> Where does the Camera move?

Journey answers:

> What happens, and when, while that movement plays?

Conceptually:

```text
CAMERA

View A ─────────────── View B
       Camera Path


EXPERIENCE

0:00 ───── ◆ ───────── ◆ ───── 0:14
            Cue         Cue
```

Camera geometry and Experience Cues remain separate objects.

Experience must not become a second Camera keyframing system.

## 2.7 Cue

A **Cue is an Experience event associated with a moment during a Journey**.

`Cue` is preferred author-facing language over:

- Beat,
- Station,
- Checkpoint,
- raw trigger terminology.

A Cue may represent:

- pause,
- narration,
- highlighting,
- invoking authored behavior,
- visitor interaction,
- another Experience action.

Ordinary Cue selection should remain shallow.

Example:

```text
CUE

Piano reveal

At · 0:05
Pause · 1.2 s
Actions · 2

Narration
Highlight piano

[ Edit cue ]
```

Deep Cue scripting should require a deliberate deeper authoring posture and should **not** be dumped into the ordinary inspector.

The exact deep-scripting shell remains a separate design problem.

---

# 3. Camera Path vs Journey

These should feel like two postures over the same connection.

```text
CAMERA PATH                     JOURNEY

edit physical geometry          edit timing + events

Stage:
path points visible             Cues visible
Cues hidden                     path handles hidden

Deck:
structural path overview        real time-based timeline

Card:
Camera/path detail              Cue summary
```

Only one posture should be visually dominant at a time.

## Path posture

Stage shows:

- Camera View endpoints,
- Camera Path,
- draggable path geometry,
- selected path point.

Stage hides:

- Cues,
- Journey timing,
- narration/event labels.

The Stage is the primary spatial path editor.

Path creation must be explicit, for example:

```text
+ Path point
```

Ordinary clicking must not unpredictably create geometry.

## Journey posture

Stage shows:

- quiet Camera Path context,
- start/end Views,
- moving Camera rig during rehearsal,
- Experience Cue markers.

Stage hides:

- editable Camera path handles.

The lower Deck becomes a real time representation.

---

# 4. Rehearse vs Preview

These are distinct operations.

## Rehearse

**Rehearse** is editor playback.

It allows the author to:

- play the Journey,
- scrub time,
- watch the Camera rig move through the Stage,
- inspect timing and Cue behavior,
- remain in authoring context.

The author viewpoint should not automatically become the visitor Camera.

A deliberate:

```text
Look through
```

may inspect the evaluated Camera perspective.

## Preview

**Preview** is the visitor experience itself.

Preview removes the authoring shell and exposes only visitor-facing meaning.

```text
Rehearse = inspect authored choreography
Preview   = experience the result as the visitor
```

---

# 5. Presentation authoring

The old Presentation surface exposed too many unrelated concerns at once:

- editable Name field,
- narration textarea,
- Focus controls,
- Select / Operate,
- `Show · unordered set`,
- Auto,
- Hints,
- Capture,
- intent,
- behaviors,
- offers,
- Camera suggestions,
- movement settings.

This produced a dense inspector that mixed semantic composition, Camera work, scripting, capability authoring, and visitor narration.

The reconciled direction is much narrower.

## Presentation selection

Selecting a Presentation should primarily answer:

> What is this moment about, and what ways have I authored to see it?

The Stage shows:

- Presentation focus,
- compact View markers around the focus,
- selected View,
- Default View status.

The right Card shows details for the selected View.

---

# 6. View constellation

Do **not** permanently render a thumbnail for every View on the Stage.

That does not scale and turns the Stage into a contact sheet.

Instead:

```text
                  ★
                  ●
          Default overview


      ●                         ●
 Under the lid               Side view

                 Piano

                  ●
          Keyboard detail
```

View placement is **semi-spatial**:

- preserve coarse bearing / side around the focus,
- compress distance,
- do not imply metric location,
- do not imply sequence.

Compact Stage markers communicate spatial relationships.

Selecting a View shows its actual rendered Camera preview in the right Card.

This repeats the same interaction grammar established by Camera Path authoring:

```text
Stage selection
      ↓
right Card preview / details
```

## Selected View Card

Example:

```text
VIEW

Under the lid

Presentation · Piano
Default · No

CAMERA VIEW
[ rendered snapshot ]

[ Look through ]
[ Set as Default ]
[ Edit Camera ]

Rename
Remove from Presentation
```

The exact action density may be refined, but the important rule is:

> Stage communicates spatial relationship.  
> Card communicates preview and operations.

---

# 7. Default View

One View is the Presentation's Default View.

Default status should be semantically clear but visually restrained.

Avoid oversized banners or treating Default as a separate View type.

Example Stage notation:

```text
★ Default overview
```

The Default View is the normal entry composition unless a Stop explicitly resolves otherwise.

---

# 8. Presentation creation

The Experience surface should have one canonical creation action:

```text
+ Present
```

Do not permanently expose separate top-level actions such as:

- `+ Presentation`
- `Present environment`
- `Present region`

Specific contextual shortcuts may still exist.

For a selected Scene subject:

```text
Present this
```

is a shortcut into the same Presentation model.

A generic Presentation can still represent:

- one object,
- several objects,
- a region,
- a larger environment.

These differences belong to focus authoring, not separate Presentation species.

---

# 9. Direct Scene subject selection

The Stage should be the primary Scene browser.

Core rule:

> If an author can see a meaningful museum subject, they should normally be able to click it.

A permanent Scene object inventory should not occupy the Experience sidebar.

For objects that are:

- off-screen,
- hidden,
- occluded,
- tiny,
- logically non-visible,
- difficult to distinguish,
- needed for keyboard/accessibility workflows,

provide an on-demand fallback such as:

```text
Browse World
```

or search.

The fallback must use the same selection authority as direct Stage selection.

---

# 10. Selected Scene subject Card

Selecting a World object in Experience mode should **not** dump its capability registry.

Ordinary state:

```text
MECHANICAL DISPLAY
Scene object

[ Present this ]

USED IN EXPERIENCE

Mechanism demonstration
Open casing

Gallery introduction
Highlight

[ + Add behavior ]
[ + Visitor interaction ]
```

The Card emphasizes:

1. identity,
2. current Experience usage,
3. a small number of next actions.

Only after the author explicitly chooses:

```text
+ Add behavior
```

or:

```text
+ Visitor interaction
```

should capability selection/configuration appear.

Do not permanently expose:

- Play,
- Stop,
- Highlight,
- Visible,
- Rotate,
- Open,
- Speed,
- every adapter capability.

Existing authored relationships are more important than theoretical capability inventory.

---

# 11. Selection authority

Scene subject selection and Presentation selection must remain distinct identities.

Selecting a Scene subject should not implicitly imply that a Presentation with a similar name is now the selected entity.

For example:

```text
Stage selection:
Mechanical display        ← World subject

Related Experience use:
Mechanism demonstration   ← Presentation
```

The Card may expose the relationship, but the selection system must remain deterministic.

This is especially important for:

- history,
- undo,
- keyboard workflows,
- cross-domain navigation.

---

# 12. Guide authoring

The ordinary Guide should have **one coherent home**.

Do not retain multiple competing surfaces such as:

- Preview Guide,
- Overview,
- Peek,
- Expand,
- giant occurrence cards.

The reconciled ordinary state uses a bounded lower Guide Deck.

Example:

```text
GUIDE · Hall tour

[1 Intro] → [2 Rotunda] → [3 Piano] ─ Travel → [4 Gallery exit] → [5 Finish]
```

The Guide Deck communicates:

- Stop order,
- Presentation identity,
- selected Stop,
- compact movement relationships.

It should not consume half the application.

---

# 13. Stop selection

Selecting a Stop edits the occurrence.

Example right Card:

```text
STOP 3

Piano

Presentation · Piano

Entry
Presentation Default

Next
Gallery exit

Movement
Travel

Piano overview → Gallery door
Camera Path · ready

[ Edit movement ]
```

Important:

`Presentation Default` is an **entry policy**, not the identity of the Camera View.

On the Stage, if showing a resolved View, use the resolved View identity rather than labeling the Camera marker `Presentation Default`.

---

# 14. Guide edge selection

Selecting the connection between Stops edits movement.

Conceptually:

```text
Stop 3            Stop 4
Piano   ───────→  Gallery exit
          Travel
```

Selecting that edge can expose:

```text
Piano → Gallery exit

Cut | Travel

Travel

Piano overview → Gallery door

[ Edit Camera Path ]
```

The Guide chooses/references movement.

It does not own the Camera Path.

Do not show the Stop inspector and edge inspector simultaneously.

---

# 15. Cut and Travel

Guide movement should remain conceptually simple.

## Cut

No Camera traversal.

The visitor arrives at the destination composition.

## Travel

Uses/reuses a Camera-owned View-to-View path.

```text
Guide edge
    ↓
Travel
    ↓
View A → Camera Path → View B
```

Only deliberate movement editing should expose Camera Path authoring.

Ordinary Guide editing should not display Camera paths across the Stage.

---

# 16. Camera Path editing

Camera Path authoring should reuse mature spatial-editing conventions.

The Stage is primary.

Show:

- Camera View endpoints,
- direct path curve,
- small unlabeled geometry points,
- selected geometry.

Avoid:

- `Anchor 1`,
- `Anchor 2`,
- coordinate dashboards,
- automatic point insertion from ordinary clicks,
- unnecessary technical labels.

Visual grammar:

```text
● + frustum     Camera View endpoint
○               Camera path geometry
◎ amber ring    selected path point
```

Camera-path curvature should be edited directly on Stage.

Do not create duplicate controls such as:

```text
Curve
Smooth
```

unless the actual Camera implementation exposes a meaningful author-facing mode that cannot be expressed through direct manipulation.

---

# 17. Camera Path inspector

Do not fill empty inspector space merely because it exists.

For a selected path point:

```text
PATH POINT

Piano overview → Gallery door

Drag this point to reshape the path.

[ Remove point ]

CAMERA AT THIS POINT

[ Camera preview ]

[ Look through ]

USED BY
Guide · Stop 4 → Stop 5
```

This is useful because the Stage edits geometry while the Card can show the Camera result.

The Camera preview should use the actual Camera evaluator.

Do not invent an arbitrary Camera pose if selected path geometry does not truthfully correspond to an evaluated Camera state.

---

# 18. Camera Path lower Deck

In Path posture, the lower Deck is **not a timeline**.

It is a straightened structural overview:

```text
CAMERA PATH

Piano overview → Gallery door
Guide · Stop 4 → Stop 5

● ─ ○ ─ ○ ─ ◎ ─ ○ ─ ●
```

It communicates:

- topology,
- endpoints,
- selected geometry.

It does not communicate:

- time,
- Cues,
- narration,
- Hold,
- Beat,
- Station.

Selected Stage geometry should correspond visually to selection in the Deck.

---

# 19. Journey lower Deck

In Journey posture, the same lower Deck becomes a **real temporal representation**.

Example:

```text
JOURNEY
Piano overview → Gallery door

[ ▶ Rehearse ]

0:00 ───────── ◆ ───────────── ◆ ─────── 0:14
                Piano reveal    Gallery threshold
```

Horizontal placement represents time.

Do not print timing values between every segment.

Use the right Card for precision.

---

# 20. Camera vs Experience ownership

This separation is critical.

## Camera owns

- Camera View pose,
- Camera Path geometry,
- movement evaluation,
- orientation,
- View-to-View connectivity.

## Experience owns

- Guide order,
- Stop occurrences,
- Cue timing,
- Experience actions,
- visitor semantics.

A Cue should **not directly author Camera pose**.

If the Camera needs to turn midway through a path, author that in Camera Path editing.

A Cue may align with that moment but must not become another Camera keyframe authority.

This protects the single Camera system.

---

# 21. Timing model

Journey duration can be understood as a composition of:

```text
Camera movement duration
+
Experience pauses / timing
```

For example:

```text
Camera travel       4.2 s
Cue pause           1.5 s
Camera travel       3.1 s
Cue pause           0.8 s

Journey             9.6 s
```

The Journey timeline should be derived from the underlying systems rather than becoming an independent duplicate animation model.

---

# 22. Visitor Preview

Preview is a separate runtime posture.

It should look like:

> the museum experience,

not:

> the editor with panels hidden.

Hide all author abstractions:

- World / Experience tabs,
- sidebars,
- Deck,
- Plan grid,
- Camera geometry,
- View names,
- Presentation names,
- Stop numbers,
- Guide controls,
- Cues,
- capability names.

Expose only visitor meaning.

Example:

```text
                     Exit Preview


             [ museum experience ]


                 Explore the piano
        [ Look under the lid ]
        [ See the keyboard ]


Back                                      Next
```

Alternate Views become visitor-facing choices.

Do not expose:

```text
View A
View B
Default View
Camera View
```

The runtime may use those structures internally.

The visitor should see semantic language.

Exactly one restrained:

```text
Exit Preview
```

returns to authoring.

---

# 23. Visual and shell language

The new QA boards preserve the established V2 shell family rather than introduce a new visual system.

Primary characteristics:

- warm ivory / paper-like shell,
- charcoal typography,
- restrained teal technical accents,
- small controlled amber selection accents,
- thin borders,
- minimal shadows,
- compact controls,
- large spatial workspace,
- contextual right Card,
- bounded lower Deck.

Avoid:

- glossy SaaS styling,
- glassmorphism,
- oversized cards,
- heavy drop shadows,
- decorative gradients,
- excessive rounded containers,
- giant floating tool clusters,
- dense labels over the Stage.

The editor should feel like a mature spatial authoring tool rather than a dashboard.

---

# 24. Stage visual language

The Stage is primarily spatial.

It should prioritize:

- World geometry,
- spatial relationships,
- direct manipulation,
- selected spatial entities.

It should not become a dumping ground for:

- numbers,
- capability lists,
- timing labels,
- Camera parameters,
- full thumbnails,
- Guide graphs,
- scripting information.

General rule:

> Stage communicates spatial structure.  
> Card communicates selected-item detail.  
> Deck communicates sequence, topology, or time depending on posture.

---

# 25. Thumbnail rule

Rendered Camera snapshots remain valuable, but should not be permanently scattered across the Stage.

Preferred use:

```text
Stage marker
    ↓ select
Right Card
    ↓
faithful Camera preview
```

This applies to:

- Presentation Views,
- Camera-at-path-position inspection.

Visitor Preview may use small thumbnails inside visitor choices where they improve recognition without creating authoring clutter.

---

# 26. Lower Deck rule

The shell has one bounded lower Deck.

Its content changes according to authoring context.

Examples:

```text
Guide
→ ordered Stops

Camera Path
→ spatial/topological path overview

Journey
→ temporal timeline
```

Do not stack multiple lower workspaces.

Do not let the Deck routinely occupy half the application.

---

# 27. Right Card rule

The right Card should react to the **actual current selection**.

Examples:

```text
Scene subject
→ Experience usage + Present this

View
→ Camera preview + View operations

Stop
→ occurrence properties

Guide edge
→ Cut / Travel relationship

Path point
→ geometry context + Camera preview

Cue
→ shallow Cue summary
```

Do not mix several entity inspectors simultaneously.

Do not fill whitespace with speculative controls.

---

# 28. Progressive disclosure

The previous prototype frequently exposed advanced capabilities simply because they existed.

The reconciled principle is:

> ordinary authoring surfaces show the smallest useful set of controls; advanced capability appears only after deliberate invocation.

Examples:

```text
Scene subject
→ + Add behavior
→ then choose/configure behavior

Cue
→ Edit cue
→ then enter deeper Cue authoring

Guide edge
→ Edit Camera Path
→ then enter Camera Path posture
```

This reduces visual and conceptual load.

---

# 29. The six new QA boards

The reconciled QA set contains six representative states.

## QA 1 — Camera Path

Guards:

- direct Camera geometry editing,
- Path vs Journey separation,
- Camera endpoint/path-point grammar,
- Stage / Card / Deck responsibility,
- absence of Experience timing in Path posture.

## QA 2 — Journey

Guards:

- Journey as timing/events over Camera movement,
- Camera geometry non-editable in this posture,
- Rehearse + scrub,
- shallow Cue summary,
- Cue vs Camera ownership.

## QA 3 — Presentation / Views

Guards:

- Presentation focus,
- compact View constellation,
- Default View,
- selected View preview in Card,
- no Stage thumbnail wall,
- one `+ Present` model.

## QA 4 — Guide / Stops

Guards:

- one Guide home,
- compact Stop order,
- Stop vs edge semantics,
- Cut / Travel relationship,
- hidden Camera geometry during ordinary Guide editing.

Known interpretation note:

> `Presentation Default` is an entry policy. If the QA image places this wording on the Stage Camera marker, implementation should instead use the resolved View identity or omit the label.

## QA 5 — Scene Subject

Guards:

- Stage as primary Scene browser,
- on-demand `Browse World`,
- Experience usage before capabilities,
- `Present this`,
- closed behavior/interaction disclosure.

Known interpretation note:

> The generated board visually highlights a related Presentation while a Scene object is selected. Do not infer that Scene selection and Presentation selection are the same identity. Preserve deterministic selection authority.

## QA 6 — Visitor Preview

Guards:

- strict editor/visitor isolation,
- Back / Next visitor semantics,
- alternate View choices expressed in visitor language,
- exactly one Exit Preview,
- no authoring abstractions.

Rendering note:

> Exact museum assets, materials, lighting, architectural dressing, and thumbnail artwork are illustrative. Preview should use the actual product renderer rather than target generated-image fidelity.

---

# 30. Authority of QA boards

The QA images should be treated as **interaction and information-architecture guardrails**, not pixel-perfect specifications.

They are authoritative for:

- information homes,
- major hierarchy,
- visible vs hidden capabilities,
- selected-entity semantics,
- shell posture,
- terminology,
- separation between Camera and Experience concepts.

They are not automatically authoritative for:

- exact pixels,
- exact icon design,
- exact spacing,
- generated museum assets,
- generated lighting/material fidelity,
- incidental labels produced by image generation,
- implementation details unsupported by the codebase.

Where image details conflict with written model constraints, the written model should win.

---

# 31. Relationship to older V2 boards

The new six-board set is intended to **supersede older Experience-authoring expressions for the flows it explicitly covers**, after reconciliation and ratification.

Older boards remain useful for:

- overall shell/PLATE visual language,
- visual-system provenance,
- Plan / 3D conventions,
- navigation/orientation concepts,
- unaffected shell decisions.

Older boards should not remain competing active guidance where they show superseded Experience UX such as:

- `Show · unordered set`,
- Auto / Hints / Capture-heavy Presentation Cards,
- permanent Scene inventories,
- capability dumps,
- giant Guide Overview / Peek / Expand surfaces,
- `Edit route` / `Coordinate`,
- Anchor N UI,
- Beat / Hold / Station exposure,
- duplicate Preview controls,
- permanent full View thumbnails on Stage.

Conflicting historical boards should be archived or explicitly marked **superseded / provenance only** rather than silently left as active references.

---

# 32. Intended reference hierarchy

After reconciliation, the desired hierarchy is:

```text
CURRENT EXPERIENCE UX

Six QA guardrails
+ reconciled Experience reference
+ implementation plan

        ↓

OLDER V2 VISUAL/SHELL REFERENCES

still authoritative where not superseded

        ↓

SUPERSEDED EXPERIENCE EXPLORATIONS

historical provenance only
```

The planner should not have to decide between two active truths.

---

# 33. PR boundary recommendation

The recommended boundary is:

## PR #113

Complete:

- remaining C9 slices,
- C9 verification,
- this Experience UX reconciliation,
- six QA guardrails,
- old/new board adjudication,
- canonical reference updates,
- supersession/archive routing,
- implementation-ready overhaul plan.

Keep the final reconciliation phase docs/assets/reference-only.

Do not begin the broad shell overhaul inside #113.

## PR #114

Implement the accepted reconciliation:

- shell pruning,
- Presentation / Views,
- Guide / Stops,
- Camera Path,
- Journey,
- Scene subject disclosure,
- Preview,
- visual QA and responsive/stress verification.

PR #114 should implement an already-resolved product direction rather than reopen foundational UX decisions.

---

# 34. Key invariants to preserve during implementation

The reconciliation must not break established architecture.

Protect:

- visitor/editor isolation,
- one Camera evaluation / motion authority,
- separate LayoutDocument and SceneDocument ownership,
- room-local transforms,
- deterministic selection,
- deterministic history,
- existing World/Experience domain boundaries,
- Camera-owned movement geometry,
- Experience-owned semantic/timing layer,
- Svelte 5 rune patterns,
- Threlte patterns,
- existing Plan/3D and navigation authorities.

Do not introduce a second Camera system, second selection authority, or Experience-owned copy of World geometry to satisfy the new UI.

---

# 35. Deferred / intentionally unresolved

The following should not be accidentally hardened by the reconciliation.

## Deep Cue authoring shell

A Photoshop-like focused editing posture may be appropriate for advanced Cue/scripting work, but its exact shell form remains unresolved.

Potential options include:

- focused contextual Card,
- temporary sheet,
- contextual workspace,
- docked/floating specialist editor.

Do not invent the final mechanism during ordinary shell implementation.

## Advanced capability authoring

Behavior and visitor-interaction configuration remain deliberately behind progressive disclosure.

The ordinary Scene-subject Card should not become the scripting surface.

## Dense View constellations

The compact View-marker model should scale significantly better than thumbnails, but high-count collision/clustering behavior remains a refinement problem.

Potential mechanisms such as:

- label-on-hover,
- zoom-sensitive detail,
- collision avoidance,
- grouping,

should be explored only if actual density requires them.

## Arbitrary path-point Camera preview

`Camera at this point` requires truthful Camera evaluation at the selected path location.

Do not fabricate semantics if the current Camera representation does not directly support this.

---

# 36. Product thesis

The new model can be summarized as:

> **World provides things. Presentation gives them visitor meaning. Views determine how they are seen. Guide determines when they are encountered. Camera Path determines how the Camera moves. Journey determines what happens during that movement. Preview exposes only the resulting visitor experience.**

The shell principle is:

> **Keep the big picture spatial and quiet. Reveal precision only where the author asks for it.**