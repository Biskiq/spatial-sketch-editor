# Experience

**Owns:** Presentations, Guide occurrences, editorial order/pacing, visitor meaning and execution
lifecycle. Camera owns Views, routes, framing/projection and evaluation; Experience stores references
and invocation context. Presentation, Stop and session visit are distinct identities. Repeated
occurrences never require duplicated Camera geometry and lifecycle cannot be keyed solely by a
Presentation or Stop. Array position is not identity.

## Current authoring and runtime contract

Experience format 4 / ExecutionProgram 4 is the accepted product baseline. Strict readers refuse
older shapes without conversion. General interaction/state capabilities and richer orchestration
remain destination requirements, not automatic admissions into this format.

**Authored format 4**

- **A Guide is one linear order:** `id`, `label`, `stopIds` and `pacing` (`automatic` or `manual`;
  Manual keeps every stay unused). The first Stop starts the Guide and the last Stop ends it.
  There is no start Stop, no explicit continuation and no early End. Every Stop is listed by
  exactly one Guide, exactly once (`stop-guide-membership`).
- **A Stop is one visit:** a Presentation, an entry View (`entryViewId`, `null` follows the
  Presentation's Default; a named View stays pinned even when it is currently the Default),
  a finite stay of at least 1 s, an optional invitation (`{ prompt }`,
  `prompt` at most 80 code points), and an optional outgoing `transition` (`cut` or `travel`,
  absent means Cut): the step to the next Stop in its Guide. The last Stop has none
  (`travel-after-last`), and a Travel between two Stops that enter the same View is refused
  (`travel-same-view`).
- **A Presentation** carries `label`, ordered `views`, `subject`, `text` and `explorable`. Its
  first View is the Default. Each View may carry an outgoing `transition`, the step to the next
  View, and the last View has none. Steps add no Guide time. Removing View 1 makes the next View
  the Default; a Stop that entered at a removed View follows the Default. `label` is the
  creator's own name, or `null` for the linked Scene entity's live name, which is admitted
  only with a Scene-entity `subject`.
- **One rule for every edge:** a Cut or Travel belongs to the item it leaves, in a Guide and in a
  Presentation alike. Travel must resolve to exactly one existing Camera connection joining the
  two Views, in either direction. Lowering reports gaps and ambiguous connections, and binds only
  Camera identities.
- **The Experience** carries `entryGuideId`, an explicit Opening Guide that is `null` exactly
  when there is no Guide, and a plain-text `welcome` of at most 600 code points, authored on the
  Experience Card. Detours keep their shape and runtime.

**Authoring invariants** (every accepted Experience change; Camera owns the paths)

- An edit that leaves a Travel with no next item, or with the same View on both sides, writes a
  Cut in the same change. A Travel setting is never kept dormant or restored later.
- An edit that gives a Travel a new pair of different Views reuses the connection that joins the
  pair (either direction), or adds a straight connection in the same change. Planners use
  captured connection ids and refuse `travel-paths-incomplete` rather than leave a gap. No
  Experience edit deletes, retargets or reshapes a Camera connection.
- Removing a Stop, or a Guide's Stops, removes the Detours that name them in the same change.
- Creating the first Guide sets `entryGuideId`. Removing the Opening Guide moves it to the next
  Guide, or to `null`. The first Stop added to an Experience with no Guide creates a Guide with
  a default label in the same change.
- Removing a Scene entity (`delete-one`) is one compound change that also unlinks every
  Presentation about it, storing its effective name as `label`, through a pure Experience
  helper. This is the only Scene → Experience write. Nothing in World chrome marks an entity as
  linked.

**Program and runtime**

- The program carries `pacing`, each Stop's resolved `entryViewId`, `staySeconds` (`null`
  exactly when Manual) and `invitation`, each Presentation's resolved `label` and `steps`
  (`steps[i]` runs from `viewIds[i]` to `viewIds[i + 1]`), and one local-time entry per timed
  Stop. A Travel gap on a Presentation step refuses lowering like a Guide edge. `entryStopId` is
  the Guide's first Stop, or the editor's preview start, which is never authored.
- Lowering emits only `sequence-next` continuations. The program keeps its `stop` and `end`
  kinds, and the interpreter keeps handling them, as runtime capability with no authored source.
- The interpreter starts a stay only after its arrival completes (a Travel is `traveling` until
  the host confirms `arrival`). Next always works: it lands an arrival now, ends a stay, or
  continues a wait. Pause and play are run state. Explore (`enter-presentation` from a Stop)
  freezes the clock and keeps the occurrence suspended; `explore-view` plays the authored step to
  a neighbour and Cuts otherwise; `resume` restores the same occurrence, its remaining stay (with
  a 2 s lead-in) and its play state, without re-running arrival actions.
