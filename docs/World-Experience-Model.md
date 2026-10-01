# Experience Authoring — Product and Behavior Synthesis

## Status

This document captures the intended product and behavioral model demonstrated by the current Experience Authoring Prototype and subsequent product discussion.

It is product/behavior input. Its architecture questions were reconciled in the
[North Star](./reference/north-star.md), [architecture](./reference/architecture.md),
[F contract](./reference/composition-execution.md) and
[Camera contract](./reference/components/camera-tour.md); those live contracts
own the answers. The [architecture synthesis](./World-Experience-Architecture-Synthesis.md)
is provenance. The shell design phase it once fed is complete; the accepted
direction is the [final V2 synthesis](../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md).

The prototype is evidence, not authority. Its implementation, terminology, UI composition, data structures, Camera shortcuts, and runtime mechanisms may drift from this synthesis. That drift is expected. The prototype will be revised after architecture and shell reconciliation.

This document answers:

> What are we trying to let creators author, and what should visitors experience?

It does **not** yet answer:

> What exact production schema, package boundary, shell implementation, Camera adapter, execution kernel, or migration should implement it?

Those decisions follow through reconciliation with the North Star, F foundation contracts, current production architecture, and codebase infrastructure.

---

# 1. Product thesis

Biskiq has two primary authoring lenses over one project:

```text
WORLD | EXPERIENCE
```

They operate over the same spatial world and subjects, but author different kinds of truth.

## World

World answers:

> What exists, where is it, what is it like, and what can it intrinsically do?

World may contain:

- sites;
- buildings;
- levels;
- spaces;
- rooms;
- gardens and outdoor areas;
- architectural elements;
- objects and components;
- lights;
- media;
- materials;
- environment;
- other spatial subjects.

A Room is not the universal unit of World. It is one kind of semantic Space.

World subjects expose supported capabilities.

Examples:

```text
Piano
├─ Play
└─ Stop

Machine
├─ Casing.Open
├─ Rotor.Run
└─ Rotor.Speed

Wall
├─ Section
└─ Unfold

Light
└─ Brightness
```

World owns the source state and intrinsic capabilities of these subjects.

## Experience

Experience answers:

> What should visitors understand, see, hear, do, discover, and be guided through?

Experience does not duplicate the World.

It references World subjects and composes visitor-facing meaning and behavior over them.

Experience may:

- present a subject;
- explain it;
- frame it through Views;
- invoke supported capabilities;
- offer those capabilities to visitors;
- coordinate several subjects;
- guide visitors through authored Stops;
- allow free exploration;
- combine guided and exploratory behavior.

The central rule is:

```text
World defines the thing.
Experience defines how the thing participates in a visitor experience.
```

---

# 2. Experience is not inherently a tour

An Experience is not fundamentally:

- a timeline;
- a tour;
- a slideshow;
- a sequence;
- a Camera path;
- a story;
- a list of Stops.

Those are possible structures inside an Experience.

A valid Experience may be:

```text
free exploration
```

or:

```text
interactive object showcase
```

or:

```text
guided museum visit
```

or:

```text
architectural explanation
```

or:

```text
multi-view narrated demonstration
```

or:

```text
interactive portfolio
```

or a mixture of them.

Guidance is optional.

The underlying model should therefore preserve:

```text
meaning ≠ viewing ≠ behavior ≠ interaction ≠ navigation
```

These concepts compose without one automatically owning the others.

---

# 3. Presentation is the primary authored unit

The prototype currently calls its main semantic grouping an **Encounter**.

The current product direction instead treats **Presentation** as the stronger creator-facing concept.

A Presentation is:

> A visitor-facing composition built around one or more World subjects.

Examples:

```text
Presentation:
How the turbine transfers power
```

```text
Presentation:
Why this piano matters
```

```text
Presentation:
How the Rotunda wall is constructed
```

```text
Presentation:
Compare these two structural systems
```

