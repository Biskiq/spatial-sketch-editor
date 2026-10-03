# World Paper authoring — prototype adoption plan

Status: **planned 2026-10-03, review-ready, not started.** No slice is implemented. The
owner-decided sequence places this plan **after #113**: #112 close/merge → #113 Experience V2 +
real World ↔ Experience continuity → Paper PA0–PA12 in the next PR → prototype detour closes →
F exact-interface amendments → T1/T2/T3/T4 (§11 item 7, §12).
Contract: [PLATE §0.8.4](../../../../reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination)
(normative), within PLATE §0.8–§0.8.3; Wall-role domain destination in
[architecture](../../../../reference/architecture.md) §Ownership.
Rationale and specimens: [Paper shell proposal](../../../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md).
Executable home: [World Authoring Prototype](../../../../../prototypes/spatial-authoring/README.md)
([implementer reference](../../../../../prototypes/spatial-authoring/IMPLEMENTER-REFERENCE.md),
[QA](../../../../../prototypes/spatial-authoring/qa/README.md),
[acceptance](../../../../../prototypes/spatial-authoring/qa/ACCEPTANCE.md)).

This plan adopts the accepted World Paper shell into `prototypes/spatial-authoring/` as an
**executable interaction reference and design laboratory, not production architecture**. It
extends the #112 seams in place. It does not build a parallel editor, a second state store or a
Svelte-shaped imitation of production. Prototype evidence satisfies no F, T1, T2 or T3 gate.

## 1. Outcome and stop rule

When every slice is accepted, the World executable demonstrates PLATE §0.8.4 end to end:

- the six-slot rail;
- Wall drawing whose spatial role is derived and explained;
- host-seeking Openings;
- Place dispatching to its owning authority;
- temporary Measure;
- the read-only fact Card with ⋯ and no verb row;
- the Index's Search and Browse beside capability Find;
- the precision ladder ending in Dimensions;
- the Scale · Grid · Snap drafting state with its Sheet;
- earned consequences, including the Divide procedure;
- Paper ⟷ 3D as one switch over the one camera;
- the narrow desktop.

It does this while A–F, the eleven #112 axes and every protected invariant in §3 keep passing.

Each slice ends at its own QA. A slice that cannot keep a protected invariant stops and reports
instead of weakening the invariant or an assertion.

## 2. What the current prototype already gives us

These seams were harvested from the prototype and are kept. Paper work extends them; it does not
replace them.

| Seam | Where | What it guarantees today |
| --- | --- | --- |
| One canonical selection | `S.sel`, `actions.js select()` | one identity; a selection change cancels the held proposal |
| One task surface | `tasks.js` (`begin`, `end`, `subject`, `target`, `focus`, `precision`, dispatch table, `capabilities(id)`) | task focus ≠ selection; every offered verb is dispatchable |
| One camera and navigation owner | `navigation.js` (requested vs realized camera, parked hold, trail of reading recipes), `actions.js fly/goPlan/go3D/openSession` | movement only through `nav`; Undo never moves the camera |
| One cancellation | `cancel.js cancelProposal(reason)` | ordered, idempotent rollback of candidate, writer, preview, pointer capture, refusal, knife aim |
| Session lifecycle | `actions.js KIND[kind] = {setup, apply, teardown}`, `openSession` nesting and `parent` | Esc walks nesting; same kind replaces |
| Source history | `beginEdit/commitEdit/cancelEdit/editOnce`, whole-model snapshots | one labelled step per accepted edit; no-op writes nothing |
| Validators that name the fix | `model.js validateOpening/validateArtPlacement/validateWall/validateCeiling` | refusal in words; invalid release cancels with no history |
| Legibility gate | `draw.js legible/handleIf` | handles exist only where legible; withheld tapes stay typeable |
| One "where is it" resolver | `actions.js whereIs/openLocation`, Index badges, beacon | Select / Open location / Bring into view / Reveal stay distinct |
| Parking and Resume | `parkWorldWork`, `parkedContext`, `resumeParked`, `switchLens` | lens crossing parks inactive records; return never revives; Resume revalidates |
| Motion policy | `anim.js dur/run`, Reduce motion vs Motion speed | identical endpoints at any speed |
| Read-only QA probe | `window.__me.qa` (`state`, `museum`, `hash`, `realized`, `faultList`, `idle`, `render`) | semantic assertions without pixels; fixture digest `650e93c4` |

What the prototype does **not** have yet, and the Paper contract needs:

