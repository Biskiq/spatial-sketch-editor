# Merge-gate tooling

The classifier and the gate are the only contract here.

- `plan.mjs` classifies the tested delta and publishes the profile and job flags.
  Code pull requests run Lean with heavy and API verification for their affected
  paths. Eligible Markdown and styles run Minimal. Merge groups and manual
  dispatch run Full. Invalid events, checkouts and deltas fail the gate.
- `matrix.mjs` derives the suite matrix from `suites.mjs`. A suite runs through
  `run-suite.mjs`, which fails on a non-zero exit and on a Vitest lane that
  collects zero files or zero tests.
- `gate.mjs` requires `success` from every job the profile implies. A missing,
  skipped, cancelled or failed job fails; a merge group must be Full.
- `check-docs.mjs` resolves documentation links and written paths.
- `focused.mjs` selects the focused-lane files when the classifier emits that
  profile (kept for the post-D2 lean profile).
- `status.mjs` prints the commit, the suite contract and the canary baseline.

The retired capability-evidence pipeline (aggregate, report, discovery,
producer, guards, event context, issue rules/response, linked fixes, ledger)
is gone. `capabilities.json` remains the journey map's capability ledger.
