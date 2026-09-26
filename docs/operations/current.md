# Current

PHASE: P23B — geometry performance & stabilization (P-level status → ../roadmap/README.md)
CHILD: P23B.6-rendering — RATIFIED by the owner 2026-09-25 and implementation AUTHORIZED on branch
       `P23B.6` (plan §14; starting instruction §15). The owner explicitly authorized S3 M-3m in PR #93
       on 2026-09-26. The corrected integrated production preparation is net positive on all four
       accepted single-Wall fixtures; S3 M-3m is landed. The first guard-in-hot-loop loss is historical
       and superseded by the owner-directed guard recheck. Final S1b capture, coverage, X-2, routing,
       H-6/H-7 and the full repository contract are recorded in the final S6 evidence. This branch is
       ready for owner review; it is not slice acceptance. The implementer does not merge, accept or run
       `slice-closeout`. P23B.8 stays unratified and UNAUTHORIZED; P23B.9/P23B.10 are downstream gates.
       No numeric performance target is proposed.
STAGE: P23 closed 2026-09-22 (PR #73). P23B executes the owner-ratified SEQUENCE between P23 and P26
       (order · 2026-09-25 amendment → phase README §SEQUENCE). Shipped and closed, each with closed
       stubs, recovery anchor and tag routed from the phase README: P23B.3a · P23B.0-durable ·
       P23B.4 · P23B.5 · the measurement-only step · P23B.7. P23B.1 and P23B.2 retain their own
       review statuses. P26 planning continues in parallel; P26 implementation is unauthorized and its
       validation window is selected but not open. Architecture cycle: PHASE_1 installed, no owner
       action required.

NEXT:
1. Await owner review and acceptance decision for P23B.6. Do NOT merge, accept, run `slice-closeout`, or start P23B.8 work.
2. Standing constraints:
   - the v5 baseline is test-enforced and `bench:record` is its only writer — never rewrite it; the
     accepted partial baseline (W6 §10.3 disposition A) stands: no further capture, no settlement
     claim beyond its synchronous press/move-phase coverage limit;
   - the P23B.5 reuse ratchet is LIVE and only `npm run reuse:record --reason "…"` may move it — no
     hand-edits or new budget metric. P23B.6 M-3m uses the existing weakly keyed derived-mesh owner;
     do not add another cache, re-own the sample store, or claim P23B.5 release-scope M-3 (still
     unreachable/unimplemented). Do not restart P23B.4;
   - P23B.7's unstarted follow-ups stay named, not silently dropped: the snapshot guard's documented
     limits and the bounded heap-retention follow-up (no redesign proposed).
3. P23B.1 harvest review and the P23B.2 ACCEPT/PART-RETURN evidence decision remain open and separate;
   they do not reopen any shipped slice.
4. P26 planning may continue in parallel: reconcile its proposed architecture against landed P23B,
   resolve slice-specific decisions and prepare the implementation plan/proofs. The accepted
   prototype authorizes neither implementation nor the validation window.
5. P23 carries 13 owner-carried verification rows and 5 deferred debt items, named in its closed gate
   stub; P23B neither claims nor closes them. U-1 was DECLINED; Rust/WASM stays undecided until
   P23B.8.

ROUTE:
phase pipeline · P-level status → ../roadmap/README.md
P23B phase status · child order · SEQUENCE + order amendment · closed stubs/anchors/tags → ../roadmap/p23b-geometry-performance/README.md
active P23B.6 plan (scope · §8 order + admission rules · §9 acceptance · §14/§15) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-22-P23B.6-rendering-optimization.md
P23B.6 S3 owner authorization, corrected guard decision and integrated net-benefit tables → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-guard-recheck.md
P23B.6 final S1b capture, X-2, coverage, H-6/H-7, routing and verification → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S6-final-evidence.md
P23B.6 first integrated guard-in-hot-loop probe (historical, superseded) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-integrated-probe-record.md
P23B.6 early strict-comparator A-1 attempt (historical, superseded) → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S3-abandonment-record.md
P23B.6 merged curved Wall-authoring / Room-creation diagnosis and routing → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-release-delay-diagnosis.md
historical P23B.6 S6 checkpoint; superseded by final evidence → ../roadmap/p23b-geometry-performance/p23b.6-rendering-optimization/2026-09-26-P23B.6-S6-evidence-checkpoint.md
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
- P26 implementation readiness remains gated: planning may continue; the validation window is not open.
- The P23B.2 ACCEPT/PART-RETURN evidence decision remains open and separate from every shipped slice.
- P23B.6 implementation and evidence are complete on the branch; owner review and acceptance remain
  pending. No merge, acceptance or `slice-closeout` has occurred.
- The P23B.7 snapshot-guard limits and bounded heap-retention follow-up remain carried and unstarted.