- creation of new walls, openings or placed items (IMPLEMENTER-REFERENCE: "drawing new walls or
  openings in the one renderer is not prototyped");
- derived rooms: `galleries`, each wall's `gallery` field and `fixtures.js PLACES` are declared,
  not derived;
- a stage that can add or remove items: `stage.setMuseum(m)` only rebinds existing items;
- a capability registry: `tasks.capabilities(id)` hard-codes Look verbs per kind;
- a reading switch that keeps scale: `goPlan()` flies to `planCam()`'s fixed framing, and `go3D()`
  restores `S.last3D`.

## 3. Protected invariants

Every slice keeps all of these, and QA asserts them (§8). A future production planner reads this list as
behaviour, never as a mechanism.

1. **One canonical selection.** `S.sel` stays the only selection value. Sets (PA10) are a value
   of `S.sel` (`{ kind: 'set', ids }`), never a second variable. Find, consequence emphasis,
   preferred hosts, hover and Measure never write it.
2. **One camera and navigation system.** Every framing change (flip, scale detent, Fit all,
   Bring into view, Face, Put it back, trail) goes through `navigation.js`. No Paper-owned camera,
   viewport or scale state. The scale word is computed from the realized camera.
3. **One task surface.** Find, Dimensions, procedures and Look sessions render in the one
   `#instrument`, one state at a time. Option strips hold only tool defaults.
4. **Task focus is not selection.** A preferred host, a Divide target, a consequence row's
   emphasis and a host-first tie-break are `S.task.focus` or tool state, never `S.sel`.
5. **Deterministic cancellation and unwind.** Every non-accepting exit goes through
   `cancelProposal`, extended with new reasons (`tool`, `gesture`, `find`, `procedure`).
   Esc follows §6's ladder exactly, one level per press; ⇧Esc unwinds the whole chain.
6. **Source Undo versus spatial return.** Undo/Redo restore source snapshots only and never move
   the camera, close a reading or disarm a tool. Spatial return stays with `nav` (Put it back,
   trail). Undo is unavailable, with a reason, while a gesture or proposal is live.
7. **Parked work and Resume across World | Experience.** Crossing cancels live gestures and
   unaccepted proposals and disarms the tool; invoked procedures park as inactive records.
   Return renders ordinary World rest. Resume is explicit, revalidates, and reopens procedures
   fresh, never with their old proposal values.
8. **No canonical Paper document.** Paper settings (`S.paper`) and app settings (`S.settings`)
   are view state: never in `ctx.museum`, never in Undo, never in the fixture digest.
9. **Layout and Scene ownership stay separate.** Walls, openings, ceilings and structures are
   Layout subjects; art and objects are Scene subjects. Place names the owner, and Undo labels and
   Find rows carry the owner tag. Derived rooms read Layout only.
10. **Derived stays derived.** Room geometry, room membership, a Wall's spatial role and a
    room's area are computed (PA1) and never written by any control.

## 4. Slice map and dependency order

```text
PA0 preflight and seams ──┬──► PA1 derived room topology ───────────────────────┐
                          └──► PA2 shell frame ──┬──► PA3 Paper ⟷ 3D switch     │
                                                 └──► PA4 Search + Find ──► PA5 Card + Dimensions
                                                                             │   │
                                         PA6 rail framework, Select, Measure ◄┘   │
                                          │                                       │
                         ┌────────────────┼────────────────┐                      │
                         ▼                ▼                ▼                      │
                PA7 Opening     PA8 Draw walls (needs PA1) ──► PA9 Divide procedure (needs PA5)
                                                  PA10 Place + selection sets
                                                           ▼
                              PA11 narrow desktop, keyboard, Esc ladder
                                                           ▼
                              PA12 integrated acceptance and harvest
```

PA1 is domain-only and can run beside PA2–PA5. PA5 also needs PA1, because the Card's kind line
shows a Wall's derived role. A slice starts only when its predecessors' QA passes.

## 5. Slices

Each slice records:

- the accepted behaviour it introduces;
- the current behaviour it replaces or preserves;
- the files and seams involved;
- the state owner;
- the interaction and cancellation rules;
- the semantic QA to add or update;
- visual and manual QA where feel matters;
- what is prototype-only;
- what a future production planner can harvest.

### PA0 · Preflight and seams (no behaviour change)

- **Accepted behaviour.** None visible. This slice prepares one named binding table and the two
  new QA axes.
- **Replaced / preserved.** It preserves everything and re-records the current
  `qa/run-all.sh` result (498 passing observations, digest `650e93c4`, 50 checkpoints) as the
  slice's entry baseline.
- **Files / seams.** New `app/keys.js` holds the binding table: named commands mapped to key
  chords, with a context predicate per command. The `main.js` keydown handler (lines 1031–1102)
  moves into it without changing any binding. New `qa/paper-check.sh` and
  `qa/authoring-check.sh` are registered in `run-all.sh`, each starting with a smoke block.
- **State owner.** `keys.js` dispatches named commands to their existing owners and owns no
  state.
- **Interaction / cancellation.** Unchanged. `qa_press` and `qa_key_dispatch` keep working
  because the DOM event path is the same.
- **Semantic QA.** All eleven axes stay identical. The paper axis asserts that the binding table
  lists every key the old handler bound, with the same commands.
- **Visual / manual QA.** None.
- **Prototype-only.** The table's literal JS shape.
- **Harvest.** The named-command pattern, which mirrors production's exact-match, remappable
  `editor-command-intent` table, and the command list of §6.

### PA1 · Derived room topology (domain, no UI change)

- **Accepted behaviour.** Rooms derive from Wall geometry. A Wall's spatial role (bounds,
  divides, free-standing) and the rooms on each side are derived. Room identity persists through
  topology changes by lineage (PLATE §0.8.4 Wall authoring; architecture §Ownership).
- **Replaced / preserved.**
  - Membership stops reading the declared fields: `w.gallery`/`c.gallery` reads (fixtures.js:80,
    state.js:86 `galleryName`, ui.js:134/642/673, draw.js:554–557, actions.js:415/1390) and
    `fixtures.js PLACES` are replaced by derived topology.
  - The fixture source stays byte-identical, so digest `650e93c4` is kept. The `galleries`
    records are reread as the **persistent Room records** (identity, name, reference), which is
    how production already treats Rooms (persistent identities reconciled over derived faces).
  - The `gallery` fields stay in the data but nothing reads them.
- **Files / seams.** New `app/topology.js`:
  - planar arrangement of wall centrelines, with intersections noded analytically
    (segment–segment, segment–arc) and arcs discretised only between nodes;
  - minimal-face extraction, discarding the outer face;
  - face → Room reconciliation following production's evidence order: wall lineage, then
    overlap area, then interior witness, then canonical key;
  - safe components only (birth, 1→1, 1→2 split, 2→1 merge); anything else refuses the edit
    in words, as P23.8 does;
  - derived relations per room: bounds, shared bounds, ceilings by `ceilingAtPoint` coverage,
    art on display from the hung side via the existing `worldOf`, objects located by
    `pointInPoly`;
  - a role description per Wall.

  `topology.derive(museum)` is pure and cached by a model hash. `fixtures.js PLACES` becomes a
  thin derived view so the existing Index and Card code keeps its call shape.
- **State owner.** None. Topology is a pure function of `ctx.museum`, never stored in `S` or the
  model.
- **Interaction / cancellation.** None yet.
- **Semantic QA (authoring axis).**
  - The derived rooms equal R-LONG and R-ROT; areas equal the fixture outlines within 0.002 m².
  - Derived relations equal the former `PLACES` lists exactly (bounds, shared, ceilings,
    onDisplay, located).
  - Role descriptions: North, South and West *bound Long Gallery*; Rotunda *bounds Rotunda,
    Long Gallery*.
  - The digest is unchanged, and a static check finds no `.gallery` read outside `model.js`.
  - A synthetic model with a Wall across Long Gallery yields one split: R-LONG survives on the
    larger-overlap part and one Room is born.
  - A synthetic free Wall yields *free-standing in Long Gallery* and no new Room.
  - All eleven #112 axes stay identical.
- **Visual / manual QA.** None, beyond room labels that must not move.
- **Prototype-only.** The arrangement and face algorithm, arc discretisation, sampled overlap,
  and centrelines without thickness.
- **Harvest.** The acceptance cases (split, birth, free-standing, shared bound, curved bound),
  the role vocabulary, and the evidence order. Production authority is layout-core's canonical
  compiler and P23.8 reconciliation, after the Layout Wall-role cutover.

### PA2 · Shell frame: retire the rail and Head search; add the drafting state

- **Accepted behaviour.**
  - The Head holds the app menu, lens, Undo/Redo with label, save state and Preview, and no
    search.
  - Stage furniture is the reading cluster (switch, `scale ▾`, `grid …`, `snap …`, ⋯), the rail
    slot area (empty until PA6), the scale bar and the datum key.
  - The Sheet is behind ⋯.
  - Settings, from the app menu, hold Motion speed and Reduce motion.
  - Keys open on `?`, and Fit all sits in the scale menu.
  - Grid is one fact across Paper surfaces.
  - The World status rail is retired.
