# P25 Focused Experience Research — Compact

Source: `docs/roadmap/p25-experience/research/P25-research.md` ( §§0–14 ). Reorganized by concept; source-only, no version updates.

## 1. Thesis / direction

- P25 hypothesis mostly survives; flaw: `Destination + existing Camera Sequence` fails when same place occurs twice in one guided journey.
- Mature pattern: journey position is own semantic unit — StoryMaps movable/duplicable tour-place slides; STQRY ordered stops + Next/Previous; Shepherd `Step` ID separate from attached target [1][2][3].
- Museum sharpens it: order on camera nodes via `nextNodeId`/`previousNodeId`; `visitorMainFlowNodeIds()` walks unique node IDs once, terminates on cycles/repeats; visited state is `visitedRoomIds` (rooms, not occurrences). One reusable Piano camera cannot be two contextual visits without duplicating camera node or changing Sequence representation — canonical Camera authority issue, not second Experience graph.
- Revision: **ADD guided Stop** = one occurrence of reusable Destination in canonical guided order; **Sequence-relative only**; owns no XYZ, camera pose, path, transition timing, connectivity, independent Next/Previous topology.
- Preferred long-term: stable occurrence identity inside evolved Camera Sequence + Experience metadata/reference = visitor Stop. Current Sequence has no occurrence record → **ADD Stop semantics now; DO NOT freeze schema/ownership; POST-F0 / POST-P24 RECONCILIATION REQUIRED.**
- North-Star alignment: same project/world/cameras/runtime; Experience references Spatial, never becomes second camera/scene/asset/scripting system.

```text
Camera/Spatial truth: Destination A = canonical target/view
Canonical guided Sequence: Intro → Piano → Paris → Piano → Exit → Stop A (ctx1) / Stop B (ctx2)
Experience: adds label/content/narration/rules to Destination or occurrence
Camera route/motion: executes movement
```

## 2. Executive decisions

| Area | Decision |
|---|---|
| Destination | KEEP; reusable visitor-facing semantic ref to canonical navigation meaning |
| Guided Stop / occurrence | ADD |
| Stable Stop identity | ADD conceptually (index refs break) |
| Independent Experience tour graph | REJECT |
| One responsive Info Panel | KEEP + REFINE |
| Modal/card/sidebar as separate Content types | REJECT for minimum |
| Constrained rich text | ADD |
| Arbitrary HTML/CSS/layout | REJECT |
| `Activate` | KEEP |
| `DestinationReached` | KEEP + guided-occurrence context at runtime |
| `ShowContent` / `NavigateTo` | KEEP |
| `OpenUrl` | KEEP; minimum only from explicit activation / native links |
| Multiple independent rules/event | ADD |
| Ordered action arrays / waits | REJECT |
| Narration | DEFER one level, high priority |
| `Once` / `FirstVisit` | DEFER one level |
| `Highlight` | DEFER one level |
| Show/Hide Scene objects (`ShowObject`/`HideObject`) | DEFER (DEFER HARDER for event `MediaEnded`, `CueReached` until Camera cues ship) |
| Generic variables/conditions | REJECT |
| Node graph | REJECT |
| DOM companion navigation/content | ADD, mandatory platform contract |
| Reduced-motion same Destination | KEEP + strengthen (cut/dissolve, not 24× traversal) |
| Preview/Publish same visitor semantics | KEEP, mandatory |

Minimum stack: `Destination + Stop/occurrence + Content→Info Panel + Activate/DestinationReached + ShowContent/NavigateTo/OpenUrl + guided/free nav + a11y/motion contract`.

## 3. Key concepts / definitions

