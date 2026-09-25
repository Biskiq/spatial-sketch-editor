# P23B — Geometry Performance & Stabilization

**Phase goal:** keep the shipped wall-first geometry pipeline fluid as curved and multi-room
architecture grows, and make that speed reproducible and regression-guarded. Cost, not
capability: one `LayoutDocument` → one canonical compiler → Plan/3D/visitor is preserved, and
no new capability, view, document, schema or persisted format is introduced.

**Phase invariants:** one geometry compiler and one compiled geometry truth; equivalence over
approximation for every cache/reuse/early-out; Plan/3D/visitor parity is correctness; visitor
isolation and the landed reference contracts unchanged.

```text
STATUS: planning
STAGE: the umbrella and owner-ratified post-P23 sequence are landed. SEQUENCE steps 1–3 completed
2026-09-22. Step 4 (P23B.0) completed its two read-only profiling passes; their reports are archived
verbatim. Step 10 (P23B.0-durable) SHIPPED 2026-09-25: fixtures, control matrix, provenance-backed
baseline and budgets delivered; the accepted partial baseline and closed stubs are routed below.
Step 5 (P23B.1) executed its harvest; the harvest record awaits its own review. Step 6
(P23B.2) is satisfied as to artifact; its verbatim report awaits its own evidence review. Step 7 (P23B.3)
was ratified by the owner on 2026-09-22 at `e139a18b`, including the implementation plan, performance
acceptance criteria and curved-crossing/Option E rulings. Step 8's ratification gate is satisfied.
P23B.3a, the owner-authorized topology-policy slice at sequence step 9, was accepted and shipped on
2026-09-24 after S1–S8 and OR-D12-1…6 passed. S5/S6 re-reviews are complete by owner confirmation; no
separate GitHub review entries exist for them. Step 10 (P23B.0-durable) was ratified in Stage A on 2026-09-24 (revision `4b32034f`, O-1–O-4, W1–W7; scope amended 2026-09-25 §10 S-1…S-7), ran Stage B, was returned for correction on five findings plus the S-8 scheduling defect, and recorded the method-v5 baseline (`be525f7c`, SHA-256 `5534926e…`). The owner accepted the explicitly partial baseline (W6 §10.3 disposition A — post-release flush/frame coverage deferred, no further capture) and PR #87 merged 2026-09-25 (squash `d7b9de4e`; tree identical to continuation HEAD `935c5ada`). P23B.0-durable is SHIPPED and closed (recovery anchor `d7b9de4e`, tag `closed/p23b.0`); its plan, W6, W7 and Stage A handoff are path-preserving closed stubs.
The recorded finding is that every fixture is slow, including the 40-straight-wall control. P23B.4's baseline gate is satisfied; its reconciled plan was RATIFIED and implementation AUTHORIZED 2026-09-25 (S1 first), the F1–F3 correction batch was ACCEPTED with no remaining blockers, and P23B.4 is SHIPPED (PR #88, anchor `4cbcc370`, tag `closed/p23b.4`; stubs at their own paths).
P23B.5's reconciled plan (`f26e2319`) was ACCEPTED and RATIFIED by the owner on 2026-09-25, authorizing S0–S3; S0 then executed and recorded the disposition PREFLIGHT-ONLY: no baseline→candidate (release) reuse is reachable (each release re-parses its candidate into fresh centerline objects, so the object-identity key cannot hit across stages or releases), restore/undo/redo issue no sampling at all, and the only reachable cross-chain identity is preflight→preflight inside a frozen-baseline gesture (measured 120 requests → 44 derivations / 76 hits over three pointermoves, with full-result equality). That narrower scope was NOT assumed authorized and needed a separate owner scope ruling (the dependency map routes the wider gesture work to P23B.7); the owner then GRANTED it on 2026-09-25, so M-3 is IMPLEMENTED at that preflight-only scope and S4 is taken there. Release-scope M-3 remains unreachable and unimplemented.
The owner-approved Option E rule permits coincident independent components, keeps accidental duplicates
within one connected component invalid, and lets only explicit Wall/Junction identity establish
connectivity. No new representation, group id or schema field was added. D-10 Join/Connect remains a
planning-level contract; D-12 reconciliation identity was implemented and proved in P23B.3a.
The P23B.3a scope amendment and placement in the SEQUENCE remain unchanged.
GATE: PHASE 0 and P23B.3's ratification gate are satisfied. The P23B.3 gate authorized P23B.3a only. A
separate owner ruling on 2026-09-24 ratified P23B.0-durable revision `4b32034f` and authorized its W1–W7
measurement work; the resulting baseline was accepted 2026-09-25 (disposition A) and P23B.0 shipped, so
P23B.4 implementation is AUTHORIZED (plan ratified 2026-09-25). P23B.5's plan is RATIFIED, S0 is executed and recorded PREFLIGHT-ONLY, and the owner GRANTED that narrower scope on 2026-09-25, so S1–S6 were implemented and M-3 is done at the preflight-only scope; the slice now awaits its own independent review and acceptance (implementation status is not acceptance). P23B.6–P23B.8 remain unauthorized. No numerical performance target is proposed.
NEXT: P23B.0-durable is closed (stubs + anchor `d7b9de4e`, tag `closed/p23b.0`). Read the closed W6 stub §0 for the finding and its stated coverage limit. P23B.4 is SHIPPED (anchor `4cbcc370`, tag `closed/p23b.4`); its plan and evidence record are path-preserving closed stubs. P23B.5 is RATIFIED, S0 executed, and its narrower scope RULED: plan §0.2 records the PREFLIGHT-ONLY disposition and §0.4 the owner's approval of a bounded gesture-scoped sample owner, so S1–S6 are implemented at that scope (§5). It awaits the slice's independent review; do NOT claim release-scope reuse, start a second cache, or slice-close/merge it from this status. The Stage A packet and the accepted P23B.0 plan/scope amendment are routed below as closed stubs.
```

