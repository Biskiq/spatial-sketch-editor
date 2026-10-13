# Experience V3 — shell and visual-system specification

**Proposed for owner ratification, 2026-10-13.** Canonical V3 visual/exposure
specification; product semantics are in the [proposal](./README.md), delivery in
the [plan](./implementation-plan.md), and specimens/acceptance in the
[board package](../../../../../prototypes/experience-ux-v3/README.md).
This is an Experience-scoped candidate amendment to PLATE, not a landed contract
or an authorized World redesign. No application CSS changes accompany it.

## 1. Design thesis and considered compositions

Use a **green spatial frame with white editing surfaces and gold editorial
selection**. The signature is the dark-green Guide ribbon attached to the museum's
working edge: it reads as an arrangement of encounters while the Stage stays
spatial. Blue Camera geometry can be inspected within that frame without becoming
the product's primary identity. Gold indicates what the creator is working on;
green indicates an action or active task. Large uninterrupted spatial ground
provides confidence and continuity.

Three compositions were assessed:

```text
Always-open twin panels + wide technical Deck
  familiar, but repeats today's Stage loss and scope clutter → reject

Canvas-only with floating inspectors and full View storyboard
  spacious at rest, but loses stable ownership and Stop boundaries → reject

Adaptive Index + identity Card + contextual Guide/player
  stable landmarks, breadth only where order/time requires it → recommend
```

Retain the shared Head/Index/Stage/Card landmarks, truthful instruments and explicit
return. Replace the universal ivory material, semi-spatial View constellation,
Stop-entry pin layer, permanent Edit Guide menu, topology lane and Path/Journey
workspace taxonomy for this Experience scope. Do not introduce gradients, glass
dashboards, ornamental gold surfaces or different visual brands for each task.

## 2. Anatomy and dimensions

```text
HEAD 56 px: Museum Editor · project · World | Experience · history · Preview
INDEX 208 px       STAGE flexible, largest region       CARD 304 px
locator           true geometry + invoked instruments  selected identity
                  Guide or compact player
                  ruler / axis reserved below
STATUS 26 px: short current action/status, never another tool row
```

| Region | 1440×900 target | Lifecycle / essential rule |
|---|---|---|
| Head | 56 px, full width | One Preview; visible project/lens; no fake Saved signal |
| Index | 208 px; collapse to 64 px | Search, Presentation inventory, Guide entry, New Presentation, Browse World; properties belong in Card |
| Stage | 928×818 with both panels open; 1232×818 with no Card | At least 60% of width at normal desktop; no automatic fit/reframe on panel changes |
| Card | 304 px, inner content 264 px | Identity and current task owner always recoverable; independently scroll body when needed |
| Guide | Stage width minus 36 px; ~106 px high | Open for Guide/Stop curation; collapse to named tab; one row, horizontal internal scroll at high counts |
| Movement instrument | Up to 566 px, 94 px high | Endpoints/context, Add path point, Play movement; no topology lane |
| Stop player | 560–680 px, ~116 px high | Play/Pause, derived segments/scrub, Follow Camera; same movement task family |
| Stage ruler/axis | 28 px clear bottom inset | Instruments end at least 42 px above Stage bottom; never cover this furniture |

Dimensions are compositional targets, not a reason to clip content. Use bounded
minimum/maximum widths and text wrapping. Index and Card collapse are independent
session preferences. Empty projects have **no empty Card**. A selected identity
keeps a compact recoverable Card header if the body is collapsed. Opening Guide
does not force either sidebar open. Ordinary Presentation work preserves the
creator's Guide disclosure preference rather than permanently docking it.

The Guide stays within the central Stage on these desktop specimens. Broad
comparison of genuinely long timing segments may later qualify for a wider lower
surface, but not for this proof. The former “all Experience lanes earn full shell
breadth” interpretation is explicitly replaced.

## 3. Token roles

All Experience components consume one scoped token set. Proposed names below are
roles to map during implementation, not additional component-local magic numbers.
World keeps existing approved tokens until its own scope changes.

