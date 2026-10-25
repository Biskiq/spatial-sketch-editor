# S06 proposal — identify the world-scale execution architecture

**Status: proposed; owner review required before activation.** This is research and a requested
measurement-scope amendment, not released implementation. It accompanies the
[world-scale computational architecture][synthesis]. The [approved S06 plan][plan] and accepted
[performance contract][performance] remain in force unless the owner explicitly approves a change.
This PR contains documentation only; it has run no benchmark, smoke test or prototype.

## Decision recommended before Bench 1

**Approve a bounded architecture-identification foundation, then freeze it before Bench 1.**
The three passes should identify and test mechanisms capable of making 10,000+ Rooms,
100,000+ architectural entities and millions of repeated details routine. A profile of only the
current implementation at S/M/L cannot distinguish CPU ownership, semantic recomputation,
submission and screen-detail limits when they all grow together.

Retain E1–E5, H1–H9, I1–I6, every required S/M/L row, existing exactness and identity semantics,
the old/new-method comparison and the **same three owner-run passes**. Add diagnostic contrasts,
sufficient statistics and a disposable execution-plan laboratory. These are report-only
experiments with explicit correctness/evidence labels, not new workload tiers or acceptance gates.
A laboratory result is not a product pass or authorization to replace the renderer.

This requires a deliberate preparation decision; it is stronger than “record another view if the
current script permits it.” Review it now while Bench 1 has not started. If the owner retains the
original design, record the untested architectural questions before spending the pass. Do not
quietly claim that existing optional views or a count-only model answer them.

## Authorization changes requested

| Requested authorization | Concrete work permitted if approved | Boundary retained |
| --- | --- | --- |
| Measurement foundation | Extend harness-flag attribution with the fields below, count-only demand/ownership models and report-only diagnostic contrasts | No production optimization, new feature, timing gate, format change or benchmark pass; T3 reviews shared marks/harness and correlation |
| Scale fixture preparation | Generate a bounded physical source family toward 10,000 Rooms and 100,000 distinct architectural entities; census logical repetitions toward millions | Exact entity definitions and actual counts recorded; full canonical admission/compiler remains authority; physical and modeled counts never conflated |
| Fixture assembly exception, only if needed | Assemble copies of public-planner-built components with deterministic ID remapping, transforms and reference repair, then validate/compile the complete current-format source | Explicit narrow amendment to S06 A.1's per-operation planner construction requirement; no alternate geometry engine, new authored format or second admission path; fixtures are disposable inputs |
| Disposable execution-plan lab | Compare retained Plan vectors, compatible shared 3D pages/instances and bounded demand/frontier policies on common compiled inputs; register WebGPU as a candidate where justified | Harness-only, separate from shipped product/visitor chunks; no unreviewed package admission, new native toolchain or implementation shipped under this proposal |
| Pass payload/method amendment | Predeclare additional diagnostic windows, order, repetitions, limits, wall-time estimate and pass-accounting rules | Owner explicitly ratifies changes beyond S06 A.9; required windows, cache states, thermal hygiene and accepted results remain unchanged |

Recommend approving the measurement foundation and scale/fixture preparation together. Approve
a narrowly specified lab plan before its code is written: the first candidates should be retained
Plan vectors and compatible page/instance submission, followed by a hierarchy/working-set model.
WebGPU/virtual geometry is a competing execution plan, not a prerequisite to Bench 1 or a blanket
renderer migration. Request any broader lab separately with its expected pass cost.

Future production changes have **no authorization here**. Entity-level source/history sharing,
a different content identity, Plan-cut rendering, batching/material sharing, procedural authored
patterns, HLOD, compressed textures, streaming, changed shadow coverage and release lowering
remain explicit T1/T2/T3/T4 owner proposals. Research ambitions do not amend F.1–F.5 by implication.

## Evidence classes and scale preparation

Every artifact declares one of these classes before presenting a number:

| Class | Meaning | Permitted conclusion |
| --- | --- | --- |
| Physical product | Canonical source loaded through the real product path; actual browser frames and edits | Product cost at exactly that source, view, cache state and revision, with existing correlation limitations |
| Physical laboratory | Common canonical compiled input lowered by an isolated candidate execution plan | Cost/correctness of that execution plan; no claim that product admission/history/digest or visual features have been solved |
| Logical census/model | Repeated component/definition descriptors, dependency/ownership graphs, projected-error frontiers and arithmetic | Operation/byte counts and a conditional prediction; not measured latency, actual admission or a rendered million-instance result |