- **Destination:** reusable visitor-facing semantic reference to canonical navigation meaning; owns canonical name + spatial/camera target ref; good default for generic description/content; possible free-explore narration default later; no guided progress / Next/Back; never camera pose/path/timing.
- **Stop / guided occurrence:** one guided occurrence of Destination; optional contextual name override; references Destination (never owns pose/path/timing/connectivity); optional journey-specific content binding; best guided narration binding; owns guided progress + arrival context; Next/Back derived from canonical guided order; `Completed step` = session-only Stop state; `Visited destination` session-derived, Stop can contribute.
- **Content:** reusable `title + constrained rich body + optional primary media (description/caption/credit) + optional link/CTA`; no concrete TypeScript representation yet.
- **Info Panel:** sole authored presentation semantic; platform renders responsively (`wide → side-sheet-like dialog; small → bottom/full sheet`); author never picks modal vs sheet vs sidebar.
- **Interaction rule:** `one semantic Event → one Target/context → one Action`; multiple independent rules may share event; no ordering promised; conflicts rejected by validator.
- **Visitor session state (ephemeral):** `currentGuidedStop`; narration playback progress; global volume/mute; Stop completion; no cross-visit/account persistence in minimum.
- **Not concepts:** Chapter; Tour Graph; waypoint geometry; `StopReached` (use `DestinationReached{destination, guidedOccurrence|null}`); `Click/Tap/KeyPress` (unified `Activate`); array index as identity.

## 4. Current Museum state (code-checked)

- Context inspected: P25 umbrella/research; P22 shipped visitor runtime; tracker (P22 shipped, P23 F0 active, P24 reconciliation pre-implementation, P25 research/reconciliation only); North Star; `NavigationNodeData`; visitor runtime state; `VisitorCameraDirector`; `VisitorPreviewSurface`; `VisitorEntities`.
- Phase 5 prior: ~`Destination + Content + click/arrival actions`; leaned Camera-Sequence-only for guided flow; ranked `once`, audio/video, broader actions early — this pass stress-tests vs repeats, runtime seams, media/browser constraints, a11y.
- Order: `NavigationNodeData.nextNodeId`/`previousNodeId` (single optional each); `visitorMainFlowNodeIds()` unique-chain walk.
- Visitor: `guided | free`; canonical route requests; Next/Back = Camera order; `goBack()` = prior Camera node; visited gate = `visitedRoomIds`; reduced-motion exists as accelerated (`~24×`) traversal in `VisitorCameraDirector` — directionally correct (same target node) but must become cut/dissolve (fast traversal ≠ motion removal).
- Gaps: no Stop occurrence model; no object `Activate` seam (`VisitorEntities` rendering only); no authored DOM Destination menu / visible Next-Back surface / semantic content nav / interactive-object companion; P22 release path not general Experience image/audio/video infra.
- `Activate` = real new runtime behavior, not rebrand.

## 5. External evidence (product + standards)

- StoryMaps tours: numbered tour places as slides, each with title/description/media/location; duplicable/reorderable/hideable/deletable; Explorer tours = free jump; layout (map/media/list/grid) switchable without redefining content; no arbitrary HTML/CSS/JS in builder blocks [1][5].
- STQRY: tour = sequence of stops, Next/Previous + swipe + all-stops menu; stop may hold several screens [2]; audio auto-start on arrival; conflict policy `replace current | skip new | queue` (default `replace`); pause/replay [7].
- VoiceMap: audio bound to ordered locations, auto-begin on reach; Start/Resume + manual skip [8].
- Matterport: curated guided viewpoints + free exploration [1-context].
- Kuula: Interactive Card = one responsive card, media/text/link all optional, adapts across sizes (customization/embed not needed for primitive) [4]; hotspot = select/create in spatial view + right-panel simple action selection, no node graph [20].
- Shepherd.js: `Step` separated from `attachTo` DOM target; own IDs/content/behavior [3].
- Figma: unlimited actions/trigger need explicit top-to-bottom order; order changes outcome; conditions/variables layer on top [11] — boundary to avoid.
- Webflow: complex interactions → chronological timelines, sequential/parallel, durations, conditions [12] — reject waits/durations/workflow.
- W3C: XR needs accessible location/object ID, device-independent interaction, orientation, sickness-trigger alternatives [16]; prerecorded audio-only needs transcript (Level A); prerecorded video w/ meaningful audio needs captions [10]; keyboard operability + APG button Enter/Space [17]; `aria-current="step"` for current step [15]; modal focus/Escape/containment/return + responsive full-screen small-screen pattern [6]; G201 warn on new window [14]; WCAG 2.2 target 24×24 CSS px min [18].
- MDN: audible autoplay blocked until interaction/permission — no `DestinationReached always starts narration` on cold load [9]; transient activation required for new browser context [13]; `prefers-reduced-motion`: remove/reduce/replace large pan/scale vestibular triggers [19].
- Apple: 44×44pt default iOS control — use as stronger Museum touch default (floor stays 24×24) [18-context].
- Limitation: commercial docs show visible semantics, not private persistence → Stop-identity placement is partly architecture inference, not claim of StoryMaps/STQRY internal schema.

