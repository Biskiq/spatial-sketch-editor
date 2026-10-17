# `F4.intent-acceptance@1:conditional-save-units-v1` — accepted capability record

**Capability:** `F4.intent-acceptance@1:conditional-save-units-v1` · **Status:** active · **Gate:**
[`F4.intent-acceptance@1`](../../../README.md#gate-register) · **Original gate provider:**
`T1.P01.S03` · **Extension slice:** `T3.P01.S05`

F.4 semantics stay owned by
[`composition-execution.md`](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1);
capability readiness is owned by
[`f-foundation-contracts/README.md`](../../../f-foundation-contracts/README.md#capability-readiness).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F4.intent-acceptance@1:conditional-save-units-v1` | [AM-2 F2 unit envelope](../../../../reference/composition-execution.md#am-2-f2-unit-envelope-v1), [AM-4 F4 local acceptance](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1) | `F2.unit-envelope@1` (`unit-envelope`) | `F4.intent-acceptance@1:unit-acceptance-v1`, `F1.reference@1:unit-resolution-v1`, `F2.unit-envelope@1:unit-envelope-v1`, `F4.intent-acceptance@1:acceptance-invariants-v1` | `T3.P01.S05` | `packages/project-model/src/units/save.ts`, `apps/api/src/save-persistence.ts` | `apps/api/tests/save-units.test.mjs`, `apps/editor/tests/lib/project-model/save-protocol.test.ts` | `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s05-unit-acceptance-and-unit-save/acceptance.md` | `d7ab698418f1c705dff9d76524af8140fe9f1466` |

## Scope of this acceptance

The landed `SaveAcceptedSource@1` protocol over the F.2 unit source. Capture validates the accepted
envelope, re-serializes canonical bytes, re-derives unit revisions, verifies the dependency lock over
the same envelope and stamps the snapshot's accepted revision into the persisted copy (the envelope
content digest excludes that field). The server-side handler re-validates the same bytes, refuses a
non-canonical encoding, a mismatched revision, a stale lock or a cross-project capture, and compares
the recomputed content identity and full source hash before admission.

Exercise on real PostgreSQL with zero skips covers two Saves with one saved base (exactly one wins),
missing precondition refusal, identical retry receipt replay, changed payload under one operation ID,
a captured envelope whose revision belongs to another project, a resource lock whose pin disagrees
with the registry, a resource carrying both revision and pin, and a transaction failure after version
staging but before the pointer update leaving the prior version and base intact. A source-level
inactivity test proves no API route selects the unit handler and `app.ts` keeps the current-source
handler.

## Residuals

No live route, client or host wires the unit admission until `T3.P01.S04`; that slice owns migration,
quiescence/recovery and the writer switch. `conditional-save-current-v1` remains the only live Save
route and is not consumed by this capability. Uploaded resource bytes are host-asserted until S04's
storage path verifies them.