Physical architecture should include both a regular all-visible Plan and irregular connected
wings/buildings: hosted Openings, shared Junctions, corridors, a large face and varied boundary
degree. A forest of disconnected identical Rooms alone would manufacture locality. Reuse approved
S/M/L/XL and museum inputs where they answer the question. Supplemental scale points should aim
at approximately 1,000, 10,000 and 100,000 architectural records, with actual Room/Wall/Junction/
Opening counts and bytes reported separately. These are experimental axis points, not new tiers.
One physical target should combine 10,000+ Rooms and 100,000+ architectural entities; a census
must verify the totals and avoid counting the same subject twice through multiple views.

Generation is precomputed and digest-keyed, outside measured windows. The setup handover declares
a time/memory bound for physical generation and admission. If the current path cannot reach a
point within that bound, record the exact failed phase, last completed physical size and
lower-bound/unsupported conclusion; do not hang the reference machine, spend another pass or
replace that result with model timing. The assembly exception above is a proposed way to remove
an accidental generator bottleneck while keeping the canonical compiler and validation intact.

Repetition is a separate axis: around 2,000, 20,000, 200,000 and 2 million logical details with a
fixed definition set, plus an increased-definition and sparse-override control. Current product
placements, lab instance records and future procedural patches are different physical encodings.
A procedural descriptor is not a source-format capability already shipped in Biskiq. A large
current-product run stops at its declared feasible allocation bound; a compact lab/census can
explore the intended representation beyond it without mislabeling physical coverage.

## Orthogonal experiment matrix

Freeze the contrasts and which are physical versus modeled before Bench 1. Do not execute the
Cartesian product of world size, view, material count, input rate and cache state. Use matched
pairs and a small number of growth points; expand the inexpensive deterministic censuses rather
than multiplying browser passes. Each added timing condition has a quoted cost in the handover.

| Contrast | Hold fixed | Change | Readout and prediction | Relation to approved S06 |
| --- | --- | --- | --- | --- |
| Semantic size versus affected work | Same edit class, local neighborhood, result and view | Unrelated N, including a connected variant; also vary k at fixed N as a negative control | Changed/evaluated set, query visits, topology work, global bytes; e stays near the dependency closure while index visits may grow logarithmically; genuine large-k edits grow | Keep E1/E5 definitions and their image proof; add supplemental axis/attribution records, not a replacement E5 |
| All-visible Plan versus representation | Source, exact compiled fragments, pose, style and selection | Per-fragment ownership versus retained batches; then projected density/resolution and edit locality | CPU ownership/submission, GPU draws/triangles, projected coverage, uploads, frame/presentation; simple Plan should need few compatible bins | Adds diagnostic lowering/profile beyond H4/H6; product Plan still has its current 3D drawing semantics |
| All-visible 3D versus submission/detail | Same source/material output and exposure | Per-entity versus page/instance submission; separately change projected scale and finest versus hierarchical detail | Actual driver calls, frontier/candidates, triangles, material/shadow passes, GPU time, images; distinguish submission-bound from detail-bound | H6 remains a measured finding/owner follow-on; no batching lands in the product from this row |
| Repetition versus uniqueness | Projected contribution and semantic neighborhood | Logical copies, definition count, material variants, patterns and override fraction | Unique allocations, definition evaluations, expanded instances, candidates and bins; unchanged screen demand must not force a full logical-copy scan | Extends E3's interpretation and a lab comparison, not its required census definition |
| Working set versus accumulated world | Fixed navigation sequence and quality/capacity policy | Total world bytes, warm/cold state, reversal and resource turnover | Peak CPU/GPU/staging bytes, requests, evictions/refetch, refinement completion, dirty ancestors and resident coverage | E4 remains the interior texture census; new hierarchy/working-set evidence is explicitly supplemental |
| Causal pipeline versus queued throughput | Same accepted baseline and real input sequence | Controlled input cadence, candidate execution plan, source versus Camera movement | Input age, e per presented result, cancelled/wasted work, install/render/present identity and synchronization stalls | Keeps F3 correlation rules and the owner's H0 ruling; neither an SVG mark nor rAF interval becomes mesh-presentation proof |

For Plan and 3D, “all-visible” distinguishes full footprint, eligible sources, projected frontier,
actually exposed surfaces and displayed detail. Record occlusion, fog, ceilings and shadow-camera
coverage. A partly hidden product view remains useful evidence of current behavior, but does not
answer the exposed-surface question. The lab may use a clearly labeled controlled exposure/profile
without those confounders; it does not claim to be the shipped cutaway UI or a new product feature.

