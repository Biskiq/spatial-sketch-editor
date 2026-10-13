# PR #115 — Architecture Disposition, Documentation Pruning & Parallel-Track Cutover

**Status:** proposed executor plan, ready for independent review. No restructuring or production implementation is authorized by this document.

**Inspected baseline:** `main` at `e90a58224443bdbf44114d7285d55c983b79cc84`, 2026-10-13, after #114 closeout. Written on `codex/pr115-architecture-plan` in the owner's primary checkout. Inventory counts below use tracked files, excluding ignored local artifacts. Recheck the baseline diff before execution; inspect intervening changes only, rather than repeating this audit.

**Deliverable:** a pruned documentation tree, reviewed architectural disposition, four independently plannable capability tracks, and executable prerequisite checks. #115 installs the planning/execution system; it does **not** write the detailed T1–T4 capability plans or change production code.

**Approval boundary:** independent review and owner authorization precede execution. Approval of this restructuring is not authorization to implement the capabilities, ratification of an exact F interface, declaration of either Baseline, or closure of a major phase.

## 1. Governing conclusions and execution boundaries

The live authorities are [North Star](../../reference/north-star.md), [architecture](../../reference/architecture.md), [F](../../reference/composition-execution.md), the [September 27 ratification](../../reference/decisions/northstar-ratification-2026-09-27.md), its [World | Experience amendment](../../reference/decisions/world-experience-reconciliation-2026-09-29.md), and the [accepted shell/visual contract](../../reference/design-system/editor-shell-and-visual-system.md). Domain component contracts describe landed behavior until the relevant explicit cutover. Prototype code supplies interaction evidence, never production formats, history or evaluators.

The architectural recommendation is **selective replacement around retained domain kernels**:

1. Retain Layout's canonical compiler, topology, identity and pure operation planners; retain Camera's route/motion kernel and renderer/resource infrastructure where their current behavior is sound.
2. Replace shell composition, styling, toolbars, old workspace presentation and stage-helper visuals with Conservatory/Paper expressions. Do not renovate the old Scene × Camera workspace matrix into the permanent architecture.
3. Refactor document coordination, session composition, semantic selection adapters and Scene authoring so new capabilities use F without a second writable owner. Implement the Camera-unit split, Experience order ownership and first compound acceptance together in T3; migrate T1 Camera authoring adapters afterward.
4. Replace the authored-snapshot release reader with a prepared-payload reader in T4. Preserve real delivery obligations and existing release isolation while cutting over.
5. Remove obsolete documentation now. Remove displaced production code in its explicitly named future capability cutover, never in #115.

A full application/domain rewrite is unjustified: canonical topology, curve/Junction geometry, shared Camera evaluation, visitor isolation and resource handling already exist with substantial regression protection. Incrementally polishing the old shell is also unjustified: it embeds a superseded information model and multiple workspace-specific interaction adapters. Domain reuse and presentation replacement are independent decisions.

**Pre-Source-Baseline policy:** strict current-format readers and one final writer per meaning; prune obsolete adapters at each cutover. No tolerant historical decoder, permanent bridge, extra writable model or second Camera/geometry authority is added simply because development data once existed. A compatibility exception must name its product obligation, covered data, owner, conversion validation, recovery and retirement condition. Frozen Chopin content, benchmark dependencies, protected creator trial projects, intentionally supported imports and promised durable releases are different obligations; inspect and record them separately. A migration module's existence proves none of them.

## 2. Verified current state and architectural disposition

### 2.1 Inventory and confidence

