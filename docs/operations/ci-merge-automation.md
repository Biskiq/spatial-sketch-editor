# CI and merge automation

Implement → focused local verification → PR → review → CI → native merge queue → merge.
The [test contract](../../apps/editor/tests/README.md) defines test obligations. Once activated,
the queue validates each batch against current `main`. Agents leave sibling integration to the queue.

## What CI runs

The [Merge gate](../../.github/workflows/merge-gate.yml) runs on every PR, merge group and manual
dispatch. It uses the exact event base and checked-out head and classifies both paths of a rename.
The highest applicable profile wins. Checkout, Git or event errors fail the gate.

| Profile | Jobs |
| --- | --- |
| Minimal | Classify and applicable static checks |
| Lean (code PR) | Static checks (Biome, tooling tests), two fast shards, arch, editor and package checks, build |
| Full (merge group or manual dispatch) | Static checks, full suite matrix, Postgres API, Linux x64 goldens |

Minimal covers Markdown in the documentation, research and audit roots and root guides,
regular CSS edits and additions, and Svelte edits proven style-only. Heavy joins Lean for
`packages/**` or `apps/editor/src/lib/{layout,render,authoring}/**`. API joins Lean for
`apps/api/**` or `packages/**`. A merge group uses the net delta through its head SHA, always
runs Full, and has isolated concurrency.

`tools/harness/run-suite.mjs --suite <name>` requires Vitest to collect files and tests.
Command suites use their exit status and the API job connects to live Postgres.
The single required context, `merge gate`, computes expected jobs from the profile plus
the heavy/API flags. It requires success from each job and fails closed on invalid events
or profiles. `npm run status` reports commit, verification contract and canary baseline.

## Merge queue

The owner activates the [prepared ruleset](../../.github/rulesets/main-branch.json). Queue PRs
only after activation. The ruleset permits merge commits and sets the queue method to `MERGE`
to preserve packet history and blame-ignore SHAs. It uses one entry per batch, `ALLGREEN`,
three concurrent builds and a 60-minute check response timeout.

Owner commands for applying or restoring the versioned ruleset:

```sh
gh api --method PUT repos/Biskiq/spatial-sketch-editor/rulesets/22803329 \
  --input .github/rulesets/main-branch.json
```

## Rollback

Revert the gate commit to restore artifact-based certification. Revert and reapply the ruleset
file to restore its earlier settings.