- One Guide clock: the visitor-safe `guide-run-map` adapter passes one View per Stop to the
  unchanged Camera time map, and every visitor surface is time-aligned (the public overtake is
  retired), so a run's arrival times equal the map's.


## Accessibility and platform behavior

- **DOM companion navigation is a mandatory platform contract, not polish**: a semantic
  `<nav>`/control surface that reaches every Destination and the current position — never
  raycast- or WebGL-only access. Keyboard and pointer/touch equivalence for every action.
- **Focus, labels and steps:** visible focus and logical order; Info-Panel focus-in/Escape/return;
  `aria-current` on the current Destination/Stop; progress is platform-derived (`Step 2 of 5`);
  real link semantics with a new-context warning; touch floor 24×24 CSS px with ~44 px controls.
- **Content accessibility:** required author labels (Destination, interactive target, Content
  title/body, meaningful link text), image alt *or* decorative declaration, captions where audio
  matters, and a **transcript for audio-only narration**.
- **Reduced motion reaches the same semantic destination:** `Normal: A→authored motion→B`;
  `Reduced: A→cut/dissolve/minimal→same B`. No alternate destination and no second route. An
  accelerated traversal is *not* motion removal; narration is unaffected by a motion preference and
  the author may never disable the preference.
- **Preview and publication share visitor semantics.** Preview is the same runtime under the same
  evaluation; parity is a contract, not a visual comparison.
- **Autoplay constraints:** audible autoplay is blocked before visitor interaction, so arrival can
  never unconditionally start narration — a visible play affordance is the fallback; opening a new
  browser context requires transient activation.


## Approved destination and unresolved choices

A project supports multiple Experiences over one shared world. Experience owns visitor-facing
content/localization/UI, contextual Activity invocations, typed session declarations, interactions
and reusable Presentations. No duplicate Camera graph or pose/FOV authority may be introduced.
The wider approved Gates/continuation destination remains unresolved against the current linear
Guide model: current format 4 has neither authored Gates nor explicit continuation. Do not restore
those fields or silently remove the destination commitment. A future proposal must resolve that
choice explicitly with the owner. Narration lifecycle, transient Highlight, Once/FirstVisit and
media representation/pinning require concrete capability design.

Preview and prepared publication share semantic lowering and evaluation with isolated sessions.
Current visitor Preview is implemented; public prepared publication remains unavailable.

## Experience lens — visitor-facing composition

Experience is a distinct authored semantic domain: the visitor-facing composition
of Presentations, Experience-wide Interactions, optional Guides and Stops with
stable occurrence identity, editorial order, content/localization/UI
configuration, choices and contextual invocation bindings. It answers:

> How does the visitor understand, navigate, and participate in the authored
> spatial experience?

Richer Experience workspace/UI depth remains future work; ownership and cardinality are binding. A project may hold several Experiences over one shared world,
and one package may include several with explicit selection/transition semantics.
A simple UI may initially expose one Experience and simple choices. The current Experience unit implements the bounded format above; the richer composition
model requires deliberate future format admission through [F](../composition-execution.md).

Experience references Camera Views and routes without duplicating poses, paths,
projection/FOV truth or an interpolation system; it owns occurrences, order,
holds, continuation and explicit Gates. Its
`Event → Target → Action` interaction model composes existing project meaning
rather than compensating for missing Spatial capabilities. It must not create
`ExperienceScene`, `ExperienceCameraGraph`, `ExperienceCameraPath`,
`ExperienceRenderer` or equivalent second authorities.

**Identity and execution (destination).** Presentation identity names reusable
meaning; Stop identity names one authored Guide occurrence; a session invocation
names one actual visit. Repeated Stops can reference one Presentation, and
repeated visits to one Stop are distinct invocations. Activity runs have their
own runtime identities and lifetimes. A subject/domain capability supplies
intrinsic behavior, an optional typed performance resource supplies portable
choreography, Experience authors an Activity invocation, and an execution
session runs it. Experience cannot invent a capability absent from its owner.
Execution duration, automatic readiness and progression permission are separate;
only an explicit Gate blocks an otherwise valid manual continuation. Exploration
releases guided Camera control; rejoin uses the current Camera pose and does not
silently resume autoplay. The precise detour lifecycle remains a Prototype V2
hypothesis, not an accepted default.

