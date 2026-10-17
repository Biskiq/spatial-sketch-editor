# T2.P01 — Supported object composition

**Phase:** T2.P01 · **Status:** registered 2026-10-16 — `T2.P01.S01` shipped 2026-10-16;
`T2.P01.S02` shipped 2026-10-17; S03–S04 proposed and unauthorized · **Track:** [T2](../README.md) · **Roadmap:**
[gate register](../../README.md#gate-register) · **Runbook:**
[T2 operations](../../../operations/t2-composition/README.md) ·
**Contracts:** [contract drafts](./contracts.md),
[AM-1–AM-5](../../../reference/composition-execution.md#ratified-amendments)

Registered by the owner decision of 2026-10-16
([record](../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)) so that its
first slice, `T2.P01.S01`, can run in parallel with `T1.P01.S02`, `T1.P01.S03` and `T3.P01.S01`.
S02 was authorized by the later owner decision of 2026-10-16
([record](../../../reference/decisions/s02-pair-authorization-2026-10-16.md)), in parallel with
`T3.P01.S02`; S03–S04 stay `proposed` and hold no implementation permission.

**Phase outcome.** Rebuild a small, complete object-arranging experience over the current Scene
format: upright floor-supported objects, one canonical placement, Plan/3D selection, horizontal
move, yaw, positive uniform resize, duplicate, delete and exact local Undo/Redo. S01 (deterministic
candidates and canonical floor support) runs independently of a working viewport; S03 is the first
useful editing surface; S04 completes the bounded phase.

Use native box/cylinder/sphere objects and a verified subset of existing floor models. An object is
useful before it is an assembly. This gives creators real spatial work and a durable operation
boundary without making importer depth, a generic gizmo framework, materials, lighting, complete
Layout authoring or Experience migration prerequisites.

## Outcome and boundary

A creator explicitly starts T1's canonical starter gallery or opens a valid project with compiled
floor support, chooses an upright native/verified model object, places/moves/yaws it, and uses
exact input and shared Undo/Redo in Plan and 3D. S04 adds Resize, duplicate/delete and the safe
Save/reload journey. Source JSON recovery is available from the first surface.

Genuinely empty Layout still has no floor polygon: Place refuses and offers **Start gallery**
through T1's explicit project-replacement flow or opening supported source. It never inserts
architecture silently. Neither a datum nor T1's plinth is support. General Wall drawing and its
derived-role/schema cutover are not prerequisites for a validated canonical starter.

Local edits are accepted locally and dirty until an acknowledged conditional Save; the server need
not execute every editing command. A conflict preserves local work/history. F4's local
Layout/Scene capability, conditional Save and unit/compound capability have separate acceptance
evidence. Implementation runs on the landed r186 base (three 0.186.1, explicit `PCFShadowMap`):
admitted-model contact verification runs on r186 with loader ownership retained.

This is a composition foundation, not publication or the complete creator-to-visitor loop. **T2 owns
the next bounded single-model ingest phase**, using accepted F2/resource locks, F4 staged/unit
acceptance and T4 resource delivery. It must precede the promised creator/audience trial; it does
not wait for assemblies, a marketplace or a general importer pipeline.

## Evidence and actual surviving implementation

Inspected at `61baf02873a63d37e3f5a3e2992396f387600d38` (post-PR #116) and rechecked for the
2026-10-16 registration against post-PR #126 `main` (`6964c2dc`): the landed F1/F3 providers,
`layout-core`'s dependency position below `project-model`, the compiled floor query records and the
unconditional persistence `PUT` are as described. Each slice re-verifies what it touches on its own
base.

The [T2 evidence](../planning-evidence.md) preserves behavioral obligations, not the old P24
sequence. [Architecture](../../../reference/architecture.md),
[Scene](../../../reference/components/scene-content.md),
[F](../../../reference/composition-execution.md), the
[ratified direction](../../../reference/decisions/northstar-ratification-2026-09-27.md) and
[World/Experience amendment](../../../reference/decisions/world-experience-reconciliation-2026-09-29.md)
govern the design.

| Inspected evidence | Finding and planning consequence |
| --- | --- |
| `packages/project-model/src/scene.ts`, `scene-codec/parse-entities.ts`, `project-codec.ts`, `wall-first-project.ts`; current Scene/project tests | Scene v1 is world-local; strict writers/readers reject Room ownership and unknown fields. Finite transforms and positive scalar scale exist. Optional legacy-looking TypeScript fields/comments do not establish supported storage. Use the public validation/serialization boundaries. |
| `apps/editor/src/routes/project/[projectId]/spatial/+page.svelte`; [retained authoring inventory](../../../../apps/editor/src/lib/authoring/README.md) | The route is a foundation-reset notice. There is no editor session, placement controller, selection store, history runner or gizmo host to reconnect. Pure survivors need fresh behavioral and call-site proof. |
| `authoring/scene/plan-scene-footprint.ts`, `plan-scene-hit.ts` under the editor source | Canonical asset footprint → entity scale → yaw → world X/Z is retained, with containment before a six-CSS-pixel edge halo. It omits lights/missing metadata, but also ignores pitch/roll and gives planes a rectangle independent of actual orientation. Add explicit truthful eligibility; do not advertise this helper as general projection. |
| `authoring/scene/cluster-obb.ts`, `obb-util.ts`, `scale-vector.ts` under the editor source | Placement-local mesh bounds math survives; it is derived renderer data. PCA group bounds are not a stable semantic pivot. Independent-scale averaging and silent fallback in the old scale helper are unsuitable for accepted operations. Neither nested rigs nor per-axis transient truth is required. |
| `apps/editor/src/lib/types/assets.ts`, `content/assets.ts`, `museum/assets/AssetModel.svelte`; normalization/Plan-proxy pipeline | Footprints are already canonical meters. The renderer separately applies `defaultScale`/`defaultRotation` inside the instance root. A new entity starts at relative scale 1; copying `defaultScale` into it scales twice. Ground-contact metadata is not a general typed asset field today: verify and declare it for the admitted subset. |
| `packages/layout-core/src/layout-geometry-types.ts`, `layout-geometry-queries.ts` | Compiled `room-floor` polygons and `CompiledRoom.floorElevation` are usable support evidence. `findPolygonContaining` returns a first reverse-order match; it cannot resolve elevation ambiguity. Enumerate semantic candidates using the canonical compiler output; do not raycast a render mesh for authoritative Y. |
| Generic entity/material/asset renderers; [asset contract](../../../reference/components/assets.md) | Runtime-safe realization and resource lifetime machinery survive. Creator model/HDR ingestion, approval UI and project GLB upload do not. Current registry upload is image-focused. No second loader or engine upgrade is implied. |
| `apps/editor/src/lib/platform/project-persistence.ts`, `apps/api/src/project-persistence.ts` | Current readers/writers survive, but cloud saves lack an expected-revision precondition. Local history and safe cloud Save are separate deliverables. Use shared JSON recovery and consume separate early conditional-Save evidence; current Save is not already safe. |

Prototype evidence has different roles:

- [Objects & Assemblies handoff](../../../../prototypes/object-composition-prototype/HANDOFF.md)
  informs capability disclosure, explicit edit scope, refused proposals, exact input and stale
  rejection. Its import/library/attachment/compiler mechanisms are simulated or fixture-specific;
  its orbit controller, schemas and history are not selected production mechanisms.
- [World prototype implementer reference](../../../../prototypes/spatial-authoring/IMPLEMENTER-REFERENCE.md)
  informs Stage continuity, legible handles and return/cancel behavior. Its Camera/projection and
  fixture Scene behavior do not supply a production viewport or placement authority.
- [Accepted World design record](../../../../prototypes/world-experience-shell-round/README.md),
  [Conservatory](../../../../prototypes/experience-ux-alternative/README.md) and
  [Paper proposal](../../../../prototypes/paper-authoring-commission/PAPER-SHELL-PROPOSAL.md)
  inform the ratified [shared shell](../../../reference/design-system/editor-shell-and-visual-system.md)
  and [spatial instrument grammar](../../../reference/design-system/spatial-instrument-grammar.md).
  Earlier permanent inspector/chrome treatment is superseded. Detailed 3D object tools remain a
  declared non-blocking coverage gap to resolve in S03/S04's real surface review.

No historical editor source is restored by this plan, and prototype QA is not production evidence.

## Ownership and invariants

| Concern | Single authority |
| --- | --- |
| Object records, placement candidates, root transforms, operation validity | Scene / `SceneDocument`; shared pure Scene planning in project-model with injected normalized asset policy |
| Architecture and floor evidence | Layout's canonical compiler/query records; the read-only floor-support query in `@portfolio/layout-core`, built by T2.P01.S01 under T1 review (decided 2026-10-16), supplies floor candidates |
| Projection, rays, framing and navigation | Camera through the public T1 viewport seam; T2 never drives an independent Camera or projection transform |
| Selection, task focus, gesture lease and display lifecycle | One T1 editor host. T2 supplies Scene identity/eligibility adapters, not another selection store |
| Accepted project revision and chronological history | The shared F.4 coordinator provided by T1.P01.S03; T2.P01.S02 supplies the Scene planner set and its conformance against that coordinator and owns no history; live host registration is the host↔F4 wiring's and S03's |
| View-specific graphics and helpers | T2 editor adapter; derived and disposable, with no path into authored JSON or visitor authoring imports |

**Frames.** The owner clarified the request during planning: keep world-local Scene storage and
preserve explicit local-frame math, without restoring Room-owned records. Project +Y is up,
X/Z horizontal, meters and radians internally. A supplied local frame transforms points and
directions once at the boundary; directions exclude translation. The inverse must round-trip
nonzero origin/yaw/elevation. Current wall-first Rooms carry no authored frame: neither
containment, polygon centroids nor legacy Room helpers may invent one. Internal asset
normalization and Scene root transforms remain distinct. Missing/stale frame context refuses.

**Shared representation.** One entity ID/pose produces both the 3D instance and its derived
Plan footprint. No Plan proxy record, second transform, support attachment, Room owner, render
handle or history data is persisted. Canonical selection survives a reading change, including
selected entities Plan cannot depict. Unsupported entities remain discoverable through the
Index/Card with a reason; no invented footprint or invisible manipulation target.

**Support.** New placement and explicit Place on floor resolve contact elevation before the
preview is displayed. Support is read-only, revision-qualified evidence, not a host relationship.
Horizontal Move preserves existing Y, pitch/roll and scale; it refuses a destination that cannot
support that resting elevation. A different floor requires explicit Place on floor, which owns
the resulting Y. Yaw preserves all other components. Resize on floor explicitly owns uniform
scale and the Y adjustment needed to keep the same contact elevation. No continuous grounding
after Layout edits, mesh-based Y correction after commit or automatic floor reassignment.

**Camera-bearing Scene fields.** Current Scene v1 co-locates Camera data (navigation nodes and
connections). T2 planners produce entity-level (and, for delete, cluster-membership) changes only
and never rebuild those fields, so byte-exact Camera preservation is structural, and the T3 Scene 2
cutover changes only the adapter.

**Determinism.** Allocate IDs/capture metadata before preparation; evaluate against one expected
project revision. Pointer, keyboard and exact fields submit the same typed operations. One
accepted gesture/action produces one Scene history result; invalid, stale, cancelled and exact
structural no-op results produce none. Redo restores captured IDs/results; it does not query the
live catalogue, recalculate a new support choice or allocate fresh IDs.

## Slice register

Each slice's scope, exit evidence and verification tier live in its plan; this register owns
lifecycle and prerequisites only.

| Slice | Status | Consumes | Requires | Effects | Plan | Acceptance | Authorization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T2.P01.S01 | shipped | F1.reference@1 | F1.reference@1:references-v1 | — | [Deterministic candidates and canonical floor support](./t2.p01.s01-candidates-and-floor-support/implementation-plan.md) | [record](./t2.p01.s01-candidates-and-floor-support/acceptance.md) | owner-authorized 2026-10-16 ([record](../../../reference/decisions/parallel-slice-authorization-2026-10-16.md)); accepted 2026-10-16 with independent implementation review and focused T1/Layout sign-off |
| T2.P01.S02 | shipped | F1.reference@1, F4.intent-acceptance@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1 | — | [Scene operations and shared history](./t2.p01.s02-scene-operations-and-history/implementation-plan.md) | [record](./t2.p01.s02-scene-operations-and-history/acceptance.md) | owner-authorized 2026-10-16 ([record](../../../reference/decisions/s02-pair-authorization-2026-10-16.md)); owner acceptance via deliberate closeout invocation on 2026-10-17; independent review resolved separately (see record) |
| T2.P01.S03 | proposed | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [First coherent editing surface](./t2.p01.s03-first-editing-surface/implementation-plan.md) | [record](./t2.p01.s03-first-editing-surface/acceptance.md) | — |
| T2.P01.S04 | proposed | F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1 | F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, F4.intent-acceptance@1:conditional-save-current-v1, T1.viewport-projection@1:viewport-projection-v1 | — | [Bounded composition loop and final gate](./t2.p01.s04-bounded-composition-loop/implementation-plan.md) | [record](./t2.p01.s04-bounded-composition-loop/acceptance.md) | — |

`F1.reference@1:references-v1` was accepted at `ee463d0b` and S01 shipped in PR #130. S02's
`local-single-domain-v1` (with `acceptance-invariants-v1`) was accepted at `8ec0c5f1`, an ancestor
of post-PR #129 `main`, so S02 is eligible. S03 also waits for
`T1.P01.S02`'s `viewport-projection-v1` **and** for the host↔F4 wiring, which is `T1.P01.S04`'s
first increment by default — if the owner authorizes S03 first, the owner assigns that wiring
explicitly. S04 additionally needs `T3.P01.S02`'s `conditional-save-current-v1` **and** T1's Head Save
integration (decision 1 of the [S02 pair record](../../../reference/decisions/s02-pair-authorization-2026-10-16.md)). Every prerequisite
is judged at the slice's own trusted base.

The requirements above describe the pre-cutover source adapter. `T3.P01.S04` migrates existing
callers and unfinished plans to accepted F2 `unit-envelope-v1`, F1 `unit-resolution-v1` and F4
`unit-acceptance-v1` from T3.P01.S01/S03, with `conditional-save-units-v1` for Save users. Replace
current-source requirements then; do not consume a retired adapter. Plain Scene caller migration
does not require T3 Camera-authoring UI. No consumer satisfies itself with its own readiness edits.

```text
FINAL PHASE GATE: T2.P01.S04 → ./t2.p01.s04-bounded-composition-loop/acceptance.md

PHASE CLOSE
Stage:        active
```

S01 and S02 have acceptance evidence. S02's owner acceptance was recorded 2026-10-17 from the
deliberate `slice-closeout` invocation. That event did not waive independent review; the earlier
review gap was separately resolved after review of the reconciled implementation and a component-scope
repair. See the [acceptance record](./t2.p01.s02-scene-operations-and-history/acceptance.md) for the
distinct owner-acceptance and reviewer-authored evidence. The final gate (`T2.P01.S04`) is declared,
not closeable; acceptance would make the phase closable, and phase/track closure remains a separate
owner event.

## Minimum dependencies

| Dependency | Exact scope and owner |
| --- | --- |
| F1 | `T1.P01.S01` supplied `references-v1` (accepted): separate accepted revision/content/epoch and explicit frame/source qualification. Required from S01; no locks are invented. |
| F4 local | `T1.P01.S03` (authorized 2026-10-16) supplies `acceptance-invariants-v1` and `local-single-domain-v1`. S02 registers actual planners and conformance, not another F4 provider or history. |
| Conditional Save | `T3.P01.S02` extends F4 with `conditional-save-current-v1` and owns the client Save state, independent of F2/viewport activation; T1 owns its Head integration. Both are needed for S04's safe Save journey; S03 arranging waits for neither. |
| Viewport | `T1.P01.S02` (authorized 2026-10-16) supplies the source-independent facade, rendered matrices/planes, one selection/task/gesture host and the Camera output protocol. Required from S03. It also owns the compile-generation identity the support query is called with. |
| F3 | No direct prerequisite for this phase's simple typed Scene operation payloads. The viewport owns its F3 dependency; a future real channel consumer declares its exact capability. |
| F2/T3 transition | No new source units in this current-source phase. `T3.P01.S04` integrates current callers into already accepted unit-aware adapters; canonical Scene operation semantics stay unchanged. |
| F5/T4 | Not consumed. Later ingest requires closed release resource delivery; source JSON recovery proves no release closure. |

No complete T1, new drawing, levels, representation expansion or full T3 authoring prerequisite. A
compatible adapter/kind admission records additional capability evidence; incompatible shared
semantics requires a new gate major and consumer redeclaration. Source-first conversion and visitor
activation stay T3/T4-owned.

## Phase acceptance evidence (final gate)

These are required future proofs, judged together at `T2.P01.S04`. None is asserted as run by planning.

| Contract/failure | Evidence and practical pass condition |
| --- | --- |
| Canonical boot → place → commit (Scene successor to TD-1) | Production entry from a valid wall-first project with a reconciled floor (including explicit starter gallery) creates exactly one Scene entity, one history result, finite world pose and no `roomId`. Empty/no-floor boot refuses with useful copy and no edit. T3 owns the original Camera-node equivalent; this phase cannot close that obligation. |
| Support parity | Plan and 3D input for the same X/Z/support yields the same candidate; nonzero floor elevation, local-frame conversion, shared boundary, coincident candidates, overlapping elevations and no support. Reorder query arrays: result does not change. Mesh hit height corruption must not change committed Y. |
| Truthful geometry | Native centered primitive contact, canonical model footprint and non-unit normalization. Tilted model and ordinary vertical PlaneGeometry get an eligibility reason, not a fake horizontal rectangle. Missing metadata/bytes do not become successful fallback placement. |
| Owned transforms | Move/yaw preserve non-owned fields exactly; explicit re-seat/resize owns Y; different support elevations require choice. No Layout, Camera or resource mutation. Scale is positive/uniform and applied once. Pivot is placement identity, never PCA or a changing render bound. |
| Preview/commit/lifetime | Pose tolerance 1e-6 meters/radians (scale is the exact prepared scalar). Reading flip, lost capture, replacement, blur/unmount and delayed callbacks cancel exactly once; invalid candidate cannot commit the last valid pose on its behalf. No ghost/helper in JSON. |
| Selection and actions | Same selected source ID across views; ineligible selection stays selected; hit halo measured in CSS pixels; deterministic tie order; no silent subset transform. Cluster duplicate/set operation refuses; member deletion cleans references atomically. |
| History and concurrency | Captured IDs replay; stale local writer refuses; accepted project installed once; invalid/no-op produces zero entries; exact Undo/Redo, redo truncation, mixed-domain chronological order through one stack. Field and pointer paths reach the same writer. |
| Source persistence | Strict source-adapter validation and canonical serialize→parse→reload preserve entities, scale/material references and unrelated domains; conditional Save validates under atomic expected-base comparison and create-only collision handling. Invalid file/resource resolution leaves the current project intact. No new historical decoder; frozen external project stays outside scope. |
| Wiring and isolation | Mutation controls reintroduce mesh-Y authority, a direct Scene write, a persisted Plan proxy or skipped cancellation and make the relevant successor fail. Full arch lane proves project-model, Layout shell, Camera and visitor boundaries; helpers/imports do not enter visitor chunks. |
| Creator experience | Place → select → arrange → resize → duplicate → undo → reload works through real routes in both readings; reasoned support choice/refusal, one precision writer, selected identity visible, no unsolicited framing; keyboard/narrow/reduced-motion evidence. |

Use the [test contract](../../../../apps/editor/tests/README.md#what-a-change-requires): behavioral
tests for planners/results, narrow call-site proof for wiring, source checks only for genuine
ownership/import boundaries. Restore dedicated Scene helper coverage where this phase depends
on it. Keep relevant dense cases in heavy; no new timing benchmark or copied broad test matrix.
Each implementation PR merge keeps the complete repository gate including heavy and affected
package/app checks, regardless of the narrower iteration tier. API changes, if later admitted,
also require real-Postgres checks with zero skips; they are not planned here.

## Deliberately deferred scope and continuation

| Deferred capability | Reason and concrete continuation gate |
| --- | --- |
| Single-model ingest | Next bounded T2 phase: one flat GLB plus maps, retained source/provenance, explicit scale/pivot/footprint capabilities, stage/approve then place/reload/preview/publish. Needs accepted F.1/F.2 resource/lock interfaces, F.4 staged acceptance and T4 delivery integration; must precede the first audience trial. No provider search, full assembly correspondence or marketplace prerequisite. |
| Broader materials and lights | Preserve current rendering/values; later phases own selected-subset/shared edit reach, tint/reset, supported metric mapping, truthful light units and explicit undoable repair. Their UI is unnecessary for a trustworthy object-arranging boundary. |
| Wall/ceiling/object support and persistent attachments | Need host frames, stable reference qualification, move/delete/revision consequences and atomic history. Temporary floor support is no attachment schema. |
| Full 3D transforms and arbitrary projections | Free elevation, pitch/roll, object-local axis tools, planes with orientation-aware projection and edits in Section/Unroll require declared representation/inverse eligibility. Ordinary upright floor placement proves less and ships earlier. |
| Multi-selection, group/cluster editing and batch duplication | Require ordered set policy, stable pivots and atomic all-candidate validation. Carry the T2 evidence's full/partial cluster duplication and no silent subset rules into that phase. This phase refuses unsupported set operations. |
| Definitions/components/variants/performances | Need stable component/resource identity and channel baseline/invocation semantics. An opaque mesh and flat cluster do not establish those capabilities. |
| Camera/Experience and publication | T3 owns authored Views/order/capture, unit/compound acceptance and the early conditional Save extension; T4 owns prepared readers/releases. Existing Camera fields pass through unchanged. No hidden Camera node is created by object placement. |

## Architecture cycle and parallel integration

No new architecture-cycle window is proposed. T1's window names its own bounded exposures; T2 does
not copy or enlarge that window, re-arm dormant Layout mechanisms or claim a verdict, and T2 slices
cannot open it. Each start still runs the runbook's one-line listed-slice check against the
then-live cycle register. S01 ran in parallel with three other slices under the
[batch protocol](../../cross-track-execution.md#parallel-batch-2026-10-16); S02 runs in parallel with
`T3.P01.S02` (and the still-open `T1.P01.S02`) under the
[pair protocol](../../cross-track-execution.md#parallel-pair-2026-10-16). Each names the shared files
its slices may write and how merges reconcile.
