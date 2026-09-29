# Current

PHASE: P23B — geometry performance & stabilization (P-level status → ../roadmap/README.md)
CHILD: pre-P23B.8 follow-up (expanded scope) — SHIPPED and closed 2026-09-29 (owner green on the
       performance improvement; audit findings + three owner rulings landed; one PR for the whole
       follow-up: #97; accepted head `f4611aa0`, closeout commit on the same branch, tag
       `closed/pre-p23b.8-follow-up` local only; merge method squash, owner merges; recovery via
       `refs/pull/97/head`). Records, local-only captures and acceptance record (audit findings,
       rulings, reused gate evidence, residual ledger, entry points, preservation report) →
       ../roadmap/p23b-geometry-performance/pre-p23b.8-follow-up/ (closeout section in the phase
       README). Landed product behaviour: the transient room drag, the placer grid cache, the
       rotation path with yaw inheritance. No threshold, target, budget metric, baseline or ratchet
       read or written.
STAGE: P23 closed 2026-09-22. P23B executes the owner-ratified SEQUENCE between P23 and P26
       (phase README §SEQUENCE). Shipped and closed: P23B.3a · P23B.0-durable · P23B.4 · P23B.5 ·
       the measurement-only step · P23B.7 · P23B.6 · P23B.11 · the pre-P23B.8 follow-up
       (M1 + R1, then the expanded scope). P23B.1 and P23B.2 retain their own review statuses.
       Architecture cycle: PHASE_1 installed, no owner action required.
RATIFIED DIRECTION (2026-09-27): Biskiq northstar decision record →
       ../reference/decisions/northstar-ratification-2026-09-27.md (normative for new design);
       F foundation contract F.1–F.5 → ../reference/composition-execution.md (authorizes no
       implementation). P26 planning re-derived as T1 against F; P26 implementation unauthorized.
NEXT: P23B.8'S ENTRY GATE — unratified and unauthorized under its existing gate. The before-P23B.8
       condition still applies: every queued item (P1 · D4 · D5 · D6 · D8 · D9 · D10 · D13, plus the
       closeout residuals — trailing-`lod`-pass disposition, BEFORE-side prune at harness
       retirement, probe deletions when D5/mesh settle, an Electron arm leg if ever spent) must be
       ratified, or explicitly routed to P23B.8 / P26, before P23B.8 entry — nothing reaches P23B.8
       undecided. The gate decision itself is the owner's action.
