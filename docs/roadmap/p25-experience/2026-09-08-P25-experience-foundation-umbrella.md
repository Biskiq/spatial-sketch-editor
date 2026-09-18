# P25 — Experience Foundation umbrella

**Created:** 2026-09-08 · **Reconciled:** 2026-09-09 · **Status:** proposed (tracker authoritative)  
**Depends on:** accepted minimum useful P24 Stage set; P24 itself depends on the P23 minimum useful Build set.  
**Detail status:** P25 remains an umbrella/research-reconciliation plan, not an implementation-ready brief. Focused P25 research now closes the minimum **product semantics** for Destination, guided Stop/occurrence, Content/Info Panel, bounded Interaction, visitor navigation/accessibility, authoring direction and Narration placement. Exact persistence ownership, durable Stop/Sequence representation, post-F0 Spatial/Camera reference shapes, Scene interaction targets, media plumbing, operation APIs/codecs and implementation slicing remain unfrozen pending the required P23/P24 seam rechecks and E6.  
**Planning model:** progressive — this umbrella owns WHAT/WHY/BOUNDARIES/ORDER/RESEARCH GATES/high-level acceptance. No P25.x child plan becomes implementation-ready until its owning product semantics are closed and all required post-P23/P24 seams are reconciled.

## Outcome

P25 turns an authored Spatial project into a complete visitor-facing experience without turning Museum Editor into a general website builder, CMS, visual-scripting environment, game engine or second navigation/camera system.

The reconciled product model is:

```text
Experience
├─ Navigation
│  ├─ Destination references over existing Spatial / Camera meaning
│  └─ guided Stop / occurrence semantics over canonical Camera Sequence order
├─ Content
│  └─ reusable contextual information through one responsive Info Panel
└─ Interactions
   └─ bounded semantic Event → Target/context → Action rules
```

P25 should prove that a creator can take the useful P23/P24 environment, direct a visitor through canonical Camera semantics, present contextual interpretation, bind a small set of visitor interactions, Preview the same runtime semantics, and publish the same canonical project through P22.

The first complete proof should remain dramatically simpler than authoring equivalent behavior in Unity/Godot/custom Three.js code.

## Research basis and authority

Broad Phase 5 ecosystem discovery is closed. The canonical active P25 evidence artifact is:

- [`./research/P25-research-compact.md`](./research/P25-research-compact.md)

The compact preserves the focused research decisions, evidence matrix, fixtures, quantitative/accessibility facts, named references, source URLs, rejections/deferrals and unresolved gates. The superseded long focused report is history, not an active planning input.

Museum repository docs/code remain **product context**, not external research evidence. The focused research explicitly reconciled against current P22 visitor/runtime and Camera seams; any seam changed by P23 F0 or the accepted P24 minimum is rechecked before E6 freezes implementation detail.

### Ratified product-level conclusions from focused research

- **Destination + guided Stop/occurrence + Content + bounded Interaction** is the minimum semantic vocabulary.
- `Destination` is reusable visitor-facing meaning over canonical Spatial/Camera identity.
- `Stop` is one occurrence of a Destination in canonical guided order. It is **Sequence-relative only** and owns no pose/path/timing/connectivity or independent order graph.
- Repeated visits such as `Intro → Piano → Paris → Piano → Exit` require distinct occurrence context without duplicating the Piano Camera node.
- Stable Stop identity is required conceptually once occurrence-specific content/narration/progress/selection can bind to a visit; array index is not identity. Exact durable owner waits for reconciliation.
- Existing Camera/Direct semantics remain the sole navigation/motion authority. No Experience Camera graph/timeline/path/motion system.
- Core events remain `Activate` and `DestinationReached`; core actions remain `ShowContent`, `NavigateTo`, `OpenUrl`.
- One rule owns one semantic action. Multiple independent non-conflicting rules may share an event; ordered action lists, waits/durations, generic conditions/variables and workflow graphs are rejected from the minimum.
- Content is constrained reusable information, not arbitrary HTML/page-builder state. One responsive **Info Panel** is the minimum authored presentation semantic.
- Narration is a first-depth semantic subsystem, not generic `PlayAudio`, and is not a P25 minimum ship gate.
- Accessibility/responsive behavior is a platform contract wherever possible: semantic DOM companion navigation/content, keyboard/touch-equivalent `Activate`, focus discipline, adequate touch targets, and same-Destination reduced-motion behavior.
- Reduced motion substitutes or eliminates camera animation while reaching the same semantic Destination; merely traversing the same route much faster is not the P25 contract.
- Authoring direction is the same 3D world + Experience overlays + structured Destination/Stop/Content/rule lists + Inspector/rule cards. No node graph.

