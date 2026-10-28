# Option B verification evidence — 2026-10-28

Retained from the Option B implementation session at product head `7c3445e1` (PR #208); committed
with the documentation head `a57588db`. The acceptance record and preservation route are the
[closed acceptance stub](../../acceptance.md). This folder is evidence, not authority.

The three `.log` files here are tracked deliberately past the repository's `*.log` ignore rule, as
the T3.P04.S01 evidence logs are; they are cited receipts, not scratch output.

Present:

- [api-tests.log](./api-tests.log) — DB-backed API contract: 14 suites / 115 tests, 0 failed,
  0 skipped.
- [preservation.log](./preservation.log) — 7/7 branded Chrome T1 S02/S03 preservation scenarios in
  56.8 s.
- [attempts/preservation-concurrent-load.log](./attempts/preservation-concurrent-load.log) — the
  earlier concurrent-load attempt: one failed collinear-pointer assertion, one skipped row, both
  retained. The isolated rerun above passed.
- [attempts/before-mesh-sphere-preparation.json](./attempts/before-mesh-sphere-preparation.json) and
  [attempts/before-second-yield.json](./attempts/before-second-yield.json) — form-open long-task
  windows.
- [native-form-evaluation.json](./native-form-evaluation.json) — CPU-only evaluation and host
  timings (diagnostics; no renderer presentation, no power state).
- [t1-s02-pointer-trace.json](./t1-s02-pointer-trace.json) — pointer and projection trace from the
  isolated preservation pass.

Not present, and not claimed to have been preserved or independently audited (owner-accepted
2026-10-28): the Option B browser journey's raw screenshots, video and ledgers; independent review
receipts at the final product head; a Stage bundle-size report; battery-mode measurements. Battery
rows are deferred to `T5.P01.S03`, the plan's declared integration route.