```text
PHASE 0 GATE:
  Phase 0 is closed. The owner adjudicated both lanes 2026-09-22 (record →
  ../architecture-operating-cycle/phase-0/adjudication.md) and the justified Phase 1 response is
  installed, so the cycle sits at PHASE_1. The installed clauses are landed reference authority and
  apply to P23B work as they stand: the Layout semantic-mutation boundary, Wall/Floor vertical
  authority, the persisted canonical curve model, and Junction commit-time identity under ruling R1.
  P23B records material early evidence about those mechanisms in its own artifacts. It does NOT open
  formal validation: the selected window is the cycle's (P26), and P23B is an ordinary product phase.
  Discovery, harvest, research, synthesis, planning and non-mutating profiling may proceed now;
  committing benchmark code waits for implementation authorization.
  P23B IMPLEMENTATION starts only on an owner-ratified child plan. P23B's owner-close is an ordinary
  product close executed from PHASE_1 as a same-state close, and its PHASE CLOSE block records
  `CYCLE TARGET: PHASE_1 (unchanged)` — the durable proof that the selected window's trigger
  survived it. No audit is run here and no cycle mechanism changes.
  live state → ../../operations/architecture-cycle.md
```

```text
SEQUENCE — the owner-ratified post-P23 order. THIS BLOCK IS THE ONE AUTHORITATIVE COPY;
no other document restates the order. It is deliberately sequential for evidence quality, not
optimized for elapsed time: measurement informs harvest, harvest informs external research, and
all three inform synthesis.
 1  PR #74 merge → Phase 0 owner authorization
 2  Phase 0 completed: two independent architecture reviews + the separate structural-workflow
    diagnostic, then owner adjudication                                    [CYCLE]
 3  Install any justified Phase 1 response; if none is justified, enter STEADY   [CYCLE]
 4  P23B.0 — reproduce the curved-room slowdown and establish the measured baseline on the
    existing benchmark infrastructure (read-only profiling until implementation authorization;
    the permission boundary is stated once, in the PHASE 0 GATE block above)
 5  P23B.1 — internal codebase harvest, guided by the profiling evidence
 6  P23B.2 — external precedent research (Pascal, Three.js, mature geometry systems, Workers,
    Rust/WASM), targeted at the diagnosed problems
 7  P23B.3 — synthesize measurement, internal findings and external research into the
    optimization direction
 8  OWNER RATIFICATION GATE — owner ratifies the implementation plan and the performance
    acceptance criteria; no optimization slice is authorized before this gate
 9  P23B.3a — Independent Placement & Topology Policy: the owner-authorized topology-policy slice
    (Option E). Placed HERE, before the durable measurement, so the recorded baseline is post-policy.
    Its scope amendment, acceptance contract and dedicated D-12 oracle → the decision record §4.2, the
    umbrella's scope-amendment section, and p23b.3a-independent-placement-topology-policy/    [AMENDED]
10  P23B.0-durable — SHIPPED 2026-09-25: committed fixtures with identity, the control matrix placed ONCE against the
    POST-POLICY gates, and the recorded pre-optimization baseline with provenance. The owner accepted the
    explicitly partial method-v5 baseline (W6 §10.3 disposition A — post-release flush/frame coverage deferred,
    no further capture); PR #87 merged (squash `d7b9de4e`; baseline SHA-256 `5534926e…`, 107,521 bytes,
    preserved). Plan, W6, W7 and Stage A handoff are path-preserving closed stubs; anchor `d7b9de4e`, tag
    `closed/p23b.0`. The finding is that every fixture is slow, including the 40-straight-wall control.
    P23B.4's baseline gate is satisfied; its reconciled plan is RATIFIED and implementation AUTHORIZED 2026-09-25 (S1 first).
11  P23B.4–P23B.8 execute, verify and review; then the P23B.9 correctness +
    performance-regression gate and the P23B.10 closeout gate
```

