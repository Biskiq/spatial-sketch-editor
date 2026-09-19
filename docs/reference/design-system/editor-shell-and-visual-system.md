# Museum Editor — Shell & Visual-System Contract (PLATE)

**Status:** durable, owner-ratified **normative authority for the editor shell and
visual system**, promoted here out of the P23.14 implementation slice. The P23.14
design documents are now history and only supersession pointers remain at their old
slice paths (§0.6).  
The post-implementation owner ratifications (R1–R3) and the implementation-era
rules they produced are folded into the sections below (ratified 2026-09-19).
P23.14 itself remains under **OWNER REVIEW** — promoting this document does not
close that slice (§0.3).  
**Working name:** **PLATE**  
**Purpose:** the normative shell + visual-system contract for Museum Editor, and the
first document a later phase reads before it touches shell composition, material,
typography, control metrics or state language.  
**Evidence annexes (evidence, not authority):**
[`editor-shell-ratifications.md`](./editor-shell-ratifications.md) — the measurement-grade
record of R1–R3 and the root cause of the pre-ratification drift;
[`editor-shell-atlas/`](./editor-shell-atlas/index.html) — the interactive visual/interaction QA companion;
[the P23.14 shell QA record](../../roadmap/p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md)
— findings, open owner calls and
carried implementation debt.  
**Provenance only (never authority):** the P23.14 slice's `design/proposals/` and
`design/briefs/`, the historical
Designer-D PNG exports, and the pre-PLATE shell specifications' numeric sections.

> **Reading order for a later phase:** this document §0 → the section that owns
your change (composition §5 · material §4/§6 · type + control §7 · state §18 ·
density §22) → `editor-shell-ratifications.md` only when you need the
> measurements behind a ratified decision. Do **not** take a numeric shell value
> from `docs/reference/design-system/*` or from a component's scoped CSS; those
> are descriptive or historical (§0.5).

---

## 0. Authority and intent

This document is the **durable shell and visual-system authority** for Museum
Editor. It was promoted, retitled and extended out of the P23.14 implementation
slice, whose design direction it replaces as the live contract; it supersedes the
earlier proposal-level interpretations of PLATE while retaining the strongest parts
of Designer A’s concept. Future work reads it here, in `docs/reference/`, not in the
P23.14 slice (§0.6).

The contract is a synthesis of:

- the P23.14 research and shell-design context;
- Designer A’s PLATE proposal;
- owner ratification and visual exploration;
- current Museum Editor shell behavior;
- P23.12 identity/search/Inspector contracts;
- P23.13 Plan drafting and iconography contracts;
- P24 staging and multi-selection pressure;
- P26 contextual architectural-instrument pressure;
- the four ratified PLATE visual specimens: Scene/Plan, Scene/3D, Camera/Plan, Camera/3D + Timeline.

Designer A remains the conceptual ancestor of the material and axis grammar, but this document is now the authority.

The Atlas produced from this document is **not** the product specification. It is an interactive, falsifiable QA instrument that demonstrates the specification. If an Atlas detail conflicts with this document, this document wins.

---

## 0.1 Authority graph (explicit, unambiguous)

| Rank | Source | Normative for |
| --- | --- | --- |
| 1 | **This document** (`editor-shell-and-visual-system.md`, PLATE) | Shell + visual-system composition, material, typography, control metrics, state language, density, responsiveness |
| 2 | **Subsystem authorities** — P23.12 identity contract; P23.13 Plan drafting, iconography and Plan Paper; `reference/north-star.md`; document/selection/navigation/camera-motion ownership specs | Their own domains, unchanged by P23.14. This document consumes them (§2.6, §2.7) and never overrides them |
| 3 | **[`editor-shell-atlas/`](./editor-shell-atlas/index.html)** | Canonical interactive visual/interaction **QA companion**. It demonstrates this document; it never decides topology, domain ownership, validation or acceptance numbers |
| 4 | The **other** `docs/reference/design-system/*` docs (this one excepted) and `docs/reference/components/shell.md` | Still canonical for **capability, ownership, exposure** and the frozen identity/icon/Plan contracts. Their shell **placement, dimension, type, control and material** statements are **descriptive of this document** (§0.5) |
| 5 | `design/proposals/`, `design/briefs/` (P23.14 slice), historical PNG exports, pre-PLATE shell specs' numeric tables | Provenance and visual exploration only. Never implement from them |

There is no sidecar that competes with rank 1. Ratified changes are written
**into this document**; the annexes record evidence and history.

## 0.2 What changed after implementation — ratification record (2026-09-19)

P23.14 was implemented and reviewed against the PLATE reference PNGs and the
Atlas. Three owner ratifications and one grammar correction refine the
pre-implementation direction. They are folded into the sections named below, so a
later phase never has to reconstruct them from a PR body or a QA note.

| Ratification | Pre-implementation direction said | Ratified, implemented outcome | Folded into |
| --- | --- | --- | --- |
| **R1 — Tool Tray tier** | §7's approximate hierarchy read as: engraved group labels at 10 px | The rail paints **7 px group / 8 px tool**, with a **6 px compact floor** for a group word that physically cannot fit, opt-in per group (`TRANSFORM` is the known case). Rail stays 44 px, tools ~42 px | §7.3, §11 |
| **R2 — armed tool** | `--editor-armed` as the rail's armed fill, with a hue plus non-hue cues | Armed = **one material step darker** (recess), full normal ink, **no amber outline, no 3 px accent edge, no label-weight jump**; hover lifts, armed sinks; legible without hue | §11.2, §18.1 |
| **R3 — type + control scale** | Numeric type/control values distributed across components | **Closed ladder** 9/10/11/12/13/15/20 px + **semantic roles** + two global scales (`--editor-type-scale`, `--editor-control-scale`), plus the cascade rule and the role outcomes | §2.8, §2.9, §7.1–§7.4, and each metric section |
| **View Bar MODE grammar** | "Scene Plan may additionally expose the subordinate MODE label with Layout / Arrange" | **`MODE` then `Layout` / `Arrange`**: `MODE` is a quiet **non-interactive caption**, not a third segment; the wrapper has no fill, border, radius or padding that reads as one capsule. Pressed/toggled View Bar controls use a **recessed surface + edge border + inset bottom rule** instead of the earlier accent-soft fill | §10, §18.2 |
| **R4 — one writable owner per fact** | Composition ruled; ownership of individual controls between shell hosts not stated | **The host decides what a control paints; the workspace decides what is exposed.** Five facts had two writable homes (Panels, Scene grid, camera Path/Frame, the MODE-neighbour pair, `POV / Observer`); the Inspector resolves **one exposed target** (`resolveInspectorDomain()` / `resolveInspectorExposure()`) that both header and body consume, while the retained selection stays remembered. Fix the **host gate**, not the button | §2.12, §10, §11 |

The governing principle behind R1, stated once so it is not re-litigated:

> **The rail's geometry and legibility constraint outrank obsolete numeric
typography inherited from the pre-PLATE shell.** A historical font size never
outranks the constraint it was meant to satisfy (§2.10).

