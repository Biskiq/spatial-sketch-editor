# T3.P02.S02 — acceptance record: Integrated final gate — CLOSED STUB

**AUTHORITY: NONE.** This is the compacted record of the phase's closed final gate.
`T3.P02.S02` was accepted 2026-10-24 as `owner-override` (not `reviewed`) at merged revision
`335820d6`, shipped by slice-closeout, and `T3.P02` closed 2026-10-24. This stub stays at the
phase's declared `FINAL PHASE GATE` path; the phase's closed state is in
[../README.md](../README.md). The full 300-line record — environment,
verification table, acceptance matrix, round-4 findings, performance rows and the owner ruling's
terms — is recoverable at the Git anchor below. Nothing here is planning authority or readiness.

```text
delivered      First Guide creation (`experience-guide-create`, `firstGuide` inside
               `experience-capture-bind`: one accepted result, one undo payload); explicit Camera
               output handover/return for Preview (`enterPreview` / `returnPreview` /
               `cancelPreview`, a refused return re-acquires inspection); bounded Round 2
               Capture/Guide dock; warm visitor Preview surface built at lens open and hidden
               between sessions; visitor surface and Camera director `active` flag + epoch prop;
               bounded T1 host patch reviewed by T1.
contract       AM-9 (one Camera authority, Experience-owned order), F.4 unit acceptance and
               conditional Save, F3 camera handoff, visitor isolation; contracts in
               `docs/reference/composition-execution.md` and `docs/reference/components/camera-tour.md`
provenance     owner-authorized 2026-10-23 (post-Batch-E release); accepted 2026-10-24 as
               owner-override at `335820d6` (merge `bf6b2e1f` of main `0b96c577` plus the round-4
               fix); T1 review of the host patch approved; merged as PR 184 (P1 merge).
evidence       check 1825 files 0/0 · complete editor suite 185 files, 2403/2405 passed (two 5 s
               host-load timeouts, each passing in isolation: docs 25/25, P23B.11 36/36) · arch
               22 files / 178 · heavy 9 files / 125 · root build · package checks · check:api ·
               DB-backed API 12 suites / 95 tests / 0 skips · 6 integrated browser journeys
               (49.2 s) · focused first-Guide 12 and visitor-director 9. The gate ran at that
               revision; this close validated the record and re-ran nothing.
entry points   implementation  packages/project-model/src/units/planning.ts
                               apps/editor/src/lib/authoring/stage/camera-session.ts
                               apps/editor/src/lib/visitor/VisitorPreviewSurface.svelte (surface)
               validation      apps/editor/tests/lib/experience/first-guide.test.ts
                               apps/editor/tests/lib/experience/preview-handover.test.ts
                               apps/editor/tests/lib/visitor/visitor-camera-director.test.ts
               journeys        apps/editor/perf/flows/integrated-journeys.spec.ts
                               apps/editor/perf/flows/preview-lifecycle.spec.ts
residuals      Scope A performance and Scope B unrun rows, both deferred by the owner ruling
               preserved below; the deferred T1 `EditorCard` Experience-contribution seam.
recovery       git show 8cc30c94b8d6f6d97aa5c620230569a227bb5feb:<this path>
               tag closed/T3.P02 (local; its target is the anchor commit)
```

## Owner ruling — performance and unrun rows deferred (2026-10-24)

The owner ruled "mark the performance deferred", then deferred every unrun row. These items are
**deferred, not claimed and not waived as passing**; acceptance is `owner-override` for that reason.
The terms and the follow-up scope are in the full record at the anchor.

**Scope A — performance (transferred to [`T1.P02.S06`](../../../t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s06-performance-foundation/implementation-plan.md)
as measurement by the [performance foundation decision](../../../../reference/decisions/performance-foundation-authorization-2026-10-24.md#transferred-obligations)):**
the traced Preview first frame; capture/bind result completion ≤ 100 ms; the M-workload F10 rows;
the F13 re-measure; the owner reference-machine run; the Stage initial-load delta. A miss in
T3-owned code returns to T3. The H0 trace-method ruling stays with the owner. The F10 rows remain
starter-workload-only at `f6de016d`; no M-workload measurement exists and none is claimed.

**Scope B — unrun (T3-owned, no owner command for some):** the browser Preview-then-source-replacement
probe; dense 20/50-View and 15/30-Stop fixtures (none exist); touch/coarse pointer; DOM reach / Info
without raycast; Experience paused editing; Ask Rule (no implementation exists); a browser
Save/download/reload journey; the partial Two-Experiences "shared-Camera reach" row; the Travel/detour
browser rows.

**Also recorded, not deferred:** ordinary Presentation and Stop facts stay in the Experience lens
inspector because the host `EditorCard` has no Experience contribution seam. That seam is deferred to
T1 and is not claimed as Card-hosted.

## Closed-work preservation report

```text
CLOSEOUT PRESERVATION — T3.P02.S02 → phase close (2026-10-24)
final-gate artifact compacted:   1   acceptance.md → this stub at its own path
prose already stubs:             3   implementation-plan, implementation-review, handoff
reference promotions:            1   landed Preview handover and warm-surface behaviour →
                                     reference/components/camera-tour.md (slice closeout, unchanged)
renderable evidence archived:    0 files
evidence stubs / manifests:      0
historical anchor:               8cc30c94b8d6f6d97aa5c620230569a227bb5feb · tag closed/T3.P02
                                 (local only — not pushed) · tag closed/T3.P02.S02 already local
anchor ancestry verified:        anchor is an ancestor of origin/main `2215af34` and of the tag target
new live → archive prose links:  0
deferred items preserved:        5 performance (Scope A) + 9 unrun (Scope B), none claimed as passing
permanent stubs added:           0   the stub replaces the live record; no new stub path
drift report:                    phase README: PHASE CLOSE closed ✓ | track phase row: shipped ✓ |
                                 baton: T3.P04.S01 released ✓ | integration: recorded ✓
post-merge verification:         PENDING — after this PR's merge commit:
                                 git merge-base --is-ancestor 8cc30c94 main && echo "anchor reachable"
                                 git show 8cc30c94:docs/roadmap/t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s02-integrated-final-gate/acceptance.md | head -3
```

The phase close ran the documentation gate only (links, written paths, anchors). It is not a product
lane and does not replace the verification above, which remains the tested revision's record.