- **Replaced / preserved.**
  - Retired: the footer status rail (`#statusText` hints, `#trail` strip, `#draftBtn`,
    `#motionBtn`, motion select), the Head "Search anything" button, and `.stage-tools`
    (`#stViewNow`, tilt bead, Plan/3D buttons, Overview, Keys).
  - Preserved:
    - `#announcer` as a visually hidden live region;
    - narration captions (prototype motion policy);
    - the `[` `]` trail keys, with the trail data unchanged in `nav`;
    - the Look-session peek inset;
    - the truth frame's scale bar, now furniture.
  - `#where` shows only outside Paper, because Paper is the plan.
  - `S.wallDrafting` becomes `S.paper.grid`: off hides the plan rule and gives walls their real
    material, exactly as Wall grid off does today (§6.4 paper rule unchanged).
  - Snap keeps the prototype's accepted 0.05 m increment and its ⌥ behaviour (§6). The words read
    `snap 0.05` and `snap held off`.
- **Files / seams.**
  - `index.html` regions;
  - `ui.js` (`renderHead`, `renderStageTools` → `renderReadingCluster`, `renderStatus`/
    `renderDrafting`/`renderMotion` → `renderSheet`/`renderSettings`);
  - `actions.js setStatus`, which now announces and puts refusals at the gesture instead of in a
    footer;
  - `stage.js` grid layers, reading `S.paper.grid`;
  - `styles/`.
- **State owner.** `S.paper` (grid on/off, snap on/off, snap increment, labels, rulers, show)
  and `S.settings` (motion speed, reduce motion) are view state and never authored. Scale
  belongs to `nav`.
- **Interaction / cancellation.**
  - G toggles grid, and a word click toggles its fact.
  - The Sheet shows grid and snap read-only.
  - Opening the Sheet, Settings or Keys cancels nothing; Esc closes them (§6 ladder level 3).
- **Semantic QA.**
  - shell-check: drop `.status`, `.stage-tools` and the "exactly one search entry" assertions.
    Add assertions: no Head search; one reading cluster inside the Stage; the words name grid
    and snap state with written off states; the Sheet writes no grid/snap on/off; Settings own
    motion.
  - responsive-check: the cluster is never covered at 1024×768.
  - flows "grid" moves to G and the word.
  - **Re-baseline, fit fields only:** the Stage rect grows when the footer leaves. As in the S2
    precedent, the digest, inventory and every semantic field must stay identical, and only
    eye, distance and frame height may move.
  - paper axis: Paper settings never enter Undo or the digest (invariant 8).
- **Visual / manual QA.** The words are legible but quiet; the Sheet's layout; Settings; the
  datum key; the scale bar against vellum and mat.
- **Prototype-only.** Exact CSS, the trail remaining key-only (§11 dependency 5), and captions.
- **Harvest.** The admission rule for drafting-state words, the state-versus-configuration
  ownership table, the off-state copy, and Settings ownership of motion.

### PA3 · Paper ⟷ 3D: one switch over the one camera

- **Accepted behaviour.**
  - A flip tilts about the current target and keeps scale. Paper settles azimuth to the nearest
    90° detent; 3D returns to the last working elevation.
  - Dragging the switch thumb, or ⌥-dragging empty Stage, tilts continuously.
  - A flip never refits, retargets, rescales or changes lens.
  - Selection, armed tool, open Instrument work, grid and snap survive a flip.
- **Replaced / preserved.**
  - Replaces `goPlan()`'s fixed `planCam()` framing and `go3D()`'s `S.last3D` pose restore.
  - Preserved: flips inside a Look session still leave it at the current target (#112
    behaviour), Overview becomes *Fit all* (`home3D` framing as a request), and Reduce motion
    still makes the flip a cut.
- **Files / seams.**
  - `navigation.js` gains `flipTo(reading)` and `tiltTo(el)`, computed from the realized camera
    (target, frame height, azimuth detent, `S.lastWorkingEl`).
  - `actions.js goPlan/go3D` become requests to it.
  - The `main.js #tilt` drag moves to the switch thumb.
- **State owner.** `nav`. `S.lastWorkingEl` lives beside the trail as navigation state, not shell
  state.
- **Interaction / cancellation.**
  - A flip is not a crossing and cancels nothing, except a knife with no line yet (unchanged).
  - A live gesture survives a flip: its legibility re-evaluates, and illegible input refuses in
    words.
- **Semantic QA (paper axis).**
  - Flip Plan → 3D → Plan: target and frame height are unchanged within 0.002, and azimuth
    snaps to a multiple of 90°.
  - Selection, the armed tool (once PA6 exists), the Instrument kind, `S.paper` and the Undo
    depth are unchanged.
  - The realized camera after resize keeps target and scale (no refit).
  - **Re-baseline, camera fields of the A–F steps that use Plan/3D (E first), deliberately:**
    every semantic field except camera target and framing must stay identical, and the diff is
    reviewed step by step.
  - Mutation: restoring `planCam()` on flip must fail the paper axis.
