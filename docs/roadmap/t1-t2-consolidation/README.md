# T1/T2 — Architecture and performance consolidation

**Status:** owner-approved Tier 2 execution plan (2026-11-13). No production remediation is part of this planning PR. The owner authorises the milestone and its bounded D1 measurements; implementation groups E0–E12 and X1–X8 still require individual claims, applicable reviews and verification before merge. **Base:** `main` at `afca870f` (PR #314 merged). **Tier:** 2 for the plan (it
proposes enforcement of hard rules and edits to reference contracts); each slice carries its own
tier in [`slices.md`](./slices.md).

**Claim discipline:** check live issues and pull requests before and immediately after every E/X claim; this planning PR is not a claim for any implementation group. Draft #291 (`T2.S0`, Gate A) remains an external prerequisite for E6; issue #273's bounded performance-flow repair belongs to E0.

## Goal

Before geometry and rendering are expanded further, bring the code back inside its documented
invariants and give the **Scene → derived geometry → render resources → renderer** pipeline one
owner per stage. Three deliverables, planned together because they touch the same seams:

1. **Invariant remediation** — the places where the code departs from the hard rules and reference
   contracts, each with a check that keeps it from recurring.
2. **The T1/T2 joint renderer refactor** — describe once, share resources by key, retain
   representations, own render identity; WebGL stays production, the result stays WebGPU-portable.
3. **T1 geometry and editing-path optimisation** — remove work that is repeated per frame or per
   accept without need.

Not in scope: new product features, kernel replacement, a WebGPU migration, speculative rewrites.

## Documents

| Document | Holds |
| --- | --- |
| [`audit.md`](./audit.md) | Evidence: findings against the invariants, the pipeline as built, the cost model with every figure labelled measured, counted, estimate or unknown |
| [`renderer-refactor.md`](./renderer-refactor.md) | Design of the renderer refactor: layers, ownership, keys, the one material factory, identity, instancing, portability rules |
| [`slices.md`](./slices.md) | Implementation-ready slices: touchpoints, dependencies, measure-first step, tests, acceptance, rollback, lanes |
| [`execution-schedule.md`](./execution-schedule.md) | Additive execution packaging: complete slice coverage, PR packets, dependencies, file reservations, gates and rollback boundaries |
| [`decomposition.md`](./decomposition.md) | Additive God-file inventory and extraction contracts: route, facade, adapters, lifecycle/parity and executable ownership guards |

## Headline findings

| Finding | Effect | Slice |
| --- | --- | --- |
| The Stage renders a full frame every display frame at rest (PF-1) | ≈60,000 draw calls per second at grid L with nothing changing; S06's "stop drawing at rest" regressed and only a source-shape test guards it | I1 |
| A live Layout candidate recompiles and redraws the whole project every frame (PF-2) | W wall compiles per tick, pointer moving or not | I2, G1 |
| Every accepted edit re-resolves the whole Scene and reruns Scene-keyed render work (PF-3, PF-4) | a Wall or Camera edit churns materials, textures and shadows | G2 |
| Rooms are still mounted per entity through Svelte with three materials each (RR-1) | ≈2,000 components and 588 materials at L; the likely main term in the 4.8 s open render gap | R3 |
| World materials are built at twelve sites; geometry and materials are per entity (AR-6, RR-3 to RR-9) | no sharing, no instancing, T2's one-factory rule unmet | R2, R4, R5 |
| The runtime re-merges Camera into Scene; a Room frame and a second wall path survive (AR-1 to AR-3) | hard rule 2 holds in authored data, not at runtime | I3, I4 |
| Compiled-geometry caching has five owners (AR-4) | repeated compiles; a session outliving its project | I2 |

## Benchmark policy

Planning ran no benchmark; every number in the audit is a record, a count from code or a labelled
hand estimate. Execution follows [`slices.md`](./slices.md) section 1.1: measure inside the slice
before changing anything, apply the optimisation only if the measurement supports the hypothesis,
measure again afterwards. Counts are the instrument and the acceptance line; durations are evidence.

## Execution shape

