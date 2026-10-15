# Current

PHASE: T1.P01 — Stage and authoring foundation (registered 2026-10-15). First capability phase:
       shared F1/F3 interface providers, then the Stage/viewport host and the common local F4
       provider, then restored bounded Layout precision. Phase README →
       ../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md.
CHILD: T1.P01.S01 — Shared interface providers — `in-progress` (owner-authorized 2026-10-15),
       implemented on `T1-P1-S1-implementation` and awaiting independent review; no acceptance is
       recorded. It supplies `F1.reference@1` and `F3.channels@1` as `@portfolio/project-model`
       exports — including the bounded current-domain read adapters over the current
       Layout/Scene/read-only-Camera source — with conformance suites, and installs the
       Accepted-capabilities / Requires readiness enforcement in the arch lane's
       execution-structure gate. Plan →
       ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/implementation-plan.md;
       implementer-reported evidence (no acceptance, no gate promotion) →
       ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/acceptance.md.
       T1.P01.S02–S06 stay `proposed`, each blocked by its own accepted prerequisites.
BATON: #124 F-interface ratification merged (owner decision 2026-10-15) → T1.P01 registered and
       S01 authorized → S01 implemented → three review rounds' findings addressed on the same
       branch and re-verified (round three: an exact reference is matched against the snapshot's
       current-source content identity, not its acceptance token) → a foundation-hardening
       investigation fixed four invariants (a total reference order, set-valued equality in
       negotiation, and the Camera-output epoch ceiling and host-session qualification) and
       recorded four hypotheses rejected or bounded with contract evidence; independent review owed.
NEXT: independent review of T1.P01.S01 against its plan's acceptance criteria, on the tested
      revision the acceptance record names. Its `Consumes` and `Requires` are empty, so
      eligibility held with no prerequisite to satisfy, and it is not a listed cycle exposure,
      so no window hook applies. Review decides acceptance and whether `F1.reference@1` /
      `F3.channels@1` are promoted; then routine closeout → merge.
      ROUTE: ../roadmap/README.md (track + gate register) → ../roadmap/t1-spatial-world/README.md
      (phase register) → the phase README → ../operations/t1-spatial-world/README.md.
BLOCKER: none.
EXECUTION STRUCTURE (created by WP5, now live): Track → Phase → Slice with one writable owner per
      concern. Track and phase lifecycle and the gate register → ../roadmap/README.md. Track
      objectives, phase registers and Starting foundations →
      ../roadmap/t1-spatial-world/README.md, ../roadmap/t2-composition/README.md,
      ../roadmap/t3-experience/README.md and ../roadmap/t4-release/README.md. Operational runbooks
      → ./t1-spatial-world/README.md, ./t2-composition/README.md, ./t3-experience/README.md and
      ./t4-release/README.md. Event procedures (track completion, product integration acceptance,
      bounded replanning) → ./README.md.
GATE: F1–F4 and `T1.viewport-projection` are `ratified` at version 1 (2026-10-15,
      ../reference/decisions/f-ratification-2026-10-15.md); F5 and the T3/T4 cutovers remain
      undrafted. `F1.reference@1` and `F3.channels@1` name `T1.P01.S01` as their sole provider and
      keep empty evidence columns: S01's code and conformance exist, but no gate is `implemented`
      or `accepted` and no Accepted-capabilities entry is recorded before independent acceptance.
      The proposed F4/F2/F5 providers and `T1.viewport-projection` stay unassigned until their own
      phases register. Normative text → ../reference/composition-execution.md; the capability-level
      `Requires` distinction is enforced by the readiness rule S01 installed in
      ../roadmap/README.md's execution-structure gate.
CYCLE: `PHASE_1` · `ready` · the T1.P01 window is configured with T1.P01.S02, T1.P01.S04 and
      T1.P01.S05 (expected opener S02, terminal S05) and is **not open**: Opened by, exposure
      rows, Closed by and mechanism verdicts are empty. State and protocol →
      ./architecture-cycle.md (loaded only by its three hooks).
CARRY: Capability evidence and obligations → ../roadmap/t1-spatial-world/planning-evidence.md,
       ../roadmap/t2-composition/planning-evidence.md and
       ../roadmap/t3-experience/planning-evidence.md; T4's delivery obligations →
       ../roadmap/t4-release/README.md.
       Canonical design and non-blocking UX/3D coverage →
       ../reference/design-system/editor-shell-and-visual-system.md.
       TD dispositions (TD-1/TD-2 removed, TD-3 fixed, TD-4/TD-5 retired with the
       benchmark) → ./tech-debt/README.md.
       Recovery for the compacted #115 records — including the R115.S01 anchor degradation — → the
       acceptance stub at ../roadmap/parallel-track-cutover/acceptance.md; its `Recovery` section
       owns the routes.
