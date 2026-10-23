# T1 — Spatial world: current baton

PHASE: T1.P02 Native Wall creation (registered 2026-10-22, batch E) →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md
       T1.P01 closed 2026-10-21; all its registered slices are shipped.
ACTIVE: none. T1.P02.S01 (Layout identity and format cutover) is implemented on
        `t1/p02-s01-layout-identity-format-cutover`; current implementation revision is
        `7e159370` and the acceptance record lists three adversarial review passes and the declared
        architecture-integration evidence. An explicit independent-review verdict on this revision
        is not recorded, so acceptance and closeout remain pending. Verification evidence and
        deviations:
        ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/acceptance.md
NEXT: Record an explicit independent-review verdict for the current S01 implementation revision,
      with every finding adjudicated, then the owner may accept and close S01. The §3 legacy Layout
      retirement must be separately scoped, registered and authorized, and land before S02. After
      S01 acceptance and that retirement, S02 still needs its own owner authorization and a complete
      plan drafted from its current outline before implementation; the owner then releases it, and
      S02 rechecks its base. The drawing policy is owner-accepted (E3). Hard performance rows run on
      the owner's MacBook Air M2, 16 GB (E6 amendment).
INHERITS: Layout format 6 only — readers refuse every other version, there is no migration or dual
      reader, and pre-baseline data is disposable. Identity is captured per operation outside the
      document and replayed by Redo; occupancy only refuses a captured id. Wall role is derived from
      Room boundary membership in the reconciled document and never persisted; the role planners are
      retired. Two allocators remain occupancy-derived and are declared out of §1:
      `nextWallCurveKnotId` and `nextInteriorAnchorId`, both unreachable from any accepted intent
      today and guarded by an arch boundary test — the first curve-authoring slice must capture them
      before curved drawing ships.
CARRY: SEPARATE AND STILL OWED: (1) the §3 legacy Layout types/`layout-codec`/`layout-room-frame`
      and `compileLayoutGeometry` retirement — stop-and-report filed with five blockers and the
      successor scope; it must land before the next T1.P02 slice and must not be carried past the
      phase, and it is not authorized by batch E; (2) the F2 open timings at S and M against the H0
      baseline on the designated M2 — S01 measured none, so its acceptance criterion 5 is only
      partially evidenced and no performance claim is made; (3) the explicit independent-review
      verdict for `7e159370`, then owner acceptance and merge of S01, which any later base must carry
      before it starts. The API-level format-5 refusal is now covered in `save.test.mjs` as recorded
      in the acceptance artifact.
ROUTE: ../../roadmap/t1-spatial-world/README.md#phase-register →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/README.md →
       ../../roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md
       → ../../reference/decisions/batch-e-authorization-2026-10-22.md (provenance)

T1.P01's S06 final gate is accepted and recorded under a scoped owner-override. The phase README
records the owner ratification; its final-gate stub carries the exact recovery anchor. PR #168 merged by P1 merge commit `e8e83490`; its slice and phase recovery anchors were verified
in merged `main` ancestry.

BOUNDARIES: P1 merge commit and preservation ancestry verified. Card-over-Compose remains owned
by T1 shell composition in the later drawing slice; Layout-plinth dimension editing is not claimed. No T1 TRACK COMPLETE
event or architecture verdict is recorded.
