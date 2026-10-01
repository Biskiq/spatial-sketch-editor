# Prototype V2 — Designer Brief

**What V2 is.** An integrated authoring prototype around **one project with one continuous
spatial Stage**. A creator points at something in the world, shapes it, makes it meaningful to a
visitor, optionally orders it into guidance, and checks it as the visitor will see it — without
switching applications, resetting the camera, or building an abstract content tree first.

**What you are being asked to do.** Design the shell, hierarchy, progressive disclosure, states,
and transitions for that prototype, and communicate the design in whatever form shows it best:
stateboards or screen compositions, annotated interaction sequences, technical visual
specifications, component or system specifications, diagrams, layout studies, written interaction
rules, or a combination. There is no required medium and no required screen count. The standard
is this: another reviewer must be able to understand the intended shell, hierarchy, disclosure
model, states, and transitions **without inventing missing behavior**.

**How to read this brief.** Section 1 is non-negotiable — a stronger-looking solution that breaks
a locked truth is a wrong solution. Section 2 is the current preferred direction: adopt it unless
you have something demonstrably stronger that still satisfies every locked truth, and say what you
rejected and why. Section 3 is yours to decide. Sections 4–11 are the working grammar. Section 12
lists dead ends: do not revive them. Questions genuinely meant for this round to settle are marked
**OPEN** — resolve everything else yourself, decisively, rather than returning timid alternatives.

**Your creative authority is real.** You may reorganize the shell, reinterpret how the index, work
card, and contextual decks present themselves, propose a stronger progressive-disclosure model,
change component composition and density, and refine the visual language. Strong-direction
treatments may be rejected when a better solution satisfies the locked constraints. Ambiguity
marked OPEN below is yours to resolve in the work — option-mongering is not wanted; only flag an
ambiguity back if the ambiguity itself is worth testing with users.

---

## 1. Locked — these must remain true

1. **One project, two lenses.** World and Experience are two authoring intentions over a single
   project, not two documents and not two applications. Switching lenses changes which edits are
   available and what the index shows. It never replaces the renderer, moves the camera, changes
   the selection, or resets history.
2. **One writable owner per fact.** Architecture, object composition, camera, visitor meaning, and
   reusable resources (states, performances, media, definitions) are distinct concerns. The interface
   must never let two places write the same fact, and must never smuggle a new domain inside another
   document's editor.
3. **One camera authority.** Guided travel, free looking, reduced motion, cinematic, and future
   immersive viewing are all expressions of a single camera authority. There is exactly one
   navigation truth: no second route graph, no independent camera interpolation, no ordering
   mechanism beside the guide that also claims to order the visit.
4. **Three distinct identities: reusable meaning, occurrence, session.** A Presentation is reusable
   visitor meaning (focus, explanation, framings, behaviors, visitor offers) with no inherent order.
   A Stop is one stable occurrence of a whole Presentation inside a guide (its entry framing, pacing,
   continuation, and entry conditions belong to the occurrence). A visit is one session's runtime
   identity. Ordering never clones meaning: placing the same Presentation twice creates two
   occurrence identities over one shared meaning.
5. **Camera owns framing; Experience owns use.** The camera side owns framing, projection, routes,
   and movement; the experience side owns what is used, bound, and activated. Only camera-declared
   settings vary locally — there are no generic position/orientation override fields. A Cut selects a
   framing without inventing a spatial connection; Travel requires a real route and otherwise reports
   a gap.
6. **Honest execution.** Conflicting behaviors reject by default; only explicitly declared handoffs on
   compatible channels resolve them. Stale sessions cannot reclaim control. Drafts may carry
   explicitly-marked unresolved references; required unresolved behavior blocks the affected Preview
   scope, and unresolved drafts remain repairable. No silent retargeting by name or proximity, no empty fallback passed off as a
   choice: staying with the visitor's current viewpoint is an explicitly authored policy, never a
   missing value.
