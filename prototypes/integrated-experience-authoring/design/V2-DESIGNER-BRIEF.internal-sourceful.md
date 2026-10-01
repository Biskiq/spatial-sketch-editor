# Prototype V2 — Designer Brief

**Status:** brief for interaction-state PNG proposals. Not a design, not an implementation plan.
**Audience:** a frontier designer who has not read this repository.
**What V2 is:** an integrated authoring prototype around **one project with one real spatial Stage**:
a creator points at a World subject, makes visitor meaning (Presentation), frames it (View),
optionally orders it (Guide of Stops), and checks it in a visitor takeover (Preview) —
without changing application, resetting the camera, or building an abstract tree first.
**Deliverable:** interaction-state PNG boards (§13). Grammar and constraints first, pixels second.
Do not copy any screenshot; invent states from the grammar in §§4–12.

**How to read this brief:** §1 is non-negotiable. §2 is the preferred shell/visual language —
challenge it only with something clearly stronger, never by accident. §3 is yours to decide.
§§4–12 are the working grammar. §11 lists what must not come back. Open design-round
questions are marked **OPEN** — resolve everything else yourself and keep it consistent.

Provenance rule (applies throughout): **ratified reference contracts override prototype
shortcuts.** Prototypes demonstrate interaction intent; where a prototype and a ratified
contract disagree, the contract governs. Key sources are listed in §14.

---

## 1. Locked — preserve these

| # | Decision | Authority |
|---|----------|-----------|
| L1 | **One project, two lenses.** World and Experience are creator-facing lenses over one project, not merged documents and not two applications. There is no `WorldDocument`. Lens switch changes available edits + index, never renderer, pose, selection, or history. | Ratified 2026-09-29 amendment; `docs/World-Experience-Shell-V2-Design.md` §§1–2 |
| L2 | **Domain ownership.** Layout owns architecture; Scene owns object composition/world presentation; Camera owns views, routes, framing, projection, evaluation; Experience owns visitor composition (Presentations, Stops, order, Gates, invocation context); typed resources are their own versioned system. One writable owner per fact. Never merge domains in the UI. | North-star ratification 2026-09-27; `docs/reference/north-star.md`, `docs/reference/architecture.md` |
| L3 | **One Camera authority.** Guided travel, free look, reduced motion, film, future XR all realize intent through one Camera authority. No second navigation graph, no independent pose/FOV interpolation, no `ExperienceScene/CameraGraph`, no writable node-order beside Guide order. The current `camera-route.ts` curve/guard mechanism is replaceable implementation, not the guarantee. | Ratified §§5–6; architecture hard-don'ts |
| L4 | **Presentation / Stop / visit identity triple.** Presentation = reusable visitor meaning (focus + explanation + Views + Activities + Interactions; non-sequential, Guide-optional). Stop = one stable occurrence presenting a whole Presentation (entry View, pacing, continuation, Gate are occurrence-local). Visit/run = one session's runtime identity. Never clone meaning to order it; repeating `Add to Guide` makes a new Stop ID over the same Presentation. | Ratified amendment; F.1–F.2 |
| L5 | **Camera vs Experience split.** Camera owns framing/projection/routes/motion; Experience owns use, binding, activation. Only Camera-declared inputs vary locally — no generic XYZ/FOV patch controls. `Cut` picks a View without inventing an edge; `Travel` needs a supported route or reports a gap. | Ratified amendment; shell proposal §6 |
| L6 | **Execution honesty.** Exclusive conflicts reject by default; only declared replacement/handoff on supporting families. Unconditional last-command-wins is rejected as global policy. Stale runs can't reclaim. Publication requires executable closure; drafts may hold explicit unresolved bindings. No silent name/proximity retarget, no null-View fallback: `Keep visitor view` is an explicit authored policy. | Ratified amendment + F.1/F.4/F.5 |
| L7 | **Preview is a visitor takeover, not a third editing lens.** Authoring chrome (Index, Work Card, tools, gizmos, selection, history) is absent in Preview. Runs on detached session state; never writes visitor results to World/Experience source. Exit restores exact authoring context (lens, selection, card, standpoint, inspection). | Shell proposal §8; architecture visitor isolation |
| L8 | **One canonical selection.** One selected identity across lenses. A subject selected in World stays selected into Experience (card changes from source edit to visitor actions). `Working on: [Presentation]` authoring context is never a second selection. | Shell proposal §4 |
| L9 | **P26 supplies the spatial Stage and representation language** (continuous standpoint, OPEN displacements, SETTLE/scale contract, membership/`whereIs`, one-writer numbers — §5). **Experience V1.1 supplies behavioral evidence only, never its shell** (§11). | `prototypes/README.md` authority semantics |
| L10 | **Three materials only, role-bound type, state language** per §10. No 4th material, no pills/cards-in-panels, no hue-alone state, no merged hover/armed/selected/focus. | PLATE shell contract (durable, owner-ratified) |
| L11 | **Visitor isolation.** Visitor surfaces carry no editor session, selection, history, gizmo, layout UI, or authoring infrastructure. Shared runtime-safe evaluators are fine; editor machinery is not. | Architecture; L7 |
| L12 | **C2 is out of V2 scope.** The only carry-forward from that work is the **scope/reach communication pattern**: every control declares what it writes and how far the write reaches (§8). Do not import any other C2 structure. (Exact C2 provenance is an owner-side question, not a design-round question.) | Brief-level decision |