**R4** was ratified after the code review of the implementation PR at head `f7a31e2`, which
accepted the R1–R3 direction and the authority migration but blocked merge on the ownership and
exposure seams. The measured tables, the leak instances and the review evidence:
[`editor-shell-ratifications.md`](./editor-shell-ratifications.md) and the QA record's
*Review pass — ownership by host, exposure by workspace* section.

## 0.3 Open seams — deliberately NOT settled in this document

These are unresolved owner calls recorded by the P23.14 review. They are listed
here so no later phase mistakes **review-open** behaviour for ratified shell
design. Do not implement a default for any of them without an owner decision.

| Open seam | State |
| --- | --- |
| ~~**F1** Scene workspaces can mount the Camera node editor~~ | **resolved** by R4 — the Scene workspace never mounts the Camera editor (§2.12) |
| ~~**F2** Inspector header vs body can describe different selections~~ | **resolved** by R4 — one resolved Inspector target feeds both (§2.12) |
| **F4** Numeric fields report `:invalid` while holding legal values | **not shell design — deferred, not accepted.** Registered as **TD-2** in [`docs/operations/tech-debt/README.md`](../../operations/tech-debt/README.md); the fix changes arrow-key increments, which is Inspector entry design |
| ~~**F5** `POV / Observer` in both the View Bar and the Camera-Drawer transport~~ | **resolved** by R4 — the drawer is the single owner (§2.12) |
| Tool Tray **keyboard focus** treatment | open — focus is a *separate* state from armed (§18); any change must preserve a visible, non-hue keyboard affordance |
| View Bar **pressed fill** | open — the recessed surface in §10/§18.2 is the current baseline; an accent-tinted fill is a one-line reconsideration |
| **Tray width vs a renamed `TRANSFORM`** | open — product calls; §11 keeps the spec's own vocabulary and the 44 px rail |
| **View Bar in a squeezed centre column** (progressive density) | open seam — see §22.2 |

Source of record for each:
[`../../roadmap/p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md`](../../roadmap/p23-layout-depth/p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md).

## 0.4 Carried implementation debt — not design contracts

Kept out of the design body on purpose. These constrain implementation; they are
not new shell design:

- **TD-1** — floor-supported placement is unreachable in canonical wall-first
  projects, so a fresh project cannot author its first Camera node. Registered in
  [`docs/operations/tech-debt/README.md`](../../operations/tech-debt/README.md)
  and owned by P24.2. P23.14 records it as an acceptance limitation and does not
  work around it.
- **TD-2** — Inspector numeric fields announce `:invalid` while holding legal values (step
  base off the `step` grid). Registered as TD-2; owned by whoever next owns Inspector
  numeric entry, **not** by a shell slice. P23.14 records it and does not change increments.
- **Manual accessibility rows** — screen-reader reading order, device/coarse-pointer
  usability. Automated motion/reduced-motion and contrast checks exist, and the
  coarse-pointer rule now covers every interactive shell species including `a[href]`;
  the OS-preference and physical-device pass remains owed.
- **Frozen-relic shared components** — the visitor/publication relic shares shell
  components, so shell changes must be scoped rather than component-local (§2.8).
- **Residual Inspector role migration** — the Inspector family still pins part of its
  12 px / 12.5 px tiers (§13.1).
- **Squeezed-column View Bar pressure** — see §22.2.

## 0.5 How the older shell documents are classified

Every older shell/reference statement now falls into exactly one class:

| Class | Meaning | Where |
| --- | --- | --- |
| **Superseded** | A pre-PLATE numeric or compositional rule that this document replaces. Retained only as history; **do not implement** | §0.5 list below; the header notes in `design-specs.md` §6/§20, `design-shell-specs.md` §1–§5, `components/shell.md` |
| **Descriptive** | A correct description of the landed shell, written before or after P23.14. True today, but it follows this document rather than binding it | `components/shell.md` composition map; `design-specs.md` tables as amended |
| **Subsystem authority** | Still normative for its own domain, untouched by P23.14 | P23.12 identity; P23.13 Plan drafting/iconography and Plan Paper; document, selection, navigation and camera-motion ownership |

**Superseded list (explicit, so nothing competes silently):**

- the pre-PLATE flat type ramp (16 / 14 / 13 / 12.5 / 11.5 px) and its per-surface
  variants — replaced by §7's closed ladder and roles;
- the **32 px workspace-ribbon** band and the "Row 1 / Row 2" composition model —
  replaced by §5's Project Head + View Bar composition;
- broad-toolbar **group-label** assumptions ("10 px engraved group labels" in a
  full-width toolbar) — replaced by §7.3 / §11 for the rail, and by the engraved
  role elsewhere;
- older **tree-row measurements** (28 px rows, 13 px row text, component-local
  indents) — replaced by §12.5's row outcomes;
- **component-local button sizing** (28 px buttons inside a 28 px track, enclosed
  segmented troughs) — replaced by §7.4's control-role table and §10's View Bar
  grammar;
- the **old dark/navy identity as the product baseline** — replaced by §6's PLATE
  Light default (navy is a retained variant).

Each of those is labelled in place in the older file itself, so a reader who lands
there first is told what it is rather than silently implementing a retired number.

## 0.6 Provenance of this document — the authority migration (2026-09-19)

The contract above was the P23.14 **design direction** while the slice was being
designed and implemented. It has since been promoted to durable authority, and the
slice's design folder is now history. Exactly one copy of each artifact exists:

| Artifact | Was (P23.14 slice, history) | Is now (durable authority) |
| --- | --- | --- |
| Shell + visual-system contract (this document) | `roadmap/p23-layout-depth/p23.14-shell-visual-system/design/final-direction.md` — read as “the final P23.14 direction” | **`reference/design-system/editor-shell-and-visual-system.md`** — read as the product's shell/system contract, slice-independent and ratified |
| Measurement + ratification annex | `…/design/owner-ratifications.md` | **`reference/design-system/editor-shell-ratifications.md`** — evidence, not authority |
| Atlas (QA companion) | `…/design/atlas/index.html` + `notes.md` | **`reference/design-system/editor-shell-atlas/`** |
| P23.14 shell QA record (dated slice artifact) | `…/qa/2026-09-19-P23.14-shell-qa-record.md` | unchanged — stays with the slice as its QA history |

At each old path a **supersession pointer** replaces the document, so no second
live copy exists and any existing link or bookmark still resolves. The Atlas keeps
its P23.14 provenance in its own wording — it is still the instrument P23.14's
review was conducted against — but it now lives beside this document as its
permanent QA companion (§0.1 rank 3).

This is a **documentation and authority migration only**. It changed no
implementation, and it does not close the slice: P23.14 stays **OWNER REVIEW**
(§0.3) until the owner closes it.

