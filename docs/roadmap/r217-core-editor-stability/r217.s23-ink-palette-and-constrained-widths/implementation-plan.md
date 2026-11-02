# R217.S23 — Ink palette and constrained widths (closed)

**AUTHORITY: NONE.** R217.S23 is accepted at tested revision `a7598a55` on 2026-11-01 and ships by the P1 merge of PR #254. The [acceptance record](./acceptance.md) owns the delivered behaviour, the evidence and the anchors; the [phase slice register](../README.md#slice-register) owns status.

```text
delivered       The lower column holds one Ink key row above the dock: the Wall readings (Line, Box) and the Opening
                reading, with typed X/Z, Finish, Backtrack and Cancel in the row and the options disclosed upward. The
                instruments share one compact row in the dock's material, and their facts sit behind an info control.
                Below 1280 px the Index starts collapsed and opens as a sheet over an explicit scrim that ends above the
                lower column. The lower column insets by the measured Height Sheet lane on the Sheet's side (review fix).
                Shape stays out of Ink (O10).
contract        docs/reference/design-system/editor-shell-and-visual-system.md (the lower working edge, Ink, responsive
                behaviour); the cutover drift reconciled in the acceptance record
provenance      accepted tested revision a7598a55 (code 5bfd1d3b, 0ffa14d6, 5f0d7131, 48ba5da7, 7c3bf0ee, 1fb0d6bc and
                a7598a55, from main 23d6d9ae); implementation PR #254; plan last changed at 44bc0c5e (reachable on main);
                closeout on the same branch; the P1 merge is recorded in the post-merge anchor record.
evidence        One gate table at a7598a55, from a clean worktree, in the acceptance record: check (2051 files), the four
                kernel checks, test:arch (210 tests), npm test (3484 tests), test:heavy (138 tests), build and git diff --check. Browser matrix: 16 runs at four widths, fine and
                coarse, both Sheet sides. Contrast pairs measured. The Box flake and the favicon 404 are routed to the
                tech-debt ledger.
entry points    implementation apps/editor/src/lib/authoring/adapters/layout/LayoutInkPalette.svelte
                                apps/editor/src/lib/authoring/adapters/layout/LayoutOpeningPalette.svelte
                                apps/editor/src/lib/authoring/stage/shell/StageInstrumentHost.svelte
                                apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte
                                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                regressions     apps/editor/tests/lib/authoring/stage-shell-composition.test.ts
                                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
                                apps/editor/tests/lib/authoring/stage-instrument-host.test.ts
                                apps/editor/tests/lib/authoring/stage-shell-coarse-targets.test.ts
                                apps/editor/tests/lib/authoring/objects-panel-guard.test.ts
residuals       The open Index covers a left-side Height Sheet at constrained widths, accepted by design (a scrimmed
                overlay, per the independent review). The starter room's bottom
                wall sits under the palette row at 1180×820 (S11 owns it). The Box second-corner release flake (TD-18),
                the favicon 404 (TD-19), and TD-16's Point-disclosure extension. Native touch and Safari stay with S11.
recovery        git show 44bc0c5e:docs/roadmap/r217-core-editor-stability/r217.s23-ink-palette-and-constrained-widths/implementation-plan.md
                · tag closed/r217.s23
```