---

## 2. Strong direction — use this, challenge only with something better

| # | Direction | Notes |
|---|-----------|-------|
| S1 | **One spatial workbench + contextual Work Card.** Project Head (identity, save/undo, World\|Experience switch, active Experience ▾, Preview, Publish) · left Index (locator) · central Stage (largest) · right Work Card (action surface) · bottom deck only when needed (Guide **or** Direction, never both permanent) · quiet 24px status rail, readout-only. | Proposal §§2–3; composition numbers in §10 |
| S2 | **Desired visual language = dark cutting mat + vellum + ochre.** Mat `#1D3A33`/bg `#152C26`/grid `#2B5147`/`#3C6A5C` for modeling; vellum `#F3F4EE` + 1m/5m grid for drafting; ink `#202422`/`#3E4440`; ochre selection core `#E5A020` / dark boundary `#8A5B10` / quiet fill 10%. Chassis quiet, instruments manufactured-compact. Landed production still paints the older light chrome — design to the target, not to production pixels. | PLATE §0.7 desired-from-demo; §10 |
| S3 | **Work Card header declares edit scope before any edit:** `World source` / `Presentation` / `Camera View` / `This Stop`. A subject selected in Experience shows World facts read-only + `Edit in World` / `Present this`. Shared edits show impact counts (`Update everywhere (n)` vs `Change only here`). | Proposal §§3–6; L4–L6 |
| S4 | **Progressive Camera disclosure, four depths:** Auto → Hints (near/far, side, height, look-at, movement, in direct language) → Use-my-view (explicit capture) → Precise Direction instrument (observer/target, lens/projection, route, anchors, motion profile, evaluated path). No timeline unless coordination work actually needs it. | Proposal §6; §7 |
| S5 | **First-use capture rule.** First use of a subject in Experience = capture View + bind Presentation (+Stop if guided). `Suggested framing` is a temporary preview until explicitly accepted; `Use my view` captures only eligible Camera parameters — never editor trails, cuts, selection, or gizmos. | F.4; proposal §5 |
| S6 | **Guide is optional and late.** No Guide, Stop, or View checkpoint is created when a Presentation is created. `Add Guide` is intentional; dragging/`Add to Guide` makes one Stop. Default Next follows Guide order. Manual Next stays available unless deliberately gated; narration/travel duration never implicitly gates. `duration ≠ permission`; Cancel/Finish/Continue are distinct. | Proposal §§5,7; behavior model §§12–14 |
| S7 | **Return grammar, not tab markers.** Esc walks back one nested inspection; first crumb returns to base standpoint; `Return to …` / `put it back` labels. View trail is separate from Undo (⌘Z edits source only, never moves camera). Source edits survive putting the view back. | P26 journeys; proposal §4 |
| S8 | **Instrumentation over inference.** V2 must make selection, working Presentation, stage recipe, authored unit touched, and visitor invocation observable. Failures show as typed states with repair actions, never as silent fallbacks. | Proposal §§9,12 |

