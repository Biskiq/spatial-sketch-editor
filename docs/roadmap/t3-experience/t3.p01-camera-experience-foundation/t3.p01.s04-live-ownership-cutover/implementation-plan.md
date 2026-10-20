# T3.P01.S04 — Live ownership cutover (closed stub)

**AUTHORITY: NONE.** T3.P01.S04 shipped 2026-10-20 after independent implementation review ACCEPT at
`06a8aac8fa601de6c808c4d7014b6f360516e648` and routine slice-closeout on PR #158; `T3.P01` closed
2026-10-20. The final-gate evidence, verification provenance, limitations and preservation report are
recorded in the [acceptance record](./acceptance.md), which is now the phase's compacted final-gate
artifact — its accepted body is recoverable at `fd619ef1`.

```text
VERIFICATION: exhaustive
```

**Contract:** [AM-9 Shared Camera and Experience cutover](../../../../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover).
**Entry points:** `packages/project-model/src/units/`; `apps/api/src/`; `apps/editor/src/lib/visitor/`.
**Validation:** `apps/editor/tests/lib/project-model/units-conformance.test.ts`; `apps/editor/tests/lib/experience/experience-runtime.test.ts`; `apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts`; `apps/api/tests/migration-fence.test.mjs`.
**Residuals:** T4 public reader; T2 catalogue/resource verification; owner-run post-merge activation (unexecuted). This plan stays a closed stub; the phase closure is recorded in the phase README's PHASE CLOSE block.

## Prerequisite

Original approved plan and phase criteria: `git show f5147acad03ef5f856e12187666276ccd2de61ed:docs/roadmap/t3-experience/t3.p01-camera-experience-foundation/t3.p01.s04-live-ownership-cutover/implementation-plan.md`.

## Authorization path

Original authorization-path evidence is recoverable from the same Git anchor above. Ratification and authorization are recorded in [the T3 cutover decision](../../../../reference/decisions/t3-cutover-ratification-2026-10-19.md).
