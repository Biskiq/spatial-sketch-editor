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

## Profiles

Minimal covers Markdown in the documentation and research roots and root
guides, regular CSS edits and additions, and Svelte edits proven style-only.
Lean runs static checks (Biome, tooling tests), two fast shards, arch, editor
and package checks, and the build. Heavy joins Lean for `packages/**` or
`apps/editor/src/lib/{layout,render,authoring}/**`. API joins Lean for
`apps/api/**` or `packages/**`. Full runs at merge group or manual dispatch.
The highest applicable profile wins, and a merge group must be Full.

## Merge queue

The owner activates the prepared ruleset `.github/rulesets/main-branch.json`.
It permits merge commits and sets the queue method to `MERGE` to preserve packet
history and blame-ignore SHAs, with one entry per batch, `ALLGREEN`, three
concurrent builds and a 60-minute check response timeout. Apply or restore it
with:

```sh
gh api --method PUT repos/Biskiq/spatial-sketch-editor/rulesets/22803329 \
  --input .github/rulesets/main-branch.json
```

Revert the gate commit to restore artifact-based certification. Revert and
reapply the ruleset file to restore its earlier settings.