| Role | Value | Use |
|---|---|---|
| `exp-frame` | `#163D32` | Stage mat and structural green |
| `exp-frame-deep` | `#102E26` | Head, status, Guide ribbon; white text |
| `exp-action` | `#246B50` | Primary creation/acceptance, links, active task indicator |
| `exp-action-hover` | `#1B563F` | Primary hover/pressed contrast |
| `exp-selected` | `#E6B85C` | Selection ring/bar and restrained Preview accent |
| `exp-selected-ink` | `#755012` | Text on pale selected surfaces |
| `exp-selected-surface` | `#FBF0D8` | Selected row or badge, not panel background |
| `exp-work` | `#F4F6F5` | Index and quiet working neutral |
| `exp-panel` | `#FFFFFF` | Card, local inspector, menu, control |
| `exp-recess` | `#E9EEEB` | Groups, neutral segment base |
| `exp-border` | `#D6DFD9` | Light-surface divisions; decorative only |
| `exp-ink` | `#172D25` | Main light-surface text |
| `exp-muted` | `#53665C` | Supporting labels; must remain legible |
| `exp-camera` | `#176B88` | Camera lines/markers/text on Plan or light controls |
| `exp-camera-on-mat` | `#79C6DE` | Same species on dark spatial ground |
| `exp-warning` / surface | `#8E441B` / `#FFF0E4` | Named repair/consequence, with icon and action |
| `exp-refusal` / surface | `#963C2B` / `#FCECE7` | Rejected operation; text reason, no silent mutation |

Gold is shared with the existing selection idea but separated from brand and
warnings by role. Preview's gold filled button is the sole persistent gold
application action; it has no selected-entity ring and uses a Play icon/verb.
Normal creation buttons are green. Camera markers retain their blue core when
selected, adding a gold ring. A green Guide entry means **active task context**,
not selection of a second entity. Inaccessible/stale work never resembles an
active selection.

Contrast checks apply to essential text/icons and focus boundaries, not the
decorative light panel rule. Body text targets at least 4.5:1; meaningful UI strokes
at least 3:1 against their adjacent surface. On dark ground use light-blue Camera
ink; use deep-blue ink on Plan. Light labels with leaders have a dark/light matched
backplate. Refusal/warning has text and shape beyond color. Captures' board
watermarks are artifact labels, not proposed product controls.

## 4. Typography, spacing and controls

| Role | Family / fallback | Metrics |
|---|---|---|
| Identity/title | Avenir Next; Trebuchet MS; sans-serif | 25/29 px, 600–650; restrained negative tracking |
| Interface/body | Avenir Next; system-ui; sans-serif | 13/19 px; regular 400, labels/actions 600 |
| Section title | Same UI | 13/18 px, 700 |
| Support / row metadata | Same UI | 11/16 px; no critical task instruction below 11 px |
| Kind / short eyebrow | Same UI | 10/14 px, 600; upper case only for kind/context, tracking .08 em |
| Time/value | SF Mono; Menlo; monospace | 11/16 px; tabular values, never raw IDs at rest |
| Visitor welcome | Title family | 36/41 px desktop, 30/35 narrow |

The source uses platform fonts and makes no network request. The specimens were
rendered on this Mac's available fonts; other platforms use the declared fallbacks.
Prefer existing licensed/available fonts over introducing a font service. Relative
hierarchy and fit matter more than matching one platform's glyph raster.

Spacing scale: 4, 8, 12, 16, 20, 24, 32 px. Card inset 20; Index inset 14; Stage
inset 18; section separation 16. Controls are 36 px high, 6 px radius; secondary
compact task controls can be 30–32 px with at least a 32 px pointer hit target.
Touch targets expand to 44 px. Card/menu radius 6–8 px. Use a single thin border;
shadows only communicate a raised task/menu, never every row. Icons use one 18 px
stroke family with text labels on consequential actions. Keyboard focus uses a
2 px blue outline plus 3 px offset; it is distinct from gold selection.

## 5. Component rules

