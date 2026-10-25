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
review is recorded here. Verification is recorded below and in the linked evidence; the listed
residual API cases are covered by the later follow-up. On 2026-10-25 the owner accepted automated
reference-machine observation for this slice and clarified that AC/battery and agent-operation
differences are not blockers; the numeric F9 hard budgets remain binding. The fresh attributed F9
run is recorded below; independent slice review remains open. Passing makes P04 closable, not closed.

## Fresh corrected F9 verification — 2026-10-25

The F9-only headed Chrome run passed one test with 60 measured saves: ten each for S/M ×
cold/warm/repeat-use, plus one warm-up per cell. All samples joined the exact screenshot source/frame
identity to a unique nonforked `STATE_PRESENTED_ALL` report before receipt. Event Timing observed all
ten clicks in each cell; none were censored below 16 ms.

| Fixture | Cache | Save-owned main-thread work p50 / p95 / max (ms) | Presented feedback p50 / p95 (ms) | Receipt p95 (ms) | Receipt target (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| S | Cold | 6.0 / 7.4 / 7.4 | 69.4 / 86.1 | 125.7 | 651.5 |
| S | Warm | 4.9 / 5.5 / 5.5 | 70.2 / 70.6 | 122.5 | 651.5 |
| S | Repeat-use | 5.0 / 5.4 / 5.4 | 69.8 / 87.3 | 123.4 | 651.5 |
| M | Cold | 15.6 / 17.1 / 17.1 | 66.7 / 67.5 | 535.9 | 1,056.3 |
| M | Warm | 14.8 / 16.3 / 16.3 | 66.1 / 68.3 | 534.7 | 1,056.3 |
| M | Repeat-use | 15.1 / 33.3 / 33.3 | 67.4 / 83.7 | 535.1 | 1,056.3 |

All 60 samples were within the Save-owned work limit of 50 ms and the presented-feedback p95 limit
of 100 ms. Every click-to-durable-receipt sample was within its N1 payload-based target. The earlier
whole-window RunTask union remains a diagnostic and is not used as Save CPU.

The test used Google Chrome `155.0.8059.85`, Mac14,2 / macOS 15.7.2, 1920×1080 CSS at DPR 1, and
N1 networking (40 ms latency, 625 kB/s upload, 2.5 MB/s download). Machine capture recorded battery
power at 100% and Low Power Mode off; the owner ruling explicitly accepts the AC/battery difference
and automated operator for this slice. M was grid-7 (112 walls, 112 openings, 49 rooms) with one
minimal valid GLB source/derivative pair; the source bytes are not part of the Save request. This
meets the slice retained-model requirement and does not claim the typical M catalog workload.

The measured browser source is commit `31c83a7cbfc126690272c5de14c132b518d31825`, tree
`ac154840d056b9461ef9b658255a4e84e381ee20`; the built product code is commit
`65689f4f34d4ae07ed863b32703b9aa27ea4568c`, tree `7999d5e24ff654d896d46d373483dcc3c68ea71c`.
The worktree was clean at capture. The private database was dropped by the exit trap, the supervisor
closed its browser/API/preview resources, the in-memory store had no R2 connection, and there were no
agent-browser sessions before the run.

Evidence: [sample distributions and frame identities](./evidence/2026-10-25/f9-attribution-31c83a7c/project-lifecycle-f9-s-m-branded-chrome.json), [verification transcript](./evidence/2026-10-25/f9-attribution-31c83a7c/foreground-supervisor.log), [machine facts](./evidence/2026-10-25/f9-attribution-31c83a7c/project-lifecycle-machine-facts.json), [supervisor cleanup](./evidence/2026-10-25/f9-attribution-31c83a7c/project-lifecycle-supervisor-result.json), [S warm frame](./evidence/2026-10-25/f9-attribution-31c83a7c/project-lifecycle-f9-feedback-s-warm.jpg), and M frames ([cold](./evidence/2026-10-25/f9-attribution-31c83a7c/project-lifecycle-f9-feedback-m-cold.jpg), [warm](./evidence/2026-10-25/f9-attribution-31c83a7c/project-lifecycle-f9-feedback-m-warm.jpg), [repeat-use](./evidence/2026-10-25/f9-attribution-31c83a7c/project-lifecycle-f9-feedback-m-repeat-use.jpg)).

## Initial integrated verification record — 2026-10-25

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

The initial M-grid F9 flow passed 10 measured rename/Save cycles each for cold, warm, and repeat-use cache
states, plus one warm-up in each state. It retained one approved source model and derivative across
all versions. The measured timings are exploratory: this was an agent-operated run, so reference
machine hard-row acceptance remains with the owner.

See [verification.md](./evidence/2026-10-25/verification.md) for the initial gate and the later
residual follow-up, including tested revisions, commands, browser and machine profile, distributions,
cleanup tombstones, logs, screenshots, and current limitations. Detailed JSON evidence is stored beside it.

## Prior residual API and headed Chrome follow-up — 2026-10-25

**Code/evidence commit:** `e41dffea`; PR #191 remains a draft.

The full API suite passed 114 tests with zero failures or skips on a fresh disposable PostgreSQL
database. `npm run check:api`, the editor check, editor build, the focused Save-trace tests (2/2), and
the focused Playwright harness typecheck passed. The API additions cover several source files in one
approved revision with exact source-copy checks; migration replay and same-content sibling survival;
inventory enumeration of staged owned-prefix objects; cleanup restart in fresh child processes over
a persistent test object store after API shutdown; and a hostile delayed remote PUT that commits after
the completion proof, is found by completed-record verification, and forces spaced re-proof. Lease
renewal database failure also fails closed and releases the lease. The implementation now lists the
completed prefix before removing durable inventory, so a late object under a known key cannot be
hidden from repair.

An earlier strict headed Chrome F9 run passed on Google Chrome `155.0.8059.85` on Mac14,2 / macOS
15.7.2. It used 1920×1080 at DPR 1, N1 networking (40 ms latency, 625 kB/s upload, 2.5 MB/s
download), one warm-up and ten measured samples for every S/M × cold/warm/repeat-use cell. All 60
samples recorded the visible “Saving…” label at the render boundary, exact screenshot source/frame
identity, and a unique nonforked `STATE_PRESENTED_ALL` report before the durable receipt. Event Timing
reported all ten events in every cell; none were censored below 16 ms. The p50/p95 distributions are:

| Fixture | Cache | Trace-reported feedback (ms) | Click-to-receipt RunTask union (ms), diagnostic only | Click → durable receipt (ms) | Server-Timing (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| S | Cold | 60.0 / 71.3 | 19.2 / 23.6 | 120.3 / 127.0 | 86.7 / 93.3 |
| S | Warm | 70.8 / 71.1 | 17.9 / 32.6 | 120.0 / 122.4 | 85.4 / 116.0 |
| S | Repeat-use | 70.3 / 71.3 | 18.0 / 33.4 | 118.2 / 122.2 | 84.1 / 89.4 |
| M | Cold | 66.9 / 68.1 | 129.1 / 155.7 | 529.1 / 627.6 | 516.4 / 616.5 |
| M | Warm | 67.6 / 69.5 | 104.2 / 126.7 | 530.1 / 551.7 | 516.6 / 542.4 |
| M | Repeat-use | 67.0 / 69.2 | 113.9 / 122.6 | 529.9 / 580.1 | 516.8 / 570.5 |

The receipt allowance derived from payload size and N1 is 651.5 ms for S and 1,056.3 ms for M;
the observed p95 values are below those amounts. The RunTask column is the union of every renderer
main-thread task between click and receipt, including Stage work during WebCrypto and network waits;
it is not Save-attributed CPU work and must not be compared with the 50 ms F9 hard budget. This run
therefore does not settle the numeric CPU row; the fresh attribution verdict is recorded above. The
owner has accepted automated reference-machine observation for this slice and waived the AC/battery
distinction and agent-operator criterion.
Storage was process-local memory, and M used a minimal valid retained GLB rather than a full typical
M catalog. Chrome's compositor report is browser-reported presentation and does not prove physical
panel scanout.

Evidence: [F9 distributions and sample rows](./evidence/2026-10-25/project-lifecycle-final-chrome-f9-s-m.json),
[API test log](./evidence/2026-10-25/api-residual-test.log), [headed Chrome result](./evidence/2026-10-25/project-lifecycle-final-chrome-f9-playwright-result.json),
[machine facts](./evidence/2026-10-25/project-lifecycle-final-chrome-machine-facts.json),
[integrated Chrome UI/API result](./evidence/2026-10-25/project-lifecycle-final-chrome-playwright-result.json),
[S warm Saving frame](./evidence/2026-10-25/project-lifecycle-f9-feedback-s-warm-final-chrome.jpg),
[M cold Saving frame](./evidence/2026-10-25/project-lifecycle-f9-feedback-m-cold-final-chrome.jpg).
The bounded browser semantics assertions remain in the integrated journey. No separate manual
screen-reader/assistive-technology audit was run or added as a gate.

## Prior static attribution checkpoint — superseded by the fresh run above

The previous F9 samples reported the full click-to-receipt RunTask union, which includes ambient
Stage/rendering work while the Save waits for WebCrypto and the API. The updated harness reports that
window only as a diagnostic. It measures named synchronous Save scopes (validation, canonical
encoding and SHA preparation/dispatch/formatting, normalization, lock resolution, serialization,
request construction/dispatch, and acknowledgement/state work), then unions those timestamps with
the renderer tasks containing the Saving and Saved status mutations. Overlap is counted once;
async hash elapsed time is recorded separately and is not added as main-thread CPU. The request
boundary is after JSON construction and immediately before fetch dispatch.

This checkpoint recorded the attribution implementation and focused static checks before the new
browser sample. Its then-pending numeric verdict is superseded by the fresh run above. The M lifecycle
fixture retains one model source/derivative pair and meets this slice plan's retained-model
requirement; it does not represent the typical M shape of 60 objects and 15 distinct GLBs. The
[static check record](./evidence/2026-10-25/f9-attribution-static-checks.json) retains the
implementation revision and check commands.

## Remaining acceptance work

- Complete the independent slice review and record the separate owner acceptance/closeout operation.

Keep PR #191 in draft. No slice acceptance, merge, deployment, phase closeout, or S06 completion is
authorized or claimed by this verification record.