## 6. Destination vs occurrence — analysis

- Q1 Destination + current Sequence enough? No as durable semantics; works iff each Destination ≤1 occurrence; fails first repeat.
- Q2 Smallest addition? Stop: occurrence identity + occurrence-specific Experience context only.
- Q3 Persistent identity? Transient index OK iff nothing references occurrence state; stable identity required once content/narration/arrival/progress/selection/analytics bind per Piano visit. Array index ≠ identity.
- Q4 Ownership: see §3 + table in source §2.4 (name/target/content/narration/progress/arrival/Next-Back/visited/completed/pose preserved above).
- Q5 Sequence-relative? Yes; Camera owns traversal/occurrence position; Experience attaches context; route/motion executes; Stop never gains connectivity.
- Q6 Index failure fixture: bind to `sequence[3]` in `0 Intro,1 Piano,2 Paris,3 Piano(second),4 Exit`; insert before Paris → second Piano = index 4, bindings/progress/fixtures/selection/analytics mis-target; reorder/delete/duplicate same class of failure.
- Reject: duplicate Camera nodes for semantic duplicates (viewpoint duplication/edit drift); Experience `nextId`/`previousId`; Experience-owned pose; raw coords as identity; Experience TourGraph parallel to Camera; mutable-index metadata binding.

| Option | Benefits | Failures | Persistence | Cam-duplication | Disposition |
|---|---|---|---|---|---|
| Destination + current Sequence only | Tiny | Repeats lack distinct context | Minimal | Low until authors duplicate cameras | REJECT as full minimum |
| + array-index occurrence | Easy prototype | Insert/reorder/delete retarget | Fragile positional | Low | REJECT |
| + stable Stop over canonical occurrence | Repeats/content/narration/progress clean | Needs Sequence identity seam | Small stable ID | Very low | RECOMMENDED |
| Duplicate Camera node/occurrence | Works w/ current links | Duplicates viewpoint; edits drift | Bloats truth | High | REJECT |
| Independent Experience journey graph | Max flexibility | Two route authorities; branching creep | Large new graph | Very high | REJECT |

Ratify Stop semantics, not implementation. Ideal: `canonical Camera Sequence occurrence + Experience metadata/ref = visitor Stop`.

## 7. Content model / Info presentation

- Shape: `Content{title; constrained rich body; optional primary media{accessible description; caption; attribution/credit}; optional link/CTA}`.
- Body: constrained rich text (not plain, not durable HTML): `paragraph, heading, list, emphasis, inline link`. Markdown may be authoring input, never auto persistence truth.
- Presentation: one `Info Panel`; WAI dialog focus/Escape/containment/return [6].
- Platform owns: responsive layout; typography; max readable width; scrolling; panel animation; focus behavior; close affordance; backdrop/modal; breakpoints; media aspect-fit; semantic HTML; safe external-link behavior.
- Author owns: title; body semantics; media choice; alt OR decorative declaration; caption; contextual credit where needed; CTA/link label + destination. Derive legal/provenance credit from project asset metadata where possible (North-Star asset ownership).
- Tiers: Minimum = title + constrained rich text + one primary image + caption/alt/credit + optional link/CTA + one Info Panel. One-deeper = video, small gallery, related-Destination link, secondary CTA, richer captions. Deferred = standalone passive caption/label, world-space interpretation labels, download attachment. Wrong-product = arbitrary HTML/CSS/JS, freeform layout, iframe ecosystem, arbitrary web-component trees, page-builder templates.
- Media bytes via canonical project Assets; exact media record/pinning = POST-P24 RECONCILIATION REQUIRED.

