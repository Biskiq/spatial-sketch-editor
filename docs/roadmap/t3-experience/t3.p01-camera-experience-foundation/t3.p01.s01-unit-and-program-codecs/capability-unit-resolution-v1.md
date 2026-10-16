# `F1.reference@1:unit-resolution-v1` — accepted capability record

**Status:** active · **Gate:** [`F1.reference@1`](../../../README.md#gate-register) · **Original gate provider:** T1.P01.S01 · **Extension slice:** T3.P01.S01

This is an additive F1 scope. It does not replace, widen or rewrite `references-v1`. It resolves the existing F.1 reference identity and qualification over accepted F2 unit sources and dependency locks, returning typed unresolved/incompatible outcomes rather than ambient-latest or name-based matches.

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F1.reference@1:unit-resolution-v1` | [AM-1](../../../../reference/composition-execution.md#am-1-f1-references-v1), [AM-2](../../../../reference/composition-execution.md#am-2-f2-unit-envelope-v1) | `layout`, `scene`, `camera`, `experience`, declared typed-resource kinds | `F1.reference@1:references-v1`, `F2.unit-envelope@1:unit-envelope-v1` | `T3.P01.S01` | `packages/project-model/src/references/unit-resolution.ts` | `apps/editor/tests/lib/project-model/unit-resolution-conformance.test.ts` | `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s01-unit-and-program-codecs/acceptance.md` | `6dcb6d6d9e7e43c0f25f3305672c3cc79e0d577e` |

The existing `references-v1` capability remains active under the original T1 provider and record. Consumers of this extension require both this exact scope and its prerequisite closure; this acceptance does not imply runtime activation.