- **Visual / manual QA.** Tilt feel on the thumb, the detent snap, the mat ↔ vellum crossfade
  (timing stays PLATE's open call), and the reduced-motion cut.
- **Prototype-only.** `fly` interpolation (`camera-motion` stays production's mechanism) and the
  tiny-FOV flat projection.
- **Harvest.** The flip as viewing intents (tilt about target, keep scale, detent, working
  elevation), the preserved/changed/never table, and the QA invariants.

### PA4 · Two homes: the Index's Search and Browse, and Find

- **Accepted behaviour.**
  - Subjects are found in the Index (`/` focuses Search, including in the narrow sheet). Results
    offer Select, Open location, Bring into view and Reveal, each acting directly on its own
    row, with no prior selection.
  - Capabilities are found in Find, inside the Instrument (⌘K, More, later the Card's ⋯ and the
    context menu). Find shows a "For …" group from the selection, then families, with keys on
    every row.
  - Find never selects, never lists subjects and never moves the camera.
  - Each home has one handoff row carrying the query and a count.
- **Replaced / preserved.**
  - The `#finder` modal dialog (`openFinder`, `finderInput`, `finderList`) moves into the Index
    as its Search field and results.
  - `renderBrowse`, `browseVerbs`, paging and the *Selected elsewhere* row are preserved
    verbatim.
  - The Enter / ⇧Enter result keys stay (Enter = Select, ⇧Enter = Open location).
  - ⌘K moves from search to Find.
- **Files / seams.**
  - New `app/capabilities.js`: the registry of §0.8.4's fields (id, label, synonyms, family,
    form, subjects/hosts, owner, consequence class, precision schema, legibility, order, key).
    Placement is computed from the fields.
  - `tasks.capabilities(id)` becomes a query over the registry, so existing Look verbs keep
    their ids.
  - `ui.js` gains `renderIndexSearch` and `renderFind`; the Instrument gains a `find` state;
    `main.js` loses the finder modal handlers.
- **State owner.**
  - The Index owns the query and the Browse context (never the selection).
  - Find's query is Instrument state for the life of Find.
  - The registry is code, never data.
- **Interaction / cancellation.**
  - Choosing a tool arms it (after PA6), a procedure turns Find into it in place, and a setting
    opens its owner.
  - Esc closes Find (ladder level 5).
  - Opening Find cancels a held proposal only if one is open (`cancelProposal('find')`).
- **Semantic QA.**
  - browse-check: retarget selectors from `#finder*` to the Index Search. All 60 observations
    keep their meaning, including "a row's verb acts on the row's subject" and Bring into view
    without selection.
  - paper axis: ⌘K opens Find in `#instrument`; Find rows never carry `data-sel`; the selection
    and realized camera are unchanged after any Find use; "harbor" yields only the handoff row
    with count 1; the Index's "door" query yields a handoff to Find; `?` opens Find on Keys.
  - interaction-check: `/` + Enter still selects.
  - Mutation: Find selecting a subject must fail paper; Bring into view selecting first must
    fail browse.
- **Visual / manual QA.** Index Search density at 248 px and Find row legibility.
- **Prototype-only.** The registry's JS literal, the fuzzy matching and the synonym lists.
- **Harvest.** The registration contract fields, the placement computation, the two-homes table,
  handoff copy and the result verb grammar.

### PA5 · Card facts, kind line, scoped list, Dimensions and commit grammar

- **Accepted behaviour.**
  - The Card shows:
    - its name, the one writable fact (F2 or double-click);
    - the kind line, with a Wall's derived role (*bounds …*, *divides … ↔ …*, *free-standing
      in …*) and no role ▾;
    - at most three read-only key facts, each a door to its writer;
    - a condition line only while true (Repair, Resume, Bring into view);
    - Look · Details;
    - ⋯, opening the scoped list in Find.
  - The context menu on Stage lists the same scoped list in the same order.
  - Dimensions replaces Precision. It is the one shell writer of settled measures and is reached
    by ↵, by a fact door, or by a tag click.
  - Fields commit on ↵ as one step, and *Done* closes. Undo/Redo are unavailable, with a reason,
    while a gesture or proposal is live.
  - Door ↔ window is the one kind-word change in the fixture: identity and name are kept, and
    consequences show in the Instrument.
- **Replaced / preserved.**
  - The Card's "In place: Measure" (`look-dims`) leaves Look; Dimensions is reached through
    facts and ↵.
  - The Precision panel (`#precision`, `precisionGroups`) is renamed and kept as Dimensions,
    with the same writers (`applyField` → `editOnce` → `apply*`).
  - `cardWall/cardOpening/cardCeiling/cardScene` gain the facts and kind line.
  - Details is preserved.
  - Ordinary-Card protections are preserved: no writable number, no ownership catalogue.
- **Files / seams.**
  - `ui.js` card renderers, `factsHtml` and `numbersOf`, now through the registry's precision
    schema;
  - `tasks.js` (`IN_PLACE` → `dimensions`);
  - `main.js` keydown (↵ via `keys.js`), `contextmenu` (open on a right click without a drag;
    right-drag still pans or orbits);
  - `actions.js undo/redo` guard;
  - `model.js validateOpening` reused for the door ↔ window flip.
- **State owner.**
  - `S.sel` (identity);
  - `S.task` with `kind: 'dimensions'` (writer and focus field);
  - the kind change is a procedure task.
- **Interaction / cancellation.**
  - A field Esc restores first, then closes (ladder levels 1 and 5).
  - A live handle drag shows the matching Dimensions field as a display ("being set on Paper").
  - Opening the scoped list never changes selection.
- **Semantic QA.**
  - shell-check: rewrite the verb assertions as Look-only lists (`look-face look-unroll` for
    the Rotunda, `look-lift look-lookup` for the soffit). Add: the Card has no element with
    `data-act` outside Look, Details, ⋯, the name and the condition doors; ≤ 3 key facts; facts
    are buttons opening Dimensions on the named field.
  - precision-check: rename Precision → Dimensions with the same 38 meanings. "In-place
    Measure" becomes "fact door to Dimensions".
  - paper axis:
    - the Wall kind line is derived and has no ▾;
    - door ↔ window keeps id and name, and one Undo step restores;
    - Undo is refused while a proposal is live;
    - the context menu order equals the ⋯ order equals Find's "For …" order.
  - repair-check: the condition line offers Repair.
  - Mutation: a writable number on the Card must fail paper.
- **Visual / manual QA.** The title-block line (kind and facts) at 288 px, fact doors'
  affordance, and context-menu placement.
- **Prototype-only.** Fact selection per kind (fixture-shaped) and copy that names fixture
  values.
- **Harvest.** Facts-versus-work rules, fact doors, the scoped-list ordering law, the commit
  grammar, the Undo-unavailable copy, and the derived-role kind-line vocabulary.

### PA6 · Rail framework, Select and Measure

- **Accepted behaviour.**
  - The rail is **Select · Draw · Opening · Place · Measure · More** (V W O P M; More opens
    Find).
  - A tool stays armed until Esc or V, and arming never changes the selection.
  - The option strip holds only the next-stroke defaults and a fading key hint.
  - Tool input is gated by legibility.
  - Measure takes temporary distance and angle readings, which are never authored and never
    in Undo.
