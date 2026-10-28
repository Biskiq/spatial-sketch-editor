# T1.P02.S03 — Opening family acceptance — CLOSED STUB

**AUTHORITY: NONE.** The phase README owns status. Accepted 2026-10-28 as `owner-override`
for the current-head browser rerun; PR #209 uses a P1 merge. The owner accepted the known
Stage bundle miss. T1.P02 remains active and S04 is its final gate.

Ink places straight doors and windows on eligible straight Walls through the canonical F4 planner;
typed offsets use the selected Wall or selected Opening's host. One accepted placement or deletion
is one undo step. Ink re-arm respects newer task choices, including during acceptance.

Evidence at implementation revision `b0d4e252`: full suite 216 files / 2,680 tests; architecture
22 / 180; editor check 0 errors and warnings; all four package checks and production build passed.
Independent focused verification passed 92/92 and the owner confirmed review complete with no
unresolved blockers. Browser evidence is at `985cd214`, not the reviewed head: S03 15/15 and S02
preservation 28/28. The owner approved proceeding without a current-head rerun. Stage first-load JS
was 426.7 KiB br against 425 KiB; the owner accepted this exception. Formal F4/F8 Opening create and
delete S/M measurements remain **unmeasured**, not passes. The 2026-10-28
[performance-mandate suspension](../../../../reference/decisions/performance-mandate-suspension-2026-10-28.md)
removed their S04 assignment; no benchmark is authorized.

[Browser evidence](./evidence/2026-10-27/985cd214/t1-s03-opening-evidence.json) ·
[S02 preservation](./evidence/2026-10-27/985cd214/preservation/t1-s02-browser-evidence.json) ·
[Archived screenshot copies](../../../../archive/roadmap/t1-spatial-world/t1.p02.s03-opening-family/evidence/2026-10-27/985cd214/CLOSED.md)

```text
implementation  apps/editor/src/lib/authoring/adapters/layout.adapter.ts
                apps/editor/src/lib/authoring/adapters/layout/opening-planners.ts
                apps/editor/src/lib/authoring/adapters/layout/ink.ts
                apps/editor/src/lib/authoring/adapters/layout/LayoutOpeningPalette.svelte
                apps/editor/src/lib/authoring/stage/stage-session.ts
validation      apps/editor/perf/flows/t1-s03-opening-acceptance.spec.ts
regressions     apps/editor/tests/lib/authoring/layout-opening-adapter.test.ts
                apps/editor/tests/lib/authoring/layout-precision-adapter.test.ts
```

## Closeout preservation — 2026-10-28

```text
prose compacted:              3 stubs at original paths
reference promotions:         1 current shell outcome
renderable evidence archived: 4 files / 595723 bytes, byte-identical copies
manifests:                    1
transient artifacts removed:  0
historical anchor:            cbdb4785612229c34dd02595882982beaad86bcb · tag closed/T1.P02.S03 (local only)
new live → archive prose:     0
manual-owed verification:     0 (F4/F8 Opening rows are unmeasured historical evidence; the
                              2026-10-28 suspension removed the S04 assignment)
remaining deferred items:     1 (Stage bundle miss recorded; performance no longer owed)
permanent stubs added:        3
```

Recovery: `git show cbdb4785612229c34dd02595882982beaad86bcb:docs/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s03-opening-family/acceptance.md`
The anchor is preserved by the P1 merge commit; the tag is local only.
