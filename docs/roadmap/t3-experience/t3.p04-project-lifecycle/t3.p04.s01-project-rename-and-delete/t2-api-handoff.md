# Closed T2 API handoff — T3.P04.S01

**AUTHORITY: NONE.** The bounded shared API patch passed T2 review 5643653030 and shipped in PR #191.
The accepted persistence behavior is owned by
[`reference/components/persistence.md`](../../../../reference/components/persistence.md); final
acceptance and the exhaustive gate are recorded in [acceptance.md](./acceptance.md).

**Delivered:** owner-scoped lifecycle routes; migration 007 and retained source-key inventory;
revocable write leases for asset upload, model staging and model approval; failed-write compensation;
durable deletion tombstones and owner-run cleanup/verify retry. Existing T2 model admission remains
the owner of import behavior.
**Entry points:** `apps/api/src/project-lifecycle.ts`, `apps/api/src/project-write-lease.ts`,
`apps/api/src/model-persistence.ts`, `apps/api/src/asset-persistence.ts`,
`apps/api/src/purge-objects.ts`, `apps/api/migrations/`,
`apps/api/tests/project-lifecycle.test.mjs`, `apps/api/tests/project-write-lease.test.mjs`.
**Evidence:** final zero-skip DB-backed API gate and test target in [acceptance.md](./acceptance.md).
**Residuals:** no shared API review dependency remains; production epoch activation is separate.

**Recovery:** `git show d009cf83e2f73129f2c92cf71368a58b796e350e:docs/roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/t2-api-handoff.md` · `git show closed/T3.P04.S01:docs/roadmap/t3-experience/t3.p04-project-lifecycle/t3.p04.s01-project-rename-and-delete/t2-api-handoff.md`