These are product/architecture decisions, not frozen persistence/schema/API decisions.

---

# Hard architecture boundaries

## One navigation and camera-motion system

Experience navigation intent resolves through existing Camera/navigation meaning. Do not introduce parallel durable copies such as:

```text
ExperienceCameraGraph
TourMotionGraph
ExperienceTimeline
VisitorNavigationV2
```

A visitor-facing Destination may reference a Camera node/view or another explicitly supported semantic Spatial identity, but Experience never owns duplicate route/path geometry.

A guided Stop is an occurrence over canonical guided order:

```text
Camera / Spatial truth
Destination Piano ── canonical target/view

Canonical guided order
Intro → Piano → Paris → Piano → Exit
          │               │
          ▼               ▼
       Stop A           Stop B
       context 1        context 2
```

Stop owns no:

```text
XYZ / camera pose
path geometry / anchors
transition timing
connectivity
independent nextId / previousId graph
```

Exact durable Stop identity and whether the canonical Camera Sequence itself evolves to carry stable occurrences are **POST-F0 / POST-P24 RECONCILIATION REQUIRED**.

## Spatial ownership remains Spatial

`LayoutDocument` and `SceneDocument` remain separately owned. Experience references stable semantic identities; it does not absorb Layout or Scene truth.

P25 consumes the canonical Spatial ownership/coordinate model accepted after P23 F0. It must **not encode the pre-F0 Room-local representation** into Experience references merely because that is current baseline behavior.

Layout continues through the single canonical geometry compiler. Experience never infers durable identity from world coordinates.

## Same project, same assets, same runtime

Experience consumes the shared project asset registry. It does not get a separate upload/media store.

Preview and Publish execute the same visitor-safe semantics; editor-only simulation/diagnostics sit outside that runtime contract.

## Visitor/editor isolation

Published visitors must not require editor selection, gizmos, Inspector state, authoring history, editor overlays or editor stores.

## Deterministic authoring/history

One logical Experience edit should produce one logical authoring history result where history applies. UI is a client of semantic domain behavior, not its sole owner.

Do not create a universal command framework merely for P25.

---

# Study/reconciliation tracks — not implementation slices

The focused research closes E1–E4 at **product-semantics level** and closes the main E5 authoring direction. E0 retains post-F0/P24 seam rechecks; E5 retains reference-integrity reconciliation; E6 remains intentionally blocked until those seams settle.

| Track | Reconciled state | Remaining work |
|---|---|---|
| E0 — Camera / visitor maturity | **PARTIAL — product audit complete enough for P25 direction** | targeted post-P23 F0 / accepted-P24 rechecks where identities, Scene targets, media or runtime seams change |
| E1 — Destination / navigation | **PRODUCT SEMANTICS CLOSED** | exact Destination target variants, durable Stop owner/representation, Room/preferred-view behavior wait for reconciliation |
| E2 — Content / presentation / Narration | **PRODUCT SEMANTICS CLOSED** | exact media record/pinning and persistence wait; Narration stays first-depth |
| E3 — bounded Interaction | **PRODUCT SEMANTICS CLOSED** | exact target/ref representation and operation APIs wait |
| E4 — guided UX / accessibility | **PRODUCT SEMANTICS CLOSED** | implementation details and device/runtime acceptance wait |
| E5 — authoring UX / Preview / integrity | **DIRECTION CLOSED; integrity reconciliation pending** | deletion/reorder/reference-repair contract and exact UI entry points after reference model settles |
| E6 — persistence / operations / implementation brief | **BLOCKED INTENTIONALLY** | runs after required P23/P24 seam rechecks; no schema/API now |

## E0 — Current Camera / visitor capability maturity + seam recheck

