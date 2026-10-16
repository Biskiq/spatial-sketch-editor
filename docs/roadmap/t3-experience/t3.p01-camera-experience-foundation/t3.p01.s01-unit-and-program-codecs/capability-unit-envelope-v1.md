# `F2.unit-envelope@1:unit-envelope-v1` — accepted capability record

**Status:** active · **Gate:** [`F2.unit-envelope@1`](../../../README.md#gate-register) · **Provider:** T3.P01.S01 · **Extension slice:** T3.P01.S01

AM-2 defines the exact envelope and unit codec contract. This scope admits one validated Layout, Scene, Camera, Experience and typed-resource unit, with strict envelope/header/payload validation, dependency locks, unresolved authored diagnostics, and canonical domain content revisions. It provides codec/admission capability only; it does not activate storage, readers, writers, interpreter behavior or migration.

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F2.unit-envelope@1:unit-envelope-v1` | [AM-2](../../../../reference/composition-execution.md#am-2-f2-unit-envelope-v1) | `layout`, `scene`, `camera`, `experience`, declared typed-resource kinds | `F1.reference@1:references-v1`, `F3.channels@1:inspection-v1` | `T3.P01.S01` | `packages/project-model/src/units` | `apps/editor/tests/lib/project-model/units-conformance.test.ts` | `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/acceptance.md` | `6dcb6d6d9e7e43c0f25f3305672c3cc79e0d577e` |

The extension adds a standalone `ExecutionProgram@1` codec and AM-7 converter as same-slice deliverables documented in the acceptance record; those are not extra F2 capability scopes. The S03 interpreter and S04 source activation/cutover remain deferred.