> **SEQUENCE is owner-approved, and the block above is its authoritative AMENDED state.** The single
> amendment is the owner-authorized insertion of **P23B.3a** as step 9 (approved 2026-09-22 under
> D-11 = ARRANGEMENT 1), which also re-numbers the closing step; no existing slice's meaning, scope or
> identity changed. Later work must PRESERVE THIS sequence and must not change it again without a further
> owner authorization — byte equality to the PRE-AMENDMENT block is **not** the test (P23B.10 MR-10).

## Owner-authorized execution routing amendment — 2026-09-24

P23B.3a completed and merged in PR #82 at `c11938fe`. After owner ratification of the P23B.0-durable
plan, continue P23B.0-durable through P23B.10 on one new continuation branch and one continuation PR;
do not add child PRs within that workstream. Keep the ratified sequence and sequential slice review,
acceptance and `slice-closeout` order. This amendment changes execution grouping only: it does not change
the `SEQUENCE`, slice scope, identity or order. P23B.3a remains closed on its existing recovery anchor.

## Owner-authorized execution routing amendment — 2026-09-25 (P23B.4 step)

P23B.0-durable shipped via PR #87 (squash `d7b9de4e`, closed above). For the next step this
supersedes the continuation-branch arrangement above: reconcile P23B.4's plan and architecture-review
gate on `P23B4` from updated `main` (new branch for this step; the recorded owner instruction said
a `codex/` prefix and the actual head is `P23B4`, which is the branch of record); do not reuse
`codex/p23b-continuation` for P23B.4 work. The ratified `SEQUENCE`, sequential slice review/acceptance/
`slice-closeout` order, and slice scope/identity/order are unchanged. P23B.4 implementation awaits
owner approval of the reconciled plan.

## Owner-authorized execution routing amendment — 2026-09-25 (P23B.5 step)

P23B.4 shipped via PR #88 (squash `4cbcc370`, closed above). For the P23B.5 step the owner ratified the
reconciled plan (`f26e2319`) and authorized S0–S3 execution on the existing `P23B.5` branch, with
**one PR for all of P23B.5** — no separate S0 PR, and no slice close, merge or S4 start from S0. S0
evidence and the ratification/status updates are committed and pushed to that branch for the eventual
full implementation review. S4 stays authorized-within-scope only: it needs an S0-approved operation
and owner, and S0 recorded PREFLIGHT-ONLY, whose narrower scope needed a separate owner scope ruling
before implementation. **RESOLVED 2026-09-25:** the owner granted that narrower scope (plan §0.4), and
S1–S6 were implemented under it on the same `P23B.5` branch and the same single PR — release-scope reuse
and any broader ownership redesign remain unauthorized. The ratified `SEQUENCE`, sequential slice
review/acceptance/`slice-closeout` order, and slice scope/identity/order are unchanged.

