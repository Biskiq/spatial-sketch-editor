# P23.14 — Index House / Sidecar Studio

Independent concept exploration · 17 September 2026 · no direction selected.

Open [the comparison board](./index.html). Switch between both concepts and canonical states A–F; E has four Timeline specimens. Also test 240 px rails, both panels collapsed, and grayscale. The specimens share content and a 1440 × 900 reference window. Review controls work; the depicted editor is intentionally not an authoring prototype.

## Position

Museum Editor should make the relation between **what exists, what I am doing, and what I can change** tangible. Richness should come from visible instruments and specific content, with sufficient surface variation to distinguish those three questions. Warmth should come from humane typography, understandable consequences, and a sense that the space being made matters.

I challenge two possible readings of the research. First, a rank ladder does not require a stack of increasingly small horizontal bars: spatial position can do much of that work. Second, synchronized selection is necessary but not enough to be the product identity. Many editors have it. Here, identity comes from a repeatable composition around that behavior: a **bound index and property ledger** in one concept, a **divided reference column beside a broad stage** in the other.

These are not alternatives from the research’s five-territory menu. They differ in eye movement, allocation of space, educational model and density failure mode. Palette changes cannot turn one into the other.

## Authority and evidence

Read in order: [designer brief](../../briefs/p23.14-designer-brief.md), [authoritative context](../../../context/shell-design-context.md), [research synthesis](../../../../../../../roadmap/p23-layout-depth/p23.14-shell-visual-system/research/editor-shell-visual-system.md). All five context screenshots were inspected. They establish existing control inventories and selection behavior, not composition targets. The settled [P23.13 drawing tokens and identity language](../../../../P23.13-final-design-specification-Designer-D.md) are inherited.

Research used: stable landmarks (§3.1), contextual command layers (§3.3), dense panels (§3.4), education at uncertainty (§3.5), and Timeline integration (§3.6). The underlying tool precedents were supplied in that synthesis; this exploration makes no new claim about their current interfaces and adds no broad precedent research.

The context describes Row 2 as durable in role/location (§3), yet explicitly frees the two-row arrangement (§10). Interpretation: keep tools **docked in the workspace header**, never resurrect an in-canvas floating toolbar; allow domain controls and panels to move. If “Row 2” means an exact global row rather than this role, Sidecar needs an owner scope ruling. Neither concept needs a parallel tool path.

The brief’s narrative screenshot numbering is inconsistent with the actual captures: image 03 shows Camera Plan, 04 Camera 3D. Canonical A–F and the context’s scope rules govern here.

## Concept 1 — Index House

### Thesis and signature

A museum’s working index made spatial: the things in the project are on one side, the selected thing’s editable particulars on the other, and the work occupies the centre. A broad **bound domain tab** grows out of the Navigator edge. The tab’s warm top seam, the Inspector’s selection seam, and the labelled work shelf form the signature. It should feel like a carefully made professional instrument, with the hospitality of a good reading room rather than the solemnity of a technical console.

A newcomer can infer “find here, work here, change this here” without understanding CAD. Expertise adds depth to stable places rather than adding more chrome ranks.

### Composition

```text
PROJECT  identity · document · shared history · visitor preview · save
┌ SCENE / CAMERA ┬ VIEW ▾ │ local mode │ tool shelf ───── utilities ┐
│                │                                                │
│ Navigator      │              spatial canvas       │ Inspector  │
│ groups / names │                                   │ owner      │
│ complete refs  │                                   │ identity   │
│                │                                   │ properties │
│                ├ Camera Timeline, if Camera ────────┤            │
└────────────────┴───────────────────────────────────┴────────────┘
STATUS  current operation · relevant keyboard hint · units
```