A Presentation may contain:

```text
Presentation
├─ Focus / subjects
├─ Explanation
├─ Views
├─ Activities
└─ Interactions
```

It is not inherently sequential and does not intrinsically have Previous or Next.

A Presentation may exist without any Guide.

A Presentation may be reused from several Guide Stops.

Several Presentations may focus on the same World subject.

For example:

```text
Piano

├─ Presentation: Construction
├─ Presentation: Historical importance
└─ Presentation: Hear the instrument
```

Likewise, one Presentation may involve several subjects:

```text
Presentation:
How power reaches the generator

Focus:
├─ Turbine
├─ Shaft
└─ Generator
```

The ordinary creation path should remain subject-first:

```text
select subject
→ Present this
```

not:

```text
create abstract presentation object
→ browse global target catalogue
→ bind subject
```

---

# 4. Focus and subjects

Most Presentations begin from something concrete in the World.

The prototype demonstrates several useful starting points:

```text
selected subject
multiple subjects
current viewpoint
spatial region
environment
```

The production model should not require every Presentation to have exactly one object.

A Presentation may focus on:

- one subject;
- several subjects;
- an architectural element;
- a Space or region;
- an environment;
- a relationship between subjects;
- potentially another supported semantic spatial target.

The exact reference representation is an architecture concern.

The product principle is:

> Start from what the creator is looking at or working with.

---

# 5. Views and Camera

A **View** expresses spatial attention:

> What should the visitor see, and how should it be framed?

A View is distinct from Presentation meaning.

A Presentation might have:

```text
Presentation: How the turbine works

Views
├─ Overview
├─ Casing
├─ Rotor
└─ Output shaft
```

Those Views do not automatically become Guide Stops.

Views may be reused.

The same View may appear in several Presentations or Stops without sharing unrelated navigation, timing, lifecycle, or interaction semantics.

## Progressive Camera authoring

Camera authoring should begin with intent and expose precision only when needed.

A useful progression is:

```text
Auto
↓
Hints
↓
Use my view
↓
Precise
```

### Auto

```text
Show Rotor
```

The system derives framing.

### Hints

```text
Side       3/4
Distance   Close
Height     Auto
Movement   Slow approach
```

### Use my view

The creator navigates naturally and captures the current framing.

### Precise

Advanced Camera controls may expose:

- observer;
- target;
- path or route;
- projection;
- FOV/lens;
- movement profile;
- speed;
- other Camera-owned parameters.

Camera remains its own underlying semantic authority.

Experience should not create:

- a second Camera graph;
- a second pose/FOV model;
- independent Camera interpolation;
- Experience-owned copies of canonical Camera truth.

Product exposure and semantic ownership are different:

```text
Experience UI
    ↓
View / framing / movement controls
    ↓
canonical Camera authority
```

World also uses Camera for authoring navigation and inspection, but advanced durable Camera intent is primarily surfaced where the creator is designing a visitor Presentation.

---

# 6. Explanation

A Presentation may explain something.

For the ordinary creator this begins simply:

```text
Explanation
[ text ]
```

The prototype demonstrates that useful timing and captions can be derived rather than requiring creators to author a timeline.

Potential derived information includes:

- simulated or real narration duration;
- transcript;
- captions;
- semantic cue points.

A creator should preferably be able to say:

```text
at "look inside"
→ show Casing View
```

rather than:

```text
at 7.3 seconds
```

Precise timing may exist at advanced depth, but ordinary authoring should remain semantic.

---

# 7. Activities

An **Activity** is something that happens as part of an Experience.

Examples:

```text
open casing
run rotor
play media
highlight object
change light level
unfold wall
apply architectural presentation state
```

Activities invoke supported World capabilities or reusable presentation resources.

An Activity has its own lifecycle.

Organizational placement does not define that lifecycle.

For example:

```text
Activity appears inside Presentation
≠
must start when Presentation starts
≠
must stop when Presentation ends
```