**Execution addendum:** use [`execution-schedule.md`](./execution-schedule.md) for PR grouping and
ordering, including the new [`decomposition.md`](./decomposition.md) work. It consolidates the
existing specifications into 13 PR groups and adds eight bounded extraction groups. The original
slice algorithms, conditions, tests and owner decisions remain authoritative; the paragraph below
records the original packaging, not the current execution schedule.

Seventeen slices in four file-disjoint lanes after one baseline slice (C0). Lanes can run as
parallel sessions; order inside a lane is fixed. If the milestone is cut short, the value order is
I1, G2, I2 + G1, R1, R2a, R3. R7 (instancing and batching) is gated and expected to be abandoned
unless measurement shows the frame is draw-bound.

## Owner-approved decisions D1–D5 (2026-11-13)

The owner approves the recommendations below as the execution policy for this milestone. These decisions replace the undecided defaults from the planning draft. They authorise the plan and the bounded measurements, **not a blanket merge or implementation waiver**: claim each E/X packet separately and respect its tests, rollback, Tier 2 gates and external prerequisites. No code optimisation is deemed measured or accepted by this approval.

### D1 — Measurement authority: approved, bounded

This owner approval initiates the milestone-specific performance investigation under [performance.md](../../reference/components/performance.md). Deterministic work counts and mounted-call-site characterisations are permitted inside each relevant packet without repeat approval. Authorise exactly **two** `npm run perf:spot` executions: **E0/C0 baseline** and **integrated milestone end**. A slice may run **one named, targeted trace** where its specification needs attribution; record the flow, provenance and observed values. No full perf battery, stress matrix, automatic retry, or per-slice wall-clock certification. Measurements absent from the evidence stay **unmeasured**. E0 owns the bounded repair of issue [#273](https://github.com/Biskiq/spatial-sketch-editor/issues/273) so the approved spot workflow targets the actual UI; do not silently expand the benchmark scope.

### D2 — Visitor free look: explicit temporary exception

Accept **AR-7** as a named, temporary exception: the neutral visitor's `OrbitControls` currently drives free-look pose outside Camera. This does **not** create a second authored Camera, approve a new authority, or claim general hard-rule compliance. Leave free-look migration outside T1/T2; T3 owns its eventual reconciliation. Existing visitor navigation behavior must not regress, and T3's work must include a targeted regression/authority test before the exception is retired. Keep AR-7 visible in the audit until then.

### D3 — Candidate preview contract: approved target for E4/G1

Use the **single canonical Layout compiler** through the **project-scoped session**. For each **distinct candidate**, compile and build its Paper result once; reuse the unchanged result across refreshes and idle frames, never recompiling because an rAF tick occurred. Preserve the planner's candidate/release correspondence and refusal semantics. The references describe this as a **target**, not already-shipped behavior; E4/G1 implements and proves it and reconciles any remaining reference wording with the shipped path. No second preview evaluator or duplicate compiler is admitted.

### D4 — T2 pipeline and light-retirement prerequisites: approved order

Merge the applicable T2.S0 Gate A record in [PR #291](https://github.com/Biskiq/spatial-sketch-editor/pull/291) **before E6/R2a** adopts material pipeline values. Do not treat a draft Gate A as landed. **Directional retirement** is a separate T2 product slice that must land **before E10/R6**; E10 does not perform that retirement and must wait if it is unresolved. Other independent E/X packets may proceed while these prerequisites are pending.

### D5 — Priority: T1/T2 milestone active

Advance [focus.md](../../../focus.md) to **T1/T2 consolidation (#317)**. PR #259's harness cutover is already merged; its old focus line is stale. After this planning PR merges, begin **E0 alone** to establish names, fixtures, baseline counts and the bounded D1 checkpoint. Then allow disjoint implementation packets under the [execution schedule](./execution-schedule.md), normally at most **two local coding agents** and **one shared heavy verification/benchmark slot** to avoid CPU contention. Schedule by file ownership and landed interfaces, not by fixed wave barriers or PR quotas. The owner initiates agents by prompt; this approval does not launch them.
