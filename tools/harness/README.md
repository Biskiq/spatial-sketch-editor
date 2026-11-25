# Merge-gate tooling

The classifier and the gate are the only contract here.

- `plan.mjs` classifies the tested delta and prints the profile. It fails on an
  unknown event, a checkout that does not match the tested SHA, an unreachable
  base or an unreadable delta. Pull requests run Full until the queue has run
  cleanly (D2); only a documentation/CSS-only delta stays Minimal.
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
