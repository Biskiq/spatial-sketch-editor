# `T1.viewport-projection@1:viewport-projection-v1` — accepted capability record

**Capability:** `T1.viewport-projection@1:viewport-projection-v1` · **Status:** active · **Gate:**
[`T1.viewport-projection@1`](../../../README.md#gate-register) · **Provider:** `T1.P01.S02` ·
**Accepting slice:** `T1.P01.S07`

The interface draft stays owned by the phase
([`interfaces.md#viewport-projection-v1`](../interfaces.md#viewport-projection-v1)); gate identity and
readiness are owned by the [global gate register](../../../README.md#gate-register). F semantics stay
owned by [`composition-execution.md`](../../../../reference/composition-execution.md).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T1.viewport-projection@1:viewport-projection-v1` | [AM-5 shared Stage and starter gallery](../../../../reference/composition-execution.md#am-5-shared-stage-and-starter-gallery-v1) | `current-source@5` (wall-first Layout / world-local Scene) | `F1.reference@1:references-v1`, `F3.channels@1:inspection-v1`, `F4.intent-acceptance@1:local-single-domain-v1` | `T1.P01.S07` | `apps/editor/src/lib/authoring/stage/`, `packages/camera-core/src/viewport.ts`, `packages/layout-core/src/layout-plan-representation.ts` | `apps/editor/tests/lib/authoring/stage-consumer-probes.test.ts`, `apps/editor/tests/lib/authoring/stage-host-acceptance.test.ts`, `apps/editor/tests/lib/authoring/stage-facade.test.ts` | `docs/roadmap/t1-spatial-world/t1.p01-stage-foundation/t1.p01.s07-stage-f4-integration-bridge/acceptance.md` | `ab8504aa` |

## Scope of this acceptance

The read-only shared Stage and viewport provider landed in `T1.P01.S02`; this record accepts the
capability after `T1.P01.S07` wired it to F4 and re-ran the seam conformance and the complete merge
gate on then-current `main` (merge candidate `049e89f5`, `origin/main` `279e1340`).

Accepted: one Canvas and one viewport evaluation booting stored current-format sources, starter
projects and explicit source JSON; source-independent `StageReadSnapshot` with the current encoding
behind an explicit adapter; ordinary project-world Plan/3D projection, picking, membership, Reveal,
Index and hit eligibility; ordered F.1 selection with one primary; task/gesture ownership with lens
parking and revalidated Resume; host↔F4 accept, Undo/Redo, replacement baseline and adapter
re-binding; Camera reference/inspection access.

Not accepted by this record: Section, peel, arbitrary surface inverses, Scene support resolution,
Camera authoring, production authoring writers, Experience UI, Preview, publication or Save.

## Evidence

Acceptance criteria, gate numbers (arch 20/161, fast 130/1812, heavy 8/118, full 158/2091, API 65
tests with zero skips), production-exclusion scan (349 files, 0 sentinel matches), browser evidence
and the four review rounds are recorded in the
[acceptance record](./acceptance.md) and [verification](./evidence/verification.md).

## Residuals

- Consumer eligibility starts at a trusted base that contains PR #137's merge commit (the record's
  required merge method is P1: merge commit, no squash or rebase).
- Post-merge cleanup owed by the owner: verify every recorded anchor is an ancestor of `main` and
  push the `closed/T1.P01.S07` tag.
- Instrument services remain only partly narrowed; the task-lifecycle reentrancy asymmetries in
  `closeTask` and `installAccepted` are recorded limits, not accepted behaviour.
