# P24 R9 — minimum freeze and implementation gate

**Date:** 2026-09-10 · **Source baseline:** `bdd99bf5b88c65dcd9aa7a9a326279a3ddd81936`  
**Status:** planning freeze complete; implementation-ready briefs for owner review. No implementation authorized or accepted. P24 remains proposed and execution depends on the accepted P23 minimum. P23.1 and P23.2 are already shipped on `main` (PRs #9 / #13); P23.9 is the current P23 slice.  
**Parents:** [umbrella](../2026-09-08-P24-scene-staging-depth-umbrella.md), [P24A annex](../2026-09-08-P24A-asset-supply-canonical-ingest-annex.md), [R0–R8 sequence](../2026-09-09-P24-reconciliation-sequence.md).  
**Execution briefs:** [P24.0–P24.5](../slices/2026-09-10-P24-minimum-child-plans.md). These parent-derived IDs do not replace annex research stages P24A.0–A.6 or B0–B6.

This record supersedes the sequence's draft freeze packets and all earlier minimum-inclusion hypotheses. R3/R4 behavioral contracts and R5–R8 semantics remain binding for included capabilities. Closing a source recheck means identifying the actual integration and its owner; it does not mean implementing or passing that integration. The earlier wording requiring implementation checks “before freeze” is discharged here by the concrete source-to-change map below. Runtime proof remains a ship gate, avoiding a circular requirement to implement before writing plans.

## Frozen useful minimum

A creator can use a small approved library, place and revise furniture/primitives in Plan or 3D, group/duplicate/transform it, differentiate materials, author lights and one global environment, then Save/Load/Preview/Publish a durable scene. P25 waits for acceptance of that complete loop, not the tails below.

| Capability / current maturity | Final disposition | Minimum / owner |
|---|---|---|
| Canonical authoring | World codec exists; boot and writers still legacy-coupled | POLISH: canonical format before writes; P24.0 |
| Selection/hierarchy | Canonical reducer exists; Room-gated selection and missing wall-first rows | KEEP authority, POLISH Room-free reachability/primary/continuity; P24.0 |
| Placement | One pending pipeline; tagged floor support; no Plan creator | DEEPEN floor-supported model/primitive creation in both views; 3D lights; P24.2 |
| Plan representation | Existing asset footprints and identity-frame transforms | KEEP derived proxies; truthful ineligibility/mixed-selection refusal; P24.1/.2 |
| Cross-view lifecycle | Cancel primitives exist, transition wiring incomplete | POLISH cancel-before-switch and final preview equality; P24.0/.2 |
| Transform | One host; World-only policy, scalar persistence | KEEP Selection Center; POLISH primary-oriented Local/World, positive uniform scale, numeric/gizmo sync and truthful snap state; P24.2 |
| Duplicate/groups | Flat clusters and +0.5 X/Z duplicate exist; Room coupling/partial skips | KEEP flat groups and fixed offset/Y; POLISH atomic validation and partial-cluster warning; P24.0/.2 |
| Align/distribute, Active Object pivot | Absent ops / alternate pivot not wired | FOLLOW-UP, neither required for useful manual staging |
| Materials | Definitions/instances, five map slots, shared/unique exist | DEEPEN tint/reset, metric tile size where valid, approved maps, atomic selected-subset editing; P24.3 |
| Lights | Three types and shadow flag exist; unit/angle/feedback gaps | KEEP types, POLISH units, compatibility repair, selected helpers, Room-free creation; P24.2/.4 |
| Environment/preset | No authored environment; implicit baseline | DEEPEN one HDRI and ordinary-light Gallery reset together with codec/delivery/lifecycle; P24.4 |
| P24A supply | Normalization/proxy evidence, frozen corpus; execution incomplete | KEEP pipeline, DEEPEN 12-object proof + two material definitions (`polyhaven-white-plaster-02`, `ambientcg-plaster-001`) + one HDRI; P24.1 |
| Static delivery | Compatibility validates IDs; loader reads live catalogue | POLISH compatibility-authoritative loading/retention; P24.1 |
| History / visitor separation | Existing canonical authorities | KEEP; operation proofs in every child, integrated P24.5 |
| Presentation | Existing shell with misleading labels/disabled states | POLISH R8 correctness on included surfaces only; each child + P24.5 |
| Box select, visibility/lock, replacement, repeat/arrays, bulk transform numerics | Missing or shallow | FOLLOW-UP; no promotion from absence |

**Depth tails, never P25 prerequisites:** remaining 32-object Wave 1; dynamic/upload/provider GLB; more materials/HDRIs; wall/ceiling/object stacking; viewport drag-and-drop; align/distribute (R5 semantics retained for a future brief); alternate pivot; independent scale persistence; automatic packing/re-ground search; integrity dashboard; unrelated disabled-control cleanup; cosmetic redesign; exposure, range/cone drag handles, area/IES/temperature, probes/GI, compression/LOD/batching experiments and renderer upgrade. REJECT second selection/history/gizmo/geometry/navigation systems, persisted Three objects, nested rigs, and DCC graph/UV/mesh tooling for this minimum.

## Closed source rechecks → required changes

Paths are repository-relative locators, inspected at the baseline above.

| Evidence | Required integration / child ship gate |
|---|---|
| `packages/project-model/src/project-codec.ts:createEmptyProject` calls legacy empty Scene; `store/document-format-policy.svelte.ts` permits legacy mutation | P24.0 prepares canonical project Scene at boot/load/import boundary through existing compatible conversion. Never add roomless values inside legacy meaning or migrate midway through a transaction. Missing legacy frames fail closed; frozen relic stays on compatibility path. |
| `store/placement-cluster-mutator.svelte.ts` lines 117/215/262/363/486 and `editor-types.ts` Room-required selection | P24.0 canonical selection/cluster identity and format guard; P24.2 canonical creators, no `roomId` property even with undefined value. Legacy adapters remain explicit. |
| `unified-project-tree-model.ts:131` returns empty rooms for wall-first | P24.0 adds Scene entities and flat cluster rows to this same tree model, independent of Layout Room rows. |
| `layout-geometry-types.ts` has room-floor query polygons, compiled room floorElevation and compiled floor identity | P24.2 read-only floor resolver joins query source/room identity to compiled elevation; missing join rejects. Never use object-footprint polygons as floors. No new compiler or support persistence. |
| `WorkspaceRibbon.svelte` disables switches; `PlanWorkspace.svelte:cancelSceneGesture`, gizmo host `view-change`, pending state exist | P24.0 routes accepted shared Scene view transitions through existing cancel owners before `setView`, including non-ribbon callers. Hidden Plan cells stay mounted/inert; teardown is defensive only. |
| `scene-gizmo-adapter.svelte.ts` grounds at commit | P24.2 resolves support in the preview candidate and commits that validated candidate; late invalidity refuses/rolls back. |
| Both `museum/assets/AssetModel.svelte` copies use `getAsset().productionFile`; `shipped-static.ts` owns retained mapping | P24.1 supplies visitor-safe source authority to actual loading, not just validation; production output/old-release proof required. |

These source rechecks close R9 planning uncertainty. Their implementation gates are all OPEN; accepted P23 completion must recheck these locators for intervening changes before execution, without reopening ownership. P23.1 and P23.2 already shipped; P23.9 continues on `p23.9` and is the next P23 dependency for P24 execution readiness.

## Operation and history ownership

All authored operations below use existing Scene transaction/validation/history authorities. One logical commit = one `scene` entry; invalid/cancel/structural no-op = none; undo restores prior state and redo replays the committed IDs/result. No Layout write accompanies Scene work.

| Operation | Owner and inputs | Atomic result / special rule |
|---|---|---|
| Canonical boot/load/import | Existing project compatibility + document replacement boundary; project and trusted legacy frames | Baseline installation, history reset under existing load semantics; no synthetic user edit or mid-gesture conversion |
| Select / switch / arm / support choice | Existing selection, shell and pending-placement owners; IDs/view/asset/candidate | Session only, zero history; switch cancels first and preserves committed ordered IDs/primary |
| Place model/primitive/light | Placement mutator; asset/kind, world pose and transient resolved support | One entity, select its ID; no ghost/proxy/support record persisted |
| Gizmo/Plan/numeric transform | Scene adapter/Plan adapter/`commitPlacementTransform`; IDs, captured frame/pivot, owned components | One validated candidate; Plan owns X/Z/yaw only; uniform scale only for supported targets |
| Drop / Keep on Floor | Existing placement operation + shared compiled-floor resolver | Explicit Y ownership; rigid selection receives one common Y delta; if selected members cannot share a valid result, refuse all |
| Duplicate | `duplicateSelection`; ordered selected IDs | +0.5 world X/Z, preserve Y/material sharing; full clusters copied, partial members ungrouped with warning; no hidden move/ground entry |
| Group / ungroup / membership / delete | Existing placement-cluster mutator and integrity cleanup | Membership-only grouping preserves poses; deleting entities cleans references and selection using existing authority |
| Material assignment/patch/reset/unique | `material-resource-mutator` via existing edit-choice facade; target IDs/instance IDs/patch | Validate all; default clones once per selected subset of shared instance, explicit Edit Shared discloses outside users; cancelled choice none |
| Light property edit/angle repair | Existing light mutator; ID + validated patch | Direct stored units; explicit repair one entry, no load-time clamp |
| Environment edit | Scene semantic mutator; stable HDRI ID/intensity/rotation/background | One intent edit; loader/PMREM/cache events zero history |
| Gallery reset | Scene transaction; compiled-floor X/Z union midpoint + minimum participating floor elevation +3 m; preset constants (P24.4 formula), independent of selection | Replace all authored lights/environment after warning; reconcile removed IDs/cluster references, preserve non-lights; one exact undo/redo |
| Acquire/normalize/approve/retain | Supply pipeline and shipped compatibility registry | Outside editor history; approval atomic, no half-approved derivative or Scene acquisition state |

## Cross-view and delivery acceptance

These are required Museum fixtures, not claims of tests run. Use canonical wall-first projects with roomless entities; retain explicit legacy and frozen-route regressions.

| ID | Exact required result / responsible child |
|---|---|
| F1 | Place same normalized floor model from Plan and 3D with same X/Z/yaw/support: same physical pose. Move/yaw an existing tilted/scaled model in Plan: same ID, Y/pitch/roll/scale unchanged; P24.2 |
| F2 | Light selected in 3D/tree survives Plan switch with ordered selection/primary intact, no Plan handles, readable reason. Mixed eligible/ineligible selection refuses whole manipulation; P24.0/.2 |
| F3 | Armed placement, Plan drag and 3D drag each cancel before accepted view switch; exact baseline, no history, late mouse-up cannot commit. Repeat switch/unmount safely; P24.0/.2 |
| F4–F6 | Ghost/helpers absent from serialization; final preview equals commit (pose tolerance 1e-6 world units/radians); one drag one entry, invalid/no-op/cancel none, exact undo/redo; P24.2 |
| F7 | Duplicate full/partial clusters, missing target and overlap: deterministic offset/sharing; partial warning; invalid batch unchanged. Group/ungroup roomless entities preserves poses; P24.0/.2 |
| F8 | Tint/reset/maps/tile scale and selected-subset/shared/unique edits round-trip; unselected references protected by default; unsupported targets/cancel/failure no partial writes; P24.3 |
| F9 | Spot 30°/90° accepted, zero/nonfinite/>90° new edits refused; legacy >90° preserved with diagnostic and explicit undoable repair; new Publish blocked until repaired. Finite/unlimited helpers and -Z aim truthful; P24.4 |
| F10 | All 12 static models, two supplied materials, HDRI/lights: Save→Load, unsaved Preview, Publish→anonymous cold load match canonical meaning with empty caches. Remove/change live catalogue URL in fixture: publication still uses retained compatibility source. Asset missing/failure visible, never silently accepted; P24.1/.3/.4/.5 |
| F11 | Gallery apply→edit/add/group lights→Save/Load→reset: warns about ALL lights/environment, replaces atomically; cancel/failure unchanged, undo exact prior state, redo same IDs, non-lights preserved; P24.4 |
| F12 | No floor refuses; one floor resolves elevation/contact; stacked different elevations demand choice; equivalent coincident surfaces deduplicate within 1e-6 m. Layout byte-identical throughout; P24.2 |
| F13 | Locked renderer baseline passes compatibility, appearance, loading, lifetime and visitor gates below; P24.5 |

R8 correctness is attached to these fixtures: both themes, readable units/frame/primary/snap state, visible keyboard focus and accessible names, reasons available without hover, no canonical Room-ownership labels. This is not a whole-editor visual redesign gate.

## Renderer and final ship gate

Retain lockfile **Three 0.175.0, @types/three 0.175.0, @threlte/core 8.5.16, @threlte/extras 9.21.0**. Preserve WebGL, system AgX/sRGB/exposure and current scoped/refcounted disposal. No r186 adoption, recursive `Object3D.dispose()` migration or new decoder is implied. Any later baseline change is a separately scoped comparison including PCFSoft/PCF, BRDF/PMREM and the post-r186 point-shadow disposal fix on the exact candidate.

**Fixed regression reference:** commit `bdd99bf5b88c65dcd9aa7a9a326279a3ddd81936` (R9 source baseline), compared with the exact P24.5 candidate commit. Fixture `P24-common-v1` is the byte-identical `apps/editor/src/lib/content/chopin-project.json` from that reference, opened through the ordinary compatible project/Preview/cold-publication paths on both builds, not the frozen relic route. Retain the reference's static assets/materials and implicit lighting; no P24-only IDs, overrides or authored environment are added. This is the common subset both commits support. Record fixture SHA-256, both commit hashes, resource manifest, identical harness revision, camera pose and viewport/device-pixel ratio. The measurement harness may be added at acceptance time but must run unchanged on both builds and must not backport product features. If the reference cannot execute or required assets cannot be resolved, the regression gate is blocked; a different reference requires an explicit recorded amendment.

Use the same named device/browser/GPU, renderer settings, network throttling and production-build serving topology. Run three warmed 30-second stationary-camera frame samples after resources settle and three separate cold loads with browser/resource caches cleared. Compare median frame time and median navigation-to-first-complete-authored-frame cold-load time per corresponding runtime path; each must be no more than 10% worse than the reference. Record absolute timings and asset bytes as well. Freeze camera/settings in the shared harness before either build is measured; changing them requires rerunning both. Any excess needs correction or explicit reviewed budget adjustment, never an invented pass.

**Full P24 fixture:** the 12 models, new materials and authored HDRI/lights have no pre-feature equivalent. Report their absolute frame/cold-load/resource results separately; do not apply the common-subset percentage to them or call their first run a regression baseline. They still must pass all functional, visual and lifetime gates. Twenty project/environment mount/switch/delete cycles must return owned renderer resources to the warmed stable count after release; no monotonic growth, stale async attachment or disposed-resource reuse. Verify context loss/recovery and failed/retried model/map/HDR loads. This document claims no measured performance.

The combined minimum ships only when P24.0–.5 gates pass, focused tests plus full editor tests/package checks/both-app checks/builds pass, hosted anonymous cold delivery and retained prior-release assets pass, and visitor bundles contain no editor helpers/stores. `/museum` and `/museum/editor` remain frozen. P25 then clears its P24 dependency only; its own E5/E6 and other tracker gates remain intact.

**Planning verification:** current source/lockfile inspection, local Markdown-link checks and `git diff --check`; no implementation, acquisition, runtime tests or visual acceptance performed. Owner review can assess the concrete freeze and child briefs; execution remains stopped.