**On the wording below.** The sections keep the design-time voice they were written
in (`P23.14 must…`, `P23.14 should…`, and references to the four PLATE PNGs and the
Atlas brief). Read that as **this contract** — the shell and visual-system
requirements it governs — not as a claim about a slice that is now history. The
slice's current status is §0.3; its dated artifacts are §0.6.

---

# 1. Product thesis

P23.14 should make Museum Editor feel like a **professional spatial-authoring instrument with a warm working surface held inside a cool engineered chassis**.

The shell should feel evolved from the current product rather than replaced by a new application. Existing mental models that already work should remain recognizable: hierarchy on the left, work in the center, properties on the right, Scene/Camera as domain context, Plan/3D as durable views, and Camera Timeline as a Camera-owned surface.

The visual identity must come from structure, material, typography, state and interaction—not decoration.

The product should feel:

- professional;
- architectural;
- warm;
- creative;
- precise;
- information-rich;
- stable;
- educational when context is needed;
- distinctive without becoming theatrical.

It must not become:

- generic SaaS;
- literal CAD cosplay;
- a floating-card dashboard;
- a sci-fi control room;
- a video-editing application;
- a minimal shell that hides useful structure;
- a theme whose identity depends mainly on color.

---

# 2. Core product contracts

These are not open for redesign in P23.14.

## 2.1 One product, one world

Scene and Camera are attention domains over the same project/world. They are not separate documents or applications.

## 2.2 Durable top-level views

Plan and 3D remain the durable top-level views.

P26 contextual orthographic instruments—such as Section, Wall Elevation and Ceiling Focus—must be subordinate contextual instruments entered from a durable view with an obvious return path. They must not become a third peer view or a new top-level world.

## 2.3 Camera Timeline ownership

The Camera Timeline belongs only to the Camera domain and is available in both Camera Plan and Camera 3D.

It is part of the central work surface, not a global application footer and not a Scene feature.

## 2.4 Scene Plan local modes

Layout and Arrange remain Scene Plan local modes. Camera does not gain a parallel local-mode system merely for visual symmetry.

## 2.5 One selection authority

Navigator, viewport, Inspector, search/reveal, Timeline and status readouts must resolve to the same canonical selection identity.

A selected object must never appear to be one thing in the Navigator and another thing in the Inspector.

## 2.6 P23.12 identity contract survives

P23.14 consumes P23.12 identity. It does not reopen it.

Names, compact references, canonical identity, search behavior and Inspector rename authority remain as ratified in P23.12.

## 2.7 P23.13 drafting/iconography contract survives

Existing ratified Plan drafting language and protected P23.13 iconography remain intact unless an implementation defect requires correction.

P23.14 may harmonize surrounding shell presentation but must not casually redraw or reinterpret the settled Plan authoring silhouettes.

The landed owner ruling retains Wall / Rect Room / Poly Room / Door / Window toolbar icons as Lucide `BrickWall` / `Square` / `Pentagon` / `DoorOpen` / `Grid2x2`. The Plan Door drawing cue remains perpendicular three-dash ink; it is distinct from the retained toolbar Door icon. Other integrated P23.13 drafting marks retain their settled paths.

## 2.8 A shell region replaces presentation grammar; it does not inherit it

> **Reusing an existing component inside a new shell region does not mean its previous layout grammar remains valid there.**

PLATE reuses component **behaviour and ownership** while replacing **presentation**.
A new shell context must therefore deliberately clear the layout-bearing rules it
inherits where they conflict with this grammar. Known examples, all four of which
actually bit P23.14:

- `white-space: nowrap` inherited from a full-width bar (the Tool Tray: labels
  overran a 39 px text box into the Paper);
- old group dividers (`padding-right` + `border-right` from a ribbon track) that
  draw separations this grammar does not have;
- a segmented control's enclosure — control fill, border, radius, padding —
  around what should be a caption plus separate buttons (`MODE`, §10);
- hard-coded component heights (`button { height: 28px }`) sizing a tier the
  control role says is 24 px, plus component-local padding/radius and old
  pressed-state fills.

This is **not** a mandate to rewrite components or to duplicate state ownership.
The durable principle is:

> **Shell composition may reuse behaviour and component ownership while replacing
> presentation grammar.**

A new shell scope owes a shell-scoped rule + contract test for each inherited
layout-bearing rule it overrides, because a component's own tests cannot see this
failure mode (it appears only as layout damage in the composed shell).

## 2.9 Roles, not numbers

> **New shell surfaces consume semantic typography, control and material roles.
> They do not introduce local numbers merely to visually fit.**

A surface asks for `--editor-type-*` / `--editor-control-*` (or, where the group is
measured by fit rather than by semantics, the icon/fitted-geometry roles in §7.2).
If a genuinely new visual tier is required, **update the role system deliberately**
(§7.1–§7.3) rather than minting a value in a component. Component-scoped CSS is not
a place where shell values live.

## 2.10 Pin the constraint, not an obsolete implementation number

Reference dimensions remain useful **acceptance baselines** (§5, §26), but a
historical number never outranks the design constraint it was meant to satisfy
(§0.2). When a constraint and a pinned number disagree — the 44 px rail versus a
10 px label — the constraint wins, and the number is re-derived, re-measured and
re-ratified rather than preserved for its own sake.

## 2.11 Boundaries this reconciliation does not reopen

Folding the ratifications into this document changes **shell presentation only**. It
does not reopen: P23.12 identity; P23.13 Plan visual/drafting semantics and
iconography; Plan Paper; visitor/editor isolation; `LayoutDocument` /
`SceneDocument` ownership; canonical selection, navigation or history authority;
Camera motion authority; P24 semantics; or P26 detailed interaction design.
P23.14 remains **shell + visual-system authority** and nothing more.

## 2.12 One writable owner per fact (R4, ratified post-review 2026-09-19)

**The host decides what a control paints; the workspace decides what is exposed.**

Mounting the same component in two shell regions does not make it one owner, and it does not
make the second region a harmless echo. The implementation review found **five facts with two
writable homes** — Panel visibility, the Scene grid toggle, the camera Path/Frame helper
toggles, the View-Bar-mode neighbourhood, and `POV / Observer` — because the Tool Tray and the
View Bar host the same toolbar component and the View menu repeated the bar's own utilities.
The ratified rule:

- every writable fact (a toggle, a visibility state, a mode) has **exactly one control owner**;
- a second surface may **display** a fact, but must not render a second writer;
- ownership is decided **by host** — Tool Tray = tool vocabulary only; View Bar = menus and
  workspace utilities; Camera Drawer = transport, lane visibility and `POV / Observer`;
- exposure is decided **by workspace**;
- where two contexts legitimately need the same affordance (the collapsed drawer's mini-player
  vs the expanded transport), fix the **host gate**, not the individual button.

The Inspector is the same rule applied to selection: the workspace resolves **one exposed target**
through `resolveInspectorDomain()` plus the slot gate `resolveInspectorExposure()`
([`../../../apps/editor/src/lib/editor/app/inspector-target.ts`](../../../apps/editor/src/lib/editor/app/inspector-target.ts)),
and both the section header and the body consume it, so the panel can never name an entity whose
editor is not mounted, and a Scene workspace never exposes Camera framing authoring.

