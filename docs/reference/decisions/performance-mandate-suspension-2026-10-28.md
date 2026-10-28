# Performance-mandate suspension — 2026-10-28

**Status: owner decision, 2026-10-28.** The owner suspended the mandatory
performance-benchmarking strategy **indefinitely**. The
[browser-performance contract](../components/performance.md) remains the owner of profiles,
workloads, metric definitions, budgets and historical results, but no slice, phase or final gate
owes a benchmark pass as an acceptance prerequisite.

This record is decision provenance, like the
[performance-foundation authorization](./performance-foundation-authorization-2026-10-24.md) and
the [S04 authorization](./t1-p02-s04-authorization-2026-10-28.md). It changes no product behavior,
format, gate, package or correctness requirement. It supersedes every standing statement that a
performance row must be measured before acceptance, including the S04 performance recheck and the
deferred S01/S02/S03/S06 rows.

## Decision

```text
MANDATE      Suspended indefinitely: no mandatory performance-benchmarking strategy.
NOT RUN      The formal F2/F3/F4/F8/F13 matrix, battery-mode certification and the full
             `npm run perf` workflow are not authorized by this decision or by an ordinary
             slice/final-gate request.
TRIGGER      Performance investigations are exclusively owner-initiated, triggered by an
             observed slowdown. No agent, slice plan or closeout may start one on its own.
EVIDENCE     Existing measurements remain historical evidence. They are not mandatory acceptance
             prerequisites, are not revalidated by this decision, and do not become passes for
             rows they did not measure.
UNMEASURED   A row that was not measured stays **unmeasured**, never a pass and never a silent
             waiver.
PRESERVED    Harnesses, workloads, scripts, raw evidence and documented methods stay in the tree
             for a future owner-initiated investigation.
CORRECTNESS  Correctness, architecture, build, package, DB-backed API and functional browser
             verification are unchanged and are not waived.
```

## Scope and effect

- **Repository-wide policy.** Every consuming slice, phase and final gate is released from the
  mandatory performance prerequisite, not only `T1.P02.S04`.
- **No benchmark authorized.** This message authorizes no run on the designated reference machine
  and no battery-mode certification. The aborted S04 formal attempt produced no manifest and is
  not evidence; it is recorded as an aborted, unmeasured attempt only.
- **Historical rows.** S01's F2 S/M timings, S02's formal F3/F4/F8/F2/F13 family and 456.0 KiB br
  Stage miss, S03's F4/F8 Opening rows and 426.7 KiB br exception, and S06's battery qualification
  and grid-XL/sweep rows keep their recorded status. Unmeasured rows remain unmeasured; the
  recorded Stage misses remain misses, not repaired or erased.
- **Review and closure.** S04's acceptance criteria now rest on the complete correctness,
  architecture, package, API and functional browser evidence. The phase may become closable
  without a performance pass, subject to the standing independent-review and P1 merge rules.
- **Future performance work.** An owner-observed slowdown can commission a bounded investigation
  against the preserved harness and contract. That investigation states its own scope, hardware
  and evidence rules; this record supplies none.

## Preserved

- the one-compiler rule, every correctness invariant and every determinism/scale oracle;
- all existing harnesses and historical evidence, including the S06 milestone and Bench 1/Bench 2
  records;
- the designated-reference-machine definition as historical method, not a current acceptance
  requirement;
- the production hold and every unrelated authorization boundary.

## Owner signature

```text
Performance-benchmarking mandate suspended indefinitely. Investigations are owner-initiated only,
on an observed slowdown. No benchmark is authorized by this message; correctness is not waived.
Owner: repository owner (2026-10-28 direction)   Date: 2026-10-28
```