Current focused audit established:

- Camera order currently uses node `nextNodeId` / `previousNodeId`; current visitor flow walks node identity rather than occurrence identity.
- current visitor session supports `guided | free`, canonical route requests and Camera-order Back/Next;
- current visited state is room-based, not Stop-occurrence progress;
- P22 visitor/Preview reuse the canonical Camera route/motion system;
- current reduced-motion behavior reaches the same target but accelerates traversal rather than substituting motion;
- current visitor rendering has no authored object `Activate` seam;
- current visitor surface lacks an authored semantic DOM Destination menu / visible Home-Back-Next / Content companion;
- P22 resource plumbing is not yet a general Experience image/audio/video contract.

Targeted recheck after P23 F0 / accepted P24 minimum:

- canonical Camera/Spatial reference identities;
- Room/grouping semantics relevant to Destination;
- Scene entity kinds eligible for `Activate`;
- shared media/asset resolution and cold visitor closure;
- any visitor runtime seam changed by those tiers.

Do not reopen broad ecosystem research.

## E1 — Destination + guided Stop / Navigation

### Destination

Product meaning:

```text
Camera node / authored view
= canonical spatial viewpoint truth

Experience Destination
= reusable visitor-facing semantic reference to canonical navigation meaning
```

Minimum should prefer explicit Camera/view-backed navigation meaning. Exact support for Room or Scene-entity Destinations waits until a deterministic preferred-view/reference contract exists; do not invent “first camera in room” heuristics.

Destination may eventually carry visitor-facing label/grouping/visibility/entry metadata. Exact fields/storage are not frozen.

### Guided Stop / occurrence

Product meaning:

```text
Stop
= one occurrence of a Destination in canonical guided order
```

Why it is minimum rather than depth:

```text
Intro
→ Piano: Construction
→ Paris
→ Piano: Performance
→ Exit
```

Both Piano visits must resolve to one reusable Piano Destination/canonical Camera meaning while allowing distinct context/progress/narration later.

A Stop may carry occurrence-specific visitor context, but order is derived from canonical guided Camera order. No Experience-owned graph.

### Visitor navigation semantics

Minimum semantic surface:

```text
Home
Back
Next
Destinations
current location / guided step
Guided / Free / Resume
Help
motion preference
```

- **Home** = canonical guided entry Destination/Stop.
- **Next/Back in guided mode** = next/previous **Stop occurrence**, executed through canonical Camera navigation.
- Destination menu lists reusable Destinations; repeated Piano may appear once there while guided outline exposes its two occurrences.
- free-navigation detour keeps ephemeral `currentGuidedStop`; Resume returns to current/next guided occurrence without mutating Sequence.
- guided progress such as `Step 2 of 5` is platform-derived session presentation, not authored graph state.
- browser Back remains browser history in the minimum. Per-Destination URL/history semantics wait for deep-link scope.
- map/minimap is derived Spatial presentation and deferred.

## E2 — Content + Info Panel + Narration placement

### Minimum Content capability

Conceptual only; no schema is frozen:

```text
Content
├─ title
├─ constrained rich body
├─ optional primary project-asset media
│  ├─ accessible description / alt semantics
│  ├─ caption
│  └─ attribution / credit
└─ optional link / CTA
```

Minimum constrained body semantics:

```text
paragraph
heading
list
emphasis
inline link
```

Markdown may later be an authoring input. It is not automatically persistence truth.

### One Info Panel

P25 minimum authors one semantic presentation primitive: **Info Panel**.

Platform owns responsive presentation, typography, scrolling, breakpoints, focus behavior, close semantics, media fitting and accessible DOM. Wide layouts may render side-sheet-like; small layouts may render bottom/full sheet without becoming separate authored Content types.

Author owns content semantics, media choice, useful alt/decorative designation, contextual caption/credit and meaningful CTA/link labeling.

Derive provenance/license credit from canonical project asset metadata where possible rather than maintaining unrelated duplicate truth.

### Explicitly deferred / rejected

One level deeper:

- video;
- small media gallery;
- related Destination link;
- secondary CTA;
- richer captions.

Deferred:

- standalone passive labels/captions;
- world-space interpretation labels;
- downloads.