## 8. Narration (deferred one level, highest priority)

- Own semantics; not `PlayAudio` generic, not Content subtype (own lifecycle), not generic action (scatters interruption/resume), not Camera-global (too coarse), not Scene truth.
- Model: `Narration resource = reusable media + transcript` ; `Narration binding = where/when`; best guided attachment = Stop (`Piano visit 1 → history; visit 2 → performance`; Destination-level cannot distinguish).
- Lifecycle: Start on Stop/Destination arrival only after visitor enabled/started audio; new navigation stops prior; overlap never by default; manual-pause → resume current; return-to-old → restart initially; jump elsewhere → stop; no queue; no background mixing; autoplay rejection → visible Play fallback; transcript required; global volume/mute = session setting; progress = ephemeral; no cross-visit persistence; reduced-motion independent (never mute for reduced motion).
- Binds to semantic arrival, not animation duration: `normal: arrive→may begin; reduced: cut→same arrival→same behavior`.
- Defer reason: high museum value but autoplay + lifecycle + transcripts + global controls + interruption = subsystem; visual-Content journey complete without it. Media ownership/resolution = POST-P24 RECONCILIATION REQUIRED.

## 9. Bounded interaction vocabulary

Scenario matrix (Result | Reason): 1 Activate artwork→ShowContent: Works cleanly | core; 2 Activate→NavigateTo: Works cleanly | canonical nav; 3 DestinationReached→ShowContent: Works cleanly | core arrival; 4 Attribution link→OpenUrl: Works, often no rule | panel renders semantic link; 5 Guided arrival→contextual: Works | Destination if unique else Stop; 6 Same Destination×2 different ctx: Needs Stop | Destination ambiguous; 7 Narration: Needs one-depth extension | lifecycle>action; 8 Reveal/highlight: Highlight useful depth | transient emphasis avoids Scene mutation; 9 First-visit-only: Depth | bounded session state; 10 Show/hide: Defer | visibility/reset/a11y; 11 Navigate-then-Show: Compose rules (`Activate→NavigateTo`, then `DestinationReached→ShowContent`); 12 Two simultaneous: Multiple independent non-conflicting rules, no ordered list.

- Core: Events `Activate, DestinationReached`; Actions `ShowContent, NavigateTo, OpenUrl`. `Activate` unifies pointer/touch/keyboard/DOM; no `Click/Tap/KeyPress`.
- Occurrence: no `StopReached`; emit `DestinationReached{destination=Piano, guidedOccurrence=PianoVisit2|null}`; rules scope to Destination or occurrence.
- Multi-action: Figma ordering + Webflow timelines are the anti-pattern [11][12]; keep `one rule = one Event → one Target/context → one Action` (e.g. `Activate Piano→ShowContent PianoInfo` + `Activate Piano→Highlight Score`, no order promised); validator rejects conflicts (dual `NavigateTo Paris+Exit`; dual `ShowContent` to single panel without arbitration).
- Causal composition via semantic events, never `Activate→Navigate→wait 3.6s→Show`; survives motion edits + reduced-motion.
- `OpenUrl`: no auto-fire from `DestinationReached` (needs transient activation [13]); panel links = real anchors; warn on forced new tab (G201 [14]).
- Boundary: KEEP 5 core; ADD multi-rule + occurrence ctx; DEFER `Highlight, Once/FirstVisit, Narration`; DEFER HARDER `ShowObject/HideObject, MediaEnded, CueReached`; REJECT ordered lists, `wait/duration`, variables, expressions, arbitrary conditions, custom JS, workflow graph.

## 10. Visitor navigation UX