A Presentation might contain:

```text
Narration
starts on presentation entry

Casing.Open
starts at narration cue

Rotor.Run
starts after casing finishes
continues after visitor leaves
```

Simple defaults should hide lifecycle complexity until needed.

The production architecture may distinguish reusable capability/performance definitions from a particular Activity invocation. This synthesis does not freeze that schema.

---

# 8. Interactions

An **Interaction** defines something visitors may invoke.

Conceptually:

```text
visitor action
→ target
→ supported capability / content / navigation
```

Examples:

```text
Activate Piano
→ Piano.Play
```

```text
Activate Switch
→ Light.Brightness = bright
```

```text
Activate Exhibit
→ open associated Presentation
```

An Interaction does not require a Presentation or Guide.

This is important.

A completely exploratory Experience may primarily consist of:

```text
World
+
Experience-wide Interactions
```

Interactions may also be contextual:

```text
available throughout Experience

available during Presentation

available after a supported condition
```

The authoring language remains subject-first.

The prototype's useful pattern is:

```text
operate target
→ Let visitors activate this
```

rather than:

```text
Add Action
→ browse global action catalogue
```

---

# 9. Guide and Stops

A **Guide** is an optional authored route through an Experience.

It answers:

> Where should the visitor be guided next?

A Guide contains **Stops**.

A Stop is one particular occurrence in that Guide.

Conceptually:

```text
Guide
├─ Stop → Presentation A
├─ Stop → Presentation B
├─ Stop → Presentation A
└─ Stop → Presentation C
```

The two appearances of Presentation A are different Stops.

Therefore:

```text
Presentation
≠
Stop
```

The Presentation owns reusable visitor-facing meaning.

The Stop owns occurrence identity and Guide context.

This is one of the strongest ideas demonstrated by the prototype's current Guide Position model.

## Guide order

The Guide is the single authority for default editorial traversal.

A Stop may:

- continue to the next Stop;
- explicitly target another Stop;
- branch;
- terminate;
- support a detour and return.

A Presentation itself should not gain Previous/Next merely because it appears in a Guide.

---

# 10. Presentation content does not automatically become navigation

If a Presentation has four Views:

```text
Overview
Casing
Rotor
Output
```

that does not imply:

```text
Guide Stop 1
Guide Stop 2
Guide Stop 3
Guide Stop 4
```

The creator may instead author:

```text
Guide

Stop:
How the turbine works
```

while the Presentation moves through several Views automatically.

Or the creator may explicitly expose selected Views as additional Stops.

Navigation structure and Presentation structure remain independent.

---

# 11. Derived presentation planning

Creators should normally author intent and relationships.

The system derives execution.

Conceptually:

```text
Presentation
+
Camera evaluation
+
explanation/media duration
+
finite Activities
+
dependencies / semantic cues
+
pacing defaults
        ↓
derived presentation plan
```

The prototype demonstrates this with an estimated presentation duration.

The important product distinction is:

```text
Estimated presentation: ~24 sec · Auto
```

not:

```text
Presentation duration = 24 sec
```

The estimate is derived and changes when the underlying work changes.

Camera travel participates in this estimate.

Slower Camera movement may increase presentation time when Camera becomes the critical path.

Persistent Activities do not make a Presentation infinitely long.

---

# 12. Execution timing, pacing, and permission are separate

Three concepts must remain distinct:

```text
execution timing
autoplay pacing
progression permission
```

## Execution timing

When Camera moves, narration, Activities, cues, and other work actually occur.

## Autoplay pacing

When the current Presentation naturally appears ready to continue.

## Progression permission

Whether the visitor is allowed to continue.

These must not collapse into one duration field.

---

# 13. Manual Next stays available unless explicitly gated

A Presentation taking 30 seconds does not mean the visitor must remain for 30 seconds.

The core rule is:

```text
duration ≠ permission
```

