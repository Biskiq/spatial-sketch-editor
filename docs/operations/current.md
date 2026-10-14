# Current

PHASE: R115 — PR #115 architecture reset (frozen-lane isolation, aggressive pruning,
       parallel-track cutover). **CLOSED 2026-10-14** by explicit owner ruling
       (owner-invoked `phase-closeout`) → ../roadmap/parallel-track-cutover/README.md. The
       [track register](../roadmap/README.md#track-register) carries it as `shipped`.
       No phase holds capability work: no track phase is registered.
CHILD: R115.S01 — shipped 2026-10-14 (`slice-closeout`); its single child is the whole phase, and
       there is no active slice. Acceptance record → the closed-work stub at
       ../roadmap/parallel-track-cutover/acceptance.md (accepted body recoverable:
       `git show 6bd15aa2:docs/roadmap/parallel-track-cutover/acceptance.md`); plan of record →
       ../roadmap/parallel-track-cutover/implementation-plan.md.
BATON: #114 accepted unified design → #115 parallel-track planning cutover (WP0–WP7 executed;
       R115.S01 shipped, R115 closed) → the owner's next planning decision → foundation-gated
       production implementation.
NEXT: the owner's next planning decision. No track phase is registered, so nothing is authorized
      and there is no work package to start. Registering a first T-track phase — or invoking a
      product integration acceptance or a Baseline — is an owner decision.
      ROUTE: ../roadmap/README.md (track register + gate register) → the chosen track README →
      ../operations/<track>/README.md start step.
BLOCKER: none.
EXECUTION STRUCTURE (created by WP5, now live): Track → Phase → Slice with one writable owner per
      concern. Track and phase lifecycle and the gate register → ../roadmap/README.md. Track
      objectives, phase registers and Starting foundations →
      ../roadmap/t1-spatial-world/README.md, ../roadmap/t2-composition/README.md,
      ../roadmap/t3-experience/README.md and ../roadmap/t4-release/README.md. Operational runbooks
      → ./t1-spatial-world/README.md, ./t2-composition/README.md, ./t3-experience/README.md and
      ./t4-release/README.md. Event procedures (track completion, product integration acceptance,
      bounded replanning) → ./README.md.
GATE: F.1–F.5 target OWNER-RATIFIED; every gate in the gate register is `undrafted`;
      NO PRODUCTION IMPLEMENTATION AUTHORIZED. Normative text →
      ../reference/composition-execution.md. Each exact interface is drafted with its first
      consumer and ratified as an F amendment; track plans cannot mint independent formats or
      bypass their readiness gates.
CYCLE: `PHASE_1` · `awaiting-bounded-slice-window-plan` · the T-track spatial-foundation window is
      selected and not open. State and protocol → ./architecture-cycle.md (loaded only by its three
      hooks).
CARRY: Capability evidence and obligations → ../roadmap/t1-spatial-world/planning-evidence.md,
       ../roadmap/t2-composition/planning-evidence.md and
       ../roadmap/t3-experience/planning-evidence.md; T4's delivery obligations →
       ../roadmap/t4-release/README.md.
       Canonical design and non-blocking UX/3D coverage →
       ../reference/design-system/editor-shell-and-visual-system.md.
       TD dispositions (TD-1/TD-2 removed, TD-3 fixed, TD-4/TD-5 retired with the
       benchmark) → ./tech-debt/README.md.
       Recovery for the compacted #115 records — including the R115.S01 anchor degradation — → the
       acceptance stub above; its `Recovery` section owns the routes.