**A retained inactive selection stays remembered.** Nothing is cleared on a domain or workspace
switch — the canonical selection model owns continuity, and this rule scopes only its
*exposure*. Do not implement this reconciliation by clearing stored selections.

Acceptance: `tests/lib/editor/app/p23-14-control-ownership.test.ts` (unique writable ownership
per fact), `tests/lib/editor/app/p23-14-inspector-target.test.ts` (Scene 3D with a selected
asset; explicit Asset selection; Scene Plan ↔ Scene 3D selection continuity), plus
`contracts.test.ts` at the composition level. Re-pin existing tests from the duplicated shape to
this constraint rather than freezing the old layout.

---

# 3. Information-rank grammar

The shell should make this rank legible:

**Project → Domain → View → Contextual instrument → Local mode → Tool → Selection / gesture / status**

Each rank has a different visual job.

- **Project** is persistent application context.
- **Domain** answers whether attention is on Scene or Camera.
- **View** answers whether the durable representation is Plan or 3D.
- **Contextual instrument** answers whether the user has entered a subordinate focused representation such as a future P26 Section.
- **Local mode** changes how the current view is being edited, such as Layout or Arrange.
- **Tool** is armed action.
- **Selection / gesture / status** describes the immediate target, interaction or readout.

Do not flatten these ranks into controls with equal visual weight.

The primary signature is perpendicular:

- **Scene / Camera = vertical domain axis**
- **Plan / 3D = horizontal view axis**

That relationship should remain visible even when the user is not consciously thinking about it.

---

# 4. PLATE material grammar

PLATE uses exactly three visual-material classes.

## 4.1 CHASSIS

Persistent application structure:

- Domain Spine;
- Project Head;
- Navigator;
- Inspector;
- View Bar;
- Status Rail;
- Camera Drawer shell.

The Chassis is cool, stable, square and quiet.

## 4.2 PAPER

The spatial working surface:

- Scene Plan;
- Scene 3D;
- Camera Plan;
- Camera 3D;
- future contextual spatial instruments when they replace/focus the current work surface.

The broader PLATE Paper baseline is warm and visually distinct from application chrome. Scene Plan and Camera Plan retain the landed P23.13 Plan Paper `#F5F7F8`; surrounding PLATE Light Chassis does not override this drawing token. A future Plan Paper change requires explicit owner re-ratification and a QA pass.

Paper may contain spatial drawing, geometry, routes, selection, guides, handles and editor overlays. It should not accumulate application controls.

## 4.3 INSTRUMENT

Controls that act on the work:

- Tool Tray controls;
- local-mode controls;
- compact utility controls;
- transport controls;
- Timeline controls;
- numeric editor controls.

Instrument surfaces may have a slight manufactured edge and small radius, but should still feel mechanically integrated into the Chassis.

Do not invent a fourth material class.

---

# 5. Reference desktop shell geometry

The Atlas must include a reference desktop frame at **1440 × 900 CSS px** and reproduce the following geometry closely enough for implementation QA.

| Region | Reference geometry |
|---|---|
| Domain Spine | x 0, y 0, w 56, h 900 |
| Project Head | x 56, y 0, w 1384, h 36 |
| Status Rail | x 56, y 876, w 1384, h 24 |
| Navigator | x 56, y 36, w 268, h 840 |
| Inspector | x 1140, y 36, w 300, h 840 |
| Central work column | x 324, y 36, w 816, h 840 |
| View Bar | x 324, y 36, w 816, h 34 |
| Tool Tray | 44 px wide, vertical, attached to the Paper edge |
| Camera Drawer collapsed | 48 px high |
| Camera Drawer expanded | 288 px high |

These values define the reference composition, not a requirement that every viewport size use fixed pixels.

Responsive behavior must preserve hierarchy and ownership before preserving exact dimensions.

---

# 6. Default theme: PLATE Light

P23.14 introduces a new canonical default theme. It replaces the old navy dark-mode visual identity as the default product appearance.

The existing navy theme is no longer the product-defining baseline. If alternate themes continue to exist, they are variants of the same hierarchy and interaction grammar; they must not redefine component roles.

## 6.1 Default theme tokens

| Role | Baseline color |
|---|---|
| PLATE Paper baseline (non-Plan surfaces) | `#F5F2E9` |
| Plan Paper (Scene Plan and Camera Plan; landed P23.13) | `#F5F7F8` |
| Chassis main | `#D9DDE0` |
| Chassis recessed | `#CBD0D4` |
| Instrument surface | `#E8E5DD` |
| Primary ink | `#252A2E` |
| Secondary ink | `#697177` |
| Scene domain accent | `#A37A3D` |
| Camera domain accent | `#347D89` |
| Selection | `#2F8CFF` |
| Selection dark edge | `#145DA8` |
| Snap / guide | `#146D68` |
| Refusal / invalid | `#9B3149` |
| Armed tool | `#C58B35` |

These are the baseline default-theme values. Minor luminance adjustment is acceptable if necessary for accessibility or rendering consistency, but hue roles and contrast hierarchy must remain stable.

## 6.2 Surface rules

- Major Chassis surfaces use no decorative shadows.
- Separation comes from 1 px hairlines, tonal stepping and alignment.
- Chassis surfaces use square corners.
- Instrument controls may use approximately 3 px radius.
- Paper handles may use approximately 2 px radius.
- Avoid pill-shaped controls unless the underlying control semantics truly demand a pill.
- Avoid floating cards inside Navigator, Inspector and Timeline.

## 6.3 Color ownership

Domain accents belong primarily to the Chassis.

Scene brass and Camera cyan must not flood the Paper.

Paper owns spatial state colors such as selection, snap/guide and refusal.

No critical state may be communicated by hue alone.

---

# 7. Typography and iconography

Use two typographic voices:

- a warm humanist sans for ordinary UI;
- a narrow mechanical mono for measurements, coordinates, IDs, references, timestamps and precision values.

Do not make the product feel premium by inflating headings.

## 7.1 The ladder (closed, seven steps)

The shell's type is a **closed ladder**. These seven sizes are the only type sizes
in the product; this replaces the earlier approximate hierarchy (10/11/12/13/15/20)
and supersedes the pre-PLATE flat ramp (16/14/13/12.5/11.5, which was largely dead
— components minted their own instead, seventeen different sizes between 9.6 and
13.6 px across the shell):

| Step | At scale 1 | Typical use |
| --- | ---: | --- |
| `-2xs` | 9 px | mono measures only (timeline ticks) |
| `-xs` | 10 px | engraved/meta labels, references, status, View Bar utilities |
| `-sm` | 11 px | compact readouts, Domain Spine station labels, View Bar MODE pair |
| `-md` | 12 px | standard rows, labels, controls, property labels |
| `-lg` | 13 px | property values, Navigator scope headers |
| `-xl` | 15 px | panel headings |
| `-2xl` | 20 px | only where project identity genuinely needs it |