7. **Preview is a visitor takeover, not a third editing mode.** All authoring chrome — index, work
   card, tools, gizmos, selection, history — is absent in Preview. Preview runs on detached session
   state and never writes visitor choices or behavior results back into authored work. Leaving Preview
   restores the exact authoring context: lens, selection, card, camera standpoint, and inspection.
8. **One selection.** There is exactly one selected identity across lenses. A subject selected while
   working on the world stays selected when the creator switches to Experience; what changes is the
   card, from source editing to visitor-facing actions. A "working on" context for a Presentation is
   authoring context, never a second selection.
9. **Temporary inspection is never visitor behavior.** Section cuts, unfolded walls, selection marks,
   and editor-only visibility are authoring aids. Nothing temporary leaks into what the visitor gets
   unless the creator explicitly captures it.
10. **Exactly three materials, role-bound type, a fixed state language** (section 9). No fourth
    material, no decorative panels inside panels, no meaning carried by color alone, no merged
    hover / armed / selected / focus treatments.
11. **Visitor surfaces carry no authoring machinery.** No selection, history, gizmos, layout editing,
    or authoring infrastructure reaches the visitor. Unrelated parallel work is out of scope for V2;
    the one thing it contributes is a rule already stated above: every control must declare what it
    writes and how far the write reaches.

---

## 2. Strong direction — adopt unless you beat it

1. **One spatial workbench with a contextual work card.** A thin project head (identity, save and
   history, the World | Experience switch, the active Experience selector, Preview). A left index
   that locates things. A central Stage that gets the largest share of space. A right work card that
   is the action and explanation surface. A bottom deck that appears only while ordered occurrences
   or precise direction are being edited — a guide strip or a direction instrument, never both as
   permanent furniture. A quiet status rail that reports (domain, view, selection, save, grid,
   coordinates) and owns nothing. Delivery and publication flows are not part of this prototype.
2. **The target visual language: dark cutting mat, drafting vellum, ochre selection.** Spatial
   modeling reads against a dark green mat; measured drafting reads on warm vellum; selection is an
   ochre contour, never a flood. The surrounding chassis stays cool, square, and quiet; instrument
   controls look compact and manufactured. (Full grammar in section 9.)
3. **The work card always declares its edit scope before any edit:** World source, Presentation,
   Camera View, or This Stop. A subject selected in Experience shows its world facts read-only,
   with a path to edit the source and a path to present it. Edits to anything shared show their
   reach: what will change everywhere and what changes only here, with counts.
4. **Camera disclosure in four depths.** Automatic framing of the focus; direct-language hints
   (near/far, side, height, look-at, movement intent); explicit capture of the current standpoint;
   then a precise direction instrument (observer and target, lens and projection, route, anchors,
   motion character, evaluated path). Timed or scored coordination appears only for work that
   genuinely needs coordination — simple presentations never open on a timeline.
5. **Nothing is captured implicitly.** Creating a Presentation never captures a camera framing.
   Suggested framing stays a temporary preview until explicitly accepted; capturing the current
   standpoint takes only eligible camera parameters. The one explicit alternative is the
   keep-current-viewpoint policy, chosen deliberately, which lets the visitor stay where they are.
6. **Guidance is optional and late.** Creating a Presentation creates no guide, no stop, and no
   camera checkpoint. Adding a guide is a deliberate act; each placement creates one occurrence.
   Default Next follows guide order. Manual Next stays available whenever a valid destination exists
   unless the author deliberately gates it — long narration or ongoing motion never implicitly locks
   it. Duration is not permission; cancel, finish, and continue are three distinct things.
7. **Return is grammatical, not a tab marker.** Escape steps back one nested inspection; the first
   crumb returns to the base standpoint; labels read as "return to…" and "put it back." The trail of
   where the creator stood is separate from Undo: Undo revises accepted source edits and never moves
   the camera. Source edits survive putting the view back.
8. **Make system state observable.** The design must keep visible: what is selected, which
   Presentation is being worked on, the stage's current recipe, which authored unit each action
   touches, and what the visitor invocation will be. Failures appear as typed states with repair
   actions, never as silent fallbacks.