- Persistent: 46 px project frame, 64 px workspace shelf, opposing rails, 28 px status line, utility anchor at the canvas lower right. Default Navigator 264 px (minimum 240), Inspector 304 px. At the reference size the canvas is 872 px wide and 762 px high without a Timeline.
- Scene/Camera: large architectural tabs with a top seam; changing attention never moves the view or clears selection/history.
- Plan/3D: a labelled `View` menu, with the current view as its large value. Both views are direct choices in that menu, not extra documents. This consciously adds one opening action versus two always-visible buttons; the gain is a view container that can hold subordinate instruments later.
- Layout/Arrange: a narrow vertical pair in the shelf, below domain rank, beside tools. It disappears outside Scene Plan. This is the local working stance, not a page tab.
- Tools: compact labelled actions; active tool uses dark fill and a warm bottom latch. Protected Plan icons keep their originals. The concept drawings omit those five icon pictures rather than redesign their silhouettes; non-protected examples reuse repo paths where available.
- Contextual: tool contents, property sections, Camera Navigator, Timeline, warnings and gesture reasons. None may push or recenter the camera.
- Assets remain a Navigator tab, understood as a catalogue rather than a second inventory. Switching to Assets does not change selection; the selection footer can reveal the selected entity in Hierarchy.
- New capability enters a named section, tool family or subordinate view context, not a new top-level bar.

### Visual system

| Role | Decision |
|---|---|
| Frame | Aubergine `#412D4E`; bounded global and domain identity |
| Rails / property paper | Mineral lilac `#EEE9F1` / porcelain `#FDFBFD` |
| Text / secondary | `#332B39` / `#665B6E` |
| Structural line | `#BDB1C4`, 1 px internal divisions; no individual property cards |
| Signature | Warm binding `#C8B393`; never selection, snap or validity |
| Type | Optima for domain/selected-entity headings, Avenir Next for labels, SF Mono or system monospace for references and precision values |
| Scale | 21/24 selected title; 17/21 domain; 13/18 panel; 12/16 controls; 11/15 references |
| Density | 30 px entity rows; 35 px properties; 8/12/16 px group rhythm; 4 px control radius, 6 px domain tab radius |
| Elevation | Flat primary regions; one small shadow only for a live popover, never a stack of floating cards |
| Motion | 120–160 ms panel/disclosure continuity, no canvas motion induced by a domain switch; zero positional animation with reduced motion |

Drawing paper remains `#F5F7F8`, mass `#343C43`, selection `#2F8CFF`/`#145DA8`, snap `#146D68`, invalid `#9B3149`, and keyboard focus the inherited dark double outline on paper knockout. These are not theme branding colors.

### Navigator and Inspector

Entity rows have an icon slot, authored name, and separate full canonical reference. No serial numbering invented by the shell. At 240 px, a long name wraps to a second line; the reference moves beneath it if necessary, never ellipsizes. Group headings have disclosure and a count, not entity selection treatment. Relations do not occupy fake entity rows: omit `Ends …` from ordinary disclosures; show selected-wall relationships as read-only Inspector values.

Inspector begins with **document owner → entity identity → properties**. No project inventory or architectural manifesto. Identity, Geometry/Transform, Relationships, and read-only results use one section grammar. Expanded sections stack, with optional solo expansion for deep future property sets; their order does not reshuffle after edits. A selection change preserves section openness by section kind. Returning to a prior entity restores its scroll anchor only if the section still exists. A clearly separated action tail carries consequential actions.

### Education

Index House teaches by adjacency. Units sit beside values. Owner sits directly above them. `?` beside a section and F1 on a focused control reveal an anchored explanation with one sentence, one concrete example and any consequence. Nothing opens merely because the mouse crosses the surface.

A disabled control remains focusable through the control group with `aria-disabled`; focus or click opens its reason. Example: Save to Cloud in a guest session explains “Sign in to save this local project to your account.” It does not imply autosave. Save aggregation includes both documents.

