# Experience — visitor composition and execution

**Owns:** Presentations, Guide occurrences, editorial order and pacing, visitor meaning and execution
lifecycle. Camera owns Views, routes, framing/projection and evaluation; Experience stores
references and invocation context.

**Presentation, Stop and session visit are distinct identities.** Repeated occurrences never require
duplicated Camera geometry, and lifecycle cannot be keyed solely by a Presentation or a Stop. Array
position is not identity.

## Authored model

- **A Guide is one linear order:** `id`, `label`, `stopIds` and `pacing` (`automatic` or `manual`;
  Manual keeps every stay unused). The first Stop starts the Guide and the last ends it. There is no
  start Stop, no explicit continuation and no early End. Every Stop is listed by exactly one Guide,
  exactly once (`stop-guide-membership`).
- **A Stop is one visit:** a Presentation, an entry View (`entryViewId`; `null` follows the
  Presentation's Default, and a named View stays pinned even when it is currently the Default), a
  finite stay of **at least 1 s**, an optional invitation (`{prompt}`; `prompt` **at most 80 code
  points**) and an optional outgoing `transition` (`cut` or `travel`; absent means Cut) to the next
  Stop in its Guide. The last Stop has none (`travel-after-last`). A Travel between two Stops that
  enter the same View refuses (`travel-same-view`).
- **A Presentation** carries `label`, ordered `views`, `subject`, `text` and `explorable`. Its first
  View is the Default. Each View may carry an outgoing `transition` to the next View; the last has
  none. Steps add no Guide time. Removing View 1 makes the next View the Default; a Stop that
  entered at a removed View follows the Default. `label` is the creator's name, or `null` for the
  linked Scene entity's live name, admitted only with a Scene-entity `subject`.
- **One rule for every edge:** a Cut or Travel belongs to the item it leaves, in a Guide and in a
  Presentation alike. Travel must resolve to exactly one existing Camera connection joining the two
  Views, in either direction. Lowering reports gaps and ambiguous connections and binds only Camera
  identities.
- **The Experience** carries `entryGuideId` (an explicit entry Guide, `null` exactly when there is
  no Guide) and a plain-text `welcome` of **at most 600 code points**, authored on the Experience
  Card. Detours keep their shape and runtime.

### Authoring invariants

Every accepted Experience change preserves these; Camera owns the paths.

- An edit that leaves a Travel with no next item, or with the same View on both sides, writes a Cut
  in the same change. A Travel setting is never kept dormant or restored later.
- An edit that gives a Travel a new pair of different Views reuses the connection joining the pair
  (either direction) or adds a straight connection in the same change. Planners use captured
  connection ids and refuse `travel-paths-incomplete` rather than leave a gap.
- No Experience edit deletes, retargets or reshapes a Camera connection.
- Removing a Stop, or a Guide's Stops, removes the Detours that name them in the same change.
- Creating the first Guide sets `entryGuideId`. Removing the Opening Guide moves it to the next
  Guide, or to `null`. The first Stop added to an Experience with no Guide creates a Guide with a
  default label in the same change.
- Removing a Scene entity (`delete-one`) is one compound change that also unlinks every Presentation
  about it, storing its effective name as `label`, through a pure Experience helper. This is the
  only Scene → Experience write. Nothing in World chrome marks an entity as linked.

## Lowering and interpreter

- The `ExecutionProgram` carries `pacing`, each Stop's resolved `entryViewId`, `staySeconds`
  (`null` exactly when Manual) and `invitation`, each Presentation's resolved `label` and `steps`
  (`steps[i]` runs from `viewIds[i]` to `viewIds[i + 1]`), and one local-time entry per timed Stop.
  A Travel gap on a Presentation step refuses lowering like a Guide edge. `entryStopId` is the
  Guide's first Stop or the editor's preview start, which is never authored.
- Lowering emits only `sequence-next` continuations. The program keeps its `stop` and `end` kinds,
  and the interpreter keeps handling them as runtime capability with no authored source.
- The interpreter starts a stay only after its arrival completes (a Travel is `traveling` until the
  host confirms `arrival`). **Next** always works: it lands an arrival now, ends a stay, or
  continues a wait. Pause and play are run state.
- **Explore** (`enter-presentation` from a Stop) freezes the clock and keeps the occurrence
  suspended; `explore-view` plays the authored step to a neighbour and Cuts otherwise. **Resume**
  restores the same occurrence, its remaining stay with a **2 s lead-in** and its play state,
  without re-running arrival actions.
- One Guide clock: the visitor-safe `guide-run-map` adapter passes one View per Stop to the
  unchanged Camera time map, and every visitor surface is time-aligned, so a run's arrival times
  equal the map's.
- Editor Preview starts paused and seeks by replaying the same reducer and sampling Camera's
  existing motion. Public entry retains autoplay and read-only progress.
- A missing Travel connection is a typed gap, never a fabricated path. Reduced motion settles to the
  same destination without changing the authored stay or order.

Limits: no collision/navmesh; synthesized look; guarded deletes.

## Accessibility and platform behavior

- **DOM companion navigation is a mandatory platform contract, not polish:** a semantic `<nav>` and
  control surface reaching every Destination and the current position — never raycast- or
  WebGL-only access. Keyboard and pointer/touch equivalence for every action.
- **Focus, labels and steps:** visible focus and logical order; Info-Panel focus-in/Escape/return;
  `aria-current` on the current Destination/Stop; progress is platform-derived (`Step 2 of 5`); real
  link semantics with a new-context warning; touch floor **24×24 CSS px** with ~**44 px** controls.
- **Content accessibility:** required author labels (Destination, interactive target, Content
  title/body, meaningful link text), image alt *or* decorative declaration, captions where audio
  matters, and a **transcript for audio-only narration**.
- **Reduced motion reaches the same semantic destination:** `Normal: A→authored motion→B`;
  `Reduced: A→cut/dissolve/minimal→same B`. No alternate destination and no second route. An
  accelerated traversal is not motion removal; narration is unaffected by a motion preference and
  the author may never disable the preference.
- **Preview and publication share visitor semantics.** Preview is the same runtime under the same
  evaluation.
- **Autoplay constraints:** audible autoplay is blocked before visitor interaction, so arrival can
  never unconditionally start narration — a visible play affordance is the fallback; opening a new
  browser context requires transient activation.

## Interaction and session model

Interaction is the typed behavior layer of the Experience surface: a lightweight grammar close to
`Event → Target → Action`, with typed session state and bounded deterministic declarative
expressions for guards, derived values and choice availability. State transitions and effects occur
through explicit actions, never through expression evaluation, and variant constraints remain
validated by their owning domain. Scripts are the separately governed extension-module exception,
not the ordinary requirement.

```text
Enter → Gallery → Play Audio → gallery-narration.mp3
Click → Piano → Play Audio → nocturne.mp3
Reach → Camera C → Show → Painting Info
Cue Reached → Piano Reveal → Show → Piano Info
```

Prefer semantic triggers over raw seconds (`Enter/Leave Room`, `Sequence Start/End`, `Reach Camera`,
`Transition Start/End`, `Cue Reached`, `Click Object`). Advanced temporal triggers evaluate against
canonical authored transition/timeline state, never a copied copy; a relative trigger like "at 60%"
re-evaluates when the source duration changes. Authoring autocompletes from the actual project and
from capabilities supported by the selected object or resource; invalid operations are rejected
semantically.

The shared interpreter has typed boolean/choice declarations with initial/reset values, a
deterministic reducer over explicit events, bounded literal/state-read/equality/conjunction guards,
and `runId`/`runEpoch` rejection of stale events. A same-run reset rewinds without a new epoch; no
landed asynchronous effect family exposes this. The event set has no Presentation-entry event, and
`navigate` requires a Stop, so a Stop-free Presentation lowers but cannot be shown.

## Open seam: linear Guides versus future Gates

The current format uses **linear Guides**. Broader branching, explicit continuation and Gates remain
an explicit future owner decision: neither restore the retired node-link order fields nor foreclose
future Gates. The wider approved destination remains unresolved against the linear model, and a
future proposal must resolve that choice explicitly with the owner. Narration lifecycle, transient
Highlight, Once/FirstVisit and media representation/pinning require concrete capability design.

Experience references Camera Views and routes without duplicating poses, paths, projection/FOV truth
or an interpolation system; it owns occurrences, order, holds, continuation and explicit Gates. It
must not create `ExperienceScene`, `ExperienceCameraGraph`, `ExperienceCameraPath`,
`ExperienceRenderer` or equivalent second authorities. A project may hold several Experiences over
one shared world, and one package may include several with explicit selection/transition semantics.
Preview and prepared publication share semantic lowering and evaluation with isolated sessions;
public prepared publication remains T4's obligation.
