# P23.14 — owner ratifications & durable design authority

```text
DATE:    2026-09-19 · branch `p23.14` · PR #61
STATUS:  R1–R3 ratified and landed; the P23.14 slice itself stays OPEN for owner review
AUTHORITY RECORD: this file is the reference for what the owner decided and why
```

**Owner authority.** Everything in §3 is an owner decision, not an implementation
preference. §2 records why the shell drifted in the first place, because the
drift is the reason these decisions were needed.

---

## 1. Authority after P23.14 — what later phases build on

The owner has promoted the P23.14 design to the durable, stable baseline:

- **[`final-direction.md`](./final-direction.md)** — the ratified designer
  contract — plus **[`atlas/`](./atlas/)** (the PLATE reference composition) are
  the **durable design authority for the editor shell**. Later phases —
  P23.15, P23.16, P24, P26 — fit *into* this grammar and may depend on it. They
  do not re-decide it, and they do not re-derive it from an older document.
- The pre-P23.14 shell contracts remain canonical for what they actually own:
  **capability, ownership, exposure, and the frozen Plan-ink / iconography /
  display-identity contracts** (`docs/reference/design-system/design-specs.md`,
  `docs/reference/design-system/design-shell-specs.md`,
  `docs/reference/components/shell.md`). Their **shell placement, dimension and
  type** sections are now **descriptive of the landed PLATE system**; they are
  not the source of new shell design.
- **Conflict order inside the shell:** `final-direction.md` wins over the Atlas;
  the Atlas wins over the reference docs' older shell numbers; the reference
  docs win on capability/ownership. The Atlas stays QA evidence throughout —
  never topology, validation or numeric-acceptance authority
  ([`atlas/p23.13-p23.14-atlas-reconciliation.md`](./atlas/p23.13-p23.14-atlas-reconciliation.md)).
- **The type + control SYSTEM is R3 (below):** the shell's sizes live in
  `styles/tokens.css` as the ladder + role layer, with two knobs
  (`--editor-type-scale`, `--editor-control-scale`). `design-specs.md` §6/§7's
  numeric type values and §12's dense-control metrics are now **descriptive of
  the landed ramp**, not an authority to implement against; a future surface
  asks for a role, and a future phase that needs a different size changes the
  role, not the surface.
- **Frozen by this promotion:** nothing new. P23.12 identity (R/W/O/J, rename
  Inspector-owned), the P23.13 Plan drafting ink and the retained icon
  silhouettes keep their existing freeze; the seven-surround contract and the
  `--editor-plan-*` palette still move only by explicit owner re-ratification.

---

## 2. Why the shell drifted — root cause, on the record

The drift was not carelessness in one file; it was two structural traps. Both
are recorded because later phases will hit the same two.

**2.1 The old shell was the only written authority for the new shell's numbers.**
`design-specs.md` §6's type scale and §22's *"10 px engraved group labels"* were
written for the shell that existed before P23.14: a 32 px workspace ribbon plus a
floating viewport toolbar, where a group label had hundreds of pixels of width
and no rail to fit into. P23.14 then replaced that geometry with §11's **44 px
Paper-attached Tool Tray** — a new, very narrow container — without a new type
rule for it. So the only tray-adjacent numbers available to an implementer were
the old ones, and §7's hierarchy (explicitly *approximate*) got read as a hard
floor while §22's 10 px got read as the tray's label size.

The arithmetic could never have worked. Measured live at 10 px/600 against the
widest text box a 44 px rail can give a label (39 px):

| size | group labels wider than the box | tool words wider than the box |
| --- | --- | --- |
| 10 px | SELECT, OPENINGS, OBJECTS, TRANSFORM, CAMERA — 46.6–63.8 px | Window, Platform, Sculpture, Connect, Sequence — 39.5–48.6 px |
| 9 px | OPENINGS, OBJECTS, TRANSFORM, CAMERA — 39.1–57.4 px | Sculpture, Sequence — 42–43.7 px |
| 8 px | OPENINGS, TRANSFORM — 41.7 / 51 px | Sequence — 38.8 px |
| 7 px | TRANSFORM — 44.7 px | none |

