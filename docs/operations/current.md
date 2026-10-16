# Current

PHASE: T1.P01 — Stage and authoring foundation (registered 2026-10-15). First capability phase:
       shared F1/F3 interface providers (accepted), then the Stage/viewport host and the common local
       F4 provider, then restored bounded Layout precision. Phase README →
       ../roadmap/t1-spatial-world/t1.p01-stage-foundation/README.md.
CHILD: T1.P01.S01 — Shared interface providers — `shipped`: independently accepted at `ee463d0b`,
       closed 2026-10-16 by `slice-closeout`, merge-ready on `T1-P1-S1-implementation` (PR #126).
       It supplies `F1.reference@1:references-v1` and `F3.channels@1:inspection-v1` from
       `@portfolio/project-model` and installed the Accepted-capabilities / Requires readiness
       enforcement. Acceptance record (closed-work stub, with recovery) and plan →
       ../roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s01-shared-interface-providers/.
       T1.P01.S02–S06 stay `proposed`, each blocked by its own accepted prerequisites.
BATON: S01 is accepted and its routine closeout is complete on the branch; the next owner action is
       the merge of PR #126. Accepted readiness is claimable by a consumer only once it sits on the
       trusted base, so the F1/F3 rows are `accepted` on the branch while `main` carries the
       capability readiness only after the merge.
NEXT: merge PR #126 into `main` **as a merge commit (P1: no squash, no rebase** — a squash would make
      `ee463d0b` a non-ancestor of `main` and red the execution-structure gate's `Commit` column
      there), then verify `git merge-base --is-ancestor ee463d0b main` and the gate register at the
      trusted base. The next eligible T-track slices are then T1.P01.S02 and T1.P01.S03 — S01's
      accepted `F1.reference@1:references-v1` / `F3.channels@1:inspection-v1` satisfy their `Requires`;
      S04–S06 additionally require `F4.intent-acceptance@1:local-single-domain-v1`, which is not yet
      accepted. Each still needs its own owner authorization before implementation.
      ROUTE: ../roadmap/README.md (track + gate register) → ../roadmap/t1-spatial-world/README.md
      (phase register) → the phase README → ../operations/t1-spatial-world/README.md.
BLOCKER: none.
GATE: F1–F4 and `T1.viewport-projection` were ratified at version 1 (2026-10-15,
      ../reference/decisions/f-ratification-2026-10-15.md). `F1.reference@1` and `F3.channels@1` are
      now `accepted` for `T1.P01.S01`, each carrying its accepted capability scope
      (`F1.reference@1:references-v1`, `F3.channels@1:inspection-v1`) and a durable record; the other
      ratified rows keep empty evidence and no accepted capability. F5 and the T3/T4 cutovers remain
      undrafted, and the proposed F4/F2/F5 providers and `T1.viewport-projection` stay unassigned
      until their own phases register. Normative text → ../reference/composition-execution.md; the
      capability-level `Requires` distinction is enforced by the readiness rule S01 installed in
      ../roadmap/README.md's execution-structure gate.
CYCLE: `PHASE_1` · `ready` · the T1.P01 window is configured with T1.P01.S02, T1.P01.S04 and
      T1.P01.S05 (expected opener S02, terminal S05) and is **not open**: Opened by, exposure rows,
      Closed by and mechanism verdicts are empty. S01 is not a listed exposure, so this close opened
      no window. State and protocol → ./architecture-cycle.md (loaded only by its three hooks).
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
       Execution structure (Track → Phase → Slice, one writable owner per concern): lifecycle and the
       gate register → ../roadmap/README.md; track objectives, phase registers and Starting
       foundations → ../roadmap/{t1-spatial-world,t2-composition,t3-experience,t4-release}/README.md;
       operational runbooks → ./{t1-spatial-world,t2-composition,t3-experience,t4-release}/README.md;
       event procedures (track completion, product integration acceptance, bounded replanning) →
       ./README.md.