```text
ROUTE:
umbrella (WHAT/WHY/BOUNDARIES/DEPENDENCIES/GATES; not the order — including the OWNER-APPROVED
        P23B.3a scope amendment, the one authorized exception to "cost, not capability") →
  2026-09-22-P23B-geometry-performance-stabilization-umbrella.md
  §Owner-approved scope amendment — P23B.3a
harvest (P23B.1 — plan ACCEPTED; harvest record EXECUTED, awaiting review) →
  p23b.1-internal-geometry-pipeline-harvest/2026-09-22-P23B.1-internal-geometry-pipeline-harvest.md
    (the accepted contract) · 2026-09-22-P23B.1-harvest-record.md (the executed harvest: FL-1 · CG-1 ·
    SC-1 · CI-1 · TO-1 · RT-1 · PO-1 · PM-1 · UN-1)
research (P23B.2 — verbatim report landed, awaiting evidence review; folded into P23B.3 as context,
        never as authority) →
  p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-external-geometry-performance-research.md
  (source index has pinned URLs; chat-specific <Link>/<Cite> tags preserved in the verbatim text)
  p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-research-navigation.md
  (the GitHub-readable companion: the 12 inline links and the 17 citations mapped to their sections;
  ADDITIVE — the report above is never edited to make its tags render)
synthesis (P23B.3 — RATIFIED 2026-09-22 at `e139a18b`) →
  p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md
    (the ratified reconciliation + direction + §8 dependency evidence + §9 owner decisions)
  p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md
    (the operational map: prerequisites, gates, oracles, abandonment, deferrals)
  p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md
    (the correctness/policy decision record — Option E and its topology-ownership model are ratified;
    Options A–D are historical; §4.1 records the delivery decision; §6 is the acceptance-test design)
child plans and execution status →
  p23b.3a-independent-placement-topology-policy/2026-09-22-P23B.3a-independent-placement-topology-policy.md
    (SHIPPED, SEQUENCE step 9; path-preserving closed-plan stub; QA/acceptance stub in its qa/ directory)
  p23b.3a-independent-placement-topology-policy/qa/2026-09-24-P23B.3a-qa-gate-record.md
    (path-preserving closed QA/acceptance stub; recovery tag closed/p23b.3a is local only, not pushed;
    P1 merge method is a merge commit)
  p23b.0-measurement-foundation/2026-09-22-P23B.0-durable-measurement-completion.md   (closed stub; anchor d7b9de4e, tag closed/p23b.0)
  p23b.4-compilation-invalidation-optimization/2026-09-22-P23B.4-compilation-invalidation-optimization.md
     (SHIPPED; closed plan stub; anchor `4cbcc370`, tag `closed/p23b.4`) ·
   p23b.4-compilation-invalidation-optimization/2026-09-25-P23B.4-evidence-findings.md
     (SHIPPED; closed evidence stub carrying the preservation report)
  p23b.5-caching-reuse-optimization/2026-09-22-P23B.5-caching-reuse-optimization.md
    (RATIFIED + S0 executed + owner-approved preflight-only scope, 2026-09-25; §0 records the
    ratification, the PREFLIGHT-ONLY disposition and the ruling, §5 the S1–S6 records;
    S2–S5 proofs in apps/editor/tests/lib/layout/p23b5-preflight-scope.test.ts)
  p23b.6-rendering-optimization/2026-09-22-P23B.6-rendering-optimization.md
  p23b.7-interaction-optimization/2026-09-22-P23B.7-interaction-optimization.md
  p23b.8-rust-wasm-evaluation/2026-09-22-P23B.8-rust-wasm-evaluation.md
  p23b.9-correctness-performance-gate/2026-09-22-P23B.9-correctness-performance-gate.md
  p23b.10-phase-closeout/2026-09-22-P23B.10-phase-closeout.md
measurement evidence (P23B.0 — archived read-only reports; NOT benchmark baselines) →
  p23b.0-measurement-foundation/2026-09-22-P23B.0-read-only-pass-a-12-curved-walls.md
  p23b.0-measurement-foundation/2026-09-22-P23B.0-read-only-pass-b-owner-40-curved-walls.md
  (historical local /private/tmp runner paths in Pass A are not committed; reported source hashes
  cannot be independently verified from repository fixture bytes)
durable measurement (P23B.0 — SHIPPED 2026-09-25; closed stubs) → plan reconciled against the SHIPPED Option E policy (Stage A,
           2026-09-24); fixtures, harness, reproducible recorded baseline and budgets delivered →
           p23b.0-measurement-foundation/2026-09-24-P23B.0-ratification-handoff.md (closed Stage A owner packet stub) ·
           the P23B.0-durable plan above (closed stub) · the P23B.1 harvest record §11.1
           (recovery anchor `d7b9de4e`, tag `closed/p23b.0`; baseline SHA-256 `5534926e…` preserved)
phase status/order → ../README.md
P26 planning (parallel; not the primary next action) → ../p26-spatial-depth/README.md
P23 (closed, evidence only) → ../p23-layout-depth/README.md
```