---

## 3. Open design territory — decide deliberately

| # | Territory | Guidance |
|---|-----------|----------|
| O1 | Standpoint control form | Continuous tilt between measured Plan (top-down) and 3D endpoints is locked; the control's exact form, placement, and how settled-scale declarations read are open. |
| O2 | Index and card hierarchies | Roles are locked (locator vs. action surface); tree depth, grouping, relation views (e.g. "3 Presentations about the piano"), and when card sections appear are open. |
| O3 | Guide deck and direction deck detail | Appear-when-needed and never-both-permanent are strong direction; card order, stop-card density, and route-overlay form are open. |
| O4 | **OPEN:** promoting an interior framing to a Stop | Default hypothesis: it sets an entry-framing override on the same Presentation without restarting or seeking its explanation. The alternative — establishing an explanation checkpoint — stays open. Design the chosen default crisply enough that the predict-then-preview experiment can be run later against the implemented V2; running that study is not part of this commission. |
| O5 | **OPEN:** detour semantics | Default hypothesis: pause the parent explanation and automatic viewing, keep its invocation, let running subject behaviors follow their own lifecycles, resume from the actual pose without replaying entry. The alternative — ordinary departure and re-entry — stays open. As with O4, design the default so the later predict-then-preview study can discriminate; the study itself belongs to the implemented V2, not this commission. This is an experimental default, not policy. |
| O6 | Dense-project expression | The behaviors are locked (section 10); their visual expression at compact window sizes and inside the deck is open. |
| O7 | **OPEN:** motion-speed control placement; keyboard-focus ring treatment; mat-to-paper transition | Propose and flag as provisional. Do not place owned controls in the readout-only status rail. |
| O8 | Copy and tone | Wording of actions, scope headers, and refusal reasons is yours; the distinctions they carry are locked. |

---

## 4. Shell thesis and information hierarchy

**Keep the world in place; change the authoring intention around it.** A creator points at a
subject, works on it, and makes it meaningful to a visitor without moving to another application,
resetting the camera, or constructing an abstract content tree first.

```text
Project
├─ World lens → source truth and intrinsic capability (subjects, structures, environment)
├─ Experience lens → the active Experience: Presentations (reusable meaning),
│                     Experience-wide visitor offers, and an optional guide of Stops
├─ Shared camera authority → framings, routes, projection, evaluation
├─ Shared reusable resources → states, performances, media, definitions
└─ Preview → the selected Experience, Presentation, or Stop, as the visitor will meet it
```

The primary creator objects are **subjects** and **Presentations**. Guides are optional
compositions of occurrences. The runtime never writes back into world truth.

**Glossary for this brief.** Stage: the central spatial surface. Index: the left locator.
Work Card: the right action surface. Deck: the contextual bottom strip (guide or direction).
Presentation / View / Guide / Stop / Preview as defined in the Locked section and section 6.

---

## 5. Continuous Stage and its spatial language

- **One continuous camera.** Plan is the camera tipped to top-down; 3D, face-on, section, and
  look-up are standpoints, never modes or separate workspaces. Plan is a measured view of the same
  model, not a second document or toolset.
- **Temporary displacement, always reversible, always badged.** A curved wall unrolls; a ceiling
  lifts on tethers; the building parts along a drawn line; walls set aside. Displaced geometry reads
  as dashed and view-only, and the as-built state stays visible behind it. Putting it back is one
  explicit action.
- **Honest scale.** Near principal orientations the picture settles and declares which axes are to
  scale: flat, plan, and section views read both axes; an unrolled curve reads heights-only ("heights
  to scale; curve foreshortens widths"). Numbers are always measured; the picture claims to scale
  only when settled.
- **One writer per number.** Handles on the stage, measurement tapes, and card fields all write
  through a single path per value. Invalid input refuses visibly — a distinct refusal treatment with
  a reason — and cancels on release, leaving no history behind.
- **Handles where their axis reads.** An editing handle appears wherever its own edit axis is legible,
  in every standpoint; fine profile details are the face-on exception. Numeric entry is always
  available as the alternative. Yellow tape marks the typeable; it never marks selection.
- **Find with reason.** Search reports each hit's name, why it is hidden if it is (behind, off-view,
  beyond, set aside), a beacon, and a recovery action (look, face, include, show-through, go to).
  Reveal shows one hidden source x-rayed at its true place without changing depth. Quiet references
  by default, full strength for selection, deliberate decluttering under load.
