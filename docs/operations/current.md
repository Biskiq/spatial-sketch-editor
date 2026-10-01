# Current

PHASE: F — foundation contracts (P-level status → ../roadmap/README.md;
       phase registration → ../roadmap/f-foundation-contracts/README.md)
CHILD: F.1–F.5 — the target contract is WRITTEN and OWNER-RATIFIED (2026-09-27, with
       amendments); NO IMPLEMENTATION IS AUTHORIZED. Normative text →
       ../reference/composition-execution.md. What remains is drafting each exact interface
       with its first consumer and ratifying it as an amendment — no track mints its own.
STAGE: P23 closed 2026-09-22; P23B CLOSED 2026-09-29 by owner invocation of `phase-closeout`
       (final gate P23B.10; P23B.9's correctness + performance gate accepted; all twelve
       children shipped and closed; the `SEQUENCE` block preserved byte-identically; cycle
       PHASE_1 unchanged — a same-state close, so no cycle write and no META pointer).
       P23B is shipped on `main`: **PR #103 merged 2026-09-29** — no merge hedge remains.
       Close record → ../roadmap/p23b-geometry-performance/p23b.10-phase-closeout/2026-09-29-P23B.10-closeout-record.md
       §PHASE CLOSE · phase close block →
       ../roadmap/p23b-geometry-performance/README.md (PHASE CLOSE).
SLICE: World | Experience shell design freeze — completed owner-directed design side
       sequence ([PR #111](https://github.com/Biskiq/spatial-sketch-editor/pull/111),
       2026-10-01; docs/design/assets only): finalized World and V2 Experience shell
       requirements are owner-promoted → ../reference/design-system/editor-shell-and-visual-system.md
       §0.8–§0.8.3 (PLATE: shared/World laws, Experience expression, explicit parked-task
       return) · ../roadmap/README.md visual-system sequence step 4 · design/QA records
       at ../../prototypes/world-experience-shell-round/README.md. Normative destination
       design only: no production code, no cutover, no F/T1 advance.
RATIFIED DIRECTION (2026-09-27): Biskiq northstar decision record →
       ../reference/decisions/northstar-ratification-2026-09-27.md (normative for new design).
       Pipeline after F: parallel tracks T1 Spatial/P26 (the selected validation window,
       planning only) · T2 Composition data/P24 · T3 Experience data/P25 · T4 Release, then
       editing UI on T1's viewport seam, creator/audience trials, the Source Baseline and
       P27–P30 (provisional). P26 implementation and validation remain gated.
NEXT: #112 — adopt the frozen unified shell into prototypes/spatial-authoring/ (preserve
       P26 journeys A–F and behavioral laws, then run executable/visual QA). Bounded
       prototype adoption: not production T1 implementation and not an F substitute. After
       #112 the special design/prototype detour closes and F exact-interface work resumes:
       F — draft and ratify the exact interfaces (reference/resolution result, unit header,
       project envelope, authoring intent with expected revision, release manifest) with each
       first consumer, as explicit amendments to the ratified contract.
BLOCKERS: none for F. Open owner decisions carried: phase-wide compaction of P23B's
       remaining landed plans and records (P23B.10 C4, an owner call) · P23B.1's and
       P23B.2's own review statuses · PLATE's own open calls (Motion-speed control
       placement, keyboard-focus treatment, the mat↔paper transition)
       → ../reference/design-system/editor-shell-and-visual-system.md §0.3, §0.7.6.
       #111's deferred implementation questions (internal-component selectable identity,
       shared-source/placement-override semantics, temporary World reading state alongside
       Camera/navigation history) → ../../prototypes/world-experience-shell-round/README.md.
CARRY: TD-4 (curved-fixture release-cost increases, unresolved) · TD-5 (the ~12×
       `$state`-proxy cost) · the P23B.8 follow-up's D5 residual + probes · the M1
       session-conditioning limitation (any before/after must be taken in ONE session) →
       ../operations/tech-debt/README.md.
