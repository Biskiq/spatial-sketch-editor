I explored as independent designer — brief as assignment, context as authority, research takeaways as provocation, 5 screenshots as evidence of what exists, not target.

Museum Editor today is substance past shell: wall-first topology, direct editing, display identity, Plan drafting language are settled. The shell is flat, generic, duplicated, and has no rank grammar. P23.14 must deliver **visual operating system with ceiling** — not reskin.

3 genuinely distinct theses. All obey §9 contracts: Scene/Camera is attention-only over one world, Plan/3D one compile, Layout/Scene separate, world-local placement, one selection authority that may become ordered set+primary under P24, Inspector selection-scoped, viewport primary, one mechanism per question, refusal with reason.

### Shared principles across concepts
- **Rank > reduction.** Project → Domain → View → Instrument → Local Mode → Tool → Selection → Gesture/Status must be readable without reading labels. Fixes #1.
- **One fact, one home.** Snap/Grid/Metric/Scale authoritative in status bar only, passive echo at most in canvas scale bar. Fixes #3, #6.
- **Property-first Inspector.** No summary block + prose. Selection header first, then properties, then relations, then destructive actions with reason. Fixes #2.
- **Selection trio as signature.** Viewport handle + Navigator row + Inspector header same identity, with tracer. Never second truth.
- **Timeline as grid member, not widget.** Full viewport-width, 48px collapsed = mini-player with/without scrubber, 288px expanded = header + body. Empty state designed, not blank void. Fixes #7, #10, #14.
- **Vocabulary discipline:** `Preview` is 4 things today #4. Rename: Row1 `Visitor Preview`, ribbon `Tour Overlay`, Camera rail `Play Sequence`, Publish `Published View`.

---

## CONCEPT 1 — The Stratified Atelier

**Thesis:** Warm instrument, not friendly dashboard. Feels like a drafting table made of layered materials. Recognizable by **stratified surfaces** — each rank has distinct material/elevation that gets warmer closer to canvas. Professional, precise, educational through layering. Suits non-CAD creator because rank is physical: you can feel where you are.

**Main hierarchy principle:** Elevation + surface, not just position.

**Shell composition:**
```
[Project Frame 36px - quiet zinc, persistent]
[Domain Band 40px - large typographic Scene|Camera tabs, illuminated, persistent]
[Canvas Header 32px - View + Instrument + Local Mode, contextual to cell, owns Plan|3D + future Section/Elevation]
[Tool Dock | Viewport (primary) | Inspector]
[Timeline - Camera only, full-width aligned to viewport grid, persistent in Camera]
[Status Bar 24px - authoritative Grid/Snap/Metric/Cell/Selection/Save/Hints]
```
- Persistent: Project, Domain, Navigator 240-300px, Inspector 300px, Status, Viewport shell, Timeline in Camera.
- Contextual: View/Instrument in Canvas Header, Layout|Arrange only Scene·Plan, Tool Dock vertical left of canvas — Select, Wall, Rect Room, Poly Room, Door, Window, Column, Platform, Plinth. Scene·3D shows Move/Rotate/Scale/Add Asset + Local|World. Camera shows Add Camera, Connect, Path, Frame etc. New P26 instruments enter as additional chips in Canvas Header, with breadcrumb `Plan > Section A-A ← Back`.
- Navigator: Species distinction — `ARCHITECTURE` small-caps group heading, entity rows with icon+name+compact ref secondary line, relation `Ends…` removed per preferred fix #5 — shown as muted meta under Wall row, not selectable. Search + filter. Footer selection summary removed, moved to Status.
- Inspector: Header: icon + `W-FJSK · Defines a room boundary` + reference `J-5AEX → J-7V24 · 4.90 m`. No summary prose. Immediate fields. `Place` grid remains but secondary. Destructive `Delete junction / Join walls` at bottom of relevant section as danger row with reason-coded disabled: `Can't dissolve: degree ≠ 2`.
- Timeline: Full-width. No-flow: header + empty 288px body with illustration `No sequence yet — Place 2 cameras + Connect`, chip. Collapsed no-flow: 48px transport strip, no scrubber, same illustration collapsed to icon+text. Edge: ruler + 5 edge-local lanes but Roll auto-collapsed to chip `Roll 0° constant` to avoid mute lane #14. Sequence: full lanes, grouped — Path+Shots primary 44/48px, FOV/LookAt/Roll secondary 34/32px muted. Mini-player collapsed with scrubber shares grid.
- Canvas chrome: Unified bottom-right cluster both Plan and 3D — scale bar + axis gizmo / nav cube + counts removed to Status. No top-right nav box vs bottom-right gizmo split #6.