Every one of those labels therefore broke **inside the word** (`SELEC / T`,
`OPENI / NGS`, `OBJEC / TS`, `Windo / w`, `Colum / n`, `Platfor / m`). A type
tier cannot be inherited across a 6× change in container width; that is the
lesson, and it is why R1 names the tray's tier explicitly instead of pointing at
§7.

**2.2 The tray is not a new component, it is an old component in a new box.**
The rail renders *the same toolbar components* the View Bar renders, in a `tray`
presentation. Every component-scoped rule written for the View Bar therefore
keeps applying inside the rail until the shell scope overrides it, and the
failures are silent — they only show up as layout damage. The specific leaks:

- `EditorViewportToolbar`'s own `white-space: nowrap` (a correct View Bar
  contract — a 34 px bar must not wrap) is inherited into the tray, so Camera
  3D's `Add camera` painted **46 px wide inside a 39 px box** and overran the
  rail into the Paper. The generic labels that did wrap only did so because
  their components happened not to set `nowrap`.
- `LayoutDraftToolbar`'s floating-mount chrome (`position: absolute`, shadows,
  inline-flex rows) is dropped by the tray presentation, but its *inline* button
  grammar survived until the shell-scoped rail rules took over.

Rule this implies for later phases: **a `tray` presentation must override every
layout-bearing rule from the View Bar scope explicitly**, and a shell-scoped test
must pin the result, because the failure mode is invisible to the component's own
tests.

**2.3 The armed cue came from the same place.** The old contract listed
`--editor-armed` as the *tray rail fill*, so the armed tool reached for an amber
border plus a 3 px inboard edge to satisfy §18's "never hue alone". That is a
hue cue with redundant non-hue cues bolted on — the inverse of §18's intent —
and it was also the loudest thing in a 44 px rail. R2 replaces it.

**2.4 What made it visible.** The owner compared the rail against the PLATE
reference PNGs and the Atlas and reported the drift directly; the rail's labels
were breaking and the armed border read as a highlight. Before that the QA pass
had recorded the 10 px rule as *fixed*, with a test pinning it — a documented
number, in a test, that encoded the wrong authority. **A pinned number is only as
good as the authority it was pinned from.**

---

## 3. Owner ratifications

### R1 — the Tool Tray's engraved tier (supersedes §7's 10 px *for the rail only*)

**Decided:** the rail paints the reference's engraved micro-tier — **7 px group
label / 8 px tool label** — and a group word that is wider than the rail steps
down to a **6 px compact floor** instead of breaking mid-word. This deliberately
departs from §7's `10 px: engraved/group labels`, because that tier cannot fit
§11's own 44 px rail (§2.1). §7's 10 px tier keeps every other engraved label in
the shell (Inspector section headers, Navigator group bands, panel eyebrows).

**Why this and not the alternatives:** §7 calls its own hierarchy *approximate*;
§11 asks only for "small persistent group labels and compact icon-led tools";
and 7 px / 8 px is exactly what the PLATE reference PNGs and the Atlas rail
paint. The word is kept — `TRANSFORM` is the group name §11 itself uses, so
renaming it to fit would have contradicted the spec this record promotes.
Tightening tracking to squeeze 44.7 px into 41 px was rejected: it buys
0.2 px of margin, and the platform font fallback moves text metrics by several
percent, so the fix has to hold when Inter Variable is not the font that renders.

**Landed as:** `--editor-font-size-tray-group: 7px`,
`--editor-font-size-tray-tool: 8px`,
`--editor-font-size-tray-group-compact: 6px`; the compact step is opt-in per
group (`data-group-compact` on the TRANSFORM group in
`EditorViewportToolbar.svelte`), never a property of the tier. Geometry: the rail
stays `44 px` and buttons stay `42 px` tall; the gutter tightened `3 px → 1 px`
and the control stretches to the rail (`width: 100%`), which is what turns a
36 px text box into the 39 px one the 8 px labels are measured against.
`white-space: normal` is added **in the shell scope only**.

**Evidence it holds:** live DOM measurements in all four reachable tray
vocabularies (Scene Plan, Scene 3D, Camera 3D, Camera Plan) — tray
`scrollWidth == clientWidth` (43 px), every label on one line except the
two-word labels, which wrap at their word boundary. Pinned by
`tests/lib/editor/app/p23-14-contrast-floor.test.ts`.

### R2 — the armed tool is a darkened surface, nothing else

