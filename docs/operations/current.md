# Current

PHASE: P23B — geometry performance & stabilization (P-level status → ../roadmap/README.md)
CHILD: P23B.11-wall-chain — SHIPPED and closed 2026-09-27 (owner REVIEWED AND ACCEPTED with no
       remaining blocker; one PR for the slice: #95; routine `slice-closeout` inside the same PR;
       accepted head `dcd3682f`; merge method squash (owner merges); post-merge recovery via
       `refs/pull/95/head` — the tag is local only). Delivered M-1 (exact pair short-circuits in
       `buildCorrespondenceComponents`: group check first, inflated-bbox prune,
       containment-before-overlap) and M-3 (the room-neutral identity condition; ambiguous faces
       refused), with M-2 recorded as the X-4 blocked case; M-4 threads the wall-chain plan's
       accepted compile into the commit install. The wall-chain release the S1 profile attributed
       has moved (all-curved Wall-authoring 944.5 → 88.6 ms p50, correspondence 828.7 → 0.2).
       Overall interaction improvement is still NOT established: the browser/node gap and P23B.6's
       unresolved final-capture increases were owner-routed to the pre-P23B.8 follow-up's M1
       measurement, which has now run (see the next line). No numeric target proposed.
CHILD (closed, between P23B.11 and P23B.8): pre-P23B.8 follow-up — EXECUTED and CLOSED 2026-09-27
       (measurement + ranking only; the owner's explicit go was given and the plan's scope is what ran).
       M1: ONE protocol, ONE session, TWO runtimes (headless Chrome 152.0.7977.54 and Electron 35.0.2
       / Chromium 134) under the same fixtures, classes, 25-accepted-action rule, three-frame settle,
       1500×1000 DPR 1 viewport and 19.292586186549904 px/m ladder; both captures settled with ZERO
       dropped boundaries and both taken at executed head `b6f2203b` on a clean tree. It reports BOTH
       D1 rows as a comparison only (all-curved Wall-authoring 141.9 ms p50 Chrome / 165.2 Electron;
       all-curved Whole-Room 300.0 / 353.8 — P23B.6 S1b's 3,601.2 / 493.4 are NOT reproduced: a
       finding, not a fix, and the increases stay UNRESOLVED), the drag-attached gesture-frame series,
       release → next presented frame at full coverage (214–292 ms p50 on all-curved Chrome, 229–350
       Electron, against 31–66 ms on the straight control — where the previously reported
       `browser-frame` PROXY read 5–40 ms on the same releases), long-frame incidence, D7's post-fix
       `commit-capture` (0.8–3.1 ms p50 from the classes that carry the mark; ABSENT, with a reason,
       in the two authoring classes on both runtimes) and D13's coverage limit noted beside the
       session. R1: ONE ordered ranking from the closed S7 keyed capture — canonical compile, then
       room-geometry-compile, then mesh-prebuild (self-time only where priceable) — with NO mechanism
       chosen. Two DEV-only instruments landed and NO product module was touched (test-enforced); no
       threshold, target, budget metric, baseline or ratchet read or written; the connected case
       stayed advisory (excluded from D1/D7 by construction, with a test). Records, the two LIVE
       captures and the acceptance record → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/
       (plan STATUS amended in place, executed head `b6f2203b`, evidence anchor `58a139f2`, tag
       `closed/pre-p23b.8-follow-up` local only). NEXT: P23B.8's entry gate.
RATIFIED DIRECTION (2026-09-27): the Biskiq northstar decision record is ratified and
       routed at ../reference/decisions/northstar-ratification-2026-09-27.md; the authority
       rules and the live contracts were reconciled in the same change set (AGENTS.md rule 10,
       docs/README.md, north-star, architecture, component contracts, roadmap). This
       reconciliation authorizes NO implementation and closes no phase. F — foundation
       contracts — is owner-ratified (2026-09-27, with amendments: Camera splits in the
       same cutover as the Experience order migration; exact interfaces land via F
       amendments in shared code; extensions declare required/optional): the target
       contract F.1–F.5 lives at ../reference/composition-execution.md and authorizes no
       implementation. Capability re-planning re-derives against it; P24/P25/P26 existing
       plans remain pre-redesign evidence re-derived as T2/T3/T1. The ratified decision record is
       normative for all new design and outranks conflicting pre-ratification text (AGENTS.md
       rule 10); landed contracts keep describing current behavior until their explicit cutover.