---

## 3. Open design territory — decide deliberately

| # | Territory | Brief guidance |
|---|-----------|----------------|
| O1 | Standpoint control form | Continuous tilt with Plan/3D endpoints is locked; the control's exact form, placement, and how SETTLE/scale declaration reads are open. |
| O2 | Navigator / Inspector hierarchies within Index and Work Card | Ownership and roles are locked; tree depth, grouping, relation views (`3 Presentations about Piano`), and when card sections appear are open. |
| O3 | Guide deck and Direction deck detail | Deck-when-needed and never-both-permanent are strong direction; card order, stop-card density, route-map overlay form are open. |
| O4 | `Make Stop from this View` semantics | Trial in V2: entry-framing override on the same Presentation (default) vs explanation checkpoint. Have creators predict before Preview; record surprise. |
| O5 | Detour semantics | Trial in V2: pause parent explanation + auto-viewing, resume from actual pose without replaying entry (default) vs ordinary departure/re-entry. Experimental, not policy. |
| O6 | Dense-project scaling expression | Counts + collapse + pin are locked behaviors (§12); their visual expression at 1280×768 and in the deck is open. |
| O7 | Motion-speed placement; focus-ring treatment; mat↔paper transition | Explicitly open in PLATE §0.7.6 — do not copy the P26 demo's Status-Rail speed slot (it violates readout-only). Propose; flag as provisional. |
| O8 | Copy and tone | `Present this`, `Use my view`, `Edit in World`, scope headers, refusal reasons — voice is yours; the distinctions they carry are locked. |

---

## 4. Shell thesis and information hierarchy

**Thesis: keep the world in place; change the authoring intention around it.** A creator points
at a subject, works on it, and makes it meaningful to a visitor without moving application,
resetting the camera, or building a tree first.

```text
Project
├─ World lens → source truth + intrinsic capability (subjects, structures, environment)
├─ Experience lens → active Experience: Presentations (reusable meaning)
│                     + Experience-wide Interactions + optional Guide of Stops
├─ Shared Camera authority → Views, routes, framing, projection, evaluation
├─ Shared typed resources → states, performances, media, definitions
└─ Preview / Publish → selected Experience at an accepted revision
```

Primary creator objects are **subjects** and **Presentations**. Guides are optional compositions.
Runtime never writes World truth. Temporary inspection (section cuts, unfolded walls, selection,
editor visibility) is never captured into visitor behavior by accident.

---

## 5. Continuous Stage and P26 spatial language

- **STAND:** one continuous camera. Plan = camera tipped to elevation 90°; 3D, Face, Section,
  Look-up are standpoints, never modes or workspaces. Same model, measured Plan, not a second document.
- **OPEN:** displacement is temporary view state, always reversible and always badged `view only`:
  curved wall **unrolls**, ceiling **lifts** (tethers), museum **parts** along a drawn line, walls
  **set aside** (dashed slate `#56707C`). As-built stays dashed while displaced.
- **SETTLE:** near principal orientations the picture settles and declares scale honestly —
  per-axis: flat/Plan/section reads both axes; unrolled curve reads heights-only
  (`Heights to scale · curve foreshortens widths`). Numbers are measured; the picture is `to scale`
  only when settled.
- **One writer per number:** handles, tapes, and Inspector fields write through one path; invalid
  input refuses in coral with a reason and cancels on release — zero history entries for refused edits.
- **Legibility gate:** a handle exists wherever its own axis reads, in every view; profile details
  (arch rise, ridge) are face-only exceptions. Numeric entry is always available. Tape yellow marks
  the typeable, never selection.
- **Find with reason:** search reports name + state tag (behind / off / beyond / away) + beacon +
  recovery (`Look / Face / Include / Show-through / Go-to-wall`). Reveal shows one source x-rayed
  at its true place; depth unchanged. Quiet refs by default; selection at full strength; priority declutter.
- **Person figure for scale; floor datum +0.15 shown everywhere; green `#2A9384` = open on purpose.**

---

## 6. Index, Work Card, and deck roles