```text
DEPENDS ON: P23 closed 2026-09-22 (wall-first Plan editor minimum, one canonical geometry compiler)
EXECUTION ORDER: pinned by phase README depends-on, not by P-number order
PIPELINE POSITION: P23 → P23B → P26 → P24 → P25
```

## Authorities

- Umbrella: [`2026-09-22-P23B-geometry-performance-stabilization-umbrella.md`](./2026-09-22-P23B-geometry-performance-stabilization-umbrella.md)
- P23B.3 synthesis and direction: [`p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md`](./p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-synthesis.md)
- P23B.3 operational dependency map: [`p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md`](./p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-implementation-and-dependency-map.md)
- Curved-crossing owner decision record: [`p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md`](./p23b.3-synthesis-optimization-direction/2026-09-22-P23B.3-curved-crossing-owner-decision.md)
- Topology-policy slice (P23B.3a — SHIPPED, SEQUENCE step 9): [`closed plan stub`](./p23b.3a-independent-placement-topology-policy/2026-09-22-P23B.3a-independent-placement-topology-policy.md) · [`closed QA/acceptance stub`](./p23b.3a-independent-placement-topology-policy/qa/2026-09-24-P23B.3a-qa-gate-record.md) · recovery tag `closed/p23b.3a`
- P-level status/order: [`../README.md`](../README.md)
- Product baton: [`../../operations/current.md`](../../operations/current.md)
- Operating cycle (meta, live state): [`../../operations/architecture-cycle.md`](../../operations/architecture-cycle.md)
- Carried P23 verification debt: [`../p23-layout-depth/README.md`](../p23-layout-depth/README.md) §Completed slices · [`../../operations/tech-debt/README.md`](../../operations/tech-debt/README.md)

## Child slices — status

`planned` means a plan exists and is **unratified**; it does not mean approved, implementation-ready or
complete. `proposed` means no plan exists. Contracts that already exist and must be extended rather than
duplicated: `apps/editor/src/lib/bench/` (versioned bench contract, provenance, budgets, recorded
baseline) and the PERF test lane.

Plan status, not order — the order and its gates are the SEQUENCE block above; dependencies are P23B.3 §8
and the dependency map.