Manual Next should remain available whenever a valid destination exists unless an explicit Gate blocks it.

Therefore:

```text
Camera still moving
≠ block Next

narration unfinished
≠ block Next

Activity unfinished
≠ block Next

autoplay not ready
≠ block Next
```

Only explicit progression policy should restrict progression.

---

# 14. Gates

A **Gate** is an explicit progression condition.

Examples:

```text
Continue when:
visitor opened the casing
```

```text
Continue when:
required explanation finished
```

```text
Continue when:
supported state is active
```

Without a Gate:

```text
visitor may continue
```

Gate semantics should be visible and deliberate.

They should not emerge accidentally from duration, Camera motion, or implementation details.

---

# 15. Interruption and departure

Leaving a Presentation early should not force every operation into the same behavior.

Different Activities may need different interruption semantics.

Useful conceptual policies include:

```text
Cancel
Finish
Continue
```

Potential later depth may add richer policies.

Examples:

```text
Narration
→ stop

local highlight
→ stop

casing already opening
→ finish

rotor intentionally persistent
→ continue
```

Not-yet-started work scoped to the departed Presentation should normally be disarmed.

Already-running work follows its declared or type-default lifecycle.

Later unrelated Camera changes must not silently undo visitor actions or Activity results.

---

# 16. Supported replacement and channel ownership

The prototype demonstrates an important replacement case:

> A newer accepted command can replace an older contribution on a channel
> family that explicitly supports replacement or handoff.

If a visitor explicitly stops the rotor:

```text
Visitor Stop
→ Rotor.Run = false
```

a later Camera transition must not reissue an old Presentation command and restart it.

Likewise, removing an old effect must not overwrite a newer accepted
contribution. Competing exclusive control otherwise rejects by default.

The live F.3 contract owns the typed channel/conflict rule. The prototype's
unconditional latest-command behavior is not a production policy.

---

# 17. Visitor agency

Guided and exploratory navigation coexist.

A visitor may:

```text
follow Guide
→ leave guidance
→ explore freely
→ interact with subjects
→ return to Guide
```

Free exploration releases guided Camera control.

Autoplay pauses.

Activities follow their own lifecycle rules.

Returning to guidance begins from the visitor's actual current pose rather than teleporting through stale Camera assumptions.

Autoplay does not automatically resume merely because guidance was rejoined.

The Experience should feel like:

> an interactive spatial world that may contain guidance

rather than:

> a tour that occasionally allows escape.

---

# 18. Reuse and local editing

Reusable Views and other reusable resources have identity.

But simple authoring should hide definition/use machinery until reuse matters.

Example:

```text
Rotor close-up
used in 3 places
```

Editing one appearance should make scope explicit:

```text
Apply to:
○ only here
○ everywhere this View is used
```

A local edit may detach or create an override depending on the eventual architecture.

What must remain invariant:

- shared framing does not imply shared Guide connections;
- shared framing does not imply shared lifecycle;
- shared framing does not imply shared Gates;
- shared framing does not imply shared cues;
- shared framing does not imply shared Stop identity.

---

# 19. Revision and repair

World changes must not silently rewrite Experience meaning.

If a referenced subject disappears or loses a capability:

```text
Presentation survives
Guide survives
unaffected Activities survive

affected reference
→ Needs attention
```

The creator may then:

- rebind;
- replace;
- remove;
- repair.

The system must not silently retarget based on:

- display name;
- proximity;
- guessed replacement;
- incidental spatial containment.

Moving a subject may allow adaptive Views to recompute.

Pinned or precise framing may instead require review.

The prototype's current repair behavior is useful evidence for this product principle.

---

# 20. World editing versus Experience editing

The boundary must remain explicit.

Example:

```text
WORLD
Machine casing = closed
```

```text
EXPERIENCE
during Presentation:
Machine casing = open
```

Preview/runtime state is temporary execution.

It must never silently write the Presentation result back into authored World source truth.