Reject for minimum / wrong product:

- arbitrary authored HTML/CSS/JavaScript;
- arbitrary page/layout composition;
- iframe ecosystem;
- arbitrary web-component trees;
- CMS/page-builder behavior.

Exact Experience media identity/pinning is **POST-P24 RECONCILIATION REQUIRED**.

### Narration

Narration is **first-depth, highest-priority**, not a P25 minimum gate and not generic `PlayAudio`.

Conceptually:

```text
Narration resource
= reusable narrated media + accessible transcript

Narration binding
= where/when narration belongs
```

For guided flow the strongest attachment is Stop, because repeated Destination visits may need different narration.

First-depth lifecycle direction:

- may begin on semantic Stop/Destination arrival only after visitor has enabled/started audio as browser policy permits;
- navigation stops previous narration;
- no overlapping narration by default;
- manual pause resumes current track;
- jumping elsewhere stops current narration;
- revisit restarts initially;
- autoplay rejection falls back to visible Play;
- transcript required;
- mute/volume and playback progress are visitor-session state;
- reduced motion does not change narration semantics.

Exact media ownership/resolution waits for P24 reconciliation.

## E3 — Bounded Interaction model

### Minimum vocabulary

Events:

```text
Activate
DestinationReached
```

Actions:

```text
ShowContent
NavigateTo
OpenUrl
```

`Activate` is semantic and input-independent: pointer, touch, keyboard and accessible DOM activation map to one authored behavior. Do not author `Click`, `Tap` and `KeyPress` separately.

A distinct `StopReached` event is not required for the minimum. Runtime arrival may conceptually carry guided context:

```text
DestinationReached {
  destination,
  guidedOccurrence: Stop | null
}
```

Exact runtime shape is not frozen.

### Composition rule

One rule = one semantic action:

```text
Activate Piano
→ ShowContent PianoInfo

Activate PianoMarker
→ NavigateTo Piano
```

Multiple independent non-conflicting rules may share an event. No ordering is promised.

Prefer causal semantic composition:

```text
Activate PianoMarker
→ NavigateTo Piano

DestinationReached Piano
→ ShowContent PianoInfo
```

Never require:

```text
Activate
→ Navigate
→ wait 3.6 s
→ ShowContent
```

This keeps behavior valid when Camera timing changes or reduced-motion substitutes animation.

Validator must reject conflicting same-event outcomes such as two competing `NavigateTo` actions rather than adding execution-order semantics.

### OpenUrl boundary

Use real semantic links where a link inside Content suffices. Automatic arrival must not unexpectedly open a browser context; `OpenUrl` minimum behavior remains tied to explicit visitor activation/native link semantics.

### Depth / rejection

First-depth candidates:

- `Highlight` as transient Experience/runtime attention, not Scene mutation;
- bounded session-only `Once` / `FirstVisit`;
- Narration.

Later/deferred:

- Show/Hide Scene entities;
- `MediaEnded`;
- `CueReached` only after canonical Camera cues actually exist.

Reject:

```text
ordered action lists
wait / duration workflow semantics
arbitrary variables
arbitrary expressions
generic conditions
custom JavaScript actions
generic state machines
visual node graphs
physics/gameplay event systems
```

## E4 — Guided visitor UX + accessibility contract

### Automatic platform guarantees

P25 should eventually enforce automatically:

- one semantic `Activate` across mouse/touch/keyboard/DOM;
- semantic DOM companion navigation and Content — never canvas/raycast-only;
- programmatic current Destination/Stop state;
- visible focus and logical focus order;
- deterministic Info Panel focus entry, Escape/close and focus restoration;
- responsive readable Content;
- touch targets meeting accessibility floor with a stronger comfortable product default;
- keyboard-operable media controls where media exists;
- same semantic Destination under normal and reduced-motion presentation;
- same semantic `DestinationReached` result after animated or substituted motion;
- safe external-link behavior;
- same accessibility/runtime semantics in Preview and Publish.

### Author-required semantic input

Authors supply:

- Destination label;
- interactive target label/name;
- Content title/body;
- meaningful link text;
- image alt text or explicit decorative designation;
- caption where context requires it;
- Narration transcript when Narration exists;
- video captions where meaningful audio exists.

