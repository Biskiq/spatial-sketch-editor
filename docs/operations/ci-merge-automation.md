# CI and merge automation

**Role:** how the merge gate executes the test contract and how the native GitHub merge queue closes
a change. **Not:** a second test registry, a status store or permission to skip a check. The test
contract is owned by [the tests README](../../apps/editor/tests/README.md).

```text
Implement → local lanes → PR → review → CI → merge queue → merge
```

The queue is native GitHub functionality. An agent does not rebase sibling work or rerun a green PR
to integrate an unrelated merge. The queue validates each batch against current `main`.

## What CI runs

The [Merge gate](../../.github/workflows/merge-gate.yml) runs on every pull request, every merge
group and manual dispatch, without workflow-level path filters. There is no push run and no
scheduled run.

| Profile | Jobs |
| --- | --- |
| Minimal | classify/static checks, merge gate |
| Lean (code pull request) | classify, static checks (Biome, tooling tests), fast in two shards, arch, editor and package checks, build, merge gate |
| Full (merge group, manual dispatch) | classify, static checks, suite matrix, Postgres API, linux-x64 goldens, merge gate |

Heavy and API join a Lean run only when their paths change: `packages/**` or
`apps/editor/src/lib/{layout,render,authoring}/**` for heavy, `apps/api/**` or `packages/**` for the
API. A merge group is always Full.

The classifier compares the checked-out SHA against the exact base SHA in the event. Git reports
additions and deletions separately for renames, so both paths are classified; the highest profile
wins, and a Git, event or checkout error fails the job.

- **Minimal** covers Markdown under the documentation, research and audit roots, the root guides,
  regular CSS additions and edits, and a conservative Svelte style-only proof.
- **Lean** covers every other code change; **Full** adds heavy and the Postgres API suite.

Each matrix suite runs through `tools/harness/run-suite.mjs --suite <name>`. A Vitest suite must
collect at least one file and one test; an empty lane fails. Command suites prove their result with
the exit status. The API job runs the same runner against a live database.

The gate reads no artifacts. It re-derives the expected job ids from `prepare`'s profile, plus
heavy/API when the classifier marked them, and requires `success` from every one. A missing,
skipped, cancelled or failed job fails, as does an unknown event or profile, and a merge group must
be Full. The single required context is `merge gate`.

## Merge groups

The batch profile uses `merge_group.base_sha` through `merge_group.head_sha`, including the net
effect of every entry, and always runs Full. Group runs keep isolated concurrency.

## Status

`npm run status` prints the checked-out commit, the suite contract and the canary baseline; it no
longer reads remote evidence or reports maturity.

## Merge queue

The prepared ruleset is [`.github/rulesets/main-branch.json`](../../.github/rulesets/main-branch.json).
The owner activates it after PR 1 merges (D2). Until then the queue rule is inactive; do not add
pull requests to a queue.

```bash
gh api --method PUT repos/Biskiq/spatial-sketch-editor/rulesets/22803329 \
  --input .github/rulesets/main-branch.json
```

It allows merge commits only and sets the queue to `MERGE`, so each packet commit stays on `main`
and the blame-ignore entry points at real history. Settings: one entry per batch, `ALLGREEN`,
`max_entries_to_build` 3, `check_response_timeout_minutes` 60.

## Rollback

Revert the gate commit to restore artifact-based certification; revert the ruleset file and re-apply
it with the command above.
