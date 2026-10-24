# T2 — Composition: current baton

Track-scoped handoff. **Replace only this file for T2 work.**

```text
PHASE: T2.P02 Own model import (registered 2026-10-22, batch E; in progress) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
       T2.P01 Supported object composition is CLOSED 2026-10-20, all four children shipped →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: T2.P02.S01 is shipped with owner-override acceptance dated 2026-10-23. The acceptance and
        preservation stub records the current accepted implementation identity, actual test/review
        source identities, waived prerequisites, and closeout report:
        ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/acceptance.md.
BATON: S01 delivers owner-only model staging and immutable approved revisions, resources format 2,
       Scene format 3, editor-host admission from the same envelope, and Save verification against an
       approved same-project revision. The visitor/public release path stays catalogue-only. Durable
       current behavior is in the owning assets, Scene content and persistence references.
       S02 (import, review, approve, place) IN PROGRESS on `t2/p02-s02-import-review-approve-place`,
       cut from trusted base `fff7dc14`.
START: 2026-10-23 — T2.P02.S02 start step recorded.
       ELIGIBILITY: the phase child row is `approved`; `docs/roadmap/now.md` lists the scope and its
       condition (post-Batch-E coordination PR merged on `main`) is met by `fff7dc14`; every consumed
       gate is `accepted` at that base — F1.reference@1 (`unit-resolution-v1`), F2.unit-envelope@1
       (`unit-envelope-v1`), F4.intent-acceptance@1 (`unit-acceptance-v1`, `conditional-save-units-v1`),
       T1.viewport-projection@1 (`viewport-projection-v1`).
       CYCLE: S02 is NOT listed under this file's exposure slices (the T1.P01 window is closed), so
       `open-window` does not apply and no cycle transition is claimed.
CLAIM:  Shared files claimed before edit, patch base `fff7dc14`:
       · `packages/project-model/src/scene-planning/**` except `frame.ts` — T2 writer; T1.P02.S05 owns
         `frame.ts` and T2 does not edit it.
       · `packages/project-model/src/units/**` (`acceptance.ts`, `planning.ts`, barrels) — additive only;
         T3.P02.S02 reviews as F2 owner; serialize per the shared-file table.
       · Stage host/shell (`apps/editor/src/lib/authoring/stage/**`, `stage/shell/**`,
         `routes/project/[projectId]/spatial/+page.svelte`) — bounded T1-reviewed patch inside this PR
         (editable Card facts, Library/Head Find invocation, model-render input threading).
       · Visitor/Preview runtime (`museum/assets/AssetModel.svelte`, `visitor/VisitorEntities.svelte`,
         `visitor/VisitorPreviewSurface.svelte`) — T2 writer for the approved-model resolution input;
         T3 reviews Preview/visitor-boundary unchanged (bounded prop threading only).
       · `apps/editor/perf/flows/**` — new S02 flow only; shared harness/fixture edits untouched.
       · `apps/api/src/{app.ts,model-persistence.ts}` — claimed but so far UNCHANGED: S01's routes are
         reused, not duplicated. Any edit needs `check:api` + DB-backed `test:api`.
NEXT:  S02 implementation is COMPLETE on `t2/p02-s02-import-review-approve-place` and the
       implementation-PR merge gate is green (`npm run test` 185/2,410; arch 176; heavy 125;
       `check`/`check:api`/`check:project-model` 0 errors; build; `test:api:stack` 95 pass,
       0 skipped on localhost:5434; `perf:bundle` keeps Import/decoders off every route load set).
       [acceptance.md](../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s02-import-review-approve-place/acceptance.md)
       records the evidence, the independent-review dispositions, the licence table and the explicit
       unrun rows. OWNER ACCEPTANCE IS OWED and the PR is not merged. Unrun: every browser journey,
       Preview pixels and all F5/F6/GPU/F13/first-load flow rows (no authenticated session here),
       texture/decoder fixtures with real maps, and the >25 MiB derivative cap.
       STOP-AND-REPORT: editable numeric Card facts need T1's agreement before build (a new host
       interface); this PR keeps the landed read-only Card facts and puts numeric edits in the
       adapter instrument.
       S03 stays held as the proposed exhaustive final gate; no phase close or track completion is
       claimed.
RELEASE: ../../reference/decisions/post-batch-e-authorization-2026-10-23.md
ROUTE: ./README.md → ../../roadmap/t2-composition/README.md →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md →
       ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/acceptance.md →
       ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s02-import-review-approve-place/implementation-plan.md
BLOCKER: none beyond the release-list condition. Omitted scopes stay held.
CARRY:  Project-deletion implementation and model-revision cleanup belong to T3's proposed C3
        lifecycle work. S03 verifies retention/pin integrity without adding deletion. Further
        planning pairs T1 face frames with solve-once placement; component provider work precedes
        Stage part-selection/admission UI and annotations. No follow-on authorization is implied.
```