**Visual system:**
- Typography: Suisse Int'l for UI, JetBrains Mono tabular for measurements. Domain tabs 15px Medium, View 13px Medium, Tool 12px, Inspector field 12px.
- Density: 4px base, 8px section, 12px group. Rails 240-300px: two-line rows to avoid truncation #5.
- Surfaces: zinc-900 base, zinc-800 Domain band, warm paper 50 for Canvas Header, viewport slightly lighter. Borders 1px neutral, not shadows. Elevation = border + 1px inner highlight.
- Shape: 6px panels, 4px controls, 2px handles — survives theme change.
- Color roles: neutrals only, accent only selection blue `#3B82F6`, snap amber `#F59E0B`, invalid red `#EF4444`. Domain wash very subtle — Scene warm stone 2%, Camera indigo 3%.
- Icon: unify mixed Lucide + custom Plan + repo SVG to 16px, 1.75px stroke, 20px hit. Keep owner-ratified Wall/Rect/Poly/Door/Window silhouettes but redrawn to same stroke.
- State grammar: Hover 8% lighten, Pressed 12% darken + 1px inset, Selected blue ring + fill 9% for frustum, Active tool depressed + LED dot, Keyboard focus 2px dashed + readout per P23.13 A5, Disabled 40% opacity + reason tooltip, Invalid toast above status with code.
- Motion: 150ms ease hover, 200ms panel collapse, no motion for selection identity change.

**Educational model:** Uncertainty boundaries, not permanent prose. Tool armed → ghost + live dimension + snap marker + guide + pill near cursor `Drag to place, Shift angle snap, Esc cancel`. Invalid → toast `Wall rejected: Chain legs must have non-zero length — try longer`. Disabled Delete junction → `Why?` popover with reason code. Empty states teaching: Plan empty ghost + card, Timeline no-flow illustration, Inspector NO SELECTION with 2-line prompt not 6-row summary.

**Extension model:**
- P24: Selection header handles `1 selected` → `3 selected · Primary: W-FJSK`. Mixed values show `— Mixed` with striped field background. Material/light sections add as collapsible modules below Selection, no rewrite. Reason-coded refusal surface reused for `Unsupported placement: Keep-on-Floor failed`.
- P26: View header extends to `Plan | 3D | + Section` — third slot is instrument, not peer world. Entry creates breadcrumb return path, exit restores Plan. Derived cut/projected/hidden streams use same Plan visual language extension, membership stage reason codes surfaced in Reveal action.

**Risks:** Could become too layered if surfaces not disciplined; dark surfaces risk contrast #34 — needs token audit; density at 240px minimum needs shedding rules; warm paper header in dark theme may clash — needs theme token.

**Fixes #1-10:** #1 rank via surfaces, #2 property-first, #3 single home Status, #4 vocabulary, #5 relation rows removed + two-line, #6 unified cluster, #7 full-width timeline, #8 contrast + focus ring + 44px hit, #9 stratified identity survives theme, #10 continuity via shared header + tracer, empty lane designed.

**Canonical A-F:**
- A Scene·Plan normal: Domain band shows Scene active, Canvas Header shows Plan active + Layout toggle, Tool Dock Select active, Navigator grouped, Plan canvas ruler/grid/wall mass/room label, Inspector shows selected Wall properties immediately, Status shows `Scene·Plan · Grid on · Snap 0.25m`.
- B Active wall op: ghost + 4.90m live dimension + blue snap marker + guide, handles visible, numeric field anchored, shell dims 20% except Status reason area, invalid toast if zero-length.
- C Scene·3D object: same selection in rail + Inspector + canvas handles, transform group + Local|World in Tool Dock, orientation cube bottom-right same place as Plan gizmo, Wall mass around object not hidden — P23.15 seams visible, not masked.
- D Camera·Plan: Domain band Camera active indigo wash, Canvas Header shows Plan + Camera tools, read-only backdrop, nodes/connections, CameraSidebar sections unchanged but header style matches Inspector.
- E Camera·3D + Timeline: No-flow shows empty 288px body with illustration, collapsed 48px transport strip no scrubber; Flow shows ruler + 5 lanes, node diamonds numbered, shot blocks, FOV keys, frustum in viewport blue perimeter + 9% fill governed by Frame toggle; Collapsed flow shows full-width mini-player with scrubber aligned to viewport.
- F Dense: 21-room plan, rail groups expanded, Inspector populated, warnings count, labels at min zoom shedding per P23.13 — silhouette last.

**Pressure tests:** Semantic rank via elevation readable without labels; Canvas primary — shell quieter during gesture; Selection one authority with tracer; Density sheds dims→labels→handles; P24 multi/mixed fits in header + row grammar; P26 enters as instrument chip + breadcrumb, no second nav; Timeline native full-width, empty vs populated distinct, Roll collapsed not deleted; Education at gesture/refusal/empty; Trust no mute control — rotation handle issue flagged with reason; Ownership each fact one home; Collapse 0 1fr 0 still shows selection in Status + way back chevron; Identity stratified surfaces survives light theme; P23.15 no seam-hiding; Label discipline zero new naming, uses display identity Name + compact ref.

