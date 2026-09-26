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
P23B.5's reconciled plan (`f26e2319`) was ACCEPTED and RATIFIED by the owner on 2026-09-25, authorizing S0–S3; S0 then executed and recorded the disposition PREFLIGHT-ONLY: no baseline→candidate (release) reuse is reachable (each release re-parses its candidate into fresh centerline objects, so the object-identity key cannot hit across stages or releases), restore/undo/redo issue no sampling at all, and the only reachable cross-chain identity is preflight→preflight inside a frozen-baseline gesture (measured 120 requests → 44 derivations / 76 hits over three pointermoves, with full-result equality). That narrower scope was NOT assumed authorized and needed a separate owner scope ruling (the dependency map routes the wider gesture work to P23B.7); the owner then GRANTED it on 2026-09-25, so S1–S6 were implemented and S4 was taken at that preflight-only scope. A second owner ruling (stub §0.6) then committed those counters as a perf-lane ratchet. The slice was REVIEWED AND ACCEPTED with no remaining blocker, routine `slice-closeout` ran on the same branch, and the single PR (#90) was squash-merged; P23B.5 is SHIPPED, its plan is a path-preserving closed stub (anchor `75fbd8a0`, tag `closed/p23b.5`) and its ratchet record stays live. Release-scope M-3 remains unreachable and unimplemented.
P23B.7 is SHIPPED and closed 2026-09-25 (one PR for the slice: #92; accepted head `ee0dbecd`; the plan and the S4 · S6 · S7 · S7-follow-up · correction records are path-preserving closed stubs at their own paths; tag `closed/p23b.7`, local only). NEXT: P23B.6 — PLANNED, RECONCILED 2026-09-25 against `main` 6ad23856 and the current P26 authorities, RATIFIED by the owner; implementation AUTHORIZED on branch `P23B.6` (start at plan §15).
The owner-approved Option E rule permits coincident independent components, keeps accidental duplicates
within one connected component invalid, and lets only explicit Wall/Junction identity establish
connectivity. No new representation, group id or schema field was added. D-10 Join/Connect remains a
planning-level contract; D-12 reconciliation identity was implemented and proved in P23B.3a.
The P23B.3a scope amendment and placement in the SEQUENCE remain unchanged.
GATE: PHASE 0 and P23B.3's ratification gate are satisfied. The P23B.3 gate authorized P23B.3a only. A
separate owner ruling on 2026-09-24 ratified P23B.0-durable revision `4b32034f` and authorized its W1–W7
measurement work; the resulting baseline was accepted 2026-09-25 (disposition A) and P23B.0 shipped, so
P23B.4 implementation is AUTHORIZED (plan ratified 2026-09-25). P23B.5 is SHIPPED and closed (PR #90 squash-merged; closed stub + anchor `75fbd8a0`, tag `closed/p23b.5`) after the owner accepted it with no remaining blocker. P23B.7 is SHIPPED and closed 2026-09-25 (one PR for the slice: #92; accepted head `ee0dbecd`; closed plan + record stubs at their own paths; tag `closed/p23b.7`, local only) after the owner accepted its correction round with no remaining blocker. The P23B.5-closeout-authorized measurement-only step ran first and closed, starting no optimization and ending at a ranking, and its identity pin ruled STATE-SIDE, so the SEQUENCE's step 11 ran P23B.7 before P23B.6 (order only). P23B.6 is RATIFIED (owner, 2026-09-25) and its implementation AUTHORIZED on branch `P23B.6`; P23B.8 remains unratified and unauthorized. No numerical performance target is proposed.
NEXT: P23B.0-durable is closed (stubs + anchor `d7b9de4e`, tag `closed/p23b.0`). Read the closed W6 stub §0 for the finding and its stated coverage limit. P23B.4 is SHIPPED (anchor `4cbcc370`, tag `closed/p23b.4`); its plan and evidence record are path-preserving closed stubs. P23B.5 is SHIPPED (PR #90; plan is a path-preserving closed stub: the PREFLIGHT-ONLY disposition §0.2, the preflight-only scope ruling §0.4, the reuse-gate ruling §0.6 and the S1–S6 records are summarized there, with the full body recoverable via the anchor `75fbd8a0`; its `reuse-counter-ratchet.json` stays LIVE — a test imports it by path). Do NOT claim release-scope reuse, start a second cache, or re-own the sample store. The measurement-only step RAN, was reviewed and ACCEPTED, and is CLOSED (PR #91 squash-merged; closed stub + anchor `1d0fb220`, tag `closed/p23b-measurement`); its identity pin ruled STATE-SIDE, so the SEQUENCE runs P23B.7 before P23B.6. P23B.7 is SHIPPED and closed 2026-09-25 (one PR for the slice: #92 — the closeout commit stays inside it; the plan and the S4 · S6 · S7 · S7-follow-up · correction records are path-preserving closed stubs at their own paths; accepted head `ee0dbecd`; tag `closed/p23b.7`, local only). Its reconciled plan was RATIFIED and its implementation AUTHORIZED (2026-09-25 P23B.7-step routing amendment above; the two clarification rulings are folded into plan §0.8 and §7), and it executed on the dedicated `P23B.7` branch in the order S2 → S6 + regression → S6 measurement → S3 → S4 → S5 only if named → S7, then was reviewed, corrected (two P2 findings) and accepted. NEXT: P23B.6 is RATIFIED and AUTHORIZED — execute its plan from §15 on branch `P23B.6`. Do NOT start P23B.8 work, do not open a second cache, and do not rewrite the baseline or the ratchet record. The Stage A packet and the accepted P23B.0 plan/scope amendment are routed below as closed stubs.
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
    [ORDER AMENDED 2026-09-25] Within that run, P23B.7 executes BEFORE P23B.6:
    P23B.4 → P23B.5 → P23B.7 → P23B.6 → P23B.8. Owner-ruled from the measurement
    step's geometry-identity pin (STATE-SIDE: the object the commit hands
    `installWallMeshes` is a Svelte `$state` proxy, and the duplicate 40-Wall
    rebuild it causes is per-gesture commit/history work, which P23B.7 owns —
    not per-frame rendering). ORDER ONLY: slice IDs, names, scope and identity
    are UNCHANGED and there is NO renumbering. Evidence →
    ./p23b-measurement-only-step/2026-09-25-release-containment-record.md §8.
```

> **SEQUENCE is owner-approved, and the block above is its authoritative AMENDED state.** There are two
> owner-authorized amendments. The first is the insertion of **P23B.3a** as step 9 (approved 2026-09-22
> under D-11 = ARRANGEMENT 1), which also re-numbered the closing step. The second is the 2026-09-25
> **order amendment inside step 11**: P23B.7 runs before P23B.6, ruled from the measurement-only step's
> identity pin (STATE-SIDE), with no slice renumbered and no scope or identity changed. No existing
> slice's meaning, scope or identity changed in either. Later work must PRESERVE THIS sequence and must
> not change it again without a further owner authorization — byte equality to the PRE-AMENDMENT block is
> **not** the test (P23B.10 MR-10).

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
and any broader ownership redesign remain unauthorized. One extra scope item was approved afterwards,
also inside that single PR: the committed reuse-counter gate (plan §0.6), which adds no repository
budget metric and re-records no baseline. The ratified `SEQUENCE`, sequential slice
review/acceptance/`slice-closeout` order, and slice scope/identity/order are unchanged.

## Owner-authorized execution routing amendment — 2026-09-25 (P23B.7 step)

```text
OWNER RULING 2026-09-25: the P23B.7 plan is RATIFIED and its implementation AUTHORIZED on the
  dedicated `P23B.7` branch (do not reuse a `codex/`-prefixed branch or the P23B.4/P23B.5 branches);
  one PR for the slice, opened for review, never merged and never marked accepted here.

TWO RATIFICATION CLARIFICATIONS (folded into the plan's owning sections — plan §0.8):
  · the gesture-invariant part is computed once; AFFECTED candidate sets and verdicts are RECOMPUTED
    AS NEEDED PER MOVE, may change size across moves and may grow with the document, and per-move
    work is bounded by THAT move's conservative candidate set. Only INVARIANT predicate evaluations
    are claimed zero after initialization (§7 DETERMINISTIC i-iii).
  · sample reuse and verdict reuse are tested as a FOUR-CELL MATRIX, one axis at a time (sample
    ON/OFF with verdict mode fixed, separately for verdict OFF and ON; verdict OFF/ON with sampling
    fixed, separately for sampling ON and OFF), requests suppressed by verdict reuse are accounted
    explicitly, P23B.5's absolute sample-store invariants are PRESERVED VERBATIM (no weakened
    invariant, no fabricated hit, no double count) and RETAINING the sample requests is the APPROVED
    fallback — which is what ships, so the recorded ratchet needs no re-record.

WHAT THE STEP AUTHORIZES: plan §6's full slice in its amended order — S2 (reference freeze, tests
  only), S6 (the commit-path duplicate-build fix + its `$state`-backed regression proof), S6's own
  independently attributable browser capture BEFORE any topology change, S3 (affected-extent
  derivation), S4 (gesture-scoped verdict set + the four-cell differential), S5 ONLY if the
  measurement names hit-test/snap, and S7 (slice-wide re-measure). Commits and pushing are authorized
  on the branch, as separate coherent green commits; the PR carries scope, validation, evidence and
  limitations for owner review.

GUARDRAILS (unchanged): `g3-baseline.json` is NOT rewritten (`bench:record` stays its only writer) ·
  no budget metric and no production behaviour change beyond the authorized mechanisms · the
  committed `reuse-counter-ratchet.json` is NOT hand-edited (only `reuse:record` writes it) · the full
  test contract in `apps/editor/tests/README.md` runs before review · no P23B.6 or P23B.8 work ·
  the slice is NOT merged, accepted or closed here.
```

## Owner-authorized execution routing amendment — 2026-09-25 (P23B.5 closeout + measurement-only step)

P23B.5 was reviewed and ACCEPTED with no remaining blocker; routine `slice-closeout` ran on the `P23B.5`
branch and its single PR (#90) was squash-merged — no new scope entered that PR. This amendment records
the owner's ruling for what runs next.

```text
OWNER EXTENSION 2026-09-25: the measurement step also pins which geometry identity
  `installWallMeshes` receives at commit time (DEV-only diagnostic, no product change),
  and the P23B.6/P23B.7 order is ruled from that result per the order ruling below.

ORDER RULING 2026-09-25 (STATE-SIDE, applied): the pin proved that the object the commit
  hands `installWallMeshes` is a `$state` proxy and not the object the install cached, so the
  leading measured cost is per-gesture commit/history work. The SEQUENCE's step 11 therefore
  runs P23B.7 BEFORE P23B.6 — the authoritative block above carries the amendment, and it is
  order only (no renumbering, no scope or identity change). Evidence →
  ./p23b-measurement-only-step/2026-09-25-release-containment-record.md §8.

ORDER (amends SEQUENCE step 11's execution order only)
  Before ANY optimization step in P23B.6 or P23B.7, run ONE measurement-only step: P23B.7 S1
  (per-move proposal, per-move preflight, the derive/install seam, reactive re-render and the
  release chain — each separately, mark nesting stated) EXTENDED to the wall-authoring release,
  PLUS P23B.6 S1 (the four presentation cost classes, flush included). The SEQUENCE, slice scope
  and slice identity are UNCHANGED; P23B.6–P23B.8 optimization work stays unauthorized. The work
  runs on a new branch from updated `main`.

WHAT THE STEP COVERS
  · tie the existing p2311 nested marks to the action and outcome that encloses them — today they
    are pooled per fixture session and cannot be attributed;
  · add DEV-only marks to the release path OUTSIDE `plan-apply`: baseline restore, gesture
    commit/history, selection, and the whole wall-authoring release (it has no `plan-apply` boundary);
  · fixtures: the committed straight-40, owner-40 and all-curved-40; actions: rigid edit, bend,
    wall-authoring click;
  · UN-1 is STALE — the planner, `deriveInstallBundle` and the preview-install commit already sit
    INSIDE `plan-apply`, since W4; the seam must be re-derived by symbol, never from P23B.1's line
    anchors (on the straight control's rigid edit, plan-apply is 31.7 ms p50 of a 208.4 ms release,
    so the old seam accounts for at most ~32 ms and ~176 ms sits outside it);
  · output: a containment tree per action, exclusive time only where marks are strictly nested, an
    explicit "unattributed" remainder, never a sum of pooled distributions (see `markNestingNote`),
    every number advisory (one machine, one session, provenance block);
  · end with a RANKING: which of P23B.6, P23B.7 (topology gate · snap/hit-test · preview-install) or
    P23B.8 each measured cost belongs to, plus the preflight gate's own ceiling — the whole-document
    preflight is currently 1.7 / 7.8 / 9.9 ms per move on straight / owner-40 / all-curved;
  · ONE post-release flush/frame re-capture with the S-8-corrected harness is INCLUDED and stored as
    a SEPARATE record (it reverses disposition A for that record only, and mainly serves P23B.6);
    the release breakdown and the post-release pairs are priced and authorized separately.

GUARDRAILS
  DEV harness only (`/dev/perf/p23b`); no production telemetry and nothing in `/museum` chunks ·
  `g3-baseline.json` is NOT rewritten (`bench:record` stays its only writer; results go into a
  separate slice record) · no budget and no production behaviour change · the full test contract in
  `apps/editor/tests/README.md` runs before review · STOP after the ranking and wait for the owner's
  ruling on the next slice — P23B.7's gesture-scoped topology gate does not start unless the
  measurement names it · no commits beyond this work, and no merge of the measurement branch without
  the owner's approval.
```

## P23B.7 closeout — 2026-09-25 (owner accepted; routine `slice-closeout`)

P23B.7 was REVIEWED AND ACCEPTED by the owner with no remaining blocker after the correction round
(two P2 findings fixed at `ee0dbecd`); routine `slice-closeout` ran on the `P23B.7` branch, and the
closeout commit stays inside the slice's single PR (#92) — no new PR, no new scope. The slice is
CLOSED: the plan and the S4 · S6 · S7 · S7-follow-up · correction records are path-preserving closed
stubs at their own paths, the S6 capture JSON stays LIVE as cited machine-readable evidence, and the
preservation report is recorded in the closed plan stub. Accepted implementation head `ee0dbecd`;
recovery tag `closed/p23b.7` (local only — not pushed); merge method squash (repo policy — branch
commits are not ancestors of `main` post-merge; recovery runs via `refs/pull/92/head`, recorded in
each stub). NEXT: P23B.6 (since RATIFIED and AUTHORIZED 2026-09-25); P23B.8 stays unauthorized. The routine closeout
re-ran no gate: it reuses the recorded acceptance evidence (owner instruction).

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
    (SHIPPED 2026-09-25; path-preserving closed stub carrying the §0.2/§0.4/§0.6 rulings, the §5 S0–S6
    records, the evidence and the preservation report; anchor `75fbd8a0`, tag `closed/p23b.5`) ·
   p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json
    (LIVE, not closed work — a test imports it by path; the perf-lane gate owns it) ·
   P23B.5 S2–S5 proofs → apps/editor/tests/lib/layout/p23b5-preflight-scope.test.ts
  p23b.6-rendering-optimization/2026-09-22-P23B.6-rendering-optimization.md
  p23b.7-interaction-optimization/2026-09-22-P23B.7-interaction-optimization.md
    (SHIPPED 2026-09-25; path-preserving closed stub carrying the §0.9/§0.10 rulings, the stage
    summary, the acceptance evidence, the residual ledger and the preservation report; per-record
    closed stubs sit in the same directory — S4 · S6 · S7 · S7 follow-up · correction; accepted head
    `ee0dbecd`, tag `closed/p23b.7` local only) ·
  p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-capture.json
    (LIVE, not closed work — machine-readable cited evidence; SHA-256 `95790b00…`) ·
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
P23B.5  caching and reuse optimization — SHIPPED 2026-09-25 (PR #90 squash-merged; closed stub + anchor
         `75fbd8a0`, tag `closed/p23b.5`). REVIEWED AND ACCEPTED with no remaining blocker; routine
         slice-closeout ran on the same branch. PLAN RATIFIED (S0–S3 authorized); S0 EXECUTED and recorded PREFLIGHT-ONLY. Release-scope M-3 reuse
         is NOT reachable (each release re-parses its candidate), so the owner granted the narrower
         preflight-only scope (plan §0.4) and M-3 = SHIPPED (preflight-only): one bounded gesture-scoped
         sample owner threaded into the transient preflight only, reset at pointer-down/finish/cancel/
         replacement. Measured on curved-40: 120 preflight requests → 44 derivations = 40 cold misses
         + 4 changed-input refusals, and 76 hits (63%), 0 failed derives, 0 cached undefined; straight
         control 0 requests; advisory per-drag preflight p50 26.7 → 8.9 ms. These counters are also
         watchable live: the DEV harness page `/dev/perf/p23b` shows per-gesture requests, hits, cold
         misses and refusals while a drag is in progress (DEV-only readout, absent from production builds
         and from the capture ledger/baseline). A second owner ruling (plan §0.6) approved ONE extra
         scope item after implementation: those counters are now a perf-lane GATE with a committed ratchet
         (`reuse-counter-ratchet.json`), so reuse drift is a reviewable diff instead of a silent change —
         absolute invariants (including that the scope owns exactly the preflight requests, never the
         unscoped proposal stage) plus recorded counts that move only through
         `npm run reuse:record --reason "…"`, which requires that reason, refuses a dirty source tree and
         refuses a measurement that breaks an invariant (mirroring `bench:record` as the P23B.0 baseline's
         only writer; no test writes the record). It adds no repository budget metric, asserts no timing
         threshold and neither reads nor re-records `g3-baseline.json`. No release/validation/history behaviour changed and landed M-1 is preserved.
         The ratchet JSON stays LIVE (not closed work). Next: P23B.7's own plan/review work (see the
         measurement-only step below and the order ruling in step 11 of the SEQUENCE) — then P23B.6.
         Both remain unauthorized until their slices are ratified.
MEASUREMENT-ONLY STEP — EXECUTED, owner-reviewed, ACCEPTED and CLOSED 2026-09-25 (PR #91
         squash-merged; the record is a path-preserving closed stub at its own path + anchor `1d0fb220`,
         tag `closed/p23b-measurement`). It ran the authorized P23B.7-S1-extended-to-authoring + P23B.6
         S1 containment work, PLUS the owner's 2026-09-25 extension (the DEV geometry-identity pin),
         started no optimization and wrote no baseline. FINDING: every accepted edit on a commit path
         builds the full 40-Wall mesh set TWICE, the second time inside `commit-replace`'s restore
         where the identity-keyed cache MISSES (`restore-mesh-install` p50 160.2 curved bend /
         162.3 curved drag / 190.7 curved authoring / 135.4 straight) while the same restore between
         actions hits at 0.0 — because the commit hands `installWallMeshes` a `$state` PROXY of the
         compile's geometry, not the object the install cached (STATE-SIDE). The commit path is 266.6
         ms of a 341.6 ms curved drag release (78%): `commit-capture` 125.5 + `commit-replace` 137.8.
         RULING: SEQUENCE step 11 now runs P23B.7 before P23B.6 (order only). Evidence artifact stays
         LIVE at its path: .../p23b-measurement-only-step/2026-09-25-release-containment-capture.json
         (SHA-256 `c004abbd…`). Limits: advisory, one machine/session; all-curved-40 aborts on the
         driver's 6000 ms guard; revision-2 magnitudes are 40–85% above revision 1 and the baseline.
P23B.6  rendering optimization — PLANNED, RECONCILED 2026-09-25 against `main` 6ad23856 (post-P23B.7
        residual and the P26 authorities: five-layer S1 attribution first; S-R (RETAIN) and M-3m
        (ADAPT, pure state-free preparation) conditional on mechanical admission rules; adapter,
        GPU and Plan SVG/affine work DROPPED as boundaries P26 replaces; history-retention proof
        mandatory). RATIFIED by the owner 2026-09-25; implementation AUTHORIZED on branch
        `P23B.6`.
P23B.7  interaction optimization — SHIPPED and closed 2026-09-25 (one PR for the slice: #92; owner
        REVIEWED AND ACCEPTED with no remaining blocker after the correction round; routine
        `slice-closeout` ran on the same branch). RATIFIED AND IMPLEMENTATION AUTHORIZED 2026-09-25;
        RAN BEFORE P23B.6 (owner order ruling 2026-09-25). Plan RECONCILED 2026-09-25
        against the shipped dependencies and the measurement-only step, the owner's four
        pre-ratification gaps RESOLVED in place (plan §0.7: the S6 `$state` regression oracle, S4's
        sample-request continuity with P23B.5's ratchet, S6-before-S3/S4 execution order, and the
        corrected deterministic scaling clause), and the owner's two ratification clarifications folded
        into their owning sections (plan §0.8: recomputed per-move affected candidate sets with only
        invariant evaluations guaranteed zero after initialization; the four-cell sample/verdict
        differential with suppressed requests accounted explicitly, invariants preserved verbatim and the
        retained-requests fallback approved). Execution order: S2 → S6 + regression → S6's independent
        measurement → S3 → S4 → S5 only if measurement names it → S7. Slice review, acceptance and
        `slice-closeout` remain owner actions after the PR.
        PROGRESS 2026-09-25 (branch `P23B.7`): S2 EXECUTED — the preflight reference is frozen as a test
        (OR-3 (a)-(d), OR-8 and the issue-order row, with status, code and the verbatim message).
        S6 EXECUTED AND MEASURED — the commit-path duplicate build is FIXED in
        `layout-preview-state.svelte.ts` (the identity the state reads back is recorded against the
        compile's own geometry, so every writer installs under a key a later restore asks for and the
        commit's restore HITS the cache the install filled); the mandated `$state`-backed regression
        oracle failed 2-vs-1 before the fix and is green after it (1 build on the pinned interval,
        0 on the separately counted between-action restore, undo/redo content byte-identical); and
        S6's own independent browser capture ran on a CLEAN tree at `d6f65426` BEFORE any topology
        change — 3/3 fixtures captured, settled, 0 dropped (the carried all-curved-40 6000 ms guard
        did NOT fire), 200 accepted commit-path actions → exactly ONE wall-mesh build each, all on the
        install side, 0 inside `commit-replace` (204 installs → 204 builds; 475 restores → 475 hits,
        0 builds; 200/200 commit restores hit immediately). The identity disagreement is UNCHANGED
        (the restore is still handed a `$state` proxy that is not the install's object) and the cache
        now agrees with it; `commit-replace` p50 161.7/160.7/190.7/135.4 ms → 1.4/1.2/1.3 (advisory;
        the COUNT is the durable result; `g3-baseline.json` untouched).
        Record → ./p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-record.md ·
        LIVE artifact (SHA-256 `95790b0081d5c42b6193d7eed8f94786461f774672d1319668ace4f3e0009112`) →
        ./p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-capture.json.
        S3 EXECUTED — `wallFirstArchitectureAffectedExtent` derives one direct-edit intent's affected
        extent from the SAME patch the proposal and the preflight splice: the moved Junctions, every
        Wall whose inputs can change (centreline overrides plus Walls incident to a moved Junction), and
        the conservative same-component candidate-pair sets in the canonical gate's own order. Scoped
        per move, not per gesture (a later move can enter Walls an earlier one did not), bounded by that
        move's own candidate set, refused (not guessed) for an underivable intent. Unit-tested in
        `apps/editor/tests/lib/layout/p23b7-affected-extent.test.ts` (junction move, wall move, bend
        insert, knot move, component scoping, gate order, the per-move growth row, underivable rows).
        S4 EXECUTED — the gesture-scoped verdict set (`createWallFirstArchitectureVerdictScope`,
        `layout-wall-first-precision.ts`): the first move of a target runs today's whole-document pass
        VERBATIM; a CLEAN result initializes the gesture, and every later move re-derives ITS OWN
        affected extent and evaluates only that through the same predicates (same path, code, message
        and first-failure order). A target change or a non-clean baseline re-initializes / stays on
        the canonical pass, so no request is suppressed and no failure approximated (the §0.8.2
        fallback). The viewport builds one non-reactive scope at pointer-down from the frozen baseline
        and drops it on both exit paths; `transientArchitectureEdit` threads it into the PREFLIGHT
        only. Differential: the S2 frozen table (OR-3 (a)–(d), OR-8 and the issue-order row) is driven
        as three-move same-target gestures and every move's scoped verdict equals the live
        whole-document one (clean rows scoped, failing baselines canonical); the F-C3 crossing is
        refused BY the scoped pass; the four-cell sample/verdict matrix reproduces the committed
        ratchet BYTE-FOR-BYTE through the scoped path (no re-record) with the per-move request series
        equal in both verdict modes — verdict reuse removes NO sample request (the crossing gate
        samples per Wall before its pair loop) — and P23B.5's absolute invariants hold per cell on
        their own. Tests: `p23b7-verdict-scope`, `p23b7-verdict-scope-wiring`,
        `p23b7-sample-verdict-matrix`; the S2 test now shares its frozen table via
        `p23b7-preflight-reference-cases` (values unmoved).
        Record → ./p23b.7-interaction-optimization/2026-09-25-s4-verdict-scope-record.md.
        S7 EXECUTED (targeted, per the owner ruling during S4, 2026-09-25 — plan §0.8.3): the
        `commit-capture` residual is ATTRIBUTED. `captureLayoutPreviewSnapshot` deep-clones `project`
        + `model` + `issues` through `JSON.parse(JSON.stringify(...))` with `geometry` by reference,
        and on the 40-Wall fixture the DERIVED `model` is 3,412,257 of 3,434,187 payload bytes
        (99.4 %; project 0.6 %) with NO production reader installing it (the restore re-projects the
        model from the shared geometry; the transient guard reads only `project.layout`). The same
        clone costs p50 ~20 ms on a plain state vs ~133 ms through the editor-style `$state` proxy
        (node, advisory) — the multiplier behind the browser's 107–149 ms.
        REVIEW-TIME FIX LANDED (owner-directed, 2026-09-25 — plan §0.9): the bounded next action the
        attribution named was EXECUTED on this branch as its OWN revertible commit — the capture no
        longer clones the derived `model` at all (`LayoutPreviewSnapshot` no longer declares it; the
        restore already re-projected it from the shared `geometry`). Same-session node A/B: the removed
        clone measures p50 114.23 ms through the editor-style proxy against p50 1.41 ms for the shipped
        capture, and the payload is 22,022 B / 643 objects against the removed 3,412,257 B / 39,106.
        Its own oracle (the capture/restore content contract) and a PERMANENT guard
        (`p23b7-snapshot-payload-guard`: a RELATIVE payload bound, the source contract, and a
        self-tested no-reader scan) landed with it. NOTHING ELSE MOVED: no budget metric,
        `g3-baseline.json` unread/unwritten, the ratchet untouched, P23B.6/P23B.8 still unauthorized,
        and the POST-fix browser number is NOT measured — 107–149 ms stays S1's/S6's pre-fix evidence.
        S5 is NOT taken — the measurement names the capture clone, not hit-test/snap.
        Records → ./p23b.7-interaction-optimization/2026-09-25-s7-capture-attribution-record.md ·
        ./p23b.7-interaction-optimization/2026-09-25-s7-followup-model-free-capture-record.md.
        Probe → apps/editor/tests/lib/bench/p23b7-capture-attribution.test.ts.
        Guard → apps/editor/tests/lib/editor/layout/p23b7-snapshot-payload-guard.test.ts.
        PR #92 REVIEW (2026-09-25): RETURNED FOR CORRECTION with two P2 findings, BOTH FIXED in one
        revertible commit. (1) The gesture TARGET IDENTITY was a `:`-joined string while Layout IDs
        may contain `:` (both codecs' ID_PATTERN admits it), so `(wall "A:B", knot "C")` and
        `(wall "A", knot "B:C")` shared one key: a target change could reuse the previous
        initialization and report `pending` where the canonical gate refuses. It is now an injective
        field TUPLE, and the reviewer's collision case is a regression that FAILS under the old
        encoding. (2) The DETERMINISTIC clause was asserted against candidate counts summed BEFORE the
        pass ran — the reviewer's whole-document mutation passed — so evaluations are now OBSERVED AT
        THE PREDICATE SITES, with scoped moves required to stay inside their own extent by kind and to
        evaluate strictly fewer subjects than the initialization; that mutation now FAILS. The counts
        are separately named `candidates`. Non-blocking dispositions accepted as stated (the snapshot
        guard keeps its limits; heap retention is a named bounded follow-up, no redesign).
        Record → ./p23b.7-interaction-optimization/2026-09-25-pr92-correction-record.md.
        REVIEWED AND ACCEPTED 2026-09-25 with no remaining blocker; routine `slice-closeout` ran on the
        same branch, inside the slice's single PR (#92) — no new PR, no new scope. The plan and the
        S4 · S6 · S7 · S7-follow-up · correction records are path-preserving closed stubs at their own
        paths (accepted head `ee0dbecd`; tag `closed/p23b.7`, local only); the S6 capture JSON stays
        LIVE (SHA-256 `95790b00…`). Merge method: squash (repo policy — branch commits are not ancestors
        of `main` post-merge; recovery runs via `refs/pull/92/head`, recorded in each stub). NEXT:
        P23B.6 — PLANNED, RECONCILED 2026-09-25 against `main` 6ad23856 and the current P26
        authorities, RATIFIED by the owner; implementation
        AUTHORIZED on branch `P23B.6`.
        P23B.8 stays unauthorized.
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
gate and the ROUTE block are read. P23B.3a, P23B.0, P23B.4, P23B.5 and P23B.7 are shipped and closed
(each with its own closed stubs, anchor and tag); the P23B.1 harvest
and P23B.2 research report retain their own review statuses. The next slice is P23B.6 — PLANNED,
ratified 2026-09-25, implementation authorized; P23B.8 stays unauthorized. Later optimization slices remain
downstream of the shipped P23B.4 key grammar and its owner gate.

## Non-goals

```text
no new architectural capability or view      no mandatory Rust/WASM migration
no schema or persisted-format change         no premature repository split or new package boundary
no reopened P23 scope or decisions           no Phase 0 execution, audit or cycle change here
```
