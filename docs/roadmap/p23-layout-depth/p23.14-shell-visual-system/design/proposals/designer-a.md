# P23.14 — Editor Shell & Visual System Foundation
## Independent concept exploration — three shell theses

**Author:** external designer (independent track)
**Against:** `P23.14-designer-brief.md` (assignment), `P23.14-shell-design-context.md` (authority), P23.14 research (evidence)
**Date:** 2026-09-17

---

## 0. Position before concepts

### 0.1 What I think the actual problem is

The brief and both research passes converge on "the first obligation is a visual grammar for rank." I agree with the diagnosis but I want to sharpen it, because "rank" alone produces three variants of the same toolbar.

The eight things the brief lists are not one ladder. They are **three different kinds of thing** wearing the same chip:

| Kind | Members | Lifetime | What a user needs to know about it |
|---|---|---|---|
| **Where I am** | project, domain, view, (future) contextual instrument | minutes–hours; survives everything | *stated*, always, and **never** confusable with an action |
| **How I am working** | local mode (`Layout`/`Arrange`), armed tool, `Local`/`World`, Snap/Grid | seconds–minutes; changes constantly | *armed*, reversible, cheap to change, adjacent to the hand |
| **What is under the knife** | selection (identity, set, primary), gesture, refusal, focus | instantaneous | *bound to the thing*, not to chrome |

Today's shell puts all three in one 32px band at near-identical weight (context §8 row 1). Every concept below separates them, but **each separates them by a different mechanism** — that's what makes the three concepts structurally distinct rather than stylistically distinct:

- **PLATE** separates them by **axis and material** (vertical vs horizontal; chassis vs paper).
- **SIGNAL** separates them by **grammatical form** (a stated path vs an armed dock vs a bound overlay).
- **ATLAS** separates them by **place in a frame** (a corner matrix, an edge, a perimeter).

### 0.2 Where I diverge from the research

Four deliberate departures, per the brief's invitation:

1. **I reject "stable landmarks + contextual contents" as sufficient.** It is necessary and all three concepts honour it, but it is the reason the current shell is flat: everything is a stable landmark whose contents swap, so nothing signs its own rank. Landmark stability must be paired with **a landmark that is legibly a different species from its neighbour**.

2. **I reject the five territories as a starting vocabulary.** "Instrumented Atelier" / "Technical Workbench" / "Chromatic Studio" are personality labels, not structures — you can dress any structure in any of them. I designed structures first and let personality follow. Two of my three land near territory language by convergence; that is evidence, not obedience.

3. **I treat "one fact, one home, at most one passive echo" as too weak.** With Snap/Grid appearing three times (§8 row 3), the useful rule is stronger: **a fact has one home that can change it, and echoes must be visually incapable of being clicked.** All three concepts adopt a formal *readout* type — distinct from any control — so an echo is never mistaken for an authority.

4. **I think "canvas-first" has been slightly mis-framed.** The context's own P26 direction ("active precision only around the target") implies the future shell gets *quieter during work and richer between work*. So all three concepts specify a **working attenuation** rule as a first-class system behaviour, not a styling nicety.

### 0.3 Decisions I take in all three concepts

These are not concept differentiators; they are things the brief's problem table demands and where I do not think plural answers are useful. Stated once to keep the concepts comparable.