---

## CONCEPT 2 — The Control Room Console

**Thesis:** Museum Editor as broadcast color suite. Professional, trustworthy, precise through signal path. Recognizable by **illuminated console grammar** — domain as input selector, view as monitor selector, tools as rack units with LED. Warm through lighting, not wood. Creative because it feels like hardware you want to touch.

**Shell composition:**
```
[Project Clock 36px - project name + Local Session + Save + Undo/Redo + Visitor Preview + Theme + Account - persistent]
[Console Strip 44px - Left: Scene|Camera illuminated pushbuttons, Center: Plan|3D|Ghost +Instrument monitor buttons, Right: Layout|Arrange + Snap/Grid - contextual center/right]
[Tool Rack 36px - horizontal, icon+label, active depressed - contextual]
[Navigator | Viewport | Inspector]
[Timeline Console 48/288px - full shell width, tape-deck metaphor - Camera only]
[Status Bar 24px]
```
- Persistent: Project Clock, Domain pushbuttons, Navigator, Inspector, Viewport, Status.
- Contextual: Monitor buttons Plan/3D + future instruments, Layout/Arrange only Scene·Plan, Tool Rack fully cell-dependent. New enters as new monitor button + new rack units.
- Navigator as Patch Bay: connecting lines Room→Walls, indentation, group headers with rule lines. Ends… rows removed, relation shown as line label. Truncation fixed via wrapping.
- Inspector as Channel Strip: modules with header + bypass dot, selection header large with status dot. Destructive reset P24.4 at bottom as red-lit button with confirm dialog.
- Timeline: Tape deck — left transport, center timecode `00:00 / 00:00`, right POV|Observer. Expanded 288px header 36px same as Console Strip, body scrollable. Empty: centered dashed drop target + `No sequence yet`. Collapsed mini-player full-width 48px, no width fragmentation.
- Canvas chrome: Single bottom-right console cluster both Plan and 3D.

**Visual system:**
- Dark baseline #0F1115, panels #1A1E26, console #232836 with subtle inner glow. Light theme uses same shape language — identity in shape + illumination, not palette.
- Typography: Inter Tight for headers condensed, Inter for UI, Mono for values.
- Shape: 4px controls, 6px panels, 2px handles, LED dot 6px.
- Color: zinc neutrals, selection blue, snap amber, invalid red. Camera domain indigo LED, Scene terracotta LED — only LED uses domain color.
- Icon: 16px, 2px stroke, filled when active.
- State: Hover glow, Active LED on, Focus 2px white ring outside, Disabled shows reason chip.

**Educational model:** Signal tracer — thin line animates 200ms from viewport selection → rail row → inspector header on selection change. Makes ownership obvious. Refusal reasons inline near gesture + standing in Inspector Issues.

**Extension:** P24 mixed values as striped channel; P26 instruments as monitor buttons with `← Back to Plan` breadcrumb in Canvas Header. No second nav.

**Risks:** Could feel too technical/dark for warm/friendly; dense rack could become noisy; LED metaphor must meet contrast.

**A-F:** Similar walkthrough but emphasis on illuminated states: A shows Scene LED on, Plan monitor on, Layout toggle on, rack shows Wall tools; B shows active tool LED + ghost; C shows transform rack + Local|World toggle illuminated; D shows Camera LED + read-only backdrop desaturated; E shows tape deck timeline full-width, frustum blue; F shows dense patch bay with lines still legible via shedding.

**Pressure tests:** Rank via size+illumination; Canvas primary via dimming console 30% during gesture; Selection tracer signature; Density via collapsing secondary lanes; P24/P26 slots as rack/monitor; Timeline native tape deck; Education via tracer + reason chips; Trust no mute — rotation handle shows `No-op: Room rotation not committed` instead of silent; Ownership via tracer; Collapse shows Status selection + back chevrons; Identity illuminated console survives theme; P23.15 no hiding; Label discipline intact.

---

## CONCEPT 3 — The Guided Desk

**Thesis:** For creator without CAD/DCC training. Feels like a desk with drawers — stable landmarks, progressive disclosure, teaching at uncertainty. Warm, friendly, humane through typography + paper, not oversized rounded consumer cards. Recognizable by **breadcrumb path** and **drawer metaphor**.