Authors must not be able to disable visitor reduced-motion preference.

### Reduced-motion contract

Normal:

```text
Piano Destination
→ authored canonical camera motion
→ Piano
```

Reduced/no-motion:

```text
Piano Destination
→ cut / dissolve / minimal non-vestibular transition
→ same Piano
```

Accessibility changes transition presentation only. No second graph, alternate Destination or duplicate navigation state.

## E5 — Authoring UX + Preview / Publish + reference integrity

### Authoring direction — closed

Use:

```text
same project / same 3D world
+
Experience semantic overlays
+
structured Destination / Stop / Content / rule lists
+
Inspector / rule cards
```

Direct-world authoring alone is insufficient because two Stops may reference the same world target. Structured list/outliner support is therefore part of the authoring direction, not a second world authority.

Example rule card:

```text
When
Visitor activates Piano

Do
Show “Piano Information”
```

or:

```text
When
Destination reached · Piano / Stop 4

Do
Show “Performance context”
```

Do not introduce a node graph unless later scope introduces graph-shaped behavior such as branches/loops/ordered workflows — all outside the minimum.

No numeric “rule count” threshold is ratified; complexity threshold is structural, not count-based.

### Preview

Experience Preview executes the same visitor runtime semantics as Publish. Editor-only testing may layer on:

- jump to Destination/Stop;
- simulate `Activate` / `DestinationReached`;
- reset visitor session;
- test reduced motion;
- show interaction targets;
- inspect invalid references;
- show active rule/event.

Those are test lenses, not a second runtime.

### Reference integrity — remains to reconcile

Define deterministic warning/rejection/repair behavior for:

- deleting referenced Scene entity;
- replacing asset on referenced placed entity;
- deleting referenced Camera node;
- removing/reordering canonical guided occurrences;
- deleting Content;
- renaming/re-grouping Destination.

Prefer explicit invalid-reference state and repair over silent retargeting or cascade destruction.

## E6 — Persistence / operations / implementation-brief gate

E6 no longer reopens the product questions closed above. It runs only after required P23/P24 seam rechecks.

### Still genuinely open

| Question | Required gate |
|---|---|
| final Experience persistence/document owner | post-F0/P24 reconciliation |
| durable Stop owner / identity representation | post-F0 Camera/Sequence reconciliation |
| exact Destination reference variants | post-F0 Spatial/Camera reconciliation |
| Scene `Activate` target contract | accepted P24 minimum |
| Content/media durable identity and public asset resolution | accepted P24 minimum |
| deletion/reorder/reference repair behavior | after reference model settles |
| semantic Experience mutation APIs/history integration | after ownership/reference model settles |
| Save/Load codec/version | after persistence owner settles |
| P22 publish/resource validation closure | after media/reference model settles |
| exact implementation child slicing | last |

### Persistence hypotheses only

Compare when E6 runs:

```text
A. separate ExperienceDocument
B. bounded Experience section in canonical project envelope
C. smaller resources owned by existing project-level persistence boundaries
```

No option is ratified now. Do not place Experience truth into GLB/glTF `extras` merely because assets use glTF.

### Operation direction only

Future operations must expose semantic inputs, validation/preconditions, deterministic mutation scope, one logical history result where applicable, actionable errors and visitor-runtime consumption. Illustrative names such as `createDestination` or `bindInteraction` remain examples, not API commitments.

No generic command framework is created for P25.

---

# Reconciled P25 minimum — product semantics, not implementation schema

```text
P25 Foundation

Navigation
- Destination references over canonical Spatial / Camera meaning
- guided Stop / occurrence semantics over canonical Camera Sequence order
- Home / Back / Next
- Destination menu
- derived guided progress
- Guided / Free / Resume semantics

Content
- reusable contextual Content
- constrained rich text
- optional primary image + accessibility/credit semantics
- one opinionated responsive Info Panel

Interaction
- Activate
- DestinationReached (+ guided occurrence context when applicable)
- ShowContent
- NavigateTo
- OpenUrl
- multiple independent rules; one action per rule

Visitor / runtime
- semantic DOM companion navigation/content
- keyboard + touch equivalence
- reduced/no-motion reaches same Destination
- responsive/focus-safe presentation
- same visitor runtime semantics for Preview and Publish
- actionable reference validation

Authoring
- same 3D world + Experience overlays
- structured Destination / Stop / Content / rule lists
- Inspector / rule cards
- semantic operations + one history result per logical edit when history applies
```