- **Index (left, locator — never the property editor).** World: places + subjects + containment.
  Experience: searchable Presentations (title, focus, Guide-use count, issue state) + visitor offers +
  Guide entry only if one exists. Search spans both lenses and explains why a hit sits outside the
  current view. Selected identity stays pinned while filtering/occlusion hides it.
- **Work Card (right, action surface — never a dump of all properties).** Header states target +
  edit scope first. Collapses for spatial work; reopening restores target. Ordinary first screen for
  a Presentation: title + meaning, Focus list (+ add), Show slot (suggested / captured / keep-visitor),
  Happens slot (supported actions), Visitor-can slot (offers), Guide slot (`Add to Guide`).
  Slots are composable, not steps; meaning may precede View.
- **Bottom deck (absent by default).** Guide deck = ordered Stop cards when a Guide exists.
  Direction deck = precise Camera/timing instrument when travel, framing, multi-View, or repair needs it.
  Never both permanent. Card + deck resize/collapse; below dense widths compress metadata before
  identity, selection, stage, or the active instrument.
- **Every board must show whose fact is being edited** (scope header) and, for shared things,
  how far the edit reaches (counts, `Edit shared Presentation (used by n)`).

---

## 7. Presentation / View / Guide / Stop — UI relationships

- Presentation holds focus + explanation + Views + Activities + Interactions. Views are reusable
  framing **inside** a Presentation; later Views surface via named cues / manual availability /
  suggested progression — a visitor may jump. Views never become Stops on their own.
- `Present this` on a subject/region/viewpoint creates a distinct draft Presentation, selects it,
  opens its card; the subject stays linked as focus (cue distinct from selection). Subject card first
  shows `Presentations about this subject` so existing meaning is reused, never silently merged.
- Explanation is a title + short text/media; duration/captions derive from reading rate unless
  overridden. Activity = authored subject operation (audition with Try, capture with Use in
  Presentation — scope visible). Interaction = visitor offer (Experience-wide or contextual);
  `Let visitors use this` is separate from operating the subject.
- `Add to Guide` / drag creates one Stop: header `This Stop · appearance k of "Title"`;
  controls = entry View or Keep-current-viewpoint, Cut/Travel, pacing, continuation, choice, Gate.
  Meaning edits route through `Edit shared Presentation (used by n)`; a truly different story is an
  explicit `Make a distinct Presentation` fork; entry-only difference is `Change View for this Stop`
  (Camera specialization, no meaning clone).
- No Presentation acquires Previous/Next from where it is used. Autoplay readiness, manual-Next
  permission, and Gates are labelled separately.

---

## 8. Progressive Camera disclosure

1. **Auto** — Camera-owned adaptive View frames the focus. 2. **Hints** — direct-language intents
   (near/far, side, height, look-at, movement). 3. **Use my view** — explicit capture of the current
   standpoint into a Camera View. 4. **Precise** — Direction instrument: observer/target,
   lens/projection, route, anchors, motion profile, evaluated path; return restores standpoint +
   composition context.
- **Shared-View edits always offer scope:** `Update everywhere (n)` vs `Change only here` (private
  specialization for that invocation). Card always names the View and its use count.
- **Cut vs Travel-with-gap:** missing route shows as a gap with `Author route` / `Use cut`.
  A route-map overlay may author canonical Camera connectivity. Runtime node-view endpoints may be
  shown but never authored as anchors. A timed score appears only when coordination needs it.
- **After World geometry changes:** adaptive Views recompute but surface the change for inspection;
  pinned Views report `Review framing`. Reusable independent-proposal mechanics to honor: capture is
  explicit (inspection stays temporary until captured); shared library with per-view use counts;
  reuse warns before all-uses change; fork via save-as-separate; repair queue with replace /
  keep-without-subject / recapture / remove-requirement.

---

## 9. Preview takeover and return

- Entry uses current authoring context (Experience / Presentation / Stop); offer a choice only when
  ambiguous. Surface: visitor program only + a small `Draft Preview · Exit` frame. No authoring chrome.
- Before entry, delivery-grade checks run: unresolved **required** bindings block that scope with a
  link to the repair card; unaffected explicit scopes stay previewable. Drafts may keep unresolved
  bindings; publication may not.
