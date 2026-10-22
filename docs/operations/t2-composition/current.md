# T2 — Composition: current baton

Track-scoped handoff. **Replace only this file for T2 work.**

```text
PHASE: T2.P02 Own model import (registered 2026-10-22, batch E) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md
       T2.P01 Supported object composition is CLOSED 2026-10-20, all four children shipped →
       ../../roadmap/t2-composition/t2.p01-supported-composition/README.md
SLICES: T2.P02.S01 is implemented on `t2/p02-s01-model-resource-storage` at `7a90f7d8` and is under
        independent review: the first pass returned CHANGES REQUIRED and every in-scope finding is
        fixed at that revision. The phase's later children stay held and are not on the release
        list; a successor starts only after S01 is accepted and is itself authorized.
BATON: S01 delivers staged model imports, immutable approved revisions, the resources-2 / Scene-3
       formats with a `model` kind, editor-only admission of a Scene model against the envelope's
       own model registry, the host-staging-plus-planner-`resources` dual grant, and in-transaction
       Save verification of every model pin. Expiry sweeps on upload as well as approval; the
       visitor/cold-release reader stays catalogue-only by construction; the generic fallback is
       sized from the approved footprint. Evidence and limits are in
       ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/acceptance.md.
       Declared tier `architecture-integration`, run at `7a90f7d8`: project-model/API/Svelte checks
       0 errors; DB-backed API 12 files / 88 tests, 0 fail, 0 skipped, including streamed 50/25 MiB
       uploads; arch lane 21 / 173; affected editor contracts 39 files / 483. Not accepted and not
       merged. The review-fix commit renders a creator model through its tolerant catalogue lookup
       and footprint fallback, and closes the review's refusal-coverage and index-path findings;
       non-blocking limits are recorded in the acceptance record.
NEXT:  Second independent review pass at `7a90f7d8`; owner review follows a verdict with no open
       finding. Owner acceptance and routine
       closeout follow; the complete repository gate runs on then-current `main` before merge.
ROUTE: ./README.md →
       ../../roadmap/t2-composition/README.md (phase register) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/README.md →
       ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/implementation-plan.md
       → ./current.md (this handoff) →
       ../../roadmap/t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/acceptance.md
       → ../../reference/decisions/batch-e-authorization-2026-10-22.md (provenance)
BLOCKER: None for S01 review. A later child remains unauthorized and needs its own plan approval.
CARRY: The owner may push the local `closed/T2.P01.S03`, `closed/T2.P01.S04` and `closed/T2.P01`
        tags. Cloud Save in a real browser session stays with the host evidence. T2 track
        completion remains a separate owner event. Approved-revision retention is structural
        (cascade on project deletion); the deletion path itself belongs to the later C3 work.
```