| Decision | Resolves |
|---|---|
| **The Inspector is property-first in both domains.** The wall-first prose block becomes contextual education (see each concept's model); the Project/Source/Status/Rooms/Objects/Issues summary becomes a **document readout** that lives with the project frame and the status bar, not at the top of a selection-scoped panel. | §8 rows 2, 10 |
| **Four row species in the Navigator**, typographically distinct and non-negotiable: **entity** (selectable, has identity+reference), **group heading** (non-selectable, carries a count), **relation metadata** (non-selectable, indented, no reference chip, never a row of its own weight — the `Ends …` residue becomes an inline suffix on the Wall row or an Inspector fact), **empty/teaching state**. | §8 row 5 |
| **A formal `readout` component** — tabular figures, no hit target, no border, cursor `default`, `aria-hidden` where duplicated. Snap/Grid/unit are *controls* in exactly one place and `readout`s everywhere else. | §8 row 3 |
| **"Preview" is spent.** Row-1 visitor takeover keeps the word **Preview**; the ribbon Plan overlay becomes **Tour overlay** (existing label, demoted to a viewport display toggle); the Camera rail's `Preview Sequence` becomes **Play sequence** (transport vocabulary it already shares with the Timeline); the Publish surface says **Published view**. This introduces **zero new naming schemes** — it removes one collision and reuses words the product already ships. | §8 row 4 |
| **Every control is `acts` / `refuses-with-reason` / `readout`.** There is no fourth state. The painted-but-mute Room rotation handle is therefore either bound or unpainted — it cannot survive any of these systems as-is, and I flag it as a product decision the shell surfaces rather than hides. | §8 row 4, context §16 test 7 |
| **A single `reason` surface**, with two intensities and one grammar (`Refused: <what> — <why> · <remedy?>`): **bound** (anchored at the gesture/handle) and **panelled** (inline in the Inspector, under the action that refused). `Delete junction` / join walls lands in the panelled form. | §5 of the brief, §14 of context |
| **Timeline is on the shell grid.** Collapsed and expanded, it spans exactly the viewport column, edge-aligned with the canvas and status bar. The centred 760px mini-player dies. | §8 row 7 |
| **No-flow Timeline is an authored empty state**, not an empty box: the dock **auto-sizes to its header/transport height when there is no sequence** and offers the one next action. It does not hold 288px of nothing. (It still *expands* to 288px on demand so the user can see the instrument they are about to fill.) | §8 row 10, context §3 |
| **Coarse-pointer compliance is systemic**, not per-control: every concept defines a `touch` density tier that lifts all interactive rows/controls to ≥44px without relayout, because the target is unmet today (§8 row 11). |
| **Nothing depends on current 3D mesh appearance.** No seam-hiding scrims, no thickened 3D outlines sized to cover joins, no dark-on-dark trick that only reads because walls currently render as flat blocks. Each concept states its P23.15 exposure explicitly. |

---

# CONCEPT 1 — **PLATE**
## *The drafting table under an instrument chassis*

### 1. Thesis

> Museum Editor is a **warm paper plate held in a cool precision chassis**. The work is on paper; the instruments are machined and sit around it. You always know which is which because they are made of different material.

The rank problem is solved by **material and axis**, not by size. Anything that is *where you are* is part of the **chassis** — a cool, matte, slightly recessed metal-grey structure that frames the work on three sides. Anything that is *how you work* is an **instrument** — a raised, warm-edged control that sits on the chassis. Anything that is *what you are cutting* lives **on the paper** — ink, graphite, dimension, handle.

Its second structural move: **domain is vertical, view is horizontal.** `Scene` and `Camera` become two tall stations on a 56px left **Spine** running the full window height; `Plan | 3D` stays horizontal at the top of the work area. Two axes rendered on two literal axes. A user learns the mental model from the geometry of the screen, which is exactly what a non-CAD creator needs (context §2's four-cell table becomes visible furniture).

Why it suits Museum Editor: the product's substance is *drafting*. The one aesthetic tradition that is simultaneously professional, precise, educational and warm — without being CAD cosplay or a consumer card UI — is the drawing office: paper, ink, brass, a T-square, a labelled instrument tray. It is also the only one of my three that makes **light mode the primary mode** without looking like generic SaaS, because the light is *paper*, not whitespace.

### 2. Shell composition

```
┌──┬────────────────────────────────────────────────────────────────┬────────────┐
│  │ PLATE HEAD  36px  chassis                                      │            │
│  │ ‹Projects  Untitled project ⌄   Local Session   ⟲⟳  Save ●     │  Preview ▸ │
│S ├──────────────────────┬─────────────────────────────────────────┴────────────┤
│P │ NAVIGATOR  240–300   │ VIEW BAR 34px  chassis, inset over paper              │
│I │ ▣ chassis panel      │ [Plan · 3D]      Layout | Arrange      ⌗ Snap 0.25 ⊞ │
│N │                      ├───────────────────────────────────────┬───────────────┤
│E │  Hierarchy  Assets   │                                       │ INSPECTOR     │
│  │  ─────────────────   │            P A P E R                  │ 300 chassis   │
│▣ │  ⌕ search            │        (the viewport; the only        │               │
│Sc│  Rooms          1    │         warm surface on screen)       │ ▸ selection   │
│  │  ARCHITECTURE        │                                       │   header      │
│▣ │   Walls         4    │   TOOL TRAY (canvas-left, 44px)       │ ▸ properties  │
│Cam  Openings      0    │   ◹ ▭ ⬠ ⌐ ▯ ◇ ▭ ▤   vertical         │ ▸ actions     │
│  │   Junctions     4    │                                       │               │
│  │  PLACED CONTENT      │                                       │               │
│  │                      ├───────────────────────────────────────┴───────────────┤
│  │  ── footer readout   │ DRAWER (Camera only) — collapsed 48 / open 288        │
├──┴──────────────────────┴───────────────────────────────────────────────────────┤
│ STATUS RAIL 24px  chassis · readouts only · no controls                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Persistent:** Spine, Plate Head, Navigator, Inspector, Status Rail, View Bar.
**Contextual:** the Tool Tray's contents (per cell), the View Bar's mode segment (Scene·Plan only), the Drawer (Camera only), all overlays.

- **The Spine (56px, full height).** Two stations, `Scene` and `Camera`, each an icon + vertical label + a 3px inboard edge-light in the domain's hue when active. It is the *only* place domain can be changed. Because it is full-height it visually **owns** the Navigator and Inspector, which is architecturally honest: the Camera sidebar is a different panel, not a different mode of the same panel. Below them the Spine holds nothing else — deliberate reserved room (see Extension).
- **Plate Head (36px).** Project identity, session, save, Document menu, Undo/Redo, `Preview`. `Spatial | Publish` becomes two chassis **plates** at the head's right-of-centre, and the head is built to take a third (`Experience`) without redistribution — they are labelled plates in a row, not a 2-segment control.
- **View Bar (34px).** Sits **inside the work column only** — it does not span the rails. That single change fixes the "eight equal buttons" read instantly, because view/mode/snap are now visibly *about the canvas*, while domain is visibly *about the app*. Contents, left→right: view pair (Plan · 3D as engraved tabs cut into the chassis, not raised chips), the local mode segment where it exists, then right-aligned display controls (Snap value, Grid, Tour overlay, panel visibility).
- **Tool Tray (44px, vertical, attached to the canvas left edge, over the chassis gutter).** Tools leave the top band entirely. They are *hand* things, so they sit next to the hand and next to the work. Icon-only at rest with a persistent 10px caps label under each icon group divider; hover/focus gives a full tooltip with the shortcut. Vertical stacking is the cheapest possible growth axis for P24's added tools.
- **Navigator.** Chassis panel; 4 row species (§0.3); group headings are engraved (recessed, letterspaced 10px caps, count right-aligned in tabular figures); entity rows carry `name` + a small reference chip in a mono face. Footer is a **readout** (selected entity + "Not on this page") with exactly one action, `Show in Walls ›`, rendered as a link-form action so it cannot be confused with the row itself.
- **Inspector.** Chassis panel, **property-first**: a selection header (identity, reference, type glyph, and — reserved — a count for sets), then property sections, then an **Actions** section at the bottom that hosts consequential operations including `Delete junction`. No prose above the first property.
- **Drawer (Camera only).** A full-viewport-width instrument drawer that slides out of the bottom chassis. Collapsed: 48px transport strip flush to the viewport edges. Expanded: 288px with ruler + lanes. No sequence: the drawer **stays at transport height** and its scope chip reads `No sequence yet` with one action, `Add camera`.
- **Status Rail (24px).** Readouts only. Cell badge · selection · save · hints · grid/snap/unit. **Zero clickable things**, which is what makes §0.3's echo rule enforceable.

### 3. Visual system

**Material model (the core of the concept).** Three materials, and *every* pixel belongs to one:

| Material | Used for | Light theme | Dark theme |
|---|---|---|---|
| **Paper** | the viewport only | warm off-white (a paper white with a touch of yellow, ~2% warm) | a deep warm graphite, never blue-black |
| **Chassis** | all persistent panels and bars | cool neutral grey, matte, 1px hairline separation, **no drop shadows** | cool dark neutral, one step lighter than paper-dark |
| **Instrument** | interactive controls sitting on chassis | slightly raised, warm top-edge highlight, 3px radius | same, with a warm 1px top rule |

The chassis/paper contrast is the identity. It survives all seven themes because it is a **relationship** (paper is warmer and higher-key than chassis, always) rather than a pair of hex values.

**Typography.** Two families: a humanist sans with real optical sizing for labels and UI (warmth, learnability), and a **narrow mechanical mono for every number, reference, unit and axis token**. Rule: *if it is a measurement or an identity, it is mono and tabular.* This single rule delivers §8 row 8's canonical axis tokens (#35) as a system property, and it is the strongest "precise" signal in the concept. Scale: 10 (engraved caps), 11 (readout), 12 (row/label), 13 (property value), 15 (panel title), 20 (project name).

**Density.** Three tiers, switchable and honest: `compact` (28px rows), `default` (32px), `touch` (44px). Panels reflow only by row height; nothing moves.

**Shape.** 3px radius on instruments, 0 on chassis planes, 2px on paper-side handles. No pill chips anywhere — pills are why domain/view/mode/tool read alike today.

**Colour roles.** Accent is *not* decorative. Exactly five semantic hues, all present in both themes: **selection blue** (inherited from P23.13 Plan — do not disturb), **snap/guide** (inherited), **refusal** (inherited), **domain-tint** (a warm brass for Scene, a cool cyan-ink for Camera — used **only** as a 3px Spine edge-light and the cell badge; never as a fill), **armed** (a single amber-warm state used exclusively for "a tool is armed / a gesture is live"). Everything else is neutral. Policy: *the paper may only contain P23.13 hues; the chassis may only contain neutral + domain-tint + armed.*

**Iconography.** One 20px, 1.5px-stroke mechanical family with squared terminals — **except** the five owner-ratified Plan icons (Wall, Rect Room, Poly Room, Door, Window), which are pinned byte-identical. To stop the mix reading as an accident, PLATE makes the distinction *deliberate*: Plan-authoring tools are the only icons with filled/solid mass; every other icon in the product is stroke-only. The mixed family becomes a signal (§17 q9 answered: keep the distinction, and make it a rule).

**State grammar.** Nine states, each with an independent channel so they can co-occur:

| State | Channel |
|---|---|
| hover | +4% chassis lift, no colour |
| pressed | inset 1px |
| **armed (tool)** | amber top-rule + amber icon + the Tool Tray's group divider lights |
| **active (mode/view/domain)** | engraved (recessed) + domain-tint edge |
| selected (entity) | P23.13 blue, on paper and mirrored as a 2px left bar on the Navigator row and the Inspector header |
| keyboard focus | 2px offset ring in a neutral high-contrast tone, **never** the selection hue |
| disabled | 40% + a `?` affordance revealing the reason on hover/focus |
| refusal | bound or panelled reason surface (§0.3) |
| readout | tabular mono, no box |

**Motion.** Two durations only: 120ms for state, 200ms for the Drawer and panel collapse. Nothing eases on the paper during a gesture — geometry is instantaneous, always.

**Working attenuation.** During an active gesture, chassis text drops to 60% and instrument edge-highlights go flat, for 120ms, until commit. The paper does not change. This is how the canvas "gets louder" without the shell disappearing.

### 4. Educational model

Teaching happens in four places and **nowhere else**:

1. **The geometry itself.** Vertical domain / horizontal view teaches the four-cell model without a word.
2. **Engraved group labels.** The Tool Tray has `DRAW` / `OPENINGS` / `OBJECTS` dividers; the View Bar's mode segment is prefixed with a 10px `MODE`. Persistent, tiny, structural — not prose.
3. **Bound moments.** At a gesture: live dimension + snap marker + one hint line at the cursor. At a refusal: the reason, at the handle. At a disabled control: a reason on hover/focus. At a first-time tool arm: a one-line cursor caption (`Click two points to draw a wall · Shift constrains angle`) that disappears after the first successful commit and never returns unless the user opens Help.
4. **Authored empty states.** Each empty region carries: what this is, in one line; what belongs here; and one action. The Inspector's current wall-first paragraph moves here — it is genuinely useful when nothing is selected and genuinely noise when a wall is.

Plus one persistent, cheap affordance: a `?` in the Plate Head toggles **Show labels**, which turns every icon-only control (Tool Tray, canvas utilities, Drawer transport) into icon+label at the cost of width. Beginners leave it on; experts turn it off. That is the whole onboarding system.

### 5. Extension model

- **P26 / third view concept.** The View Bar's view control is a row of engraved tabs, not a binary. A contextual instrument enters as a **third engraved tab that appears when opened and carries a close affordance**, with the return path guaranteed by the fact that Plan and 3D never leave the bar. Additionally the **Spine has reserved space below the two domain stations** for nothing at all today — if P26's answer turns out to be an instrument *tray* rather than a tab, it has a home that is already a different rank from tools. Two hosts, both already ranked; no hard-coded pair.
- **P24 / selection sets.** The Inspector header is built as `glyph · name · reference · [count]` where count is hidden at 1. Property rows have four value states from day one: authored, mixed (`—` + a count), inherited (italic + origin chip), derived (mono + lock glyph, no hit target). The Navigator already has group headings and counts, so a deeper Scene tree adds depth, not a second tree.
- **Destructive/consequential.** The Inspector's terminal **Actions** section renders consequential items with a refusal-capable footer. `Delete junction` shows either the action or, when ineligible, the action disabled with its reason code inline — the panelled `reason` form.
- **Growth without a second language:** all new controls must declare one of `chassis` / `instrument` / `paper`. Anything that cannot be classified is an architecture smell.

### 6. Risks

- **Warm paper + cool chassis can read retro** if the warmth is overplayed. Mitigation: warmth lives in a ≤3% hue shift and in the mono/sans pairing, never in texture or skeuomorphic shadow. No paper grain. Ever.
- **The 56px Spine costs width** at 1280px. Mitigation: the Spine collapses to 40px icon-only below 1440px; it never disappears (domain must always be stated).
- **Engraved = low contrast** is a real accessibility trap. Mitigation: "engraved" is defined as *geometry + a 3px tint bar*, not as reduced contrast; every active state must also pass 3:1 non-text contrast without the recess.
- **Two icon masses (filled Plan tools vs stroke everything)** may read as inconsistency to anyone who does not learn the rule. Mitigation: the rule is total and applies to future tools too; if it degrades, fall back to all-stroke and lose only a minor signal.
- **Density risk:** the Tool Tray at 44px + Spine at 56px is 100px of permanent left chrome before the Navigator. This is the concept's biggest cost and should be validated at 1280×800 first.
- **P23.15:** nothing in PLATE depends on 3D mesh appearance; the material model explicitly says 3D content is *paper*, so whatever geometry P23.15 emits inherits the same treatment.

---

# CONCEPT 2 — **SIGNAL**
## *The context path and the canvas-owned dock*

### 1. Thesis

> Museum Editor is an **instrument you address by stating where you are**. One line at the top always reads as a sentence — project → domain → view → instrument — and everything else in the shell is either *attached to your hand* or *attached to the thing you selected*. Chrome that is neither does not exist.

Where PLATE ranks by material, SIGNAL ranks by **grammatical form**. Three forms, absolutely non-overlapping:

| Form | Looks like | Contains | Rule |
|---|---|---|---|
| **Path** | a breadcrumb of typed segments, left-aligned, one line | project, domain, view, contextual instrument | *Stated, never armed.* Segments have no fill, no chip, no border — they are type with separators. Changing one is a navigation, and navigations are announced. |
| **Dock** | dense, gridded, attached to the canvas edge | tools, local mode, transforms, snap/grid, view display | *Armed, never stated.* Every dock item has a strong on/off. |
| **Bind** | anchored to geometry or to a panel row | selection, gesture, refusal, handle, numeric field | *Bound to a thing.* If nothing is under it, it does not render. |

You cannot confuse a Path segment with a Dock button, because one is bare type and the other is a filled cell in a grid. That is the whole hierarchy, and it holds for eight ranks or fifteen.

Why it suits Museum Editor: the product's hardest future problem (context §13) is **nested context with a return path**. A Path is the only structure that makes nesting free — P26's Section instrument is one more segment with an `×`, and the way back is literally the text to its left. SIGNAL buys that for the price of adopting it *now*, before there is anything to nest. The character is warm-technical: this is a broadcast desk / mixing console read, dark-first, with real colour used as signal, which answers "creative" and "distinctive" without decoration.

### 2. Shell composition

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PATH 40px                                                                        │
│ ‹ Untitled project ⌄ ▸ Scene ⌄ ▸ Plan ⌄            ⟲ ⟳   ● Unsaved   Preview ▸  │
├──────────┬───────────────────────────────────────────────────┬───────────────────┤
│NAVIGATOR │ ┌ DOCK 40px ──────────────────────────────────┐   │ INSPECTOR         │
│240–300   │ │ Layout|Arrange ▏◹ Wall ▭Room ⬠Poly ▏⌐Door…  │   │ 300               │
│          │ │                       ⌗0.25 ⊞ Tour ▏ ⛶      │   │ ┌───────────────┐ │
│ Hierarchy│ ├──────────────────────────────────────────────┤   │ │ W-FJSK        │ │
│ Assets   │ │                                              │   │ │ Wall · bound  │ │
│ ⌕        │ │              V I E W P O R T                 │   │ └───────────────┘ │
│          │ │                                              │   │ GEOMETRY          │
│ Rooms  1 │ │           the dock is *inside* the           │   │  Length  4.90 m   │
│ ARCH     │ │           viewport frame, not above it       │   │  Angle    0.0°    │
│  Walls 4 │ │                                              │   │  Thick    0.20 m  │
│  Open. 0 │ │  ┌ utilities ┐                  ┌ nav ┐      │   │ IDENTITY          │
│  Junc. 4 │ └──┴───────────┴──────────────────┴─────┴──────┘   │ ACTIONS           │
│          │ ╔ SHELF (Camera) ═════════════════════════════╗   │  Delete junction  │
│ readout  │ ╚═════════════════════════════════════════════╝   │                   │
├──────────┴───────────────────────────────────────────────────┴───────────────────┤
│ STATUS 24px  Scene • Plan   W-FJSK   Unsaved   hints…        Grid Snap Metric    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Persistent:** Path, Navigator, Inspector, Status, Dock (contents vary), viewport frame.
**Contextual:** Dock contents, Shelf (Camera only), instrument segment in the Path, all binds.

- **The Path (40px).** `‹ Untitled project ⌄` `▸` `Scene ⌄` `▸` `Plan ⌄`. Each segment is a menu button rendered as plain type with a small chevron — click gives the sibling list (`Scene`/`Camera`; `Plan`/`3D`; later, open instruments). The active segment is set in a heavier weight and the product's identity hue underlines it 2px. Right side: Undo/Redo, save state (a **readout** with a dot, and a `Save to Cloud` action only when it can act), `Preview`, theme, account. `Spatial | Publish` becomes a **second-level menu on the project segment** (`Untitled project ⌄` → Spatial · Publish · later Experience), because they are project surfaces, not authoring axes. That removes the concept's most future-fragile 2-tab (§8, context §5).
  Keyboard: `⌘1/⌘2` domain, `⌘3/⌘4` view; the Path is a `breadcrumb` with proper arrow-key traversal, which also resolves #39 structurally.
- **The Dock (40px, top edge *inside* the viewport frame).** This is the key structural move: **tools belong to the canvas, not to the window.** The viewport gets a visible frame (1px + a 1-step darker gutter) and the Dock is the frame's top member; the canvas utilities (scale bar, counts) are the bottom member; the nav box is the top-right member. Consequences: Plan and 3D stop having two chrome vocabularies (§8 row 6) because there is exactly one frame with named members; the Dock scrolls horizontally when tools overflow rather than pushing the Navigator; and when both rails collapse, the Dock is still exactly where it was.
  Dock grammar: contiguous **cells** in a 1px-gapped grid, separated into groups by a 1px rule + a 9px group label. Local mode (`Layout | Arrange`) is the first group and is rendered as a **two-cell selector with a filled active cell**; tools are single cells with an **armed** state (accent fill + a 2px underline that persists while armed). Right-aligned group: Snap value, Grid, Tour overlay, panel visibility.
- **Navigator.** Same four species as §0.3. SIGNAL renders group headings as **full-bleed 22px bands** (slightly darker than the panel) with the count in the band — dense, scannable, and they double as sticky headers when the list scrolls.
- **Inspector.** Property-first. A **bound header card** (identity + reference + type + selection count slot), then sections as full-bleed bands matching the Navigator's, then `ACTIONS` last. Property rows are a strict two-column grid, label left at 40%, value right at 60%, values right-aligned mono — so a column of numbers actually forms a column. Mixed values render as `— mixed (3)`; derived values render mono with a lock and no field chrome.
- **The Shelf (Camera only).** The Timeline, framed as the bottom member of the viewport frame and therefore automatically viewport-width. Three states as §0.3.
- **Status (24px).** Readouts only.

### 3. Visual system

**Surface model.** Four elevations expressed **only by value steps**, no shadows: `-1` window gutter, `0` panels, `+1` frame members (Dock/Shelf/utilities), `+2` popovers/menus. Borders are 1px hairlines at low contrast; separation is primarily tonal. Dark-first (this is a spatial tool; the canvas is the bright object) with a fully-specified light theme where the relationships invert but the *steps* don't.

**Typography.** A single grotesk with a matched mono. Path segments at 14/500 with the active at 14/650. Dock labels 11/550, letterspaced. Property labels 12/450 in a muted tone; property values 13/500 mono tabular. Group bands 10/700 caps, +0.08em. The concept is deliberately **type-led**: with almost no ornament, weight and case are doing the ranking, which is why the type scale is tight and enforced.

**Colour — the "signal" policy.** Neutrals carry 95% of the UI. Colour is spent only on:

| Hue | Spends on | Never on |
|---|---|---|
| **Identity hue** (a saturated warm cyan-teal — not the P23.13 selection blue) | Path active underline, domain badge, armed-tool accent, focus ring | selection, anything on paper/canvas |
| **P23.13 selection blue** | selection, everywhere, unchanged | chrome states |
| **P23.13 snap/guide/invalid** | canvas only, unchanged | chrome |
| **Amber** | unsaved / pending / "will change on commit" | success |
| **Red** | refusal + destructive confirm | disabled |

Deliberate separation of the **identity hue** from the **selection hue** is the thing that lets SIGNAL be colourful without polluting the Plan language (context §11). It is also the theme-survival mechanism: the identity hue rotates per theme, but its *jobs* never change, so the product still reads as itself.

**Iconography.** 18px, 1.5px stroke, geometric, flat terminals; the five ratified Plan icons pinned. Dock cells always show icon **+ label** at ≥1440px and icon-only below, with labels available permanently via the Show labels toggle. SIGNAL leans on labels more than PLATE does — for a non-CAD creator, `Poly Room` beats a pentagon.

**State grammar.** Because Path/Dock/Bind are separate forms, states don't collide:

- Path: active = weight + underline. Disabled segments don't exist (a domain is always available).
- Dock: hover = +1 step; armed = accent fill + underline; active-mode = filled cell; disabled = 40% + reason on hover.
- Bind: selection = P23.13 blue bar/handles; focus = 2px identity-hue ring at 2px offset; refusal = red anchored chip with reason text.

**Motion.** State 100ms. Shelf 180ms height. Path segment change: the new segment fades in from the right by 4px — a tiny, deliberate "you moved" cue that makes domain switches feel navigational without being a transition.

**Working attenuation.** On gesture start, the Dock and both rails drop to 70% opacity and lose their hairlines; the viewport frame's identity accent remains. Release restores. The canvas never dims.

### 4. Educational model

SIGNAL's teaching is **sentence-shaped**, which suits a beginner better than tooltips:

1. **The Path reads as a sentence** and answers "where am I" permanently, in words, for free.
2. **Dock group labels** (`MODE` · `DRAW` · `OPENINGS` · `DISPLAY`) are permanent 9px structure — the single highest-value learnability item in the concept, and it costs 12px of height.
3. **Bound coaching.** Arming a tool puts a one-line caption in the viewport frame's bottom member (not floating over the canvas): `Wall — click a start point. Shift: 45° increments · Esc: cancel.` It replaces the counts readout while armed and restores it on commit. This is the concept's answer to "education at uncertainty boundaries" — it's in a *fixed place*, so it never obscures work and is never a surprise.
4. **Reasons everywhere.** Disabled Dock cells and disabled Inspector actions carry `why` on hover and focus, using one sentence pattern. `Connect` greyed in Camera Plan reads `Needs two cameras selected.`
5. **Empty states** carry heading + one line + one action, and the wall-first explainer lives in the Inspector's no-selection state only.

No permanent prose sits above a property. Anywhere.

### 5. Extension model

- **P26.** The single best fit of the three concepts. An instrument opens as a **fourth Path segment**: `Untitled project ▸ Scene ▸ Plan ▸ Section A ×`. The return path is the segment to its left, always visible, always clickable. The Dock swaps its contents to the instrument's tools (same grammar, same cells) and the viewport frame gains the instrument's own utility members (plane/depth/crop controls as a right-edge frame member — a place that exists but is empty today). No second navigation system; no new visual language; `Plan|3D` was never a binary control, it was two menu values.
- **P24.** Selection sets → the Inspector's bound header grows a count and a "primary" indicator; the Navigator supports a multi-row selection with one primary bar; mixed/inherited/derived value states are specified up front. New sections (materials, lights, environment) are just more bands. Destructive reset uses the `ACTIONS` band with a confirm that states the consequence.
- **Growth rule:** anything new must be classified Path, Dock or Bind. If it wants to be a floating fourth thing, that's the architecture smell.

### 6. Risks

- **Breadcrumbs can read as "navigation into documents."** Contract 1 says a domain switch never changes the document. Mitigation: the Path is *never* file-shaped — no folder icons, no slashes, and the project segment uses a distinct weight. Still, this must be user-tested; it is the concept's single biggest conceptual risk.
- **Dock-inside-the-frame narrows the canvas by 40px vertically** and moves tools away from the window edge (loses Fitts' infinite edge). Mitigation: keyboard tool shortcuts are first-class and shown in labels.
- **Type-led + dark-first can drift sterile** — the exact failure the brief warns about. Mitigation: warmth must come from the identity hue's temperature, generous 22px group bands, and rounded-but-not-soft 4px geometry; if it still reads cold, the light theme (warm neutral, not white) is the corrective and must be designed *with* the dark, not after.
- **Colour independence:** armed state uses fill **and** underline; refusal uses colour **and** an icon **and** text. Verified per state.
- **Path at 1280px** may truncate the project name. Mitigation: project name truncates first, then the chevron labels abbreviate; domain/view segments never truncate.
- **P23.15:** the viewport frame is content-agnostic; no member is sized or toned around current mesh appearance.

---

# CONCEPT 3 — **ATLAS**
## *The cell matrix and the perimeter frame*

### 1. Thesis

> Museum Editor's mental model is **a grid of places you can stand in one building**. ATLAS puts that grid on screen as a single, physical, always-present control — the **Cell Matrix** — and then removes the top toolbar entirely, distributing everything else to the four edges of a perimeter frame.

This is the most opinionated of the three and the most distinctive. There is **no ribbon**. The domain × view matrix (context §2's own table) becomes a 2×2 (later 2×N) widget at the top-left corner, ~112×56px, showing all four cells simultaneously with the current one filled. You *see* the four-cell model the way you see a floor selector in a lift. For a creator with no CAD training, this is the single most educational object I can put on the screen: it makes "Camera · Plan" a place, not a pair of toggles, and it makes it obvious that switching is free and lossless (contract 1) — because you never left the building, you moved rooms.

Everything else follows from removing the ribbon: local mode and tools go to the **left edge**; display/view state goes to the **bottom-left canvas corner**; project/global goes to the **top edge, right of the Matrix**; Inspector right; Timeline bottom. The result is a shell that is *visibly a frame around work* rather than *layers stacked above work* — which is where its warmth comes from: this is an editorial, generous, slightly bookish surface with strong structure, closer to a well-set catalogue than to a control panel.

### 2. Shell composition

```
┌───────────────┬──────────────────────────────────────────────┬───────────────────┐
│ ┌───────────┐ │ ‹Projects  Untitled project     Local Session│ ⟲ ⟳  Save  ▸Prev  │
│ │ ▣Pln │3D  │ │──────────────────────────────────────────────┴───────────────────┤
│ │Sc ███ │   │ │                                              │ INSPECTOR         │
│ │Cam    │   │ │                                              │                   │
│ └───────────┘ │                                              │  Wall  W-FJSK     │
├───────────────┤                                              │  ─────────────    │
│  MODE         │                                              │  GEOMETRY         │
│  ▣Layout      │                V I E W P O R T                │   Length  4.90 m  │
│   Arrange     │                                              │   Angle    0.0°   │
│  ─────────    │                                              │   Thick.   0.20 m │
│  DRAW         │                                              │  IDENTITY         │
│  ◹ Wall       │                                              │  ACTIONS          │
│  ▭ Rect Room  │                                              │                   │
│  ⬠ Poly Room  │                                              ├───────────────────┤
│  OPENINGS     │                                              │ NAVIGATOR         │
│  ⌐ Door       │                                              │  Rooms         1  │
│  ▯ Window     │                                              │  ARCHITECTURE     │
│  OBJECTS…     │  ⌗0.25  ⊞Grid  Tour   │ 2m ├──┤   1 rm · 0 w │   Walls        4  │
├───────────────┴──────────────────────────────────────────────┴───────────────────┤
│ TIMELINE (Camera) — viewport-width, docked above status                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Scene • Plan   W-FJSK selected   Unsaved   hints…              Grid Snap Metric  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Persistent:** Cell Matrix, left Instrument Column, top Project Strip, right column (Inspector over Navigator), canvas utility strip, Status.
**Contextual:** Instrument Column contents, Timeline, binds.

- **The Cell Matrix (top-left, ~112×56).** A bordered grid: columns = views (`Plan`, `3D`), rows = domains (`Scene`, `Camera`). Each cell is a real target (28px min, 44 in touch tier) with the row/column headers as 9px caps. The current cell is filled with the domain's tint; the current row and column are lightly held so you can read "Scene" and "Plan" independently. Hovering a cell previews its name in the Project Strip. Keyboard: arrows move within the Matrix when focused. **This is the product's signature object** — it appears in the app icon, the loading state and the Project Hub's project cards as a tiny state badge.
- **Project Strip (top, right of the Matrix, 40px).** Back, project name, session, save, Document menu, Undo/Redo, `Preview`, theme, account. `Spatial | Publish` sit as two text tabs at the strip's right-of-centre, sized to accept a third.
- **Instrument Column (left, 200px at default; collapsible to 56px icon rail).** This is ATLAS's deliberate anti-minimalism: tools are a **labelled, grouped, vertical list**, not an icon strip. `MODE` group (Layout/Arrange as two rows with a filled active), then `DRAW`, `OPENINGS`, `OBJECTS`, with each row showing icon + name + shortcut key right-aligned in mono. A non-CAD creator can read the entire authoring vocabulary of the current cell in one glance without hovering anything. This is the biggest single learnability win available and it costs 200px that the concept pays for by having no ribbon.
- **Right column: Inspector above, Navigator below, one 300px column, split by a draggable divider.** This is ATLAS's second structural bet and it is contentious, so the reasoning: the two panels are read together constantly (the "selection trio"), and stacking them means one eye path instead of two, and the left edge stays purely instrumental (hand) while the right edge is purely informational (mind). Selection coherence becomes visually trivial: the Inspector header and the highlighted Navigator row are 300px apart vertically, in the same column, connected by a 2px selection bar that runs down the column's left edge through both. That connector is a genuine product signature and it is free.
  Default split 60/40; either can collapse to a header; in Camera the Navigator half becomes the Camera sidebar.
- **Canvas utility strip (bottom of the viewport, in the frame).** One place for Snap value, Grid, Tour, scale bar, counts, and the nav/axis widget (a small cube at the strip's right, in both Plan and 3D — same widget, different content). This kills §8 row 6 outright.
- **Timeline.** Viewport-width, docked between the canvas and the status bar, with the same three states as §0.3.

### 3. Visual system

**Editorial surface.** ATLAS is the warmest of the three and the most "designed": a light-first system on a **warm neutral ground** (not white), with panels as slightly lighter planes, generous 16px panel padding, and strong 1px rules that are used **structurally** (framing the Matrix, separating groups) rather than decoratively. Dark theme is a full inversion with the same rules. Corners: 4px on panels, 2px on controls, 0 on the Matrix (it is a grid; grids have corners).

**Typography — the most distinctive layer.** ATLAS is the one concept that lets type carry personality:

- **Headings/labels:** a warm humanist sans with slightly high contrast and real italics.
- **Numbers/identity:** a mono, tabular, used for every measurement, reference and shortcut key.
- **Group labels:** 10/700 caps, +0.1em, in a muted warm tone, with a hairline rule extending to the panel edge — the "editorial" gesture that makes dense panels scannable.
- **Italic has a job:** inherited or derived values are italic. That's it. One italic rule, consistently applied, teaches value provenance without a legend.

Scale: 10 / 11 / 12 / 13 / 15 / 18 / 22. Line-height 1.35 in panels (generous — density comes from grouping, not from crushing).

**Density model — "structured richness" made literal.** Panels are built from **bands**: a band is a group label + a rule + n rows. Bands never nest more than two deep. Density tiers change row height and padding, never band structure. A dense Inspector is 9 bands of 3 rows; it reads as a well-set page, not as a wall.

**Colour.** A warm neutral base plus a **six-hue functional palette** — ATLAS is the most colourful concept, and the discipline is that hue always encodes *kind*, never emphasis:

| Hue | Kind |
|---|---|
| Ink (near-black warm) | authored values, entity names |
| Muted warm grey | labels, readouts, derived |
| P23.13 blue | selection (chrome and canvas, unchanged) |
| P23.13 snap/invalid | canvas gesture language, unchanged |
| Scene tint (a warm ochre) / Camera tint (a deep teal) | the Matrix cell, the domain badge, group-label tint in the domain-owned panel **only** |
| Amber / red | unsaved-pending / refusal-destructive |

The domain tint bleeding into group-label colour is ATLAS's answer to "how visibly should Camera differ from Scene" (§17 q5): **the hue of the labels shifts; the structure does not move a pixel.** You feel the domain; you never relearn the layout.

**Iconography.** 20px, 1.75px stroke, rounded joins, slightly soft — warmer than SIGNAL's, and always paired with a label in the Instrument Column, so the icons carry recognition rather than meaning. The five ratified Plan icons pinned; ATLAS accepts their heavier mass more comfortably than the other two because everything here is already a bit warmer.

**State grammar.** Four independent channels so overlaps are legible: **fill** (active/armed), **left bar** (selection, 2px, runs through panels), **ring** (keyboard focus, 2px offset, high-contrast neutral), **tone** (disabled 45% + reason). A row can be selected *and* focused *and* have a warning dot without ambiguity — which is exactly the state-collision problem §17 names.

**Motion.** 120ms state; 180ms panel split; the Matrix cell fill **slides** between cells (140ms) — the only expressive motion in the product, and it teaches that the four cells are one space.

**Working attenuation.** During a gesture, the Instrument Column's labels fade to 55% (icons stay), panel group labels fade, and the canvas utility strip reduces to the live dimension. Roughly 30% of the shell's ink drops out for the duration.

### 4. Educational model

ATLAS is the strongest teacher of the three, by design:

1. **The Matrix teaches the model** — the single best answer to "a creator without CAD training can learn the product through the interface itself."
2. **The Instrument Column names every tool permanently**, with its shortcut. No hover archaeology.
3. **Group labels everywhere** make the Inspector's information architecture self-describing (`GEOMETRY`, `IDENTITY`, `ACTIONS` — existing vocabulary only).
4. **Italic = derived/inherited** teaches ownership silently, which is directly the Ownership pressure test.
5. **The selection connector bar** visually proves the selection trio to a new user within seconds.
6. **Contextual teaching only at boundaries:** an armed tool shows a caption line in the canvas utility strip; a refusal binds to the geometry; a disabled row states its reason inline in the column (ATLAS has room for it — a disabled tool row can show `— needs a wall selected` as a second line, in place, which neither other concept can afford).
7. Empty states get a real editorial treatment: a small illustration-free diagram (built from the same 1px rules), a heading, one line, one action.

### 5. Extension model

- **P26 — the reason the Matrix is a matrix and not a pair of toggles.** Views are **columns**. A contextual instrument opens as a **third column** (`Plan | 3D | Section A`) that appears when active, carries an `×`, and is visually marked as *transient* (dashed top edge) so it never reads as a peer permanent view. The return path is spatial: the Plan and 3D columns never move. If P26 instead wants instruments to be *domain-scoped* or *nested*, the Matrix supports a cell carrying a small corner dog-ear that expands into a sub-cell — an option I would prototype, not commit to. Either way, nothing is hard-coded to two.
- **P24.** Selection sets → the connector bar thickens and the Inspector header shows `3 walls · primary W-FJSK`; mixed values are `— mixed`, inherited italic; new bands (Material, Light, Environment) slot into the Inspector half; the Navigator half grows depth with the same band grammar; destructive actions live in a red-labelled `ACTIONS` band with consequence text. The stacked right column means a taller Inspector can borrow height from the Navigator with the existing divider — genuine headroom the other concepts don't have.
- **Growth rule:** everything is a band in a panel, a row in the Instrument Column, a cell in the Matrix, or a bind. Four slots; no fifth.

### 6. Risks

- **The stacked right column is the concept's biggest gamble.** Users with deep hierarchies may want tall Navigator *and* tall Inspector. Mitigation: the divider, collapse-to-header, and a preference to un-stack (Navigator returns to the left, below the Instrument Column) — but that fallback weakens the concept's left/right hand/mind split and must be treated as a degradation, not an equal option. **This should be prototyped before ATLAS is chosen.**
- **200px Instrument Column + 300px right column = 500px of chrome** at default. At 1280px that leaves ~780px of canvas. Mitigation: the Instrument Column auto-collapses to a 56px labelled icon rail below 1440px, and focus mode still gives `0 1fr 0`.
- **A 2×2 matrix widget can read as a toy** or as a colour-picker swatch. Mitigation: it must be drawn as an instrument — hairline grid, caps headers, tabular fill — and it must be tested for whether users find it *clickable*. If they don't, ATLAS loses its signature.
- **Warm + colourful + editorial risks "friendly dashboard."** Mitigation: the brief's own line is the acceptance test — warmth must live in type, hue temperature and spacing rhythm, never in rounded cards, illustrations, or oversized controls.
- **Six functional hues is the highest colour load of the three** and the biggest theme-survival risk. Mitigation: hues encode kind, and each has a non-colour partner (italic, rule weight, glyph, position).
- **Contrast:** warm neutral grounds make 4.5:1 harder. Every label tone must be verified per theme; the status-bar hint tone (#34) is specified at 4.5:1 minimum, not 3:1.
- **P23.15:** ATLAS renders 3D content inside the same frame as Plan with no content-specific treatment; the shared nav/axis widget is content-agnostic.

---

## 4. The six canonical states, compared

Rather than repeat six descriptions per concept, this is the comparison matrix the brief asks for — each cell states the *load-bearing* behaviour of that concept in that state.

### A — Scene · Plan, normal architectural editing

| | PLATE | SIGNAL | ATLAS |
|---|---|---|---|
| Where am I | Spine `Scene` lit; View Bar `Plan` engraved | Path: `Untitled project ▸ Scene ▸ Plan` | Matrix cell Scene×Plan filled |
| Mode | `MODE Layout|Arrange` in View Bar | first Dock group, filled cell | first Instrument Column band |
| Tools | vertical Tray at canvas-left, grouped | Dock cells inside viewport frame, grouped+labelled | labelled rows with shortcuts |
| Navigator | chassis panel, 4 species, engraved headings | full-bleed sticky bands | bands, right column top... (bottom) |
| Inspector | property-first, Actions last | bound header card → bands → ACTIONS | bands, italic for derived |
| Status | readouts only | readouts only | readouts only |

### B — Scene · Plan, active operation

All three: P23.13 language untouched on the canvas (ghost, live dimension, snap marker, guide, handles). The differences are in what the shell does:

- **PLATE:** chassis text →60%, instrument highlights flatten. The Tool Tray's armed cell keeps its amber rule so you never lose track of what's armed. Refusal binds to the handle in the P23.13 invalid hue with the `Refused: … — …` pattern.
- **SIGNAL:** rails and Dock →70%, hairlines removed; the viewport frame's bottom member swaps counts → coaching caption → (on refusal) the reason line, so refusals have a *fixed* second home as well as the bound one. Two intensities, one grammar.
- **ATLAS:** Instrument Column labels →55% (icons persist), group labels fade, utility strip reduces to the live dimension. The armed row keeps its fill and its shortcut key visible.

None of the three allows the shell to *move* during a gesture. Attenuation is opacity and ink only.

### C — Scene · 3D, object selected

- Selection coherence is shown identically in all three: canvas handles (P23.13-consistent hues), Navigator row, Inspector header — **one identity**.
- Transform group (`Move/Rotate/Scale`, `Local|World`) lives in: PLATE's Tool Tray (with `Local|World` as a two-cell selector directly under the transform group); SIGNAL's Dock (own labelled group); ATLAS's Instrument Column (`TRANSFORM` band, `Local|World` as two rows).
- Canvas utilities/nav widget: PLATE bottom-right of paper; SIGNAL top-right frame member; ATLAS the shared cube in the bottom strip. In all three, **Plan and 3D use the same member**, ending the two-vocabulary problem.
- **P23.15 honesty:** none of the three styles the architectural mass, adds outlines sized to joins, or tunes background value against current seams.

### D — Camera · Plan, path authoring

- Domain is signalled by: PLATE, the Spine station + a cool-ink edge-light and the Camera sidebar replacing the Hierarchy panel *in the same frame*; SIGNAL, the Path segment reading `Camera` plus the identity hue unchanged (deliberately — one product); ATLAS, the Matrix row + group-label hue shift to teal.
- In all three, the architectural backdrop is rendered as **passive ink** per P23.13 (no fills, reduced weight), and the Camera sidebar's four sections use the **same band grammar** as the Scene Navigator — which is the "one product" proof. The unsequenced-camera drop target keeps its dashed treatment but gains a heading and one action line per §0.3's empty-state rule.
- No frustum/FOV cone in Camera Plan, per context §3.

### E — Camera · 3D + Timeline (three states)

All three place the Timeline at exactly viewport width, edge-aligned.

| Timeline state | Shared behaviour across concepts |
|---|---|
| **Expanded with a flow** | 36px header (scope chip, transport, `POV|Observer`, tools) + ruler + five lanes. Lane labels use the same group-label type as panels; the label column aligns to the concept's panel grid. Node diamonds, shot blocks and FOV keys use the **selection** hue for selected and neutral-with-tint for unselected. Lanes that are structurally inert in the current scope (`Roll` constant; `Shots` in Edge scope) are rendered **collapsed to a 20px summary row** with their state stated (`Roll — 0° constant`) and a disclosure to expand. They are not deleted (that's a Camera product decision, §10) and they are not given full height for nothing. |
| **No flow** | Dock renders at transport height only, scope chip `No sequence yet`, one action (`Add camera`) and one line of teaching. Expanding to 288px is possible and shows the lane *frame* with labels and an empty ruler, labelled as empty — never fake lane content. |
| **Collapsed 48px** | Full-width transport strip; with a flow it carries the scrubber, without a flow it does not. Same height, same alignment, one surface changing size. |
| **Frustum** | Selected camera node's finite frustum rendered as shipped (1px perimeter + ~9% fill), with the `Frame` toggle in the concept's display group. Untouched semantics. |

Concept differences are only in framing: PLATE's Timeline is a *drawer out of the chassis* (it slides, with a grab rail); SIGNAL's is the *bottom member of the viewport frame* (it's structurally part of the canvas surround); ATLAS's is a *docked band* sharing the panel band grammar.

### F — Dense / high-pressure state (the real test)

Scenario assumed: 21 rooms, 48 walls, 30+ openings, several junctions, expanded Navigator groups, a populated Inspector with 8+ property rows plus warnings, labels at minimum zoom, Timeline present.

| | PLATE | SIGNAL | ATLAS |
|---|---|---|---|
| Navigator at load | Engraved headings become sticky; counts always visible; rows shed the reference chip before the name; relation metadata is an inline suffix, never a row | Full-bleed bands are sticky; a filter row appears at >50 rows in a group (filter, not hover-reveal); virtualised | Bands + a persistent count column; the Navigator half can be dragged taller, or the Inspector collapsed to its header |
| Inspector at load | Sections collapse to the ones with authored values by default; `ACTIONS` always last and always visible | Bands are sticky headers; the bound header card pins on scroll so identity is never lost | Two-deep bands, italic derived; generous line-height keeps a 9-band panel readable |
| Warnings | Standing counts are **readouts** in the status rail and a badge on the owning Navigator group; transient refusals are bound. Never the same treatment | Same rule; warning badges use glyph+count, not colour alone | Same rule; warning dot sits in the band's rule line |
| Canvas at min zoom | P23.13 shedding order respected exactly (dims → secondary edges → labels → handles); shell adds nothing to the canvas | Same | Same |
| Degradation principle | Shed detail within a row (reference, then secondary line) | Shed the whole group behind a filter | Shed the *other* panel's height |
| Failure mode I'd watch | 100px permanent left chrome + a dense Navigator = cramped at 1280 | Dock horizontal overflow with many P24 tools | Right column contention between a big tree and a big Inspector |

**Honest ranking under F:** SIGNAL degrades most gracefully (filtering + virtualised bands + a pinned header). ATLAS is the most *readable* when dense but has the least structural headroom at small widths. PLATE sits between and pays the most fixed chrome cost.

---

## 5. Pressure tests — all three concepts

| Test | PLATE | SIGNAL | ATLAS |
|---|---|---|---|
| **Semantic hierarchy** | Material + axis: chassis vs paper, vertical domain vs horizontal view, tools on a tray. Distinguishable without labels. | Form: bare-type Path vs filled Dock cells vs bound overlays. Strongest categorical separation of the three. | Place: a matrix widget, an edge column, a frame strip, a panel band. Most learnable; relies on position memory. |
| **Canvas** | Paper is the only warm surface — canvas dominance by material. | Viewport gets a frame it *owns*; attenuation drops chrome 30% during work. | 500px default chrome is the weakest canvas dominance; recovered by attenuation + collapse. |
| **Selection** | One authority; blue left-bar in Navigator, blue header in Inspector, P23.13 handles on paper. | Same, plus a pinned bound header card. | Same, plus a literal connector bar running down the right column through both panels — the most *visible* coherence. |
| **Density** | Sheds within rows; three density tiers. | Sheds by filtering + virtualisation; bands stay sticky. | Sheds by reallocating height between stacked panels. |
| **P24** | Header count slot, 4 value states, vertical tray grows downward, Actions band. | Same value states; Dock grows horizontally with scroll; bands multiply. | Same; stacked column has genuine spare height; italic derived already teaches provenance. |
| **P26** | New engraved view tab **or** a reserved Spine tray — two ranked hosts. | Fourth Path segment with an `×`; return path is the text to its left. **Strongest.** | Third Matrix column, dashed = transient; return path is spatial. Very strong and most teachable. |
| **Timeline** | Drawer out of the chassis; viewport-width; three states; inert lanes summarised not deleted. | Bottom frame member; structurally part of the canvas surround. | Docked band sharing panel grammar. All three fix §8 row 7. |
| **Education** | Geometry + engraved group labels + Show labels + bound moments. | Path-as-sentence + Dock group labels + a fixed coaching line. | Matrix + permanently labelled tools + italic provenance. **Strongest.** |
| **Trust** | Every control is acts / refuses-with-reason / readout. The mute Room rotation handle cannot exist; flagged as a product decision. | Same, plus a fixed second home for refusal text. | Same, plus inline reasons under disabled tool rows. |
| **Ownership** | One home per fact; status rail has zero controls. | Same; Snap/Grid live in the Dock display group only. | Same; Snap/Grid live in the canvas utility strip only. |
| **Collapse** | `0 1fr 0` keeps Spine, View Bar, Tool Tray, status — selection still legible in the status bar and on the canvas. | Keeps Path, Dock, frame, status — **Dock unaffected because it's inside the frame**, the cleanest collapse. | Keeps Matrix, Project Strip, Instrument Column, utility strip — collapses the right column only; strong. |
| **Identity** | Paper-in-a-chassis + filled Plan icons + mono numerics. Survives themes because it's a *relationship*. | Identity hue with fixed jobs + Path-as-sentence + frame. Survives themes by rotating hue, not jobs. | The Cell Matrix. The most ownable single object in the three; survives themes trivially. |
| **P23.15** | No dependence; 3D content is "paper". | No dependence; frame is content-agnostic. | No dependence; shared nav widget is content-agnostic. |
| **Label discipline** | Zero new schemes; reuses `Tour overlay`, `Play sequence`, `Published view` — all existing words, one collision removed. | Same. | Same. |

---

## 6. Why none of these is a reskin

Each concept **moves at least two load-bearing structures**, not styles:

- **PLATE** moves the domain axis off the horizontal band entirely (into a full-height Spine) and moves tools out of chrome onto a canvas-adjacent tray, then adds a material system that makes "chassis vs paper" a checkable rule for every future pixel.
- **SIGNAL** deletes the ribbon in favour of a stated Path, moves the entire tool/display layer *inside the viewport frame* so the canvas owns its own instruments, and demotes `Spatial|Publish` out of the authoring plane.
- **ATLAS** deletes the ribbon entirely, replaces the two toggle pairs with a single spatial matrix widget, moves tools to a labelled left column, and stacks Navigator under Inspector into one informational column with a physical selection connector.

And all three replace one-off treatments with systems: a three-way control taxonomy (acts/refuses/readout), four Navigator row species, four property value states, two refusal intensities with one grammar, three density tiers including a real coarse-pointer tier, and an explicit working-attenuation behaviour.

---

## 7. Questions I took positions on, and the ones I refuse to settle

**Positions taken** (context §17): quiet-during-work, present-between-work (all three); density target = grouped bands, not crushed rows, with three tiers; tonal separation primary and hairlines secondary in SIGNAL/ATLAS, material separation in PLATE; Camera differs by *tint and panel content*, never by structure; docked everywhere, with the Timeline the only sliding surface (PLATE); signature trait = paper/chassis (PLATE), Path + identity hue (SIGNAL), Cell Matrix (ATLAS); mono tabular for all measurement and identity; the mixed icon family kept as a *rule* (filled = Plan authoring) rather than tolerated as an accident; accent policy = hue encodes kind, never emphasis; Timeline on the shell grid at viewport width; the ribbon is *structurally stable and contextually filled* — group labels persist even when their contents swap, which is what makes it learnable; `Experience` gets a third slot by construction in all three; the third level of locality (`Layout|Arrange`) is signed by **being the first group in the tool surface**, not by being a peer of view.

**Raised, not settled — these are product decisions:**

1. The **Roll lane** carries a constant `0°` in every scope and `Shots` is inert in Edge scope. I have specified a 20px summary row rather than full height, which is within shell authority — but **whether Roll should exist** is Camera product reconciliation and I am explicitly not deciding it.
2. The **Room rotation handle** that paints and commits nothing cannot coexist with any of these systems. Either bind it or unpaint it; a shell cannot honourably host it.
3. **TD-1** blocks capture of every populated Timeline state. My E specifications are from the documented lane structure, not from observation, and should be re-reviewed against a real populated capture before any concept is selected.
4. Whether the **Navigator and Inspector may share one column** (ATLAS) needs a prototype with a 21-room project before it is treated as a viable direction.
5. `Spatial | Publish`'s eventual relationship to `Experience` — I've reserved room in all three and demoted it out of the authoring plane in SIGNAL, but the taxonomy is P25's.

---

## 8. If I had to say what I'd advance

The brief forbids ranking, and I won't produce one. But the honest comparison note for whoever does choose:

- **SIGNAL** is the safest bet against P26, because nesting is free in a Path and expensive in everything else.
- **ATLAS** is the strongest answer to "educational and understandable" and the only one with an ownable signature object, at the cost of the most chrome and the most unproven structure.
- **PLATE** is the strongest answer to "warm instrument, not friendly dashboard" and the most theme-durable, at the cost of being the least structurally radical of the three.

A hybrid is plausible and should be considered deliberately rather than by accident: **ATLAS's Cell Matrix inside SIGNAL's Path position, over SIGNAL's canvas-owned Dock, with PLATE's material rule governing surfaces** is a coherent fourth system and not a compromise — but it should be designed as a fourth concept, not assembled from parts in a review.