Likewise, editing the World must not be mistaken for editing a Presentation override.

---

# 21. Preview

Preview executes the authored Experience against the shared World.

It is not a second scene or duplicate editor model.

Preview should eventually use the same production semantic evaluation used by visitor delivery.

Important invariant:

```text
Preview execution
never mutates authored source
```

Exiting Preview returns to authoring state rather than committing temporary visitor actions.

The current prototype proves this separation behaviorally, though its runtime implementation is not a production contract.

---

# 22. Low-floor creator path

The first useful Experience should require very little.

A likely target flow:

```text
1. Select World subject
2. Present this
3. Write short explanation
4. Accept/capture a View
5. Operate subject → Use in Presentation
6. Preview
```

No Guide is required.

No duration is required.

No lifecycle graph is required.

No cue editor is required.

No schema vocabulary is required.

No precise Camera editing is required.

To add guidance:

```text
7. Add Presentation to Guide
8. Repeat for another Presentation
9. Preview with Next
```

Advanced concepts appear progressively:

- reusable definitions;
- lifecycle;
- cues;
- Gates;
- local/shared editing;
- Camera precision;
- branching;
- interruption;
- session logic.

---

# 23. High ceiling

The same conceptual model should support:

```text
free exploration

interactive portfolio

guided museum experience

architectural explanation

product demonstration

multi-view narrated presentation

interactive educational experience

guided route with optional detours

persistent behavior across multiple Stops

cross-subject interaction

several Experiences over one shared World
```

These should not require inventing a new top-level authoring model.

---

# 24. Camera relationship

Camera is not a top-level authoring mode in the target product shell.

The creator-facing shell is moving toward:

```text
WORLD | EXPERIENCE
```

Camera remains a distinct semantic authority underneath.

Its roles differ by authoring context.

## In World

Camera primarily serves navigation and inspection:

```text
look
orbit
move
Plan ↔ 3D
face
section
inspect
```

Much of this is transient editor state.

## In Experience

Camera becomes durable presentation intent through Views and movement.

```text
Capture View
Show subject
Travel
Frame
Refine movement
Edit precise Camera details
```

Thus:

```text
Camera is architecturally independent
but progressively surfaced through Experience authoring.
```

Experience does not own duplicate Camera truth.

---

# 25. Prototype evidence worth preserving

The current prototype provides useful evidence for:

- subject-first authoring;
- generic capability-driven controls;
- Experience without a Guide;
- interactions without a Presentation/Guide dependency;
- View definition versus View use;
- occurrence-specific Guide positions;
- explicit navigation order;
- Camera-duration-aware estimates;
- Auto pacing;
- explicit Gates;
- free exploration and rejoin;
- detours;
- early Next;
- interruption semantics;
- persistent Activities;
- last-command-wins effects;
- deterministic execution;
- source/runtime isolation;
- repair after subject/capability changes;
- real structural editing;
- observational Reviewer Presenter;
- browser tests through real authoring controls.

These are behavioral evidence, not proof that the current implementation architecture is suitable for production.

---

# 26. Expected prototype drift

The following current prototype details should **not** be treated as destination contracts:

- `Encounter` as the final product entity name;
- the exact `Document` TypeScript shape;
- one in-memory Experience;
- React/Vite implementation;
- prototype-local World document;
- prototype Camera interpolation and speed constants;
- current definition/use dictionaries;
- exact Guide Position representation;
- current route arrays;
- prototype-local runtime structure;
- current interruption implementation;
- text-derived narration timing;
- current World/Experience buttons and shell layout;
- current primitive fixture;
- current scope/lifecycle field presentation;
- exact Presenter UI;
- current test implementation;
- fixed prototype terminology such as `behavior` versus future Activity/performance vocabulary.

The prototype may temporarily disagree with this synthesis while product and architecture reconciliation proceeds.

---

# 27. Architecture questions routed to reconciliation

