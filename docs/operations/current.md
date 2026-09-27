# Current

PHASE: P23B — geometry performance & stabilization (P-level status → ../roadmap/README.md)
CHILD: P23B.6-rendering — SHIPPED and closed 2026-09-26 (owner REVIEWED AND ACCEPTED with no remaining
       blocker; one PR for the slice: #93; routine `slice-closeout` inside the same PR; accepted head
       `354f9b6f`; merge method squash (owner merges); post-merge recovery via `refs/pull/93/head` —
       the tag is local only). Delivered S-R (compiled generation and Plan model as wholesale-replaced raw
       references) and S3 M-3m (state-free prepared Wall-mesh reuse inside the existing weak
       generation cache, owner-authorized 2026-09-26), with the H-1…H-7 retention proof and the H-7
       contract P26 inherits. Overall interaction improvement is NOT established: the final-capture
       all-curved Whole-Room release (73.4 → 493.4 ms p50) and Wall-authoring release (2,147.0 →
       3,601.2 ms p50) increases remain unresolved and are owner-routed to P23B.11. No numeric
       performance target is proposed.
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
       plans remain pre-redesign evidence re-derived as T2/T3/T1.
STAGE: P23 closed 2026-09-22 (PR #73). P23B executes the owner-ratified SEQUENCE between P23 and P26
       (order + amendments → phase README §SEQUENCE). Shipped and closed, each with closed stubs,
       recovery anchor and tag routed from the phase README: P23B.3a · P23B.0-durable · P23B.4 ·
       P23B.5 · the measurement-only step · P23B.7 · P23B.6. P23B.1 and P23B.2 retain their own
       review statuses. P23B.11 is owner-routed and next; P26 planning is re-derived as T1 against F
       (see RATIFIED DIRECTION); P26 implementation is unauthorized and its validation window is
       selected but not open.
       Architecture cycle: PHASE_1 installed, no owner action required.

NEXT:
1. P23B.11 (wall-chain release-delay follow-up) is the next slice: only its minimal umbrella stub
   exists. Prepare its plan — a first browser profile separates the diagnosed pre-change
   correspondence bottleneck from the still-unresolved final-capture increases — and return for
   owner ratification and implementation authorization. Do NOT start P23B.8.
2. Standing constraints:
   - the v5 baseline is test-enforced and `bench:record` is its only writer — never rewrite it; the
     accepted partial baseline (W6 §10.3 disposition A) stands: no further capture, no settlement
     claim beyond its synchronous press/move-phase coverage limit;
   - the P23B.5 reuse ratchet is LIVE and only `npm run reuse:record --reason "…"` may move it — no
     hand-edits or new budget metric. P23B.6's M-3m reuse lives in the EXISTING weak generation
     cache; do not add another cache, re-own the sample store, or claim P23B.5 release-scope M-3
     (still unreachable/unimplemented). Do not restart P23B.4 or reopen P23B.6;
   - P23B.7's unstarted follow-ups stay named, not silently dropped: the snapshot guard's documented
     limits and the bounded heap-retention follow-up (no redesign proposed).
3. P23B.1 harvest review and the P23B.2 ACCEPT/PART-RETURN evidence decision remain open and separate;
   they do not reopen any shipped slice.
4. P26 planning is now re-derived as track T1 against F (see RATIFIED DIRECTION above): its
   current umbrella/candidate order is pre-redesign evidence, and its prototype journeys A–F
   remain the experience/QA authority. The accepted prototype authorizes neither implementation
   nor the validation window; the F target contract is owner-ratified (F.1–F.5, with
   amendments) and the next planning step is re-deriving T1/T2/T3 against it,
   independent of the P23B.11 operational continuation. No implementation is authorized.
5. P23 carries 13 owner-carried verification rows and 5 deferred debt items, named in its closed gate
   stub; P23B neither claims nor closes them. U-1 was DECLINED; Rust/WASM stays undecided until
   P23B.8.

ROUTE:
ratified direction · decision provenance (normative destination) → ../reference/decisions/northstar-ratification-2026-09-27.md
F composition/execution target contract (owner-ratified 2026-09-27 with amendments; no implementation authorized) → ../reference/composition-execution.md
F foundation-contract phase registration + status → ../roadmap/f-foundation-contracts/README.md
phase pipeline · P-level status → ../roadmap/README.md
P23B phase status · child order · SEQUENCE + amendments · closed stubs/anchors/tags → ../roadmap/p23b-geometry-performance/README.md
P23B.6 closed plan stub (delivered mechanisms · final contract · rulings · entry points · residuals · recovery) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-22-P23B.6-rendering-optimization.md
P23B.6 closed acceptance/evidence stub (acceptance record · reused gates · X-2 · H-6/H-7 · routing · preservation report) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S6-final-evidence.md
P23B.6 closed S3 records (comparator reconciliation · guard recheck · historical abandonment and integrated probe) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-guard-recheck.md (siblings in the same directory)
P23B.6 closed release-delay diagnosis stub (candidate evidence for P23B.11) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-release-delay-diagnosis.md
P23B.6 LIVE measurement JSON records (S1 attribution · S1a DEV/PROD · S1b final-head + coverage · S3 data) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/
P23B.11 wall-chain release-delay umbrella stub (routed next; implementation gated) → ../roadmap/p23b-geometry-performance/p23b.11-wall-chain-release-delay/2026-09-26-P23B.11-wall-chain-release-delay-umbrella.md
docs startup boundary · update rules · skills → ../README.md
test contract + concrete commands → ../../apps/editor/tests/README.md
recorded v5 baseline (test-enforced; `bench:record` is its only writer) → ../../apps/editor/src/lib/bench/baselines/g3-baseline.json
LIVE P23B.5 reuse ratchet (only writer `npm run reuse:record --reason "…"`) → ../roadmap/p23b-geometry-performance/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json
LIVE measurement-step capture (cited evidence) → ../roadmap/p23b-geometry-performance/p23b-measurement-only-step/2026-09-25-release-containment-capture.json
LIVE P23B.7 S6 capture (cited evidence) → ../roadmap/p23b-geometry-performance/p23b.7-interaction-optimization/2026-09-25-s6-commit-path-identity-capture.json
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
- P23B.11's plan, ratification and implementation authorization remain pending; its umbrella stub
  authorizes no code.
- P23B.6's final-capture all-curved Whole-Room and Wall-authoring release increases remain unresolved
  (owned by P23B.11; see its closed acceptance stub).
- The P23B.7 snapshot-guard limits and the bounded heap-retention follow-up remain carried and
  unstarted.
