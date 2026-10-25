# T3 phase closures and P04 authorization — 2026-10-24

**Status: owner-authorized.** The owner explicitly instructed: close `T3.P02` and `T3.P03`, then
authorize and release `T3.P04.S01`, in one documentation-only T3 coordination PR; reuse the recorded
acceptance evidence, run documentation tests only, keep S06 untouched, and stop before merge.

This record is the provenance for three lifecycle events. It creates no gate or version, changes no
authored format or persistence contract itself, authorizes no implementation in its own PR, and
schedules nothing beyond what it names. At the time of authorization, P04's two contract questions
were proposals pending owner ratification; their final disposition is recorded below.

```text
1  T3.P02 First Capture and Cut Preview   → closed 2026-10-24 (final gate T3.P02.S02)
2  T3.P03 Shared acceptance and measurement → closed 2026-10-24 (final gate T3.P03.S02)
3  T3.P04.S01 Project rename and delete   → authorized and released 2026-10-24
```

## 1–2. Phase closures

Both phases were **closable** with an owner-override final-gate acceptance. Closure validates the
recorded evidence; it does not re-execute a product lane. Neither gate was reopened, re-measured or
re-reviewed here, and no deferred row is promoted to passing.

| Phase | Final gate | Accepted | Recorded integration the closure rests on |
| --- | --- | --- | --- |
| T3.P02 | `T3.P02.S02` | 2026-10-24, `owner-override` at `335820d6` (merge `bf6b2e1f`, PR 184) | The gate artifact's integrated run at that revision: complete editor suite 2403/2405 with both failures proved to be host-load timeouts that pass in isolation, arch 22 files / 178, heavy 9 files / 125, root build, package checks, API 95/95 with zero skips, 6 browser journeys, plus the focused first-Guide and visitor-director suites |
| T3.P03 | `T3.P03.S02` | 2026-10-23, `owner-override` at `eabd4b88` | The gate artifact's final combined validation: 62/62 unique browser cases across 13 files and both browsers with zero skips, the final repository gate (176 files / 2,264 tests, arch 21/172, heavy 8/118, build, API check, 80 DB-backed tests with zero skips) and the S01 recheck (6 files / 88 tests) |

Both acceptances are `owner-override`, not `reviewed`. Each phase README carries the `PHASE CLOSE`
block, the records keep every deferred or unrun item with its owner, and the deferred obligations
that another scope now owns stay with that scope:

- **T3.P02 Scope A (performance)** — the traced Preview first frame, capture/bind completion, the
  M-workload F10 rows, the F13 re-measure, the reference-machine run and the Stage initial-load
  delta — is measurement transferred to `T1.P02.S06` by the
  [performance foundation decision](./performance-foundation-authorization-2026-10-24.md#transferred-obligations).
  A miss in T3-owned code returns to T3; the H0 trace-method ruling stays with the owner.
- **T3.P02 Scope B (unrun)** — Ask Rule, Experience paused editing, the dense 20/50-View and
  15/30-Stop fixtures, the browser Preview-replacement probe, the browser Save/download/reload
  journey, touch/coarse pointer, DOM reach without raycast, the partial shared-Camera row and the
  Travel/detour browser rows — remains **deferred, not claimed and not waived**. It stays owned by
  T3 and is named in the gate artifact stub and the T3 baton.
- **T3.P03** — the unbuilt L/XL fixtures and the unrun M/L drag rows are transferred to
  `T1.P02.S06`; the owner trace-method disposition
  ([deviation record](./t3p03s02-trace-correlation-deviation-2026-10-22.md)), the reference
  hard-row/calibration run and every GPU/row budget stay open and unclaimed.
- **Unchanged owner events.** F2 epoch production activation, track completion and T4 planning
  authorization are separate owner operations. None happens here.
- **The deferred T1 seam** — the host `EditorCard` still exposes no Experience contribution seam —
  remains a T1-owned deferral reported by `T3.P02.S02`; closure does not build it.

## 3. T3.P04.S01 authorization and release

`T3.P04` was registered as planning-only post-Batch-E coordination. The owner now authorizes its
single child and releases it on [the release list](../../roadmap/now.md):

| Scope | Outcome | Plan |
| --- | --- | --- |
| T3.P04.S01 | Owner-scoped project rename and delete with stale/conflict protection, project-scoped resource cleanup, and a bounded T1-reviewed shell patch | [plan](../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/implementation-plan.md) |

The release was recorded when this documentation PR merged on `main`; the runbook re-verified every
consumed gate and scope at the implementation's own trusted base. Its planning review against
current `main`, and the issues it resolved or escalated, are recorded in the
[planning resolution](../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md).

**Two owner reviews of the planning resolution (2026-10-24) corrected the deletion mechanism and
raised two contract questions.** The owner ratified both on 2026-10-25 in
[PR #188 review 5641779932](https://github.com/Biskiq/spatial-sketch-editor/pull/188#pullrequestreview-5641779932):
the authored envelope owns the project **name** (rename appends one immutable version), and delete
refuses only while a publication is **active**, removing the retained inactive publication after
unpublication. They are now current behavior; the owning persistence contract records the result.

The same reviews corrected the durable-cleanup design in the
[resolution](../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/planning-resolution-2026-10-24.md):
a revocable write fence over every project-owned object writer with an enforced write bound (F1), a
persisted key inventory that includes the approved revision's source copies (F2), and a
project-scoped listing (F3). These are mechanism corrections, not new scope; the resolution names
what changed in the plan. At authorization time, T2's acceptance of the fence and `source_keys`
column remained a merge condition, and this PR ratified no contract change.

## Post-release disposition — 2026-10-25

The owner ratified the authored-envelope name rule and active-publication delete rule in PR #188
review 5641779932; the accepted current contract is
[`reference/components/persistence.md`](../components/persistence.md). T2's shared API review
prerequisite passed in PR #191 review 5643653030, and T1 pre-implementation approval passed in review
5643884439. The read-only S06 route-compatibility check found no conflict; S06's completion and shared
harness ownership were not changed.

PR #191's final independent review 5644765570 accepted the implementation at `550f8a9b` with no
open correctness finding. The exhaustive integrated gate and formal slice acceptance are recorded in
the [T3.P04.S01 acceptance artifact](../../roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/acceptance.md).
T3.P04 is CLOSABLE and remains active pending the separate owner phase-close decision. No T3 track
completion, F2 production activation, publication activation, deployment or architecture-cycle
transition is implied.

P04 is **strictly unrelated** to the performance-first halt. The
[halt](../../roadmap/README.md#production-implementation-hold) and the
[`T1.P02.S06` release](./performance-foundation-authorization-2026-10-24.md) are unchanged, and its
three serialization rules still bind P04 implementation:

- the bounded T1 shell patch is edited only as a serialized, T1-reviewed patch against S06's
  recorded claim;
- the shared harness and its fixtures are not edited while S06 holds them;
- reference-machine measurement queues behind S06's performance lock.

## Limits

No implementation, benchmark, product test lane or deployment was run for this record, and its PR
carries documentation only. None of the following is created, changed, accepted or authorized here:

- a gate or gate version (P04 provides none);
- an authored format, persistence contract, migration or API route — this record creates none, and
  the planning resolution records proposed rulings and a mechanism, not built behaviour;
- a T1 or T2 slice release, or any change to T1's baton;
- a performance budget, CI timing gate or benchmark registry;
- a phase closure beyond these two, track completion, or T4 authorization;
- a production deployment, F2 epoch activation or publication.

Each released plan still owns its verification tier, complete implementation-PR merge gate and
independent review. The next T3 event after this one is `T3.P04.S01` implementation; this PR
contains none.