- Current: `guided|free` + route requests + Camera-order Next/Back + reduced-motion; `goBack()`=prior node; `visitedRoomIds`; no Stop; no DOM menu/Next-Back surface/content nav/object companion.
- Home = canonical guided entry Destination/Stop (not world origin / Room 0 / browser home).
- Next (guided) = next Stop occurrence via canonical Camera nav (not necessarily next raw node). Back (guided) = previous Stop occurrence (not prior room / free nav / intermediate node / browser history) — answers Back question.
- Menu lists reusable Destinations: `select→NavigateTo→route/motion`; repeated Piano appears once in Places; guided outline exposes occurrences (`1 Intro; 2 Piano—Instrument; 3 Paris; 4 Piano—Performance; 5 Exit`).
- Deviation: ephemeral `currentGuidedStop`; free-nav detour → Resume Tour to current/next occurrence without mutating Sequence; no rejoin graph.
- Progress: platform-derived `Step 2 of 5` → `aria-current="step"` [15]; no author state; visited checkmarks + `FirstVisit` wait.
- Browser Back: do not overload; one published URL; Back = page/session history; per-Destination deep-link/`pushState` deferred to sharing scope (avoids second history model pre-URL-addressability).
- Minimum surface (semantics, any layout): `Home; Back; Next; Destinations; current location/step; guided/free/resume; Help; motion preference`. Map/minimap = derived Spatial, waits. Guided=numbered sequence vs Explorer=free jump (StoryMaps); Matterport guided+free; STQRY Next/Previous/menu [1][2].

## 11. Accessibility contract (platform, not polish)

Platform auto-guarantees: one semantic Activate (mouse/touch/keyboard/DOM); DOM companion (never raycast/WebGL-only); semantic `<nav>`/controls; `aria-current` current Destination/Stop; visible focus; logical focus order; Info-Panel focus-in/Escape/return; touch floor 24×24 CSS px min, target ~44px controls [18]; detect + offer reduced-motion control; same Destination under reduced motion (presentation-only change); `DestinationReached` fires after animated + no-motion; responsive readable (no horizontal dependence); contrast/text-scaling theme; keyboard play/pause/mute/volume; real links + new-context warning; identical Preview/Publish semantics. WCAG keyboard + APG Enter/Space [17]; XR device-independence + sickness alternatives [16].
Author-required: `Destination label; interactive target label/name; Content title/body; meaningful link text; image alt OR decorative; caption where needed; narration transcript; video captions where audio matters` (audio-only transcript = WCAG A [10]). Optional later: longer descriptions; pronunciation; landmark descriptions; richer captions; related Destinations; orientation/help; complex-spatial descriptions. Author must never disable reduced-motion.
Reduced-motion: current `VisitorCameraDirector` same-target + accelerate is directionally right but 24× traversal still traverses vestibular trigger [19] → contract: `Normal: Piano→authored motion→Piano; Reduced: Piano→cut/dissolve/minimal→same Piano`; same semantic Destination reachable; no second route/alternate destination; narration unchanged.

## 12. Authoring UX

- Surviving hypothesis: `same 3D world + Experience overlays + Inspector/rule cards`. Kuula: in-world hotspot select/create + right-panel action [20]; StoryMaps: ordered-slide strip for reorder/duplicate/edit [1]; Museum needs both.
- Split: `World (select target/badges) + Structured list (Destinations; guided Stops; reusable Content; rules) + Inspector (edit binding/rule/content)`; no second 3D truth.
- World-only insufficient: second Piano occurrence shares world position; non-spatial/reusable truth needs list/outliner.
- Rule cards e.g. `Activate·Piano → Show·Piano information`; `Destination reached·Piano/Stop 4 → Show·Performance context`; semantic, human/agent-readable.
- Node graphs only pay off for `branch/condition/wait/merge/variable/loop/ordered workflow` — all outside minimum [11][12]; no count threshold defensible; threshold is structural, not rule-count.
- Test lenses (same runtime, not second): preview exact visitor runtime; jump to Stop/Destination; activate selected; reset session; test reduced motion; show invalid refs; show active rule/event.

## 13. P25 minimum hypothesis — revised table

