# T3.P02.S01 — acceptance record: First capture and Cut Preview — CLOSED STUB

```text
AUTHORITY: NONE — closed evidence. The live approved scope and deferred exhaustive route remain in
           ./implementation-plan.md; phase lifecycle/order → ../README.md#slice-register.
STATUS:    ACCEPTED and SHIPPED 2026-10-23 as `owner-override` (not reviewed) at integrated
           revision `1bb281bb16dc839588e4174514b240de6c52bf79`, rebased on main
           `86033b4d29e42f9f3dbfab79c1ab0a1bfae5d53d`.
DELIVERED: Experience format 2, capture/bind and editor surface, Guide Stop editing, isolated
           Presentation Preview, Save/Undo integration; implementation details and recorded limits
           are recoverable from the acceptance body.
OWNER RULING: 2026-10-23 owner override accepted this integrated revision and waived outstanding or
           missing/stale formal verdict and test-evidence prerequisites for S01 acceptance. The
           original PR178 source `26531059ff1bc51bbb352ae7f351071858b501fa` and original ruling
           commit `56dc86f6d6d1d14b51a6c0096802f4465113345b` are preserved as provenance/history.
EVIDENCE:  The pre-rebase record reports type/check, fast 143 files/1,965 tests, arch 21/172,
           heavy 8/118 and build passes, focused Experience tests, and a limited browser journey.
           Those observations remain tied to their recorded pre-rebase tree/base; the rebase added
           no verification. F10 Preview performance, post-fix lens wiring and route-level Guide journey
           remain unrun/unverified here. DB-backed API verification now passes in the recorded
           merge gate below; no manual journey or performance result is claimed.
NOT WAIVED: T3.P02.S02 remains the phase's proposed, unauthorized final integration gate (true at acceptance; S02 was released 2026-10-23 — see the phase register); parent
            merge-gate results are recorded below and P1 preserves the verified recovery anchors. T3.P02 stays
            active; no phase closure or new slice release is recorded.
RECOVERY:   git show closed/T3.P02.S01:docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/acceptance.md
ANCHOR:     pushed tag `closed/T3.P02.S01` → `11bd77b958978e82436a62ca65601f06cb301481`
HISTORY:    pushed tag `historical/T3.P02.S01-original-owner-override` →
            `56dc86f6d6d1d14b51a6c0096802f4465113345b` (parent `26531059ff1bc51bbb352ae7f351071858b501fa`)
```

```text
CLOSEOUT PRESERVATION — T3.P02.S01 (2026-10-23)
prose compacted:                 3   acceptance.md, experience-format-draft.md, shell-draft.md
plan retained live:              1   implementation-plan.md routes the S02 integrated final gate
renderable evidence archived:    0 files / 0 bytes
evidence stubs / manifests:      0
transient artifacts removed:     0
historical acceptance anchor:    11bd77b958978e82436a62ca65601f06cb301481 · tag closed/T3.P02.S01
original owner ruling retained:  56dc86f6d6d1d14b51a6c0096802f4465113345b · historical tag above
cycle window:                    T3.P02.S01 is not listed as an Exposure slice; no cycle hook/action
                                  applies, and this closeout records no cycle observation
new live → archive prose links:  0
required merge method:           merge commit (P1); parent owns complete merge gate and post-merge
                                  anchor reachability verification
phase state:                     T3.P02 remains active; S02 final gate is proposed/unauthorized
unrun rows:                      F10 and outstanding manual journeys remain unrun; API merge gate passes
```

## Recorded integrated merge gate

On `2fbf0ed2e75fa4435956cf10a012e3a6a89798af`, based on PR #177 merge `86033b4d`, the complete editor suite passes **183 files / 2,383 tests**, architecture **22/176**, heavy **9/125**, all Layout/project-model/Camera/API/editor checks and the production build. Fresh loopback PostgreSQL verification passes **95 API tests / twelve reports / zero failures, cancellations or skips**. The owned database cluster was removed and port 43996 closed. Exact commands/results: `/tmp/batch-e-closeout/pr178-gate/results.json`.

The pre-rebase observations above remain historical. This integrated gate adds current functional evidence without claiming unrun F10/reference measurements or reopening implementation review. All six recovery tags are pushed; nine recorded recovery commands resolve, and the five closed-slice anchors are ancestors of this integrated candidate. P1 merge preserves that ancestry; the merge owner verifies it on main after merge.

Final harness compatibility: the isolated fixture adaptation in `36ebc9bde9225d74ade38c6e502cea0ccf25ece4` updates only `apps/editor/perf/lib/fixtures.ts` for the accepted Layout API. All **27 perf TypeScript sources** pass strict checking. Runtime probes compile and admit S/grid-3 with 24 Walls / 24 Openings / 9 Rooms and M/grid-7 with 112 / 112 / 49, preserving the workloads. No editor/API implementation, test configuration or ordinary build input changed after the full gate; those passing results remain tied to `2fbf0ed2`. The browser timing matrix was not rerun or relabelled.
