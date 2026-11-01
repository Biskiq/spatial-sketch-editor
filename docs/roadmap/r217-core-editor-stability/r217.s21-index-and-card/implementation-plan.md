# R217.S21 — Index and Card (closed)

**AUTHORITY: NONE.** R217.S21 is accepted at tested revision `edfab667` on 2026-11-01 and ships by the
P1 merge of PR #250. The [acceptance record](./acceptance.md) owns the delivered behaviour, the evidence and
the anchors; the [phase slice register](../README.md#slice-register) owns status.

```text
delivered       Index: one compact 256 px line per subject, named by its authored name or a session-stable `Kind n`
                label; Open location, Bring into view and Reveal sit behind the row's Actions disclosure. Card: each
                fact stated once (a writer or the header carries its field); Stream, Eligible, Revealed and Domain
                under Technical details; only `destructive: true` is styled destructive; Duplicate, Focus and Open
                task sit in More. A Scene object shows Position (X · Z) with its writer, and Elevation (Y) as a
                read-only row. The context chip shows a Layout selection's floor name; a Scene reference shows none.
                Under pointer: coarse, Card and Index controls reach 44 × 44 CSS px.
contract        docs/reference/design-system/editor-shell-and-visual-system.md (PLATE, Index and Card); the behaviour
                and the drift reconciled at cutover: docs/roadmap/r217-core-editor-stability/post-s10-convergence/target-specification.md#index-and-card
provenance      accepted tested revision edfab667 (production 8902a6ca, 3292d8fb, 43579f1c, 28538e19, edfab667; tests
                a92050a2); implementation PR #250 from main c577904c; plan last changed at 370c99d9 (a branch commit,
                reachable on main through the P1 merge); closeout on the same branch; the P1 merge is recorded in the
                post-merge anchor record.
evidence        Full gate at edfab667 (check, the four kernel checks, test:arch, npm test, test:heavy, build, git diff
                --check), the fine-pointer browser matrix at four widths and the coarse-pointer pass, all in the
                acceptance record.
entry points    implementation apps/editor/src/lib/authoring/stage/shell/EditorIndex.svelte
                                apps/editor/src/lib/authoring/stage/shell/index-labels.ts
                                apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte
                                apps/editor/src/lib/authoring/stage/stage-facade.ts
                                apps/editor/src/lib/authoring/adapters/layout/precision.ts
                                apps/editor/src/lib/authoring/adapters/scene.adapter.ts
                                apps/editor/src/routes/project/[projectId]/spatial/+page.svelte
                regressions     apps/editor/tests/lib/authoring/stage-index-labels.test.ts
                                apps/editor/tests/lib/authoring/editor-card-facts.test.ts
                                apps/editor/tests/lib/authoring/spatial-route-gesture.test.ts
                                apps/editor/tests/lib/authoring/stage-shell-coarse-targets.test.ts
                                apps/editor/tests/lib/authoring/scene-editing-surface.test.ts
residuals       Constrained-width Index is a sheet over the Stage (S23). The destructive and refusal colours and the
                placement of advanced fields such as Wall thickness await owner decisions. Head Find and the task
                host still show raw identities for Scene subjects (later slice). The keyboard Tab path of the Card's
                writer fields, Delete, Bring into view and More was not walked in the browser. At 1440 × 900 the Card
                overlaps the Height Sheet (S22, D42). Native touch and Safari stay with S11. The perf browser flows
                are stale (TD-16). A server-refused Save is covered by head-save.test.ts and not browser-verified.
recovery        git show 370c99d9:docs/roadmap/r217-core-editor-stability/r217.s21-index-and-card/implementation-plan.md
                · tag closed/r217.s21
```
