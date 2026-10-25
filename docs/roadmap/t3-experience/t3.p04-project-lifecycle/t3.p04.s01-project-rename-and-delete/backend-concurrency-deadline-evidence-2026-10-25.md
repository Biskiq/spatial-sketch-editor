# T3.P04.S01 — Backend concurrency and deadline follow-up

**Scope:** resolve the two P1 findings in [PR #191 review 5643805919](https://github.com/Biskiq/spatial-sketch-editor/pull/191#pullrequestreview-5643805919). This is backend evidence only; it does not accept the slice or close T3.P04.

## Changes

- The project write deadline now uses a monotonic clock anchored before lease acquisition. Acquisition and commit latency consume the same fixed lifetime; an expired acquisition is rejected before writer work begins. Synchronous checks abort on elapsed deadlines at streamed byte, object-write and finalization boundaries, independent of timer delivery.
- Advisory-lock callbacks receive and reuse their checked-out database client. Model approval reads, transactions, compensation checks and staged cleanup use that client; the lease is checked and renewed on the same client after lock acquisition. Project deletion cleanup also uses its locked client for every query. Transactions on a caller-owned client do not release it.
- The per-content approval lock remains held through finalization and compensation. Restricted-pool tests verify two same-content approvals preserve the single winning revision bytes, both imports reach `approved`, cleanup attempts serialize, and connections/locks are released. One-client probes cover one approval and one deletion cleanup.

## Regression evidence

The new deadline tests were copied into a temporary archive of the pre-fix `d009cf83e2f73129f2c92cf71368a58b796e350e` source and failed **3/3**: acquisition latency, delayed commit response and synchronous elapsed-time detection each incorrectly started writer work. They pass **3/3** on the fixed source.

The restricted-pool lifecycle regressions failed on the pre-fix source: concurrent approval returned `service_unavailable` / `project-busy`, and single-client deletion cleanup left `attempt_count` at `0` instead of recording its listing attempt. On the fixed source, the lifecycle file passes **10/10**, including those probes.

## Verification

- Tested revision: `821adf6a9bb04f66287f333720191e4d59b48253` (tree `a647c21115299c618544deedb619505a1199a3bf`). The implementation first landed in `97efb6009a3b4ada35945577a3626dca0c71c413`; the tested head also includes the regression assertion order that independently exposes cleanup failure on the old source.
- `npm run check:api` passed.
- `DATABASE_URL=postgresql://localhost:5432/biskiq_p04_s01_p1_821adf_20261025 npm run test:api` passed: **110 passed, 0 failed, 0 skipped**. The script rebuilt the API before running every API test file.
- The private database `biskiq_p04_s01_p1_821adf_20261025` was dropped after the run. Baseline private database `biskiq_p04_s01_p1_baseline_20261025` and the temporary baseline source archive were also removed. No S06/shared database was touched.
- `git diff --check` passed before the implementation commit.

The complete UI, browser, accessibility, performance and integrated slice acceptance remain open for their owners. Keep PR #191 in draft; this evidence does not authorize slice acceptance, phase closure, merge or deployment.