- Visitor always knows location (active Presentation, current Stop when guided, available actions).
  **Explore freely** releases guided Camera + pauses autoplay without ending the Experience or
  touching World truth. **Return to Guide** names the target Stop and travels from the actual pose
  via supported route or authored Cut — never an improvised path, never replaying entry effects.
  Autoplay stays off after rejoin until the visitor enables it.
- Exit discards all visitor-only state and restores lens, selection, card, standpoint, and inspection
  exactly. Each Preview is a fresh session; ordinary editing happens outside Preview.

---

## 10. Visual and state language, component grammar

PLATE is the shell/visual authority; `apps/editor/src/lib/editor/styles/tokens.css` (+`controls.css`)
is the token source. Landed production paints the older light chrome; **design to the §0.7 target.**

**Layout numbers (1440×900 ref):** Spine 56 · Head 36 · Status rail 24 (readout-only: domain, view,
selection, save, grid, coords — echoes, never owns) · Navigator 268 (240–300) · Inspector/Work Card
300 · centre column remainder (Stage largest) · View Bar 34, centre-only · Tool Tray 44, Paper-attached,
tool vocabulary only · Camera Drawer 48 collapsed / 288 expanded. Dense check at 1280×768.

**Materials (exactly three):** CHASSIS (spine/head/index/card/viewbar/status/drawer shell — cool,
square, quiet, no decorative shadows, 1px hairlines + tonal steps) · PAPER (plan/3D + contextual
instruments — warm) · INSTRUMENT (tray/mode/utility/transport/timeline/numeric — slight manufactured
edge, ~3px radius). Paper grid on 1·2·5×10ⁿ, major = 5× minor, minor decimated below ~16px.
1px paper perimeter inset; grid/display changes never create Undo entries.

**Color (semantic, never decoration):**

| Role | Landed (production today) | Target (design to this) |
|------|---------------------------|-------------------------|
| Selection | blue `#2F8CFF`, dark edge `#145DA8` | ochre core `#E5A020`, dark `#8A5B10`, quiet fill 10% — contour + active handle + affected edge only, never a flood |
| Typeable / armed knife | — | tape yellow; armed = sink one material step, full ink, no amber edge |
| Displaced / view-only | — | dashed slate `#56707C` + `view only` |
| Refusal | `#9B3149` | `#FDF3F0` + `#7E2718` + terracotta + reason; outranks value fill; preserves focus + selection |
| Caution (≠ refusal) | amber `#8A5F14`/`#D9A441` | `#F7EDE8` / `#C85A48` + recovery action |
| Open on purpose | — | green `#2A9384` |
| Snap | `#146D68` | keep |
| Scene domain | `#946D34` | keep |
| Camera domain | `#347D89` | keep |
| Mat / vellum / ink | — | `#1D3A33` / `#152C26` / grids `#2B5147` `#3C6A5C` · vellum `#F3F4EE` · ink `#202422`/`#3E4440` · perimeter `#B8BEB3` |
| Chassis/instrument | `#D9DDE0` / recess `#CBD0D4` / instrument `#E8E5DD` | `#EEEDE8` / recess `#E2E0D8` / instrument `#F8F8F4` / hover `#F0EFE9` |

Accents live on chassis, never flood Paper. No hue-alone state — every state pairs color with
shape, label, or placement. Spatial invariants are theme-proof: axes/gizmo red/green/blue,
selection outline/hover/fill/handle, plan paper + plan semantic colors, lane parameter colors
(fov/look/roll/envelope/free).

**Typography (two voices, roles not numbers):** humanist sans for UI + narrow mono for measures.
Closed ladder 9/10/11/12/13/15/20. Consume roles: row, identity (Head 14), heading (10px 600 +0.04em),
engraved (View tabs 12 strong), control, utility (10), mode (11@24), status (10), property
(12 label / 13 value), mono/ref/tick/readout/station. Tray micro-type exception: 7 group / 8 tool /
6 opt-in compact floor. Two global scale knobs only (`--editor-type-scale`, `--editor-control-scale`).