```text
P23B.0  measurement foundation — SHIPPED 2026-09-25. Plan RATIFIED by owner 2026-09-24 at `4b32034f`;
         scope AMENDED 2026-09-25 (§10 S-1…S-7, §11 S-8…S-10). Implemented and recorded: fixtures, control matrix,
         provenance-backed method-v5 baseline (baseline SHA-256 `5534926e…`, 107,521 bytes) and budgets.
         Owner accepted the explicitly partial baseline (W6 §10.3 disposition A — post-release flush/frame
         coverage deferred, no further capture); PR #87 merged (squash `d7b9de4e`). Plan, W6, W7 and Stage A
         handoff are path-preserving closed stubs; anchor `d7b9de4e`, tag `closed/p23b.0`.
P23B.1  internal geometry-pipeline harvest — plan ACCEPTED; harvest record EXECUTED, awaiting review
P23B.2  external precedent research — report LANDED VERBATIM (Q1–Q8 answered, Q9 deferred), awaiting
        evidence review; folded into P23B.3
P23B.3  synthesis + optimization direction — RATIFIED by the owner 2026-09-22 at `e139a18b`
P23B.3a independent placement + topology policy (Option E) — SHIPPED 2026-09-24 after owner acceptance;
        SEQUENCE step 9. The slice owns and passed the general-connectivity proof and D-12 reconciliation
        identity guarantee (S3a). Its plan and QA record are path-preserving stubs; implementation,
        acceptance and recovery anchors are linked there. S5/S6 re-reviews are owner-confirmed complete;
        GitHub has no separate review entries.
P23B.4  compilation + invalidation optimization — SHIPPED 2026-09-25. Plan RATIFIED +
         AUTHORIZED 2026-09-25, implemented S1–S10, returned for correction on F1–F3,
         corrections ACCEPTED with no remaining blockers (HEAD `4cbcc370` vs base
         `d7b9de4e`). M-1 threaded, M-2a extent scan shipped, M-2b DROPPED at X-6.
         Plan + evidence record are path-preserving closed stubs (anchor `4cbcc370`,
         tag `closed/p23b.4`). Performance acceptance covers reduced computation and
         advisory Node timings; browser/settlement improvements remain unproven.
         U-1 declined; Rust/WASM undecided until P23B.8.
P23B.5  caching and reuse optimization — IMPLEMENTED 2026-09-25 on `P23B.5`, AWAITING INDEPENDENT REVIEW.
         PLAN RATIFIED (S0–S3 authorized); S0 EXECUTED and recorded PREFLIGHT-ONLY. Release-scope M-3 reuse
         is NOT reachable (each release re-parses its candidate), so the owner granted the narrower
         preflight-only scope (plan §0.4) and M-3 = SHIPPED (preflight-only): one bounded gesture-scoped
         sample owner threaded into the transient preflight only, reset at pointer-down/finish/cancel/
         replacement. Measured on curved-40: 120 preflight requests → 44 derivations = 40 cold misses
         + 4 changed-input refusals, and 76 hits (63%), 0 failed derives, 0 cached undefined; straight
         control 0 requests; advisory per-drag preflight p50 26.7 → 8.9 ms. These counters are also
         watchable live: the DEV harness page `/dev/perf/p23b` shows per-gesture requests, hits, cold
         misses and refusals while a drag is in progress (DEV-only readout, absent from production builds
         and from the capture ledger/baseline). No release/validation/history behaviour changed and
         landed M-1 is preserved. Implementation status is NOT acceptance; no closeout or merge is
         implied.
P23B.6  rendering optimization — PLANNED, unratified
P23B.7  interaction optimization — PLANNED, unratified
P23B.8  conditional Worker + Rust/WASM evaluation (decision only; "not justified" is a valid close) —
        PLANNED, unratified
P23B.9  correctness + performance-regression gate — PLANNED, unratified
P23B.10 phase closeout gate (makes P23B CLOSABLE; closure stays owner-invoked) — PLANNED, unratified
```

**Other owner decisions still open:**

```text
1  Accept, part-return or require a review of the separate P23B.2 research evidence.
2  Resolve the umbrella's remaining open calls when their owning slices reach those gates (device profiles,
   enforced budgets, P23 Decision 13, Rust/WASM authorization and any numeric target).
```

**Startup stop:** a reader has what this phase currently needs once status, the SEQUENCE block, the phase
gate and the ROUTE block are read. P23B.3a is shipped. P23B.0 is shipped and closed (accepted partial
baseline, stubs + anchor `d7b9de4e`, tag `closed/p23b.0`); the P23B.1 harvest
and P23B.2 research report retain their own review statuses. P23B.4 is shipped and closed (stubs + anchor
`4cbcc370`, tag `closed/p23b.4`). Later optimization slices remain
downstream of the shipped P23B.4 key grammar and its owner gate.

## Non-goals

```text
no new architectural capability or view      no mandatory Rust/WASM migration
no schema or persisted-format change         no premature repository split or new package boundary
no reopened P23 scope or decisions           no Phase 0 execution, audit or cycle change here
```
