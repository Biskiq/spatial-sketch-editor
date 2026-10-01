# Museum Editor World Shell  
## Final synthesis: Calm World, Invoked Depth

**Status — accepted/frozen prototype-level design direction (2026-10-01, PR #111).**
This is the canonical final synthesis **for this World | Experience shell design
round**: the accepted destination shell/disclosure evidence, and the direction the
next bounded prototype PR adopts. It is subject to the ratified product/domain
invariants ([North Star](../../../docs/reference/north-star.md),
[architecture](../../../docs/reference/architecture.md),
[F composition/execution](../../../docs/reference/composition-execution.md) and the
component contracts), which govern wherever this document disagrees with them. It is
**not** persisted-format authority, **not** production implementation authority, and
**not** itself authorization to cut over production; the editor still runs the landed
PLATE-era shell. The durable shell laws live in
[PLATE §0.8](../../../docs/reference/design-system/editor-shell-and-visual-system.md#08-accepted-destination-shell--unified-world--experience-direction-2026-10-01-pr-111);
the [QA boards](../QA-package/) are specimens, not contracts, and a raster never
outranks the written contract. Round routes: [workspace README](../README.md) ·
[acceptance record](../QA-package/ACCEPTANCE.md).

### Design thesis

World and Experience are two authoring intentions over the same project, not two applications. World exposes source truth, spatial structure, intrinsic capability, composition, and repair. Experience exposes visitor meaning and encounter. They share the same shell, Stage, canonical selection, Camera authority, visual language, and return behavior.

The World shell follows one governing principle:

> **World stays calm until creator action requires depth.**

Ordinary World answers four questions immediately:

- Where am I?
- What is around this subject?
- What is selected?
- How do I reach something elsewhere?

Everything beyond that appears through procedure.

The resulting progression is:

**Select → Look or Details → Instrument → Precision**

This gives World a high technical ceiling without making the resting interface feel technical.

---

# 1. Shared shell

The shell preserves five recognizable landmarks across World and Experience.

### Head

Persistent project identity and application-level actions.

It contains:

- Museum Editor
- project identity
- World | Experience lens switch
- save/history state
- Preview

The lens switch changes authoring intention. It does not change selection, move the Camera, capture a View, create meaning, or establish a relationship.

The final product should treat active lens more neutrally than canonical World selection. The QA images use amber in the lens switch consistently, but the specification should reserve the strongest amber treatment for selected World identity.

### Context Index

World's persistent orientation surface.

It does not act as the main property editor and does not pretend that visual nesting is the data model.

At rest it shows:

1. current project/location path;
2. nearby relation-aware context;
3. Search and Browse entry points.

### Stage

The dominant continuous spatial surface.

Plan, 3D, Section, Unroll, Look-up, Camera readings and direct manipulation are different readings of the same world, not separate applications.

### Card

The Card represents exactly one thing:

> **the canonical selected identity**

It does not become the current tool, task, host, component focus, inspection state, or Instrument.

### World Instrument

The Instrument represents:

> **the current task**

It does not exist merely because a selected subject supports advanced capability.

At rest, there is no Instrument.

It appears only after creator action invokes work requiring it.

---

# 2. Ordinary World

Ordinary World is deliberately sparse.

The accepted baseline is represented by [`01-world-ordinary-piano.png`](../QA-package/01-world-ordinary-piano.png).

A Piano selected in Piano Gallery produces:

**Context Index**

```text
Saltmarsh Museum
Long Gallery · Level 0
Piano Gallery

Bounds
  North wall
  Rotunda wall

Openings on bounds
  Garden window

Located here
  Piano
  Oak bench
  Three Pears

Search
Browse
```

**Card**

```text
Piano
Placed object
Piano Gallery

Details ›
```

That is enough.

World does not expose at rest:

- source identity;
- use counts;
- owner labels;
- edit reach;
- component trees;
- attachment details;
- relation glyphs;
- cross-lens references;
- precision controls;
- disabled specialist tools.

The design preserves World breadth without permanently displaying World depth. This follows the brief's distinction between necessary structural orientation and progressive technical disclosure.

---

# 3. Context Index

## Calm local orientation

The Context Index is deliberately **relation-aware**.

Generic hierarchy such as:

```text
Room
  Walls
  Windows
  Objects
```

would incorrectly teach containment and ownership.

Instead, ordinary context uses concise relational groups when hierarchy could lie:

```text
Bounds
Openings on bounds
Located here
Overlays
Attached here
```

This preserves important distinctions:

- a Wall may bound several Spaces;
- an Opening is hosted by a Wall;
- an Object may merely be located in a Space;
- a Zone may overlap several Spaces;
- location is not ownership;
- indentation is not source identity.

World still supports Project, structure, Level, Room/Space, architecture and object orientation without requiring the UI tree to become the storage model.

Only non-empty relevant groups appear.

---

# 4. Browse and Search

The local Context Index is intentionally not the complete project browser.

Wider breadth appears through explicit **Browse** or **Search**.

The accepted dense example is [`02-world-dense-search-recovery.png`](../QA-package/02-world-dense-search-recovery.png).

## Browse

Browse can expose:

- multiple Levels;
- many Spaces;
- repeated names;
- distant architecture;
- dense object populations.

Changing Browse context does not change canonical selection.

If the creator browses Level 2 while Piano on Level 0 remains selected, a conditional recovery row appears:

```text
Selected elsewhere:
Piano · Piano Gallery · Level 0
```

This is recovery UI, not another selection.

There is no permanent selection pin.

## Search

Search separates four operations that must never collapse into one:

**Select**  
Changes canonical identity.

**Open location**  
Changes Index browsing context.

**Bring into view**  
Requests viewpoint motion from canonical Camera/navigation authority.

**Reveal / Include / Face**  
Begins a temporary World inspection procedure.

Search can explain why a result is not currently visible:

```text
Garden window
Rotunda · Level 0
Outside current frame
Select · Bring into view
```

or:

```text
Moon window
Study · Level 2
Behind opened wall
Select · Reveal
```

Selecting a result never silently moves the Camera or changes inspection state.

This preserves the accepted "find with reason" contract.

---

# 5. One canonical selection

There is exactly **one canonical selection across the product**.

Index rows, Stage geometry, Search results, Details references and cross-lens links do not create parallel selection systems.

Canonical selection is echoed consistently through:

- selected Index row;
- selected Stage geometry;
- Card identity.

Selection remains distinct from:

- keyboard row focus;
- task focus;
- source identity;
- ownership;
- edit reach;
- referenced entities;
- candidate repair targets;
- temporary inspection geometry.

This rule also holds across lens changes.

---

# 6. Look: spatial procedure

`Look` is the door into spatial procedure.

It is capability-driven:

```text
availableLookActions(selection, context)
```

It is not a global toolbox containing every spatial command.

Examples:

**Curved Wall**
- Face
- Unroll
- Section

**Ceiling**
- Lift
- Look up
- Reveal

**Opening**
- Face host
- Section through here
- Reveal

**Ordinary object with no useful spatial reading**
- no Look affordance

`Look` may appear visually beside selected Stage geometry, but it is shell interaction, not a spatial entity or Camera object.

The image set begins after invocation in [`03-world-look-unroll-window.png`](../QA-package/03-world-look-unroll-window.png); the interaction contract is still:

**Select Garden window → Look → Unroll host wall**

---

# 7. Instrument: invoked specialist work

The World Instrument appears only after actual work begins.

For a selected Garden window whose host wall must be Unrolled:

**Card**

```text
Garden window
Opening
Rotunda
```

**Instrument**

```text
Rotunda wall · Unroll
around Garden window

Inside / Outside
Curvature 62%
Set flat
Put it back
```

This illustrates a central rule:

> The subject motivating an operation and the entity technically acted upon do not need to become the same selection.

Garden window remains selected.

Rotunda wall becomes task target.

Selection does not churn merely to satisfy operation implementation.

The Instrument must explicitly name the technical target when it differs from selected identity.

---

# 8. Temporary spatial inspection

Unroll, Section, Reveal, Lift and related readings are explicitly temporary.

They must visually communicate:

- same authored source;
- changed reading;
- temporary state;
- retained as-built relationship.

They must not look like:

- duplicated geometry;
- authored movement;
- damage;
- deletion;
- new visitor behavior.

A measured state can communicate scale honestly:

```text
Unrolled · height to scale · width foreshortened
```

Exact model values remain exact even if current visual reading foreshortens one axis.

---

# 9. Precision

Precision is not a global application mode.

It deepens the **currently active task**.

The accepted state is [`04-world-precision-refusal-window.png`](../QA-package/04-world-precision-refusal-window.png).

A width handle becomes available because the width axis reads clearly. Clicking it opens a single active writer inside the existing Instrument.

Example:

```text
Garden window · Dimensions

Width   [1.80] m
Head     3.40 m
Sill     0.90 m

Datum: wall opening
```

If an axis is visually misleading, its spatial handle is withheld while exact numeric access remains available.

Only the active value receives strong numeric emphasis.

---

# 10. Refusal

Invalid edits are refused locally and explicitly.

For proposed width `1.80 m` when accepted value remains `1.60 m`:

```text
Cannot accept 1.80 m
Overlaps structural pier
Need 0.20 m more clearance
```

Accepted geometry remains visible.

The proposal appears separately as transient/refused geometry.

A useful deliberate correction may be offered:

```text
Move opening left 0.20 m
```

It is never applied automatically.

Invalid work does not:

- silently clamp;
- commit and roll back;
- create history noise;
- clear selection;
- obscure current writer.

Only valid acceptance creates the logical edit.

---

# 11. Details: structural depth

`Details` is deliberately separate from `Look`.

**Look** means spatial procedure.

**Details** means subject identity, source, relations and composition structure.

For Piano:

```text
Source
  House Grand        Select source

Components
  Lid                Focus
  Keyboard assembly  Focus

Attachments
  Music stand        Select

Uses
  3 placements       View uses
```

The explicit verbs matter.

## Details grammar

**Expand**  
Reveal information. Selection unchanged.

**Focus**  
Enter deeper task focus while selection remains unchanged.

**Select**  
Change canonical selection explicitly.

**Open task**  
Open specialist Instrument work around current selection or related target.

Entity names alone do not secretly change selection.

---

# 12. Task focus is not selection

The accepted object composition state is [`05-world-details-piano-component-focus.png`](../QA-package/05-world-details-piano-component-focus.png).

Piano stays selected.

Instrument can say:

```text
Piano
Task focus: Lid
```

The proposal does not assume that `Lid` is a stable selectable entity unless the underlying model establishes that identity.

This lets object composition reach deep without fabricating domain semantics.

The same pattern applies to:

- component work;
- attachment work;
- repair;
- supported capability work.

World remains one application rather than spawning a separate composition editor.

---

# 13. Owner, Source and Reach

These are three independent questions.

### Owner

Which authority owns the fact?

Examples:

- Layout
- Scene
- Camera
- Experience

### Source

Where does the current fact come from?

Example:

```text
Source: House Grand
```

### Reach

What will this specific proposed edit affect?

Example:

```text
Reach: changes 3 placed uses
```

They are not interchangeable.

A shared source can participate in a local operation. Ownership alone does not describe blast radius. Provenance does not imply edit scope.

The accepted shared-source state is [`06-world-shared-source-reach.png`](../QA-package/06-world-shared-source-reach.png).

Crucially, these facts appear **at the decision point**.

World does not coat every field with ownership punctuation or shared-source glyphs.

The design intentionally does not invent unresolved inheritance or override semantics.

---

# 14. Repair

Broken relationships are discoverable without making ordinary World look broken.

At parent rest:

```text
▲ 1 attachment problem
```

Only when creator invokes the problem does Repair become the task.

Accepted example: [`07-world-repair-attached-lamp.png`](../QA-package/07-world-repair-attached-lamp.png).

```text
Repair attachment
Task focus: Lamp

Missing host

Pick host
Detach
Leave unresolved
Preview candidate
```

The following remain distinct:

- selecting the broken entity;
- focusing it as repair task;
- previewing a candidate;
- changing the relationship.

Repair never silently matches by:

- repeated name;
- nearest object;
- containment;
- proximity.

Missing identity remains explicit.

---

# 15. World → Experience

Lens crossing changes authoring intent, not identity.

Accepted example: [`08-experience-foreign-world-piano.png`](../QA-package/08-experience-foreign-world-piano.png).

Suppose Piano is selected in World.

On switching to Experience:

**Carries**

- canonical Piano selection;
- Camera standpoint;
- spatial orientation;
- project identity.

**Parks**

- World Instrument;
- Section;
- Unroll;
- Lift;
- Reveal;
- World Browse/Search procedural state.

**Does not happen**

- no View capture;
- no Presentation creation;
- no relationship creation;
- no Guide opening;
- no Camera move;
- no inferred Experience selection.

Experience honestly represents Piano as foreign:

```text
Piano
World subject

Not directly editable in Experience

Referenced by
Why this piano matters   Open Presentation
Evening tour · Stop 4    Open Stop

Create Presentation…
```

`Create Presentation…` means deliberate creation of another/new Presentation. Lens switching itself creates nothing.

The brief explicitly requires lens crossing without accidental capture or duplicated ownership.

---

# 16. Experience → World

The reverse transition follows the exact same law.

Accepted example: [`09-world-foreign-presentation.png`](../QA-package/09-world-foreign-presentation.png).

If Presentation `Why this piano matters` is canonical selection in Experience, switching to World does **not** restore previously selected Piano.

World shows:

```text
Why this piano matters
Presentation · Experience

Not editable in World

References
House piano       Select Piano
Under the lid     Open in Experience
```

Piano visible in Stage remains unselected.

World does not infer:

- Presentation focus;
- Stop focus;
- Camera-framed subject;
- previously selected World subject.

A referenced World entity becomes selected only through explicit user action.

The same rule applies if foreign selection is:

- Stop;
- Camera View;
- another Experience-owned identity.

---

# 17. Camera and spatial return

There is one canonical Camera/navigation authority.

The shell may request:

- Face;
- Bring into view;
- Put it back;
- previous inspection standpoint.

The shell does not create a second Camera history.

Temporary reading state may need to travel with navigation state, including:

- Section depth/direction;
- Unroll curvature/side;
- Reveal state;
- Lift amount;
- mirrored Look-up reading.

The UX intentionally does not prescribe how that payload is stored.

Required user-facing contract:

> **Put it back restores the expected spatial reading and standpoint.**

Undo remains document/source history only.

---

# 18. Esc ladder

Spatial work has a deterministic procedural unwind.

| State | Esc |
|---|---|
| Active writer or drag proposal | Cancel unaccepted proposal |
| Precision | Return to current spatial Instrument |
| Spatial Instrument / inspection | Put it back through canonical spatial return |
| Rest | No destructive action |

There is **no state where spatial inspection remains active while its Instrument is hidden**.

For non-spatial work:

| State | Esc |
|---|---|
| Writer / picker | Cancel transient interaction |
| Precision | Return to task focus |
| Component / repair focus | Return to Instrument overview |
| Instrument overview | Close Instrument |
| Rest | No destructive action |

Accepted source edits survive procedural exit.

Esc is not Undo.

---

# 19. Lens switch during an unfinished edit

If a numeric writer or drag proposal remains unaccepted when creator switches lens:

> **cancel the unaccepted proposal**

Do not silently commit it.

Accepted source work remains.

World procedure parks after the unaccepted proposal is removed.

There is no speculative `Reopen edit` state.

This keeps source truth clear.

---

# 20. Narrow desktop

The accepted compression state is [`10-world-narrow-unroll.png`](../QA-package/10-world-narrow-unroll.png).

The product does not become a second responsive application.

Wide:

```text
Index | Stage | Card
          +
      Instrument
```

Narrow:

- current place survives as compact location control;
- canonical selection survives as compact selected-identity control;
- Index becomes an invoked sheet;
- Card becomes an invoked sheet;
- Stage remains dominant;
- Instrument keeps a coherent lower home.

Example:

```text
Rotunda · Level 0 ▾

        STAGE

Garden window · Opening   Card ›
```

If normal context cannot identify selected subject, conditional recovery UI can appear.

Stage resizing due to shell layout is presentation behavior. It must not imply hidden Camera fit, pan, fly-to, or authored Camera mutation.

---

# 21. Accessibility and semantic state

State distinctions cannot depend on color alone.

The system must distinguish through combinations of:

- line treatment;
- shape;
- border;
- icon;
- pattern;
- text;
- position;
- tone.

Required distinctions include:

- selected;
- hover;
- keyboard focus;
- armed;
- disabled;
- warning;
- refusal;
- temporary inspection;
- preview;
- authored;
- derived/read-only;
- canonical selection;
- task focus;
- referenced identity.

Reduced motion changes transition behavior, not endpoint meaning or access.

Every spatial handle requiring precision must have a non-pointer path through Instrument controls.

The brief explicitly locks these semantic distinctions while leaving World presentation open to redesign.

---

# 22. Visual expression

World inherits the established V2 product character.

### At rest

- quiet pale chassis;
- restrained technical ink;
- dominant dark model-space Stage;
- sparse amber selection;
- minimal Card;
- calm Context Index.

### In measured work

- drafting-vellum surface;
- exact dimensions;
- local handles;
- restrained technical annotation;
- explicit temporary-state language.

### In advanced depth

Complexity gathers around one task rather than filling every region of the screen.

The visual rule is:

> **advanced capability should make the active work richer, not make the whole application louder.**

The accepted QA set intentionally uses stylized authoring geometry rather than photoreal architectural visualization.

---

# 23. Accepted visual QA package

| Board | Contract demonstrated |
|---|---|
| [`01-world-ordinary-piano.png`](../QA-package/01-world-ordinary-piano.png) | Calm resting World, local relation context, tiny Card |
| [`02-world-dense-search-recovery.png`](../QA-package/02-world-dense-search-recovery.png) | Browse/Search breadth, out-of-context selection, visibility recovery |
| [`03-world-look-unroll-window.png`](../QA-package/03-world-look-unroll-window.png) | Invoked spatial inspection, selected subject vs host task |
| [`04-world-precision-refusal-window.png`](../QA-package/04-world-precision-refusal-window.png) | Precision, one writer, refused proposal, local correction |
| [`05-world-details-piano-component-focus.png`](../QA-package/05-world-details-piano-component-focus.png) | Details, explicit verbs, component task focus |
| [`06-world-shared-source-reach.png`](../QA-package/06-world-shared-source-reach.png) | Owner, Source and Reach at decision point |
| [`07-world-repair-attached-lamp.png`](../QA-package/07-world-repair-attached-lamp.png) | Proportional repair and broken relationship handling |
| [`08-experience-foreign-world-piano.png`](../QA-package/08-experience-foreign-world-piano.png) | World subject crossing into Experience unchanged |
| [`09-world-foreign-presentation.png`](../QA-package/09-world-foreign-presentation.png) | Experience identity crossing into World unchanged |
| [`10-world-narrow-unroll.png`](../QA-package/10-world-narrow-unroll.png) | Narrow desktop, preserved Stage and active Instrument |

The QA package contains minor visual generator drift that is not normative:

- active lens styling is more amber than final semantic hierarchy should require;
- [`03-world-look-unroll-window.png`](../QA-package/03-world-look-unroll-window.png)
  shows state after Look invocation rather than the closed Look menu itself;
- [`08-experience-foreign-world-piano.png`](../QA-package/08-experience-foreign-world-piano.png)
  shows `Create Presentation…` as an explicit additional creation action, not
  something caused by lens switch.

None changes the interaction contract, and no board outranks the written contract
above.

---

# 24. What persists, what is contextual

### Persistent

- Head
- canonical selection
- useful local Context Index
- Stage
- Card identity
- Camera/navigation authority
- project/lens identity

### Contextual

- full Browse hierarchy
- Search result depth
- visibility recovery
- Look actions
- Details depth
- source/component relations
- World Instrument
- Precision
- scope/reach disclosure
- Repair
- locator

This is the essential World expression:

> **persistent breadth, invoked depth.**

---

# 25. Final product laws

The shell can now be summarized by eight laws.

1. **One selection.**  
   Lens changes never substitute identity.

2. **One Card.**  
   Card always represents canonical selection.

3. **One task surface.**  
   Instrument appears only because creator invoked work.

4. **Look means spatial procedure.**  
   Details means subject structure and relations.

5. **Task focus is not selection.**  
   Related hosts and components do not cause automatic selection churn.

6. **Owner, Source and Reach are different facts.**  
   Reveal each only when relevant to a decision.

7. **One spatial return authority.**  
   Camera/navigation owns viewpoint motion and spatial return; Undo owns accepted source history.

8. **Lens crossing parks procedure, not meaning.**  
   It does not capture, infer, create, or move anything by itself.

---

# Final assessment

The resulting World shell no longer expresses power through permanent chrome. It expresses power through **procedure**.

At rest, creator sees place, nearby context, selected identity and the world itself.

When creator asks to look deeper, the Stage changes reading and one Instrument appears.

When precision becomes necessary, only current task deepens.

When composition, shared source, or repair becomes relevant, that complexity appears at the exact decision point.

And when creator crosses into Experience, same project, selection and spatial memory survive without confusing source truth with visitor meaning.

That gives World the breadth required for serious spatial authoring while preserving the four qualities the design was judged against: **calm at rest, complexity disclosed through procedure, high advanced ceiling, and intuitive behavior at every depth.**