| Component | Anatomy and behavior |
|---|---|
| Presentation row | Name, small semantic subject/preview cue, available View count. Selects Presentation without navigation. Overflow on focus/hover. |
| Scene subject Card in Experience | Subject identity/kind → Present this → derived Used in Experience links. One green Present this action creates recommended first framing atomically. No Presentation type chooser, capability inventory or deferred behavior/interaction writers at rest. Selecting the subject highlights no related Presentation; Browse World remains the complete locator. World-owned capability editing stays in World or preserved compatibility depth. |
| Presentation Card | Identity → Available Views → Capture View → Guide use/Add to Guide → optional subject link. Rename/remove in overflow; no Focus taxonomy or capability/explanation dashboard. |
| Available View row | Modest ~66×43 rendered preview, name, Default badge if relevant. All use rows selectable. Preview stays in Card, no Stage thumbnail wall. |
| View Card | Parent crumb → View identity → faithful preview → Look through → Adjust View → Default role → where-used/open Presentation. During inspection show read-only state; sole Exit View is on Stage. Rename/unlink in overflow. |
| Stop chip | Number, Presentation/occurrence name, local View count. Gold selected state; source membership does not become another selection. Adjacent continuation pill separate hit target. |
| Stop Card | Identity → source Presentation link → Views in this Stop → Add View → Next Stop/transition → Play this Stop. No Entry/Next dropdown duplication. |
| View slot row | Drag grip, preview, View name, first/last role and dwell. Context menu supplies Move, Remove and Edit shared View. Direct movement entry between rows. |
| Transition task | Retain owning Stop identity; section title Movement; From/To names, Cut/Travel, evaluated time, Camera Path readiness/shared reach. |
| Path point task target | Gold ring around blue/white point; Card section “Selected path point” within the same owner. Add is armed; Remove discloses legacy event consequence. |
| Player | Scope/title, Play/Pause, scrubbable evaluated segment axis, derived clock, Follow Camera toggle. No station terminology or general Cue creation. |
| Repair notice | Name what is missing, what cannot run, and an owner route. Never convert missing View to intentional keep viewpoint. |
| Legacy compatibility panel | Quiet but visible summary before Preview/conversion; lists explicit Next/entry/holds/actions/branches in plain names. Unsupported linear editing opens conversion review instead of hiding the fact. |

Small preview images show the same scene from the actual View in implementation.
Use the existing bounded neutral image pass, keyed by source/View revisions.
No narration or capability card is recreated merely to populate an empty panel.
Where legacy authored behavior exists, show **Existing advanced work · review**
with its execution effect; preserve the existing underlying writers for a later
authorized surface rather than forcing them into V3's primary proof.

## 6. State and spatial language

| State/species | Treatment |
|---|---|
| Selected entity/use/Stop | Gold edge/bar + name/shape; blue Camera core remains semantic blue |
| Active task | Green context indicator; named parent and Back; never a second gold entity |
| Hover/focus | Reveal menu/grip, modest neutral background; keyboard outline stays visible |
| View observer | Blue origin dot + directional wedge/frustum; actual world coordinate, optional height tether |
| Default View | Small star + “Default View”; no Choice/Default segmented control |
| Stop-local slot | Optional local number at its actual View marker; list order is editorial, not spatial distance |
| Camera Path | Blue evaluated route, blue/white interior points; generated From/To labels; no fake curve |
| Playback rig | Small gold/blue Camera rig on the evaluated path; no authoring hit target while playing |
| Disabled/unresolved | Named reason and repair action; preserve stable reference, do not disappear it |
| Empty inventory | One actionable next step; no repeated Create buttons or useless blank Card |
| End of Guide | “Finish”; no dangling outgoing path or fabricated destination |

Plan's cool grey-green ground and fine grid contrast with 3D's dark mat. Both show
the same world and exact observers. Labels may use screen-space collision handling
with leader lines. Occluded markers use a clear ghost/occlusion style or stay
reachable in the inventory; hit targets must not drift with zoom. Never scale
marker **world positions** into a constellation. Schematic order belongs only in
the Guide or the selected Stop's list.

## 7. Selection, task and return contract

Reconcile the old documentation conflict explicitly: keep one canonical
selection, and a separate session **task target** under its owner. Presentation,
View-use, Scene subject and Stop are canonical subjects. A path point,
transition or playhead is a task reading under the selected Stop, not another
selected Stop/Guide. Card identity remains “Stop 2 · The drive” while a section
reads “Movement” or “Selected path point.” The Index Guide row is a green context
reference; the Stop chip/slot is the gold selected occurrence/read target.