**Repair and readiness (destination).** A valid authored project may retain an
explicit unresolved subject, capability, View or resource binding so it can be
inspected and repaired. Missing and intentional keep-current-viewpoint are
distinct states. No resolver silently retargets by name, proximity or Room
containment, and no repair erases the affected Presentation or Stop. Preview
disables or refuses affected required behavior; publication requires executable
closure for the selected program and supported profile. Cross-domain acceptance
remains atomic under F.4.

Representative direction:

```text
Experience
├─ Presentations → focus, explanation, View uses, Activities, Interactions
├─ Experience-wide Interactions
└─ Guide (optional) → Stops referencing Presentations
   └─ editorial order, continuation, holds and Gates
       references World subjects, Camera Views and typed resources
```



## Camera authority vs Experience interaction authority

```text
Camera (authority)                      Experience (authority)
─────────────────────────────           ─────────────────────────────
connectivity / routes                   Presentations and Stops
paths / anchors / topology              guided order, holds, detours
framing / projection                    Gates / continuation / interaction policy
motion evaluation                       content, localization, UI config
intrinsic movement profiles             invocation bindings
progress markers / cues*                interaction bindings to markers
```

\* Cue ownership follows the source: Camera emits its own progress markers,
performances own their cues, Experience owns interaction bindings to them.

Experience may expose progressive View, framing and movement authoring, but each
edit delegates to canonical Camera operations and evaluation. It never stores
Camera pose, path, projection/FOV truth or a second graph. Transient World
inspection becomes durable Camera intent only through explicit capture. The
destination location and depth of Camera controls follow the promoted shell design
([PLATE §0.8.1](../design-system/editor-shell-and-visual-system.md#081-finalized-experience-shell-expression));
exact metrics and V2's remaining usability experiments stay explicit there. Camera
ownership is unchanged by lens exposure or shell promotion.

Never:

```text
Experience UI → independent XYZ/FOV interpolation
Experience order → a second writable order authority beside Camera node links
Experience timing → a copied duplicate of Camera timing
```

Motion accessibility changes presentation, not spatial truth: reduced/no-motion
preferences select a supported presentation (for example a cut or reduced
transition) that preserves meaning, without alternate camera graphs or duplicate
Presentation state.



## Interaction and behavior authoring

Interaction is the semantic behavior model of the Experience surface: a
lightweight, typed layer for common spatial and web behaviors without requiring
general-purpose application code. The authoring grammar stays close to
`Event → Target → Action`; the ratified direction adds typed session state and
bounded deterministic declarative expressions (see
[Composition, behavior, and direction model](../north-star.md#composition-behavior-and-direction-model))
for guards, derived values and choice availability. State transitions and
effects occur through explicit actions, never through expression evaluation, and
variant constraints remain validated by their owning domain. Scripts are the
separately governed extension-module exception, not the ordinary requirement.

```text
Enter → Gallery → Play Audio → gallery-narration.mp3
Click → Piano → Play Audio → nocturne.mp3
Reach → Camera C → Show → Painting Info
Cue Reached → Piano Reveal → Show → Piano Info
```

Prefer semantic triggers over raw seconds (`Enter/Leave Room`, `Sequence
Start/End`, `Reach Camera`, `Transition Start/End`, `Cue Reached`, `Click
Object`). Advanced temporal triggers evaluate against canonical authored
transition/timeline state, never a copied copy; a relative trigger like "at 60%"
re-evaluates when the source duration changes. Authoring should autocomplete from
the actual project and from capabilities supported by the selected object or
resource, and invalid operations should be rejected semantically.



## Web experience layer

Published experiences may combine 3D content with ordinary web content where
that serves the experience: text, images, panels, buttons, links, audio/video,
forms, responsive overlays, and page/view navigation. In the destination model
this surface is authored in Experience; graphics and rich media may be created
externally and imported, and the editor owns how they participate in the spatial
experience. The product does not become a Figma/Canva-style 2D design suite, a
general web-code IDE, a Webflow-like website builder, or a traditional
landing-page builder.



## Accessible platform behavior

The platform provides one semantic Activate across pointer, touch, keyboard and DOM, a DOM
companion, `aria-current="step"` progress, modal focus entry, Escape, containment and focus return,
keyboard play/pause/mute/volume, and the shared target-size floor. Preview and published execution
share semantics. Future XR access remains device-independent and includes sickness alternatives
and reduced-motion support. Narration/transcripts, transient Highlight and session-only
Once/FirstVisit remain unresolved capability choices, not shipped promises.