A gesture rejection remains near the drawing above the status line. Inspector values continue to show committed state. The explanation says what was refused, why, and what can be tried. It is not automatically repaired. An expanded no-flow Timeline uses its otherwise empty body for a short explanation, never dummy lanes or a loading skeleton.

### Extension slots

- P24: selection header can grow one line to hold `3 selected · Primary: Bronze study`; section headers show shared applicability. Common properties use the same rows with a readable `Mixed` value. This is a future specimen, not a multi-selection feature claim.
- P26: `View: Plan ▾` remains the base. Beneath its heading, the existing context line can carry `← Return to Plan · [contextual instrument] · [owner reference]`. The tool run changes locally; the project, domain, selection and world stay put. It is a host slot, not a proposal for Section controls or taxonomy.
- Theme survival: the domain binding, selection seams, label/value hierarchy and opposing panel roles remain when palette is removed. Use the board’s grayscale control to inspect this.

### Risks

The composition spends width on stable landmarks. At 1280 px, expanded Camera Timeline + both rails is tight; timeline lanes must scroll horizontally with sticky labels. At narrow widths do not auto-collapse panels or scale text. Offer explicit focus mode and retain panel restore controls. Lower-priority tool families enter a labelled `More tools` disclosure before core tools become icon-only.

Optima can look precious if used for field labels; restrict it to two heading ranks. Brass can look decorative if allowed into arbitrary separators; keep it on the active domain/tool latch. A selected + focused row needs two different contours, not a thicker blue border. The canvas must retain its selection contrast against both light and dark shell themes.

## Concept 2 — Sidecar Studio

### Thesis and signature

A broad spatial stage with a **single reference column**, divided into “what exists” and “what this selection can change.” Its identity is the deliberate seam where the lower property surface picks up the current selection from the upper inventory. The layout feels like working beside a companion desk: all supporting information is close together, and the model has room to breathe without hiding the editor.

This challenges the default assumption that professional means “tree left, properties right.” It remains instrumented and information-rich, but pays for canvas width with panel height.

### Composition

```text
PROJECT  identity · document · shared history · visitor preview · save
DOMAIN   SCENE / CAMERA ───────────────────────────────────────────
┌ Navigator ────────┬ VIEW ▾ │ local mode │ tools ─────── utilities ┐
│ tree + search     │                                            │
├ selection seam ───┤                  spatial canvas            │
│ Inspector         │                                            │
│ owner / identity  │                                            │
│ properties        ├ Camera Timeline, if Camera ─────────────────┤
└───────────────────┴────────────────────────────────────────────┘
STATUS  current operation · relevant keyboard hint · units
```

- Persistent: project frame 46 px; domain strip 42 px; reference column 300 px; stage tool shelf 58 px; status 28 px. Stage width is 1140 px at 1440. Scene canvas height is 726 px. Navigator is 316 px high, Inspector 468 px; both have independent scroll bodies and fixed identifying headers.
- Unlike Index House, Scene/Camera heads the **whole work area**. View and tools belong to the stage header. Panel headers do not masquerade as workspace tabs.
- Layout/Arrange remains the subordinate mode pair inside the docked shelf. Tools never float over the model. P26 uses the shelf’s same nested context slot.
- The Navigator/Inspector seam is not a wizard step. Selection changes its contents instantly; it never moves a row into another authority. Clicking an entity still resolves through the one selection store.
- Timeline aligns with the full stage, not with the total window. It belongs to Camera in Plan and 3D. The wider lane span is an intentional structural advantage.
- Both panels can be collapsed independently; collapsing Navigator gives its height to Inspector, and vice versa. Collapsing both removes the reference column. The board demonstrates the latter; the independent resize behavior is a concept proposal, not implemented interaction.

### Visual system