## 7.2 Roles, and the two global scales

Surfaces consume **roles**, never these numbers (§2.9). A role carries family +
size + weight + leading together (`--editor-type-row`, `-identity`, `-heading`,
`-engraved`, `-engraved-quiet`, `-row-head`, `-control`, `-control-strong`,
`-utility`, `-mode`, `-status`, `-property`, `-mono`, `-ref`, `-tick`,
`-readout`, `-station`, `-tray-group`, `-tray-tool`, `-body`), plus icon and
fitted-geometry roles for groups measured by **fit** rather than by semantics
(row height, disclosure target, station height, rail tool, icon sizes).

Two global scales retune the shell, and they are **deliberately independent** —
"denser buttons" and "bigger type" are different requests:

| Scale | Multiplies | Default |
| --- | --- | --- |
| `--editor-type-scale` | every type size and the icon sizes set with a label | `1` = 100 % |
| `--editor-control-scale` | button height/padding and fitted control geometry, never type | `1` = 100 % |

Both are expressed as factors (`1.15` = 115 %) because a CSS length cannot be
multiplied by a percentage token.

**Durable cascade constraint:** apply these knobs at **`:root` / the document
root** (a theme block, or inline on `document.documentElement`). A derived custom
property is resolved **where it is declared**, so raising the knob in a lower
subtree does **not** re-derive role tokens already computed at the root. Design the
knob as a product-wide control and do not expect subtree overrides to work.

## 7.3 Tool Tray tiers (ratified R1 — scoped exception)

The rail is the one container whose **geometry outranks §7.1**: §11 fixes it at
44 px, and its group label gets a 39 px text box. The rail therefore paints its own
engraved micro-tier, and a group word that still cannot fit steps down — never
breaks mid-word to preserve a number:

| Tier | Size |
| --- | ---: |
| Tray group label | 7 px |
| Tray tool label | 8 px |
| Compact floor — a word wider than the rail, **opt-in per group** | 6 px |

`TRANSFORM` is the known compact case. The compact step is an explicit per-group
opt-in, never automatic text shrinking. **Do not generalize the 6 px floor to
ordinary shell typography** — the 10 px engraved tier still owns every other
engraved label in the shell.

## 7.4 Control roles

Every chrome button is one of four roles; height, padding and type travel together,
and the pre-ratification generic control names survive only as **aliases** onto them:

| Role | Height | Padding x | Type | Use |
| --- | ---: | ---: | --- | --- |
| `lg` | 30 px | 9 px | `control` | primary actions |
| `md` | 26 px | 9 px | `control` | Project Head, forms |
| `sm` | 24 px | 8 px | `utility` | View Bar, tabs, icon controls |
| `xs` | 20 px | 6 px | `utility` | inline row actions |

Radius follows the material rule (§6.2): square chassis, ~3 px instruments.
Pressed/toggled is a **state**, not a role — see §18.5.

## 7.5 Role outcomes ratified by implementation

These are the reference outcomes of the roles and knobs above at scale 1. They are
recorded so a later phase can recognise drift, **not** as licence to duplicate a
literal inside a component (§2.9):

| Surface | Outcome |
| --- | --- |
| Project Head identity | 14 px identity role |
| Domain Spine station | 74 px station, 11 px domain label, 24 px icon |
| View Bar view tabs | engraved view-tab role (12 px, strong weight) |
| View Bar utilities | 10 px |
| View Bar MODE pair | 11 px at 24 px control height; caption per §10 |
| Tool Tray | the dedicated compact engraved/tool roles from §7.3 |
| Navigator row | 29 px row, 12 px row text, 10 px mono reference, 18 px disclosure affordance |
| Inspector section heading | 10 px / 600 / ≈ +0.04em (engraved role) |
| Timeline ruler | 9 px **mono** |
| Status Rail | 10 px status role, 12 px side padding, ≈ 20 px gaps |

Where a later phase needs a different outcome, it changes the **role** (§2.9).

Existing P23.12 and P23.13 iconography should be retained. Protected Plan authoring silhouettes stay protected. General shell icons should be normalized around the existing visual family rather than replaced wholesale with a new icon library.

---

# 8. Domain Spine

The 56 px vertical Spine is the exclusive home of the primary domain axis.

It contains two persistent stations:

- Scene;
- Camera.

The active station receives a restrained **3 px inboard edge-light** using the domain accent.

Ratified station outcome (R3; §7.5): **74 px** station, **11 px** label set in the
domain's own casing (`Scene` / `Camera` — not an engraved uppercase token), **24 px**
icon, and a recess → panel-raised step when active alongside the 3 px edge-light.

Do not use full-surface domain-color fills.

Do not put Settings, Assets, Help or unrelated utilities into the reserved lower Spine merely because space exists.

The empty lower Spine is deliberate breathing room and future capacity, not an invitation to toolbar accretion.

---

# 9. Project Head

The Project Head is approximately 36 px high and remains compact.

It holds project/global context such as:

`Projects → project name → session state → Undo/Redo → save state → Spatial / Publish → Preview → Theme → Account → Help`

Spatial and Publish are independent chassis actions, not one segmented control.

Ratified Head outcomes (R3; §7.5): the project identity is the **14 px identity
role**, the band's controls sit on the **`md` control role** (26 px, 9 px padding),
and the band keeps compact spacing. The Head stays 36 px — identity may never be
grown by inflating the band.

Do not create a second global toolbar.

---

# 10. View Bar

The View Bar spans only the central work column.

Plan and 3D are engraved view tabs integrated into the Chassis. They must not look like ordinary tool buttons.

Scene Plan exposes the subordinate mode control as **`MODE   Layout | Arrange`**
(ratified grammar, §0.2):

- `MODE` is a quiet, **non-interactive caption** in the engraved/muted tier with a
  clear gap before the pair. It is **not** a third segment and not a control.
- The wrapper carries **no enclosing control fill, no border, no radius and no padding**
  that would let the three read as one capsule. Only `Layout` and `Arrange` carry button
  chrome — 11 px type on the 24 px `sm` control role.
- Tool groups inside the bar are separated by **space only**; there are no divider rules
  between groups.

Utility controls such as Snap, Grid, route visibility and Panels live in the same horizontal work-context region but are visually subordinate to the durable view tabs, at the **10 px utility tier**.

The View Bar must not extend over Navigator or Inspector.

The View Bar is the **single owner** of the workspace utilities and the View menu (§2.12): Panels,
Snap, Grid, route visibility, the camera Path/Frame helper toggles and the menu itself each have
exactly one writable control, and the View menu must not repeat an affordance the bar already
exposes directly. Progressive density in a squeezed centre column (§22.1) may hide a utility but
must not create a second copy of it elsewhere.

---

# 11. Tool Tray

The Tool Tray is a **44 px vertical instrument rail attached directly to the Paper edge**.

It is not a second sidebar and must not become one.

