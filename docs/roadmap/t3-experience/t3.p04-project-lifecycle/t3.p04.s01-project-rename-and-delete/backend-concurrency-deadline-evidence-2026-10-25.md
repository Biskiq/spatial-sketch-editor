# Closed backend concurrency evidence — T3.P04.S01

**AUTHORITY: NONE.** The accepted implementation covers fixed monotonic write deadlines, lease
revocation/renewal failure, held advisory-client use, per-writer compensation, complete source-key
inventory and restartable cleanup. Current behavior is in
[`reference/components/persistence.md`](../../../../reference/components/persistence.md); final
acceptance is in [acceptance.md](./acceptance.md).

**Evidence:** fresh final DB-backed API gate: 114 passed, zero failures/skips, with a disposable
database dropped after the run; related concurrency cases are covered by the current API suite and
its regression tests. Full-slice gate counts and test target are in the acceptance artifact.
**Entry points:** `apps/api/src/project-write-lease.ts`, `apps/api/src/project-lifecycle.ts`,
`apps/api/src/model-persistence.ts`, `apps/api/src/asset-persistence.ts`,
`apps/api/tests/project-write-lease.test.mjs`, `apps/api/tests/project-lifecycle.test.mjs`.
**Residuals:** the owner-run retry/verify command repairs a late visible key; no real R2 or production
service was used, and no background cleanup worker is part of this slice.

**Recovery:** `git show d152d47a7424973eeb083612ec93fb9e8170339e:docs/roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/backend-concurrency-deadline-evidence-2026-10-25.md` · `git show closed/T3.P04.S01:docs/roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/backend-concurrency-deadline-evidence-2026-10-25.md`