| Role | Decision |
|---|---|
| Frame / text | Deep petrol `#263E41` / `#223B3D` |
| Working surfaces | Green-gray `#DCE5E1`, pale limestone `#F5F6F0`, sectional tone `#C8D6D0` |
| Structure | `#A3B7AE`; one thick seam between the two panel roles |
| Signature | Pale citron `#ECD88E`, on domain attachment and tool latch only |
| Type | Gill Sans for domain/entity headings; Verdana for small, sturdy UI labels; SF Mono/system monospace for precision |
| Scale | 19/23 heading, 12/17 property label, 11/16 tree label; no all-cap entity names |
| Density | 29 px tree rows; 35 px properties; 6/10/14 px group rhythm. Independent scroll is visible, not a hidden auto-scrolling panel |
| Shape | Squared panel seams, 3 px field corners, no individual floating cards |
| Motion | A short highlight at the existing selection seam can acknowledge an off-screen selected entity; no sliding content across authorities. Respect reduced motion |

Plan semantics and protected icons remain exactly the same as Index House. The specimen’s 3D mass is the same neutral volume illustration in both, deliberately independent of P23.15 junction geometry. No photographic material or cinematic lighting is used to disguise shell weaknesses.

### Navigator and Inspector

The dense state is intentionally uncomfortable enough to be informative. At 900 px high, the Navigator cannot show a large tree and the whole Inspector simultaneously. The answer is **named groups, search, reveal and independent scroll**, not 9 px text or hiding all properties behind tabs. The selected identity and complete canonical reference remain in the Inspector header even when its tree row is off-screen. Reveal explicitly returns the Navigator to that row; it does not scroll the Inspector or change the camera.

Property sections match Index House’s ownership rules, but the shorter surface benefits more from solo expansion and a compact section jump menu once several groups exist. That menu moves to a property section; it never becomes a list of document objects. No separate searchable Inspector inventory is introduced.

### Education

Sidecar teaches through **context handoff**: select in the upper region, see the owner and editable particulars in the lower region. An optional explanation opens inside the lower surface under the focused section, temporarily replacing one section body rather than covering the drawing. It has an explicit close action and returns focus to the requesting control. This is on-demand help, not a default tutorial pane.

For direct manipulation, the drawing still owns the gesture readout and rejection. Help does not take over the Inspector automatically after an error. Camera no-flow teaching stays inside the temporal dock, which has enough width for a sentence and a diagram without inventing editable lanes.

### Extension slots

- P24 adds property groups to the lower region and inventory groups to the upper region. There is one world-local Scene Content branch, not Room → owned objects. Materials and lights must respect their future authorities; grouping does not confer ownership.
- The future ordered-set header has two rows at most: set summary, primary identity. Other selected members receive a lighter selection marker in the tree; primary gets the stronger marker and the word `Primary`. This does not give the Inspector its own active selection.
- P26 can occupy the stage context line with a bounded nested heading and return action. The reference column keeps canonical identities regardless of representation. No new tab stack, nav graph or render authority is implied.
- A dark theme must keep the panel seam, generous stage, editorial heading/utility type contrast, and tool latch. Grayscale confirms more than a green colorway distinguishes this concept.

### Risks

Vertical competition is this concept’s central liability. At 768 px high, a 288 px Timeline leaves a usable but shallow stage; the reference column may need its remembered split adjusted. Do not silently collapse it on domain switch. A divider is a resize affordance, not a decorative line. Coarse-pointer users need a much larger divider target than its visible seam.

Long-lived property editing while frequently searching the tree could cause scroll fatigue. The experiment to run later is a repeated find → edit → reveal task with 70+ walls; measure scrolling and lost context, not subjective “cleanliness.” If stacked panels fail that task, this concept should lose on evidence rather than be rescued by tiny text.

## Shared state grammar, deliberately independent of brand

