# T1/T2 consolidation — execution schedule addendum

**Baseline:** [PR #317](https://github.com/Biskiq/spatial-sketch-editor/pull/317), head
`29a710590854be4170d00fa6c4651ac7577eebad`, production base `afca870f`.
**Status:** owner-approved execution schedule as part of Tier 2 PR #317 (2026-11-13). This addendum itself implements no production remediation; every E/X packet remains separately claimed, reviewed and verified. D1 authorises two bounded spot checkpoints and named traces; see the ratified D1–D5 decisions in [README.md](./README.md#owner-decisions). The audit, renderer design, invariants and slice specifications remain the behavioral baseline.
This document replaces only the baseline's one-slice-per-PR packaging and four-lane schedule.
Where packaging differs, use this schedule; for behavior, algorithms, thresholds and stop rules,
use [the slices](./slices.md) and [renderer design](./renderer-refactor.md).

The existing work is packaged into **13 PR groups rather than 20** (C0; I1–I5; G1–G4; R1;
R2a/b/c; R3–R8). **Eight additional extraction PRs** cover the newly requested God-file work.
Those counts follow ownership and rollback seams; neither PR count nor concurrency is a quota.
The [decomposition plan](./decomposition.md) specifies the extraction destinations, interfaces,
lifetimes and parity cases. An agent can take a ready group without another design round.

## Scope and operating rules

- Every baseline slice and conditional substep has an owner below. Combining slices does not waive
  their individual preconditions, measurements, tests or refusal/rollback rules.
- Read the linked specification, claim the group with its capability ids, check issues/draft PRs
  before and immediately after the claim, and list the exact mutation paths in that PR. These are
  execution claims, not new capability definitions or a second status ledger.
- Characterize the production caller first. Separate extraction, assigned behavioral changes and
  parity evidence in review. No new algorithm beyond the packet's baseline slice.
- Each PR wires its modules, removes their obsolete implementation and carries tests/guards.
  No unused scaffolding, permanent dual path, service locator or shared mutable context bag.
- A group may proceed with its invariant/refactor part when a gated optimization is declined.
  Record each gate separately; the baseline behavior remains the fallback. A dependency on a
  gated slice means its decision and required interface are settled, not that its optimization ran.
- Refactor-only work is Tier 1 when it reaches shared shell, visitor or ownership contracts.
  E0 retains C0's Tier 0 unless its actual scope triggers a higher tier; E5 retains G3's Tier 0.
  Baseline Tier 2 decisions still belong to the owner. This plan introduces no new dependency,
  persisted format, product interaction, Camera authority or renderer backend decision.

## Complete baseline coverage

| Baseline specification | Execution owner | Condition preserved |
| --- | --- | --- |
| C0 | E0 | Counters, mounted seam, M/L/Scene fixture baseline; D1 governs traces/spot checks and #273 repair |
| I1 | E3 | Stage rest frames only; Preview hold is counted, never switched to on-demand here |
| I2 | E4 | Canonical passive-record read and project-owned compile session; no new cache |
| I3 | E1 | Establish all three dead-path preconditions first; stop if a path is live |
| I4 | E2 | Enumerate navigation callers before editing; retain the baseline stop rule |
| I5 | E4 | Candidate and accepted Opening symbols share Layout's builder |
| G1 step 1 / step 2 | E4 | Step 2 requires its own remaining-cost trace after step 1 |
| G2 / optional validation retention | E2 | Independently measure Scene, texture and validation claims; no unjustified validation cache |
| G3 step 1 / step 2 | E5 | Incremental Paper follows only a material-cost trace |
| G4 | E8 | Shadow triggers follow caster content; only playing animation permits per-frame shadows |
| R1 | E1 | Identity, visibility and portability guards |
| R2a | E6 | Shared material/texture stores and Layout surfaces; D4 pipeline dependency |
| R2b | E7 | Pure resolved look, Scene materials and deferred texture release |
| R2c models | E8 | Shared model remaps |
| R2c artwork/environment/plinth | E9 | Completes world-material constructor retirement |
| R3 retained Rooms | E6 | Ownership refactor remains even if the open-time hypothesis fails |
| R3 optional floor/ceiling batching | E11, after its full dependency set | Retains R3's draw-bound and ≥25% draw reduction gate; see E11 for timing eligibility |
| R4 | E7 | Shared primitive/Form geometry and retained Scene representation |
| R5 models | E8 | Static versus skinned/animated hierarchy ownership and arrival event |
| R5 artwork / alpha-tested shadows | E9 | Custom depth/distance fallback remains unless silhouette parity is proved |
| R6 | E10 | Waits for Directional retirement and D4; does not retire Directional itself |
| R7, each of its three independent parts | E11 | Draw-bound experiment, ≥25% render-time gain at L and no M regression |
| R8 | E12 | Mechanical rename last, after all content owners release affected paths |

Baseline unscheduled items stay unscheduled: AR-7/D2 free look, AR-9 unfold placement, AR-10
outline-union ownership, AR-11 Directional retirement as a separate product slice, Preview render
mode, picking acceleration, and all renderer-design exclusions. Decomposition does not turn these
into remediation. R8 remains in the complete schedule even though the baseline permits it to be
skipped if the owner cuts the milestone short.

## Dependencies and concurrency

An arrow is a required landed interface or completed gate. A predecessor that touches the same file
must release it before the successor mutates it. Work may be prepared against a reviewed predecessor
with an explicit dependency, but must not claim independent mergeability until that dependency lands.

```text
E0 -> E1 -> E2 -----------+
         -> E6 ----------+-> E7 -> E8 -> E9 -> E10 [owner decision D4]
         -> E3 -> X1 -> X2 -> X3
E0 -> E4 -> X5 -> X6
E0 -> E5
E0 -> X7
E0 -> X8

X4 waits for E3 + E4 + X6 (facade/adapter interfaces frozen).
E6 also needs owner decision D4's pipeline record/default.
E9 leaf work can overlap E8; shared wiring lands after E8.
E11 waits for E3 + E6 + E7 + E8 + E9; independent of E10 once its own gates can run.
E12 waits for E1–E11 and X1–X8, including measured/declined gated outcomes.
```

**Naming:** E ids package baseline slices; X ids package new extractions. Baseline owner
decisions retain D1–D5.

There is no fixed wave barrier after E0. E1, E4, E5, X7 and X8 have independent mutation
surfaces and can run concurrently. After E1, E2, E3 and E6 can run together. After E7, E8 and E9 can
prepare separate content handlers concurrently; E8 owns their shared integration seam and E9
lands after it. X1–X3 use the route serially while rendering and adapter work proceeds. X4 can run alongside later renderer
work once its listed facade predecessors release the file. X7/X8 do not need renderer changes.
The shared heavy-test slot and integration gate, not an arbitrary agent limit, constrain verification.

## Integration ownership

Paths in this table are existing paths unless labelled **proposed**. Folder abbreviations below are
relative to `apps/editor/src/lib/`: **stage** = `authoring/stage`, **adapters** =
`authoring/adapters`, **render** = `render`, **visitor** = `visitor`, **museum** = `museum`.
The **spatial route** is `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`.

| Contended path or interface | Exclusive writer order / handoff |
| --- | --- |
| Spatial route and route call-site tests | E1's Room-prop removal → E3 → X1 → X2 → X3; route tests follow the same reservation |
| `stage/stage-facade.ts` | E3 identity retention → X4 decomposition; E4/X5/X6 consume its stable API and do not expand it silently |
| `adapters/layout.adapter.ts`, `adapters/layout/precision.ts` | E4 → X5 → X6; compile-context lifetime is fixed in E4 |
| `packages/project-model/src/units/runtime.ts`, `packages/project-model/src/scene.ts` | E0 instrumentation → E1 Room removal → E2 retention/Camera split |
| `stage/source-admission.ts`, `stage/host-acceptance.ts` | E2 only; X1 wraps the existing public API and does not modify its semantics |
| `visitor/VisitorLayoutShell.svelte`, wall representation, selection/pick consumers | E1 → E6 → E7 where applicable; E8/E9 add content handlers without touching selection/pick consumers |
| `visitor/VisitorEntityGroups.svelte` | E1 → E7; E7 installs primitive/Form dispatch; E8 wires the model handler, then E9 wires artwork. Leaf implementation can overlap; shared dispatch writes cannot |
| Resource stores, descriptor and Scene representation contracts | E6 owns material/texture contracts; E7 owns geometry and family-dispatch contracts; E8/E9 consume them. E8 owns shared representation wiring first, then E9. A contract change serializes its caller PRs first |
| `render/WorldEnvironment.svelte` | E9 material acquisition → E10 light acquisition; no concurrent writers |
| `adapters/light.adapter.ts` | X8 only in this plan; serialize against the separate Directional-retirement claim. If that claim is active, X8 waits; otherwise retirement consumes the extracted API |
| `apps/editor/test-lanes.ts`, shared import reader/test helper, reference docs | Each group carries its necessary registration/update. A short explicit file reservation serializes these edits; no permanent “integration PR” and no duplicate parser. E0 establishes reusable helpers; later groups extend them only if their invariant needs it |
| `docs/path-map.md` and all import paths changed by R8 | E12 last; it updates test roots/allowlists and documentation references atomically |

When an inspection finds another required mutation, identify its owner and transfer that path in the
PR claim before editing. Do not have two agents patch different regions of a monolith concurrently.
E8 owns shared representation wiring first and E9 integrates afterwards; this is an integration
dependency, not an architectural decision.

## Existing-scope PR packets

### E0 — Instrumentation and characterization (C0)

**Depends:** planning approval/claim; owner decision D1 only for its authorized measurements.
**Owns:** precisely C0's counter sites, existing perf hook, new test helper/Scene counting fixture,
and temporary measurement record. Add the shared boundary-test support only when used by a passing
baseline characterization; no empty future tests. Freeze names and fixture inputs for later groups.
**Gate:** C0 caller counts and inert observer behavior; missing GPU/timing rows stay unmeasured.
Owner decision D1 governs #273's optional patch; its absence does not hold deterministic work.
**Rollback:** revert instrumentation/helper together; no runtime fallback required. Downstream tests
depend on the counter API, so once consumed retain the inert seam or revert dependent tests first.

### E1 — Remove retired frames; own render identity (I3 + R1)

**Depends:** E0. **Owns:** I3's Room registry/types and visitor/Canvas props; R1's Wall/Object index,
visibility API, pick source and selection layer; portability, identity and wall-shell boundaries.
**Sequence:** establish I3's three preconditions → delete the dead path → add/use `objectOf` and
`setHidden` → lock portability/identity. The contract accommodates the baseline's future instance
identity without introducing instancing. Stop and report a live Room path under I3's existing rule.
**Gate:** I3/R1 matrix, identity, O(k) visibility and pick parity; exact portability exceptions;
no functional name lookup.
**Rollback:** whole E1 before E2/E6 consume it. After that, revert dependents first; do not reintroduce
Room data or a second wall reader as an adapter shim.

### E2 — Retain independent runtime units (G2 + I4)

**Depends:** E1. **Owns:** runtime, Scene/content types, admission/acceptance previous-runtime handoff,
visitor director and Experience navigation callers explicitly allowed by I4.
**Sequence:** measure G2's unit/texture/validation work → enumerate I4 callers → split Camera
projection → retain each unchanged unit → verify host wiring. The combined PR need not ship G2's
temporary Scene+Camera retention key, but must characterize that baseline before changing it.
If the caller list exceeds I4's boundary, obey its stop rule; combining work does not expand it.
**Gate:** G2/I4's unit-identity and zero-work matrix; fresh-versus-retained undo/redo differential
including resources and diagnostics. Validation retention needs its own evidence and equal policy inputs.
**Rollback:** revert E2's types and callers together before E7; never restore mixed runtime data in
one half only. X1's epoch wrapper consumes the unchanged acceptance API and need not be reverted.

### E3 — Stable Stage evaluation and viewport controller (I1 + route extraction)

**Depends:** E1 (which already depends on E0; the route Room-prop handoff is complete).
**Owns:** spatial route refresh/tick, `stage/camera-session.ts`, facade output-array retention,
`stage/shell/StageCamera.svelte`; proposed `stage/route/stage-viewport.svelte.ts`.
**Sequence:** mount/count the old caller → move measurement/tick/refresh into the controller with
parity → apply I1 identity retention. Keep existing Camera and Experience evaluators as authorities.
**Gate:** I1's 120-tick rest/flight/invalidation matrix in Plan and 3D; one scheduled loop, none after
unmount; Preview suspends Stage evaluation; resize and Look Through use the same evaluation/rect.
Preview hold count is evidence only. See decomposition contract V.
**Rollback:** restore the old route caller and evaluation wiring together. X1/X2/X3 depend on the
controller, so later rollback retains its interface with baseline behavior or reverts consumers first.

### E4 — Compile and candidate ownership (I2 + G1 + I5)

**Depends:** E0. **Owns:** I2 compile/passive-record and planning-support paths; Layout adapter,
precision compile seam and candidate-preview; Layout Opening-symbol builder; starter-gallery
compile caller; proposed adapter candidate presenter and project-epoch-owned compile context.
**Sequence:** count → centralize compiler result reads/lifetime → extract candidate presentation →
G1 step 1 → I5 shared symbols → separately decide G1 step 2. X5/X6 receive this stable seam.
**Gate:** identical-document second compile zero, distinct identity compiles, closed-project entries
zero; still-pointer 60 ticks gives one Paper build and at most W compiles (changed-wall bound only
if step 2 runs); each changed proposal builds once; end/cancel/rebase releases the candidate memo; adapter rebinding borrows the same project compile session. Candidate
and accepted Opening segments match. Existing dense compiler differentials remain intact.
**Rollback:** G1 step 2 is independently removable while retaining step 1. Revert the compile seam
and its consumers together for an I2 differential; no second cache or copied symbol builder.

### E5 — Paper retention by responsibility (G3)

**Depends:** E0. **Owns:** StagePaper, paper-plan, paper-scene, paper-fill-geometry and their tests.
Separate selection visibility from drawing construction; keep plan assembly, GPU batches and fill
geometry in those existing owners. A small proposed `paper-selection.ts` holds addressability/
visibility decisions only. Do not relocate or rewrite outline union (AR-10 remains unscheduled).
**Gate:** selection/hover cause zero scene builds; pan/zoom and pick results are unchanged. Step 2,
if justified, changes only cache-keyed Room/Wall entries and equals a full rebuild buffer-for-buffer.
**Rollback:** remove step 2 independently; revert selection visibility only with its draw-range
consumer. Shared Paper API/Plan result shape stays stable for E4 and route work.

### E6 — Layout resources and retained Rooms (R2a + R3)

**Depends:** E1; owner decision D4's pipeline record/default. **Owns:** material descriptors/store,
texture-store transfer, Wall/Object material call sites, new Room representation, Layout shell and
floor pick/selection binding. No Scene material migration yet.
**Sequence:** count/trace R3 → store and descriptor parity → migrate Layout materials → retained
Rooms. Use the existing texture variant pool unchanged here; E7 owns deferred release behavior.
**Gate:** all R2a/R3 sharing, disposal, triangulation, retained-Room and floor/shadow/pick oracles.
Record failed H-R3 explicitly; ownership improvement is not proof of faster open. Batching is E11.
**Rollback:** entire Layout consumer/store transition before E7; after store adoption by other
families, retain the resource interface and revert Room realization independently if possible.

### E7 — Scene description, shared primitive/Form resources (R2b + R4)

**Depends:** E2 + E6. **Owns:** pure Scene render description/resolved look, geometry store,
primitive/Form handlers, Scene representation root, Scene material components and texture release;
Layout Object geometry acquisition; VisitorEntityGroups and pick hookup.
**Sequence:** R2b measurements → descriptor-keyed materials/deferred textures → shared geometry →
retained primitive/Form realization. Use the representation interface for primitive/Form content now; E8/E9 extend it with
family-specific handlers and arrival events as their consumers move. Existing model/artwork
components remain active until their own migration; never two renderers for one id.
**Gate:** all R2b/R4 structural, material/texture churn and distinct-geometry-key oracles;
nonuniform normals/UVs, picks, per-Canvas isolation and teardown remain explicit.
**Rollback:** whole E7 before E8/E9, or a content-handler rollback retaining store/identity contracts
afterwards. No fallback component may independently construct world materials.

### E8 — Models, remaps and caster lifecycle (R5 models + R2c models + G4)

**Depends:** E7. **Owns:** AssetModel/model-utils/model remaps, proposed Scene model handler,
StageShadowTriggers/shadow-invalidation. E9 owns artwork and WorldEnvironment.
**Sequence:** parity of static/animated clone behavior → shared remaps → model arrival event →
measure G4 and apply only the supported shadow-trigger change.
**Gate:** R5/R2c sharing plus G4's exact shadow counts; independent skeleton state, stale arrival
rejection and correct playing-animation shadows.
Descriptor caster keys and light inputs use the existing representations until E10 changes their
producer; E8 cannot require R6 to land. Re-measure after E9 installs artwork casters.
**Rollback:** G4 independently falls back to prior invalidation if necessary; model hierarchy/remap
transition reverts as one content family while preserving the store and instance identity contract.

**Owner exception (E8 correction; bounded, tracked):** E7's retained representation does not draw
models. Until E8's remaining work lands, a model's placeholder is the Svelte `AssetFallback` tree
(`src/lib/museum/assets/AssetFallback.svelte`, shapes from `src/lib/museum/assets/fallbacks.ts`), and
`src/lib/museum/assets/AssetModel.svelte` is the per-entity host that realizes the model. The
exception covers exactly those two files for the Svelte-tree fallback and host. It adds no
fallback renderer and does not redesign E7. Remaining work, owned by E8 and required before E12: port
the approved fallback shapes to the E7 representation and retire the `AssetModel.svelte` host. E12
must not start until that port and retirement are merged or a new owner decision re-records the
exception.

### E9 — Artwork and remaining world materials (R5 artwork + rest of R2c)

**Depends:** E7 for leaf work, E8 for integration. **Owns:** EntityArtwork/artwork-scope, proposed artwork handler, environment ground
and GroundPlinth materials; remaining material allowlist entries. Leaf work may run alongside E8; shared wiring and exact material/portability allowlists land after E8.
**Gate:** A artworks of s sizes use 1 + 3s geometries; image leases/fidelity and frame/mat/backing
properties equal baseline; alpha silhouette parity before removing custom depth/distance materials;
otherwise retain the exact approved portability exception. Remaining world material constructors
are in the factory; editor ink remains separately allowed. E8 and E9 together complete R2c/R5.
**Rollback:** artwork handler/resources together; the alpha optimization independently. Retain the
factory acquisition interface for environment/plinth even if artwork parity requires a fallback.

### E10 — Resolved lights (R6)

**Depends:** E8 + E9 and separate Directional retirement under owner decision D4. **Owns:** resolved
light descriptors/store, EntityLight and WorldEnvironment light acquisition. X8's authoring adapter
has no renderer ownership and is not a prerequisite unless a shared path is discovered.
**Gate:** Point/Spot/Sun property, intensity-unit and shadow-camera parity; existing S3 suites; one
light realizer boundary. No silent Directional carry-forward or new light feature.
**Rollback:** descriptors, store and consumers together. The external retirement is not reverted.

### E11 — Measurement-gated batching (R7 + R3 optional batching)

**Depends:** E3 + E6 + E7 + E8 + E9. **Owns:** representation internals only. **Not** E10-dependent:
if Directional retirement is pending, measure the current retained lights and record that context.
Keep R7's order: Scene instancing (threshold 8), Room batches, then Walls only if still draw-bound.
One PR may contain independently justified parts; an unproven part is excluded, never inferred
from another family's result. Take a fresh measurement after each included part.
**Gate:** draw-sensitivity experiment; R7 ≥25% render-time improvement at L and no regression at M
per part; R3's separate ≥25% draw reduction for floor/ceiling batching; world-vertex parity,
instance-id picks/selection, hidden instances, one-item range patch, resource release. The thresholds
remain measurement decisions under owner decision D1, never noisy CI wall-clock assertions.
An R3-only Room batch uses the same E11 dependencies and PR owner. It can proceed under R3's
original gate without claiming R7's timing result; identify it separately and keep R7 unresolved
until its evidence exists. There is no earlier batching PR or readiness exception.
**Rollback:** each part independently to retained unbatched realization; consumer APIs unchanged.
If evidence does not support batching, a measured decline completes this group with no optimization.
If the required measurement is unauthorized or unavailable, it stays unmeasured/pending.

### E12 — Final placement and names (R8)

**Depends:** all preceding renderer packets and decomposition groups release touched paths; E10
must have completed, and E11 must be completed or explicitly measured/declined. No forced bypass
of an externally blocked R6. **Owns:** remaining museum-to-render moves, validation-option name,
imports, test source roots/exact allowlists and path-map references. No behavior edits.
**Gate:** existing tests at their new paths, whole architecture gate, type/build gates required by
the test contract; diff shows moves/imports/names only. Remove obsolete exceptions, not checks.
**Rollback:** the complete rename/import map; no mixture of old and new production import roots.

## Decomposition PR packets

The following are mandatory additive scope, not optional performance hypotheses. They preserve
behavior and satisfy the more detailed [ownership contracts](./decomposition.md).

| PR | Depends | Exclusive mutation scope | Acceptance / rollback unit |
| --- | --- | --- | --- |
| X1 — Route epoch and asset leases | E3 | Spatial route activation/replacement/teardown, proposed route project-epoch and asset-lease controllers; call-site tests | Project load/replacement/stale completion/save/history behavior and disposal order match; revert wrapper plus route wiring, preserve project-session/acceptance internals |
| X2 — Route input and gesture lifetimes | X1 | Spatial route input, Unfold/artwork gesture logic; proposed input/Unfold/artwork controllers; gesture tests | One captured owner/lease, same precedence/refusals/accepts/cancel behavior; revert all event wiring with controllers |
| X3 — Route presentation and shell components | X2 | Remaining route Card/Index/Find/toolbar projections and markup/CSS; proposed presenters and cohesive shell regions | Same DOM roles/focus/shortcuts/responsive layout and eager Experience entry; route left as composition; rollback presenters and component markup/styles atomically |
| X4 — Facade responsibility split | E3 + E4 + X6 | stage-facade internals and new facade leaf modules; facade boundary/behavior tests | Same public API, notification timing, binding teardown, selection and Camera ticket behavior; revert internal split without changing callers |
| X5 — Layout drawing and Opening placement | E4 | layout.adapter and proposed Ink/Opening-placement controllers; existing drawing planners remain authority | Line/box/arc/circle and Opening placement parity, nonce/capture/typed entry/re-arm lifecycle; rollback factory delegation and controllers together |
| X6 — Layout manipulation and contributions | X5 | Remaining layout.adapter gestures, Room operations and contribution projections; proposed cohesive controllers/readers | Wall/curve/junction/Opening/Room gesture and command parity; adapter left as registration/dispatch; same cancellation order; rollback each delegation with its leaf, full public API unchanged |
| X7 — Scene placement and object manipulation | E0 | scene.adapter and proposed Scene placement/mark/presentation leaves; reuse existing scene/placement | Placement/fallback/contact/form and move/turn/size/lift parity; same history/leases; rollback factory delegation, no resource-store changes |
| X8 — Light authoring controller split | E0; serialize with external retirement claim | light.adapter and proposed placement/gesture/presentation leaves | Existing light-kind behavior, target/range/intensity/lease/refusal parity; no Directional retirement here; rollback leaves and factory delegation together |

Each packet is one semantic integration boundary. If inspection of its actual diff reveals another
independent state machine that cannot be reviewed with that packet's parity matrix, split at the
named controller boundary, preserve the same dependencies and path reservation, and attach both PRs
to the packet. This is packaging, not a new planning round. Never split by an arbitrary line budget.

## Executable enforcement and behavioral gates

Implement these in the packet that first transfers the responsibility; do not defer guards to a
final cleanup PR. Extend an existing suite where it already owns the defect. New architecture suites
use the existing `tests/helpers/import-closure.ts` parser/resolver, inspect Svelte script/template
constructors where relevant, and register in `test-lanes.ts` in the same PR. Test direct, aliased,
re-exported and dynamic import paths where the forbidden dependency could hide. No parallel regex
grammar. Exceptions are exact site/symbol sets with an owning baseline reason; a new exception is
not an automatic way to make a failing guard pass.

| Guarantee | Owner and executable guard | Behavioral / mutation proof |
| --- | --- | --- |
| Route composes; controllers own effects | E3/X1–X3, proposed `spatial-route-boundary` | Route imports only entry/controllers/presenters/components and necessary platform types; no compiler, F4 planner/accept implementation, GPU constructor, independent frame loop or domain gesture algorithm. Each extraction removes its exact legacy allowance; injecting a forbidden dependency through a barrel fails |
| Cohesive controllers, no new God module | X1–X8, proposed `authoring-controller-boundary` | Explicit allowed dependency edges per contracts V/P/A/G/U/W/S/L/F in decomposition.md; no leaf imports route/orchestrator or unrelated writable owner. A cycle/import of acceptance or renderer internals into a presenter fails. Runtime tests assert leases/disposers, not file length |
| One compiler/read path | E4, baseline `compile-entry-boundary` | Exact permitted authoring seams; starter uses the permitted host/adapter seam, with no extra allowance; alias/re-export bypass fails; mounted still-pointer counts and session release fail when old repeated compile/singleton lifetime is reintroduced |
| Separate Scene/Camera runtime | E2, extend project-model boundary | Camera fields/re-merge into Scene are rejected; Camera-only mounted accept stays zero Scene work; change the retention dependency to omit resources and its differential fails |
| Renderer layer dependency direction | E6/E7, proposed `render-layer-boundary` | Pure descriptors import no Three/Svelte/editor/authored-unit readers; stores have no authoring/representation dependency; representations consume descriptors/compiled output and stores, not codecs/compiler/session. No raw renderer/GL access outside the exact baseline allowlist |
| One factory and owned identity | E1/E6–E10, baseline identity/portability/material guards plus light constructor coverage | Alias/namespace and Svelte `T.*Material`/light construction checked; no getObjectByName or functional debug-name parsing; equal keys share instances, consumer disposal cannot free another lease, setHidden/picks survive names changing |
| Lifetime ownership | X1/X2/E4/E7–E9, fast behavioral suites | Repeated mount/replacement/unmount, pending async arrivals and interrupted gestures leave zero live listeners, leases and timers; one Canvas cannot dispose another's resources; snapshot borrows Stage resources |
| Visitor/public isolation and authored truth | All packets, extend existing visitor/public/F4 boundaries | New route/controllers and authoring state unreachable from visitor roots; serialized project bytes exclude generated endpoints, renderer/selection/history/session state. Cold visitor and editor preparation agree |

Mutation checks are targeted demonstrations of a boundary or replacement assertion: temporarily
reintroduce the old defect, prove its intended test fails and an unrelated control remains green,
then restore the source. Existing source-shape assertions move only when a same-defect successor
has been proved; no check is dropped merely because a source file was split.

## Verification, measurements and completion

The authoritative commands and lane semantics remain in
[the test contract](../../../apps/editor/tests/README.md) and
[CI/merge automation](../../operations/ci-merge-automation.md). Every PR runs its complete affected
behavioral contracts locally, the whole architecture lane at the review gate, applicable package
checks and subsystem escalation. CI selects Minimal/Focused/Full from the integration delta; full
coverage includes fast, arch, heavy, editor check/build, API check and DB-backed API tests with zero
skips, plus affected package checks. Consolidation saves duplicate PR overhead; it does not weaken
lane membership or path-gate architecture. Shared helper/lane changes retain their full-suite
acceptance obligation. Do not duplicate the full/heavy suite locally without the required authority
and shared-machine headroom; use focused reproduction for CI failures.

Each PR records slice ids, owners/dependencies, identical-fixture before/after counts, each gate's
apply/decline/unmeasured result, parity/call-site/mutation evidence, local versus CI checks, focused
Stage/Preview QA and rollback dependents. No bulk browser capture or exhaustive replay requirement;
manual visual acceptance remains the owner's.

Measurement policy is unchanged. D1's unresolved default does not justify a full benchmark matrix,
new harness/CI timing gate, or treating missing evidence as success. Named traces and the two spot
check checkpoints require the baseline's owner initiation. Counts-first invariant work continues;
gated steps without the necessary measurement remain pending. The final D1-authorized spot check,
if any, is evidence in the last applicable implementation PR, not a closeout PR. Original baseline
numbers and per-group pre-change measurements are both retained so concurrent improvements cannot
be mistaken for the local change's effect.

Rollback follows dependencies: revert an unconsumed packet as a unit; otherwise retain its public
seam for an internal rollback or revert consumers first. Resource disposers and type/consumer
changes are atomic. No dual production path or persisted migration is added for rollback.

One fresh-context review per PR follows the workflow. Integration uses the native merge queue once
activated; no sibling rebase/CI-refresh choreography. Each packet completes on its own merge after
the appropriate gate/owner decision; this planning task performs no merge. The full scope is not
complete while a conditional item is merely unmeasured, R6 waits on its external prerequisite, or
a decomposition boundary is still carrying the extracted responsibility. No new acceptance,
phase-close or milestone-close document is required.