Do not secretly make rendering cheaper by dropping material, shadow or transparency features.
Equal-output submission comparisons use the same compiled geometry, shaders, lights, Camera and
presentation. A proposed Plan renderer or approximate HLOD has different output semantics: measure
its declared error/coverage and exact source correspondence separately and request the presentation
policy before any product adoption. S06's landed optimizations still approximate nothing.

## Sufficient statistics to establish before Bench 1

The purpose is to estimate the alternative execution plans from actual work, not only fit a curve
through total time. Counts must be attributed once, with thread, phase, input/result sequence and
cache-fill identity. This is a **proposed extension** to existing S06 C instrumentation.

- **Semantic/proof work:** changed entities k, evaluated entities e, distinct query keys, reads,
  dirty/unchanged outputs, index node and candidate visits, negative-query invalidations, exact
  predicate fallbacks, affected topology zone/face size and full-fallback reason. Separate field,
  entity and whole-unit work. An E1 full-output diff is a lower bound on required evaluation.
- **Ownership:** unique backing buffers/pages, shared references, copied/frozen/serialized/hashed
  bytes, retained history pages, compiled and renderer mirrors, material instances, disposal and
  peak replacement overlap. Separate imported shared textures from cloned material objects.
- **Representation/submission:** rebuilt and patched ranges/bytes, visited objects/instances,
  source/geometry dictionary cardinality, compatible bins, actual draw API path/extension support,
  main and shadow submissions, triangles and projected detail/error. Mesh count is not draw count.
- **Demand/residency:** frontier and candidate count, hierarchy/path repair, requested/resident/
  decoded/uploaded/evicted bytes and queue occupancy, pin/refcount ownership, coarse fallback,
  unmet demand and return/refetch work. A theoretical visibility set is not resident-byte evidence.
- **Causality:** handler/queue, planner, validation, capture/digest, install, upload, render and
  presentation windows; active/pending/cancelled work and synchronization stalls. Keep every
  presented/superseded/refused/unresolved input. Unsupported GPU timer or presentation evidence is
  null with a reason, never zero or an inferred pass.

Use aggregated counters and bounded sampled traces rather than a permanent per-entity event log.
Report instrumentation overhead with an explicitly labeled paired diagnostic where feasible;
do not subtract an assumed overhead to rescue a budget miss. Record renderer counter reset/pass
boundaries and avoid counting total draws plus their shadow subset twice. `renderer.info.memory`
is a resource count; GPU bytes are allocation estimates with declared coverage, not exact VRAM.

**Coefficient identification.** For each stage, write a model such as fixed overhead plus
cost-per-evaluation, query-node visit, copied byte, submitted bin, selected triangle or shaded
sample. Fit only terms the matched contrasts can identify; report residuals and saturation. Use
Bench 1 stage shares and deterministic count ratios to predict candidate totals and uncertainty
before Bench 2. Extrapolation across memory, shader or cache regime changes stays a hypothesis.
Count-only work reductions do not become timed wins automatically.

## Execution-plan laboratory and correctness

The lab receives the same canonical compiled inputs and Camera matrices as its reference. It
owns no architectural topology or alternative navigation authority. Reference and candidate
share geometry realization/math wherever exactness is being compared. Candidates are removable,
disposable and excluded from product bundles. Shared instrumentation/fixtures remain serialized
with a named writer, patch base and T3 reviewer in the setup agent's own baton.

The minimum useful candidates are:

1. **Exact dense-vector ownership/submission:** per-fragment records versus retained packed ranges
   for the same Plan primitives, fills and style. Test static, pan/zoom, local edit and Undo, not
   only a static draw microbenchmark. Compare direct batches with tile-cache overhead before
   choosing a more complex vector renderer.
2. **Exact shared 3D pages/instances:** per-entity compatible draws versus packed or instanced
   data at a fixed exposed view, with current material groups preserved. Compare CPU preparation
   and GPU submissions separately. Native multi-draw assumptions are forbidden in a browser test.
3. **Hierarchy/demand and editable replacement:** a deterministic frontier/page-access model,
   then a physical render subset where authorized. Exercise one dirty leaf, a chunk-boundary edit,
   definition change, view reversal and cold demand. Verify that stale parents cannot display the
   replaced Wall and that unchanged siblings remain coarse. A model-only result cannot prove
   frame time, driver memory, crack-free output or refinement latency.

Before interpreting timings, exact candidates need full compiler equality/correspondence,
reference/candidate buffer and appropriate framebuffer differentials, and deterministic lifecycle/
Undo/replacement controls. Any approximate candidate must state its proposed error and feature
coverage separately; it is not an I5 equal-output optimization or shipped S06 behavior. Current
hit policies, snap/measurement geometry and source IDs remain exact. This paragraph proposes
future verification work; this documentation PR runs only documentation tests.