**Shell composition:**
```
[Desk Header 56px - Left: Projects < Untitled project · Local Session, Center: Breadcrumb Path Scene > Plan > Layout ▼, Right: Save to Cloud + Preview + Account - persistent path, contextual dropdowns]
[Drawer Handles 32px - Snap/Grid/View options authoritative only in Status, Tools laid on desk top edge of viewport - contextual]
[Left Drawer 240-300px | Work Mat Viewport | Right Drawer 300px]
[Timeline Drawer 48/288px under viewport only, same width as viewport, slides up]
[Status Bar]
```
- Persistent: Desk Header, Drawers, Viewport, Status.
- Contextual: Breadcrumb dropdowns change cell, Tools on desk edge, Layout/Arrange appears as second level in breadcrumb only in Scene·Plan. P26 enters as `Scene > Plan > Section A-A` — path grows, return obvious.
- Navigator: Progressive density — groups collapsed by default in dense F state, search filters live, relation rows removed, reveal action `Show in Walls ›` kept but moved to inline link under selection.
- Inspector: Top thumbnail preview of selection, then core props, advanced collapsed. Help (?) popover per section, not permanent prose. Destructive action row with icon + reason.
- Timeline Drawer: Under viewport only, aligned to viewport, not full shell — but width = viewport, not centered 760px #7. No-flow: educational steps illustration 1-2-3. Collapsed: mini-player with scrubber only when flow exists.
- Canvas chrome: Scale bar + gizmo bottom-right unified.

**Visual system:**
- Light baseline warm paper `#FEFCF8`, ink `#1A1A1E`, panels white with soft shadow 0/1/3. Dark theme same layout, paper becomes #1E1E22 — identity in layout not color.
- Typography: Humanist sans Instrument Sans for UI, larger 14px for breadcrumb path, mono 12px tabular for dims. Friendly but precise.
- Shape: 8px drawers, 20px desk header, 4px controls.
- Icon: Outline default, filled active, 20px for friendliness but still precise.
- State: Hover soft shadow lift, Selected left 3px blue bar in rail + blue ring in canvas, Focus 2px blue ring + readout.

**Educational model:** Core strength. Coach marks near cursor on first use, dismissible. Empty states teaching with illustration + CTA. Disabled actions show reason on hover/focus with suggestion. Inspector Learn drawer at bottom shows contextual tips, dismissible, not permanent top prose.

**Extension:** P24 multi-selection shows as list in drawer header with primary badge; mixed as mixed chip; material sections as new drawer sections with disclosure. P26 Section instruments as breadcrumb extension, depth/crop controls appear as contextual instrument panel attached to Canvas Header, with return path.

**Risks:** Could feel too light, losing professional trust; progressive disclosure may hide power; drawer metaphor may imply floating that breaks ownership — must keep ownership strict.

**A-F:** A shows breadcrumb `Scene > Plan > Layout`, tools on desk edge, left drawer Rooms 1, Inspector property-first; B shows coach mark + live dimension + guide, shell not dimmed but coach mark near cursor; C shows object selected, selection list in Status, transform tools on desk edge; D shows Camera path breadcrumb `Camera > Plan`, read-only backdrop with 50% desaturation; E shows timeline drawer under viewport, empty illustration vs full lanes, frustum in 3D; F shows dense state with drawers collapsed to icons + count, progressive disclosure keeps legible.

**Pressure tests:** Rank via breadcrumb path hierarchy; Canvas primary via work mat larger + drawers lighter; Selection via left bar + thumbnail; Density via progressive disclosure shedding; P24/P26 via breadcrumb extension; Timeline drawer native aligned; Education via coach marks + empty teaching; Trust via reason chips no silent no-op; Ownership via breadcrumb + tracer; Collapse drawers to icons still shows selection in Status + back; Identity desk + breadcrumb survives theme; P23.15 no seam hiding; Label discipline zero new.

---

### Comparison

| Dimension | C1 Stratified | C2 Control Room | C3 Guided Desk |
|---|---|---|---|
| Rank mechanism | Elevation/surface | Size/illumination | Breadcrumb path |
| Warmth source | Material warmth | Lighting glow | Paper + typography |
| Density strategy | Shedding + elevation | Collapsing secondary lanes + rack | Progressive disclosure + drawers |
| Identity trait | Stratified bands | LED console + tracer | Desk + path |
| Timeline | Full-width console, Roll chip | Tape-deck full-width | Drawer under viewport |
| Risk | Layer complexity | Too technical | Too light |

All three:
- Host P26 without 2-slot hardcode via Canvas Header / Monitor / Breadcrumb slot
- Host P24 multi + mixed + destructive + reason surfaces
- Fix #1-10 with explicit citations
- Keep display identity, no new naming
- Don't depend on P23.15 mesh
- Meet a11y #34 contrast, #35 remove axis tokens, #38-41 focus lifecycle via defined system, 44px coarse target via larger hits
- Survive theme change because identity in shape/rank/layout, not palette

Next step would be to sketch A-F for each concept at 1600×1000, test at 240px rail minimum, and run the 14 pressure tests with real dense project — but system ceiling is now demonstrable without another shell rewrite.