The baseline contains **581 tracked files under docs/**: 227 roadmap, 47 reference, 37 operations, 265 archive and five root files. There are 354 tracked prototype files. Production groups inspected include 248 editor-owned files, 39 editor-deployment museum files, 11 generic visitor files, 59 museum-app source files, 15 API source files, and 44/20/5 source files in Layout/Project/Camera shared packages. Counts are scope evidence, not a retention target.

Verified implementation facts:

- ProjectDocument is `{ id, name, layout, scene }`; there is no implemented independent Experience unit or F envelope. Wall-first Layout format is 5; world-local Scene format is 1. The legacy Scene shape remains supported for named consumers.
- Scene stores Camera nodes, connectivity, paths and view tracks. NavigationNodeData and CameraGraphNode also carry `nextNodeId`, `previousNodeId`, `holdSeconds`, `detourOfNodeId` and `lockInteraction`. Editorial order is consequently still entangled with Camera.
- The legacy and wall-first Layout entry points both lower into compileLayoutGeometrySource. These are format adapters to one compiler, not evidence of two architectural authorities. App-local Layout modules re-export the shared package.
- Runtime Scene resolution inserts node-position endpoints around authored interior path anchors. Those generated endpoints are not a second authored anchor list.
- EditorHistoryController has one chronological, capped stack with Layout or Scene snapshots. It has validation/rollback/no-op behavior but no atomic multi-unit acceptance or expected-project-revision precondition. Layout mutation runners preserve operation-specific planning and the editor transaction boundary.
- Project Save appends versions under a row lock without an expected-base revision. Publication mutation has its own expected publication revision and ABA protection; that is not F.4 project acceptance.
- readPublicRelease joins the saved project version and release manifest and validates with deployed authoring code; cold preparation calls prepareCompatibleRuntime. The prepared F.5 reader is not shipped.
- Generic visitor preview/public rendering uses isolated visitor state and resource scopes. Guided controllers consume shared Camera motion. Observer/free navigation uses existing OrbitControls; the future viewport/profile contract must bring these realizations under Camera intent rather than assume the entire destination is already satisfied.
- Canonical floor-supported placement is still broken as documented by TD-1: wall-first Layout gets an empty Room-frame registry; Camera Plan checks that registry, and node creation writes room-local coordinates. This is source-confirmed, not a fresh browser reproduction.
- Static model cold validation uses retained shipped-static identity, while AssetModel rendering still reads getAsset(assetId).productionFile from the mutable catalogue. That unresolved resource-source seam remains a T2/T4 obligation.

This audit used source, tests and routed accepted records; it did not rerun historical acceptance or infer production behavior from prototypes. Live production data coverage, external source-file promises and runtime/performance results on a changed implementation remain unknown until their own bounded delivery/capability checks. They do not block #115's documentation cutover.

### 2.2 Disposition register

The paths in this section are baseline evidence, not promises about future module locations.

EVIDENCE-PATHS: start — implementation paths inspected at e90a58224443bdbf44114d7285d55c983b79cc84; future cutovers may remove them

| Subsystem / baseline evidence | Disposition and rationale | Owning future cutover / retirement proof |
| --- | --- | --- |
| `packages/layout-core/src/layout-geometry.ts`, Junction resolution, wall-mesh inputs; geometry boundary/parity/golden/watertight tests | **RETAIN** canonical compiler and renderer-neutral derived output. Refactor adapters only when new Layout semantics need them. There is expensive topology and attributed Junction behavior to preserve. | T1's relevant semantic/representation slices; no consumer reconstruction, no curve resampling outside canonical compilation, editor/visitor parity, dense correctness unchanged. |
| Layout wall topology/noding/face extraction, Room reconciliation, identity, curve algebra, snap/align/duplicate planners | **RETAIN** sound pure operations. **REFACTOR** authored schema/operations for derived Wall roles, circular enclosure, levels/structures and later vertical semantics. Current `boundary/partition` role is not the destination. | T1 semantic cutovers explicitly retire creator-chosen role APIs and displaced schema writers. Preserve lineage, canonical controls, Junction identity, hosted Opening semantics and deterministic allocation. Closed rings/non-enclosing intent and existing partitions need focused decisions before that cutover. |
| Layout format compatibility/migration modules; project-compat/compat-runtime; app-local facades | **RETIRE** unsupported compatibility paths once actual consumers are discharged; **RETAIN temporarily** named Chopin/fixture/import obligations. Thin facades are not a domain algorithm; do not retain them automatically or mass-delete them before consumer analysis. | Track owning the changed encoding, coordinated with T4/frozen relic. Record every remaining call site and obligation; remove adapter and tests protecting unsupported behavior together with valid successors for invariants. |
| `packages/project-model/src/scene.ts`, scene-codec, scene-validation, world conversion | **REFACTOR**, retaining strict entity/material/light validation and world-local transforms. Flat Scene and Camera co-location cannot become the expanded composition architecture. | T2 Scene capabilities; T3 Camera extraction. Separate codec ownership and exact F references without a WorldDocument or compatibility-shaped canonical type union. |
| `packages/camera-core/src/camera-route.ts`, camera-motion.ts, navigation.ts | **RETAIN** shared routing, framing and motion evaluation as current kernel. **REFACTOR** input ownership/profile realization as new intent interfaces land; mechanism remains replaceable. | T3 removes editorial interpretation from Camera in its atomic ownership cutover; T1 later rehosts authoring. Dense motion/route cases, generated-vs-authored anchors, connectivity and single pose/FOV authority remain protected. No prototype evaluator port. |
| Camera order helpers, editor-camera-timeline, NavigationGraph mutator order/hold APIs, visitorMainFlowNodeIds and node-order runtime orchestration | **REPLACE** with Experience-owned occurrences/order and shared execution adapters; **RETIRE** legacy editorial writers/transport once the T3 cutover is accepted. Geometry/connectivity/path operations remain Camera-owned. | T3 Camera/Experience ownership cutover: separate Camera unit + Experience order + F.4 together. Repeated Presentation/Stop/visit identities, Gate/continuation conversion and removal of every non-relic writable node-order path. Frozen relic exception is isolated read-only product history. |
| `editor-store.svelte.ts`, document store, controller hosts, history-controller, layout-preview-state, project-session wiring | **REFACTOR** composition/acceptance boundary. Reuse teardown, rollback, validation and interaction guards. Do not extend a Scene-centric facade into the new cross-domain authority. | T3 first compound acceptance replaces per-domain acceptance where the new contract applies; T1/T2 consume it. Failure leaves accepted project intact; stale writers reject; one compound undo; source/runtime lifetimes separate. Remove replaced facade methods after callers migrate. |
| Semantic selection reducer, hierarchy source/projection/search, stable display identity, mutation guards | **REFACTOR** adapters and F.1 qualifications; retain valid view-independent selection/identity behavior. UI tree/panel rendering is **REPLACE**. | T1 seam plus consuming T2/T3 UI slices; one selection facade, explicit missing/replaced identity, correct session replacement and no second writable owner. Preserve call-site proofs, not just helper tests. |
| LayoutPlanViewport/PlanSvg/CameraPlanViewport, PlanWorkspace/CameraPlanWorkspace/Workspace3DView; plan projection/hit/snap helpers | **REPLACE** workspace-host/input composition around one continuous viewport. **RETAIN/REFACTOR** tested coordinate math, hit resolution and semantic planners where compatible. The replacement is not a rewrite of Wall drafting semantics. | T1 viewport/projection seam is the earliest bounded integration contract. Ordinary Plan/3D continuity and input cancellation first; later Section/peel/ceiling depth is not its prerequisite. Remove old hosts/adapters only after all affected consumers migrate. |
| ProjectRow/DomainSpine/WorkspaceRibbon/ToolTray/StatusBar, sidebars, inspectors, fields, timeline surfaces; styles/tokens.css, controls.css, editor-shell.css etc. | **REPLACE by default** against Conservatory/Paper. Keep individual low-level field validation/a11y logic only with evidence; old CSS numbers/components are not destination authority. | T1 provides shared shell/Stage host integration; T2/T3 own domain authoring bodies. Replace production entry expression once; no permanent second shell or feature-flag parallel product. Remove displaced styles/components at the accepting slice. |
| Editor spatial helpers, camera glyph/frustum/path overlays, placement-ghost/selection visual treatments, gizmo visuals | **REPLACE by default** under spatial-instrument grammar. Retain valid world-coordinate/hit/transform adapters separately from visual treatment. Existing visuals do not prescribe future tools. | T1 shell/instrument framework; domain-specific T2/T3 instruments. Explicit authored/generated species, occlusion/hit legibility, precision, supported operations and non-hue focus. No universal gizmo assumption. |
| Scene placement-cluster mutator, Scene gizmo adapters, Plan footprint transforms, floor placement, material/light mutators | **REFACTOR**, retaining domain operations that validate and commit correctly. Room-local creation gates and proxy-only independent scale are replacement/retirement candidates, not valid destination constraints. | T2 placement/transform/resource slices over T1 seam; Camera placement adapter migration also requires T3 order cutover. TD-1/TD-2 and scalar-vs-independent fidelity remain explicit. No Layout mutation hidden inside Scene placement. |
| `museum/assets`, material remap, texture-cache, wall-geometry-adapter, prepared-wall-meshes; Floor/Wall/Ceiling surfaces | **RETAIN** rendering/resource lifetime mechanisms; **REFACTOR** payload/source injection and Scene world presentation. Preserve attributed geometry, cloned material ownership, release-scoped caches and disposal. | T1/T2/T4 consumers. Factory/display adaptation cannot solve topology or own domain state. Fix static-model source resolution through the actual renderer call site. No blanket renderer rewrite or package extraction merely to deduplicate app copies. |
| Generic VisitorPreviewSurface/VisitorEntities/VisitorLayoutShell, preview-coordinator, public-route boundary plugins | **REFACTOR** execution/preparation around the shared runtime path; **RETAIN** isolated renderer/resource surface and import-closure enforcement. Visitor chrome is a replacement candidate. | T3 execution + T4 prepared reader; editor Preview and release Preview use common semantic lowering with private runs. Runtime evaluator imports allowed; authoring validators/history/session/gizmos excluded from prepared reader and visitor chunks. |
| `apps/museum`, frozen Chopin content, `/museum/editor` relic entry and isolated renderer/navigation adapters | **RETAIN** frozen product lane until an explicit retirement decision. It is not a second editable authority for a new project. Do not merge the relic's store/data into the new editor. | No retirement in #115. Future shared-kernel changes must preserve its named fixtures/routes or receive an explicit separate retirement authorization. |
| `apps/api/src/auth.ts`, ownership, asset-persistence/object-store, project-persistence, publication-persistence; editor Save/Load/import/export | **RETAIN** platform/auth/resource plumbing; **REFACTOR** expected project revision, resource staging and multi-Experience publication integration. Publication OCC already works but solves another concern. | T3 acceptance/API integration + T4 delivery. No backend/platform rewrite, deployment or schema migration in #115. Existing import/export is not the future prepared release envelope. |
| P22 authored-snapshot delivery validation/cold preparation | **REPLACE**, retaining closed asset membership and public authorization semantics. A changing authoring decoder cannot promise durable prepared releases. | T4 prepared-reader cutover. First lower existing data when required contracts are available; integrate new domain payloads incrementally. Remove snapshot-reader compatibility after covered data is handled. No source-capsule bridge. |
| Bench harness, fixture ledger, reuse ratchet, resource-retention tests, route/build closure tooling, Svelte 5/Threlte setup | **RETAIN**, updating test locators only when code actually moves. Performance evidence constrains risk; it is not a shell design or permanent implementation substrate. | Relevant future slice; do not reset baselines or weaken density/relative budgets to accommodate new architecture. Preserve TD-4/TD-5, D5 probes and M1 conditioning limitation. |
| `packages/scroll-travel`, superseded presentation-only helpers and unused dependencies | **RETIRE candidate**, explicitly not a #115 deletion. scroll-travel is unused by policy, but a package/dependency removal still needs an actual import/build scan. | First relevant cleanup/cutover slice names all consumers and removes manifest/export paths after proof. Other small audio/HUD/cursor packages remain scoped utilities unless their users are deliberately retired. |

EVIDENCE-PATHS: end

Every later implementation plan must assign each displaced path to **its own removal slice**, and state the successor defect proof, remaining consumer/compatibility obligation and retirement acceptance. “Later cleanup” is not a removal assignment. #115 records the candidate groups and owning capabilities without inventing detailed slice IDs.

### 2.3 Documentation contradictions to fix in #115

These are bounded documentation repairs, not permission to alter production behavior:

- The editor source README calls authoring “Dev-only” and points to an obsolete P0 plan; routes/build plugins show production editor entries. Replace that header and obsolete route.
- Placement's “tagged floor = Yes” table conceals TD-1's canonical refusal. Label supported legacy behavior and current canonical defect separately, and link the debt. Do not assert floor placement is fixed.
- Persistence's claim that chopin-project.json is the sole production project source is relic-specific; current guest/cloud editor projects are independent. Scope the statement and distinguish new canonical boot from the retained legacy createEmptyProject helper.
- Older design-shell tables and Camera-flow specifications are still routed as live secondary specifications. Consolidate remaining landed nonvisual facts into component contracts, then remove those specs; PLATE owns new shell design.
- Architecture-cycle state still narrates P23B in progress and selects P26; the global baton says P23B is closed and #115 is next. Preserve the cycle's actual PHASE_1 state/mechanisms while repairing product narrative and window routing as specified below.
- slice-closeout claims no docs checker exists; an unconditional arch-lane documentation checker does exist. Correct the workflow. Never resolve documentation deletion by disabling the checker.

## 3. Exact target structure and ownership

Paths below are **proposed targets**, not links to files that already exist. Keep the established concern directories; introduce no new top-level planning, governance or review hierarchy.

```text
TARGET STRUCTURE <created by the executor>
AGENTS.md                              bootstrap, hard invariants, event routes
README.md                              human entry
docs/README.md                         progressive-disclosure router + plan hygiene
docs/reference/
  architecture.md                      domain/implementation boundaries
  north-star.md                        product and baseline policy
  composition-execution.md             F.1–F.5 + ratified exact-interface amendments
  decisions/                           ratified decision provenance (existing two records)
  components/                          landed domain/system contracts (existing eight)
  design-system/
    editor-shell-and-visual-system.md   one destination shell/visual authority
    spatial-instrument-grammar.md      Stage instrument representation grammar
docs/roadmap/
  README.md                            track status, product gates and future-work routing
  execution-gates.json                 prerequisites/readiness; reads README lifecycle owners
  parallel-track-cutover/
    README.md                          R115 repository phase; sole child/final gate R115.S01
    implementation-plan.md             this #115 plan; later compact closure/evidence home
    acceptance.md                      #115 evidence, pruning manifest and closeout
  f-foundation-contracts/README.md      F registration/amendment route; no second F spec
  t1-spatial-world/README.md            T1 objectives; child-phase status and routes
  t1-spatial-world/planning-evidence.md consolidated accepted obligations/open mechanisms
  t2-composition/README.md              T2 objectives; child-phase status and routes
  t2-composition/planning-evidence.md   retained placement/ingest obligations
  t3-experience/README.md               T3 objectives; child-phase status and routes
  t3-experience/planning-evidence.md    retained occurrence/accessibility obligations
  t4-release/README.md                  T4 objectives; child-phase status and routes
  <track>/<phase-id>-<capability>/
    README.md                          phase scope, child-slice status/direct artifact routes
    implementation-plan.md             phase-wide plan/integration/acceptance/final gate
    <slice-id>-<purpose>/implementation-plan.md
    <slice-id>-<purpose>/acceptance.md   actual slice review/acceptance/closeout evidence
    # No mandatory slice README; phase folder/slices created by later authorized planning
docs/operations/
  README.md                            event-only track/program completion/replanning runbook
  current.md                           one global work baton; active units may be a set
  t1-spatial-world/README.md            T1 operational runbook, no copied status/baton
  t2-composition/README.md              T2 operational runbook
  t3-experience/README.md               T3 operational runbook
  t4-release/README.md                  T4 operational runbook
  architecture-cycle.md                sole meta-state + concise cycle protocol
  tech-debt/README.md                   existing deferred-defect obligations
  checkpoints/README.md                transient interrupted work only
docs/archive/
  README.md                            navigation-only preservation/recovery convention
  technical/                           selected uniquely valuable evidence, opt-in
  roadmap/p25-experience/p25-unified-design/
    p23b-browser-report.json            protected historical QA comparator
    p23b-validation-result.json         protected historical QA comparator
prototypes/                            existing accepted/supporting family; preserved
  spatial-authoring/plans/             protected #112/#113/#114 plans moved here
  spatial-authoring/design/visual-system-refinement/  protected #104 design/QA bundle
  paper-authoring-commission/plans/     inactive PA plan retained as Paper evidence
  experience-ux-v3/design/              inactive design/comparison records
apps/editor/tests/helpers/execution-gates.ts
apps/editor/tests/helpers/execution-gates.cli.ts
apps/editor/tests/docs/parallel-track-gates.test.ts
apps/editor/tests/docs/architecture-cycle-lifecycle.test.ts
.agents/skills/slice-closeout/references/preservation.md  shared late-trigger preservation rules
```

The two P23B JSON inputs used directly by tests/recorders stay at their current paths; see §4. They are the only remaining files in that old roadmap tree. Keeping immutable test inputs there does not preserve a P23B execution route. A later dedicated maintenance change may relocate them; #115 does not need that risk.

### 3.1 One owner per concern

| Concern | Sole writable owner | What other documents may say |
| --- | --- | --- |
| Product destination / design requirements | Concern-specific reference contracts and ratified decisions | Link; prototypes/evidence state acceptance boundary and supersession. |
| F semantics and exact interfaces | composition-execution.md, explicit ratified amendments | Registry records implementation/evidence identity, not another interface definition. |
| Track lifecycle/status, product integration gate registration, global future work | roadmap/README.md | Track README owns objectives and child phases, not a copy of its own status. A completed track is a delivery arrangement, never a domain retirement. |
| Track objectives, child-phase status/dependencies/routing | Owning track roadmap README | Phase README routes its status owner; it does not mirror the track's phase-status enum. Phase closure writes its owning track row. |
| Phase scope, child-slice status/direct routing, declared final gate and local closure stage | Owning phase README | Slice plans/evidence route to this README. Slice closeout updates only its row; phase closable/closed is separate from child acceptance. |
| Exact prerequisite graph and interface/capability/product-gate readiness | execution-gates.json | Reads canonical README state; contains no duplicate phase/slice/track status or execution authorization. Acceptance records supply outcomes, not an alternate schedule. |
| Current work assignments / immediate frontier | operations/current.md | Each track operational README routes the baton; it does not independently name a current slice or NEXT. Multiple assigned units can share one baton. |
| Track operational procedure | Track operational README | Scoped verification, consumer/provider routing, evidence and recovery conventions; no competing plan or defect ledger. |
| Phase implementation scope/integrated acceptance | Phase-wide implementation plan | No duplication of child technical plans; phase README routes it and the final gate. |
| Slice approved scope and acceptance criteria | Exact slice implementation plan | Phase README routes it; review changes rewrite owning sections, not append a review diary. |
| Recorded acceptance outcomes | Slice acceptance record | Register points to the exact record and implementation identity; no copied test counts. |
| Deferred defects / cycle / interruption | tech-debt / architecture-cycle / checkpoints respectively | Track docs route the owning records. |

IDs are qualified: track `T1`; phase `T1.P01`; slice `T1.P01.S01`, with lowercase directory slugs such as t1.p01-<capability>/t1.p01.s01-<purpose>/. Numbers are stable local identity, not execution order. No new slice README is mandatory. Exact provider/consumer gates point to slices, not entire phases/tracks. F amendments retain F contract IDs; provider work is a bounded slice in an owning consumer track phase with F as its semantic contract owner, not a fifth capability waterfall.

The R115 repository-cutover phase is a single non-capability phase registered directly by the global roadmap, not T5. Its README routes this plan and sole child/final gate R115.S01; WP0–WP6 are that child's ordered executor packages, not new T-track plans. Child closeout makes R115 closable; only an explicit owner request closes the repository phase. Its accepted restructuring result can enable independent planning while that closure decision is pending.

### 3.2 Minimum contents of the eight track READMEs

Each **roadmap README** has bounded objectives and completion evidence expectations, concern ownership/exclusions, current/destination contracts, accepted evidence roles, a child-phase register with status/dependency/phase-README routes, relevant gate IDs and its operational runbook. Initial phase registers are empty: #115 creates no detailed capability phases/plans. Track objectives do not become permanent domain ownership. T1 owns spatial/shared shell/Stage delivery; T2 Scene/resources/ingest delivery; T3 Experience/order/execution delivery and Camera extraction coordination; T4 prepared delivery/publication. Enduring domain authorities remain Layout/Scene/Camera/Experience/resources regardless of how work is organized.

Each **operational README** states: global baton and canonical status-owner links, how to resolve the assigned phase/slice, execution eligibility, exact interface coordination, relevant test families, conditional review/closeout/event routes, scoped debt and interruption. Its Status section links global roadmap → track phase row → phase child row; it copies no current/NEXT/status. There is no phase operational README unless a real operational need later warrants one, and no duplicate per-track baton. The global operations README holds only distinct program/track completion/replanning event procedures; ordinary implementation does not load it.

### 3.3 Phase registration, slice routing and status grammar

A phase is a coherent capability area with its own approved phase implementation plan, explicit child slices, integrated acceptance criteria, declared FINAL PHASE GATE and owner-only closure. Several phases in the same or different tracks may run concurrently. An approved phase plan does not automatically authorize all children; each child identifies its concrete scope/authorization and gates before implementation. A phase dependency must expand to the exact slice/interface result needed; a whole-phase gate is justified only when that phase's integrated acceptance itself is the real consumer requirement.

Keep README status conventions and make them parsable without a second ledger. Define canonical Markdown tables, parsed by one helper:

```text
STATUS TABLE TEMPLATES <owned rows, not generated mirrors>
global roadmap — Track register: Track | Status | Roadmap
track README — Phase register: Phase | Status | Depends on | Workspace
phase README — Slice register: Slice | Status | Plan | Acceptance | Authorization
phase README — FINAL PHASE GATE: <slice-id> → <exact gate artifact>
phase README — PHASE CLOSE: STAGE closed; CLOSED owner/date/evidence; FINAL GATE; preservation
```

Use the existing proposed/planning/approved/in-progress/shipped/archived enum for global track and track-owned phase rows. Track completion adds an explicit TRACK COMPLETE owner/evidence block at its global row; a track's shipped status means its bounded objectives completed, not all possible future capabilities. Child state additionally distinguishes accepted (review/implementation acceptance recorded, closeout still owed) from shipped (routine closeout complete, merge-ready subject to recorded anchor/merge policy). Actual merge provenance remains acceptance evidence; a status row never fabricates a merge. Phase-local STAGE is `active | closable | closed`, not a duplicate of the track's mutable phase-status enum.

Scope, child order and direct routes live in the phase README/plan; execution depends on actual gate edges rather than table order. A final accepted/shipped slice sets local closable, retains the final-gate artifact for owner phase closure and stops. Phase closure updates only the owning track's phase row (or global R115 row) and its own PHASE CLOSE block. It never writes a track completion or product integration acceptance as a side effect.

### 3.4 Four distinct completion events

| Event | Entry/authority | Required consequence; what it does not imply |
| --- | --- | --- |
| Slice implementation acceptance → routine closeout | Recorded independent review/acceptance; slice-closeout | Owning phase child row, durable promotion/compaction, actual produced-gate readiness and assigned baton update. Final child makes its phase closable. No routine second review, owner phase close or track completion. |
| Phase closure | Explicit owner invocation; phase-closeout | Verify declared final gate, phase-wide integration and residuals; record owner closure and preservation; update owning track phase row. No automatic track/product/cycle closure. |
| Track completion | Explicit owner request or previously explicit completion authorization for named bounded objectives; event-only track completion route | Verify objective evidence, required phase closures, outstanding obligations/consumer ownership; global roadmap TRACK COMPLETE/status; retain domain code/contracts and historical evidence. Other tracks continue. |
| Product integration acceptance | Independently reviewed concrete integration plan + its recorded product acceptance (owner/manual rows where specified) | Accept that exact product gate/version and unblock only its consumers. It neither closes contributing phases/tracks nor declares a Baseline without separate ratification. |

Routine slice sequence is **implementation → review → acceptance → closeout → merge**, using recorded acceptance without re-running gates merely to close. A substantive scope/contract/evidence change introduced by closeout reopens only the affected review; routine routing/preservation/status work does not. Protected prototype evidence and proven anchor/tag/idempotence guarantees remain.

### 3.5 Convergence, bounded completion and replanning

The global roadmap owns product integration gate registration and current delivery arrangement. A concrete owner-authorized product goal selects actual capability outputs across phases/tracks and a coordinating owner. That owner writes one bounded integration plan in a workspace under docs/roadmap/integration/<gate-id>/ only when needed, or routes an existing phase's exact integrated gate if it already supplies the same product proof. Its acceptance lives beside that plan. #115 creates no speculative integration plan/phase or permanent program-management layer.

The first creator-to-visitor revision loop is an example: import or build → place → direct → publish → receive feedback → revise → re-share. Its eventual gate consumes exact T2 ingest/placement, T1 viewport/World, T3 Experience/Camera/acceptance and T4 prepared-release results plus the required feedback capability. It verifies real creator material, durable semantic reach, failed publication preserving the prior release, revision/re-share and visitor/editor isolation. It does not require every future representation/component/session feature, or assume all tracks must close. No feedback subsystem is invented in #115 to complete this example. Other product goals may define different program boundaries.

Track completion is checked against the **approved bounded objective set**, not an empty current backlog. Unfinished obligations must have accepted outcomes, explicit owner disposition or a named receiving phase/track before completion; moving a task label is not meeting its acceptance. Gate/provider/domain identities remain stable after a delivery track completes. Completing a workstream does not retire Camera/Layout/Scene/Experience or disable their regressions/readers.

Replanning is triggered by an explicit new product goal, an approved completion handoff needing new work, or a concrete new obligation whose owner no longer exists. The global roadmap owner presents a bounded continuation/reorganization proposal using accepted contracts, exact outputs and residuals. Owner authorization precedes changed objectives/new tracks or a transferred unresolved obligation. Existing tracks may continue with new phases; new tracks may be introduced; retired arrangements get recovery/evidence pointers. Ratified F/domain/design direction is reused, not diagnosed again. Independent completed objectives do not require simultaneous shutdown/restart of T1–T4.

Track-completion/product-integration/replanning procedures live in the **event-only sections of operations/README.md**, with a minimal link from each track runbook and global roadmap. No new skill is justified merely for a hierarchy level. A later genuinely recurring complex workflow may justify one; #115 adds none. These events carry direct owner authorization and exact gate updates, never automatic wholesale roadmap mutation.

## 4. Pruning, moves and preservation manifest

### 4.1 Applying the manifest safely

This is an **ordered, baseline-specific manifest**, not a recursive-delete suggestion. An exact-file or protected-family rule overrides a prefix default. “DELETE remainder” includes directory READMEs, redirect stubs, research prompts and redundant status/sequence text, and leaves no empty husk. It applies only to tracked baseline files. Do not delete new/untracked work or ignored local artifacts. Files introduced since the baseline require a small delta disposition.

Before mutation, expand these rules into a file-level manifest inside #115 acceptance.md: old path, action, new path if any, baseline blob hash, preservation/consolidation owner and rationale. Every baseline docs file must receive exactly one action; unmatched/overlapping rules fail. Record moved/protected prototype files too. For DELETE, the recoverable immutable baseline commit is sufficient; do not manufacture hundreds of replacement stubs. For a moved bundle, preserve its internal relative layout, byte-identical non-text assets and working render/serve dependencies.

The inspected baseline expansion totals **378 DELETE/CONSOLIDATE, 109 ARCHIVE/MOVE, 65 protected moves into prototype evidence and 29 RETAIN/UPDATE = 581**. New routers/evidence/tooling are outside those totals. These are reproducibility checks, not a deletion quota; a demonstrated preservation discrepancy changes the relevant row and count explicitly.

User-directed aggressive pruning in #115 explicitly supersedes the old “compact every closed prose file into a stub; never delete” default **for this batch**. Future accepted slices still use closeout with proportional recovery/preservation. Protected prototype plans and QA are exempt from deletion/compaction even if closed or inactive. Preserve existing recovery anchors when moving a closed plan stub, and verify the exact full-body recovery command still works; a copied stub alone is not the promised plan.

### 4.2 Live authorities and obsolete reference specifications

| Existing file or exact prefix | Action / executor operation | Reason / information that must survive |
| --- | --- | --- |
| docs/README.md; AGENTS.md; README.md | **RETAIN + rewrite routing** under §6; hard invariants remain. | One startup route; replace phase-only route language without expanding bootstrap. |
| docs/reference/architecture.md; north-star.md; composition-execution.md; both decisions/* files; all eight components/* files | **RETAIN**, bounded corrections/consolidation only. | Current truth versus destination remains explicit; no new formats marked shipped. Keep ratified provenance. |
| docs/reference/design-system/editor-shell-and-visual-system.md; spatial-instrument-grammar.md | **RETAIN**; repair evidence links only and fold genuinely missing current concern into its correct owner. | Accepted Conservatory/Paper and soft-frozen instrument grammar; do not reopen acceptance. |
| docs/reference/design-system/editor-shell-atlas/** | **ARCHIVE/MOVE whole bundle** to docs/archive/technical/editor-shell/atlas/. | Unique landed role/state specimens; obsolete shell composition is not a fallback design spec. Preserve functioning HTML assets; live reference links label it landed evidence. |
| docs/reference/design-system/editor-shell-ratifications.md | **CONSOLIDATE then ARCHIVE/MOVE** to docs/archive/technical/editor-shell/ratifications.md. | Verify R1–R4 role/state and one-writer outcomes are represented in PLATE or the landed shell contract. Preserve old drift/provenance evidence once, not a second live authority. |
| design-shell-specs.md; shell-scene-workspaces.md; shell-camera-workspaces.md under docs/reference/design-system/ | **CONSOLIDATE then DELETE**. | Keep any missing *current* exposure, guards, selection continuity, preview restoration and domain-owned operations in components/shell.md, placement.md or camera-tour.md. Drop old dimension tables and desired workspace rules. No wholesale copy. |
| camera-flow-specs.md; camera-layout-design.md under that directory | **CONSOLIDATE then DELETE**. | camera-tour.md retains current graph-vs-order distinction, sequence/order mutation semantics until T3, timing/framing/preview guards, passive Camera Plan footprints/hit precedence and X/Z-to-Camera projection boundary. References already covering a fact receive no duplicate paragraph. |
| All other baseline files under docs/reference/design-system/ | **DELETE** after the above consolidation. | Superseded design-specs, P21 briefs/gallery, orientation-box specs/render briefs, visual registry and obsolete drafting icon. Retained atlas is self-contained; if an external asset is actually required, move that exact dependency into its atlas bundle rather than keep a second spec/gallery. Current controls/geometry remain described by code and component contracts. |
| docs/North-star-final-decision-synthesis.md; North-star-final-synthesis-peer-review.md; World-Experience-Architecture-Synthesis.md; World-Experience-Model.md | **DELETE after promotion coverage check**. | First two explicitly superseded/folded; World/Experience conclusions are in ratified amendment, F, North Star and architecture. Preserve any unpromoted owner obligation in its owning contract or track evidence before deletion; do not retain proposal duplicates. |
| README.original.md | **DELETE**; update any incoming route. | Superseded human overview; Git owns its history. |
| apps/editor/src/lib/editor/README.md | **RETAIN + repair** under §2.3 and §6. | Correct production entry/visitor boundary; remove P0 archaeology route and misleading “getter-only” composition-root claim. |

Consolidation is a semantic extraction, not re-ratification. Current component contracts keep their present behavior and known limitations; F/PLATE control new design. To avoid redoing this audit, use the concern checklist above and inspect source only for a claim that is missing, ambiguous or contradicted.

### 4.3 Protected accepted prototype family: exact moves

All existing prototypes are retained. This exception is functional and design evidence, not blanket historical completeness: Conservatory, Paper and World are accepted references; donor/Integrated Experience, World shell round and UX3/V3 are the comparison/provenance chain explicitly used by #111–#114; Object Composition is unique assembly/reach/repair research. Their READMEs must identify accepted, superseded or unratified roles, with PLATE/F authority links. No prototype becomes a workspace or production dependency.

The baseline design/QA files still under P-level roadmap folders move into their owning prototype evidence homes:

| Baseline source | Target operation |
| --- | --- |
| docs/roadmap/p26-spatial-depth/design/visual-system-refinement/** | MOVE whole bundle to prototypes/spatial-authoring/design/visual-system-refinement/, including specification-plan.md, paper-surface-brief.md, QA scripts, acceptance, contrast evidence and transition capture assets. |
| docs/roadmap/p26-spatial-depth/design/world-authoring-prototype/implementation-plan.md | MOVE to prototypes/spatial-authoring/plans/world-authoring-prototype.md. Keep accepted plan/recovery and #112 acceptance routes. |
| docs/roadmap/p26-spatial-depth/design/paper-authoring-prototype/implementation-plan.md | MOVE to prototypes/paper-authoring-commission/plans/inactive-adoption-plan.md. Preserve PA0–PA12 and keymap evidence with “inactive, unimplemented; no current authorization” banner. |
| docs/roadmap/p25-experience/design/experience-v2-prototype/implementation-plan.md; conformance-plan.md; authoring-completeness-plan.md | MOVE, keeping filenames, to prototypes/spatial-authoring/plans/experience-v2-prototype/. Preserve #113/S0–S9/C1–C9 recovery anchors and MP1–MP4 functionality acceptance boundary. |
| docs/roadmap/p25-experience/design/experience-v2-prototype/ux-pruning-and-shell-reconciliation-plan.md | MOVE to prototypes/spatial-authoring/plans/unified-design-reconciliation/implementation-plan.md. Preserve #114 closed plan, full-body recovery and acceptance scope; obsolete UX steps stay historical. |
| docs/roadmap/p25-experience/design/experience-ux-v3/** | MOVE whole six-file design package to prototypes/experience-ux-v3/design/. Preserve its reconciliation inventory linked by Integrated Design-QAs and Conservatory comparison evidence. Label inactive; generated PNG equivalence is not acceptance. |
| docs/operations/checkpoints/experience-v2-conformance-evidence/** | MOVE whole bundle to prototypes/spatial-authoring/qa/verification-records/experience-v2-conformance/. It is completed #113/#114 test/capture/provenance evidence, not an active checkpoint. Preserve failed-run logs as well as final green records where they qualify acceptance/recovery. |
| docs/archive/roadmap/p25-experience/p25-unified-design/p23b-browser-report.json and p23b-validation-result.json | RETAIN byte-identically at current paths. Accepted UX evidence links them as historical comparator/provenance. |

Only links, recovery-command path interpretation, historical-role banners and necessary relocatable QA script locators change in protected text. Record hashes before/after; changed text must have a reviewed mechanical reason. Do not rerun broad prototype suites or rewrite captures: #115 changes no prototype behavior. Inspect all moved scripts' working-directory assumptions and actual filenames; fix launcher paths so the retained evidence remains reproducible. No old P25/P26 stub tree remains after incoming links are repaired.

### 4.4 Retired P24/P25/P26 planning and unique technical evidence

| Baseline source / rule | Action and destination |
| --- | --- |
| P24 research/deep-research-P24-3D-editing-compact.md, deep-research-assets-compact.md, deep-research-exact-asset-compact.md, Pascal-editor-harvest.md, three-r175-r186-museum-harvest.md, museum-editor-phase2-acquisition-manifest.json | ARCHIVE/MOVE those six files, same relative research layout, to docs/archive/technical/composition/. Unique focused technical/license/acquisition evidence; no current version/support claim is inferred. Delete Pascal-editor-harvest-brief.md. |
| P24 R3/R4/R5–R7/R8/R9 reconciliation files, umbrella, P24A annex, reconciliation sequence, minimum child briefs | CONSOLIDATE the surviving obligations into T2 planning-evidence.md, then DELETE originals and P24 README. Retire frozen minimum, corpus quotas, static-only scope and phase dependencies. |
| P25 research/P25-research-compact.md | ARCHIVE/MOVE to docs/archive/technical/experience/P25-research-compact.md, with its original provenance/old-model caveat. Extract current relevant accessibility/repeated-occurrence findings to T3 planning-evidence.md. |
| P25 research/deep-research-P25.md, deep-research-report-P25-full.md, prompt-phase-5.md, umbrella and README | DELETE after the consolidation; full/compact research duplicate and Camera-relative order/variables exclusion are superseded. Protected design-plan moves in §4.3 happen first. |
| P26 research/broad/deep-research-P26-phase-1-compact.md and both research/harvests/* files | ARCHIVE/MOVE preserving broad/harvests layout to docs/archive/technical/spatial/. Unique condensed spatial findings plus actual FreeCAD/Bonsai source inspection, identity and unsupported-depth traps. Delete broad full report. |
| P26 continuous-spatial-authoring umbrella | CONSOLIDATE obligations/open choices into T1 planning-evidence.md, then ARCHIVE/MOVE to docs/archive/technical/spatial/continuous-spatial-authoring-umbrella.md. Its D1–D8 and ceiling/periodic proofs are uniquely valuable; its order and architecture proposals are not current plans. |
| P26 research/synthesis/p26-architectural-spatial-depth-synthesis.md | CONSOLIDATE its independent domain findings into T1 evidence, then DELETE. The umbrella plus primary harvests preserve substantive nonduplicate evidence. |
| All other baseline P24/P25/P26 files, including phase READMEs, designer brief and Final-Design-Prototype redirect | DELETE after protected moves/consolidation. The old trees disappear; there is no active P-level route or compatibility-stub maze. |
| docs/roadmap/backlog/2026-08-27-P13-stop-at-node-playback.md; 2026-08-21-branch-rejoin-experiment.md | CONSOLIDATE **unscheduled proposals** in a short global roadmap backlog paragraph; DELETE obsolete implementation recipes. T3 may assess pause-at-next-occurrence transport within its own scope; branch rejoin remains unscheduled/uncertain, no invented capability promise. |
| docs/roadmap/f-foundation-contracts/design/proposals/2026-09-27-biskiq-durable-design-commissions.md | DELETE after checking proposed scenarios against protected prototypes/current North Star. It is a non-authoritative commission proposal, not an open mandate or exact F contract. |
| docs/roadmap/model-assessment.md | DELETE. Outdated model/intensity estimates and shipped task status are neither product planning nor credible current capability measurements. Remove global META/MODEL routes, not the user's ability to choose a model. |

Required consolidation contents, written as **evidence/obligations, not detailed implementation plans**:

- **T1:** World A–F/Conservatory/Paper division of evidence; circular enclosure inclusion requires a single self-connected continuously curved Wall, not a multi-Wall approximation; head-fixed arch rise/independent overhead-region intent without asserting a landed encoding; typed cut/projected/hidden streams and source correspondence; hosted Opening identity rather than boolean-face guessing; source identity through Section/peel; finite depth must affect geometry/membership; exact nested Look/return and document Undo separation. Carry D2 datum/closure/coverage, D3 fit/gap semantics, D5 seam/ambiguous inverse/refusal and D6 invalidated return/undo suffix as focused mechanisms/owner choices. D1 old sequence is superseded by the seam gate; D4 follows strict prune-first policy; D7 shell exposure now follows PLATE; D8 inclusion is already accepted. Carry Layout's later Wall-role ruling and its two genuinely open decisions. Do not make independently authored slab/ceiling ownership appear settled where F still names an open mechanism; distinguish accepted UX intent from schema ownership/encoding.
- **T2:** one semantic Scene placement with view-specific projection; derived footprint, X/Z/yaw input and support-owned Y; transient support consultation is not authored host attachment; view-independent selection and explicit ineligibility; cancel unfinished gestures at actual transitions; preview candidate and commit have identical validated semantics; one acceptance/history result; mutations follow entity authority. Carry canonical Room-free placement defect, atomic group/duplicate validation, positive/uniform versus independent-scale fidelity, material/light semantic gaps, static-model source drift, and truthful ingest/provenance/resource locking. Single-model creator import belongs in the first trial loop; the old static corpus minimum and “wait for full T1 before T2” do not survive. No renderer/library upgrade is authorized by retained external-version harvests.
- **T3:** repeated Stop/Presentation/visit distinction; collection-capable Experience; no “Destination” duplicate entity; Camera geometry/timing remains intrinsic while editorial order/holds/continuation/Gates move to Experience; exact simultaneous Camera/F.4 cutover; real first capability adapter can be narrow. Preserve DOM companion navigation/content, keyboard and focus return, captions/transcripts, explicit media/browser activation constraints, reduced-motion same semantic endpoint and Preview/public parity. Retire Camera-owned occurrence proposals, single fixed panel minimum and blanket variables/conditions exclusions; Conservatory owns current UX, F owns state/logic semantics.
- **T4 README:** current source-snapshot path and prepared-reader obligation; verifiable provenance/closed resources/required capabilities; per-Experience pointers; separate Baselines and covered-data ledger required by its first cutover plan. No extra T4 evidence file is needed: current source/authority anchors in this plan and the retained P22 component contracts suffice.

### 4.5 Closed P23/P23B, operations and archive

| Baseline prefix / exception | Action |
| --- | --- |
| docs/roadmap/p23-layout-depth/** | DELETE remainder after the exact archive exceptions below. Shipped plans, stale “implementation-ready” text, reconciliation, directive and design-context duplicates are not live memory. |
| P23 README.md; 2026-09-09-P23.0-wall-first-foundation-migration.md; 2026-09-09-P23.8-wall-topology-room-regions.md; 2026-09-14-P23.11-canonical-curved-walls-and-render-safe-validation.md; 2026-09-17-P23-junction-dissolve-wall-join.md | ARCHIVE/MOVE, same relative paths, to docs/archive/technical/p23/. Preserve phase closure provenance, format cutover proof, Room lineage, canonical curve validation and dissolve invariants expensive to recover. Mark history; current semantics stay in reference/source. |
| P23 p23.14-shell-visual-system/qa/2026-09-19-P23.14-shell-qa-record.md; p23.15-junction-correct-wall-first-3d/**; p23.16-whole-product-integration-closeout/**; 2026-09-08-P23.16-final-whole-product-integration-closeout.md | ARCHIVE/MOVE, same relative layout, to docs/archive/technical/p23/. Preserve final gates/closure, unique watertight research and TD-2 origin/recovery. The already archived old UI galleries are not required merely because these records quote them. |
| P23B p23b.0-measurement-foundation/fixture-ledger.json; p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json | RETAIN byte-identically **at current paths**. Tests and recorders import/use these exact inputs; no baseline regeneration. |
| P23B README.md; p23b.0-measurement-foundation/2026-09-24-P23B.0-budget-policy-record.md; 2026-09-24-P23B.0-durable-measurement-report.md; 2026-09-24-P23B.0-ratification-handoff.md; p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md | ARCHIVE/MOVE, same relative paths, to docs/archive/technical/p23b/. Preserve phase-level closure, metric ratification and curved-crossing decision. |
| P23B p23b-measurement-only-step/**; p23b.6-rendering-optimization/**; p23b.8-follow-up/**; p23b.8-rust-wasm-evaluation/2026-09-29-P23B.8-decision-record.md; p23b.9-correctness-performance-gate/**; p23b.10-phase-closeout/**; p23b.11-wall-chain-release-delay/** | ARCHIVE/MOVE, same relative layout, to docs/archive/technical/p23b/. Unique final/negative/reverted measurement evidence, accepted gates and closure support TD-4/TD-5/D5/M1; retain accompanying plans needed to interpret measurements, with historical banners. No active optimization mandate. |
| P23B pre-p23b.8-follow-up/** | ARCHIVE/MOVE same relative layout to docs/archive/technical/p23b/ **except DELETE** external-research-brief-room-drag-preview, research-synthesis-review-and-plan and room-move-quick-sketch-design-sketch (their filenames have the 2026-09-27 prefix). Keep measured trace/attribution/session/revert records, accepted plan and closure; historical “uncommitted” statements describe that capture, not current work. |
| All other P23B baseline files | DELETE. Superseded optimization umbrellas and recovered closed stubs duplicate code/contracts/selected evidence. Pull any exact unreconciled debt statement into tech-debt before deletion; do not reset measurements. |
| docs/operations/current.md; checkpoints/README.md; tech-debt/README.md | RETAIN + route repairs. TD-1/2/4/5 stay open; TD-3 fixed evidence may compact to one line plus recovery anchor. Do not infer a fix from future replacement. |
| docs/operations/test-suite-harvest-2026-09-19.md and test-suite-harvest-inventory-2026-09-19.csv | ARCHIVE/MOVE together to docs/archive/technical/test-suite/. Unique measured test-lane/successor/mutation evidence. Current test doctrine stays in tests/README; repair optional provenance links and comments without requiring historical reading for a new test. |
| docs/operations/architecture-cycle.md | CONSOLIDATE live state and bounded operative protocol here, retaining PHASE_1/M1–M7 and manual owner transitions; see §6. |
| docs/roadmap/architecture-operating-cycle-plan.md | CONSOLIDATE operative rules into architecture-cycle.md; ARCHIVE/MOVE the original to docs/archive/technical/architecture-cycle/operating-cycle-plan.md as installed Phase 1 method provenance. No second live process plan. |
| docs/roadmap/architecture-operating-cycle/phase-0/** and phase-1/** | ARCHIVE/MOVE whole nine-file evidence/installation bundle to docs/archive/technical/architecture-cycle/, keeping phase-0/phase-1 layout, independent frozen reviews, adjudication and installed ruling provenance. |
| docs/roadmap/architecture-operating-cycle-workflow-harvest.md | DELETE after protocol consolidation. Solved workflow diagnosis is not an active planning mandate. |
| Baseline docs/archive/** | DELETE by default **except** archive/README.md (rewrite), the two p25 comparator JSONs above, and roadmap/p23/foundation-research/P23-H3-robust-geometry.md and P23-H5-room-identity-migration.md (RETAIN unique robustness/lineage harvests at existing paths). This default applies to the baseline archive inventory only, never newly moved technical evidence. |

The last rule removes obsolete handoffs, legacy authorities, old plans/refactor audits, superseded superpowers specs and unused old P23 UI galleries. Their history remains at the baseline commit. Before deleting ASSET_WORKFLOW.md, fold only missing reproducible normalization/rights/provenance checklist facts into assets.md (actual normalizer script remains production tooling); CAMERA_AND_LAYOUT.md duplicates the current Camera contract. Remove obsolete full-checklist/proposal routes, including historical ratification links, as described in §6.

**Preservation invariant:** an unresolved obligation cannot disappear because its source doc is deleted. The expanded manifest records its surviving owner/anchor. If a specific unpromoted decision is found, preserve that exact evidence and update the manifest before deletion; classify it against ratified authority without silently promoting a proposal. This is a bounded discrepancy exception, not an instruction to redo whole-repository reconciliation.

## 5. Cross-slice dependencies and exact F interfaces

### 5.1 Execution model

Readiness belongs to **a versioned interface or accepted capability result**, never “T1 complete” or “all F implemented.” Planning can proceed while required gates are pending. A registered implementation slice can start only with an approved exact plan, recorded owner execution authorization, and its applicable interfaces implemented/accepted in shared code. Its own produced result is not a prerequisite it can self-satisfy.

Required graph shapes:

| Consumer effect | Exact prerequisite | Independent work that remains allowed |
| --- | --- | --- |
| New qualified persisted/cross-domain references | F1.reference interface amendment + shared implementation | Investigations/drafts can proceed. Existing plain-ID data is described honestly until its own cutover. |
| New domain unit or envelope | F2.unit-envelope interface, and F1 references when used | T2 Scene data and T3 Experience data need no T1 representation completion. |
| New cross-domain channels/state contributions | F3.channel interface plus owning domain capability/operator | A narrow real capability can ship without full component/clip/representation depth. No invented fallback adapter. |
| New expected-revision/compound acceptance consumers | F4.intent-acceptance interface plus accepted project coordination result where the consumer requires it | Shared interface types can precede T3; first full compound acceptance behavior is the T3 cutover, not an unrelated F kernel program. |
| T2/T3 authoring integrated with Stage, projection, selection or overlays | T1.viewport-projection, the exact accepted seam version | Data/codecs can proceed independently; UI does not wait for Section, Unroll, ceiling depth, levels or completed T1. |
| T1 migration of Camera authoring adapters | T3.camera-experience-cutover | Layout/World/seam work remains independent. T1 cannot introduce a second editorial writer while waiting. |
| Prepared release envelope/reader | F5.release-envelope interface; F1 public addresses; supported source units/lowering for the selected profile | T4 lowers current supported data before future T2/T3 payloads. No invented requirement for all T3/T1 capabilities. |
| Release includes a new Scene/Experience/Layout capability | That capability's explicit runtime-safe evaluator/lowering + closure/conformance gate | T4's other envelope/storage/provenance work continues. Required unsupported capability fails explicitly. |

Gate IDs identify obligations, not numeric implementation designs. #115 seeds F1.reference, F2.unit-envelope, F3.channels, F4.intent-acceptance, F5.release-envelope, T1.viewport-projection and T3.camera-experience-cutover as **unimplemented**. It may declare T4.prepared-reader as a future output, also unimplemented. No fictitious first consumer, interface version, slice sequence or acceptance exists initially.

The first detailed consumer plan adds the exact amendment/interface version and provider slice. Domain-specific gates are registered when their owning plan defines them. A shared implementation can live in the existing project-model/camera-core/layout-core package where ownership fits; a new shared package is allowed only if actual import/lifetime evidence warrants it. #115 does not prescribe the kernel substrate or invent package topology.

### 5.2 Interface ownership and the F amendment path

1. The first consumer drafts the smallest actual input/output, identity/version/units, failure cases, capability negotiation and fixtures in **its own exact plan**. A gate registers that consumer and the domain/F owner. Another consumer joins the same gate; it does not mint a competing interface.
2. Review the cross-domain contract against F and the affected domain owners. Record explicit owner ratification as an amendment in composition-execution.md. The amendment has a stable ID/anchor, interface version, boundary/extension semantics, consumer list and conformance requirements. Resolved plan proposals become links to this single normative amendment, not parallel specs.
3. A bounded provider slice implements that interface in shared code and supplies real exports/fixtures. Types/contracts can precede full machinery. Provider acceptance records actual entry points and commands/defect proofs. A pasted type, mocked adapter or prototype schema is not shared implementation readiness.
4. Only then can a dependent capability implementation consume that accepted interface. For F.2/F.4, distinguish the **shared interface gate** from the **T3 behavioral cutover gate**: generic unit/envelope/intent interfaces may land earlier, but Camera extraction, Experience order and first compound acceptance remain one T3 cutover. Do not split that semantic migration merely to manufacture more provider gates.
5. Incompatible amendment/version changes invalidate affected consumers until they declare/test the new interface. Optional extensions are negotiable; required unsupported ones reject. Amendment ratification alone is never implementation readiness.

A provider and consumer may be prepared on dependent branches. A consumer's implementation authorization must name an **accepted, committed provider revision**; the change checker reads prerequisite state at that revision, not a newly edited current register. The default is the trusted integration base. If an explicitly authorized stacked cutover uses an accepted provider commit inside the stack, record its immutable SHA and review/acceptance evidence; it must be an ancestor available before dependent implementation. Never satisfy a prerequisite by marking it accepted in the consumer's own unreviewed diff.

### 5.3 Gate register: one small machine-readable file

execution-gates.json has schemaVersion 1 and two arrays: gates and slices. Read track membership/status from the global roadmap, phase membership/status from the owning track README, and child membership/status/authorization/direct artifact routes from the owning phase README. Parse the canonical Markdown tables defined in §3.3 with one helper grammar. No copied lifecycle/status/frontmatter in JSON and no database/scheduler/dashboard.

**Gate row:** id; kind (`interface | capability | integration`); concern/owner; version (null while undrafted); contractAnchor; firstConsumerSlice (null until assigned); providerSlice (null until assigned); requires (gate-version references); state (`undrafted | drafted | ratified | implemented | accepted | superseded`); ratificationEvidence; sharedExports; conformanceTests; acceptanceEvidence; implementationCommit. Empty readiness evidence is valid only before the corresponding transition. F target ratification is recorded separately from exact-interface ratification; it cannot initialize a new interface as ratified/accepted. A product integration gate additionally names its single integrationPlan and coordinating owner; those are null/unregistered until actual authorization, not #115 placeholders. Domain gates need not wait for phase closure unless that phase-wide accepted result is precisely what the consumer needs.

**Slice declaration:** id; parentPhase; mode (`planning | interface-provider | capability | repository-docs`); consumes (gate/version refs); produces; effects; writeScope; deferredRetirements with removal slice IDs. Derive its track and plan/acceptance/authorization from canonical README owners. F provider work resides in an actual track phase; F owns the contract. The #115 entry is R115.S01 with repository-docs mode and the repository-phase README as owner. Other slice declarations remain empty until detailed phase/slice plans actually exist. Registered metadata cannot make a nonexistent phase/slice or unapproved plan executable.

**Evidence row:** a repository record path/anchor, immutable reviewed implementation identity (commit or reviewed input hashes before merge), test paths/commands, outcome and owner ruling where required. A gate cannot be accepted with only a prose “PASS,” nonexistent file, placeholder SHA or missing conformance fixture. After merge, closeout verifies recovery/implementation anchors without changing semantic outcomes. A future test can't validate that a person actually approved a ruling; human authorization provenance remains an independent review boundary.

Initial register contains **zero accepted capability/interface gates**. Required arrays can be empty for a real planning-only slice; every capability/provider slice declares relevant effects. Do not create a capabilities catalog with imagined slices to populate the register.

### 5.4 Enforceable rules and change preflight

Implement one parser/validator in the proposed tests/helpers/execution-gates.ts for canonical README status tables, register and conditional cycle state. The unconditional architecture suite validates their relationships and routing. The CLI proposed in tests/helpers/execution-gates.cli.ts calls the same functions and reads Git's actual changed files, including committed diff against a trusted base plus staged/unstaged/untracked relevant files. Tests never rewrite state. This adapts existing README ownership; it does not replace it with a second status system.

Expose an editor package script, verify:execution, using the existing vite-node runner/config (the repository already uses that runner for bench/reuse CLIs). No new runtime/dependency is needed. Required arguments are `--base <trusted-commit>` and the event's exact `--slice`, `--phase`, `--track` or `--gate` ID. `--event` is `verify` (default), `start`, `accept`, `closeout`, `phase-close`, `track-complete`, `integration-accept`, `replan`, `configure-window`, `owner-verdict` or `diagnosis-request`. It evaluates registered planned effects/scope before editing and actual changed files at acceptance. The CLI prints unmet gate IDs, owner, exact amendment/plan routes, relevant cycle action and affected files; nonzero means **do not execute dependent work**. Planning and docs-only modes still validate structure but do not falsely require implemented capability gates. Event commands print required authoritative updates; they never infer approval or mutate state themselves. Ordinary slice commands do not emit track/program procedures unless the user actually invoked that event.

Automatic checks:

- All IDs/paths resolve; no dependency cycles, dangling edges, gate-version mismatch or self-produced prerequisite. Every produced gate has one provider; consumers cannot claim another gate's write ownership.
- `implemented` requires shared source/export and conformance paths. `accepted` requires reviewed implementation identity, acceptance record and prerequisite closure. Ratified amendments remain separate from code/behavior acceptance.
- Every in-progress/accepted/shipped capability slice has an exact approved plan and recorded execution authorization. Shipped requires closeout/recovery evidence; accepted results do not authorize track-level future work.
- README parentage is valid and unique; each phase belongs to one track (R115 is the explicit repository exception), each slice to one phase, each FINAL PHASE GATE to an actual child. Closed requires the declared gate, phase-wide accepted integration, owner closure and residual disposition. An accepted final child cannot set closed. Track shipped/complete requires its separate owner/evidence block; product integration accepted requires its own plan/evidence and required capability gates. Do not derive any broader completion from child statuses.
- The trusted-base state satisfies each required consumed gate before implementation. Changed current metadata cannot silently turn a previously pending prerequisite green. Registry amendments and provider code are checked by the provider slice; consumer code by the consumer slice.
- Semantic `effects` trigger mandatory gates even when the declared consumes array is empty: qualified-reference/persisted-unit/channel/compound-acceptance/release effects require their relevant F interface; `stage-authoring-ui` requires T1.viewport-projection; `camera-authoring-migration` requires T3.camera-experience-cutover. `camera-experience-cutover` is T3-owned and must produce the atomic split/order/acceptance gate.
- writeScope covers the actual diff. Capability source paths outside the slice scope fail. Shared foundation paths are assigned to a provider/domain, not a feature-local writable format. A new persisted format must name its F amendment and unit/capability owner in the reviewed plan.
- Coarse source zones catch undeclared effects: editor Stage/workspace/camera-plan/gizmo/helper hosts require a declared authoring/seam assessment; project-model/codecs/persistence paths require unit/reference/acceptance impact assessment; API/publication/cold-reader paths require release/coordination impact assessment. A small local fix can record `existing-contract-maintenance` with specific evidence instead of taking an unrelated F gate. It cannot use that exemption for a new format or ownership cutover.
- Schema/authority changes add conformance and narrow call-site/forbidden-import proof alongside behavior. Keep current Camera/geometry/visitor boundary tests; extend them at actual cutovers, not by parsing speculative new production shapes in #115.
- The #115 repository-docs mode rejects production source, API/migration, runtime dependency/lockfile and prototype behavior changes. Allowed changes are docs, AGENTS/human/code README routing, scoped skill instructions, gate checker/tests/lane registration, editor script metadata and mechanical protected QA locator updates. No blanket apps/** allowance.
- Conditional operating-cycle requirements are computed by the same preflight (§7); missing exposure/closure actions fail when the relevant slice transitions, not for an unrelated data slice.

Actual gate acceptance may be recorded with reviewed slice acceptance before routine closeout if its own criteria are met; otherwise it remains implemented/pending. closeout unblocks nothing merely by changing a child status to shipped. Phase closure, track completion and integration acceptance are distinct events/owners, and prerequisite checks use the gate's real accepted result/version, not those lifecycle labels.

This is a testable change/metadata gate plus architectural review, not a magical semantic parser. A deliberately false effect declaration could evade coarse zones; reviewed exact scope and existing source/behavior boundary tests are indispensable. Do not respond by imposing full track dependencies or requiring META on every task. A normal preflight covers all source changes; only its matching concern routes are read.

## 6. Routing, reference and workflow updates

### 6.1 Fresh-agent routing

Replace the old flat P-level sequence with Track → Phase → Slice routes in AGENTS, docs/README and the global roadmap:

```text
ROUTE TEMPLATE <not another task checklist>
START: docs/README.md
ASSIGNED WORK: operations/current.md → exact owning phase README → exact slice plan
UNASSIGNED PLANNING: roadmap/README.md → requested track README → phase plan (when registered)
F-INTERFACE GAP: slice plan → exact F amendment/provider gate
VERIFY: exact slice acceptance rows + apps/editor/tests/README.md
CYCLE: load only the action/affected mechanism route emitted by preflight
SLICE CLOSE: slice-closeout; phase final-gate guard only, no ambient phase/track/program procedure
PHASE CLOSE: explicit owner invocation → phase-closeout
TRACK / PROGRAM / REPLAN: explicit event → exact operations/README.md section
STOP: no more reading unless a concrete contradiction or missing fact requires it
```

Track → Phase → Slice is an ownership hierarchy, not mandatory context preloading. The baton links the exact phase/child directly; the track README is read when its phase registration/scope is needed. Ordinary slice work need not load the global program runbook, phase-close procedure, whole F contract, archived diagnosis or unrelated phases. The checker may inspect canonical metadata automatically without injecting those files into agent context.

The global roadmap replaces the long #104–#114 chronology and P23/P23B tables with a compact accepted-basis paragraph linking PLATE and prototypes, four track routes, F route/register link, provisional post-baseline capabilities and unscheduled backlog. Record P23/P23B closure once with optional selected archival evidence. There is no P24/P25/P26 active route, no whole-T1 readiness requirement, and no “editing UI after all data tracks” pipeline diagram.

current.md is rewritten for #115 execution/review and then for independent Track → Phase → Slice planning after acceptance: assigned track/phase/slice, authorization, exact next step and specific gate/debt pointer. It may list multiple active units; it does not restate their status or maintain a second per-track ledger. At R115.S01 completion, state “#115 restructuring accepted; T1–T4 phase/slice planning available; capability implementation requires its own approved scope/gates,” with exact track routes and R115 phase closure pending if not explicitly invoked. Do not state four plans already exist or make that administrative owner-close a capability-planning prerequisite.

F README becomes registration/amendment routing with implementation status linked to the register. Remove stale “before P24/P25/P26” and “no child planning” wording that contradicts the independently authorized track-planning handoff. Keep F target ratification and interface ownership unchanged. The full F shapes live only in composition-execution.md; avoid another five-contract specification table.

### 6.2 Incoming links, evidence and progressive disclosure

The executor repairs incoming routes in **all retained tracked Markdown, HTML, JSON manifests and QA launchers**, not only global routers. Important callers include Conservatory README, Paper proposal, spatial-authoring IMPLEMENTER-REFERENCE/qa READMEs/conformance manifest, Integrated Experience reconciliation/Design-QAs and PLATE evidence table. Protected plans' git-show anchors preserve their original path at the historical revision; update live links while retaining historical recovery semantics.

Ratified decision records keep their historical content/ratification immutable. Old planning links in their reconciliation/handoff sections become labeled provenance routes to a retained archive record or an exact `git show <baseline>:<old-path>` code example; they must not point to a removed current plan. Where a historical record quotes a removed source/test path, use the existing EVIDENCE-PATHS convention. It exempts written historical locators only, **not actual Markdown links or image references**. Do not blanket-exempt new planning documents or prototypes.

The archive router becomes a small opt-in map of retained technical/closure evidence plus Git recovery rules. It does not keep hundreds of link-preserving stubs or duplicate live prose. Live routers may cite specific archived evidence with an explicit historical role; they never send ordinary implementation to archived plans for current scope. Do not rewrite frozen Phase 0 reviews or acceptance measurement bodies to match new architecture; document escaped historical links in the move manifest/nearest non-frozen index.

### 6.3 Skills and verification documentation

The existing slice skill has a useful final-gate guard, recorded-evidence discipline, no routine re-review rule and hybrid preservation. The phase skill has owner entry, phase-local closure, whole-phase proof and idempotent resume; its obsolete cycle transition table/next-P pipeline creates ambient unrelated context. Preserve the useful mechanics and replace those two seams. No new hierarchy skill is warranted.

Concrete skill edits, performed only by the later executor:

- **slice-closeout/SKILL.md:** resolve the exact owning phase README/child; read track scope only if needed. Retain recorded acceptance, checkpoint retirement, durable promotion, acceptance/preservation record, phase child status, assigned global baton and link repair. Run gate/conditional-cycle event preflight at acceptance/closeout; follow only its relevant action section. Lifecycle status stays in the phase child row; gate updates require their actual acceptance. Keep the declared-final-gate branch: finish child closeout, set phase closable, preserve final-gate artifact, report owner closure pending and stop. If the user separately authorized phase closure, invoke that distinct skill afterward rather than teaching its procedure here. No track/program procedure is included.
- **phase-closeout/SKILL.md:** broaden its entry examples to an explicit nested phase such as T1.P01, retaining legacy named phases and owner-only guard. Verify final-gate acceptance, phase-wide integration/remaining obligations, owner ruling and preservation; write local PHASE CLOSE and the owning track phase row (global R115 exception). Reconcile the assigned baton without assuming a next phase/track. Replace the mandatory full cycle preflight/transition table/META read with one event-preflight hook: only an actual matching action loads its exact section. Ordinary phase closure does not close the exposure window, start diagnosis, complete its track or accept a product gate. Retain idempotent “ensure value” and recovery of incomplete close batches. No track/program/replanning steps are appended.
- **Shared preservation reference:** move the existing slice skill's Closed work, research disposition, anchor/tag/merge safety, archive mechanics and preservation-report sections to .agents/skills/slice-closeout/references/preservation.md. Both skills link it **at their compaction step**, reading that section only when needed. Keep protected prototype exceptions and reviewed Git recovery; if a full body has no valid committed recovery anchor, retain it until preservation is possible rather than fabricate an anchor or force a commit. Correct the old P1 sequence to review → acceptance → routine closeout → merge, with post-merge anchor verification and no mandatory second review. This is a supporting reference, not a new skill or another authority.
- **work-checkpoint:** carry track/phase/slice identity and resume route; lifecycle belongs to the owning README, prerequisites to the gate register, current work to the global baton. Completed verification evidence goes to acceptance/QA, not raw checkpoints.
- **consult-browser-reviewer:** preserve manual-only entry and minimal affected phase/slice/contract packet. Gate/cycle changes do not invoke browser review. Browser-hygiene remains conditional on actual browser use.
- **AGENTS/docs router:** explicit slice/phase/event routes, owner-invoked phase closure for nested phases, direct artifact routing and plan hygiene. No startup requirement to read all phase/closeout/META/program instructions. Planning stores conclusions/current scope, not review-round logs.
- **tests/README:** add gate/event preflight, README lifecycle authority and conditional cycle tests; preserve unconditional arch/whole-suite doctrine. Repair optional harvest/ratchet provenance; no test tree/source import-root moves.

operations/README.md supplies event-only sections `track-completion`, `product-integration-acceptance` and `bounded-replanning`. Each contains only its entry authorization, evidence, exact owning writes, idempotence and exit/handoff: track completion writes global TRACK COMPLETE plus residual transfers; integration acceptance updates its exact accepted gate after real end-to-end evidence; replanning updates approved objective/phase/track routes while preserving accepted gate identities. Phase/slice closure agents load none of these sections unless the user explicitly invoked that distinct event. Track runbooks link these sections without copying their procedures. Cycle actions stay in exact §7 action subsections and are likewise loaded only when emitted.

## 7. Dedicated architecture operating-cycle migration

This is **WP4**, not an incidental pointer rename. Preserve the completed Phase 0 investigation/frozen independent reviews/adjudication, installed Phase 1 plan and original method in the archival bundle specified above. No new diagnosis, reviewer pair, broad architecture sweep or routine reconciliation ceremony is commissioned.

### 7.1 State authority and migration result

operations/architecture-cycle.md remains the **sole cycle-state and protocol owner**. Add one strict, machine-readable JSON fence to it, parsed by the shared gate helper. Its prose explains that state; it does not maintain a second writable status table. Phase READMEs own slice lifecycle; the gate register owns effects/prerequisites and links the cycle record, never copies its stage. One parser reads the cycle JSON; tests and CLI reuse it.

State fields: schemaVersion; cycleId (`p23-capture-validation`, preserving provenance); stage; readiness; mechanisms (M1–M7 identity, owning reference/test routes and verdict kind); window; exposures; ownerVerdicts; diagnosisTrigger (null unless a new demonstrated failure/explicit request actually exists). window contains id, state, approvedPlanAnchor, openingSlice, exposureSlices, terminalSlice, maximumExposures, openedBy, closedBy and closureEvidence. exposure rows contain registered slice ID, affected mechanisms, acceptance anchor, implementation identity and outcomes/residuals, **not duplicated tests/counts**.

The #115 migration keeps **PHASE_1**, changes readiness to `awaiting-bounded-slice-window-plan`, and names a selected **T-track spatial-foundation exposure window**, not P26. openingSlice/terminalSlice/exposureSlices are empty until a normal approved T1 phase plan names actual registered child slices. This is truthful pending configuration, never “ready” or an open empty window. P23B completion is historical context only. Installed mechanisms and their already promoted contracts remain installed.

Retain the stage vocabulary WAITING, PHASE_0_DUE, PHASE_0_ACTIVE, ADJUDICATION, PHASE_1, PHASE_2_VALIDATING, PHASE_3_EVALUATE and STEADY for recoverable old-cycle meaning. Remaining readiness values are `awaiting-bounded-slice-window-plan | ready | validating | awaiting-owner-verdict | steady`; window state is `selected | open | closed`. Old diagnosis/adjudication entry remains exceptional/owner-authorized and is not traversed by this migration. History is a frozen evidence link, not an append-only state-transition diary.

The first relevant T1 phase plan supplies a **finite set of one to three exposure-bearing slices**, exact qualified opening and terminal IDs and their ordinary prerequisites. It can include cooperating T2/T3 phase children only for actual affected seams; it may not require complete phases/tracks or owner phase closure. Exposures must be implementation units already justified by capability work. No dedicated reconciling/validation product slice is invented to fill the window. maximumExposures is 3; extending/resetting that bound requires an explicit owner amendment, not “we need more confidence.”

Opening is the first authorized start among this finite eligible set; the plan names its expected openingSlice, but an independently eligible declared slice may start first and become openedBy without waiting for it. The window closes when the named terminal is accepted **and** the remaining declared exposures are accepted or explicitly discharged, or on an approved early end. The agent recording the last event that satisfies this predicate writes closure. These are observation boundaries, not new product dependencies: no terminal slice waits to implement merely to serialize evidence, and no complete track must finish. The validator checks the closure predicate, rather than requiring closure from terminal acceptance alone.

Once the normal plan is approved, its planner records readiness `ready`, plan anchor, mechanism-to-existing-proof mapping and the exact window. This limited Phase 1 completion is agent work under the approved #115 lifecycle design, not another owner architecture diagnosis. Opening remains conditional on actual authorized implementation, below.

### 7.2 Mechanism routing and exposure scope

| Installed item | Conditional effect/path triggers | Obligation supplied by the exact slice plan |
| --- | --- | --- |
| M1 Layout semantic mutation | Layout planner/new Layout operations or editor gesture/precision mutation wiring | Call core planner; editor owns preview/transaction; no generalized result protocol. Cite existing operation and narrow call-site proof. |
| M2 Wall/Floor vertical authority | Wall/Floor/Opening height, overhead/datum/schema/compiler changes | Preserve current datum/Wall authority until explicit semantic cutover; reconcile affected domain contract at that cutover. Do not label proposed ceilings/levels shipped. |
| M3 persisted canonical curves | Wall centerline/curve codec/compiler or curve-authoring changes | Preserve Junction endpoints and authored canonical controls/stations; rendering sampling is derived. New circle semantics need their own approved contract/proofs. |
| M4 Junction commit-time identity | Noding, Room correspondence, chain commit/closure/dissolve or Junction allocation | Prove global coordinate/ID adoption, scoped retirement, deterministic lineage and editor run closure at relevant call sites. Screen-space suggestions never establish connectivity. |
| M5 project replacement/Navigator guard | Document/session replacement, Load/import/reset/Undo/Redo or hierarchy reconciliation wiring | Exercise actual replacement wiring and selection/session invalidation; preserve guard coverage beyond a pure helper. |
| M6 lifecycle state transition | Registered exposed-slice endpoint or actual cycle owner event | Execute the conditional cycle transition; ordinary owner-invoked phase closure stays within its phase and is no longer the window trigger. |
| M7 encountered lifecycle routing | Track plan/runbook/closeout route or trigger classification change | Automatic preflight and route tests make the affected obligation discoverable; do not maintain parallel manual reminder prose in every document. |

Use coarse path triggers already available from this audit (layout-core, editor Layout operations, history/document-store, EditorApp/project session/hierarchy wiring) plus declared semantic effects. A trigger requires a relevant assessment, not all seven mechanisms. The preflight reports only affected M IDs and exact owning contract/test/slice-plan routes. An existing-contract fix can discharge a trigger with existing proof; it does not reopen F or product direction.

Verified existing proof starting points: M1 uses editor/layout/layout-mutation-runner.test.ts and operation-specific core/gesture tests; M2 uses layout/layout-wall-height.test.ts, layout-wall-birth-height.test.ts and editor/layout/layout-height-edit-history.test.ts; M3 uses layout/layout-curve-schema.test.ts, layout-curve-read-path.test.ts and layout-curve-planners.test.ts; M4 uses layout/layout-junction-identity.test.ts, layout-wall-chain.test.ts, layout-room-reconciliation.test.ts and editor/layout/layout-wall-chain-commit.test.ts; M5 uses editor/app/hierarchy-projection.test.ts's derived menu/callback/shell replacement guard plus the changed actual replacement path's behavioral proof. These paths are relative to apps/editor/tests/lib/. The M5 source guard intentionally covers named menu/shell seams, not every possible future replacement; a new seam needs its own call-site evidence. M6/M7 use the new metadata/lifecycle/route tests, not seven extra product suites. The exact slice selects only affected cases; ordinary full repository verification remains unchanged.

The window's finite exposed set is declared before opening. A new affected slice outside the set keeps normal domain invariants but does not silently prolong cycle validation. If its work changes the window's assumptions, the responsible planner revises the finite set in the same ordinary scope review, retaining completed exposures and bound; never restart Phase 0. Cancel/retire/rescope of a window endpoint must substitute a specific endpoint within the bound or close early with recorded evidence of why remaining exposure is unavailable. It cannot leave a deleted slice as an unresolvable terminal.

### 7.3 Transitions and state writers

| Event / condition | Automatic required action | Authorized writer / evidence |
| --- | --- | --- |
| #115 accepted | Remain PHASE_1, selected window, pending exact slice configuration | #115 executor records migration acceptance/protected evidence hashes. No opening or diagnosis. |
| First relevant T1 plan approved, finite window and proof map complete | readiness becomes ready | Plan owner writes the cycle configuration from approved normal scope. Approval anchor and actual registered IDs required. |
| First eligible declared exposure slice starts authorized implementation; relevant gate preflight passes | PHASE_1 → PHASE_2_VALIDATING; window selected → open | That implementation agent records openedBy/start/implementation identity before capability work, through the same current/plan update. No unrelated META read or artificial wait for the nominal opener. |
| A declared exposed slice is accepted | Add one exposure row, linked to its ordinary acceptance | Its acceptance/closeout agent owns this row. Record actual affected outcomes/residuals; no rerun of already recorded suites and no new review ritual. |
| Closure predicate above becomes true, including any approved early-end criterion | Close window, PHASE_2_VALIDATING → PHASE_3_EVALUATE | Agent recording that final acceptance/discharge records closure and finite exposure evidence. No T1–T4 completion or P26 owner closure prerequisite. Global baton routes only the owner verdict action. |
| Owner supplies keep/simplify/delete/not-exposed verdict for every installed process mechanism, with residual ownership | PHASE_3_EVALUATE → STEADY; closed window preserved as provenance | Agent folds direct owner ruling into cycle and owning procedure/contracts where authorized. Ratified domain guarantees cannot be deleted by a process verdict; any normative change needs its own explicit amendment. |
| Normal accepted slice or ordinary milestone close in STEADY | Remain STEADY | Closeout handles its own changed truth/debt/removal; no cycle record or broad reconciliation added. |
| New demonstrated architectural failure or explicit owner request for diagnosis | Record narrow trigger; route pending authorization; enter PHASE_0_DUE only under the documented trigger | Discovering agent records evidence/affected concern and owner boundary. Actual diagnosis starts only on explicit owner authorization. Completion, aging docs or a new phase number is not evidence of failure. |

The initial migration does not pretend the old cycle already reached STEADY. The existing capture-contract tests can support exposure but do not prove unexecuted validation. “Not exposed” is an honest permitted **owner verdict**, with its reason and disposition of process overhead; it is never relabeled PASS.

At Phase 3, normal capability work continues under its own prerequisites. A pending meta verdict is **not a global implementation blocker**. Only a demonstrated failing domain invariant or specifically affected contract amendment blocks its real consumers. Ratified Layout/Camera/visitor guarantees remain enforced after STEADY regardless of a process mechanism's retention verdict.

### 7.4 Conditional agent routes and checks

Every implementation agent runs gate preflight for its exact slice/diff; every acceptance/closeout agent runs its transition check. This is already part of the ordinary verification route, not a new startup META reading obligation. CLI action codes are:

- `NONE`: unrelated planning/data/implementation; no cycle read/update.
- `CONFIGURE_WINDOW`: opening work is assigned but exact approved finite window/proof map is missing. Route only the configuration section and exact T1 plan. Implementation of that opening work remains ineligible; unrelated slices proceed.
- `OPEN_WINDOW`: the first declared exposure slice is eligible; route only transition/write fields and its affected contract proofs.
- `RECORD_EXPOSURE`: declared exposed slice reaches acceptance; route its acceptance row and relevant M IDs.
- `CLOSE_WINDOW`: the bounded closure predicate becomes true; route the relevant terminal/exposure acceptance, closure fields and Phase 3 owner-verdict boundary.
- `OWNER_VERDICT`: Phase 3 only; present concrete recorded exposure and proposed per-mechanism disposition for the owner's decision. Implementation agents do not fabricate rulings.
- `DIAGNOSIS_REQUEST`: explicit request/demonstrated failure only; route the narrow trigger and owner authorization. Never restart diagnosis automatically.

Operational runbooks require `--event start` before implementation, `accept` with ordinary acceptance recording and `closeout` before marking shipped in the owning phase README. The first relevant phase planner uses `configure-window`; the owner-verdict/diagnosis-request modes are invoked only for those actual requests. A pending Phase 3 verdict produces OWNER_VERDICT for its designated handoff or explicit owner event, **not for every unrelated implementer**; their event returns NONE unless a real invariant failure affects them. Automatic checks reject an accepted/shipped exposed slice missing its required row/transition, so lifecycle execution does not rely on someone remembering to read META later. `phase-close`, `track-complete` and `integration-accept` do not substitute for exposed-slice acceptance and return NONE for the cycle unless a separately authorized cycle event actually applies.

Give the migrated cycle document separate action headings `configure-window`, `open-window`, `record-exposure`, `close-window`, `owner-verdict` and `diagnosis-request`. CLI output links the **matching heading**, owning M contract proofs and the exact current phase/slice artifact. It must not emit the whole method/Phase0/Phase1 packet or all action headings. This is on-demand documentation routing, not a new skill or ambient META checklist.

Add tests/docs/architecture-cycle-lifecycle.test.ts to ARCH_FILES, reusing the same metadata parser/state transition functions. Assert: invalid empty ready/open window; start without authorization/gates; unknown/missing endpoints; >3 exposures; non-exposed slice opening/extending window; acceptance without required exposure; satisfied closure predicate but window/stage stale; premature closure when a declared exposure remains; premature STEADY without complete owner verdicts; closed windows still requiring P26/track closure; absent frozen P0/P1 evidence; normal STEADY close starting diagnosis. Each invalid condition gets a negative fixture/mutation. Positive controls cover parallel exposure completing before the nominal opener/terminal, plus unrelated T3 data and T4 envelope plans remaining eligible when their own gates pass.

Use a deterministic pure transition evaluator in the test helper to compute required next actions from cycle state, slice event and gate state. The CLI prints the required delta; the responsible agent writes authoritative documents/records as above. Tests and preflight remain read-only. The arch lane checks state consistency after those writes. No scheduled reminder, background agent, separate review diary, automatic owner approval or runtime state machine is introduced.

**WP4 acceptance evidence:** preserved Phase0/Phase1 blob/recovery manifest; initial-state migration result; fixture traces for configure/open/expose/terminal/owner-verdict/steady/failure paths; mutation showing omitted terminal-close and fake STEADY are rejected; negative controls proving unrelated work requires no META. Phase 3 outcomes are future evidence, not a condition for #115 acceptance.

## 8. Ordered executor work packages

Perform the following in one reviewed restructuring change set. Preserve a clean baseline/recovery point first. Independent work packages may be prepared separately, but no split merge may leave routers targeting nonexistent paths or capabilities appearing authorized.

| Package | Depends on | Concrete operations / output | Package acceptance |
| --- | --- | --- | --- |
| **WP0 — baseline and expanded disposition manifest** | Owner authorization for this plan | Confirm baseline ancestry/diff and clean-or-owned changes. Expand §4 into per-file actions/blob hashes in #115 acceptance.md; record source exclusions, prototype/recovery anchors, exact ledger/ratchet imports and unpromoted-obligation destinations. Record S0 review disposition of §2. | All 581 baseline docs files classified exactly once; protected files not in deletion set; no production mutation authorized; intervening deltas bounded. |
| **WP1 — surviving concern/evidence consolidation** | WP0 | Write the three track planning-evidence files with the specific §4.4 conclusions; extract missing landed nonvisual facts into existing component contracts; repair §2.3 contradictions and tech-debt routing. Fold proposal outcomes into their concern, not a chronological ledger. | No old minimum/sequence promoted; all unresolved obligations and debt survive with named owners; current source truth remains distinguishable from destination. |
| **WP2 — protected moves and subtraction** | WP0, required WP1 promotion before each deletion | Execute §4 exact prototype moves, selected technical archival moves and baseline deletion rules. Preserve P0/P1 original evidence and the original method per §7. No new live stubs. Keep the two runtime-independent P23B test inputs and two comparator JSONs unchanged. Fix mechanical protected QA launchers/links. | Per-file manifest and protected hash diff; full-body git recovery verified; surviving runnable/evidence bundles retain dependencies; old P24/25/26 trees absent. |
| **WP3 — hierarchy, convergence routes and gate enforcement** | WP1; target evidence locations from WP2 | Create four track roadmap READMEs/four runbooks, R115 phase README and global event-only operations README. Install Track → Phase → Slice conventions, canonical README status tables and scoped completion/replanning routes. Rewrite global/current/docs/AGENTS/F routing; seed unimplemented gates/no capability phases/plans; implement shared parser/CLI, docs/gate/hierarchy-route tests, ARCH_FILES membership and script. | Four independent phase-planning routes; README-owned lifecycle plus gate-owned readiness; explicit final-slice/phase/track/integration distinction and context-minimal event routes. No detailed capability plan or speculative integration program. |
| **WP4 — operating-cycle and focused closeout migration** | WP0; WP3 README/register parser and roots | Implement §7 state/protocol/action-specific routes and lifecycle tests; preserve historical diagnosis/installation evidence. Apply §6.3 focused slice/phase/checkpoint skill edits, shared late-trigger preservation reference and conditional runbook hooks. Initial stage remains PHASE_1; no window opened. | Recorded-evidence/owner-only closure/idempotence preserved; bounded slice window independent of phase/track closure; unrelated workflows load no META/track/program procedures. |
| **WP5 — cross-references, source-scope and regression verification** | WP1–WP4 integrated | Repair all retained incoming routes/anchors; update test doctrine/provenance and code README; semantic docs-walk coverage replaces arbitrary doc-count assertion only with equivalent nonvacuity proof; run §9 gates and inspect diff. | No broken live/evidence links, no checker exclusions added, no production behavior changed, test lanes remain disjoint/full. |
| **WP6 — acceptance, closeout and handoff** | WP5 passes; independent implementation review/acceptance | Finalize #115 acceptance/pruning/preservation records; run slice-closeout for R115.S01 with recorded evidence. Compact only with valid full-body recovery; mark that child shipped in R115 README and phase closable. Accept only the actual repository-readiness result; baton enables independent T1–T4 phase/slice planning and records R115 owner-close pending. Verify anchors after separately authorized merge. | No routine second review; no automatic R115 phase/track/program/cycle close. Further capability execution needs actual approved child scope/F gates. Owner-invoked R115 phase closure, if requested, is a separate focused workflow. |

This dependency order governs **the repository cutover packages**, not the capability tracks. WP3/WP4 tooling is test/workflow code allowed by #115; production implementations, codecs, API migrations and detailed capability designs are excluded.

## 9. Verification and acceptance contract

### 9.1 Focused inner-loop checks

Use existing test configuration/import rules. New repo-wide tests live under tests/docs and helpers, never production src. ARCH_FILES is an explicit list, so adding a file without lane registration is insufficient. Update any full/fast exclusions through the existing lane mechanism; keep lane union/disjointness tests green.

```sh
# From repository root; existing documentation gate during moves/writes
npm exec -w @portfolio/editor -- vitest run --config vitest.arch.config.ts tests/docs

# Proposed preflight installed by WP3; trusted base is the reviewed baseline/delta base
npm run verify:execution -w @portfolio/editor -- --base <trusted-commit> --slice R115.S01

# Scope and whitespace evidence
git diff --check
git diff --stat
git diff --name-status <trusted-commit>
```

The docs checker intersects its walk with git ls-files. New untracked files are otherwise invisible. The executor stages only authorized paths for review **or explicitly invokes the shared parser on new files** before claiming coverage; do not rely on an untracked scratch plan passing a repository walk. Staging is not a commit, and no commit is authorized here.

The existing “more than 100 Markdown files” assertion is an arbitrary tree-size pin. If pruning makes it false, replace it with semantic nonvacuity/coverage: router, AGENTS, both design contracts, every track roadmap/operations root, test README, local skill and protected prototype sentinel discovery, plus an empty-walk mutation that fails. Do not simply lower/remove the threshold or skip archives/prototypes differently to get green.

Required negative checks use in-memory/temp-tree fixtures; restore mutants and never mutate committed source for evidence:

1. Declared consumer with missing/ratified-only/shared-code-absent gate, wrong interface version, graph cycle, competing provider, unknown gate and self-satisfied gate each rejects.
2. Omitted mandatory gate/effect and changed production path outside R115 scope rejects. Equivalent planning-only registration remains allowed while implementation stays unauthorized.
3. T2/T3 UI needs viewport seam; T3 data does not need unrelated T1 depth/T2 components; T4 existing lowering needs its real F/domain gates, not completed T3. False track-level dependencies are rejected in seed/template policy and reviewed registration.
4. Camera authoring migration before T3 ownership cutover rejects; a provider interface acceptance is distinguishable from the T3 behavioral cutover.
5. Missing protected plans/full-body recovery, comparator, fixture ledger or ratchet rejects. Verify actual blob/anchor presence, not a directory count.
6. Cycle mutations/negative controls in §7.4 prove exact lifecycle routing and absence of P26/full-track closure dependency.
7. A broken moved relative link/image/section anchor fails; an empty docs walk fails; protected prototype/skill docs remain inside the walk. Retained archival records are opt-in history under the existing exclusion, not new checker blind spots.
8. A slice registered under two phases, dangling phase/child route, missing final-gate child, duplicate JSON lifecycle field, phase closed from final-child acceptance alone, track complete without its separate authorized objective evidence and product integration accepted from contributor phase closure each rejects. Positive controls allow concurrent phases within one track, exact cross-phase slice dependencies and accepted gates while their producer phase remains open.
9. Route fixtures cover ordinary slice close (one focused skill + preservation only at compaction), explicit phase close (its own skill, no track/program/cycle preload), track completion, product acceptance and bounded replanning (their exact event-only section). A forced ambient META/phase/program route fails. The emitted cycle action is specific; no matching event emits no cycle context. These assertions belong in the existing proposed parallel-track-gates test file, not another workflow framework.

### 9.2 Final repository gates

Before reporting the executed #115 change merge-ready, record:

```sh
npm run test:arch
npm test
npm run check
npm run build
git diff --check
```

These are the repository-level gates; docs-only scope does not narrow the unconditional arch lane. Run the whole heavy/perf lanes additionally **only if** gate/parser/test-lane changes affect those lanes or an unresolved regression demands them. No timing/baseline re-recording. If a moved path affects a recorder/fixture, repair the route and exercise its existing deterministic gate; prefer retaining those inputs unchanged as specified. API/runtime/deployment checks are not substitutes for these gates and are unnecessary absent changes to their code/config.

No broad prototype browser QA is required: behavior/assets are unchanged, and #114 explicitly prohibits unnecessary legacy full sweeps. Verify protected script source locators/dependency closure, docs links and retained evidence hashes; run a narrow non-browser path/dry-run check where a launcher changes. If a launcher unexpectedly needs browser execution to verify a mechanical repair, use browser-hygiene and the smallest owned session; do not expand into prototype redesign.

### 9.3 Final acceptance checklist

- Architectural S0 is reviewed with evidence and independent retain/refactor/replace/retire choices; every significant source group has a later retirement owner/proof. No production file implementing behavior changed.
- Deterministic expanded manifest explains every baseline docs file; obsolete duplicate/spec/plan/stub trees are removed rather than retained “for history.” Unique evidence and exact unresolved obligations survive at named homes.
- All protected accepted design/implementation/recovery/acceptance/QA records, scripts and capture assets survive. Prototype role labels cannot route superseded UX or mock schemas as production authority.
- P24/P25/P26 active sequence and folder routing are gone; T1–T4 each have both required READMEs and can start their own Phase → Slice planning immediately. Each future phase owns coherent scope/integration/final gate/closure; no additional general product/architecture reconciliation is required.
- F target shapes remain ratified/unimplemented until actual gates land. Exact first-consumer amendments have one authority; shared implemented interfaces and capability results are distinct.
- Registry/preflight enforce specific interface/slice gates, authorization provenance and source scope. Seed state contains no made-up accepted providers/capabilities. Current data does not become a mandatory historical compatibility API.
- Existing slice/phase workflows retain recorded-evidence checks, no routine second review, durable promotion/compaction, final-gate preservation, owner-only phase close and idempotence. The shared preservation reference loads at its actual trigger; neither skill contains track/program/replanning procedures. Event routes cover bounded convergence without treating T1–T4 as permanent product partitions.
- Global roadmap owns track state, track READMEs own phase state, phase READMEs own slice state/final gate/local closure, and the register owns only prerequisite/readiness state. Operational READMEs/global baton copy none of those statuses. Child acceptance never implies phase closure, track completion or product integration acceptance.
- WP4 preserves completed diagnosis/installation and installs conditional routing/state writers/tests. Window remains selected/not open; it ends on a bounded exact slice endpoint, Phase 3 requires owner verdict, STEADY causes no routine diagnosis.
- Live docs/HTML/QA routes resolve; required test gates and mutation/negative controls pass; existing geometry/Camera/history/isolation proofs and ledger/ratchet/comparator hashes remain intact.
- #115 closeout records acceptance, pruning totals, protected preservation, residual debt, verification and recoverable plan; its final child makes R115 closable only. Independent phase/slice work is available under real scope/F gates. Track completion/product integration/replanning have conditional owner/evidence routes, stable domain/gate identities and no permanent program-management framework.

## 10. Exclusions, risks and owner boundaries

**Excluded:** production code moves/deletion/rewrite; schemas/encodings/kernel implementation; detailed T1–T4 capability implementation plans; new prototype development; dependency upgrades, deployment, data conversion or deletion; release/source Baseline declaration; hosted performance/browser acceptance; automatic reviewer/diagnosis invocation; commits/push/merge without a separate user request.

| Risk | Required treatment / decision boundary |
| --- | --- |
| Aggressive pruning loses a decision or regression input | Baseline-specific manifest plus consolidation owner and protected hash/recovery checks before deletion. A newly found concrete obligation gets a narrow manifest amendment; do not restart broad reconciliation. |
| Shell replacement discards working domain behavior | Separate visual/host replacement from pure planners/evaluation. Future plans name semantic successor/call-site proofs and retire displaced code at acceptance. |
| Shared interface readiness becomes another waterfall or empty paperwork | Gate version/exact export/fixture/first consumer is the unit. No “T1 complete” dependency; first provider is a bounded real consumer obligation. Human reviewers still assess truthful semantic effect declarations. |
| Camera split/order/F.4 get separated, leaving dual writers | One T3 behavioral cutover gate; mandatory predecessor for T1 Camera authoring migration; isolated relic exception only. F interface availability is not that cutover's acceptance. |
| Documentation-only execution accidentally changes behavior | R115 allowlist/change check, preserved assets/JSON input hashes, full repository gates, inspected diff. Only mechanical QA locator changes are permitted outside prose/tooling. |
| Architecture-cycle remains stuck or becomes mandatory META for all work | Finite 1–3 registered exposures, exact terminal, conditional action code, state consistency tests and explicit owner Phase3 exit. Unrelated work continues; no routine ceremonies. |
| Release durability/creator trial data cannot be reset | T4/T3 cutover plans inspect actual supported data/promises and record bounded conversion/recovery obligations before code retirement. Unknown coverage is not a reason to retain every dev reader or invent a source-capsule bridge. |
| Old tests pin presentation/path shapes | Future capability slices use meaningful successor/mutation proof rather than weaken boundary coverage. #115 changes only routing/tooling tests; current architecture lane remains whole. |

Owner boundaries:

1. **Now:** review/approve this S0 disposition, pruning exceptions, track system and dedicated cycle migration before authorizing the executor. This plan proposes the replacement of the prior P26 validation-window policy; accepting #115 ratifies that bounded process change. No routine implementation-choice questions are outstanding for this planning task.
2. **At first relevant T1 phase plan:** normal scope approval names the finite window's actual registered opening/exposure/terminal child slices; an agent cannot mark the cycle ready from nonexistent plans. Increasing its bound/restarting diagnosis requires an explicit owner action.
3. **At exact F-interface design:** owner ratifies actual amendments. #115 accepts no invented interface encoding.
4. **At relevant capability slice:** decide the still-open Layout partition/non-enclosing-ring and overhead/datum/gap/ambiguous-inverse semantics where required. PLATE lists implementation/usability choices that are ordinary focused design, not unfinished prototype ratification gates. T2 still owes detailed 3D Scene authoring validation with T1 Stage integration; it is not a #115 blocker.
5. **At Phase 3 / Baselines / phase closure / bounded track completion / changed product objectives:** the applicable owner verdict/authorization remains explicit. Product integration follows its separately approved acceptance criteria. A green child or rewritten README never supplies a broader approval.

## 11. Plan-author stopping boundary and review handoff

The planning agent changes **only this file**. Branch/checkouts follow the owner's instructions; no restructuring, deletion, source/tooling implementation, acceptance of gates, closeout, commit or push is performed while producing this plan. The executor must receive later authorization against the independently reviewed plan.

The independent reviewer should test the disposition against the cited current seams, the completeness/nonoverlap of §4's ordered rules, source-vs-destination labeling, README-owned Track → Phase → Slice lifecycle, exact gate ordering, context-minimal closeout/convergence routes, protected prototype/Phase0/Phase1 evidence and the conditional state machine in §7. Review does not need to repeat architecture discovery. Corrections rewrite the owning section; Git/PR discussion holds deliberation.

**Planning validation:** source/static authority inspection completed at the baseline above. Plan-specific reference/heading validation and repository architecture-lane result are recorded below after writing; these validate this deliverable, not implementation acceptance of #115.

- Direct use of the existing documentation parser against this untracked plan: six current authority links resolve; no reference, heading or section-numbering findings. Proposed paths are explicitly target descriptions, not current links.
- Baseline manifest dry expansion: all 581 tracked docs files matched the ordered disposition rules; action totals are recorded in §4.1. No move/delete was executed.
- `npm run test:arch`: **24 files / 276 tests passed**, 2026-10-13. The tracked-tree walk excludes this untracked plan; its separate parser check above supplies that coverage.
- Final scope/whitespace check: only this new plan file is present as a workspace change; no tracked source/document mutation, staging, commit or push.
