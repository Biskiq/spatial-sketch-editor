# T3.P01.S05 — acceptance record: Unit acceptance and unit Save

**Slice:** T3.P01.S05 · **Status:** in-progress — no acceptance recorded
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Phase:** [T3.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

No evidence is recorded against this slice yet. `T3.P01.S05` is the owner-authorized first half of
the split `T3.P01.S03`; the preparatory increment in PR #138 is accepted for that increment only and
is not this slice's acceptance.

When implementation completes, record here, in the form
[the tests README](../../../../../apps/editor/tests/README.md#what-a-change-requires) requires:

- the tested commit and base, the author/date and the reviewer identity;
- the criteria-to-evidence mapping, including the planner/compound/resource-rollback/undo cases;
- exact command results for `check:project-model`, `check:api`, `check`, the focused conformance
  files, `test:arch`, the editor full lane and `test:api` with a reachable `DATABASE_URL`;
- the real-Postgres Save evidence with **zero skips**, naming the contention, retry, changed-payload
  and failed-transaction cases;
- the call-site proof that no route, client or host reaches the unit admission or unit Save;
- any residual, with its owning slice (S04 owns activation, migration and the live writer switch).

An ACCEPT verdict must address the whole registered slice, not merely the code increment.