These were the input questions for the completed reconciliation. Read the live
contracts linked in Status for resolved architecture; shell questions and the
two Prototype V2 hypotheses remain open in the design-phase context.

1. Does **Presentation** replace the North Star's current `Destination` concept, or do both have distinct jobs?

2. Does a Guide Stop reference a Presentation directly, or is another reusable visitor-entry concept required?

3. What exactly is Camera-owned in a View, and what invocation-local information may Experience own?

4. How should Presentation Activities reference intrinsic capabilities and reusable performances?

5. What is the minimum persisted Experience unit required for the first T3 slice?

6. What lifecycle/session semantics belong in initial T3 versus later coordinated-direction work?

7. How do Experience references use F.1 semantic identity?

8. Which properties/actions become F.3 channels?

9. Which user actions require F.4 compound acceptance?

10. How does the Camera codec/order cutover occur without two writable editorial-order authorities?

11. How does Preview use the canonical runtime rather than a parallel Experience renderer?

12. How does Experience authoring consume the future T1 continuous World viewport?

13. What current selection/history/navigation infrastructure can be reused unchanged?

14. What current infrastructure must be deliberately migrated or retired?

15. What shell hierarchy best exposes Presentations, World subjects, Views, Guide Stops, and advanced Camera editing without exposing semantic implementation complexity prematurely?

---

# 28. Proposed target vocabulary

Current working product vocabulary:

```text
World
Subject
Capability

Experience
Presentation
View
Explanation
Activity
Interaction
Guide
Stop
Gate
Preview
```

Likely implementation/architecture vocabulary may remain deeper:

```text
Layout
Scene
Camera
Experience
semantic reference
channel
invocation
occurrence
session
resource
compound intent
```

Creator-facing language should describe creative intent.

Architecture language should describe ownership and execution.

They do not need to be identical.

---

# 29. Core invariants

The synthesis reduces to these rules:

```text
World and Experience author different truths.

Experience references the World; it does not clone it.

Presentation is visitor-facing meaning and orchestration around World subjects.

Presentation is not inherently sequential.

Guide is optional.

Stop is a particular Guide occurrence.

View owns spatial attention, not Presentation meaning.

Camera remains one independent authority.

Activities invoke supported capabilities and have independent lifetimes.

Interactions may exist without a Guide.

Creators start from subjects and capabilities, not global command catalogues.

Timing is derived where possible.

Autoplay pacing is not progression permission.

Manual Next remains available unless explicitly gated.

Visitor exploration and guidance coexist.

Runtime/session state never mutates authored World truth.

Reuse scope is explicit.

Broken references are repaired explicitly, never silently guessed.

One semantic owner exists for each fact.

The simple path stays simple while advanced orchestration remains possible.
```

---

# 30. Handoff after architecture reconciliation

This synthesis is the product-behavior input to the Experience/World convergence work.

The product model and architecture synthesis have now been reconciled with the
codebase and durable contracts. Shell information architecture and
visual/interaction design have since been accepted as the V2 synthesis
([final synthesis](../prototypes/integrated-experience-authoring/design/Prototype-V2-final-synthesis.md),
PR #110). The next baton is repo-aware reconciliation and implementation
planning; neither is started by this document.

The progression remains:

```text
behavior synthesis + codebase reconnaissance + architecture synthesis
        ↓ completed
North Star / F / Camera / shell-exposure reconciliation
        ↓ completed
World | Experience shell information architecture
        ↓ completed (accepted V2 synthesis, PR #110)
visual + interaction design
        ↓ completed (accepted V2 synthesis, PR #110)
V2 implementation (repo-aware reconciliation first)
        ↓
post-implementation reconciliation
        ↓
durable QA / architecture authority
        ↓
T1 / T2 / T3 re-derivation
```

The current prototype should remain available as evidence throughout that process.

It is not expected to stay perfectly synchronized while the destination is being resolved.