Do not turn the lab into a competing production engine. If a candidate requires a new renderer,
language toolchain, authored format or semantics beyond the approved lab description, stop that
candidate and request a separate owner scope. Retain its analytical result and failure rather
than quietly broadening S06.

## Three passes, each with a distinct decision

No agent-run browser performance loop is added. Between passes, use the existing count/differential
oracles and analytical predictions; any new probe permission must be explicit. Required product
rows retain the contract's cache states, >=10 measured runs, frame/input sample floors, source
correlation, peak-first order, cooldowns, power/load checks and lock. Supplemental timing
comparisons also retain >=10 measured runs and the applicable frame/input sample floors, with
their cache/variant definition stated; shorter capacity/census checks are labeled counts or
feasibility, never latency comparisons. No diagnostic or lab row replaces a required row or
excuses its miss.

| Pass | Required product evidence, preserved | Proposed architecture decision payload |
| --- | --- | --- |
| Bench 1 — identify | Original baseline and old/new F2 method validation, all existing S06 rows and traces | Complete sufficient statistics; sparse physical diagnostic contrasts and their exact/model/unsupported coverage. Register candidate mechanisms and numerical predictions. Baseline both sides of a comparison where the lab is ready; otherwise explicitly label the missing side |
| Bench 2 — discriminate | Original optimized revision, predicted versus observed stage/flow outcomes and existing library cutoff | Paired exact lab/reference execution plans on common inputs where authorized; validate count ratios, CPU/GPU critical paths, edit invalidation and working-set behavior. Reject mechanisms that save counters but not the target stage, or fail exactness/quality |
| Bench 3 — confirm | Original final acceptance revision and hard rows, with misses dispositioned through the owner | Repeat the frozen selected diagnostic contrasts and coverage. Report which architectural predictions survived; retain unsuccessful/unsupported mechanisms and residual costs. A lab result remains separate from product acceptance |

The frozen payload states commands, workload digests, variant order, exact optional/diagnostic
windows, generator/admission runtime bounds, per-condition sample counts, added setup/measurement
wall time and thermal/cache isolation. Pair order should control warm-cache/order effects in lab
windows without changing required product run order. Checkpoint dependencies and resources are
prepared before timed windows; shader compilation/cold import remains measured where the flow
is specifically about first use. Reuse inputs/Undo safely, retaining distinct edit inputs so
revision caches do not turn the experiment into repeated no-op hits.

If a large physical point is infeasible, the same invocation records that bounded failure and
continues only where lifecycle/machine state is valid. A context crash/OOM or thermal/load
contamination follows existing S06 owner pass-accounting rules; it is not silently recovered as
a clean sample or rerun. Apply no automatic fourth pass. Missing fields, late candidates and
incompatible traces remain unmeasured with a stated decision limit.

## Integration judgment and owner handoff

The research and this **pending** proposal can integrate as documentation before Bench 1.
Activating the stronger method is **not covered by the current release merely because it is
report-only**. Recommend owner approval of the bounded foundation before the setup handover
freezes Bench 1. If it changes preparation time, make that tradeoff explicitly; do not smuggle
new work into the active agent's queue or interrupt its checkout. This PR does neither.

The setup agent, after an owner decision, reconciles:

- Its current source revision and instrumentation against this published-base analysis; actual
  setup progress may already answer part of the inventory. Preserve its approved E/H work.
- The exact scope ruling, fixture-composition exception if needed, lab candidates, shared writer/
  reviewer and agreed preparation/pass wall time. A source-valid world, a lab buffer and a logical
  descriptor must have separate report identities.
- Correlation and the unresolved owner-held H0 ruling, actual rendered geometry identity,
  counters/reset boundaries, current fog/ceiling/shadow coverage and consistent view controls.
- Required versus diagnostic windows, cache/Undo/resource isolation, physical infeasibility
  bounds and pass contamination handling. No gate/budget waiver follows from these experiments.

Defer production compiler data-model expansion, digest/schema changes, new Plan/cutaway features,
material/instance migration, GPU-driven backends, HLOD, town streaming and lighting infrastructure
to explicit implementation authorization with owners and correctness contracts. The output of
S06 should be an evidence-based execution-architecture decision, including rejected alternatives
and remaining format barriers, rather than a new workload number with unexplained frame time.

[synthesis]: ../../../../../broad-research/all-visible-editing-and-town-overview.md
[plan]: ./implementation-plan.md
[performance]: ../../../../reference/components/performance.md