- A small human figure gives scale; a visible floor datum anchors height; "open on purpose" has its
  own green, distinct from selection and approval.

---

## 6. Index, Work Card, and deck roles

- **Index: a locator, never the property editor.** In World it shows places, subjects, and
  containment. In Experience it shows a searchable Presentation list (title, focus, guide-use count,
  issue state), Experience-wide visitor offers, and a guide entry only if one exists. Search spans
  both lenses and explains why a hit sits outside the current view. The selected identity stays
  pinned and visible while filtering or occlusion hides it.
- **Work Card: an action surface, never a dump of all properties.** Its header states target and
  edit scope first. It collapses for spatial work and restores its target on reopen. A Presentation's
  ordinary card composes slots, not steps: title and meaning; focus list with room to add; a Show
  slot (suggested framing, captured framing, or keep-visitor policy); a Happens slot (supported
  subject actions); a Visitor-can slot (offers to visitors); a Guide slot. Meaning may precede
  framing; no slot is mandatory.
- **Bottom deck: absent by default.** A guide deck shows ordered Stop cards once a guide exists. A
  direction deck shows the precise camera or timing instrument once travel, framing, a multi-framing
  sequence, or repair genuinely needs it. Card and deck resize and collapse; under narrow widths,
  metadata compresses before identity, selection, stage, or the active instrument.
- **Every consequential screen must show whose fact is being edited** and, for shared things, how
  far the edit reaches — with counts, affected lists, and an explicit fork path.

---

## 7. Presentation, View, Guide, Stop — how they meet the interface

- A Presentation composes focus, explanation, framings, behaviors, and visitor offers. A
  Presentation references reusable Camera-owned framings (Views): those Views appear as part of its
  composition but retain independent Camera identity. The first may be the entry; later ones surface
  through named cues, manual availability, or suggested progression — and the visitor may jump.
  A framing never becomes a Stop on its own.
- **Present this**, offered on a selected subject, multi-selection, region, environment, or current
  viewpoint, creates a distinct draft Presentation, selects it, and opens its card. The subject stays
  linked as focus with a cue that is visibly not selection. Before creating, the subject card shows
  which Presentations already address it, so existing meaning is reopened rather than silently merged
  or overwritten.
- Explanation is a title plus short text or media. Ordinary Presentation authoring requires no
  duration or timing fields; timing detail appears only when the work genuinely needs coordination.
  Trying a subject capability is a temporary audition; capturing it authors a
  contextual behavior with its scope shown. Letting visitors operate something is a separate offer,
  contextual or Experience-wide — operating the subject and offering it to visitors are two acts.