The tray paints the **tool vocabulary only** (`SELECT / TRANSFORM / SPACE / OBJECTS`) and owns no
View Bar menu or utility, even though both hosts mount the same toolbar component (§2.12). Its
host decides that; individual buttons must not be conditionally hidden to fake it.

## 11.1 Ratified rail geometry and type (R1)

- The rail stays **44 px**; rail tool buttons remain approximately **42 px** within it.
- Engraved group tier **7 px**; tool label tier **8 px** (§7.3).
- **Compact floor 6 px** only where a group word physically cannot fit the rail,
  opt-in per group; `TRANSFORM` is the known case.
- Group labels are persistent; tools are compact and icon-led.
- A group name is never broken mid-word merely to preserve a historical font size
  (§0.2, §2.10).

Open product calls, not settled here (§0.3): a **wider rail**, or **renaming the
`TRANSFORM` group**. Keyboard focus is **not** part of this ratification — it is a
separate state (§18.1).

## 11.2 Ratified armed state (R2)

- Armed = **one material step darker / recessed**. Hover = a **perceptual lift**.
- **Full normal ink** when armed.
- **No amber outline, no 3 px accent edge, no label-weight jump.**
- Armed remains legible **without hue**: it is a luminance step, so it survives a
  monochrome frame and — being the opposite direction from hover — cannot be mistaken
  for it.
- `--editor-armed` remains available for other surfaces; the rail does not have to
  spend it.

## 11.3 Representative groups

### Scene Plan

- DRAW: Wall, Rect Room, Poly Room
- OPENINGS: Door, Window
- OBJECTS: Place, Display, Sculpture, Seating, Platform, Column

### Scene 3D

- SELECT
- TRANSFORM: Move, Rotate, Scale
- SPACE: Local, World
- OBJECTS: relevant placement actions

### Camera Plan

- CAMERA: Select, Add Camera, Connect, Sequence, Play

### Camera 3D

- CAMERA: Select, Move, Look At, Play

The exact tool list remains subject to product capability, but the rail grammar and density do not.

---

# 12. Navigator — recursive spatial hierarchy

This is the largest intentional evolution beyond Designer A’s original proposal.

The Navigator is **not** a flat inventory and **not** a filesystem.

It presents two related structures:

1. **canonical spatial containment**;
2. **contextual projections** of entities relevant to that spatial context.

## 12.1 Future-facing containment model

The hierarchy must support structures such as:

`Site → Building → Floor → Room/Space → Content`

and more generally:

`container → child container → child container → entities`

The product must not permanently hard-code “Museum → Rooms” as the only useful organization.

Examples that should fit without a shell redesign:

- Museum → Floor → Gallery;
- House → Floor → Room;
- Campus → Building → Floor → Exhibition Wing → Gallery;
- future user-defined spatial containers if introduced later.

## 12.2 Contextual projections

A Room/Space may expose contextual groups such as:

- Architecture;
- Walls;
- Openings;
- Junctions;
- Content;
- Scene References;
- future typed relationships.

Visual nesting does **not** by itself establish canonical ownership.

Example:

`Gallery North → Architecture → Walls → W-FJSK`

means “show the canonical wall relevant to Gallery North,” not necessarily “Gallery North owns this wall.”

A shared wall may appear through multiple Room/Space contexts while resolving to the same canonical entity, reference, name and selection.

This principle must remain true for future multi-floor and cross-context features.

## 12.3 Row species

The Navigator must visually distinguish:

1. spatial/container entity;
2. ordinary entity;
3. typed group heading;
4. contextual/reference occurrence;
5. relation metadata;
6. authored empty/teaching state.

Group rows such as Architecture, Walls or Content must not masquerade as ordinary selectable domain entities unless they actually become real domain entities.

## 12.4 Identity presentation

Named entities lead with name and preserve the complete compact reference.

Unnamed Wall/Opening/Junction entities may lead with reference according to P23.12.

References never truncate.

Names may ellipsize under pressure, but the Inspector must expose the full name.

## 12.5 Depth and density

Deep hierarchy must remain usable at 268 px reference width.

Use shallow indentation—approximately 10–12 px per level—not oversized folder-tree indentation.

As depth increases, preserve:

- disclosure affordance;
- entity kind cues;
- useful name excerpt;
- full compact reference;
- active selection;
- search/reveal context.

Metadata and decorative counts degrade before identity.

Ratified row outcomes (R3; §7.5): **29 px** row, **12 px** row text (`--editor-type-row`),
**10 px mono** reference in the protected slot, **18 px** disclosure affordance with a
26 px target. Reuse the row role and the fitted-geometry role — never a literal (§2.9).

---

# 13. Inspector

The Inspector remains property-first.

It is not a dashboard, tutorial, project summary or documentation surface.

The top selection header should expose:

- type icon;
- name or reference;
- secondary reference when named;
- kind.

Sections follow entity semantics, for example:

- Geometry;
- Transform;
- Placement;
- Identity;
- Relationships;
- Lens;
- Sequence;
- Actions.

Consequential/destructive actions come last.

P23.12 rename authority remains Inspector-owned.Technical/raw canonical IDs remain behind the P23.12 Technical details disclosure rather than leaking into normal identity surfaces.

## 13.1 Section headings and property tiers

Section headings use the **engraved role** — 10 px / 600 / ≈ +0.04em, muted, uppercase —
and property rows use the standard label tier (12 px) with values at the 13 px property
tier in the mono/sans voice the field requires (§7.5). The selection header's title is
the panel-heading role.

**Carried implementation note (not design):** the Inspector family still pins some of
its 12 px / 12.5 px tiers because an earlier slice's contract pins them across nine
components. That migration is implementation debt (§0.4) — it does not license new
literals in that panel, and it changes nothing here.

---


# 14. Status Rail

The Status Rail is approximately 24 px high and is **readout-only**.

It may report:

- current domain and view;
- current selection/reference;
- save state;
- grid/snap/metric state;
- coordinates or other low-noise work-state readouts.

It must not duplicate toolbar actions.

One fact should have one authoritative control owner. Status may passively echo a fact but should not create a second control.

Ratified rail outcomes (R3; §7.5): **10 px** status role, **12 px** side padding,
**≈ 20 px** inter-item gaps, and the readable secondary ink tier — quietness comes from
weight and size, never from under-contrast ink.

---

# 15. Scene states

## 15.1 Scene / Plan / Layout

The Plan remains the strongest demonstration of PLATE:

- landed P23.13 Plan Paper `#F5F7F8`;
- cool Chassis;
- vertical Scene domain station;
- horizontal Plan view tab;
- vertical Tool Tray;
- recursive Navigator;
- property-first Inspector.

P23.13 owns architectural Plan representation. P23.14 owns the surrounding shell and state language.

Selection must reconcile across Navigator, Plan, Inspector and Status.

## 15.2 Scene / Plan / Arrange

Arrange remains a subordinate Scene Plan local mode, not a new top-level view.

## 15.3 Scene / 3D

Switching Plan → 3D must feel like changing the representation of the same work, not launching a different application.

