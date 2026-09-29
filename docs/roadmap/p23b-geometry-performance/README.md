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
P23B.7 is SHIPPED and closed 2026-09-25 (one PR for the slice: #92; accepted head `ee0dbecd`; the plan and the S4 · S6 · S7 · S7-follow-up · correction records are path-preserving closed stubs at their own paths; tag `closed/p23b.7`, local only). NEXT: P23B.6 — SHIPPED and closed 2026-09-26 (owner accepted with no remaining blocker on PR #93; accepted head `354f9b6f`; closed stubs at their own paths; tag `closed/p23b.6`, local only). P23B.11 is SHIPPED and closed 2026-09-27 (one PR for the slice: #95; accepted head `dcd3682f`; the plan, umbrella and the S1 · S3 · S4 · S5 · S6 · S7 · review-fix records are path-preserving closed stubs at their own paths; the three JSON capture records stay LIVE; tag `closed/p23b.11`, local only). NEXT: the pre-P23B.8 follow-up — since EXECUTED and CLOSED 2026-09-27 (M1 + R1; records, local-only captures and acceptance record → ./pre-p23b.8-follow-up/); the next step was therefore P23B.8's entry gate, which this follow-up entered nothing into.
P23B.8 has since been DECIDED and CLOSED 2026-09-29 (decision record at its own path in
./p23b.8-rust-wasm-evaluation/; D-0 FAIL, D-A/D-B NOT JUSTIFIED); NEXT is the owner-authorized
P23B.8 follow-up plan (see the closeout sections).
The owner-approved Option E rule permits coincident independent components, keeps accidental duplicates
within one connected component invalid, and lets only explicit Wall/Junction identity establish
connectivity. No new representation, group id or schema field was added. D-10 Join/Connect remains a
planning-level contract; D-12 reconciliation identity was implemented and proved in P23B.3a.
The P23B.3a scope amendment and placement in the SEQUENCE remain unchanged.
GATE: PHASE 0 and P23B.3's ratification gate are satisfied. The P23B.3 gate authorized P23B.3a only. A
separate owner ruling on 2026-09-24 ratified P23B.0-durable revision `4b32034f` and authorized its W1–W7
measurement work; the resulting baseline was accepted 2026-09-25 (disposition A) and P23B.0 shipped, so
P23B.4 implementation is AUTHORIZED (plan ratified 2026-09-25). P23B.5 is SHIPPED and closed (PR #90 squash-merged; closed stub + anchor `75fbd8a0`, tag `closed/p23b.5`) after the owner accepted it with no remaining blocker. P23B.7 is SHIPPED and closed 2026-09-25 (one PR for the slice: #92; accepted head `ee0dbecd`; closed plan + record stubs at their own paths; tag `closed/p23b.7`, local only) after the owner accepted its correction round with no remaining blocker. The P23B.5-closeout-authorized measurement-only step ran first and closed, starting no optimization and ending at a ranking, and its identity pin ruled STATE-SIDE, so the SEQUENCE's step 11 ran P23B.7 before P23B.6 (order only). P23B.6 is SHIPPED and closed 2026-09-26 after the owner REVIEWED AND ACCEPTED it with no remaining blocker (one PR for the slice: #93 — the closeout commit stays inside it; merge method squash, owner merges; accepted head `354f9b6f`; plan and per-record closed stubs at their own paths; the nine JSON measurement records stay LIVE; tag `closed/p23b.6`, local only). S-R and S3 M-3m landed; overall interaction improvement is NOT established and the unresolved curved release increases were owner-routed through P23B.11 — which attributed the wall-chain share and left the increases unresolved — and now sit with the pre-P23B.8 follow-up's M1 measurement. P23B.11 SHIPPED and closed 2026-09-27 (one PR for the slice: #95 — the closeout commit stays inside it; accepted head `dcd3682f`; closed stubs at their own paths; tag `closed/p23b.11`, local only). The pre-P23B.8 follow-up (M1 + R1) was then owner-routed, EXECUTED and CLOSED 2026-09-27 (records and LIVE captures at their own paths in ./pre-p23b.8-follow-up/; acceptance record there): measurement and ranking only, no product change, no threshold, no baseline or ratchet write. P23B.8 is SHIPPED and closed 2026-09-29 (see the closeout section), and P26 implementation/validation remain gated. No numerical performance target is proposed.
NEXT: P23B.0-durable is closed (stubs + anchor `d7b9de4e`, tag `closed/p23b.0`). Read the closed W6 stub §0 for the finding and its stated coverage limit. P23B.4 is SHIPPED (anchor `4cbcc370`, tag `closed/p23b.4`); its plan and evidence record are path-preserving closed stubs. P23B.5 is SHIPPED (PR #90; plan is a path-preserving closed stub: the PREFLIGHT-ONLY disposition §0.2, the preflight-only scope ruling §0.4, the reuse-gate ruling §0.6 and the S1–S6 records are summarized there, with the full body recoverable via the anchor `75fbd8a0`; its `reuse-counter-ratchet.json` stays LIVE — a test imports it by path). Do NOT claim release-scope reuse, start a second cache, or re-own the sample store. The measurement-only step RAN, was reviewed and ACCEPTED, and is CLOSED (PR #91 squash-merged; closed stub + anchor `1d0fb220`, tag `closed/p23b-measurement`); its identity pin ruled STATE-SIDE, so the SEQUENCE runs P23B.7 before P23B.6. P23B.7 is SHIPPED and closed 2026-09-25 (one PR for the slice: #92 — the closeout commit stays inside it; the plan and the S4 · S6 · S7 · S7-follow-up · correction records are path-preserving closed stubs at their own paths; accepted head `ee0dbecd`; tag `closed/p23b.7`, local only). Its reconciled plan was RATIFIED and its implementation AUTHORIZED (2026-09-25 P23B.7-step routing amendment above; the two clarification rulings are folded into plan §0.8 and §7), and it executed on the dedicated `P23B.7` branch in the order S2 → S6 + regression → S6 measurement → S3 → S4 → S5 only if named → S7, then was reviewed, corrected (two P2 findings) and accepted. P23B.6 is SHIPPED and closed 2026-09-26 (one PR: #93; accepted head `354f9b6f`; closed stubs at their own paths; tag `closed/p23b.6`, local only). P23B.8 is SHIPPED and closed 2026-09-29 (decision record at its own path in ./p23b.8-rust-wasm-evaluation/; D-0 FAIL, D-A/D-B NOT JUSTIFIED; tag `closed/p23b.8`, local only). NEXT: the P23B.8 follow-up is SHIPPED and closed 2026-09-29 (see the closeout section; records live as P23B.9 gate evidence). NEXT: P23B.9 (unratified, unauthorized). The pre-P23B.8 follow-up that came before it is EXECUTED and CLOSED 2026-09-27 (M1 + R1; records, local-only captures and acceptance record → ./pre-p23b.8-follow-up/; executed head `b6f2203b`; measurement and ranking only, no product change and no threshold). P23B.11 preceded it and is SHIPPED and closed 2026-09-27 (one PR #95, accepted head `dcd3682f`, closed stubs at their own paths, tag `closed/p23b.11` local only). Do not open a second cache or rewrite the baseline or ratchet outside the follow-up's ratified plan. P23B.9/P23B.10 and P26 implementation/validation retain their existing gates. The Stage A packet and accepted P23B.0 plan/scope amendment are routed below as closed stubs.
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
11  P23B.4–P23B.8 execute, verify and review, with owner-routed P23B.11
    wall-chain release-delay follow-up and the pre-P23B.8 follow-up immediately
    after P23B.6 / P23B.11 review/acceptance and before P23B.8; then the P23B.9
    correctness + performance-regression gate and the P23B.10 closeout gate
    [ORDER AMENDED 2026-09-25; P23B.11 ROUTED 2026-09-26; PRE-P23B.8 FOLLOW-UP
    ROUTED 2026-09-27] Within that run, P23B.7 executes BEFORE P23B.6, and the
    pre-P23B.8 follow-up executes between P23B.11 and P23B.8:
    P23B.4 → P23B.5 → P23B.7 → P23B.6 → P23B.11 → pre-P23B.8 follow-up → P23B.8.
    P23B.11 is the 2026-09-26 owner-routed wall-chain release-delay follow-up;
    SHIPPED and closed 2026-09-27 (PR #95; accepted head `dcd3682f`; closed
    stubs + tag `closed/p23b.11`, local only; the order is unchanged).
    The pre-P23B.8 follow-up is the 2026-09-27 owner-routed decisions slice
    (decision doc → ./2026-09-27-pre-P23B.8-follow-up-decisions.md): its
    RATIFIED scope is ONE measurement session (M1 — gesture frames plus
    release-to-next-presented-frame on the heavy curved layout, headless Chrome
    AND Electron under one protocol) and ONE release-cost ranking (R1 —
    canonical compile, then the install's room-geometry-compile, then
    mesh-prebuild). It EXECUTED and CLOSED 2026-09-27 (measurement and ranking
    only; both captures taken at head `b6f2203b` on a clean tree; no product
    path, threshold, baseline or ratchet touched) — records, the two LIVE
    captures and the acceptance record → ./pre-p23b.8-follow-up/. Queued items
    carry the before-P23B.8 condition: each must be ratified, or explicitly
    routed to P23B.8 / P26, before P23B.8 entry — nothing reaches P23B.8
    undecided.
    P23B.8's entry gate is SATISFIED and the slice is CLOSED 2026-09-29 (see the P23B.8
    closeout section; the before-P23B.8 condition above is historical).
    The P23B.7-before-P23B.6 order was owner-ruled from the measurement step's
    geometry-identity pin (STATE-SIDE: the object the commit hands
    `installWallMeshes` is a Svelte `$state` proxy, and the duplicate 40-Wall
    rebuild it causes is per-gesture commit/history work, which P23B.7 owns —
    not per-frame rendering). The P23B.11 insertion and the 2026-09-27 pre-P23B.8
    follow-up insertion are additional owner-authorized sequencing amendments;
    existing slice identities/scopes and the P23B.8/P26 gates are unchanged. Evidence →
    ./p23b-measurement-only-step/2026-09-25-release-containment-record.md §8;
    P23B.11 route → ./p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-wall-chain-release-delay-umbrella.md.
```

> **SEQUENCE is owner-approved, and the block above is its authoritative AMENDED state.** There are four
> owner-authorized amendments. The first is the insertion of **P23B.3a** as step 9 (approved 2026-09-22
> under D-11 = ARRANGEMENT 1), which also re-numbered the closing step. The second is the 2026-09-25
> **order amendment inside step 11**: P23B.7 runs before P23B.6, ruled from the measurement-only step's
> identity pin (STATE-SIDE), with no slice renumbered and no scope or identity changed. No existing
> slice's meaning, scope or identity changed in either. The third, owner-authorized 2026-09-26 amendment
> routes the separately scoped wall-chain release-delay follow-up as P23B.11 immediately after P23B.6
> review/acceptance and before P23B.8; it creates only a minimal umbrella stub, not implementation
> authorization. The fourth, owner-authorized 2026-09-27 amendment routes the pre-P23B.8 follow-up
> (decision doc `./2026-09-27-pre-P23B.8-follow-up-decisions.md`) between P23B.11 and P23B.8; its
> ratified scope is the measurement session (M1) and the release-cost ranking (R1), its queued items
> must be ratified or explicitly routed to P23B.8 / P26 before P23B.8 entry, and it authorizes no
> implementation. P23B.8's entry gate is closed (see the closeout section); P26's implementation/validation gates remain unchanged. Later
> work must PRESERVE THIS sequence and must not change it again without a further owner authorization —
> byte equality to the PRE-AMENDMENT block is **not** the test (P23B.10 MR-10).

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

## Owner-authorized execution routing amendment — 2026-09-27 (pre-P23B.8 follow-up)

The owner reviewed the pre-P23B.8 decision doc (the four revised proposals plus every remaining
deferred P23B.4/5/6/7 and P23B.11 item) inside P23B.11's PR #95 and filled in its OWNER DECISION
lines on 2026-09-27. The follow-up is routed between P23B.11 and P23B.8. Its RATIFIED scope is ONE
measurement session (M1 — gesture frames plus release-to-next-presented-frame on the heavy curved
layout, headless Chrome and Electron under one protocol) and ONE release-cost ranking (R1 — the
decision doc's three candidates, held until M1). The FOLDed
items beyond M1/R1 are queued by name, and each must be ratified, or explicitly routed to P23B.8 /
P26, before P23B.8 entry — nothing reaches P23B.8 undecided. The decisions, sources and triggered
edits are in ./2026-09-27-pre-P23B.8-follow-up-decisions.md. This amendment changes order only,
starts no slice, and leaves every existing slice identity and the P23B.8/P26 gates unchanged.

## P23B.7 closeout — 2026-09-25 (owner accepted; routine `slice-closeout`)

P23B.7 was REVIEWED AND ACCEPTED by the owner with no remaining blocker after the correction round
(two P2 findings fixed at `ee0dbecd`); routine `slice-closeout` ran on the `P23B.7` branch, and the
closeout commit stays inside the slice's single PR (#92) — no new PR, no new scope. The slice is
CLOSED: the plan and the S4 · S6 · S7 · S7-follow-up · correction records are path-preserving closed
stubs at their own paths, the S6 capture JSON stays LIVE as cited machine-readable evidence, and the
preservation report is recorded in the closed plan stub. Accepted implementation head `ee0dbecd`;
recovery tag `closed/p23b.7` (local only — not pushed); merge method squash (repo policy — branch
commits are not ancestors of `main` post-merge; recovery runs via `refs/pull/92/head`, recorded in
each stub). NEXT: P23B.6 — since SHIPPED and closed (see the closeout section below); P23B.8 stays
unauthorized. The routine closeout re-ran no gate: it reuses the recorded acceptance evidence (owner
instruction).

## P23B.6 closeout — 2026-09-26 (owner accepted; routine `slice-closeout`)

P23B.6 was REVIEWED AND ACCEPTED by the owner with no remaining blocker (the 2026-09-26 review
corrections — the mounted-scene H-5 lifecycle and the required forced-GC H-6 heavy lane — are part
of the accepted state); routine `slice-closeout` ran on the `P23B.6` branch, and the closeout commit
stays inside the slice's single PR (#93) — no new PR, no new scope. The slice is CLOSED: the plan and
the S1 attribution · S1a post-S-R re-gate · S3 strict-comparator abandonment (historical) · S3
comparator reconciliation · S3 integrated probe (historical) · S3 guard recheck · S6 final evidence ·
release-delay diagnosis records are path-preserving closed stubs at their own paths; the nine JSON
measurement records stay LIVE as cited machine-readable evidence; and the preservation report is
recorded in the closed S6 final-evidence stub. Accepted head `354f9b6f` (production code head
`e11f804b`, corrected test head `d9ea6dfa`); recovery tag `closed/p23b.6` (local only — not pushed);
merge method squash (repo policy — the owner merges the slice's single PR; branch commits are not
ancestors of `main` post-merge, so recovery runs via `refs/pull/93/head`, recorded in the stubs). The
superseded S6 evidence checkpoint was retired. NEXT: P23B.11 — since SHIPPED and closed (see the
closeout section below); P23B.8 stays unauthorized. The routine closeout re-ran no gate: it reuses
the recorded acceptance evidence. Every recorded anchor is a verified ancestor of the tag target.

## pre-P23B.8 follow-up closeout — 2026-09-27 (EXECUTED AND CLOSED; measurement + ranking)

The owner-ratified pre-P23B.8 follow-up RAN in plan order S1 → S6 and closed. It produced ONE
measurement session (M1: one protocol, one session, two runtimes — headless Chrome 152 and Electron
35 — both captures settled with zero dropped boundaries at executed head `b6f2203b` on a clean tree,
each with its own provenance) and ONE release-cost ranking (R1: read from the closed S7 keyed capture,
self-time only where priceable — CORRECTED 2026-09-27, see the review-correction section below). Two DEV-only instruments landed (the drag-attached gesture-frame series and the
release-side presented-frame/LOAF pair), and NO product module was touched — a test asserts it.
M1 re-read BOTH D1 rows on both runtimes and did NOT reproduce P23B.6's final-capture increases (a
finding, not a fix: the increases stay UNRESOLVED and no cause is claimed); the release → next
presented frame is 214–292 ms p50 on the heavy all-curved fixture on both runtimes where the
previously reported `browser-frame` proxy read 5–40 ms on the same releases. Three harness defects
found by reading finished captures were closed with tests (a sub-threshold bend gesture; two
registries keyed differently from how they are read, plus a session registry that keeps only its most
recent few sessions; a runner that could measure an older document while reporting current
provenance). No threshold, no target, no budget metric, no baseline or ratchet read or written, and
the connected case stayed advisory (excluded from D1's and D7's tables by construction, with a test).
The slice's records, its two local-only captures and its acceptance record sit at their own paths in
./pre-p23b.8-follow-up/; the plan's STATUS is amended in place (no stub was created and no prose was
compacted). NEXT: P23B.8's entry gate — this slice entered nothing into it, and the queued items
(P1 · D4 · D5 · D6 · D8 · D9 · D10 · D13) must be ratified, or explicitly routed to P23B.8 / P26,
before that entry.

COMMITTED 2026-09-28 — every block below, from the review corrections to the Room-label arm, was
written on one working tree and has LANDED as a commit series on this branch — the three that carried
the work, plus the follow-up commit that recorded them and carries this text: **`3ef60e68`** the M1
measurement stack and the records it produced · **`2ccded81`** the whole-Room drag on the transient
contract, rotation wired · **`58a0c5ef`** the Room-label placer's grid with the one-session arm that
measures it. Added to the same series the same day, for the block immediately after the arm section:
**`bca3da02`** the seeded, ranked, index-gated grid walk, with the build budget that its attempt records
now carry · **`2e292ade`** the runner signing the new pair from the arm module's own constants ·
**`c88b511a`** the two legs and the record that reads them. A block labelled "UNCOMMITTED" describes the state when it was written and is kept as
provenance, not as status. The two 2026-09-27 M1 leg captures stay deliberately uncommitted (gitignored
at two exact paths for their ~40k-line size); every other capture cited below is committed.
(SUPERSEDED AT CLOSEOUT 2026-09-29 — owner ruling: ALL fifteen leg captures are now local-only,
gitignored at exact paths; the records keep the aggregates. See the expanded-scope closeout section.)

## pre-P23B.8 follow-up review corrections — 2026-09-27 (committed 2026-09-28; performance pass)

The owner reviewed the closed follow-up's records and both captures and raised three findings, all
confirmed in code and all corrected on the same branch, with regression coverage: R1's ranking ordered
rows 2/3 by the SMALLER exclusive self while placing row 1 by the largest total (now corrected in
place — mesh-prebuild is the larger exclusive cost in five of the six committed classes and level in
the sixth, room-geometry-compile is at or below it everywhere, and the canonical-gates row is reported,
not ranked because its exclusive self is withheld in every class); the gesture rows pooled warm-up
drags and retried attempts into the measured class (now restricted to the class's own measured
population, with the exclusions COUNTED); and the `wall-authoring` classes' reported population (23)
could not be reconciled with 20 (warm-up is sliced before the accepted filter, and a `setup` action of
the same path consumes slots — the decomposition is now reported per class and per session). Both M1
legs were RE-RUN against the corrected code on the same machine/protocol and the same two files carry
the corrected rows plus the new `populations` and `attribution` sections (their provenance says
`treeDirty: true`, because the corrections were uncommitted when captured). The pass also read the
session's own rows for D4 (whole-Room move: per-preview full-generation mesh preparation, 61.8 / 70.5 ms
p50 exclusive self per occurrence, SIX per accepted action, against ONE occurrence at 12.7 ms for a
single-wall drag on the same fixture and session), D5 (pointer-move: wall-snap index derivation 173.2 /
231.3 ms p50 per accepted geometry on the all-curved fixture against 13.3 / 13.8 ms on the straight
control, and PROVABLY paid outside the synchronous release because the mark exceeds the class's own
release p50 — arithmetic, not inference) and D6 (post-release wait: 150.8–214.0 / 183.0–195.2 ms p50 on
the curved fixture against 23.0–56.0 ms on the straight one, a property of the FIXTURE, not explained by
the release and not bounded by the `browser-frame` proxy).
The corrected pair also exposed a FINDING THE REVIEW DID NOT RAISE: taken in a second browser session,
every row the corrections cannot touch moved by ×0.38–×1.03 with no code change. M1's absolutes are
SESSION-CONDITIONED, so the corrected whole-Room figures are published as a pair (212.8 / 377.1 Chrome,
241.9 / 505.0 Electron, all-curved) and any future before/after must be taken in one session. The
slice's findings survive in both sessions, and the fix/session split is stated per class in the
corrections record §2.4–§2.5.
Both candidate optimizations are PRODUCT code (mechanism owners unchanged: P26 §3.5 and the P23B.7
family), so the scope expansion they need is REPORTED and not taken; no product module, cache, Worker or
WASM path, no baseline and no ratchet was touched. Corrections + attribution record →
./pre-p23b.8-follow-up/2026-09-27-M1-R1-corrections-and-attribution-record.md.

## pre-P23B.8 follow-up — authorized D4/D5/D6 pass — 2026-09-27 (committed 2026-09-28; measurement only)

The owner authorized the three optimization directions as EXPANDED SCOPE for this PR and all three
"first moves" ran (DEV-only instruments; no product behavior, no cache, no Worker, no WASM, no baseline
and no ratchet). What came back changed two of the proposal's own premises:

- **D5 — the candidate was measured OUT and reverted.** The exact convex-hull + rotating-calipers extent
  sweep was implemented, proven output-identical to the shipped per-pair scan on every fixture, and then
  measured **up to 2.2× SLOWER** at the input the editor actually hands in (2,560 wall spans / 40 Walls /
  k ≤ 128 endpoints per Wall: 1.358 vs 0.898 ms p50 on the all-curved 40-wall fixture, interleaved arms).
  A live probe then showed what the cost IS: the same merge takes **43.7 ms over the live `$state`-proxied
  geometry and 3.6 ms over the same values as plain objects (12.1×)**, on an input shape identical to the
  fixture's, inside a `pointermove-rigid` of 114.3 ms. A copy-first fix does not pay (37.2 ms vs 27.0 ms).
  The fix therefore belongs to the identity the frozen baseline is stored under — the P23B.7
  preview-state family's ruling, not a change inside `layout-snap.ts`.
- **D4 — reuse already works, and the price is the comparison.** The new `prebuild-stats` row shows every
  whole-Room preparation reusing **36 of 40 Walls** and rebuilding exactly the 4 whose compiled wall
  changed (`compiled-wall-changed`); the four additive preparation marks place **61–68 ms of each 72–81 ms
  preparation in the per-Wall VALUE COMPARISON of the whole generation** and only 2.6–4.7 ms in the builds.
  The corrections record's "six FULL-GENERATION preparations" is corrected in place.
- **D6 — the falsifier came back NEGATIVE.** The runner's preflight now reports the idle presented-frame
  cadence: **481 frames in 8,000.1 ms, gaps p50 16.668 / p95 17.360 ms** (Electron 35.0.2, calibration
  residual 0.168 ms). The surface therefore paces at 60 Hz when idle, so the post-release wait is real
  work — not measurement-surface pacing. The cold live action that followed it is superseded by the
  steady-state split in the next entry.

P23B.8's compute-bound prerequisite stays **UNPROVEN**, now with three measured reasons. The queued
D4 · D5 · D6 items are routed WITH EVIDENCE to their existing owners (P26 §3.5; the P23B.7 family;
P26 P6/P1) and still need a ruling before product code moves. Record + limitations →
./pre-p23b.8-follow-up/2026-09-27-D4-D5-D6-live-attribution-record.md.

## pre-P23B.8 follow-up — restore-vs-commit split of the post-release wait — 2026-09-27 (committed 2026-09-28; measurement only)

Both M1 legs were re-run in steady state, in protocol, with the split instruments in place. **The answer
to "how much of the release-to-presented wait is the baseline restore versus the commit" is none of it:
0.0 ms of restore and 0.0 ms of commit AFTER a release, at p50 and p95, in all 38 class rows across both
runtimes.** Both families land INSIDE the release: the restore at **7.0–10.8 ms** on a whole-Room move
(0.1–3.6 ms on every other class) and the commit at **1.0–2.9 ms** there against 7.1–28.6 ms elsewhere —
the one class where the two invert, consistent with the bridge's edit having already landed during the
drag. The wait is therefore **1.6–5.3 ms of scheduling + the Plan render (17–52 % of it) + a tail of
47–78 % (Electron) / 43–59 % (Chrome) after the page's LAST attributed mark**, which lands p50 11–89 ms
in. That tail is real work the page shows no mark for, and pricing it needs the runner to keep trace
event DURATIONS — **DONE 2026-09-28, AND THE GUESS IT IMPLIED IS WRONG.** "It is where a
compositor/raster/present stage would sit" does not survive the durations: the wait is ~96–97 % page
JavaScript, contained in one Svelte runtime task per release, and on the curved fixtures it was mostly
the P23.13 Room-label placer's eligibility grid. See ./pre-p23b.8-follow-up/2026-09-28-post-release-window-attribution-and-room-label-fix-record.md. The pass also publishes the
containment record's own pool, because a window bounded by an action's span cannot see the second, once-
per-action restore chain that sits outside every span — that one prices at 0.2–0.9 ms of p50s, so the
bound is tight. In protocol the new preparation marks confirm D4 there: **6 `mesh-prebuild` per accepted
whole-Room action (49.2–70.6 ms p50, of which 33.9–63.0 ms is the comparison remainder) against 1 for a
single-Wall drag (7.3–12.7 ms)**, with `mesh-build` at 0.3–0.7 ms and `mesh-inputs` / `mesh-room-meshes`
at 0.0 ms. This SUPERSEDES the D4/D5/D6 pass's cold live observation that the post-release window
contains the restore. Record → ./pre-p23b.8-follow-up/2026-09-27-M1-release-to-presented-split-record.md;
captures → .../2026-09-27-M1-restore-split-chrome.json · .../2026-09-27-M1-restore-split-electron.json
(the earlier corrected pair is left untouched).

## pre-P23B.8 follow-up — why a whole-Room move pays per pointer move — 2026-09-27 (committed 2026-09-28; read-only trace)

The live impression and the measurements agree, so the remaining question was causal: is the room
gesture's per-frame cost required by changed geometry, or an identity accident? **Neither — and the two
halves differ.** A press inside a Room interior and a press on a canonical Wall are different code paths:
`LayoutPlanViewport.svelte:3455/:3484` starts a room-unit drag whose pointermove handler
(`:3730–3748`) restores the baseline snapshot and then re-derives and installs the whole document, so a
room move pays **6 restores + 6 preparations + 5 FULL compiles per accepted action** (9.9 + 70.6 + 31.0 ms
p50 on the all-curved fixture); a Wall press (`:3716`) runs `previewArchitectureEdit` — "one snap, one
proposal, one Plan update" — and compiles exactly **once**, at release, installing it as
`preview-compile-reused`. So the restore and the compile are per-move **by mechanism** (P23.6a: "the
candidate is always derived from the immutable baseline"), recompiling 100 % of the 40-Wall document for
a delta that in fact changes ≈**3.3 Walls**; the preparation's 62–68 ms is caused by the
**identity-keyed** mesh WeakMap, not by an unconsulted reference — the reference IS handed in
(`applyCompiledLayout:644`) and **≈36.7 of 40 Walls are reused per frame**. In protocol the wall move's
entire per-gesture heavy term is `snap-wall-index` at **190.0 / 170.7 ms** (D5's read amplification,
once per gesture), everything else under 15 ms — which is what "relatively smooth" looks like in marks.
Three candidate directions (provenance reuse · no compiled install per move · transform prepared
outputs) are product decisions under the P23B.5 ratchet and none was taken; no code changed in this
pass. Record → ./pre-p23b.8-follow-up/2026-09-27-room-move-reuse-trace-record.md.

A DESIGN SKETCH follows it (design only — no code, no authority) of the same room drag on the **Wall
drag's shipped transient contract**: pointerdown captures the immutable baseline, pointermove derives a
proposal and installs nothing, pointerup makes the one canonical planner call. The load-bearing
observation is that the release **already** re-derives from the release point against the frozen
baseline, so today's six per-move installs are preview-only and removing them cannot change what
commits — provided the room gesture's existing invariants (one history entry, invalid release commits
nothing, `no_op` silent, shared eligibility, byte-equivalence, installed-not-recompiled accept, cancel
paths, selection survival) stay unweakened and six new obligations are met, of which the first is an
open read: **who consumes the installed preview during a room drag** (the D4-2 question). Two behaviour
changes it cannot avoid — the original stays drawn under the overlay (the wall drag's accepted
precedent) and refusals only the full planner can see move to release — and that second trade is the one
to decide first. Sketch → ./pre-p23b.8-follow-up/2026-09-27-room-move-quick-sketch-design-sketch.md.

## pre-P23B.8 follow-up — external research reviewed against the code + the plan it implies — 2026-09-27 (committed 2026-09-28; review only, no code change)

An external research synthesis was obtained against the room-drag brief
(`./pre-p23b.8-follow-up/2026-09-27-external-research-brief-room-drag-preview.md`) and reviewed against
the shipped code before being trusted. Its conclusion — *gesture-scoped transient transform over the
frozen baseline, canonical compile + install once at release, no second geometry authority, no Worker,
no incremental compiler* — is **CONFIRMED**, and its two exclusions match our measurements. Three of its
assumptions were corrected by reading the code, and each one changes the plan:

- **There is no room-unit proposal and no room-unit preflight.** Core exports
  `proposeWallFirstArchitectureGeometry` and `preflightWallFirstArchitectureCandidate` (direct
  architecture edits) and `planWallFirstRoomMove` (the full planner) — nothing for room units. The room
  drag's pointermove handler calls **the full planner** (`LayoutPlanViewport.svelte:3744–3757`), which is
  why it pays 5 compiles + 6 preparations per action. So the synthesis's Slice A is **new core surface**
  (extending the wall-set intent is the smallest form: proposal and preflight share ONE intent→candidate
  mapping, so the sound-by-construction property is preserved) **plus** the viewport rewiring — not a
  viewport-local refactor.
- **The 3D consumer is resolved, in our favour.** `LayoutPreviewScene.svelte:83–89` prefers a transient
  bundle over the committed source and `Workspace3DView.svelte:419` wires it — but `Workspace3DView` is
  mounted in an **`{:else}`** branch (`EditorApp.svelte:2250`), so during a Plan room drag the 3D scene
  is **not mounted**. The presentation set is Plan-local, no translated mesh input is needed, and the
  sketch's "D4-2 read first" unknown is closed.
- **The refusal trade is not the trade the synthesis warns about.** Per move the room path writes
  `preview.statusMessage` on failure and sets `drag.candidateValid`, and the latter is **read by no
  production renderer** (asserted only in gesture tests). Today's live signal is the geometry itself — a
  fully recompiled candidate. So the fast path changes preview *fidelity*, not refusal colour, and needs
  no preflight at all: a proposal-only per move is strictly smaller and avoids re-introducing the
  `snap-wall-index` cost (173.2 / 231.3 ms p50 per gesture, the wall drag's entire heavy term) that the
  room path currently does **not** pay (grid snap only, `layout-interaction.ts:1448–1462`).

The reviewed plan is sequenced so the first step changes no product code (parity differential for rigid
translation · cost probe of the added per-move work · consumer census · per-gesture call-count baseline),
the core change carries core's owner authorization, and the two visible consequences (original stays
drawn under the overlay; live geometry fidelity) are owner decisions taken before building. The added
per-move cost is the plan's largest uncertainty and its stated falsifier. Worker/WASM and incremental
compilation stay excluded, exactly as the synthesis argues and as the measurements require. Review +
plan → ./pre-p23b.8-follow-up/2026-09-27-research-synthesis-review-and-plan.md.

## pre-P23B.8 follow-up — whole-Room drag implemented on the transient contract — 2026-09-27 (committed 2026-09-28; owner-authorized expanded scope)

The owner approved the reviewed plan and it was implemented. A whole-Room unit drag no longer
re-derives, compiles and installs the whole document on every pointermove: it draws a transient attempt
from the frozen baseline and compiles **once, at release** — where the shipped path already did, which is
why removing the per-move installs cannot change what commits.

**The plan's own P0 gate came back, and it is why this is admissible:**

- **P0.2 translation parity PASSES EXACTLY** — `compile(translated) ≡ translate(compile(baseline))`
  point-for-point (every moved Wall's samples, length, thickness, height, endpoints; every moved Room's
  floor polygon) over all four committed fixtures × three deltas, and the drawn attempt **is** that
  geometry rather than a second description of it (also exactly the baseline's samples shifted, so the
  canonical points are moved and never resampled).
- **P0.3 rotation parity FAILS at sampling density** — recorded, not worked around: a rotated isolated
  group compiles to the rigid image of its Rooms (vertex-exact) and preserves every Wall's length, but
  `samples(rotated)` and `rotate(samples)` do not agree on their **sample count**.
- **P0.4 added-side cost 136–197× below the removed side** — 0.391–0.581 ms of proposal against
  69.2–79.2 ms of planner + compile + prepare on the all-curved 40-Wall fixture, reproduced in the perf
  lane; committed as a ratio gate with a 5× floor, not an absolute budget.
- **P0.5 zero per-move work** — five pointermoves install nothing, leave the document byte-identical to
  the frozen baseline, replace no compiled geometry and write no history; the release commits exactly the
  planner's candidate for the **release** delta (proven against a different last-previewed position).

**Deviation, reported rather than hidden: rotation is NOT wired.** It has no reachable committable
wall-first target (the rotation handle reads the legacy Room registry, which is empty for a wall-first
document, and the legacy Room-unit path commits its last previewed candidate rather than re-deriving), and
its preview is not parity-equivalent anyway (§P0.3). The rotation surface exists in core, parity-evidenced
and routed to a slice that owns a rotation release re-derive.

> **SUPERSEDED 2026-09-28 — this deviation is closed.** The owner reversed P23.14 Decision 7 and the
gesture is wired with a release re-derive; the P0.3 result is kept and answered by resampling (see the
follow-up entry below and §3 of the follow-ups record).

The planner's candidate construction is now extracted as `roomUnitMoveCandidate` and **shared** by the
planner and the preview, so the two cannot describe different geometry; the drag carries its moving set
frozen at pointer-down; the attempt draws in the pending token language composed inside the refusal
annotation. The legacy path is untouched. Reviewer-visible consequences (the original stays drawn; the
group's moving-bounds highlight no longer follows the cursor; refusals appear at release) are listed in the
record.

Gates on this tree: `check` 0/0 (editor) and 0 errors (`layout-core`) · `test` 363 files / 5,142 passed
(was 360/5,129) · `test:arch` 23/254 · `test:heavy` 8/92 · `test:perf` 9/64 · `build` ok · the 17 shipped
room-move gesture invariants pass **unmodified**. One existing test was changed deliberately and
strengthened: `plan-refusal.test.ts`'s source-text guard now asserts the nested composition order. A new
wiring guard (each path called exactly once, read from the viewport's source) caught a real defect before
it shipped — two gesture-exit sites cleared `roomUnitSnapshot` without clearing the attempt, which would
have left a stale attempt after a project replacement; both now clear it.
**Confirmed live, one real gesture:** driving a whole-Room drag through the harness host on the real
viewport (DEV, Chrome, owner-40-curved, ladder zoom 19.29 px/m) paid **one bounded proposal per
pointermove** (4 moves → 4 `room-unit-proposal`, 0.5–1.4 ms) with **zero compiles and zero preparations
per move**, drew the pending-language ghost beside the committed ink (5 polylines while the pointer was
down, 0 after release), then reached the canonical path **exactly once per gesture** (1 `preview-compile`
52.6 ms · 1 `mesh-prebuild` 12.2 ms), reported "Moved room", and was undone by exactly **one** history
entry. **The live M1 protocol FRAME SERIES / before-after was NOT run at that point** — a same-session
before needs a pre-change tree and every M1 absolute is session-conditioned, so the improvement was
established as a mechanism, a unit-level ratio and a live per-gesture call-count accounting, not as a
browser frame series. No cache, no Worker, no WASM, no baseline or ratchet
write. Record → ./pre-p23b.8-follow-up/2026-09-27-room-move-transient-implementation-record.md.
**FOLLOW-UP 2026-09-28 — the protocol can now take a before/after in ONE session, and did.** The M1
driver gained a DEV-only BEFORE/AFTER ARM: the whole-Room class interleaves the shipped `transient`
path with the pre-change `per-move` path (still reachable behind one DEV switch, so no pre-change tree
is involved), and the record reports each arm's own rows and the signed delta. Measured live in one
session on the real viewport (DEV, Chrome, owner-40-curved-v1, ladder zoom 19.29 px/m): 4 pointermoves
cost **4 `room-unit-proposal` / 0 `preview-compile` / 0 `mesh-prebuild` / 40.2 ms** under `transient`,
against **0 / 4 / 5 / 1006.6 ms** under `per-move`, with the release unchanged at 1 compile + 1
preparation on both arms — a 25× move-phase difference taken as a within-session comparison, never a
cross-session one. Two now-unused per-move signals the transient drag left behind were deleted: the
`drag.candidateValid` flag (written but read by no production renderer) and the baseline-anchored
per-member group-bounds highlight (superseded by the gesture's own moving-unit attempt). Room-drag
ROTATION was then WIRED on the owner's ruling, which reversed the ratified P23.14 Decision 7 (scope A of
the two the record offered): core gained `planWallFirstRoomRotation` (same isolation policy, same
candidate mapping, same canonical gates as the move planner) and its overlay partner, the editor gained
`previewWallFirstRoomRotation` and `transientRoomUnitRotation`, so the rotate branch installs nothing per
pointermove and the **release re-derives one candidate at the release ANGLE** against the frozen
baseline, exactly as translation re-derives the release DELTA; the arm and handle are now reachable for a
wall-first Room, anchored to the COMPILED outline instead of the empty legacy registry, and the shipped
negative test was rewritten to assert the reversal alongside what survives it. The P0.3 sampling-density
result is kept: it rules out drawing a rotation by rotating the baseline's canonical points, so the
attempt RESAMPLES the rotated centerline through the release's own sampler — which the new differential
asserts makes the drawn attempt the release's candidate point-for-point. **The frame series the earlier
entries left open now exists**: the arms protocol was run end to end on the Chrome leg (19 class rows,
4,457 presented frames, clock residual 0.265 ms), splitting the whole-Room class into 40 accepted actions
per arm across the four committed fixtures with release coverage 1 in both — `transient` p50 **17.2 ms**
with 19.9 % of in-drag callback intervals ≥ 50 ms against `per-move` p50 **166.2 ms** with 82.0 % ≥ 50 ms,
cleanly separated on every fixture, with the unchanged release as the control (p50 13.6–30.5 vs
13.7–27.0 ms) and the mechanism visible as 1.00 vs 5.00 `preview-compile` and 1.00 vs 6.00
`mesh-prebuild` per accepted action. Stated limits: the Electron leg was not spent, and the long-frame row
is the class's window (identical across both arm rows), so it is read as class-level.
Record → ./pre-p23b.8-follow-up/2026-09-28-room-drag-follow-ups-record.md · frames
→ ./pre-p23b.8-follow-up/2026-09-28-M1-arms-chrome-leg.json.

## pre-P23B.8 follow-up — the post-release window priced by name, and the Room-label cost found in it — 2026-09-28 (committed 2026-09-28; instrument + the slice's first PRODUCT change)

The release-to-presented split left 43–59 % (Chrome) / 47–78 % (Electron) of the post-release wait
unexplained because the runner kept trace event INSTANTS and not durations. With durations in place the
wait is ~96–97 % JavaScript and it is CONTAINED in one Svelte runtime task per release: the window's
script row is a single anonymous function whose definition site is `deps/chunk-AI5TZSIZ.js:739:20`
(Svelte 5's microtask-flush wrapper), present in 20/20 windows at p50 143.4 ms of a 149.6 ms window on
`p23b-40-wall-all-curved-v1` and 20.1 ms of 26.6 ms on straight, with NO APP FRAME named inside it — a
`FunctionCall` span's duration includes everything it calls, so the trace can name the container and
nothing else. Two instruments therefore closed it: the script rows now carry the definition site (line +
column) and are keyed by it, and a **V8 CPU profile** was added (`--cpu-profile`, 1,000 µs sampling,
self time per frame, sliced into each class's own windows, with the two clocks' relation REPORTED rather
than assumed — the profile starts 272 ms before the trace's own calibration marker and ends 4.5 s after
the closing one, elapsed time between anchors on one clock).

**What was in the window: the P23.13 Room-label free-space placer's eligibility grid.** On all-curved
`rigid-wall-drag` the placer's rows are 57.4 % of the window's sampled time (`edgeDistance` 39.5 %,
`pointStrictlyInside` 10.2 %, `polylineDistance` 5.9 %), and whole-run `edgeDistance` is 49,764 ms —
17.11 %, the largest row of the entire 285-second profile. The mechanism is a product of two counts: the
mask grid is capped by cells (≥ 8 px, 24,000 max) while a CURVED Room's boundary polyline is not, so
every cell was paying the exact distance to every vertex of its own boundary plus every protected edge.

**The fix is a product change** in `apps/editor/src/lib/editor/layout/plan-room-labels.ts`, five
decision-neutral edits: a bounding-box lower bound that prunes the point-to-polyline distance; the
closed-polygon walk without its per-cell `[...polygon, polygon[0]]` copy; an early exit once a cell's
slack is already negative (the magnitude of a discarded cell is read by nothing, which is what made most
of that arithmetic DISCARDED arithmetic); active-text inflation hoisted out of the per-cell loop plus a
one-pass bbox; and the even-odd inside test computed PER ROW as a crossing table (same orientation, same
expression, so it agrees bit for bit) with each cell's answer the parity of crossings strictly to its
right, plus four direct BFS visits instead of a per-cell neighbour array. Measured across three legs of
the same protocol and flags: the distance loop 17.11 % → **9.96 %** of sampled run time, the inside test
4.40–5.66 % → **0.26 %**, and the placer's share of the post-release window 57.4 % → **41.0 %**
(all-curved), 52.1 % → 37.9 % (room-creation-commit), 25.1 % → 12.7 % (owner-curved), 7.1 % → 4.4 %
(straight). End-to-end the all-curved windows fall 17–49 % (room-creation-commit p50 213.7 → 116.7 ms).
Stated limits: three back-to-back sessions, so only within-run shares and within-window composition are
compared — the third leg's own window column is NOT read as a delta because its run took 354.7 s of
sampled time against the second's 236.5 s and the one class the last change cannot touch moved 23.7 →
65.9 ms; a sampled profile is not an instrument (inlined callees stay on their inliner); and the
end-to-end proof still needs ONE SESSION with both code paths, which is the DEV arm pattern the room drag
already uses. Parity: `check` 0/0, 365 test files / 5,181 tests, `test:arch` 23/254, and the placement
suite is the teeth — re-introducing the far-edge bound fails 16 of its 28 pre-existing tests — with the
two new curved-room tests stated as coverage rather than teeth because they pass against the wrong bound
too.
Record → ./pre-p23b.8-follow-up/2026-09-28-post-release-window-attribution-and-room-label-fix-record.md.

## pre-P23B.8 follow-up — the Room-label placer's before/after arm, measured in ONE session — 2026-09-28 (committed 2026-09-28; DEV arm + runner rows)

The record above closed with one open item: the end-to-end proof needs ONE SESSION with both code paths.
**The placer now has that arm, and the delta is measured.** `--label-arms` runs the shipped
`pruned-grid` against the pre-change `per-cell-grid` (kept verbatim, reachable only under DEV +
`__P2311_PERF__`) INTERLEAVED PER ATTEMPT, and — unlike the room drag's arm, which is confined to the
class it changed — in EVERY class, because the placer runs on every Plan render. The arm is recorded
against the action the attempt RESOLVED to, so the runner splits each class's post-release windows by
exactly that index: a window whose action recorded no arm is DROPPED and counted, never assigned. The
same split is re-priced from the CPU profile with `arm::class` buckets through ONE shared sample walk.

**One session, Chrome 152 headless, 19 classes, 25 attempts per class, 4,415 presented frames,
calibration residual 0.131 ms.** All-curved 40-wall window p50 (before → after): **219.4 → 149.4**
(`bend`), **215.8 → 146.4** (`rigid-wall-drag`), **145.6 → 100.1** (`room-creation-commit`),
**150.0 → 102.3** (`wall-authoring`), **169.4 → 114.8 ms** (`whole-room-move-bridge`) — ratio **0.68**
on every class. Owner-curved −8.7…−10.2 ms and connected −18.9…−19.6 ms: the three curved fixtures order
themselves by how much boundary the grid has to measure. **The falsifier behaves like one**: on the
straight fixture, where the grid has no long curved polyline, the same arm moves −1.7 / −2.2 / +1.4 /
−2.8 ms (0.95–1.02), with the pre-change arm's `edgeDistance` at 95.7 ms against the shipped arm's
0.0 ms. In self time over the same windows: all-curved 9,884 → **6,732 ms** sampled, `edgeDistance`
3,890.5 → **898.5**, the per-cell inside test 1,006.8 → **0**, the per-cell distance helper 691.6 →
**0**, replaced by the prune's own `segmentLowerBound` 0 → 932.7 and `polylineDistance` 0 → 586.1, GC
274.5 → 226.6.

Coverage and parity are read from the capture itself: every measured action accepted in both arms in all
19 classes, `unassignedWindows` 0 everywhere (the 10/10 and 12/11 splits are the arithmetic of 25
alternating attempts), and the class's MIXED release p50 landing exactly on the shipped arm's last
window — where the median of two separated halves must land. The placement identity is asserted, not
inferred: both arms place identical labels, readouts and sticky memory over 8 fixtures (256-vertex ring,
concave face, every mask class, three zoom regimes, a frozen gesture). One caveat stated in the record:
the whole-run profile row is still dominated by the OLD code (`edgeDistance` 27,487 ms / **12.17 %**, the
largest row of the run) because it spans BOTH arms — a mixed population, and the per-arm slice is the
readable version of the same number. Still open: the placer remains the largest single consumer inside
those windows, so the next lever is unchanged and now one run away — the grid's existence per placement,
not another inner-loop constant — and this arm has no Electron leg.
Record → ./pre-p23b.8-follow-up/2026-09-28-room-label-arm-before-after-record.md · capture
→ ./pre-p23b.8-follow-up/2026-09-28-M1-label-arms-chrome-leg.json.

## pre-P23B.8 follow-up — the grid's walk seeded and its terms ranked, and the price of the grid's existence — 2026-09-28 (committed 2026-09-28; product change + two legs)

The arm closed with the placer still the largest single consumer inside the post-release windows, so the
grid's own walk was next — and the same arm measured it the same day. Each term's distance walk is now
**seeded with the slack already found**: `seededPolylineDistance` returns the exact distance, or `null`
when the term cannot come in below the seed, so a term that cannot bind is never measured and a cell the
cheap terms already reject never walks a curved boundary at all. Whole GROUPS of segments are pruned in
bulk against a per-polyline bounding box, and the terms are visited **cheapest-segments-first** — a
two-part change, because the falsifier caught the first part alone. The first revision ran the mask first
and the Room's own boundary LAST, which is right when that boundary is a flattened 256-vertex curve and
wrong when it is a four-segment rectangle: measured at the scale the leg itself reports, that order is
**0.61–0.95×** on the straight shapes (0.70× at 50×50 cells) against **1.47–2.35×** for the ranked order,
with the curved shapes at 3.5–7.6×. A per-group index is likewise built only for a polyline with at
least 8 segments — the grid is built 8–72 times per accepted action and pays whatever that costs on
every one. Parity is asserted, not argued: every variant matched the previous engine cell by cell over
five shapes and three grid scalings (**0 eligible-value, 0 sign mismatches**), and the arm's parity suite
requires identical labels from all THREE grids now interleaved (the shipped `seeded-grid`, the previous
`pruned-grid`, the pre-change `per-cell-grid`) over 8 fixtures incl. the sticky-memory second pass.

**Two legs, Chrome 152 headless, three arms interleaved per attempt in every class, signed pair
`seeded-grid` − `pruned-grid`.** All-curved 40-wall post-release window p50 **113.1 → 94.9** (`bend`),
**107.8 → 94.9** (`rigid-wall-drag`), **104.5 → 92.5** (`room-creation-commit`), **111.1 → 81.7**
(`wall-authoring`), **102.9 → 91.3 ms** (`whole-room-move-bridge`) — **0.73–0.89 on all five classes**,
the CPU slice agreeing (the placer's own self time per accepted action **13.30 → 9.24 ms** across all 19
rows; the pre-change grid reads 33.34). Owner-curved 0.89–0.99 and connected 0.71–0.90. **The falsifier
reads 0.92–1.03** on the straight fixture — and the REJECTED first revision is committed as its own leg
at **1.00–1.10** rather than quietly rewritten, because that reading is what shows the falsifier is
discriminating and that what it caught was the term order, not the seeding. Calibration residual
0.062 ms, 4,418 presented frames, `unassignedWindows` 0 in all 19 rows.

**The next lever is priced, not spent.** A counter that travels with each attempt's arm record shows the
grid is built **8–72 times per accepted action** (40 on all-curved `bend`, 30 on the straight rigid drag,
72 on `room-creation-commit`) against **5–6 `p2311:plan-render-model` renders per accepted action**, at
≈0.6 ms per build on the all-curved fixture — so the whole grid budget there is ≈**24 ms per accepted
action**, and the grid's *existence* is where the remaining money is. What is NOT measured is the
**redundant share**: the counter counts builds, not repeated inputs, and a memo over inputs that never
repeat would remove nothing while adding a correctness surface. No memo, no cache and no key were added;
counting the key-hit rate is the next pass's first step. Still open: the placer remains the largest single
consumer inside those windows, and this arm still has no Electron leg.
Record → ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-ranked-walk-and-reuse-budget-record.md · the
shipped leg → ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-ranked-walk-chrome-leg.json · the rejected
revision's leg → ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-first-revision-chrome-leg.json.

**The redundant share is now measured, and the pass stopped at the measurement.** One leg of the same
protocol (Chrome 152 headless, residual 0.833 ms, 4,434 frames, 479 recorded attempts, 0 without a sequence
and 0 disagreeing with their attempt's build count) keys every grid build over the inputs that determine it
— the projected polygon, the mask with its clearances, the semantic centre, hashed over each coordinate's
**exact bits** — and records each attempt's builds **in arrival order**. Of **14,680 builds**, **4,376
(29.8 %)** rebuilt byte-identical inputs: **27.0 %** straight, **32.3 %** all-curved, **28.8 %** owner,
**31.5 %** connected; **15.3 %** (`room-creation-commit`) to **50.0 %** (`whole-room-move-bridge`) per class.
The structure is the finding: every accepted action builds the fixture's Rooms once and then rebuilds a
**trailing subset** of them (half, or all) from identical inputs — so **no repeat is adjacent** and a 1- or
2-entry cache hits **zero** times on every class, while a cache that holds the pass (4 entries on the
smallest fixture, 16 on the largest here) captures all of them, i.e. the size it needs is the **Room count**
(4–61 keys per attempt), not a constant. The straight fixture is **not** a falsifier here and the record says
so: this is a rate, and every fixture repeats. **No memo, no cache and no key reached the product path AT THAT
POINT**, and nothing the editor did changed then — **SUPERSEDED: a cache does reach the product path now**, see
"IT IS NOW SHIPPED" below, so do not quote that sentence as current. What the number justifies — a cache outliving one `placeRoomLabels` call,
sized by the Room count, keyed by a hash shipped into the product, correct only while that hash covers every
grid input the grid ever grows, ceiling ≈**9 %** of the all-curved `bend` window — is not a local concern of
the placer. **The census then named the pass, in the same session, DEV-only, with no product code changed:** a
second leg records one entry per `placeRoomLabels` call — Rooms, `reason`, memory, entry time, and the range of
the attempt's build order it produced — giving 479 actions, **2,692 calls (5.62 per action)** and **14,388
builds with 4,084 repeats (28.4 %** against the first leg's 29.8 %, which is the reproducibility bound). **100 %
of the repeats come from calls after the action's first, the first call of every action repeats nothing, and all
479 actions end with a `lod` call that built a grid for every Room and was 100 % repeats.** The shape is
identical in all 19 classes: a live `lod` pass, the gesture frames in `frozen` (**ten grids across 965 calls** —
the placer already knows how to say *unchanged, do not rebuild*), a `geometry` pass that re-optimises the settle,
then that trailing `lod` pass **14–36 ms later over byte-identical inputs**. So the redundancy is one extra
**planning pass** per accepted action, not scattered repeats — and the grid half is proven while the placement
half is not. **Then the pass was priced**, same session, DEV-only as before: a third leg times every call from its
entry to its **one exit**, so the call's duration is the whole pass — its grids *and* the placement around them.
p50 by call group: the action's first `lod` **4.9 ms** · middle `lod` 7.5 · middle `geometry` 8.5 · **`frozen` (no
grid builds) 0.8 ms** · **the trailing `lod` call 8.5 ms**. The trailing pass is **6,324.8 of 23,962.5 ms of
measured placer wall time — 26.4 %** — and against the same session's own per-arm window rows it is **24.3–35.9 %**
of the curved post-release windows (all-curved 27.3–35.9 %, connected 24.3–32.8 %, owner 9.0–15.1 %, straight
5.4–17.6 %; `bend` p50 **25.4 ms of a 92.6 ms window**). The `frozen` row says where the money is: those calls walk
the same Rooms and build essentially no grid (ten grids across 965 calls) for **0.8 ms p50**, so ~7 of the trailing
pass's 8.5 ms p50 is the grid rebuild rather than the placement walk. For scale, the previous pass's kept change
bought **18 %** of the `bend` window, so this is the largest single remaining item this thread has priced inside
those windows — and it is **a whole extra pass, not a fraction of one**. **On the table, not taken:** classify the
trailing pass as unchanged (a render-path change) or give the placer a result-level memo (cross-call state keyed by
a shipped input hash); and "skippable" still rests on identical inputs plus the placer's purity, because the
capture does not record the pass's placement output — a DEV-only digest of each call's labels would show it.
**Then the pass's output was digested**, same session, DEV-only: each call now also carries `labelsDigest` (every
label's Room id, tier, both anchors, accepted rectangle, lines and the readout — what a render paints) and
`memoryDigest`. Against the pass before it: **inputs equal 479/479 = 100 %**, but **labels equal only 229/479 =
47.8 %** — 0 % on both 40-wall fixtures, 100 % on `connected-curved-grid-v1` and four of five `owner-40-curved-v1`
classes. **Identical grid inputs do not imply identical labels**, because the placement has an input the grid key does
not cover: the sticky `memory` the previous pass just wrote. That **refuses both easy fixes** — a result-level memo
would paint the previous pass's labels, and skipping the pass would paint nothing — and leaves **exactly the grid**,
where identical key ⇒ identical grid necessarily, whatever else differs. A grid-level memo keyed by the grid's own
inputs is therefore the only reuse that preserves the placement that genuinely differs, and its ceiling was put at
≈7.7 of the trailing pass's 8.5 ms p50 (≈24 % of measured placer wall time, ≈24–33 % of the curved windows).
**That reuse was then built — as a FOURTH DEV ARM, so it is priced before it ships.** `memo-grid` is not a fourth
grid but the SAME `seeded-grid` behind a content-addressed cache of the candidates, keyed by the grid's own exact
inputs, cleared per attempt and bound at 256 entries; the cache lives in the DEV instrument module, so the product
module keeps its single arm read and gains no cross-call state, and the arm can only change how MANY times a grid is
built, never which one — parity with `seeded-grid` is therefore by construction, asserted as such with a test that
also proves the memo HIT. In one four-arm leg (Chrome 152 headless, residual 0.120 ms, 4,426 frames, 19 class rows)
the arm recovers **half the placer's self time** — 1108.4 ms → 548.9 ms, the grid functions in it 983.4 ms → 487.3 ms,
read from the per-arm profile because the key counts cannot show a cache hit — and is worth a **median 15 %** of the
post-release window (median of the 19 class p50s 38.50 → 36.08 ms, faster in **17 of 19** classes, **−15 % to −20 %**
on the all-curved fixture; the same leg's `seeded-grid` → `pruned-grid` control reproduces the previous pass's kept
change at 0.882). That is **less than the ≈24–33 %** the trailing pass's own p50 bracketed, because the memo skips
that pass's BUILDS and not its placement. **IT IS NOW SHIPPED.** The reuse was promoted into the shipped path, behind its own bounded cache:
`plan-room-labels.ts` owns one `Map` keyed by the grid's own exact-bit inputs (the key moved out of the arm
instrument into its own module, so a shipped path is not keyed by a module whose job is to measure it — the
instrument imports the same function and primitives, so there is exactly one implementation), bounded at 256
entries with oldest-first eviction, and **self-invalidating** — the grid reads the projected polygon, the mask and
the centre and nothing else, which is exactly what the key hashes, so a hit means identical inputs and therefore an
identical grid. No invalidation owner, no shared store, no new dependency; the legacy `pruned`/`per-cell` grids
never consult it. The arm that measured it became **`no-memo-grid`** (the same grid with the cache BYPASSED), so
`seeded-grid` — the AFTER side and the shipped path — now includes the cache and the signed pair reads as shipped
versus pre-change. Output identity is asserted BEFORE the timing: the parity differential runs the shipped path
against the bypass on **every** fixture, each case requiring both that the cache was exercised and that the two
place identical labels and sticky memory. In the promotion leg (Chrome 152 headless, residual 0.134 ms, 4,420
frames) the bypass reproduces the pre-promotion shipped path to within 1 % (pooled grid-function self time 991.5 ms
against the memo leg's 983.4; `bend` p50 85.1 against 88.1), and the shipped path's post-release window p50 is
**0.694** of the bypass median — **0.630** all-curved, 0.636 connected, 0.899 owner, 0.851 straight — faster in
**19 of 19** classes, with the grid functions' self time inside those windows falling **991.5 → 1.5 ms**. **Limit,
stated with the number:** the protocol repeats one action per class, so a persistent cache also collects
cross-attempt hits — the per-attempt-cleared memo leg read 0.849 against this leg's 0.694 — so that difference
belongs to the cache outliving the attempt and to the workload's repetition, not to a claim about an arbitrary
session; what generalises is the within-settle reuse above (~15 % of the window).
**AND THAT LIMIT WAS THEN MEASURED INSTEAD OF LEFT STANDING.** A second workload runs the same five classes again
under the `p23b-m1-cold:` prefix with one pan before every attempt, its direction advancing by the golden angle —
a PAN and not a zoom, so the projected polygon is translated and the placer does the same work per action with only
the cache key moving. One leg carries both workloads (Chrome 152 headless, 439 s, residual 2.335 ms, 10,656
frames, 38 class rows), so the two readings are a within-leg comparison. The workload check, from the class-scoped
key histogram: **563 distinct keys became 13,044** and the worst single key went from being rebuilt **118 times**
to at most **6**, while the within-attempt reuse §5 measured is KEPT (28.2 % against 35.4 %, the cold side higher
because it renders the camera move inside the attempt). Post-release window p50, shipped ÷ bypass, median per
fixture: straight 0.829 → **0.958**, all-curved 0.620 → **0.804**, owner 0.875 → **0.960**, connected 0.621 →
**0.859**, all 19 classes 0.739 → **0.872** — faster in **19 of 19 in both**, so the cache neither washes out nor
regresses. Mechanically the grid functions' self time falls 970.0 → 0.0 ms on the repeat workload (100 % skipped)
and 977.4 → 479.7 ms on the cold one (**50.9 %**): **about half the grid work the shipped cache skips is
within-settle reuse any session gets, and about half was the geometry recurring.** **THE CACHE STAYS**, and the
repeat-loop number stops being the headline: a per-attempt lifetime would need a NEW invalidation owner (a hook in
the render path) to buy back a difference that exists only inside a loop, and the cold pass IS the bounded case in
effect — a per-attempt-cleared cache and this one are the same thing whenever the geometry does not recur. So
§15's 0.694 and this leg's 0.739 are **repeated-workload** ratios and must be quoted as such; the number a session
can count on is **≈0.87 (about 13 % of the window), 0.80 on the all-curved fixture**. Limits: 5–6 windows per arm
per class; the 2.335 ms clock residual is larger than the straight fixture's cold delta (0.6 ms), which is
reported as inside the noise; the cold pass is the LOW end of a bracket and not a simulation of a user.
Record → ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-reuse-rate-record.md · the rate leg →
./pre-p23b.8-follow-up/2026-09-28-room-label-grid-reuse-rate-chrome-leg.json · the census leg →
./pre-p23b.8-follow-up/2026-09-28-room-label-grid-call-census-chrome-leg.json · the priced leg →
./pre-p23b.8-follow-up/2026-09-28-room-label-grid-pass-cost-chrome-leg.json · the identity leg →
./pre-p23b.8-follow-up/2026-09-28-room-label-grid-result-identity-chrome-leg.json · the memo leg →
./pre-p23b.8-follow-up/2026-09-28-room-label-grid-memo-chrome-leg.json · the promotion leg →
./pre-p23b.8-follow-up/2026-09-28-room-label-grid-promoted-cache-chrome-leg.json · the cold-workload leg (both
workloads in one run) → ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-cold-workload-chrome-leg.json.
(All legs above are RETAINED IN THE WORKING TREE and deliberately NOT COMMITTED since the closeout
below — owner ruling; regenerable from the recorded runner commands. Do not read "committed" or
"LIVE" beside any of them as current.)

## pre-P23B.8 follow-up — expanded-scope closeout — 2026-09-29 (owner accepted; routine `slice-closeout`)

The owner reviewed the expanded-scope branch and ruled GREEN on the performance improvement, then
ruled an audit (findings before fixes) and ruled the three items that needed a ruling. The slice is
CLOSED: one PR for the whole follow-up (#97 — M1 + R1 + every authorized expanded-scope pass);
merge is the owner's action, method squash, recovery via `refs/pull/97/head`. Per the follow-up's own
precedent no prose is compacted and no stub is created — the records, the local-only captures and the
acceptance record (which carries the audit findings, the rulings, the expanded-scope acceptance with
reused gate evidence, the residual ledger, the entry points and the preservation report) stay at their
own paths in ./pre-p23b.8-follow-up/.

What closed it, beyond the sections above: the audit fixes (harness `buildsPerAction.p50` median-vs-max
regression-pinned · label-anchor ownership of the shared cache entry, guard-verified · call-site gating
of the placer's instrument recording · core `rotatePointAbout` exported with the transient overlay drawn
through it) and the owner rulings (rotation yaw INHERITED by associated objects, legacy convention —
the contract test that pinned the old behaviour asserts the ruled one · BEFORE-side instrument code
kept for future legs, prune condition is harness retirement · the thirteen compact captures de-committed
to local-only evidence). Landed product behaviour: the transient room drag, the placer grid cache, the
rotation path with yaw inheritance. Gates reused on the accepted head `f4611aa0`: check 0/0 · build
editor + museum ok · visitor bundle 3 server / 9 client · test 366 files / 5,220 passed (2 + 4 skipped) ·
arch 23/254 · perf 9 + 1 skipped · heavy 8/93. Accepted head `f4611aa0`; tag
`closed/pre-p23b.8-follow-up` (local only — not pushed). NEXT: P23B.8's entry gate — this slice entered
nothing into it beyond the queued-item evidence it produced; the queued items' before-P23B.8 condition
still applies. The routine closeout re-ran no gate: it reuses the recorded acceptance evidence.

## P23B.8 closeout — 2026-09-29 (owner accepted; routine `slice-closeout`)

P23B.8 EXECUTED S1–S5 on the `p23b.8-rust-wasm-evaluation` branch and CLOSED as its expected
negative: the residual-cost ledger (S1) shows no stage both material and compute-bound, so
the D-0 gate FAILS (S2 — a successful outcome, no further enquiry), and D-A (Worker) and
D-B (Rust/WASM) are both recorded NOT JUSTIFIED with the unmet entry conditions (S3/S4).
D-A0's superseded-result obligations are recorded either way for any later async work, and
the record states the evidence that would re-open either decision. The owner ratified the
negative finding in chat 2026-09-29 ("stays unjustified for now"), ordered the docs-only
closeout with no lane re-runs, and authorized the merge — that ruling is the X-2
ratification. No product code, test or harness changed on the branch; the follow-up
expanded-scope gates are reused uninvalidated. Decision + acceptance record (ledger,
decisions, obligations, reopen conditions, reused gates, residual ledger, entry points,
preservation report) → ./p23b.8-rust-wasm-evaluation/2026-09-29-P23B.8-decision-record.md;
the plan stays live beside it as the procedure of record. Tag `closed/p23b.8` (local only).

## Owner-authorized execution routing amendment — 2026-09-29 (P23B.8 follow-up)

FIFTH amendment (the "> SEQUENCE is owner-approved" note above counts four): with P23B.8
closed, the owner ordered every remaining parked item addressed in ONE follow-up
implementation slice — P1 · D8 · D9 · D10 · trailing-`lod`-pass disposition · BEFORE-side
prune · probe deletions · Electron arm leg · plus D5-identity and D6-compositor mechanism
attempts — on one new branch and in one PR, between P23B.8 and P23B.9. This amendment
changes order only: P23B.9's gate coverage extends to whatever the follow-up ships, and
P23B.8/P23B.9/P23B.10 slice identities and gates are unchanged. The follow-up ships only
under its own ratified plan; P23B.9 and P23B.10 stay unratified and unauthorized.

## P23B.8 follow-up closeout — 2026-09-29 (owner accepted; routine `slice-closeout`)

The follow-up EXECUTED S0–S10 on the `p23b.8-follow-up` branch (13 commits, one per
checkpoint) and was REVIEWED AND ACCEPTED by the owner with all four calls confirmed as
presented: lod (a) UNCHANGED · D10 ruling stands · S6 REVERT · S9 STAY. Landed: fresh
Chrome arms legs (S0; Electron dropped by ruling) · P1 differential (S1) · D8 comparison
(S2) · D9 mapping retirement (S3) · D10/lod records (S4/S5) · D5 falsifier + revert (S6) ·
compositor-absence record (S7) · BEFORE-side prune (S8) · full-contract coverage (S10).
Routine `slice-closeout` ran on the branch, and the closeout commit stays inside the
slice's single PR (#101) — no new PR, no new scope. The slice is CLOSED: the plan + 12
records stay LIVE as P23B.9 gate evidence (P23B.8 exception precedent, not drift; P23B.10
closeout compacts); preservation report in the acceptance record at
./p23b.8-follow-up/2026-09-29-P23B.8-follow-up-acceptance-record.md. Merge method squash
(owner merges; branch commits are not ancestors of `main` post-merge, so recovery runs
via `refs/pull/101/head`); recovery tag `closed/p23b.8-follow-up` (local only — not
pushed). The routine closeout re-ran no gate: it reuses the recorded acceptance evidence
(fast 331/4,821 · arch 23/254 · heavy 8/93 · perf 9+1 · check 0/0 · builds ok ·
visitor-bundle 3/9). NEXT: P23B.9 (unratified, unauthorized — starts only on the owner's
ratification); P23B.10 stays unratified.

## Owner-authorized execution routing amendment — 2026-09-29 (P23B.9 start + P23B.10 compaction)

SIXTH amendment: the owner authorized starting P23B.9 on branch `p23b.9-gate` (one PR)
and compacted P23B.10 into the same branch/PR (closeout-only, no separate branch:
P23B.10 C2 is satisfied by P23B.9's same-HEAD gate run; C3–C7 land in the same PR).
Gate-criteria acceptance stays at P23B.9 S5 / X-2 review. Unchanged: no automatic phase
close, no merge, and major-phase closure stays owner-invoked via the manual
`phase-closeout` skill (P23B.10 MR-12/X-3/X-4). Slice identities/scopes/gates otherwise
unchanged.

## P23B.11 closeout — 2026-09-27 (owner accepted; routine `slice-closeout`)

P23B.11 was REVIEWED AND ACCEPTED by the owner with no remaining blocker: the review fix `2a5efeb1`
(M-3's soundness precondition on the shared function, the wall-dissolve OR-1 row, the S5 caller
reach) was approved, and the pre-P23B.8 decision doc + this README's SEQUENCE amendment +
`operations/current.md` baton (committed as `dcd3682f`) were approved and added to the slice's PR
#95. Routine `slice-closeout` ran on the `P23B.11` branch, and the closeout commit stays inside the
slice's single PR (#95) — no new PR, no new scope. The slice is CLOSED: the plan, umbrella and the
S1 · S3 · S4 · S5 · S6 · S7 · review-fix records are path-preserving closed stubs at their own
paths; the three JSON capture records stay LIVE as cited machine-readable evidence; and the
preservation report is recorded in the closed S7 stub (the slice's QA/acceptance record). Accepted
head `dcd3682f` (review-fix head `2a5efeb1`, production-behaviour head `e0237c8d`); recovery tag
`closed/p23b.11` (local only — not pushed); merge method squash (repo policy — the owner merges the
slice's single PR; branch commits are not ancestors of `main` post-merge, so recovery runs via
`refs/pull/95/head`, recorded in the stubs). NEXT: the pre-P23B.8 follow-up (owner-routed
2026-09-27; M1 + R1; starts only on the owner's go); P23B.8 stays unauthorized. The routine closeout
re-ran no gate: it reuses the recorded acceptance evidence. Every recorded anchor is a verified
ancestor of the tag target.

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
    (SHIPPED 2026-09-26; path-preserving closed stub carrying the delivered mechanisms, the final
    contract, the rulings, the entry points, the residual ledger and the recovery lines; accepted
    head `354f9b6f`, tag `closed/p23b.6` local only) · per-record closed stubs sit in the same
    directory — S1 attribution · S1a post-S-R re-gate · S3 strict-comparator (historical) · S3
    comparator reconciliation · S3 integrated probe (historical) · S3 guard recheck · S6 final
    evidence (acceptance record · reused gates · preservation report) · release-delay diagnosis
    (candidate evidence for the owner-routed P23B.11); the directory's nine JSON measurement records
    stay LIVE (S1 attribution · S1a DEV/PROD · S1b final-head + coverage · S3 data)
  p23b.7-interaction-optimization/2026-09-22-P23B.7-interaction-optimization.md
    (SHIPPED 2026-09-25; path-preserving closed stub carrying the §0.9/§0.10 rulings, the stage
    summary, the acceptance evidence, the residual ledger and the preservation report; per-record
    closed stubs sit in the same directory — S4 · S6 · S7 · S7 follow-up · correction; accepted head
    `ee0dbecd`, tag `closed/p23b.7` local only) ·
  p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-capture.json
    (LIVE, not closed work — machine-readable cited evidence; SHA-256 `95790b00…`) ·
  p23b.8-rust-wasm-evaluation/2026-09-22-P23B.8-rust-wasm-evaluation.md
    (SHIPPED and closed 2026-09-29 — decision only; D-0 FAIL, D-A/D-B NOT JUSTIFIED;
    decision + acceptance record → ./p23b.8-rust-wasm-evaluation/2026-09-29-P23B.8-decision-record.md;
    tag `closed/p23b.8` local only) ·
  p23b.9-correctness-performance-gate/2026-09-22-P23B.9-correctness-performance-gate.md
  p23b.10-phase-closeout/2026-09-22-P23B.10-phase-closeout.md
  p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-wall-chain-release-delay-umbrella.md
    (SHIPPED and closed 2026-09-27; closed routing stub) ·
  p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-wall-chain-release-delay.md
    (SHIPPED; closed plan stub carrying the delivered mechanisms, the accepted contract, the entry
    points, the residual ledger and the recovery lines; accepted head `dcd3682f`, tag
    `closed/p23b.11` local only) · per-record closed stubs sit in the same directory — S1 profile ·
    S3 short-circuits · S4 gate · S5 identity early-out (the authoritative caller reach) · S6 M-4 ·
    S7 re-measurement (the slice's QA/acceptance record + preservation report) · review fix; the
    three JSON capture records stay LIVE (S1 profile · S1 classes · S7 profile)
  pre-P23B.8 follow-up decision doc (owner decisions recorded 2026-09-27; M1 + R1 RATIFIED scope;
    queued items with the before-P23B.8 condition) →
  ./2026-09-27-pre-P23B.8-follow-up-decisions.md
  pre-P23B.8 follow-up plan (RATIFIED, EXECUTED and CLOSED 2026-09-27 — the M1 protocol on both
    runtimes, the R1 ranking method, and the two separable DEV-only instrumentation items; executed
    head `b6f2203b` on a clean tree; measurement and ranking only) →
  ./pre-p23b.8-follow-up/2026-09-27-pre-P23B.8-follow-up-plan.md
  P23B.8 follow-up plan (PROPOSED, unratified — parked items, one PR; implementation
  unauthorized until ratified) →
  ./p23b.8-follow-up/2026-09-29-P23B.8-follow-up-plan.md
  pre-P23B.8 follow-up records (S2 Chrome leg · S3 Electron leg + pair tables · S4 M1 session —
    gesture frames · presented frame · long-frame incidence · D7 · D13 · R1 ranking · acceptance
    record + preservation report) → ./pre-p23b.8-follow-up/
  pre-P23B.8 follow-up local-only captures (regenerable runner output, RETAINED IN THE WORKING
  TREE, deliberately NOT COMMITTED since the expanded-scope closeout — owner ruling; each record
  carries the runner command that regenerates its leg) →
  ./pre-p23b.8-follow-up/2026-09-28-M1-arms-chrome-leg.json (the arms run: per-arm frame series and the
    within-session before/after) · ./pre-p23b.8-follow-up/2026-09-28-M1-label-arms-chrome-leg.json (the
    Room-label arm leg: per-class `labelArms` assignment, per-arm window rows and the per-arm CPU slice)
  · ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-ranked-walk-chrome-leg.json (the shipped seeded,
    ranked, index-gated grid: the three-arm `labelArms` rows with the signed pair `seeded-grid` −
    `pruned-grid`, its per-arm CPU slice, and each class's `buildsPerAction` grid-build budget) ·
  ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-first-revision-chrome-leg.json (the REJECTED first
    revision's leg, kept because its straight-fixture reading is what made the falsifier discriminating) ·
  ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-reuse-rate-chrome-leg.json (the repeat-rate leg: every
    recorded attempt's `byAction[].keySequence` in arrival order, each class's grid-build key histogram with
    its repeat count, and the `buildsPerAction` budget beside them) ·
  ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-call-census-chrome-leg.json (the census leg, carrying the
    same plus `byAction[].labelCalls`: one entry per `placeRoomLabels` call with its Rooms, `reason`, memory,
    entry time and the range of the attempt's build order it produced — which is what attributes each repeat
    to the call that built it) ·
  ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-pass-cost-chrome-leg.json (the priced leg: the same
    `labelCalls` plus `durationMs`, each call's wall time from entry to its one exit — which is what prices the
    trailing pass against the same session's windows) ·
  ./pre-p23b.8-follow-up/2026-09-28-room-label-grid-result-identity-chrome-leg.json (the identity leg: the same
    `labelCalls` plus `labelsDigest` and `memoryDigest` — which is what shows that identical grids do NOT mean
    identical labels, and narrows any fix to reusing the grid alone)
  · ./pre-p23b.8-follow-up/2026-09-27-M1-restore-split-chrome.json ·
  ./pre-p23b.8-follow-up/2026-09-27-M1-restore-split-electron.json
  pre-P23B.8 follow-up M1 LEG captures — `2026-09-27-M1-{chrome,electron}-leg.json` — are RETAINED IN
  THE WORKING TREE and deliberately NOT COMMITTED (exact repository-root `.gitignore` paths, reason
  stated there, with the thirteen legs above since the closeout): ~40k pretty-printed runner lines
  each. Every row any record is cited for is in the records above, and the S2/S3 records carry the
  runner commands that regenerate them.
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
P26 — re-derived as T1 after F (not the primary next action) → ../p26-spatial-depth/README.md
P23 (closed, evidence only) → ../p23-layout-depth/README.md
```

```text
DEPENDS ON: P23 closed 2026-09-22 (wall-first Plan editor minimum, one canonical geometry compiler)
EXECUTION ORDER: pinned by phase README depends-on, not by P-number order
PIPELINE POSITION: P23 → P23B → F → T1–T4 tracks (ratified 2026-09-27; see ../README.md)
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
P23B.6  rendering optimization — SHIPPED and closed 2026-09-26 (one PR for the slice: #93; the
        closeout commit stays inside it; accepted head `354f9b6f`; tag `closed/p23b.6`, local only;
        merge method squash, owner merges). RATIFIED and implementation AUTHORIZED
        2026-09-25; S3 M-3m additionally authorized in PR #93 on 2026-09-26. Delivered S-R (raw
        wholesale-replaced compiled generation/model; A-2 met) and S3 M-3m (state-free prepared-
        mesh reuse inside the existing weak generation cache; net positive on all four accepted
        fixtures after the owner-directed guard recheck), with the H-1…H-6 retention proof and the
        H-7 contract P26 inherits. Plan and records are path-preserving closed stubs at their own
        paths; the nine JSON measurement records stay LIVE. Overall interaction improvement is NOT
        established: the final all-curved Whole-Room and Wall-authoring release increases remain
        unresolved — P23B.11 attributed the wall-chain share and they are now owner-routed to the
        pre-P23B.8 follow-up (M1).
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
        of        `main` post-merge; recovery runs via `refs/pull/92/head`, recorded in each stub).
        NEXT: P23B.6 — SHIPPED and closed 2026-09-26 (PR #93; accepted head `354f9b6f`).
        P23B.8 stays unauthorized.
P23B.8  conditional Worker + Rust/WASM evaluation (decision only; "not justified" is a valid close) —
        SHIPPED and closed 2026-09-29 (decision record at its own path in
        ./p23b.8-rust-wasm-evaluation/; D-0 FAIL, D-A/D-B NOT JUSTIFIED, owner-ratified;
        tag `closed/p23b.8`, local only)
P23B.9  correctness + performance-regression gate — PLANNED, unratified
P23B.10 phase closeout gate (makes P23B CLOSABLE; closure stays owner-invoked) — PLANNED, unratified
P23B.11 wall-chain release-delay follow-up — SHIPPED and closed 2026-09-27 (one PR: #95; accepted
        head `dcd3682f`; closed stubs at their own paths; tag `closed/p23b.11`, local only; merge
        method squash, owner merges, recovery via `refs/pull/95/head`). M-1 exact pair short-circuits
        and M-3 the identity condition landed in `buildCorrespondenceComponents` (M-2 is the X-4
        blocked case); M-4 threads the wall-chain plan's accepted compile into the commit install.
        The wall-chain release the S1 profile attributed has moved; the browser/node gap and P23B.6's
        final-capture increases remain unresolved and are owner-routed to the pre-P23B.8 follow-up
        (M1). Sequenced before P23B.8; P23B.8 and P26 gates unchanged.
```

**Other owner decisions still open:**

```text
1  Accept, part-return or require a review of the separate P23B.2 research evidence.
2  Resolve the umbrella's remaining open calls when their owning slices reach those gates (device profiles,
   enforced budgets, P23 Decision 13, Rust/WASM authorization and any numeric target).
```

**Startup stop:** a reader has what this phase currently needs once status, the SEQUENCE block, the phase
gate and the ROUTE block are read. P23B.3a, P23B.0, P23B.4, P23B.5, P23B.6, P23B.7 and P23B.11 are
shipped and closed (each with its own closed stubs, anchor and tag); the P23B.1 harvest and P23B.2
research report retain their own review statuses. The pre-P23B.8 follow-up (M1 + R1 plus the authorized
expanded scope) is EXECUTED, owner-accepted and CLOSED — records, local-only captures and acceptance
record → ./pre-p23b.8-follow-up/; tag `closed/pre-p23b.8-follow-up`, local only. P23B.8 is
SHIPPED and closed 2026-09-29 (decision record at its own path in
./p23b.8-rust-wasm-evaluation/; D-0 FAIL, D-A/D-B NOT JUSTIFIED, owner-ratified; tag
`closed/p23b.8`, local only). NEXT is the owner-authorized P23B.8 follow-up: ONE
implementation slice addressing every remaining parked item (P1 · D8 · D9 · D10 ·
trailing-`lod` disposition · BEFORE-side prune · probe deletions · Electron leg · D5/D6
mechanism attempts) on one branch in one PR, under its own ratified plan — P23B.9's gate
covers whatever it ships. P23B.9 and P23B.10 remain unratified and unauthorized; P26
implementation and validation remain gated. Later
optimization slices remain downstream of the shipped P23B.4 key grammar and its owner gate.

## Non-goals

```text
no new architectural capability or view      no mandatory Rust/WASM migration
no schema or persisted-format change         no premature repository split or new package boundary
no reopened P23 scope or decisions           no Phase 0 execution, audit or cycle change here
```