STAGE: P23 closed 2026-09-22 (PR #73). P23B executes the owner-ratified SEQUENCE between P23 and P26
       (order + four amendments → phase README §SEQUENCE). Shipped and closed, each with closed
       stubs, recovery anchor and tag routed from the phase README: P23B.3a · P23B.0-durable ·
       P23B.4 · P23B.5 · the measurement-only step · P23B.7 · P23B.6 · P23B.11 · the pre-P23B.8
       follow-up (M1 + R1). P23B.1 and P23B.2 retain their own review statuses. NEXT: P23B.8's entry
       gate — the pre-P23B.8 follow-up that came before it RAN and closed without entering anything
       into it (see CHILD above), and the queued items' before-P23B.8 condition still applies.
       P26 planning is re-derived as T1 against F
       (see RATIFIED DIRECTION); P26 implementation is unauthorized and its validation window is
       selected but not open.
       Architecture cycle: PHASE_1 installed, no owner action required.

NEXT:
1. P23B.8'S ENTRY GATE — the next step on the SEQUENCE. The step that preceded it, THE PRE-P23B.8
   FOLLOW-UP (owner-routed 2026-09-27, executed between P23B.11 and P23B.8), is EXECUTED and CLOSED:
   its RATIFIED SCOPE was ONE measurement session (M1 — gesture frames plus
   release-to-next-presented-frame on the heavy curved layout, headless Chrome AND Electron under one
   protocol) and ONE release-cost ranking (R1 — canonical compile, then the install's
   room-geometry-compile, then mesh-prebuild; produced after M1, as ruled). It entered nothing into
   P23B.8's decision and set no threshold; its records, two LIVE captures and acceptance record →
   ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/. QUEUED BY NAME: P1 randomized M-3
   differential + test/DEV-side invariant · D4 whole-Room move measurement (mechanism stays with P26
   §3.5) · D5 topology/snap/hit-test measurement (mechanism stays with the P23B.7 family) · D6
   adapter/GPU + Plan-template measurement (mechanism stays with P26 P6/P1) · D8 heap-retention
   comparison (no redesign) · D9 dormant S6-mapping cleanup · D10 cache/interning ruling only · D13
   baseline coverage limit (noted beside M1). Withdrawn: P3, D11, D12 (the blocked M-2 case stays
   recorded). Decisions → ../roadmap/p23b-geometry-performance/2026-09-27-pre-P23B.8-follow-up-decisions.md.
   Plan (RATIFIED, EXECUTED and CLOSED — M1 both-runtime protocol · R1 ranking method · two separable
   DEV-only instrumentation items; executed head `b6f2203b`; measurement and ranking only) →
   ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-pre-P23B.8-follow-up-plan.md.
   BEFORE-P23B.8 CONDITION: every queued item must be ratified, or explicitly routed to P23B.8 / P26,
   before P23B.8 entry — nothing reaches P23B.8 undecided.
2. Standing constraints:
   - the v5 baseline is test-enforced and `bench:record` is its only writer — never rewrite it; the
     accepted partial baseline (W6 §10.3 disposition A) stands: no further capture, no settlement
     claim beyond its synchronous press/move-phase coverage limit. P23B.11 read and wrote neither the
     baseline nor the P23B.5 ratchet;
   - the P23B.5 reuse ratchet is LIVE and only `npm run reuse:record --reason "…"` may move it — no
     hand-edits or new budget metric. P23B.6's M-3m reuse lives in the EXISTING weak generation
     cache; do not add another cache, re-own the sample store, or claim P23B.5 release-scope M-3
     (still unreachable/unimplemented). Do not restart P23B.4 or reopen P23B.6 / P23B.11;
   - P23B.7's unstarted follow-ups stay named, not silently dropped: the snapshot guard's documented
     limits and the bounded heap-retention follow-up (no redesign proposed).
3. P23B.1 harvest review and the P23B.2 ACCEPT/PART-RETURN evidence decision remain open and separate;
   they do not reopen any shipped slice.
4. P26 planning is now re-derived as track T1 against F (see RATIFIED DIRECTION above): its
   current umbrella/candidate order is pre-redesign evidence, and its prototype journeys A–F
   remain the experience/QA authority. The accepted prototype authorizes neither implementation
   nor the validation window; the F target contract is owner-ratified (F.1–F.5, with
   amendments) and the next planning step is re-deriving T1/T2/T3 against it, independent of the
   P23B continuation (NEXT 1: the pre-P23B.8 follow-up has closed, so P23B.8's entry gate is next).
   No implementation is authorized.
5. P23 carries 13 owner-carried verification rows and 5 deferred debt items, named in its closed gate
   stub; P23B neither claims nor closes them. U-1 was DECLINED; Rust/WASM stays undecided until
   P23B.8.

ROUTE:
ratified direction · decision provenance (normative destination) → ../reference/decisions/northstar-ratification-2026-09-27.md
F composition/execution target contract (owner-ratified 2026-09-27 with amendments; no implementation authorized) → ../reference/composition-execution.md
F foundation-contract phase registration + status → ../roadmap/f-foundation-contracts/README.md
phase pipeline · P-level status → ../roadmap/README.md
P23B phase status · child order · SEQUENCE + amendments · closed stubs/anchors/tags → ../roadmap/p23b-geometry-performance/README.md
P23B.11 closed plan stub (delivered mechanisms · accepted contract · entry points · residual ledger · recovery) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-wall-chain-release-delay.md
P23B.11 closed acceptance stub (acceptance record · reused gates · the S7 measurement · preservation report) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-27-P23B.11-S7-remeasurement-record.md
P23B.11 closed step records (S1 profile · S3 short-circuits · S4 gate · S5 identity early-out · S6 M-4 · review fix) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/
P23B.11 LIVE measurement JSON records (S1 profile + classes · S7 profile) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/
pre-P23B.8 follow-up decision doc (owner decisions 2026-09-27; M1 + R1 ratified scope; queued items + condition) → ../roadmap/p23b-geometry-performance/2026-09-27-pre-P23B.8-follow-up-decisions.md
pre-P23B.8 follow-up records + plan (RATIFIED, EXECUTED and CLOSED 2026-09-27 — M1 session record · S2 Chrome leg · S3 Electron leg + pair tables · R1 ranking · acceptance + preservation record; executed head `b6f2203b`, evidence anchor `58a139f2`) → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/
pre-P23B.8 follow-up LIVE captures (M1 Chrome leg · M1 Electron leg — cited machine-readable evidence) → ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-chrome-leg.json · ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/2026-09-27-M1-electron-leg.json
docs startup boundary · update rules · skills → ../README.md
test contract + concrete commands → ../../apps/editor/tests/README.md
recorded v5 baseline (test-enforced; `bench:record` is its only writer) → ../../apps/editor/src/lib/bench/baselines/g3-baseline.json
LIVE P23B.5 reuse ratchet (only writer `npm run reuse:record --reason "…"`) → ../roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json
LIVE measurement-step capture (cited evidence) → ../roadmap/p23b-geometry-performance/p23b-measurement-only-step/2026-09-25-release-containment-capture.json
LIVE P23B.7 S6 capture (cited evidence) → ../roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-capture.json
P23B.6 closed release-delay diagnosis stub (candidate evidence P23B.11 consumed) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-release-delay-diagnosis.md
P23B.1 harvest (own review status) → ../roadmap/p23b-geometry-performance/p23b.1-internal-geometry-pipeline-harvest/2026-09-22-P23B.1-harvest-record.md
P23B.2 research report (own evidence decision) → ../roadmap/p23b-geometry-performance/p23b.2-external-geometry-performance-research/2026-09-22-P23B.2-external-geometry-performance-research.md
P26 planning + accepted direction (routes the prototype) → ../roadmap/p26-spatial-depth/2026-09-24-P26-continuous-spatial-authoring-umbrella.md
P23 (closed, evidence only incl. close record) → ../roadmap/p23-layout-depth/README.md
post-P23 debt → tech-debt/README.md

BLOCKER:
- The 2026-09-27 reconciliation authorizes no implementation. The F target contract is
  owner-ratified (F.1–F.5, with amendments); capability re-planning re-derives against
  it, and no implementation is authorized.
- P26 implementation readiness remains gated: planning is re-derived as T1 against F; the
  validation window is not open.
- The P23B.2 ACCEPT/PART-RETURN evidence decision remains open and separate from every shipped slice.
- The pre-P23B.8 follow-up has EXECUTED and CLOSED (measurement + ranking only), so P23B.8 entry is
  now gated by the before-P23B.8 condition alone — every queued item must be ratified, or explicitly
  routed to P23B.8 / P26, before P23B.8 entry.
- P23B.6's final-capture all-curved Whole-Room and Wall-authoring release increases remain UNRESOLVED:
  M1 re-read both rows on both runtimes and did NOT reproduce them (a finding, not a fix, and no
  cause is claimed), and the browser/node gap still has no established cause. M1's own results are
  advisory — one machine, one DEV session — and create no budget or threshold.
- The P23B.7 snapshot-guard limits and the bounded heap-retention follow-up remain carried and
  unstarted.