The shell, Navigator and Inspector stay stable. The Tool Tray vocabulary changes to 3D-relevant instruments.

The 3D viewport remains an editor Paper surface—not a visitor presentation mode.

---

# 16. Camera states

Camera uses the same shell grammar but changes work ownership and content.

## 16.1 Camera / Plan

Scene architecture is passive spatial context.

The Camera graph/sequence overlays receive attention priority.

Camera Plan may show:

- camera nodes;
- route/sequence;
- direction;
- selected camera;
- ordering.

It must **not** show a finite FOV/frustum cone.

Any Camera Graph shown beneath a Floor/Space in the Navigator is a contextual presentation unless/until a separate product contract establishes canonical ownership. Do not infer that a tour or sequence is permanently owned by one floor; future tours may cross floors.

## 16.2 Camera / 3D

A finite frustum for the selected camera is appropriate in Camera 3D.

Route context may remain visible when useful.

The viewport remains an editor view.

---

# 17. Camera Drawer and Timeline

The Camera Drawer belongs to the Camera domain and spans the central work column only.

## 17.1 Collapsed

Reference height: **48 px**.

Show compact sequence transport/readout only.

No fake lanes. No ruler.

## 17.2 Expanded

Reference height: **288 px**.

Use exactly these five semantic lanes, in this order:

1. Camera Path
2. Shots
3. FOV
4. Look At
5. Roll

The Timeline must feel native to the same PLATE instrument system.

Do not introduce:

- audio tracks;
- object-animation tracks;
- generic video-editor track taxonomies;
- storyboard-thumbnail substitution for the semantic lanes;
- duplicate scrubbers.

Roll is a quiet compressed summary row, explicitly showing 0° when unchanged. It should not look like a waveform.

No-flow, edge and sequence states are states of the same Camera surface, not separate products.

---

# 18. Selection and state language

The visual system must clearly distinguish at minimum:

- hover;
- selected;
- primary selection;
- keyboard focus;
- active domain;
- active durable view;
- active local mode;
- armed tool;
- disabled;
- refusal/invalid;
- warning;
- destructive action;
- preview/ghost;
- snap/guide;
- authored versus derived information.

Do not overload selection blue to mean every state.

Do not depend on hue alone.

## 18.1 Four surface states stay distinct (implementation-ratified)

| State | Cue |
| --- | --- |
| **hover** | perceptual **lift** (`--editor-bg-hover`) |
| **armed** | material **sink** (§11.2 — recess step, full ink) |
| **selected** | the selection grammar (accent edge + selection fill), shared with the viewport |
| **keyboard focus** | its **own independent** focus grammar (offset ring, `:focus-visible` only) |

Hover and armed are deliberately **opposite directions**, so they cannot be confused;
armed and pressed share the recess step, so a monochrome frame still separates them.

**Keyboard focus is not an armed, hover or selected cue.** It stays — it is the only
keyboard affordance in the shell — and any future change to it must preserve a visible,
non-hue keyboard cue (§0.3).

## 18.2 Pressed / toggled baseline

A pressed or toggled chrome control — the View Bar's utilities, the `MODE` pair, a
toggled tool — is painted with a **recessed material surface** (`--editor-bg-recess`), an
**edge border** in the state accent and an **inset bottom rule** (the Atlas's
`button[aria-pressed=true]` grammar).

This replaces the earlier translucent accent-soft wash, which left a pressed control on
the same surface and height as a resting one. An accent-tinted filled variant is an open
owner reconsideration (§0.3); do not invent a second pressed treatment elsewhere.

Selection coherence is a signature product behavior: Navigator ↔ viewport ↔ Inspector ↔ Timeline should feel like one identity moving through different representations.

---

# 19. Precision and guidance

Precision feedback should appear close to the gesture that caused it.

Examples:

- dimensions near selected/drawn geometry;
- snap indication at the snap location;
- refusal reason near the failed action when practical;
- numeric precision in Inspector or local direct-entry surfaces.

Do not make the Status Rail carry all precision communication.

Educational guidance should be contextual and authored:

- useful empty states;
- short reason text for refusal;
- labels that clarify hierarchy;
- concise context help where needed.

Do not turn the Inspector into documentation.

---

# 20. P24 pressure contract

P23.14 must not pre-design P24 behavior, but it must leave room for P24 without shell reinvention.

The Atlas should pressure-test at least:

- denser Scene content;
- multiple selected objects;
- object groups / staging relationships;
- richer Inspector property sets;
- materials and lights;
- larger Navigator inventories.

The shell should absorb these by contextual density and progressive disclosure, not by adding another permanent toolbar or dashboard.

---

# 21. P26 contextual-instrument contract

P23.14 must create a clear host for future contextual architectural instruments without deciding every P26 interaction today.

Future Section / Wall Elevation / Ceiling Focus should:

- enter from an existing durable view;
- replace or focus the central Paper surface;
- show their contextual identity visibly;
- retain domain context;
- retain selection coherence;
- expose an obvious return path to the owning durable view;
- avoid appearing as a third peer view beside Plan and 3D.

The Atlas should include at least one non-authoritative P26 stress specimen showing how a contextual instrument could occupy the shell while preserving this hierarchy.

This specimen is for pressure-testing only and must not invent P26 product semantics.

---

# 22. Responsive and density behavior

PLATE must survive professional density rather than only hero screenshots.

Required stress cases include:

- Navigator width 240–300 px;
- 3 floors;
- 8+ rooms/spaces per floor;
- 70+ walls total;
- deeply expanded Room/Space → Architecture → Walls branch;
- long authored names;
- duplicate names distinguished by references;
- a wall exposed from more than one Room/Space context;
- 8+ cameras;
- expanded 288 px Camera Timeline;
- smaller desktop height around 768 px;
- light and alternate-theme contrast checks if alternate themes remain.

Progressive density is preferred over disappearance.

When space tightens, remove or compress redundant metadata before hiding identity, selection or location.

## 22.1 Open seam — the squeezed View Bar (not settled)

Below roughly 300 px of centre-column width the View Bar's contextual region (a
`flex: 1; min-width: 0` container) clips its own children, so `Layout | Arrange` is cut
before anything else gives way. This is **unresolved** (§0.3). The shape of the fix is a
progressive-density rule keyed to the container — the way the Navigator sheds row
metadata — but no threshold is ratified here, so do not invent one.

## 22.2 Density order inside the shell

Where space tightens, the shedding order is: decorative/redundant metadata → captions
and secondary readouts (e.g. the `MODE` caption before its controls) → low-frequency
utilities. Identity, selection, the durable view tabs and the active tool are the last
things to compress, never the first.

---

# 23. Accessibility and motion

The Atlas and implementation must validate:

- keyboard navigation;
- visible focus independent from selection;
- accessible disclosure controls;
- accessible Inspector controls;
- non-hue-only state differences;
- readable contrast;
- reduced-motion behavior;
- pointer-target adequacy;
- coarse-pointer fallback where relevant.

Motion should reinforce hierarchy and continuity, not decorate the shell.

