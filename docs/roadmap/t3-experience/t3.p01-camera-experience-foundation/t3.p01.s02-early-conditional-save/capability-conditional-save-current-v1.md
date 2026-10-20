# `F4.intent-acceptance@1:conditional-save-current-v1` — accepted capability record

**Capability:** `F4.intent-acceptance@1:conditional-save-current-v1` · **Status:** retired (2026-10-19 by `T3.P01.S04` phase B) · **Gate:**
[`F4.intent-acceptance@1`](../../../README.md#gate-register) · **Original gate provider:**
`T1.P01.S03` · **Extension slice:** `T3.P01.S02`

F.4 semantics stay owned by
[`composition-execution.md`](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1);
capability readiness is owned by
[`f-foundation-contracts/README.md`](../../../f-foundation-contracts/README.md#capability-readiness).

## Accepted capability

| Capability | Anchor | Source kinds | Prerequisites | Extension slice | Exports | Conformance | Acceptance | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `F4.intent-acceptance@1:conditional-save-current-v1` | [AM-4 F4 local acceptance](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1) | `current-source@5` (wall-first Layout / world-local Scene) | `F4.intent-acceptance@1:local-single-domain-v1`, `F1.reference@1:references-v1` | `T3.P01.S02` | `packages/project-model/src/save/index.ts`, `packages/project-model/src/save/protocol.ts`, `apps/api/src/save-persistence.ts`, `apps/editor/src/lib/authoring/save/save-state.ts`, `apps/editor/src/lib/platform/project-persistence.ts` | `apps/editor/tests/lib/project-model/save-protocol.test.ts`, `apps/editor/tests/lib/authoring/save-state.test.ts`, `apps/editor/tests/lib/platform/project-persistence.test.ts`, `apps/editor/tests/lib/authoring/save-call-sites.test.ts`, `apps/editor/tests/lib/authoring/save-admission-parity.test.ts`, `apps/editor/tests/lib/authoring/f4-public-isolation.test.ts`, `apps/api/tests/save.test.mjs` | `docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s02-early-conditional-save/acceptance.md` | `8dd53260d4ba1545ef2977612d78a00f80d8d393` |

## Scope of this acceptance

This slice activates only the current-source conditional-Save protocol. `SaveAcceptedSource@1`
captures an immutable locally accepted source and its canonical bytes, `AcceptedRevision`,
full-content digest, `sourceKind`/`sourceVersion`, a stable operation ID and a `create-only` or
`expected-saved-base {token}` precondition. One server write path runs the shared current-source
admission (`admitCurrentSourceContent`) under a row lock, compares ownership and the saved-base token,
recomputes the digest and commits version/pointer/receipt atomically; a partial version/pointer update
is impossible. A durable saved-base token — distinct from the local revision, the SQL `version`
ordinal and publication OCC — is returned and read back additively, so the read-only boot works in
either merge order. Receipts make retries idempotent and changed payloads under one operation ID
refuse. The framework-free client Save state owns never-saved/saved/dirty/saving/conflict/refused/
error/auth-required, full-source dirty comparison, epoch-guarded acknowledgements and explicit
conflict reload; it activates no F2/unit source and no route. The content-identity scheme travels as
transport metadata, pinned by a golden-digest conformance test.

## Residuals

This record accepts no F2/unit/compound Save, no source cutover, no migration inventory or recovery,
and no host/Head Save control. The `conditional-save-units-v1` successor is `T3.P01.S03`;
activation, retirement and the integrated result are `T3.P01.S04`; the PLATE Head Save integration
is T1's host↔F4 slice (`T1.P01.S04` by default). `T3.P01.S04` phase B retired this current-source
scope on 2026-10-19: no live caller or unfinished consumer requires it, the protocol module remains
as the source-agnostic capture vocabulary, and this record stays as the historical acceptance
evidence only. Two pre-existing, out-of-scope deferred findings
are recorded in [`operations/tech-debt`](../../../../operations/tech-debt/README.md).
