# T3.P01.S01 — acceptance record: Shared unit and program codecs

**Slice:** T3.P01.S01 · **Status:** accepted 2026-10-16 · **Plan:** [implementation plan](./implementation-plan.md) · **Phase:** [T3.P01](../README.md)

## Decision

Accepted against the approved plan, AM-2, AM-6 and AM-7. The independent implementation review of `6dcb6d6d9e7e43c0f25f3305672c3cc79e0d577e` found no known in-scope blockers. At closeout, the working tree was clean before documentation changes, the implementation head exactly matched the reviewed revision, and `origin/main` was `bbff4f2005180748e99f2d6d63bbbd37faf3424c`, the declared implementation base. No production, test or configuration changes followed review.

This acceptance covers strict F2 unit/envelope codecs, the additive F1 unit-resolution adapter, the standalone `ExecutionProgram@1` codec, and the pure AM-7 candidate/report converter. It does not activate them in readers/writers or the runtime, implement interpreter behavior, or perform source migration/cutover. Those remain deferred to T3.P01.S03 and T3.P01.S04 as assigned.

## Evidence

The reviewed evidence is recorded in [independent-review.md](./independent-review.md) at the accepted revision. It establishes the plan's architecture-integration tier, including:

- Six S01 conformance/boundary files: 96 tests; unchanged `references-v1` conformance also passes.
- Architecture lane: 16 files / 144 tests; full editor suite: 125 files / 1,693 tests; heavy lane: 8 files / 118 tests.
- `check`, `check:layout-core`, `check:project-model`, `check:camera-core`, `check:api`, editor build, and API tests (39 passed, zero skips).
- Browser smoke of `/`, `/projects`, `/project/x/spatial`, `/p/x` and `/editor`; no page or console errors.
- Diff whitespace check passed. Two parallel full-suite attempts encountered existing timeouts; complete serial execution passed without weakening tests or configuration.

The independent review also covers strict unknown/non-finite/version/pin refusal, canonical identity, converter matrix and replay, resource closure, resolver scope/revision, AM-6 fixtures, program import closure, public route inactivity and unchanged current readers. Its listed S03 interpreter and S04 activation/inventory/CAS obligations remain outstanding by design and are not acceptance claims here.

The complete merge gate on the then-current `main` (`bbff4f2005180748e99f2d6d63bbbd37faf3424c`, also the implementation base) passed during closeout:

- Architecture lane: 16 files / 144 tests; documentation-reference and parallel-track-gate checks passed again after the closeout edits.
- Full editor suite: `npm run test -w @portfolio/editor -- --maxWorkers=1` — 125 files / 1,693 tests passed. A prior full attempt under concurrent load timed out in unchanged expensive tests; the serial full run passed.
- Heavy lane: `npm run test:heavy -w @portfolio/editor -- --maxWorkers=1` — 8 files / 118 tests passed.
- `npm run check`, `check:layout-core`, `check:project-model`, `check:camera-core`, `check:api` and `npm run build` passed; Svelte reported zero errors and warnings. The build emitted the previously noted dependency unused-import and chunk-size warnings.
- `npm run test:api` — 39 tests passed, zero skips, including real local Postgres migration/publication/auth cases.
- `git diff --check` passed. No production, test or configuration file changed during closeout.

No manually owed acceptance row is declared by the plan or review.

## Accepted capability scopes

- `F2.unit-envelope@1:unit-envelope-v1` — accepted; the F2 gate provider remains T3.P01.S01. Capability evidence: [unit-envelope-v1](./capability-unit-envelope-v1.md). Prerequisites: accepted `F1.reference@1:references-v1` and `F3.channels@1:inspection-v1` at the trusted base.
- `F1.reference@1:unit-resolution-v1` — accepted as an additive scope; existing `references-v1` evidence and behavior are preserved. Capability evidence: [unit-resolution-v1](./capability-unit-resolution-v1.md). Prerequisites: accepted `F1.reference@1:references-v1` and `F2.unit-envelope@1:unit-envelope-v1`.

Each capability declares its own scope and prerequisite closure; acceptance of one does not imply acceptance of the other. The execution-program codec and converter are recorded as S01 deliverables under AM-6/AM-7, not as additional gate capabilities.

## Residuals and handoff

- T3.P01.S03 owns the one runtime interpreter, behavior/trace conformance, and required F4/F3 runtime capabilities.
- T3.P01.S04 owns activation, actual inventory, writer quiescence, captured baseline/CAS installation, source cutover, recovery and legacy retirement. No live source or runtime activation is authorized by this record.
- Structural envelope admission remains distinct from recomputing content revisions and selected-program executable closure at a future trusted reader.

## Closeout preservation

This record is the acceptance authority. Its final stub and the preserved plan/review stubs point to exact Git recovery commits. Full merge checks, preservation counts, anchor/tag state, and final SHA are recorded in the closeout report below after the closeout commits are created.