| State | Visible channel | Conflict rule |
|---|---|---|
| Active domain | Large attached heading/tab and warm seam | Never entity blue |
| Active view | Large value under `View` | Not a latched tool |
| Local mode | Underlined label in subordinate pair | Does not recolor the workspace |
| Armed tool | Dark latch + underline + operation in status | Can coexist with selected entity |
| Pressed action | Brief inset surface, no persistent underline | Never confused with armed state |
| Hover | Neutral border/background | Does not change selected identity |
| Selected entity | Blue edge marker + name/reference; inherited drawing contour | Same canonical identity on every surface |
| Primary, future set | Strong marker + explicit `Primary`; other members retain weaker selected marker | One primary from shared selection authority |
| Keyboard focus | Independent double contour with contrasting gap | Remains visible on selected/armed controls |
| Draft | Inherited tentative geometry plus live numeric readout | Inspector shows committed values until commit |
| Snap | Existing teal marker, guide and relationship text | No new snapping engine or marker vocabulary |
| Rejected operation | Invalid marker + reason + correction path | Never overwrite selected entity’s blue or imply commit |
| Standing warning | Amber triangle + description in its owning section | Not the same treatment as a refused action |
| Authored value | Bounded field, unit suffix, ordinary text | Units not placeholder text |
| Derived/read-only | Unboxed label/value + explicit read-only context | Still readable, not dimmed as unavailable |
| Disabled | Muted surface but legible label + reason on focus/click | No silent no-op; no hover-only explanation |
| Destructive | Separated action tail, explicit verb, consequence/reason surface | Never disguised as an editable property |

Future value specimens (not current feature promises):

```text
Selection  3 selected
Primary    Bronze study

Position X     [ Mixed      m ]   editable common field
Material       [ …            ]   future authored field slot
Source           Shared           inherited/shared presentation
Projected area   12.4 m²           Derived · read-only
```

`Mixed` is a real displayed state, not a placeholder which vanishes on focus. An inherited value identifies its source in the same property section; it is not assumed to be editable. A derived value has no input border. These are rendering rules only; P24/P26 own what values exist and can be changed.

Overlaps to verify: selected+focused keeps blue selection and an independent focus ring; armed Wall+selected Wall keeps the tool latch separate from identity; invalid draft+selected entity leaves the committed entity untouched; future primary+hover keeps the primary word and marker visible.

## Timeline grammar in both concepts

The comparison board includes E with expanded flow, expanded no-flow, collapsed flow, and collapsed no-flow. D also shows a Camera Plan collapsed flow, demonstrating shared ownership across spatial views. Selecting a specimen is not a simulated domain transition. In the product, expanded/collapsed state persists verbatim and never changes automatically with domain.

Expanded dock: 288 px by default, adjustable within 240–300 px; fixed 36 px header. Both concepts use exactly Camera Path, Shots, FOV, Look At, Roll. Node diamonds carry sequence ordinals, not replacement entity references. Shot blocks show holds. FOV keys and Look At keys retain their domains. The board illustrates their presence, not a proposal for new editing gestures.

Roll stays a quiet, explicitly read-only `0°` lane. In edge scope, Shots becomes `No independent shot data` with no false handles. No lane is deleted. In no-flow scope there are **no ruler, keys or lane ghosts**. The empty-body explanation is authored UI copy, not authored document data.

Collapsed dock: exactly 48 px, full stage width. With a flow it has the single mini-player scrubber. Without a flow it has no scrubber and the transport explains the missing flow. Expanded scrubbing belongs to the ruler/lanes, with no duplicate scrubber above. Finite frustum belongs only to selected Camera 3D and obeys Frame; Camera Plan shows graph nodes and connections only.

Transport mode’s sole authoritative home is the Timeline header in these proposals; a viewport badge is a passive echo. Path and Frame remain workspace tools. Existing observer tools and edge-flip scope actions fit the header’s scope/More groups; the study does not remove their behavior. Test the smallest width before fixing exact overflow priorities.

## One fact, one home