KEEP: Destination (reusable target); Destination menu (free nav); Content resource (reuse); one Info Panel; primary image; `Activate`; `DestinationReached`; `ShowContent`; `NavigateTo`; `OpenUrl`. REFINE: camera-node-backed target (avoid implicit room→camera heuristics). ADD: guided Stop/occurrence; stable Stop identity (conceptual); guided Home/Next/Back; progress `x of n`; constrained rich text; guided-occurrence ctx; multiple independent rules; DOM companion (mandatory). DEFER: Room-as-target exact semantics (needs preferred-view contract); video/gallery; browser-history integration; Narration (one level); `Highlight` (one level); `Once/FirstVisit` (one level); Show/Hide object. REJECT: Experience-owned order graph; arbitrary HTML/layout; ordered multi-action workflow; generic conditions/variables; node graph.
Smallest capability:

```text
Experience{Nav{Destination; Stop; Home/Next/Back/Destination}; Content{reusable Info{constrained text+image+credit+link}}; Interaction{Activate; DestinationReached; ShowContent; NavigateTo; OpenUrl}}
Visitor platform{guided/free; DOM companion; reduced motion; keyboard+touch; same Preview/Publish}
```

Suffices for museum/portfolio/showroom/architecture without CMS/node-editor/game-engine/second-nav.

## 14. One-level-deeper rank

1 Narration (museum/edu value; cost media lifecycle+transcripts+autoplay) | 2 `Highlight` as transient `Highlight SceneEntity X`, not Scene mutation (cost transient render) | 3 `Once`/`FirstVisit` session-only, no condition syntax (cost session+reset/testing; stops intro spam) | 4 Video+small gallery (cost assets/player/a11y) | 5 Resume polish + visited indicators (cost session progress) | 6 Deep links/shareable Destinations (cost URL/history) | 7 Derived Spatial map/minimap (cost post-P23 derivation) | 8 Camera Cue binding (cost depends on cues existing).

## 15. Gated questions — POST-F0 / POST-P24 RECONCILIATION REQUIRED

Do not answer in P25 schema today. Ratifiable now: `Stop may reference canonical Camera/Spatial meaning, never own copied truth.`
Requires P23 F0 recheck: stable node/ref identities after world-local migration; Room semantics for Destination grouping; post-F0 resolver; Destination forms encoding old Room-local assumptions. Requires accepted P24 minimum: Scene entity `Activate` kinds; canonical media refs; image/audio/video resolution; normalized/derived-proxy selection semantics; shared preview/public closure. Requires both before: persistence ownership; exact schema/codecs; ref validation; Experience ops; authoring UI; visitor integration; same Preview+Publish; a11y acceptance. Also deferred: `ExperienceDocument` ownership (semantics clear, envelope deferred); Stop storage owner (node links, no occurrence records); Camera ref representation (P23 world/local + seams); whether Sequence becomes occurrence-based (Camera migration); Room resolution (no first-camera heuristic); Scene target API (P24 seams); Content/media representation + audio/video pinning (P22 contract extension); Experience op APIs + cross-domain atomic history (only on first real op); Save/Load codec/version; Preview extraction (preserve P22 cold/runtime isolation); publish validation closure. No child implementation plans pre-seams (tracker direction); no P25 schema pre-F0 recheck.

## 16. Acceptance narratives / fixtures

- A Museum artwork: Piano Destination + Stop 2 intro Content; Next→Camera move→`DestinationReached`→Info Panel; close→Activate Piano→deeper Content; attribution link keyboard-accessible; reduced-motion Home→Next = same Piano via cut, same events. Primitives: `Destination; Stop; NavigateTo; DestinationReached; ShowContent; Activate; OpenUrl/link; Info Panel; reduced-motion parity`.
- B Portfolio `Introduction→Sculpture A→Installation B→Contact`: free jump to B via menu; sculpture Activate→description+image+credit; Resume Tour w/o Sequence edit; no page builder.
- C Showroom Hero→Detail→Accessories: `Activate Product→ShowContent` (summary+image+`View specifications` link); no material mutation/variables/show-hide/workflow.
- D Architecture Lobby/Kitchen/Courtyard/Bedroom explicit views: menu + Home/Next/Back; DOM list + `aria-current`; reduced-motion cut to same target; geometry never Experience truth.
- E Repeated-place proof `Intro→Piano:Construction→Paris→Piano:Performance→Summary`: both Piano Stops → one Destination; ctx-specific Content; Next/Back by occurrence; menu single Piano. Proves Destination≠occurrence.
- Stress fixture for Stop boundary: `Intro → Piano → Paris → Piano → Exit` must give two Piano contexts w/o duplicate pose/path truth.