**Controls:** heights lg30 / md26 / sm24 / xs20, pad-x 9/9/8/6; radius follows material
(square chassis, ~3px instruments, ~2px paper handles). Spacing 4/8/12/16/20/24.
Navigator rows 29px/12px/10px-mono-ref/18px disclosure; names lead, refs never truncate, indent 10–12px.
Inspector is property-first: header (icon/name/ref/kind) → Geometry / Transform / Placement / Identity /
Relationships / Lens / Sequence → Actions last; engraved section headings.

**Full state roster (every board must use these, never invent parallels):**
hover = lift · selected = accent edge + fill (shared with viewport) · focus = independent offset ring,
`:focus-visible` only · pressed/toggled = recess surface + edge border + inset bottom rule ·
armed = sink, no amber · disabled + reason · refusal (explicit + reason + recovery) · warning/caution
(distinct from refusal) · destructive last · preview-ghost (alpha + ghost ink) · snap (own ink) ·
authored (primary + mono) vs derived (quiet mono) · temporary (dashed / `view only` / ghost).
Refused ≠ caution ≠ view-only — three separate treatments.

**Compact instrument pattern:** 44px tray rail, icons over persistent engraved labels, tool vocabulary
only (SELECT / TRANSFORM / SPACE / OBJECTS + Camera variants). Precision lives at the gesture
(dims, snap, refusal, Inspector entry) — never duplicated into the status rail.

---

## 11. Retired concepts — do not resurrect

| Retired | Replaced by |
|---------|-------------|
| Scene\|Camera spine as the creator axis; permanent Camera timeline; Plan\|3D as peer workspaces/tabs | Continuous standpoint (Plan/3D endpoints + tilt); Camera Drawer 48/288 centre-only; Direction deck when needed |
| Experience V1.1 chrome: mode banner, primitive room + markers, Encounter outline + contextual inspector, bottom Guide strip, global signal lists, definition-ID exposure, dependency choosers, interaction-builder workflows | §§6–8: Index + Work Card + decks; behavior kept, chrome dropped |
| Independent-proposal chrome: intention-switch top bar, retractable scoped index replacing Navigator+Inspector, tilt-slider dissolving Plan\|3D, hotspot/stack canvas anchors, arc/approach motion UI, dialog copy, fixture states | PLATE composition + P26 standpoint; lift only §8's data mechanics |
| `Destination` wording; prototype `Encounter` naming | Presentation (reusable meaning) / Stop (occurrence) |
| Older blue-selection prose; amber armed; pills/cards-in-panels; navy default; hue-hierarchy; MODE-as-segment; 4th material; video-editor timeline; dashboard Inspector; filesystem Navigator | §10 target language |
| Global last-command-wins; whole-model snapshot Undo; analytic-cap geometry; tiny-FOV ortho stand-in; per-frame re-tessellation; prototype key bindings/timings/copy | Ratified execution (L6); production architecture; V2 instruments its own behavior |
| `Spatial`/`Publish` as the top-level product model; Camera-only graph/timeline host; fixed three-column Inspector as the only action path | World\|Experience lenses; Preview/Publish over accepted revision |

---

## 12. Dense-project and failure/repair states

Lock these behaviors; O6 covers only their visual expression:

- **Many items:** search + filters + compact rows + relation counts + selected-item pin; Guide deck
  collapses/groups keeping Stop identity + order legible. Must work at 1280×768: shed metadata →
  captions → low-frequency utilities; identity, selection, view tabs, and tools survive last.
- **World subject moved:** adaptive framing recomputes + surfaces the change; pinned framing flags
  `Review framing`. Presentation identity + explanation untouched.
- **Subject/capability removed:** binding shows original identity + typed failure; Presentation and
  Stop survive; `Relink` / `Remove use` / keep explicit unresolved draft. No nearest-name retarget.
- **Missing route:** Travel gap with `Author route` / `Use cut` — never an improvised path.
- **Preview gating:** required-unresolved blocks that scope + links to repair card; unaffected scopes
  previewable. Refusal is local with a recovery action; warning is not refusal; view-only stays distinct.
- **Several Presentations on one subject:** relation set on the World selection; new meaning gets a new
  Presentation ID, never overwrites.