| Fact/control | Authoritative surface | Permitted passive echo |
|---|---|---|
| Project identity and save aggregation | Project frame | None in Inspector/status |
| Shared tagged history | Project Undo/Redo | Relevant undo feedback only |
| Domain / view / mode | Domain area / view menu / local mode pair | Current context in status |
| Snap / grid | Workspace utility group | Near-gesture winning snap relationship, not a second toggle |
| Scale / orientation / fit | Lower-right canvas utility anchor in Plan and 3D | None elsewhere |
| Selection | Shared canonical authority | Consumers in Navigator, canvas and Inspector; not new sources |
| Property values | Selection-scoped Inspector | Live gesture value belongs to current draft until committed |
| Active gesture / refusal | Drawing readout and reason surface | Short operation status, not duplicate actionable errors |
| Camera playback / Observer–POV | Timeline header | Passive canvas mode badge |

“Visitor preview” means visitor takeover. “Play sequence” means Camera temporal playback. The existing Scene Plan Tour visibility control should be labelled “Show camera route” in the view-options menu; it is display-only. Publish remains a project supporting surface, not a third spatial domain. No visitor UI appears as a specimen shell state.

## Refusal, consequential action and keyboard examples

Wall refusal is shown in B and F. The selected committed wall remains 4.90 m while the final proposed chain leg is 0.00 m. No value is silently repaired. Two established keyboard levels remain: Enter enters the selected entity’s control group; arrows traverse and wrap; Enter again edits the focused numeric value; Escape unwinds one level. Pointer focus does not enter the group, and arrows alone do not enter it.

A selected degree-2 Junction may expose `Dissolve junction…` in the Inspector action tail and the same command in its context menu. Both call the existing command, with Delete/Backspace still available. The popover names the consequences and either offers the action or shows the **actual reason returned by validation**, e.g. the wrong junction degree. Do not invent automatic wall movement or guess extra refusal policies. This is a shell host for the shipped behavior, not a new geometry operation.

The painted Room rotation handle must not be normalized as a functioning affordance. Carry it as a trust defect for implementation reconciliation: suppress a nonfunctional action or expose an explicit unavailable reason until a legitimate operation exists. The concept does not implement Room rotation or move Room-local Scene content.

Menus: one open popover at a time; opening a new one closes the old; Escape closes the top scope and restores focus to its invoker. Menu arrow keys navigate items; disabled items expose reasons without activating. Tabs use roving focus and manual activation where a change would replace content. Closing Document restores focus to Document. Hiding a panel moves focus to the viewport and leaves explicit restore controls. Panel-collapse requests during an active gesture retain the existing deferred/cancel semantics.

Coarse pointer: 44 px acquisition targets via a dedicated comfortable density, larger row heights and padded hit regions where they do not overlap; do not simply enlarge invisible targets over adjacent dense rows. Keep 12 px readable labels rather than shrinking the whole UI. Target text contrast ≥4.5:1, large text and meaningful component contours ≥3:1, and test semantic colors separately against drawing paper and shell surfaces. These are acceptance targets, not a claim that this concept board certifies the product’s accessibility.

## Canonical-state comparison

| State | Same content | Index House | Sidecar Studio |
|---|---|---|---|
| A | 3 rooms, selected North wall / W-FJSK | Opposing rails make a readable left-to-right chain | The same identity is handed down the reference column |
| B | Wall tool, ghost, guide, snap, live 0.00 m value, refusal, handles | No whole-shell dimming; tool latch and reason carry salience | Same; the stage stays stable while lower Inspector retains committed values |
| C | Selected Bronze study, world-local transform, Local/World | Inspector gives transforms full height | Stage gains 268 px of horizontal room; lower Inspector scrolls sooner |
| D | Read-only Plan architecture, three camera nodes and connections | Camera inventory replaces Scene Navigator contents, not authority | Same reference-column composition; no Plan framing controls |
| E | Same selected camera, finite frustum, five lanes and four dock variants | Temporal surface is centre-column aligned | Wider temporal surface exposes longer segments at the same scale |
| F | 18 rooms / 72 walls / 12 openings, populated wall properties, warning, active refusal | More hierarchy context remains visible; canvas tighter | More plan remains visible; tree must scroll independently |