## 17. E0–E5 ratifiable now (no P23 schema needed)

E0 vocabulary (`Destination; Stop/occurrence; Content; Interaction; visitor session`; Stop has no graph authority). E1 Stop boundary via §16-E fixture. E2 Content+Panel (rich text; one presentation; image/credit/alt; no HTML/layout). E3 grammar (`Activate; DestinationReached; ShowContent; NavigateTo; OpenUrl; multi-rule; no workflow` + conflict classes). E4 a11y (DOM companion; keyboard/touch equivalence; focus; same-Destination reduced motion; required labels/alt/transcripts). E5 Narration as first-depth (not `PlayAudio`; no overlap default; explicit audio enable). Then P23-F0 rechecks → P24 rechecks → both-gates implementation slices (`persistence→schema/codecs→validation→ops→UI→runtime→Preview/Publish→a11y`).

## 18. Sources (verbatim)

[1] https://doc.arcgis.com/en/arcgis-storymaps/author-and-share/add-guided-tours.htm?utm_source=chatgpt.com | [2] https://support.stqry.com/support/solutions/articles/153000136602-what-is-a-tour-?utm_source=chatgpt.com | [3] https://github.com/shipshapecode/shepherd/blob/main/shepherd.js/src/step.ts?utm_source=chatgpt.com | [4] https://kuula.co/help/interactive-cards?utm_source=chatgpt.com | [5] https://doc.arcgis.com/en/arcgis-storymaps/get-started/faq.htm?utm_source=chatgpt.com | [6] https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/?utm_source=chatgpt.com | [7] https://guide.stqry.com/support/solutions/articles/153000246011-frequently-asked-questions-faqs-?utm_source=chatgpt.com | [8] https://support.voicemap.me/how-does-voicemap-use-my-location/?utm_source=chatgpt.com | [9] https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay?utm_source=chatgpt.com | [10] https://www.w3.org/WAI/media/av/transcripts/?utm_source=chatgpt.com | [11] https://help.figma.com/hc/en-us/articles/15253220891799-Multiple-actions-and-conditionals?utm_source=chatgpt.com | [12] https://help.webflow.com/hc/en-us/articles/42861689104531-Timeline-in-Interactions-with-GSAP?utm_source=chatgpt.com | [13] https://developer.mozilla.org/en-US/docs/Glossary/Transient_activation?utm_source=chatgpt.com | [14] https://www.w3.org/WAI/WCAG21/Techniques/general/G201?utm_source=chatgpt.com | [15] https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA26?utm_source=chatgpt.com | [16] https://www.w3.org/TR/xaur/?utm_source=chatgpt.com | [17] https://www.w3.org/WAI/ARIA/apg/patterns/button/?utm_source=chatgpt.com | [18] https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html?utm_source=chatgpt.com | [19] https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion?utm_source=chatgpt.com | [20] https://kuula.co/help/hotspots?utm_source=chatgpt.com

## 19. Research inventory / loss audit

