# T3.P04.S01 — Project rename and delete: pending acceptance

**Status:** implementation in progress from base `976323da9e18e96978649e595bc555021964631a`;
draft [implementation PR #191](https://github.com/Biskiq/spatial-sketch-editor/pull/191) open;
no acceptance recorded.
**Plan:** [implementation-plan.md](./implementation-plan.md) · **Phase:** [T3.P04](../README.md)

This is the declared **FINAL PHASE GATE** artifact. The owner ratified R1/R2 on 2026-10-25
([PR #188 review](https://github.com/Biskiq/spatial-sketch-editor/pull/188#pullrequestreview-5641779932));
the [implementation plan](./implementation-plan.md) carries those current rules. The owner
authorized test/build execution on 2026-10-25, superseding the earlier blanket deferral. This
permits verification but does not establish S06 completion, release its shared shell/harness
ownership, or accept this slice. No full-slice acceptance, gate/capability change or independent
review is recorded here. Integrated verification is recorded below and in the linked evidence;
the exhaustive-plan residuals and owner-operated performance review remain open. Passing makes
P04 closable, not closed.

## Integrated verification record — 2026-10-25

The complete editor, architecture, heavy, package-check, build, and DB-backed API gates passed.
The final editor suite passed 190 files / 2,458 tests; architecture passed 22 / 178; heavy passed
9 / 125; API passed 110 / 110 with zero skips. `npm run check` reported zero errors and warnings.
The API test database was created for this run and dropped afterward.

The final isolated Chromium lifecycle run passed the Hub, current Stage and real local Fastify/Postgres
journey. It covered immutable rename history, no-op and invalid names, owner/privacy refusals, stale
and ambiguous rename recovery, dirty rename/Undo/Redo/Save, Experience Preview isolation, dirty-delete
cancellation, active/inactive publication behavior, busy-delete retry, pending cleanup and idempotent
retries, stale responses after project replacement, source download, and the 320×800 coarse-touch dialog.
All three queued cleanup records reached `complete`; the owned asset key was removed and a sibling
project's same-content asset survived. The browser database was private and dropped; bytes were in a
process-local test store, with no R2 connection.

The M-grid F9 flow passed 10 measured rename/Save cycles each for cold, warm, and repeat-use cache
states, plus one warm-up in each state. It retained one approved source model and derivative across
all versions. The measured timings are exploratory: this was an agent-operated run, so reference
machine hard-row acceptance remains with the owner.

See [verification.md](./evidence/2026-10-25/verification.md) for tested revisions, commands, browser
and machine profile, p50/p95 results, cleanup tombstones, logs, screenshots, and the exact remaining
verification gaps. Detailed JSON evidence is stored beside it.

## Remaining acceptance work

- Complete the independent slice review and record the separate owner acceptance/closeout operation.
- Run the F9 hard performance rows under the owner-operated reference procedure; the current M
  fixture has one minimal valid source file, not the expected full 15 MiB model catalog.
- Exercise the remaining exhaustive cases: several source files in one approved revision, cleanup
  recovery across a process restart, and a held/hostile object-store write that commits after the
  cleanup completion proof. Existing API tests cover revocation for asset upload, model staging and
  model approval, lease-deadline aborts, source-key backfill/sweep-dependent reporting, and repair of
  a late-visible key; those do not replace the remaining cases.
- Complete the dedicated assistive-technology review and any owner-required branded-browser rows.

Keep PR #191 in draft. No merge, deployment, phase closeout, or S06 completion is authorized or
claimed by this verification record.