- **Add to Guide** (or dragging a Presentation into the deck) creates one Stop, headed as an
  occurrence of its Presentation ("this Stop · appearance 2 of …"). Its controls: entry framing or
  keep-current-viewpoint, Cut or Travel, pacing, continuation, visitor choice, entry conditions.
  Shared meaning is edited through an explicit shared-edit path that names its reach ("used by 2
  Stops"); a genuinely different story at one occurrence is an explicit fork into a new Presentation;
  an entry-only difference specializes the framing without cloning meaning.
- No Presentation inherits Previous or Next from where it is used. Autoplay readiness, manual-Next
  permission, and entry conditions are labelled as three separate things.

---

## 8. Progressive Camera disclosure and shared-framing scope

- **Four depths, in order.** Automatic framing of the focus. Direct-language hints — near/far, side,
  height, look-at, movement intent. Explicit capture of the current standpoint into a named framing.
  A precise direction instrument: observer and target, lens and projection, route, anchors, motion
  character, evaluated path — with return restoring standpoint and composition context.
- **Shared framings always offer scope at the point of edit:** update everywhere, with the affected
  list and count, versus change-only-here, which creates a private specialization for that use. The
  card always names the framing and its use count. Reuse warns before all-uses change; forking saves
  a separate copy. Capture is explicit: inspection stays temporary until captured.
- **Cut versus Travel with a visible gap.** A missing route is shown as a gap with two honest
  choices: author a route, or cut. A route-map overlay may author canonical camera connectivity.
  Generated intermediate endpoints may be displayed but are never authored as anchors. Timed scores
  appear only when coordination work needs them.
- **After world geometry changes**, adaptive framings recompute and surface the change for
  inspection; pinned framings report that they need review. Presentation identity and explanation are
  untouched by either.

---

## 9. Preview takeover, free exploration, and return

- Preview entry follows the current authoring context (Experience, Presentation, or Stop) and offers
  a choice only when the entry is ambiguous. The Preview surface is the visitor program plus one
  small draft-exit affordance — nothing else.
- Before entry, readiness checks run: unresolved **required** references block that
  scope and link to the repair card; unaffected scopes remain previewable. Drafts may keep unresolved
  references for repair.
- The visitor always knows where they are: active Presentation, current Stop when guided, available
  actions. **Explore freely** releases guided camera control and pauses autoplay without ending the
  Experience or touching world truth. **Return to guide** names the target Stop and travels from the
  actual current pose via a real route or the authored Cut policy — never an improvised path, never
  replaying entry effects. Autoplay stays off after rejoin until the visitor enables it.
- Leaving Preview discards all visitor-only state and restores lens, selection, card, standpoint,
  and inspection exactly. Every Preview is a fresh session; ordinary editing happens outside it.

---

## 10. Visual grammar, state language, and component patterns

This section replaces repository access: it is the complete visual contract. Reference window sizes
below (a comfortable desktop around 1440×900, a dense check around 1280×768) and inherited panel
proportions (a narrow spine around 56, a head around 36, a readout rail around 24, an index around
240–300, a card around 300, a 44 tool rail, a centre-only view bar) are **density evidence, not V2
geometry**. Keep their proportions and shedding order; do not treat them as mandatory measurements.
There is no permanent camera drawer and no permanent timeline in V2.

**Materials — exactly three, never a fourth.** Chassis: the outer shell (spine, head, index, card,
view bar, status rail, deck frames) — cool, square, quiet, no decorative shadows, hairline borders
plus tonal steps. Paper: the Stage and contextual instruments — the only place
spatial meaning lives — with two expressions: a dark spatial-mat expression for modeling and a warm
drafting-vellum expression for measured work, each gridded. Instrument: tray, mode, utility, transport, local timing/score, and numeric controls —
a slight manufactured edge, small radius. Grid discipline: steps on 1·2·5 progressions, major lines
at five times minor, minor lines dropped once they would fall below about 16px. A thin paper
perimeter inset; grid and display changes never create history entries.

**Color — semantic, never decorative:**

| Role | Treatment |
|------|-----------|
| Selection | Ochre core `#E5A020` with dark boundary `#8A5B10` and a quiet 10% fill — contour plus the active handle plus the affected edge only, never a surface flood. Accents live on the chassis; they never flood Paper. |
| Typeable / armed | Tape yellow marks what can be typed. Armed is a one-step sink with full ink — no amber edge, no weight jump. |
| Displaced / view-only | Dashed slate `#56707C`, always labelled view-only. |
| Refusal | Pale ground `#FDF3F0` with deep red `#7E2718` plus a terracotta signal, a stated reason, and a recovery action. Refusal outranks the value fill and preserves focus and selection. The older crimson `#9B3149` is its production-era equivalent — use the target treatment. |
| Caution | Warm paper `#F7EDE8` with `#C85A48` ink plus a recovery action. Caution is styled distinctly from refusal; a warning is never dressed as a refusal. |
| Open on purpose | Green `#2A9384`. |
| Snap | Teal `#146D68`, with its own ink. |
| Architecture domain | Warm bronze `#946D34`. |
| Camera domain | Slate teal `#347D89`. |
| Cutting mat | Deep green `#1D3A33`, background `#152C26`, minor grid `#2B5147`, major grid `#3C6A5C`. |
| Drafting vellum | Warm off-white `#F3F4EE` with a 1m/5m grid; technical ink `#202422` / `#3E4440`; perimeter line `#B8BEB3`. |
| Chassis / instrument neutrals | Chassis `#EEEDE8`, recess `#E2E0D8`, instrument `#F8F8F4`, hover `#F0EFE9`. |

No state may be carried by hue alone — every state pairs color with shape, label, or placement.
Theme-proof invariants: the red/green/blue axis and gizmo colors, selection outline and handles,
plan-paper tones and plan semantic colors, and the local score and parameter colors of that
timing instrument, where it exists, never shift.

**Typography — two voices, roles before numbers.** A humanist sans for interface, a narrow mono
for measures. A closed ladder from 9 to 20 (9 / 10 / 11 / 12 / 13 / 15 / 20) consumed through roles:
row text, identity (head name around 14), section headings (small, semibold, letterspaced),
engraved view tabs, control text, utilities (around 10), mode captions, status readouts, property
labels (around 12) versus values (around 13), and mono references, ticks, readouts, and station
labels. The tool rail sets micro-type (group labels smallest, tool labels one step up, with a
compact floor below that used sparingly). Two global scale knobs — one for type, one for controls —
are the only scaling mechanism.

**Controls and density.** Four control heights (tall, medium, compact, mini — roughly 30 / 26 / 24 /
20 with matching horizontal padding); corner radius follows material (square chassis, small-radius
instruments, tighter paper handles). Spacing steps of 4 / 8 / 12 / 16 / 20 / 24. Index rows carry
name first with a small mono reference that never truncates identity; indentation in small steps.
Property cards read header (icon, name, reference, kind), then grouped sections (geometry, transform,
placement, identity, relationships, lens, sequence), with actions last and section headings engraved.
The 44-unit tool rail shows icons over persistent engraved labels with a tool-only vocabulary
(select, transform, space, objects, plus camera variants). Precision lives at the gesture —
dimensions, snap, refusal, card entry — and is never duplicated into the status rail. As width
shrinks: shed metadata first, then captions, then low-frequency utilities; identity, selection, view
tabs, and tools survive last.

**The full state roster — use these, invent no parallels.** Hover lifts. Selected adds accent edge
and fill, shared with the viewport. Keyboard focus is an independent offset ring shown for keyboard
input. Pressed and toggled recess with an edge border and an inset bottom rule. Armed sinks, without
amber. Disabled always states why. Refusal is explicit with reason and recovery. Caution is separate
from refusal. Destructive actions come last. Preview ghosts render at reduced alpha with ghost ink.
Snap uses its own ink. Authored values read primary with mono; derived values read quiet mono.
Temporary states read dashed, ghosted, or explicitly view-only. Refused, cautionary, and view-only
are three treatments that must never be confused.

---

## 11. Dead ends — do not resurrect

- A creator axis split into two permanent applications, or a top-level model that reads as
  "build space here, publish there." Lenses, not applications.
- A permanently visible camera timeline, transport strip, or storyboard that makes guidance look
  mandatory and steals the Stage. Timing surfaces appear only when coordination work calls for them.
- Plan and 3D as peer workspaces, tabs, or toolsets. They are two ends of one continuous standpoint
  control.
- A dashboard-style card that dumps every property, a filesystem-style tree as the primary
  navigator, or a fixed three-column property panel as the only way to act.
- Authoring chrome inside Preview: outlines, inspectors, guide strips, raw identifiers, dependency
  pickers, builder workflows, mode banners over the visitor program.
- Form-first authoring for simple work: repeated fields for duration, cues, lifetimes, or schema
  detail before a first Preview is possible. The simple path is subject → present → meaning →
  framing → preview, with nothing else required.
- Motion vocabulary that invents camera paths (arcs, approaches, learned policies) outside the one
  camera authority, or timing numbers, key bindings, and fixture states carried over from earlier
  explorations.
- Silent behaviors: last-write-wins as a global rule, history entries for refused or display-only
  changes, nearest-name retargeting, empty fallbacks presented as choices, visitor operations written
  back into world truth.

---

## 12. Dense-project and failure/repair states

These behaviors are locked; only their visual expression is yours (O6):

- **Many items.** Search, filters, compact rows, relation counts, and a pinned selected item. The
  guide deck collapses and groups while keeping occurrence identity and order legible. At compact
  sizes the shedding order in section 10 applies.
- **A world subject moved.** Adaptive framings recompute and surface the change for inspection;
  pinned framings flag themselves for review. Identity and explanation are untouched.
- **A subject or capability removed.** The affected binding keeps its original identity and shows a
  typed failure. Presentations and Stops survive. The creator relinks, removes the use, or keeps an
  explicit unresolved draft — never a silent nearest-name repair.
- **A missing route.** Travel shows the gap with two honest choices: author a route, or cut.
- **Preview gating.** Required-but-unresolved references block that scope and link to the repair
  card; unaffected scopes stay previewable. Refusal stays local with a recovery action.
- **Several Presentations on one subject.** The world selection shows the relation set; new meaning
  gets a new identity and never overwrites.
- **Lens switch mid-inspection.** Stage recipe and standpoint persist; Experience may explicitly
  save eligible camera intent without serializing the editor-only opening.

---

## 13. The design challenge — situations your proposal must resolve

Demonstrate, in the forms you judge strongest, that your design convincingly resolves each of these.
Do not treat them as a screenshot checklist; several may share one artifact, and some may be best
shown as rules, sequences, or specifications rather than screens.

1. **Ordinary world authoring.** Selecting, inspecting (face, open, look inside, look up),
   displacing and restoring geometry, editing a value to refusal, finding a hidden subject and
   recovering it — with scope and scale honesty visible throughout.
2. **World-to-Experience continuity.** The same standpoint and selection crossing lenses, the card
   changing from source editing to visitor-facing actions, inspection persisting without leaking
   into visitor behavior.
3. **Present this and Presentation composition.** From the relation set through the draft card —
   meaning first, then the Show / Happens / Visitor-can slots — to a first Preview with no guide
   in existence, and with no framing captured before the creator explicitly accepts or captures one.
4. **Multiple Camera-owned framings composed in one Presentation.** Entry, named cues, manual availability, suggested
   progression — and the visitor's freedom to jump. Show that framings never silently become Stops.
5. **Shared-framing scope and where-used.** The update-everywhere versus change-only-here decision
   with affected lists and counts, the fork path, and the review flag after a world change.
6. **A repeated Presentation across a guide.** Two occurrences, one shared meaning, distinct
   occurrence identities — plus occurrence-local editing of entry, pacing, continuation, and entry
   conditions, and the explicit fork when one occurrence needs genuinely different meaning.
7. **Cut versus Travel.** The gap state, authoring a route versus cutting, and the route overlay —
   with generated endpoints shown but never authored.
8. **The disclosure ladder into precise direction.** From automatic framing through hints and capture
   to the full direction instrument and back, with no timeline imposed on simple work.
9. **Preview takeover.** Entry from context, the visitor-only surface, blocked-scope repair links,
   free exploration with paused autoplay, the named return to guide, and exact authoring restore on
   exit.
10. **Density and repair.** The full project at a compact window; a moved subject; a removed
    subject or capability; relink, remove, or keep-as-draft — with refusal, caution, and view-only
    never confused.

Evidence bar: for each situation, show the shell regions involved, the states and transitions, the
edit scope and reach of each consequential action, and the exact recovery from each failure. A
reviewer who has only your response must be able to reconstruct the intended behavior without
inventing anything.