The minimum must prove a **complete visitor journey**, not merely an interaction demo.

## Primary semantic acceptance fixture — repeated Destination

```text
Intro
→ Piano: Construction
→ Paris
→ Piano: Performance
→ Exit
```

Acceptance:

- both Piano Stops resolve to one reusable Piano Destination and one canonical Spatial/Camera meaning;
- the two occurrences may carry distinct contextual Content;
- no duplicate Camera pose/path/node is created solely for semantic repetition;
- Next/Back operate on Stop occurrence;
- Destination menu may expose one Piano Destination;
- canonical Camera route/motion executes every navigation;
- reduced motion reaches the same Piano Destination with substituted/minimal motion;
- Preview and Publish execute the same visitor semantics;
- visitor runtime requires no editor selection/history/gizmo/store infrastructure.

## Cross-category proof narratives

Use the repeated-Piano fixture as the primary semantic gate, then verify the same minimum primitives cover:

1. museum artwork — arrival Content + object activation + attribution link;
2. artist portfolio — guided sequence + free Destination jump + Resume;
3. product showroom — product activation → Info Panel + specifications link;
4. architecture walkthrough — explicit views + menu + Home/Next/Back + DOM navigation.

Educational experience is covered by the repeated-Piano occurrence fixture.

---

# One level deeper — evidence-gated candidates

Ranked after minimum:

1. Narration + transcript semantics;
2. transient `Highlight` attention action;
3. bounded session-only `Once` / `FirstVisit`;
4. video + small media gallery;
5. Resume/visited-state polish;
6. deep-linked/shareable Destinations;
7. visitor map/minimap derived from Spatial truth;
8. Camera Cue binding after canonical Camera cues exist.

Multiple tours / branching remain later than the first occurrence-aware guided proof. A dedicated semantic Hotspot remains evidence-gated for cases where no existing Scene target identity exists.

# Product boundary

## Core reusable Experience primitives

- Destination + guided Stop occurrence semantics;
- contextual Content + one Info Panel;
- bounded semantic Interaction;
- visitor navigation/chrome;
- visitor-safe accessibility/reduced-motion platform behavior;
- same-runtime Preview/Publish.

## High-value spatial Experience depth

- Narration;
- transient Highlight;
- bounded first-visit state;
- richer wayfinding/resume;
- richer media;
- deep links;
- semantic hotspots where required;
- derived map/minimap;
- later multiple tours / richer story structures.

## Later platform / specialist capabilities

- localization workflow;
- analytics;
- cross-session/account visitor-state persistence;
- XR-specific presentation/input;
- reusable Experience templates/presets;
- richer media orchestration;
- multiple tours/branching when proven.

## Wrong-product territory for P25

- generic visual scripting;
- arbitrary JavaScript actions;
- arbitrary variables/expression language;
- general state machines/workflow automation;
- ordered wait/duration action pipelines;
- physics/gameplay systems;
- inventory/scoring;
- arbitrary HTML/CSS page builder;
- general CMS;
- a second Camera/navigation/timeline system.

---

# Minimum gate from P23/P24

P25 waits for the **accepted useful minima**, not optional depth tails.

P23 must provide enough Build capability that the acceptance fixture is a credible authored environment. P24 must provide enough Stage capability that representative Scene content can be placed/revised/styled and delivered through P22.

Before E6 / implementation-ready child plans:

```text
focused P25 product semantics    CLOSED
        ↓
P23 F0 targeted reference recheck
        +
accepted P24 minimum target/media recheck
        ↓
E5 reference-integrity reconciliation
        ↓
E6 persistence / operations / codec / publish closure
        ↓
implementation-ready P25.x child slicing
```

No P25 schema, `ExperienceDocument`, operation API, Save/Load codec, backend endpoint or implementation ticket is created merely because the product semantics above are ratified.