F intentionally shows semantic zoom: only some room labels survive; secondary dimensions and colliding labels are suppressed. No smaller text substitutes for density shedding. All names and full references remain available in the Navigator/Inspector. The board is a schematic drawing, not a test of the production label collision engine. It demonstrates the shell’s space budget and information hierarchy.

## Pressure-test ledger

| Test | Index House answer | Sidecar Studio answer / unresolved cost |
|---|---|---|
| Semantic hierarchy | Domain binding → view heading → mode pair → tool latch → selection seam | Domain heading → stage shelf → selected identity below tree; no added global ranks |
| Canvas primacy | Tall quiet paper between two subordinate data rails | Wider paper beside one support column; more vertical header cost |
| Selection | Same name/ref + blue marker on both sides and in drawing | Same identity across upper/lower column and stage; no independent Inspector selection |
| Density | Wrapped names, fixed refs, grouped scroll; full-height Inspector | Same row grammar; stronger dependence on scroll/reveal and adjustable split |
| P24 | Header accommodates set/primary; additional property sections | Same grammar in lower surface; section jump/solo likely needed sooner |
| P26 | Context line plus explicit return inside existing View container | Same slot above the stage, leaving reference column unchanged |
| Timeline | Full centre width; all five lanes; correct empty/collapsed forms | Full stage width; same semantics and expansion persistence |
| Education | Focused explanation anchored beside value/tool | Optional section explanation in reference column; refusal stays at gesture |
| Trust | Explicit reason surfaces, read-only Roll, truthful action tails | Same; no false drop/drag affordance at selection seam |
| Ownership | Document owner in selected header; no Room ownership for Scene objects | Same; stacked geography must not imply object membership in a room |
| Collapse | Selection tag and explicit restore affordances survive both rails hiding | Reference column disappears; restore either panel independently |
| Identity | Binding tab, opposing index/ledger, restrained humanist headings | Divided reference column, broad stage, strong seam and sturdy small type |
| P23.15 | No reliance on current wall mesh joins, no geometry masking | Same illustrative mass; shell independent of future junction output |
| Label discipline | Existing authored names + stable compact refs, never per-view numbering | Identical fixture identities; timeline ordinal diamonds are existing semantics |

## What this exploration does not decide

No winner, no implementation plan, no component mapping. The app code, tracker and current hand-off are untouched. No P24 tools, material workflows, P26 instrument taxonomy or P23.15 geometry are designed here. The form of extension slots is proposed; their future contents remain open.

Before choosing a direction, test a novice finding and adjusting a named wall, an experienced creator repeatedly alternating tree and transform edits, a 70+ wall document at 1280 × 800 and 240 px rail width, selected+focused+refused states, and an expanded Timeline after repeated Scene/Camera and Plan/3D changes. Sidecar must earn its width benefit against its scrolling cost; Index House must earn its stability against its centre-width cost. Neither should win from state A alone.

## Artifact verification

Rendered in an isolated Chromium session. All 12 A–F combinations were checked at the 1440 × 900 reference size and again with a 240 px Navigator; no horizontal overflow in the toolbar or panels. Both-panel collapse produces a 1440 px canvas in both concepts. E variants measured 288 px expanded / 48 px collapsed, with no lanes or scrubber in no-flow states and exactly one scrubber in collapsed flow. No browser errors were reported. Static captures for all 18 state/variant combinations are in [the gallery](./gallery.html).

Visually inspected Index A/B, Sidecar E/F, and no-flow Index E; checked selected-row reveal in Sidecar F. The review page adapts to a small browser by scrolling the fixed-size specimen, not by claiming a responsive production editor. No production tests or application behavior were changed. This verifies the comparison artifact’s rendering, not the proposed shell’s usability or complete accessibility.