- Projects/tools: ArcGIS StoryMaps; STQRY (+Guide/Support Portal); VoiceMap; Matterport; Kuula (Interactive Cards, hotspots); Figma; Webflow (GSAP Timeline); Shepherd.js; W3C (WCAG 2.1/2.2, APG dialog-modal/button, XAUR, G201, ARIA26, transcripts); MDN (Autoplay, Transient activation, prefers-reduced-motion); Apple touch guidance; Museum (`scene.ts`, `NavigationNodeData`, `visitorMainFlowNodeIds()`, `VisitorCameraDirector`, `VisitorPreviewSurface`, `VisitorEntities`, `visitedRoomIds`, `goBack()`, P22/P23-F0/P24/P25, North Star).
- Protected tokens: `Destination; Stop; Content; Info Panel; Activate; DestinationReached{guidedOccurrence}; ShowContent; NavigateTo; OpenUrl; Highlight SceneEntity X; Once/FirstVisit; ShowObject/HideObject; MediaEnded; CueReached; PlayAudio(rejected-generic); ExperienceDocument; currentGuidedStop; guided|free; nextNodeId/previousNodeId; sequence[3]; aria-current="step"; prefers-reduced-motion; pushState; <nav>; Home/Next/Back/Destinations/Help`.
- Quantitative: 24× traversal (replace w/ cut); 24×24 CSS px floor; ~44px/pt touch target; `Step 2 of 5`; `wait 3.6s` anti-pattern; tour `1–5` outline; 8-item visitor surface; 12-item platform-owns; 7-item author-owns/test-lenses.
- Unresolved (all gated §15): Stop storage owner; Camera ref form; occurrence-based Sequence; Room resolution; Scene target API; media representation/pinning; op APIs + atomic history; codec/version; Preview extraction; publish closure.
- Matrix→section: exec-decisions→§2; ownership→§3/§6; 5-option→§6; content-tiers→§7; narration-lifecycle→§8; 12-scenarios→§9; boundary→§9; a11y-guarantees→§11; author-required/optional→§11; P25-hypothesis→§13; depth-rank-8→§14; gated-13→§15; evidence-25→§5/§20; E0–E5→§17; narratives A–E→§16.
- Fixture→section: repeat-Piano tour→§6/§16; index-shift `sequence[3]`→§6; history-vs-performance narration→§8; `Activate→Navigate→DestinationReached→Show` vs wait→§9; conflicting dual-Navigate/dual-Show→§9; outline/menu/Resume→§10; cut-vs-traversal→§11; rule cards→§12.
- Audit: [x] §§0–14 accounted; [x] all table dims/rows retained (dims merged, no dimension dropped); [x] all named projects retained; [x] all 20 URLs verbatim + attached; [x] quantitative facts retained; [x] fixtures w/ inputs/outputs/invariants/edges; [x] enumerations member-closed (body 5; platform 12; author 7+8+7; surface 8; test 7; graph-terms 7); [x] protected tokens preserved; [x] rejections/defers retained; [x] caveats (commercial-docs visibility-only; Medium confidence on Stop-ownership inference) + waits retained; [x] no invented citations/conclusion changes. Citations are source-provided URLs; no opaque handles → portability N/A.

## 20. Evidence table (compressed; all rows High except last Medium)

`ordered Stops/places (StoryMaps,STQRY|docs|→Stop)`; `stop carries content (StoryMaps|→occurrence ctx)`; `stops≠2nd spatial graph (STQRY/StoryMaps pattern+inference|→Camera authority)`; `target≠step (Shepherd Step+attachTo|source|→stable ID)`; `order on nodes (scene.ts|code|→no repeat ctx)`; `flow walks unique IDs (runtime|→reconciliation)`; `visited=rooms (runtime|→not Stop progress)`; `one route/motion P22+Director (plan/code|→invoke not replace)`; `no Activate seam in VisitorEntities (code|→new behavior)`; `no DOM Destination UI (surface|→real work)`; `one card suffices (Kuula|→Info Panel)`; `no custom HTML needed (StoryMaps|→reject HTML)`; `multi-action→ordering (Figma|→independent rules)`; `timing→timelines (Webflow|→reject waits)`; `audio interrupt/queue (STQRY|→lifecycle)`; `autoplay blocked pre-activation (MDN ref|→enable/fallback)`; `audio-only→transcript A (W3C|→required)`; `device-independent (XAUR|→Activate+DOM)`; `sickness alternatives (XAUR/MDN|→same-Dest alt transition)`; `24×≠motion removal (MDN+Museum inference|→cut)`; `aria-current step (WAI|→progress)`; `modal focus discipline (APG|→platform)`; `24px floor/44 default (W3C+Apple|→platform sizing)`; `new-tab warn + activation (W3C+MDN|→constrain OpenUrl)`; `Stop Camera-vs-Experience owner (arch inference|Medium|→wait reconciliation)`.