- **Replaced / preserved.**
  - Select is today's pointer behaviour, unchanged.
  - The prototype's `o`, `p` and `m` keys move (§6): the `openSelected` paths remain through
    Look and Find, Precision through ↵, and mirror through a Look-up Instrument control.
  - Draw, Opening and Place slots exist but refuse in words until PA7, PA8 and PA10 ("arrives
    in a later slice" is never shown as a disabled button; the slot opens Find on its family).
- **Files / seams.**
  - New `app/tools.js` uses the same `KIND`-style lifecycle as sessions:
    `TOOL[id] = { arm, pointer(e), key(e), disarm }`.
  - `main.js` canvas pointer handlers consult the armed tool before the camera drag. The
    existing knife path stays a Look gesture.
  - `ui.js renderRail/renderStrip`, `draw.js` Measure overlay.
- **State owner.**
  - `S.tool = { id, variant, defaults, host }` and `S.gesture` (the live gesture), both session
    state.
  - Measure readings live in `S.gesture` only.
- **Interaction / cancellation.**
  - Esc cancels a live gesture first and the tool stays armed; a second Esc disarms to Select.
  - `cancelProposal('tool')` covers disarm, a lens crossing and a selection change mid-gesture.
  - A gesture is a proposal for Undo-guard purposes.
- **Semantic QA (paper axis).**
  - The rail has exactly six slots in order, and each slot's key arms it.
  - Arming leaves `S.sel` unchanged.
  - The Esc ladder: gesture → tool → Select.
  - Measure writes nothing (digest and Undo depth are unchanged).
  - A lens crossing disarms, and return shows the Select rest.
  - shell-check: "no permanent tool tray" (`.tray, [data-tool]`) is replaced by "no
    twelve-button tray; exactly six rail slots".
  - Mutation: arming that selects must fail.
- **Visual / manual QA.** Rail and strip fly-out, the cursor per tool, Measure tags against
  declutter.
- **Prototype-only.** `tools.js` plumbing and Measure's overlay drawing.
- **Harvest.** The admission rule, the arming rules, the strip contents rule, and the Esc ladder
  levels for tools.

### PA7 · Opening: host-seeking, host-first

- **Accepted behaviour.**
  - Opening seeks an eligible host under the pointer, projects onto the host axis, refuses
    ineligible hosts in words, and stays armed from host to host.
  - A selected host (or a selected opening's host) wins ties; that preferred host is task focus.
  - The gesture cuts an embedded opening in the host's coordinates.
  - Connectivity changes are shown when earned (a door through a shared bound joins rooms).
  - The new opening becomes selected, in one Undo step.
- **Replaced / preserved.** New creation. The existing opening kit, handles and validators
  (`drawOpening`, `sAlongPointer`, `validateOpening`) are reused as is. Openings on arcs are
  supported, because `s` is arc length.
- **Files / seams.**
  - `tools.js TOOL.opening` (strip: Kind door/window, width);
  - `actions.js applyNewOpening`, through the validated path and `editOnce`;
  - id allocation in `actions.js`, with references continuing the fixture's `O-` series;
  - `topology.js` connectivity (`connectsRooms`) for the consequence tag.
- **State owner.** `S.tool.host` (focus). The source write is the snapshot edit.
- **Interaction / cancellation.**
  - Hovering shows a ghost and a width tag; a refusal shows at the pointer.
  - A click places; typing digits edits width at the gesture (production trigger rules, §6).
  - Esc cancels the ghost, then disarms.
- **Semantic QA (authoring axis).**
  - With North selected, O places on North even where the Rotunda wall also qualifies.
  - With nothing selected, hovering the Gallery door reads *Overlaps Gallery door* and the
    click writes nothing.
  - A placed door on the shared Rotunda arc reports the two rooms it connects.
  - Undo restores, and the camera is unchanged.
  - The new opening's handles work through the existing kit.
  - The digest returns to `650e93c4` after Undo.
- **Visual / manual QA.** The ghost on curved walls, refusal legibility, and host projection feel.
- **Prototype-only.** Id allocation and the absence of a door swing.
- **Harvest.** The host-seeking contract, the host-first tie-break, refusal copy, and "Kind names
  its host class".

### PA8 · Draw walls: the role is derived and explained

- **Accepted behaviour.**
  - Draw authors Walls (chain and rectangle first; circle and polygon optional, §10) and asks
    nothing about role.
  - Endpoints snap to wall ends, onto wall lines (T junctions) and to the snap increment; Shift
    constrains the angle.
  - Digits type length at the gesture, and ↵ ends the chain.
  - During the gesture, a role tag (*free-standing*, *divides Long Gallery*, *closes a room*)
    and the room consequence (new room tint and label, hatch with reason) preview from topology
    over the candidate.
  - Release or ↵ commits one Undo step, and the Wall becomes selected.
  - Drawn walls get end and body handles; moving an end can change the derived role, with the
    consequence shown during the drag.
- **Replaced / preserved.** New creation. Fixture walls keep their #112 handles (top, openings)
  and gain none. New walls get the defaults `thick 0.20`, `top constant` matching the room they
  start in, and `openings: []`, and pass `validateWall`.
- **Files / seams.**
  - `tools.js TOOL.draw`;
  - `actions.js applyNewWalls` through `editOnce`;
  - **`stage.js syncMuseum(m)`**: reconcile item ids (add or remove wall, object and structure
    items; rebuild derived room fills). `restoreQuiet` calls it, so Undo and Redo of creation
    work.
  - `topology.js` candidate evaluation, read-only;
  - `draw.js drawPlan` (derived room fills and labels, role tags, consequence marks).
- **State owner.** `S.gesture` (chain points, snap target). The topology preview is derived,
  never stored.
- **Interaction / cancellation.**
  - Esc removes the open segment, then stops the chain without committing, then disarms.
  - An invalid segment refuses at the pointer, and a refusal on release writes nothing.
  - A lens crossing mid-gesture cancels it (invariant 7).
  - Undo is unavailable while drawing.
- **Semantic QA (authoring axis).**
  - A free chain inside Long Gallery commits one Wall described *free-standing in Long
    Gallery*, with no new room.
  - A chain from North to South divides: R-LONG survives on the larger part and one room is
    born and named. The kind lines of North and South list both rooms.
  - A rectangle on open floor west of the museum closes a new room.
  - Undo of each restores digest `650e93c4`, and Redo restores the same ids (no rematching).
  - The role tag during the gesture equals the committed description.
  - **No role field is ever written** (static check: no `role` key in `ctx.museum.walls`).
  - Mutation: adding a role chooser that writes `role` must fail authoring.
- **Visual / manual QA.** Draw feel, snap mark clarity, tag placement while drawing, consequence
  tint readability on vellum, and the free-standing versus boundary drawing weight.
- **Prototype-only.**
  - No junction records; noding is virtual inside `topology.js`, so authored walls are not split.
  - No bend handle on drawn walls.
  - Derived rooms without an authored floor get a Paper fill only, with no 3D slab.
  - Ceilings stay authored outlines.
- **Harvest.** The Wall authoring contract, the gesture-time role and consequence preview, the
  role vocabulary and copy, the topology acceptance journeys, and Esc for chains. Production
  authority is the layout-core wall-chain planners after the Wall-role cutover.

### PA9 · Divide: a procedure through Wall authoring

- **Accepted behaviour.**
  - *Divide…* (first in a room's scoped list, and in Find) turns the Instrument into a
    procedure: place the line (across or along, offset field plus a draggable divider on
    Paper), Resolve, Apply.
  - The new Wall takes the room's thickness and height.
  - Validation shows the caution ▲ and the refusal ⊘ beside their causes.
  - Consequences use the grammar Creates · Keeps · Splits · Moves (derived) · Connects ·
    Elsewhere.
  - Apply ⌘↵ makes one Undo step. The mechanism is the same Wall authoring path and topology
    as PA8.
- **Replaced / preserved.**
  - New. It reuses PA8's `applyNewWalls` and `topology.js`, `validateOpening` (an opening
    straddling the new junction) and `validateArtPlacement` (art the new wall would cover).
  - "Elsewhere" counts Experience references from the bridge fixture (`PRESENTATION`). Camera
    counts are omitted, because the prototype has no Camera connectivity, and the row says so.
- **Files / seams.** `actions.js` procedure task (`kind: 'procedure', id: 'divide'`),
  `ui.js renderInstrument` procedure frame (steps, parameters, validation, consequences,
  Cancel/Apply), a shared `consequences(before, after)` in `topology.js`, `draw.js` divider
  proposal.
- **State owner.** `S.task` (procedure parameters, proposal); `S.task.focus` emphasises
  consequence rows. The Card keeps showing accepted values.
- **Interaction / cancellation.**
  - The divider drag and the offset field are one proposal with one live writer.
  - Esc or Cancel discards with no history. Undo is unavailable while the proposal is open.
  - A lens crossing cancels the proposal and parks the procedure. Resume, with R-LONG selected
    and the targets valid, reopens Divide **fresh** at its defaults (PLATE §0.8.2).
  - The optional passage and the born room's name are one atomic snapshot here; production
    needs a composed plan (§11 dependency 2).
- **Semantic QA.**
  - authoring axis:
    - the Clerestory refusal at the fixture offset and the Harbor caution;
    - Apply is unavailable while refused;
    - a valid Apply yields one Undo step labelled *Divide Long Gallery*;
    - the consequence rows equal the topology diff;
    - the Card shows accepted area until Apply.
  - lens-check: Divide parks, never resumes on return, and Resume opens fresh; with the selection
    changed, Resume is explained.
  - repair-check line 179: Repair accept moves from Enter to ⌘↵.
- **Visual / manual QA.** Instrument height ≤ 45 % of the Stage; the divider drag; consequence
  emphasis on Stage.
- **Prototype-only.** Fixture-specific copy and numbers, and the omitted Camera count.
- **Harvest.** The procedure frame, consequence grammar and "earned" rule, the Divide journey
  (intent → line → resolve → apply → undo), parking and fresh Resume for procedures.

### PA10 · Place, and selection sets

- **Accepted behaviour.**
  - Place puts catalogue items (Scene: Bench, Vessel; Layout: Plinth/Column structure) at a
    point and dispatches each to its owner, which is named.
  - Structures show a kind word (Plinth ↔ Column, placement kept).
  - Objects and structures take body and rotate handles with clearance tags.
  - **One canonical selection value that may be a set:** ⇧-click adds or removes objects and
    structures. The Card shows the set as one identity (count, kinds, extent), and Align and
    Distribute sit in the set's Dimensions and scoped list.
- **Replaced / preserved.** The existing `objects` are preserved. New `structures` are a Layout
  collection of boxes or cylinders. Sets are offered only where the kinds support them.
- **Files / seams.**
  - `model.js` (`structures`, `validateStructure`);
  - `stage.js` buildStructure plus `syncMuseum`;
  - `tools.js TOOL.place`;
  - `actions.js select` (a set value) and `applyPlacement`;
  - `ui.js` set Card.
- **State owner.** `S.sel` (string or `{ kind: 'set', ids }`). Placement is a snapshot edit.
- **Interaction / cancellation.**
  - A placement ghost follows the pointer, and Esc cancels then disarms.
  - Moving a set is one gesture and one step.
  - A lens crossing keeps a set as the canonical value and represents it honestly in the
    Experience bridge (foreign selection rule).
- **Semantic QA.**
  - authoring axis: a placed Plinth is owned by Layout and a Bench by Scene, and each Undo label
    carries its owner; Plinth ↔ Column keeps id and placement.
  - paper axis: a set is one `S.sel` value; Find never writes it; Align is one step.
  - Mutation: a parallel `S.selSet` must fail paper.
- **Visual / manual QA.** Catalogue choice in the strip, rotate feel, set contour.
- **Prototype-only.** The catalogue contents and box/cylinder geometry.
- **Harvest.** Owner dispatch at Place, the set-as-value rule, the set Card, and Align/Distribute
  placement.

### PA11 · Narrow desktop, keyboard completion, Esc ladder

- **Accepted behaviour.**
  - Below about 1180 px the Index becomes a Head location control and sheet (`/` opens it with
    Search focused), and the Card becomes a Head identity chip and sheet.
  - The context menu and Find reach the scoped list without the sheet, and a procedure closes
    the Card sheet.
  - Sheets overlay and never resize; nothing refits.
  - ⌘\ hides the side panels at any width.
  - Arrows nudge by the snap step and ⇧ arrows by 1 m; Tab walks handles.
  - The full §6 keymap and Esc ladder are in place.
- **Replaced / preserved.** #112's narrow sheets (`toggleSheet`, `applySheets`, `closeSheets`)
  are preserved and re-homed to the Head controls. The Look keys `f u k s` stay as prototype
  accelerators shown in Find rows.
- **Files / seams.** `keys.js`, `ui.js` Head controls, `main.js` sheet handlers, `styles/`.
- **State owner.** `S.sheets` (disclosure only).
- **Interaction / cancellation.** Exactly §6.
- **Semantic QA.**
  - responsive-check: 1440×900, 1280×800, 1024×768 and DPR2, with the realized pose unchanged
    across sheet toggles and resizes.
  - paper axis: every §6 key does what the table says in each context, and 1 and 2 never flip
    while a gesture or field owns digits.
  - correctness: the ⇧Esc chain.
- **Visual / manual QA.** The Head controls at 1024, sheet focus return, the visible keyboard
  focus (PLATE's open call; no new treatment ratified).
- **Prototype-only.** The breakpoint value.
- **Harvest.** The narrow composition rules, the complete keymap, and the Esc ladder.

### PA12 · Integrated acceptance and harvest

- **Accepted behaviour.** None new. Proves the whole contract and closes the evidence.
- **Work.**
  - Run `qa/run-all.sh` across all thirteen axes, the mutation checks (existing two plus the
    seven added above), and the journey baseline with the deliberate PA2 and PA3 diffs
    recorded.
  - Add new specimens to `scripts/shoot.sh` (rest, drawing, divide, Find, narrow).
  - Update `qa/ACCEPTANCE.md` (counts and limits), `IMPLEMENTER-REFERENCE.md` (new seams:
    `keys.js`, `capabilities.js`, `tools.js`, `topology.js`, `syncMuseum`, flip), the prototype
    README, and §9's map.
  - Run the architecture lane and docs gate.
- **Semantic QA.** As above. Zero faults and zero console errors.
- **Visual / manual QA.** The owner's walk-through of the journeys in §7.
- **Harvest.** §9 updated with links to the exact assertions.

## 6. Keymap (settled for the prototype; recommended destination)

Audited against the current prototype bindings (`main.js` 1031–1102, finder, typein) and
production (`hooks/shortcuts.svelte.ts`, `layout/plan-numeric-entry.ts`,
`plan-keyboard-session.ts`, `editor-command-intent.ts`). No blocking conflict exists, so `/` stays
subject Search and ⌘K becomes Find.

| Key | Destination meaning | Context rule | Prototype today | Production evidence |
| --- | --- | --- | --- | --- |
| V | Select (disarm) | not while a field has focus | unbound | unbound |
| W | Draw | not in a field | unbound | W/T = Scene gizmo translate (refused while a Layout selection is active) |
| O | Opening | not in a field | `openSelected` (unroll / face / lift / knife) | unbound |
| P | Place | not in a field | Precision | unbound |
| M | Measure | not in a field | mirror (Look-up) | unbound |
| `/` | Index Search, opening the sheet when narrow | not in a field | Search | unbound |
| ⌘K | Find | anywhere; prevents the browser default | Search | unbound |
| 1 / 2 | Paper / 3D | only when no live gesture and no field owns digits | Plan / 3D | digits start numeric entry **only during live gestures** (`planNumericEntryTrigger`) |
| G | Grid on/off (the one Grid fact) | not in a field | Wall grid | ⌘G / ⇧⌘G group/ungroup (modifier, no clash) |
| `?` | Find on Keys | not in a field | help (also `h`, dropped) | unbound |
| ↵ | commit the focused field; else open a live knife line; else Dimensions for the selection | ladder order as listed | knife commit; Repair accept | two-step Enter (enter the selection's control group, then the numeric door) |
| ⌘↵ | Apply the open procedure | only with a procedure open | unbound | unbound |
| Esc | unwind one level | ladder below | similar chain | chain ending in deselect |
| ⌥ held | suspend snap for the gesture in hand; values round to the 0.01 m display precision | on a handle or drawing gesture; ⌥-drag on empty Stage tilts | 0.01 m fine snap on handles; ⌥-drag orbits or pans | macOS ⌥ = Scene cycle-placement and camera handles; Shift bypasses grid snap in Scene transforms; Ctrl/⌘ enables gizmo snap; meta/alt = wall bend |

**Esc ladder:**

1. a focused field restores;
2. a live gesture or Look aim cancels (the tool stays armed);
3. help, beacon, popover, scale menu, Sheet or a narrow sheet closes;
4. a procedure's proposal cancels and its Instrument closes;
5. Find or Dimensions closes;
6. an armed tool returns to Select;
7. a Look session steps Back (⇧Esc = Put it back, the whole chain);
8. the selection clears;
9. rest.

**Kept:**

- Shift constrains the angle while drawing; ⇧-drag pans in 3D; ⇧-click toggles set membership
  (PA10).
- `[` `]` step the trail.
- `f u k s`, `-` `=`, Tab and the arrows keep their Look-session meanings while a session or knife
  is live.
- `j` opens the journeys presenter.
- ⌘Z / ⇧⌘Z undo and redo.
- ⌘\ hides the side panels.

**Recorded for the production planner (not blocking the prototype):**

- W conflicts with the landed Scene gizmo keys (W/E/R/T). World Paper has no Move/Rotate/Scale
  commands, so the cutover decides whether gizmo modes survive outside Paper.
- F means frame-selection in production but Face in the prototype.
- Snap control has to converge: production's Shift-bypass and Ctrl/⌘-enable versus ⌥ suspension.
- macOS ⌥ already means Scene cycle-placement and camera handles; it resolves per hit kind.
- Production's two-step Enter maps onto Tab/handle traversal plus digits.

The binding table is named commands (PA0), matching production's exact-match, remappable
command-intent pattern. Snap has no letter key, because S stays square-up.

## 7. Acceptance journeys (reusable, semantic)

These journeys are scripted on the paper and authoring axes and are written to be reusable as
production acceptance. They are stated as behaviour, never as DOM.

- **P1 Read the drafting state.** At rest the creator reads the scale, grid and snap without
  opening anything. Toggling grid with G changes the word and the drawing, never Undo.
- **P2 Flip without losing place.** With North selected and Opening armed, 2 then 1 returns to the
  same target and scale. The tool, selection and Instrument survive.
- **P3 Find a capability, search a subject.** ⌘K "divide" (room selected) puts the procedure
  first. "harbor" hands off to Search. In the Index, Bring into view acts without selecting.
- **P4 Draw free, then divide by drawing.** A free Wall is described *free-standing*. A Wall from
  North to South divides Long Gallery; the role is previewed during the gesture, and Undo
  restores the digest.
- **P5 Divide by procedure.** The Clerestory refusal, the Harbor caution, Apply ⌘↵, then Undo.
- **P6 Opening host-first.** Select North, press O, place a door; refusal on the Gallery door.
- **P7 Card as identity.** Facts open Dimensions; ↵ commits a field; door ↔ window keeps identity;
  Undo is refused during a proposal.
- **P8 Cross and return.** Divide open → Experience → World shows rest. Resume opens fresh. An armed
  tool is disarmed.
- **P9 Narrow.** At 1024 px, `/` opens the Index sheet with Search; a procedure closes the Card
  sheet; the pose is unchanged.
- **A–F** keep passing unchanged except for the recorded PA2 and PA3 camera re-baselines.

## 8. QA plan

- **New axes.** `paper` (shell, reading, discovery, Card, keys, narrow) and `authoring` (topology,
  tools, Opening, Draw, Divide, Place). Each is one browser session per the browser-test-hygiene
  skill, uses one eval per block, and asserts behaviour through `window.__me` plus DOM inventory.
- **Updated axes.** shell, browse, precision, repair, lens, responsive and flows, as each slice
  states. The meaning of every existing observation is preserved; only selectors and keys move.
  The full set runs at PA12.
- **New probes on `window.__me.qa`** (read-only):
  - `topology()`: rooms, areas, relations, role descriptions;
  - `tool()`: id, variant, host focus, gesture summary;
  - `paper()`: grid, snap, increment, scale word;
  - `consequences()`.
- **Mutation proofs to add**, each run on disposable copies only:
  - flip refit;
  - Find selects;
  - Bring into view selects first;
  - Card writable number;
  - role chooser writes `role`;
  - parallel selection set;
  - arming selects.
- **Baselines.** The fixture digest stays `650e93c4` throughout, because nothing edits the fixture
  source. There are exactly two deliberate journey re-baselines, PA2 (fit fields from the Stage
  rect) and PA3 (camera target and framing on Plan/3D steps), each with a recorded diff review.
- **Manual and visual.** Per slice, as listed. The feel of drawing, tilting, snapping and the
  consequence previews is judged by eye and recorded, never asserted from pixels.

## 9. Harvest and translation map

How to read this map:

- **Accepted behaviour** comes from PLATE §0.8.4.
- **Prototype mechanism** is what this plan builds.
- **Production authority** is who owns it after cutover.
- **Reusable QA** is the semantic assertion a production suite can port.
- **Prototype-only shortcut** must not be transplanted.

| Accepted behaviour | Prototype mechanism | Eventual production authority | Reusable QA | Prototype-only shortcut |
| --- | --- | --- | --- | --- |
| Interaction contract: six permanent families, admission by grammar | `tools.js` + rail render | editor World shell (Svelte), under PLATE §0.8.4 | six slots in order; key arms; arming never selects | `TOOL` table plumbing |
| Wall authoring, role derived and explained | `tools.js TOOL.draw` + `topology.js` candidate preview | layout-core wall-chain planners + canonical compiler after the Wall-role cutover (architecture §Ownership) | P4; no role written; role tag equals committed description | virtual noding, sampled overlap, no junction records |
| Room identity through division | `topology.js` reconciliation (evidence order) | layout-core P23.8 Room reconciliation | survivor on larger part, one birth, Undo restores ids | sampled overlap areas |
| Host-seeking, host-first | `TOOL.opening` + `S.tool.host` | editor tool layer + Layout opening planners/validators | P6; tie-break; refusal copy | id allocation |
| State transitions: arm → gesture → commit/cancel | `S.tool`, `S.gesture`, `cancelProposal` reasons | editor interaction session; Layout planner accept boundary | Esc ladder levels; no history on refusal | snapshot edits |
| Card facts vs active work; no verb row | card renderers + registry precision schema | editor Card component + per-kind fact schemas (domain-owned) | ≤ 3 facts; fact door opens Dimensions; no stray `data-act` | fixture fact choices |
| Two discovery homes | Index Search + Find in `#instrument` | editor Index + World Instrument; capability registry in the editor | P3; Find never selects; handoff rows | fuzzy match, synonym lists |
| Capability placement | `capabilities.js` registry → computed placement | editor capability registry (code, never authored data) | context menu = ⋯ = Find "For …" order | literal registry |
| Precision rules | live tag → S7 field → Dimensions → procedure | editor + `plan-numeric-entry` triggers + domain validators | one writer at a time; ↵ commits once; blur never commits | prototype tape DOM |
| Copy and state language | strings in `ui.js`/`model.js` validators | editor copy + domain validator messages | exact phrases for refusals, roles, Undo-unavailable, off states | fixture names and numbers |
| Drafting state vs configuration | `S.paper` words + Sheet | editor view-settings store (per-user preference, not project data) | Paper settings never in Undo or digest | 0.05 m default |
| Responsive behaviour | Head controls + sheets | editor shell layout | P9; no refit on resize/sheet | breakpoint value |
| Camera intents | `nav.flipTo/tiltTo`, Fit all, Bring into view | the one Camera authority via T1's viewport/projection seam | P2; target and scale kept; 90° detent | `fly` interpolation, flat projection trick |
| Cancellation and Esc | `cancelProposal` + `keys.js` ladder | editor session/command layer | Esc ladder journey; ⇧Esc chain | DOM event plumbing |
| Parking and Resume | `parkWorldWork` + procedure records | editor session (never F storage or Camera history) | P8; fresh Resume; refusal when targets changed | session-only records |
| Consequence grammar | `topology.consequences` + procedure frame | Layout planner results + read-only counts from Camera/Experience | rows equal planner diff; earned only | omitted Camera count |
| One selection value, sets | `S.sel` string or set object | editor active-selection facade (placement sets exist) | set is one value; Find never writes | set kinds limited to the fixture |
| Keymap | `keys.js` named commands | production binding table (command-intent pattern) | key → command per context | prototype accelerators `f u k s j [ ]` |

**Never harvested as code:**

- the prototype's DOM and CSS;
- the `S` store layout;
- snapshot Undo;
- `fly` and its easing;
- `topology.js` algorithms;
- the stage reconciliation;
- the fixture.

The production planner ports behaviour, copy, QA journeys and the ownership table, then implements
them in Svelte against production authorities.

## 10. Scope limits

In scope: everything listed in §5.

Explicitly out of scope:

- production code, persistence, formats, F interfaces;
- any Space, Zone, level, constraint, annotation or reference schema;
- bend or arc drawing on drawn walls (an optional PA8 extension only if the owner asks);
- circle and polygon Draw shapes (optional after chain and rectangle are accepted);
- junction records and authored wall splitting;
- generated ceilings for derived rooms;
- deletion of fixture walls;
- multi-level work;
- Experience V2 work (#113);
- touch, pen and trackpad feel studies;
- screen-reader listening trials.

## 11. Coordination and genuine dependencies

1. **Layout (production, open):**
   - migrating existing `partition` Walls;
   - whether a closed ring may be intentionally non-enclosing.

   The prototype has neither situation in its fixture and invents no rule. A drawn closed ring
   always encloses.
2. **Composed Layout plans (F.4)** for the Divide passage and naming the born room as one atomic
   result. The prototype's snapshot makes them atomic; production must wait for composed plans
   (PLATE §0.8.4 precision rules).
3. **Camera.** The flip, scale detents and Fit all become viewing intents through T1's shared
   viewport/projection seam. The prototype proves the behaviour, not the mechanism.
4. **Production keymap conflicts** (§6), owned by the production planner.
5. **View trail's visible home.** Retiring the status rail removes the trail strip. §0.8.4 does not
   place a trail, and PLATE §0.8 forbids shell-owned viewpoint history; the trail is
   navigation-owned. The prototype keeps `[` `]` and Find entries only. Non-blocking; the owner
   may decide later.
6. **Selection-set kinds.** The prototype limits sets to objects and structures. Which domain kinds
   support sets in production follows the selection facade's placement sets.
7. **#113 ordering — decided 2026-10-03.** #113 lands first (it is the current baton); Paper
   PA0–PA12 is the next PR after it, then the prototype detour closes. #113 edits the lens bridge,
   Head and `ui.js`, which PA2, PA4 and PA5 also touch, so PA2 onward rebases on #113's Head.
   - PA0 and PA1 conflict with nothing, but they land in the Paper PR after #113, not before it.
   - The Experience Deck is never touched by this plan.
8. **PLATE open calls** (keyboard focus treatment, mat ↔ paper timing) stay open. Visual work uses
   the existing treatments without ratifying them.

## 12. Recommended implementation sequence

1. PA0. Then PA1, which is domain-only and digest-stable and can be prepared without waiting on
   any other slice, all inside the Paper PR after #113.
2. After #113 merges (the decided order): PA2 → PA3, then PA4 → PA5.
3. PA6 → PA7.
4. PA8 (needs PA1) → PA9.
5. PA10.
6. PA11.
7. PA12, which closes with acceptance, harvest and docs, using the slice-closeout skill.

Each slice is one reviewable change with its axes green before the next starts.
