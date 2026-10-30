# R217.S10 — acceptance and closeout (closed)

**AUTHORITY: NONE.** Slice accepted and shipped 2026-10-30 after independent combined T1/T2/T3/T5 review (ACCEPT; no unresolved S10 P0–P2 findings; no required waiver). Owner accepted PR #229 at implementation anchor `696fbd0667e6c552e8343c6029a93c0a4d44d4eb`.

**Delivered:** Ink Box, Measure, Eraser and Library Dock completion, including Find, Escape, keyboard and coarse-pointer behavior. All seven criteria in the approved plan passed. The integrated `architecture-integration` result remains S11's final-gate responsibility; S11 is not released or closed.

**Evidence:** At the tested implementation anchor, `npm test` 248 files / 3,184 tests; architecture 23 / 194; heavy 11 / 138; `npm run check` 0 errors / 0 warnings; Camera, Layout, Geometry and Project-model package checks; build; and browser workflows all passed. See the independent review recovery stub and [preserved browser evidence](evidence/README.md). No new waiver or known defect is carried. Approved deferred scope remains recorded in the plan's recovered body.

**Entry points:** `apps/editor/src/lib/authoring/stage/`; `apps/editor/src/lib/authoring/adapters/layout/`; `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`; regressions under `apps/editor/tests/lib/authoring/`.

**Recovery:** full acceptance record, plan and independent review at their accepted revision:

```sh
git show 696fbd0667e6c552e8343c6029a93c0a4d44d4eb:docs/roadmap/r217-core-editor-stability/r217.s10-dock-completion/acceptance.md
git show closed/R217.S10:docs/roadmap/r217-core-editor-stability/r217.s10-dock-completion/acceptance.md
```

## Closeout preservation — 2026-10-30

```text
prose compacted:                 3   stubs at their own paths
reference promotions:            0   no new durable reference contract
renderable evidence archived:    5 files / 1,186,627 bytes
evidence stubs / manifests:      1   evidence/README.md
transient artifacts removed:     0
historical anchor:               696fbd0667e6c552e8343c6029a93c0a4d44d4eb · tag closed/R217.S10 (pushed)
new live → archive prose links:  0
manual-owed verification rows:   0
remaining deferred items:        0 known bugs; approved deferred scope only
permanent stubs added:           3   one for each closed prose artifact
```

P1 merge commit required. After merge, verify the historical anchor is an ancestor of `main`, inspect each recovery path with `git show <anchor>:<path>`, and confirm the tag target retains the anchor. The branch head is deliberately not pinned here because this PR's merge will change it.
