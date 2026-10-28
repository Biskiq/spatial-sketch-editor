# T1.P02.S04 — acceptance record: Integrated final gate

**Slice:** T1.P02.S04 · **Status:** **accepted by owner 2026-10-28**; closeout complete; P1 merge
required for recovery. The declared `FINAL PHASE GATE` of T1.P02 is accepted and shipped; the phase
is **closable, not closed** · **Plan:** [implementation-plan.md](./implementation-plan.md)
(closed stub; owns the accepted scope) · **Phase:** [T1.P02](../README.md)

**Declared** `FINAL PHASE GATE` artifact of T1.P02

This artifact records the integrated correctness and functional evidence for native Wall creation on
the final verification base `1e6e73aa` (PR #208 on the released PR #209 merge). The owner accepted
the gate on 2026-10-28; the explicit slice-closeout trigger is the owner's review/waiver of the
separate independent-review prerequisite, recorded below. This artifact claims no phase closure,
track-completion event, architecture verdict or production epoch. The owner [suspended the mandatory performance-benchmarking
strategy](../../../../reference/decisions/performance-mandate-suspension-2026-10-28.md) on 2026-10-28:
no benchmark is an acceptance prerequisite, and every unmeasured performance row below stays
**unmeasured**, never a pass.

## Evidence revision

```text
base                    1e6e73aa (PR #208 on db7e5cd9, the verified PR #209 merge; all five slices accepted)
product/browser         d1fe6e5c (both browser evidence bundles, final head)
test corrections        d0b0b808, d1fe6e5c (PR #208 base only; no product change)
acceptance docs         this branch; P2 correction at 46a31c81
anchor                  46a31c81 (full acceptance and plan bodies; tag local only)
closeout                2026-10-28; P1 merge required (PR #210)
machine                 Apple M2 8-core / 16 GiB, macOS, Node 26.7.0
browser                 Chrome 156.0.8078.48 (pinned) and Playwright Chromium
```

PR #208 reached `main` before the branch was finalized, so the final pass is on `1e6e73aa`, not the
release base. Two test-only corrections were needed on that base: `d0b0b808` keeps the release-list
probes independent of the live T5 row, and `d1fe6e5c` reads the T5 form bounds through their Card
writer. Neither changes product code or the S04 browser spec. The post-browser commits are
documentation only.

**P2 review correction (2026-10-28).** The one foreign-track baton edit —
`docs/operations/t2-composition/current.md` — was reverted to `main`; no foreign-track baton remains
changed in this PR. T2's older benchmark
carry is already superseded by the repository-wide suspension and is left for T2's next authorized
handoff. This is a documentation-only correction and does not affect the browser or product
revision `d1fe6e5c`.

## Owner acceptance and review waiver — 2026-10-28

```text
RULING      The owner's explicit T1.P02.S04 slice-closeout trigger is the owner's review and
            acceptance of this final gate at 46a31c81; it waives the separate independent-review
            verdict for this slice only.
SCOPE       The independent-review prerequisite only. The owner reviewed the P2 ownership
            correction; no correctness, browser, architecture, API, build or performance evidence
            is waived, and no performance row becomes a pass. No phase closure or merge is
            authorized by this ruling.
STATE       Accepted; S04 ships through PR #210 under the P1 merge rule. The phase register reads
            `shipped`; the review prerequisite reads `owner-override`. T1.P02 is closable, not
            closed.
RATIFIED    owner, 2026-10-28.
```

## Browser acceptance

**4 journeys / 26 rows passed in both Chromium and Chrome** (`d1fe6e5c`), with each row recording its
revision, viewport and reduced-motion state:

| Journey | Viewport / motion | Rows |
| --- | --- | --- |
| Starter → draw → close → divide → Window → delete Wall + Opening → identity guards → Undo/Redo → Save/reload | 1440×900, motion normal | 14 |
| Empty → typed enclosure → divide → Door → delete → Undo/Redo → Save/reload | 1280×800, reduced motion | 6 |
| Narrow shell, Head Find, keyboard backtrack/cancel, crossing refusal, invalid measures | 900×700, reduced motion | 5 |
| Short shell arbitration | 1024×600, reduced motion | 1 |

Covered by those rows: deliberate Junction reuse and enclosure/division; Plan/3D agreement on the
Wall and Opening; Wall deletion retiring its Opening in one step; delete/recreate never reusing an
identity; post-reload edits allocating fresh identities; format 5 and unknown-format refusal with
download recovery; named Stage, pressed reading state and announced Card refusal; and no partial
source from a refused keyboard or pointer path.

- [Chromium evidence](./evidence/2026-10-28/d1fe6e5c/chromium/t1-s04-integrated-evidence.json)
- [Chrome evidence](./evidence/2026-10-28/d1fe6e5c/chrome/t1-s04-integrated-evidence.json)
- [Chromium machine facts](./evidence/2026-10-28/d1fe6e5c/chromium/t1-s04-machine-facts.json)
- [Chrome machine facts](./evidence/2026-10-28/d1fe6e5c/chrome/t1-s04-machine-facts.json)
- [Archived final screenshots](../../../../archive/roadmap/t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s04-integrated-final-gate/evidence/2026-10-28/d1fe6e5c/CLOSED.md)

## Complete repository contract

Run on the integrated tree at the evidence revision; no lane was narrowed:

```text
check (svelte-check)    0 errors / 0 warnings
test:arch               23 files / 188 tests passed (unconditional)
test:heavy              11 files / 138 tests passed
test:full               224 files / 2,874 tests passed
check:layout-core       clean
check:project-model     clean
check:camera-core       clean
check:geometry-core     clean
check:api               clean
test:api (DB-backed)    14 files / 115 tests, 0 failures, 0 skips (biskiq_t1_s04 PostgreSQL)
build:editor            succeeded
build:api               succeeded
```

The DB-backed API run includes the format-6 strict-refusal Save path, project lifecycle, write lease,
model resources, migrations and test-auth seams. The full editor suite includes the architecture,
identity, compiler, wall-deletion, retained-reference and deterministic scale/deduplication oracles;
the S06 differentials and scale oracles therefore remain green without a timing run.

The focused S03 rows are covered by their recorded 15/15 and 28/28 browser evidence at `985cd214`,
preserved in the S03 acceptance stub; S04's journeys additionally exercise the integrated Opening
path at the current base.

## Performance — suspended and unmeasured

The 2026-10-28 suspension removes the formal F2/F3/F4/F8/F13 matrix, battery-mode certification and
the full `npm run perf` workflow from this gate. No benchmark completed for S04. An earlier formal
attempt was stopped after 31 minutes; it produced **no manifest and no pass-scoped evidence** and is
recorded only as an aborted attempt. Every deferred row is therefore **unmeasured**:

| Source | Rows | Status |
| --- | --- | --- |
| S01 | F2 open timings at S/M | unmeasured; historical |
| S02 | F3 drag, per-move evaluation, F4 commit, F8 Undo/Redo at S/M, F2 open, F13 cycles, Stage first-load delta | unmeasured; historical |
| S03 | F4/F8 Opening create/delete at S/M | unmeasured; historical |
| S06 | battery qualification, grid-XL timing, sweep latency rows | unmeasured/uncertified; historical |

Recorded historical misses stay recorded and are neither repaired nor erased: S02's **456.0 KiB br**
Stage result at `64b9435d` and S03's **426.7 KiB br** against the then-425 KiB budget at `b0d4e252`.
Existing harnesses, workloads and raw evidence remain in the tree for a future owner-initiated
investigation after an observed slowdown. No performance row is a pass.

## Residuals and ownership

- **Independent review — owner-reviewed/waived.** The owner's closeout trigger is the owner's review
  and acceptance at `46a31c81`; the separate independent-review verdict is waived for this slice only.
  The P2 ownership correction is recorded above. No correctness, browser, architecture, API, build or
  performance evidence is waived.
- **P1 merge — required.** PR #210 must land as a merge commit, not squash or rebase; that merge
  makes the anchor and tag reachable from `main`.
- **Performance mandate — suspended.** No benchmark is owed; unmeasured rows remain unmeasured. A
  future owner-observed slowdown can commission a bounded investigation against the preserved harness.
- **Stage bundle misses — history.** The S02 456.0 KiB br miss and S03 426.7 KiB br exception remain
  recorded; this gate does not claim a current bundle pass.
- **Narrow-shell observation — T1 maintenance.** `lowerColumnHeight` can hold a pre-unmount height for
  one frame; the next observed frame corrects it. Non-blocking, recorded by T3.
- **S06 follow-ons FO-1 … FO-5 — historical.** They are not acceptance prerequisites and create no
  obligation here.
- **Phase closure — not authorized.** Passing this gate makes T1.P02 closable; a separate owner
  instruction closes it. No phase, track or architecture-cycle closure is recorded.

## Closeout — accepted 2026-10-28

The slice-closeout procedure completed for the declared final gate. S04 is **accepted and shipped**
through PR #210; the phase README reads `shipped` and T1.P02 is **closable**. The final-gate exception
keeps this artifact live for the phase-close decision. The implementation plan is a closed stub at
its path, the 32 final PNGs have byte-identical archive copies, and the JSON/machine facts remain
live. No phase closure, track-completion event, architecture-cycle verdict, deployment or merge is
recorded here. The owner phase-close decision is the next step; P1 merge is required for recovery.

## Preservation report

```text
CLOSEOUT PRESERVATION — T1.P02.S04 (2026-10-28)
prose compacted:                 1   implementation plan → closed stub at its path
reference promotions:             0   performance/policy truth already in reference/*
renderable evidence archived:    32 files / 4,075,060 bytes (3.89 MiB)   final d1fe6e5c PNGs,
                                     byte-identical copies
evidence stubs / manifests:      1   CLOSED.md at the archived bundle
transient artifacts removed:     0
historical anchor:               46a31c81 · tag closed/T1.P02.S04 (local only; push after P1 merge)
new live → archive prose links:  0
manual-owed verification rows:   0   no benchmark is owed; unmeasured performance rows remain
                                     historical evidence, never passes
remaining deferred items:        4   performance family; Stage 456.0/426.7 KiB history;
                                     lowerColumnHeight observation; S06 FO-1 … FO-5
permanent stubs added:           1   (the owner-ratified cost)
```

## Recovery and merge

```text
base        1e6e73aa (PR #208 on the PR #209 merge db7e5cd9)
evidence    d1fe6e5c (both browser bundles; test corrections only after the release)
anchor      46a31c81 (full acceptance, plan and P2 correction)
merge       P1 merge commit only (PR #210); required, no squash or rebase
phase       T1.P02 is closable; the phase-close decision is a separate owner instruction
```

The P1 merge commit must preserve this record's revision and evidence paths; squash and rebase merges
are not valid recovery for this gate.
