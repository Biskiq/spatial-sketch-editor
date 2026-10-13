# Experience V3 — decisions, pushbacks and risks

**Status: SUPERSEDED / INACTIVE (2026-10-13, #114).** The owner accepted
[Conservatory Round 2](../../../../../prototypes/experience-ux-alternative/README.md).
[PLATE](../../../../reference/design-system/editor-shell-and-visual-system.md)
owns the promoted unified shell and Experience authoring/UX acceptance.
This UX3/V3 package, standalone plan and generated PNGs are retained rationale
and Git provenance; none is an active design or implementation instruction.
Do not execute V3-A–V3-F or resume UX7. Next work is
[#115 parallel-track planning](../../../README.md#next-task-handoff--115).

**Original proposal/audit follows as historical text.** Earlier “active”,
“canonical”, pending-ratification and PNG-acceptance statements below describe
the superseded commission; they do not reopen current design acceptance.

**Recommended decisions, awaiting owner ratification (2026-10-13).** This record
explains consequential choices in the [proposal](./README.md); it is not another
specification or an implementation authorization.

## Recommended decisions

| Decision | Recommendation and reason | Alternative rejected |
|---|---|---|
| D1 — creative job | Organize around saving encounters, curating occurrences and observing movement. Stage stays dominant. | A prettier surface over the same technical control taxonomy leaves the discoverability problem intact. |
| D2 — local sequencing | Presentation inventory + stable Stop-local View slots. First slot is entry, local dwell is explicit, seed is frozen from Default. | Presentation playlist inheritance hides scope; flat View storyboard loses meaningful Stop boundaries. |
| D3 — Guide overview | One collapsible horizontal Stop ribbon, direct drag/keyboard order, contextual management; internal Views only in selected Stop Card. | Expanding all sequences produces a second timeline and clutter; a second Edit Guide popover duplicates order editing. |
| D4 — spatial truth | Show real Camera observers; offset labels with leaders. No standalone Stop geometry or compressed constellation. | A schematic marker on a metric Stage can imply a false position. The Card is already a safe schematic inventory. |
| D5 — movement/playback | One invoked movement task with route handles and compact player. Time/geometry remain distinct concerns inside it. | Separate Path and Journey workspaces burden a simple inspect-adjust-play loop. A topology lane duplicates Stage geometry. |
| D6 — prototype timing | Local View holds, Camera-derived movement, final frame waits main Next. Manual View pager complements autoplay. | Arbitrary station/event editing and general action lanes are costly and not necessary for the core demonstration. |
| D7 — interruption | Early Next is an explicit Cut skip for new V3 Guides; normal final Next uses the authored transition. | All-origin Travel coverage is expressive but demands support/multi-origin repair and hides a major complication in a supposedly simple transition. |
| D8 — guided/free | One authoring inventory; visitor entry selects guided context or independent free context. | Separate authoring modes would obscure that the same available Views serve both. A relabeled existing Explore toggle is not an independent runtime context. |
| D9 — creative visual identity | Forest frame, cool neutrals, green actions, restrained gold selection and blue Camera species; adaptive panels. | Uniform ivory, equally strong forms and always-wide Deck keep the museum visually secondary. An all-green recolor erases semantic roles. |
| D10 — creation language | Use **New Presentation** for first-use/main creation and **Present this** for a subject. | `+ Present` can be read as launching the visitor performance; the different Preview verb needs clarity. |
| D11 — return | One persistent inspection/Follow return token independent from Card navigation; Back changes context without motion or Undo. | Capturing on every inspected View loses the initial standpoint; hiding Exit when Card changes strands the creator. |
| D12 — compatibility | Guide execution discriminator and atomic whole-Guide conversion; preserve incompatible advanced examples under their existing semantics, with truthful notices. | Silent conversion, mixed execution modes or dormant hidden event payloads would make a simpler UI depend on contradictory source. |

## Pushbacks on the supplied working direction

The core hierarchy is right, but it needs a precise occurrence boundary. I recommend
freezing the Default-derived seed rather than keeping every new Stop dynamically
linked to future Default changes. That gives creators predictable local control.

Do not let a desire for internal View sequencing turn the Guide into a nested
storyboard at rest. Counts and one selected Stop Card explain enough. Presentation
and Stop Cards should share a visual grammar, not identical property sections.

Keep geometry versus time conceptually distinct without requiring separate
workspaces. The compact player can show both holds and movement while still using
Camera's evaluator. Deep Cue authoring does not earn space in this prototype.

Main Next cannot merely be declared “next Stop” without deciding what happens
during another View's Travel. The proposed Cut skip makes interruption honest and
bounded. It deliberately spends less scope on all-origin route coverage; legacy
visits keep their existing behavior until a reviewed conversion.

Do not equate hiding advanced writers with accepting every existing advanced
example into the new model. Some combinations must remain legacy rather than
being half-converted. This is the strongest compatibility cutoff for a design
validation prototype.

## PLATE amendments proposed

| Existing scope | Proposed change | Retained guarantee |
|---|---|---|
| §0.8.1 material / ordinary Cards | Replace ivory-led Experience treatment, advanced/explanation doors and precision prominence with V3 homes/roles. | Distinct subject identity, progressive depth and reach disclosure. |
| §0.8.1 View constellation and instrument grammar Plan markers | True observer markers with label collision handling; no independent Stop pins. | Camera owns pose/projection; Stage must be truthful. |
| §0.8 / §0.8.1 lower breadth | Guide/player centrally bounded; no mandatory full-shell lane or straightened topology. | Horizontal information can earn breadth when justified; ruler/Stage remain usable. |
| §0.8.1 Guide Stop Entry/Next | Local ordered slots; frozen first-slot entry; new linear continuation from Guide order. | Stable occurrence identity; explicit authored legacy Next never silently changes. |
| §0.8.1 Path/Journey/Cue | One movement task, local dwell and compact playback; defer new Cue/Gate/Go/Detour writers. | Camera geometry/evaluation separate from Experience time/events. |
| Card/selection conflict in prior plan | Keep canonical subject identity visible; transition/point/playhead is an invoked task target. | One selection, no second lens store or fake source entity. |
| Return disclosure | Persistent inspection exit survives authoring Back/context changes. | Explicit Camera return, no Undo on navigation; full Preview restore. |

Shared World laws, Paper destination, one architectural compiler, domain ownership,
authored/session separation, generated endpoint restriction and visitor/public
isolation are not reopened. The proposed green frame adoption in Experience does
not quietly recolor World. Production cross-lens token convergence needs its own
approved scope.

## Material owner ratification

There is one coherent recommended package, not an unresolved menu. Approval
should explicitly ratify these two product-semantic groups:

| Item | Recommended ruling | Consequence if not approved |
|---|---|---|
| **R1 — Stop-local composition** | Adopt stable local slots, frozen Default seed, first-slot entry, local dwell and explicit compatibility conversion. | Rework the product/runtime proposal around an alternative occurrence model before implementation; do not fake it as Presentation `viewOrder`. |
| **R2 — visitor progression cutoff** | Guided local autoplay waits at the last View; View pager is distinct; main Next advances Stop, early Next Cuts; free exploration has no Guide cursor. | Require a different explicit progression/origin-coverage policy and update the player/visitor acceptance before coding. |

The shell/visual amendment and deferred-feature exposure are also proposed and
included in package approval. Icon choice, dimensions, colors and folder names
need no separate questions. No further research/reconciliation cycle is needed
to approve the recommended R1/R2 direction. Until approval, #114's implementation
baton is design review and UX7 from the old plan does not resume automatically.

## Cost, risks and verification implications

| Risk / effort | Why it matters | Mitigation / proof |
|---|---|---|
| Stop-local source/runtime — **largest work** | Existing data has one entry, not a local playlist; current suggestion order includes every eligible View. | Land stable source/compatibility first; use the focused repeat/Default/dwell scenario. No production schema extraction. |
| Whole-Stop playback — **substantial adaptation** | Existing rehearsal is one nominal Journey; multiple holds/transitions require ordered composition. | Reuse evaluator/time mapping; test read-only schedule and explicit skip once; no second pose track. |
| Compatibility — **bounded but consequential** | Gates, private entries, explicit Next and station events can contradict a linear playlist. | Reviewed converter supports simple cases, refuses others, retains existing runtime/source and one Undo. |
| Return ownership — **medium adaptation** | Existing one-slot return can be recaptured/stranded across lightweight inspection. | One displacement token, persistent exit, nested Preview return scenario. |
| Shared framing/path reach — **existing capability + new consumers** | Slot references increase where-used scope without copying Camera truth. | Existing Ask operations plus slot reach; explicit edit summary before acceptance. |
| Zoom/occlusion label density — **medium visual work** | Actual observers may collide, especially repeated uses of one View. | Offset labels/leaders; inventory is complete; never fabricate spatial positions. |
| Narrow width — **medium shell work** | Long Stop lists and player can occlude Stage furniture. | 1024/768 specimens; internal lane overflow and one sheet; reserve ruler clear zone. |
| Hidden advanced work — **visibility risk** | Preserved source can execute behavior absent from the main Card. | Named compatibility summary before Preview; classify legacy vs V3, never claim all sources satisfy V3. |
| Visual conformance — **primary product risk** | Passing functional tests already failed to settle product quality. | Complete-window captures, one unassisted creator script and explicit owner visual verdict. |
| Production isolation/F — **follow-up** | Static prototype imports authoring modules; no production codec has landed. | State the proof limits; keep visitor package boundaries and F amendments separate. |

## Deferred capabilities

Multiple Guide management, optional branches and return semantics, narration,
Activities, generalized Cues/actions, arbitrary mid-path pauses, detailed framing
grips/properties, path animation/splines, collision planning, production collection
codecs, delivery compilation and production visitor interfaces remain follow-ups.
Their source capability is not erased to produce this demo. Future Guide IDs and
stable occurrence addressing are accounted for now; their management UI is not.