- **Lens switch mid-inspection:** stage recipe + standpoint persist; Experience may explicitly save
  eligible Camera intent without serializing the editor opening.

---

## 13. Boards to produce

Reference size 1440×900; re-check B1, B3, B6 at 1280×768. Annotate every board with the edit scope
it exercises and the reach of each primary action. Use only the §10 state language.

- **B1 — Workbench frame + lens switch (5 states).** Empty-ish World bench with labelled regions;
  World Index (places/subjects) vs Experience Index (Presentations + offers + Guide entry) for the same
  standpoint; lens flip preserving pose + selection + per-lens Index position; active Experience ▾;
  collapsed Work Card for spatial work. Proves L1, L8, S1.
- **B2 — World source work through inspection (5 states).** Select → Face/Open/Look-inside/Look-up;
  displaced view-only badging + return crumb; SETTLE scale declaration (both-axes vs heights-only);
  one-writer numeric edit + coral refusal with reason; Find-with-reason + Reveal. Proves §5.
- **B3 — `Present this` → Presentation card (6 states).** Relation set (`Presentations about this`)
  → new draft card → meaning first → Show slot (suggested vs Use-my-view vs Keep-visitor) →
  Try vs Use-in-Presentation with visible scope → Experience with no Guide. Proves §§6–7, S5–S6.
- **B4 — Camera progression + Direction deck (5 states).** Auto → Hints → Use-my-view → Precise
  instrument (observer/target, lens/projection, route, anchors, motion, evaluated path) → Travel gap
  (`Author route` / `Use cut`). No timeline for simple work. Proves §8, S4.
- **B5 — Shared-View scope + where-used (4 states).** Card naming View + use count; `Update
  everywhere (n)` with affected list vs `Change only here` (private specialization); `Review framing`
  after a World move; Stop-local entry change without cloning meaning. Proves L4–L6, S3.
- **B6 — Guide deck + Stop editing (5 states).** `Add Guide` → deck of Stop cards (two appearances,
  one Presentation, distinct Stop IDs) → `This Stop` card (entry, Cut/Travel, pacing, continuation,
  Gate) → `Edit shared Presentation (used by 2)` → explicit fork (`Make a distinct Presentation`).
  Proves §7, S6.
- **B7 — Preview takeover + return + repair + dense (6 states).** Takeover frame (`Draft Preview ·
  Exit`) with authoring chrome gone; blocked-scope repair card with link; Explore-freely + named
  Return-to-Guide; exact authoring restore on exit; typed missing-subject/capability failure with
  Relink/Remove/keep-draft; 1280×768 dense Index + deck collapse. Proves L7, L11, §9, §12.

---

## 14. Source index (repository paths)

- Direction: `docs/reference/decisions/northstar-ratification-2026-09-27.md`,
  `docs/reference/decisions/world-experience-reconciliation-2026-09-29.md`,
  `docs/reference/north-star.md`, `docs/reference/architecture.md`,
  `docs/reference/composition-execution.md` (F.1–F.5, target — none shipped).
- Shell/visual (durable): `docs/reference/design-system/editor-shell-and-visual-system.md`
  (read §0, then §0.7, then owning section); tokens `apps/editor/src/lib/editor/styles/tokens.css`
  (+`controls.css`); production shell inventory `apps/editor/src/lib/editor/app/`.
- Product proposal (not ratified): `docs/World-Experience-Shell-V2-Design.md`,
  `docs/World-Experience-Model.md`, `docs/World-Experience-Design-Context.md`,
  `docs/World-Experience-Architecture-Synthesis.md`.
- Evidence: `prototypes/spatial-authoring/` (P26 Stage + journeys A–F; shortcuts in
  `IMPLEMENTER-REFERENCE.md` are not contracts) · `prototypes/experience-authoring/`
  (V1.1 behavior only) · `prototypes/biskiq-creator-shell-design-independent/src/`
  (View lifecycle / retrieval / repair mechanics only; chrome retired) ·
  `prototypes/world-experience-shell-sketch/` (disposable flow mock, not V2).
- Family rules: `prototypes/README.md`. Live baton: `docs/operations/current.md`.
