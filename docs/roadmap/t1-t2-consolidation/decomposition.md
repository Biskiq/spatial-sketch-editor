# T1/T2 consolidation — God-file decomposition

**Additive scope to [PR #317](https://github.com/Biskiq/spatial-sketch-editor/pull/317).**
This is an ownership/extraction inventory at `29a71059`, not a repeat of the baseline architectural
or performance audit. [The execution schedule](./execution-schedule.md) owns PR ordering and gates;
[the renderer design](./renderer-refactor.md) and [slice specifications](./slices.md) remain intact.
All names marked **proposed** describe future files; this change creates no implementation.

## Inventory and disposition

Counts use baseline `splitlines`, including comments/styles: the approximately 6,294-line spatial
page counts as 6,293. Inspection covered function/state/effect boundaries, imports, composition and
test owners. Mixed responsibilities and lifetimes, not size alone, determine extraction.

| Existing file (repository relative) | Lines | Responsibility seams / disposition |
| --- | ---: | --- |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte` | 6,293 | Project epoch and async asset ownership; viewport/frame loop; event arbitration; artwork/Unfold gestures; Card/Index/Find projections; shell markup/styles. E3 + X1–X3 remove these from the route in that order |
| `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` | 7,510 | Candidate presentation, Ink/Opening placement, Wall/curve/junction/Opening manipulation, Room move/duplicate, task/Card/mark contributions. E4 + X5/X6 leave an adapter factory/dispatcher |
| `apps/editor/src/lib/authoring/stage/stage-facade.ts` | 2,701 | Public types, adapter binding registry/notifications, Plan retention, projected contributions, selection/picking and Camera ticket coordination. X4 keeps the facade's public contract and delegates its independent internals |
| `apps/editor/src/lib/authoring/adapters/scene.adapter.ts` | 2,545 | Placement lifecycle, shape reading, object marks/transform gestures, candidate presentation and contributed actions. X7 separates these using the existing Scene placement session |
| `apps/editor/src/lib/authoring/adapters/light.adapter.ts` | 2,129 | Placement, edit gestures, screen guides/dials and Card/actions. X8 splits authoring only; E10 separately owns light realization |
| `apps/editor/src/lib/authoring/adapters/layout/precision.ts` | 1,598 | Existing precision planners plus compile-session lifetime. E4 extracts the session seam; X5/X6 reuse the planners rather than copying them |
| `apps/editor/src/lib/authoring/stage/paper-plan.ts` | 957 | Plan-to-Paper assembly and the already-recorded outline union. E5 separates visibility from geometry; no new geometry authority or AR-10 remediation |
| `apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte` | 1,247 | Visitor run/surface lifetime. Retain this owner; E3 counts holds only. Route extraction must not pull authoring state into it |
| `apps/editor/src/lib/authoring/project-session/project-session.svelte.ts` | 986 | Already owns cloud load/save/replacement protocol. Reuse it through X1; do not copy its logic into a new route controller |
| `apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts`; `ExperienceGuide.svelte` in the same directory | 2,054 / 1,980 | Existing T3 controller and Guide surface, with distinct domain ownership. X3 delegates to them; their internal command/guide decomposition is outside this T1/T2 extraction. No lazy-loading or new Experience behavior |
| `packages/layout-core/src/layout-wall-first-precision.ts`; `layout-geometry.ts`; `layout-world-index.ts`; `layout-plan-representation.ts` in that directory | 3,413 / 2,853 / 2,146 / 1,693 | Domain computation and canonical compile/Plan owners. Only E4's specified compile/symbol changes; no line-count-driven kernel split or moved algorithm |
| `packages/project-model/src/units/planning.ts` | 2,688 | Planner registration plus existing cross-unit atomic planners. Keep its atomicity/contracts; E2 changes runtime preparation, not these command semantics |
| `apps/editor/src/lib/layout/wall-mesh-builder.ts`; `packages/camera-core/src/camera-motion.ts`; `packages/camera-core/src/viewport.ts` | 2,116 / 2,083 / 1,772 | Runtime-safe mesh realization and Camera math. Retained authority; no new pose evaluator, mesh compiler or navigation graph |
| `apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte`; `EditorHead.svelte`; `EditorCard.svelte` in that directory | 1,317 / 1,054 / 895 | Existing cohesive shell surfaces. X3 passes view models and commands to them; do not duplicate or merge them into a mega-shell |

Retained files keep their existing contracts/tests; no further audit is required for this plan.
New renderer stores/representations also receive cohesion boundaries below.

## Extraction rules and common ports

The spatial route ends as a **composition root**: read route parameters, construct typed owners,
connect read-only view models and named commands, mount the existing shell/Stage/Preview regions,
and invoke one ordered teardown. No domain planners, candidate math, resource acquisition,
pointer-state machine or refresh algorithm remains in it. This is a responsibility gate, not a
target line count.

Controllers accept only their listed typed reads/commands/subscriptions. Reads are immutable;
mutations use existing session, acceptance or domain owners. The composition root connects siblings;
no writable route-state bag or leaf import of the route/orchestrator/sibling mutable internals.

- **Epoch port:** current epoch/revision identity, `isCurrent`, accepted-snapshot subscription and
  existing acceptance commands. No new revision counter, history, save state or acceptance writer.
- **Viewport port:** current rect/evaluation token; submit existing `ViewingIntent`; world/CSS
  projection through the facade. No stored independent pose/FOV or reconstructed projection.
- **Gesture port:** existing `session` lease acquisition/release, captured pointer and interruption
  reason, accepted snapshot reader, preview/cancel/commit commands. One lease authority remains.
- **Presentation port:** immutable selection/task/contribution records and named command callbacks.
  A presenter cannot install a candidate, accept a document, write history, or allocate GPU objects.
- **Resource port:** owner-scoped acquire/release handle, current epoch check, renderer-independent
  content keys. URL/blob leases belong to the project/asset owner; GPU resources to the Canvas.

These ports wrap landed contracts. Pure transformations use `.ts`; rune controllers use
`.svelte.ts` in a component effect scope or owned `$effect.root`, never module scope. Controllers
have idempotent disposal of their own acquisitions. No event bus or DI framework.

## Spatial route extraction contracts

All proposed controller files in this section live under
`apps/editor/src/lib/authoring/stage/route/`; proposed shell region components live under
`apps/editor/src/lib/authoring/stage/shell/`. Existing route line references are locators at the
baseline, not future test assertions.

### V — Viewport and refresh (E3)

**Proposed:** `stage-viewport.svelte.ts`, with a pure `stage-viewport-view.ts` only if needed to hold
the read model. Moves `measure`, `measureThroughFrame`, `acceptRect`, `refresh`, rAF installation,
Plan view retention and overlay view publication (route approximately 1510–1855; state near 788,
938–1005). Host-tool overlay projection may be a pure leaf, not a second controller loop.

**Inputs:** element/Look Through rect readers; facade getter; existing Experience lens advance
callbacks; immutable preferences/reveal flags; Preview-active predicate; injected clock/scheduler
for deterministic tests. **Outputs:** rect, immutable evaluation, Plan view, markers, candidates,
guides/labels/ghosts/marks and a single refresh command. The facade/Camera retain computation and
identity authority; the controller publishes their result.

**Lifetime:** one scheduler for the mounted route; project replacement resets view-dependent keys
without opening another loop; Preview pauses Stage evaluation and unmounts its Canvas as today.
Stop scheduling before disposing the facade. Resize/Look Through scissor use the same measured rect.
Preserve the `finally` reschedule behavior on a throwing contribution, and stop rescheduling after
disposal. I1 then stabilizes object/array publication; it does not remove needed invalidation.

**Proof:** E3's rest/intent/frame counts through the real composed caller; resize, Plan/3D switch,
Look Through, reduced motion and Preview entry/exit; throw-once adapter still permits the next
frame; teardown leaves zero queued callbacks. Mutation: unconditional assignment/evaluation must
fail the settled-render test.

### P — Project epoch composition (X1)

**Proposed:** `stage-project-epoch.svelte.ts`. Moves activation/replacement/reset wiring (roughly
1378–1506), acceptance/contribution subscriptions and project-bound teardown from `onMount`.
It composes existing `project-session`, `StageSession`, facade, acceptance host, adapter services,
Preview and Experience focus controllers. It does not duplicate their protocol implementations.

**Inputs:** the admitted snapshot and existing controller factories; named presentation-reset and
gesture-interrupt callbacks; current project-session API. **Outputs:** current facade, acceptance
and services handles, accepted snapshot/history read model, `activate` and `dispose`. Navigation
guard registration stays at route initialization through the existing project-session API.

**Lifetime:** one acceptance/facade pair per admitted project epoch; release old subscriptions before
new ones can observe it. Preserve baseline ordering: interrupt old input, replace through the
session, reset Preview/focus, dispose old bindings/facade/acceptance, create and subscribe to the
new owners, mount save, reset presentation. On route exit, stop lens/viewport/input callbacks,
mark teardown, release subscriptions, dispose project-session and project-bound owners/assets,
then the Stage session. Use an event-log characterization before moving this code rather than
inferring a new disposal order from that summary.

**Commands:** move route undo/redo orchestration (approximately 2057–2136) here, preserving gesture
interruption, preview closure and existing acceptance commands; do not implement history here.

**Proof:** existing source-replacement/resume-save suites plus repeated epoch changes; stale load,
save, accept, contribution and asset completions cannot mount or write into a newer epoch. Dirty,
undo/redo availability, rejected sources and pending-save offer behavior remain identical. No new
network write occurs at boot; no second history survives replacement.

### A — Approved asset leases (X1)

**Proposed:** `stage-asset-leases.svelte.ts`. Moves `resolveModels`, model pin/signature maps and
their URL cleanup (roughly 1858–1925), plus the route-owned artwork-scope lease wiring into separate
model/artwork lease functions if they require different acquisition rules. Placement gestures stay
in contract W; model realization is E8, not this controller.

**Inputs:** approved resource pins from the current accepted snapshot, existing resolution services,
epoch guard. **Outputs:** immutable URL map/load status and leased artwork scope for the Stage.
**Lifetime:** resource identity changes acquire new leases and release old ones; unrelated accepts
retain them. A stale async result releases its own resources and never replaces a newer map.
Project replacement/disposal releases each acquired URL exactly once. Visitor consumers borrow;
they never revoke the route's URLs. Canvas stores independently own GPU allocations.

**Proof:** unchanged pins cause no acquisition; replacement during load, failure fallback footprint,
repeated mount/unmount and Preview transitions; no double revoke or cross-epoch publication.

### G — Input arbitration and navigation intent (X2)

**Proposed:** `stage-input.ts` (runes only if observable view state requires them) and
`stage-keyboard.ts`. Moves pointer/click/wheel/key dispatch (roughly 2894–3820), hover, pointer
capture and interruption registration. Keep one top-level arbitration owner. Extract keyboard
routing as a leaf policy over the same commands, not another gesture owner.

**Inputs:** evaluated viewport port, canonical selection/task reads, current adapter dispatch,
existing press/lease helpers, specialized gesture handlers U/W, Preview/lens state, element capture
functions. **Outputs:** DOM handlers, cursor/hover read model and explicit interruption command.
No Layout/Scene planner or direct `accept` implementation is permitted here.

**Lifetime:** bind once to the active host; dispatch only to the current epoch. Preserve precedence
among specialized marks, adapters, host tools and navigation, including suppressed click after drag,
pinch termination and lost-capture handling. Blur/hidden/escape/replacement/unmount invoke the
existing interruption policy exactly once; not every interruption is silently turned into commit.

**Proof:** current spatial-route gesture matrix plus representative pan/orbit/pinch/wheel, keyboard
focus suppression, drag-to-click suppression, Alt snap restoration, cancellation/lost capture,
Preview and lens switch. Assert selected id, accepted bytes/history count, lease state and handler
order, not the extracted function names.

### U — Unfold gesture sessions (X2)

**Proposed:** `stage-unfold-gestures.ts`, with separate pin/edge/Opening session leaves if required.
Moves route-local sheet pin/edge/Opening drag state and handlers (roughly 2275–2757). Reads the
existing unfold session and layout-core development maps; it owns neither geometry nor the Sheet.

**Inputs:** viewport/gesture ports, existing unfolded selection and planner commands, current Sheet
frame reader. **Outputs:** bounded gesture start/move/end/cancel handlers and overlay views.
**Lifetime:** one active captured operation, with its source epoch, baseline and lease; cancellation
and rebase clear previews. No persistent frame or Room authority.
**Proof:** pin jump/drag, edge move, Opening move/resize, refusal and Escape/lost capture; same
canonical planner payload, one accepted operation on completion, zero on cancel. Do not invent
Height Sheet numeric entry or pin removal held by issue #284.

### W — Artwork placement and direct manipulation (X2)

**Proposed:** `stage-artwork-interaction.svelte.ts`. Moves placement/drop and resize/move/turn state
and handlers (roughly 1035–1235) and their hanging-guide view projections. Keeps existing artwork
placement and resize planners/helpers; no image/resource store or render-material constructor.

**Inputs:** approved asset lease, immutable selected artwork, current wall-hit/viewport readers,
existing planner/accept commands and gesture port. **Outputs:** drop/resize handlers, candidate,
blocked state and guides. **Lifetime:** one gesture/candidate per operation, canceled on source
replacement, lens/task interruption or disposal; unresolved asset work cannot commit after cancel.
**Proof:** wall-bound and free placement, translated/turned/resized candidate, rejected drop,
Escape/blur, source replacement mid-resize and one F4 history entry on success; artwork pixels,
shadow/material ownership and URLs remain with their existing/render refactor owners.

### S — Presentation and shell regions (X3)

**Proposed presenters:** `stage-selection-view.ts`, `stage-contribution-view.ts`,
`stage-shell-state.svelte.ts`. Split Card/Index/source-locator/read-only membership and labels
(roughly 3833–4240), Find/Dock/toolbar projections and named command routing (4241–4680), and
disclosure/preferences/responsive state. Add a narrow `stage-shell-commands.ts` for contribution,
selection/task/tool/delete dispatch; pure presenters only return records and callback references.
Drafting/Height Sheet bindings (roughly 834–937) live in shell-state and call the existing helpers;
viewing wrappers (1927–2056) delegate through V. Reuse the existing selection store, world-index,
experience-index, drafting and height-sheet helpers; no copied store or index evaluator.

**Proposed components:** `StageProjectNotices.svelte` (save/resume/source findings),
`StageViewportRegion.svelte` (existing Canvas, marks, Look Through and Height Sheet composition),
`StagePanels.svelte` (existing Index/Card/instrument surfaces) and `StageToolbars.svelte` (world and
Experience toolbar placement). Keep EditorHead, EditorIndex, EditorCard, StageCanvas and
ExperienceHomesHost as their existing owners. These components accept grouped, typed read models
and commands, not the complete facade/acceptance/service bag.

**Experience bridge:** proposed `stage-experience-binding.svelte.ts` owns the route-local lens,
view/path-mark and Look Through wiring (roughly 499–787), delegating capture/path editing/playback
to the existing Experience controller and lens. It receives gesture/viewport ports, exposes callbacks
and view records, and disposes only its subscriptions/leases; no Camera or Experience domain math
moves into it. Test path drag interruption and pending view-write parity through the real caller.

**Lifetime:** disclosures belong to the existing route/session lifetime; domain selection remains
canonical. CSS moves with the DOM region it styles, preserving selectors, stacking, scissor/pointer
areas, semantic tokens, coarse targets, focus return and responsive breakpoints. Shared shell layout
styles stay at the composition root. Preserve eager Experience mounting/entry: issue #280 is not
authorization for lazy loading. Preview still removes authoring chrome and the Stage Canvas.

**Proof:** same Card/Find action availability/refusal and selection identity; Head save/history state;
world/Experience switch, narrow and coarse-pointer layouts, reduced motion, disclosures and keyboard
focus; one Canvas and no authoring DOM while Preview owns output. Use component-level behavior and
focused manual Stage/Preview QA, not a mandatory screenshot suite.

## Facade and adapter contracts

### F — Stage facade (X4)

**Proposed leaves under `authoring/stage/facade/`:**

| Module | Responsibility / permitted inputs | Lifetime and forbidden responsibility |
| --- | --- | --- |
| `adapter-contract.ts`, `view-contract.ts` | Split existing facade public types by adapter versus view/selection protocol; preserve exports from stage-facade | Types only; no executable state disguised in a “types” barrel |
| `adapter-bindings.ts` | Registration, bind/rebind/end and contribution-change notification; receives snapshot/selection/context getters | One registry per facade; old binding ends once before replacement; preserve deferred microtask notification during reads; no history, Camera evaluation or renderer |
| `plan-view.ts` | Existing Plan retainer, key and parameter/reveal reads | One retainer per facade/source; consumes compiled geometry and existing Plan evaluator; no compile cache or second Plan evaluator |
| `contribution-view.ts` | Project adapter marks/overlays/candidates/guides through a supplied evaluation; preserve E3's identity retention | Immutable views for current inputs; no binding registration, input dispatch or independent projection |
| `selection-pick.ts` | Existing selection qualification, hit ordering and reveal/inspection projection over canonical session/pick sources | No second selection store, render object lookup by name or geometry reconstruction |

The remaining facade coordinates content install, the existing Camera session/tickets, canonical
selection and delegation. Do not replace one 2,701-line file with a 2,600-line `facade-controller`.
Keep public function signatures/re-exports stable so every adapter does not need a simultaneous
rewrite. Leaves consume narrow callbacks or value types; no leaf imports `stage-facade.ts` for
runtime access. Public type dependencies use the new contract files.

**Proof:** existing stage-facade/binding/camera/selection suites; one teardown per binding across
rebind/dispose, register-during-read notification timing, stale ticket refusal, selection survival
through accept/rebase, Plan/overlay identity retention and identical contribution ordering. Observe
facade outputs through public calls; test its route wiring separately. No change to Camera math.

### L — Layout adapter (E4, X5, X6)

**Proposed leaves under `authoring/adapters/layout/`:**

| Packet | Cohesive owner | State / interface |
| --- | --- | --- |
| E4 | `compile-context.ts`, `candidate-presenter.ts` | Project-epoch-owned canonical compile session borrowed by bindings; one separate candidate/reading memo per live binding; begin/read/reset/dispose. Existing candidate-preview owns conversion and Layout owns Opening symbols |
| X5 | `ink-session.ts` | Line/box/arc/circle draft, captured operation nonce and in-flight guard; pointer/key/reading commands, preview/readings and cancel; calls existing drawing planners |
| X5 | `opening-placement-session.ts` | Preferred host, edge-positioned candidate and placement defaults; pointer/typed placement and re-arm; existing Opening planners remain authoritative |
| X6 | `wall-gesture-session.ts`, `curve-gesture-session.ts`, `junction-gesture-session.ts` | Scalar/wall transforms, knot/bend/radius gestures and junction move/removal respectively; each owns its captured gesture and delegates canonical planning |
| X6 | `opening-gesture-session.ts` | Existing slide/width/edge/corner/typed edit of an accepted Opening; distinct from creation state |
| X6 | `room-gesture-session.ts` | Existing Room move/duplicate captured proposal and rejection presentation; no Room coordinate-frame authority |
| X6 | `layout-contributions.ts` | Read-only facts, Card actions, marks/tasks and command descriptors; commands delegate to sessions/registered planners; no hidden gesture state |

`layout.adapter.ts` keeps planner registration, adapter identity, persistent-in-adapter defaults
that already survive rebinding, controller construction and the explicit existing dispatch order.
The adapter factory owns the compile context for the opened project epoch; facade/project teardown
releases it, while ordinary binding re-creation borrows the same session. Its `bind` owns gesture
controllers and the candidate memo; binding disposal ends those exactly once, without disposing
the project compile session. Preserve the distinction
between adapter-lifetime Ink/Opening defaults and captured per-binding gestures. A rebind must not
erase a deliberately retained default, or keep a captured old revision alive. Cross-session writes
go through the adapter's named transition commands, never shared mutable closure bags.

**Proof:** characterize each family through the adapter's production dispatch before extraction:
Line/Box/Arc/Circle and close/backtrack, Opening placement/repeat, wall/curve/knot/junction edits,
Opening marks and typed numeric commit, Room move/duplicate, refusal and selected task behavior.
Assert exact candidate/accepted payload, snap/preview segments, captured id/nonce, one history
operation, same selection and no remaining lease after every termination. E4's compile counts remain
green through X5/X6. Reuse dense geometry suites; do not copy the kernels into adapters to simplify
an interface. No operation kind, serialization or authored schema changes.

### Scene adapter (X7)

**Proposed under `authoring/adapters/scene/`:** `placement-binding.ts` wraps the existing
`placement.ts` session and owns arm/reopen/complete/clear transitions; `object-mark-session.ts`
owns move/turn/size/lift and Form-ray gestures; `scene-contributions.ts` owns facts, marks, task and
Card projections. A pure candidate-Paper presenter may be extracted from the current local helper.
Keep support/contact/occluder helpers as pure helpers beside the session that uses them.

**Inputs:** Stage adapter ports, immutable Scene snapshot/geometry, current viewport and existing
Scene planners. **Outputs:** the unchanged adapter binding contract. **Lifetime:** adapter defaults
survive as today; placement and mark leases are bound to the current accepted source, not a global
singleton. Renderer resources stay entirely outside these modules.
**Proof:** primitive/model/Form placement, missing-model footprint fallback, surface contact,
refused placement, resize/rotation/lift and Form controls, task close/rebind during async acceptance,
canonical selection and exactly one history operation. Run current Scene behavior suites through
the adapter, not only extracted helper tests. No new transform math or resource sharing here.

### Light adapter (X8)

**Proposed under `authoring/adapters/light/`:** `light-placement-session.ts`,
`light-gesture-session.ts`, `light-contributions.ts` and a pure `light-guides.ts` for existing
screen-space/dial geometry. LightCardFields remains the existing field surface. The adapter wires
registration/dispatch and the current accepted light-kind set; it does not decide retirement.

**Inputs:** immutable Scene light/selection facts, viewport/gesture ports and existing planners.
**Outputs:** preview payload, guide views, field/actions and same acceptance commands.
**Lifetime:** one placement/edit lease, cleared on cancel/task end/rebind/replacement/dispose;
shared Stage light preview remains session-only. WorldEnvironment/EntityLight/store realization
belongs to E10. No light constructor or authored intensity-unit conversion is introduced here.
**Proof:** existing light-adapter-lifecycle and S3 suites; create/place, move/target/range/intensity,
selection recipe and refusal, current-kind parity, stale completion, one commit/cancel cleanup.
If the external Directional-retirement claim is already active, take it first and characterize
that landed behavior; otherwise this extraction preserves Directional until that separate slice.

## Keep the new renderer modules cohesive

E6 owns material-key canonicalization/factory and texture-variant lifetime; E7 owns geometry-key
leases, pure Scene description and the representation index; E8/E9 own model/artwork realization.
Put model/artwork handlers in proposed `render/scene/model-representation.ts` and
`render/scene/artwork-representation.ts`; primitive/Form handlers remain separate from those
asynchronous asset lifetimes. The Scene representation root dispatches by content family and owns
the aggregate identity index; it must not acquire a growing switch full of family geometry,
asset-loading, material and gesture logic. These handlers are parts of one representation, not
parallel Scene authorities or independently mounted world graphs.

Pure descriptions have no GPU/session/DOM state. Resource stores own allocation, refcounts and final
disposal only; they do not inspect authored documents or decide selection/visibility. A representation
owns retained objects/instance identity and releases store handles, never disposes a borrowed
resource directly. Per-Canvas owner teardown invalidates pending async callbacks, releases family
leases, then disposes stores; a queued texture idle-release callback cannot outlive its store.
The snapshot renderer borrows the Stage owner; Preview has its own Canvas owner.

## Guard rollout and parity ownership

E3 starts a route dependency guard with an exact list of yet-unextracted baseline sites. X1, X2 and
X3 remove their entries as the real callers move; X3 leaves no route exemption for an extracted
responsibility. X4–X8 similarly retire facade/adapter allowances. An allowance records a current
file/symbol and the extraction owner; it is not a directory wildcard. A test must reject a new
forbidden edge even while an old permitted site still exists.

The controller import guard encodes the table/ports above: composition → controllers/presenters →
landed domain APIs; pure views cannot reach acceptance, save, GPU or mutable sibling owners.
Do not prohibit every route domain *type* import merely to force a meaningless wrapper. Distinguish
type-only edges from executable imports. Reuse the shared source/import reader; use Svelte's
existing parser where template constructor inspection is required, with no new dependency.

Boundary tests protect architecture; behavior tests protect timing/order/output. Reuse the existing
`stage-shell-composition`, `spatial-route-gesture`, `spatial-route-source-replacement`,
`spatial-route-resume-save`, `spatial-route-experience-homes`, `stage-facade`,
`layout-candidate-preview`, `light-adapter-lifecycle` and relevant domain suites under
`apps/editor/tests/lib/authoring/`; Experience's existing suites remain under
`apps/editor/tests/lib/experience/`. Add focused tests mirrored to extracted owners only for a
material failure not already caught. Route composition tests continue invoking the production
wiring; helper tests alone cannot certify a moved lifecycle.

For each extraction, record the baseline event/output trace for representative cases; move the
caller; assert the same trace at the public seam, except the explicitly assigned I/G optimization's
count changes. A fixture snapshot is test-owned, not a second production implementation. Preserve
test successors by same-defect mutation proof when moving/removing a source-shape assertion. All
new boundary suites join the unconditional architecture lane. Do not test an arbitrary maximum LOC,
number of methods, component count or the exact decomposition tree.

Completion requires responsibility removal from the old file, cohesive owners/lifetimes, covered
callers/cleanup and executable dependency guards. Moving the whole script or adapter closure to
another file does not qualify.