**Decided:** selecting a tool shows **the darken state only**. The amber border
and the 3 px inboard edge are removed; the label weight step went with them.
An armed tool now sinks one material step into the rail.

**Why:** the owner read the amber border as a highlight fighting the tool's own
selection, and the rail is 44 px wide — the cue does not need three channels.
The darken still satisfies §18 in the strongest form: it is not hue at all, it is
a luminance step, so a monochrome frame separates armed from resting. Removing
the weight step also removed a real fragility (the armed 700 weight was within
0.2 px of the longest tool word's box).

**Landed as:** `.tool-tray button.active { background: var(--editor-bg-recess);
border-color: transparent; box-shadow: none; color: var(--editor-text-primary) }`
— the recess tone is the material step the Domain Spine trough already uses, so
the armed tool reads as *sunk into* the rail while hover *lifts*
(`--editor-bg-hover`); the two steps are opposite directions and cannot be
confused. `--editor-armed` is **retained** in the §6 palette for surfaces that
want an armed hue; the tray simply no longer spends it. Pinned by the same test
suite, which asserts the `.active` rule cannot reach for the armed hue again.

**One thing R2 does not remove, stated so it can be corrected:** the **keyboard
focus ring** (`--editor-focus-ring`, `:focus-visible`, painted outside the
control's box) is a different cue from the highlight border and stays. It is
required for keyboard reachability (§7 / review #33) and it only appears for
keyboard focus, never for a pointer click. If the owner meant the ring as well,
that is a separate ratification and needs a replacement keyboard cue.

### R3 — one type scale and one control scale, expressed as roles

**Decided:** the shell stops carrying its own numbers. Every size in it is either
a **role** (`--editor-type-*`, `--editor-control-*`, the icon/geometry roles) or
a **ladder step** (`--editor-font-size-2xs` … `-2xl`, seven steps and no more),
and every one of those is a multiple of **one knob**:

| knob | multiplies | ratified value |
| --- | --- | --- |
| `--editor-type-scale` | every type size in the product | `1` = 100 % |
| `--editor-control-scale` | every button height/padding and the fitted group geometry | `1` = 100 % |

**Why:** the drift this slice exists to fix was not one wrong number, it was
that *each surface carried its own*. §7's flat ramp
(16/14/13/12.5/11.5) was largely **dead** — nothing consumed `title`,
`panel-title`, `toolbar`, `tree-row` or `status` — so components wrote
`font-size: 0.68rem` instead, in seventeen different values between 9.6 px and
13.6 px, and no two surfaces agreed. A role layer is what makes the Atlas
comparison converge *and stay converged*: the reference metrics are retuned in
one file instead of in fifty components, and a future review can change the whole
shell's size with one number.

**The percentage knob, and the one cascade fact that goes with it.**
`--editor-type-scale` is unitless (CSS cannot multiply a length by a percentage
token, so a factor is the only form a single knob can take) and documented as a
percentage: `1` = 100 %, `1.15` = 115 %. It must be set on **`:root`** — a theme
block, or inline on `document.documentElement` — because a token derived from
another token is a **snapshot taken at its declaring element**: the ladder
declares `calc(10px * var(--editor-type-scale))` at `:root`, so an override
further down the tree cannot re-derive it. Verified live: setting the knob on
`document.documentElement` moves status 10 → 11.5 px, stations 11 → 12.65 px,
Navigator rows 12 → 13.8 px, the identity 14 → 16.1 px and the rail 44 → 51 px
together, with `--editor-control-scale: 1.2` moving station height 74 → 89 px
and rail tools 42 → 50 px while the type stays put (the knobs are deliberately
independent: "denser buttons" and "bigger type" are different requests).

**What the Atlas comparison actually changed** (the drifted values, now roles):

| surface | was | now |
| --- | --- | --- |
| View Bar controls | 28 px enclosed troughs, 12 px labels, accent-soft fill | 24 px plain buttons, 10 px utility / 11 px MODE labels, edge border + inset bottom rule when pressed |
| Head (Project Row) | 12 px controls, 13 px identity | 26 px controls (`--editor-type-control`), 14 px identity role |
| Domain Spine station | 72 px, 10 px uppercase tracked label | 74 px, 11 px label in the domain's own casing (`Scene`/`Camera`, §8), 24 px icon |
| Navigator rows | 2 rem rows, 0.74 rem labels, 0.62 rem meta | 29 px rows, the row role (12 px) and the mono ref role (10 px) |
| Inspector section headers | 11 px/600/+0.05em | the engraved role (10 px/600/+0.04em, Atlas `.section h3`) |
| Timeline ruler | 11 px sans | the tick role: 9 px **mono** (a measure, not prose) |
| Status Rail | 11 px, 8 px padding, 0.9 rem gaps | the status role (10 px), 12 px padding, 20 px gaps |
| Tool Tray | loose px in rules | the tray roles + `--editor-tray-*` geometry |

**Landed as:** `styles/tokens.css` (the ladder, the role table, the icon and
fitted-geometry roles, the migration mapping), `styles/controls.css` +
`styles/inspector.css` + `styles/timeline.css` (token layer as roles; the
pre-R3 generic control names kept as **aliases** so either vocabulary moves with
the same knob), and the shell surfaces swept onto roles (`WorkspaceRibbon`,
`ProjectRow`, `StatusBar`, `DomainSpine`, `CameraSidebar`, `EditorSidebar`,
`HierarchyRow`, `HierarchyNavigator`, `UnifiedProjectTree`,
`EditorViewportToolbar`).

**Evidence it holds:** `tests/lib/editor/app/p23-14-type-roles.test.ts` — the
ladder is closed (every `--editor-font-size-*` is a multiple of the knob or a
named alias onto a step), every type role resolves its size to a step, the
control/geometry roles resolve to their knob, and a **guard** fails if any swept
surface reintroduces a pinned `font:`/`font-size:` value. That guard is the
point: it is how this cannot come back silently.

**What R3 does not yet cover, on the record:** the **Inspector family**
(`EditorInspector.svelte` plus the eight panel inspectors) still carries pinned
sizes, because P21.5 Slice 4 pins its 12 px label / 12.5 px value tiers across
all nine components; converting them is a mechanical batch with the mapping
table in `tokens.css`, and it is deliberately left as one reviewable change
rather than half-migrated here.

### Carried rulings, unchanged by R1–R2

D1–D4 (the measured ink floor: darkened muted, the `--editor-text-success/-warning`
text siblings, the darkened domain/armed hues, the focus ring's real ratio) stand
as ratified in the QA record. R1–R2 change the tray's type and armed treatment
only; no other shell surface moved.

---

## 4. Where each decision is enforced

| Decision | Rule | Contract test |
| --- | --- | --- |
| R1 tray tier | `styles/tokens.css` (`--editor-font-size-tray-*`), `styles/controls.css` (`.tool-tray` type + gutter), `EditorViewportToolbar.svelte` (`data-group-compact`) | `p23-14-contrast-floor.test.ts` § "tray engraved micro-tier" |
| R2 armed surface | `styles/controls.css` (`.tool-tray button.active`) | `p23-14-contrast-floor.test.ts` § "armed tool is a darkened surface" |
| R3 type + control roles | `styles/tokens.css` (ladder, roles, knobs), `styles/controls.css`, `styles/inspector.css`, `styles/timeline.css` + the swept shell surfaces | `p23-14-type-roles.test.ts` (closed ladder, role resolution, no-pinned-type guard) |
| Ratified ink floor | `styles/tokens.css` + the `-text-*` consumers | `p23-14-contrast-floor.test.ts` § F1/D1–D4 |
| Atlas reflects both | `atlas/index.html` tools rail, `atlas/notes.md` | QA evidence, not a contract |

---

## 5. What this record does **not** close

- The P23.14 slice stays **open for owner review** — these are ratified
  *decisions*, not a slice closeout. `README.md` and
  `docs/operations/current.md` keep the review-pending status.
- **F1** (Scene workspaces can mount the Camera node editor), **F2** (Inspector
  header vs body can describe different selections), **F4** (numeric fields
  report `:invalid` while holding legal values) and **F5** (`POV / Observer`
  duplicated in Camera 3D) remain open owner calls.
- Device, screen-reader, `prefers-reduced-motion` and coarse-pointer rows remain
  **manual-owed**.
- Content-visibility items (a *wider* rail, or a renamed `TRANSFORM` group) are
  owner product calls, not shell fixes; R1 deliberately keeps the spec's own
  vocabulary and the spec's own rail width.