---

# 24. Explicit non-goals / rejected interpretations

P23.14 must not:

- turn Scene and Camera into separate applications;
- turn Plan/3D into a generic dropdown that hides the durable-view distinction;
- introduce Section/Elevation as a third durable peer view;
- move the Inspector into a dashboard role;
- make the Navigator a literal filesystem;
- infer canonical ownership from tree placement;
- permanently flatten Navigator into Rooms / Architecture / Placed Content sections;
- add a second global toolbar;
- widen the Tool Tray into another sidebar;
- turn Camera Timeline into a generic video editor;
- reopen P23.12 identity;
- redraw settled P23.13 Plan iconography without cause;
- make the old navy dark mode the default product identity;
- use theme color as the main source of hierarchy;
- add chrome simply because empty space exists;
- collapse hover, armed, selected and keyboard focus into one accent treatment (§18.1);
- remove the keyboard focus cue without replacing it with a non-hue keyboard affordance (§18.1);
- dress `MODE` as a third segment inside the `Layout | Arrange` capsule (§10);
- generalize the Tool Tray's 6 px compact floor to ordinary shell typography (§7.3);
- let a historical numeric value outrank the constraint it was meant to satisfy (§2.10).

---

# 25. Designer D — Atlas assignment

Designer D should now build or revise the interactive HTML Atlas against this document.

The Atlas is a **QA surface**, not a competing proposal.

Its job is to make the design falsifiable before implementation and during visual acceptance.

## 25.1 Required canonical specimens

The Atlas must include four high-fidelity canonical states:

### A. Scene / Plan / Layout

- recursive multi-floor Navigator;
- one expanded Space/Room → Architecture → Walls branch;
- selected wall using P23.12 identity;
- P23.13 Plan representation;
- property-first Inspector;
- landed P23.13 Plan Paper `#F5F7F8` / cool PLATE Chassis.

### B. Scene / 3D

Layout/Arrange remain Scene Plan local modes; Scene 3D has no parallel local-mode control.

- same shell geometry;
- same recursive hierarchy;
- selected Scene object;
- 3D transform instruments;
- no shell redesign between Plan and 3D.

### C. Camera / Plan / collapsed Drawer

- passive architecture;
- selected camera graph node;
- no finite frustum;
- collapsed 48 px Camera Drawer;
- Camera hierarchy uses the same Navigator grammar;
- any floor placement is explicitly contextual, not canonical ownership.

### D. Camera / 3D / expanded Drawer

- selected camera + finite frustum;
- expanded 288 px Drawer;
- exactly Camera Path / Shots / FOV / Look At / Roll;
- no generic video-editor tracks;
- coherent selection across Navigator / viewport / Inspector / Timeline.

## 25.2 Required stress specimens

The Atlas should also expose interactive stress toggles or dedicated fixtures for:

- deep multi-floor hierarchy;
- long names + complete compact references;
- duplicate names;
- same canonical Wall revealed in two Space contexts;
- 70+ wall density;
- 8+ cameras;
- expanded Timeline at reduced vertical height;
- empty state;
- disabled/refusal/warning/destructive states;
- keyboard focus;
- reduced motion;
- future P26 contextual-instrument host.

## 25.3 Atlas authority rule

The four owner-generated PLATE images may be used as visual orientation evidence for composition, warmth and intended density.

They are **not** pixel truth and must not be mined for accidental semantics.

Known examples of generator output that must not become product contracts include:

- arbitrary fixture IDs beyond ratified identity rules;
- Camera Graph appearing under a Floor as implied ownership;
- inconsistent utility-control order;
- generated room/wall relationship mistakes;
- exact typography/icon deviations from existing P23.12/P23.13 assets.

The Atlas should correct these against this document.

---

# 26. Acceptance criteria

P23.14 visual implementation is ready for acceptance when the Atlas and product make the following true simultaneously:

1. A user can identify project, domain, durable view, local mode and active tool without those ranks competing visually.
2. Scene/Camera remain visibly one product.
3. Plan/3D remain durable peers.
4. Paper, Chassis and Instrument are visually distinct without decorative excess.
5. The new PLATE Light theme is the canonical default and the old navy dark identity is no longer the product baseline.
6. Navigator supports recursive spatial containment and contextual projections without implying false ownership.
7. Multi-floor hierarchy does not require a new shell.
8. P23.12 identity remains intact through Navigator, Inspector, search and selection.
9. P23.13 Plan representation/iconography remains intact.
10. Selection is coherent across every visible surface.
11. Inspector stays property-first.
12. Status stays readout-only.
13. Camera Timeline remains Camera-owned and central-work-column aligned.
14. Camera Plan contains no finite frustum; Camera 3D may.
15. Expanded Camera Timeline uses exactly the five ratified semantic lanes.
16. P24 growth can be accommodated without adding permanent chrome.
17. P26 can enter as subordinate contextual instruments with a visible return path.
18. The shell survives dense, nested and reduced-height stress fixtures.
19. Keyboard, focus, contrast and reduced-motion checks pass.
20. The result still feels recognizably like Museum Editor—evolved, not replaced.

### 26.1 Post-implementation criteria (ratifications R1–R3)

The ratified implementation adds these acceptance criteria:

21. The Tool Tray paints its ratified tier — every group and tool label fits the 44 px
    rail's text box, `TRANSFORM` resolves at the compact floor, and no label breaks
    mid-word (§7.3, §11.1).
22. An armed tool reads as a material sink with full ink, without hue, and cannot be
    confused with hover (§11.2, §18.1).
23. No shell surface carries a pinned type or control value: each resolves through a role
    or a ladder step, and raising `--editor-type-scale` / `--editor-control-scale` at the
    document root scales type and control geometry respectively, independently (§7.2).
24. `MODE` reads as a caption rather than a third segment, and pressed View Bar controls
    use the recessed surface, edge border and inset rule (§10, §18.2).
25. Reconciling the shell with this document does **not** close P23.14: the slice stays
    under owner review until the owner says otherwise (§0.3).
26. Every writable shell fact has exactly one control owner per workspace, the Inspector
    presents one resolved target in both header and body, and a retained selection stays
    remembered across workspace switches (§2.12).

---

# 27. Final design statement

P23.14 should leave Museum Editor with a shell that is recognizable before its palette is visible.

Its signature is:

**spatial Paper (landed cool P23.13 Paper in Plan; warm PLATE Paper elsewhere) held inside a cool engineered Chassis, with compact Instruments attached directly to the work; Scene/Camera running vertically, Plan/3D running horizontally, and one coherent identity moving through Navigator, viewport, Inspector and Timeline.**

The Navigator scales from today’s Rooms to tomorrow’s Buildings, Floors, Spaces and contextual architecture without confusing navigation with ownership.

The new PLATE Light theme becomes the default face of the product. Existing P23.12 identity and P23.13 drafting/iconography remain foundations rather than collateral damage from polish.

This is the direction Designer D should now make concrete and falsifiable in the Atlas.