For guide overview with no selected Stop, show a Guide summary/task header;
do not invent a first-Stop selection. The implementation plan must add an explicit
Guide context session state and never feed it to authored selection as a fake ID.
If future production gives transition entities canonical identity, that is a
domain/F amendment, not a CSS naming change.

| Event | Logical context | Camera / history |
|---|---|---|
| Select Presentation/View/Stop | One selection updates; inspect in its Card | No Camera movement; no history |
| Open Presentation from Stop | Push source-link origin crumb | No movement; Back restores Stop/task context |
| Open movement or playback | Push invoked task under selected Stop | No movement until Play/Look/Follow; no source |
| Back | Pop one authoring context; keep accepted edits | No Undo; no implicit spatial return |
| Collapse/resize/change panels | Session disclosure updates | Keep Camera pose/target/FOV; renderer aspect may change |
| Look through | Begin inspection token; realize chosen View | Explicit Camera request; no source |
| Switch inspected View | Reuse token and request newly chosen View | Original return token remains fixed |
| Exit View / Stop following | End displacement and realize token | Explicit return; no Undo |
| Path geometry edit | Pause read-only playback, invoke Camera writer | One accepted history step per gesture |
| Preview / Exit Preview | Clone source into visitor session / restore captured context | No source edits; complete return including nested inspection token |

Inspection is independently owned from Card navigation. Its exit persists in the
Stage while the Card changes; it does not capture another return on every View.
There is one displacement writer host at a time: Look through begins from Card;
active View inspection rehosts the sole Exit View to Stage and leaves a read-only
Card status. Playback owns the Follow toggle while its player is present; its
Stage banner is read-only. Closing/leaving that player pauses playback and
rehosts Stop following on Stage if the displacement remains active. No duplicated
active Exit/toggle controls or background-running hidden player.
Follow Camera and Look through share one active displacement session: enabling
Follow while already inspecting preserves the initial return and changes the
inspection target. Disabling Follow or Exit View restores that initial standpoint.
Closing a player while following exposes explicit Stop following on Stage; a
Back-only transition retains that exit and never applies return silently.
Escape dismisses a menu/proposal first; only when a displacement exit is foremost
does it invoke that named exit. Accepted source edits remain until Undo.

## 8. Responsive and accessibility composition

| Width | Composition |
|---|---|
| ≥1200 px | 208 px Index + flexible Stage + 304 px Card; both independently collapsible |
| 820–1199 px | 64 px locator rail + Stage + up to 288 px Card; named rail tooltips and an invoked full inventory; one-row Guide scrolls internally |
| 600–819 px | Full-width Stage; invoked 268–288 px Card sheet within safe insets; inventory replaces the Card sheet when opened, never stacks beside it. Movement instrument stays above ruler. |
| <600 px | Review/Preview supported; authoring task sheet uses bottom 40–48% with explicit close, one task at a time. Complex spatial point manipulation can require a wider viewport with a clear reason; no unreadable desktop shrink. |

At narrow widths the selected identity is a persistent recoverable tab. Renderers
keep Camera source unchanged as sheets open. Reserve task/ruler regions in layout,
not with giant transparent fixed overlays. Long names wrap in identity headers;
chips ellipsize with full tooltip/accessibility label. The Guide lane scrolls its
own overflow, never the page sideways. Drag-and-drop has Move earlier/later buttons
and Escape cancellation. Default, first/last, Travel and repair use words/shape
as well as color. Selection, Look through, Capture and Back are keyboard reachable.
Scrub supports arrows, Home/End and an accessible derived time label. Follow is
a real toggle with announced state. Reduced motion uses Camera's policy; shell
changes add no ambient animation or camera tween.

## 9. Acceptance scope

Use the [15 board notes](../../../../../prototypes/experience-ux-v3/README.md) to
compare complete compositions and interactions, not isolated components. Essential
roles, hierarchy, spatial truth and return are binding **after ratification**;
fixture decoration, exact thumbnail shading, incidental names and glyph pixels
are not. A test pass is functional evidence. A capture plus an explicit owner
visual verdict accepts the product design; one never substitutes for the other.
