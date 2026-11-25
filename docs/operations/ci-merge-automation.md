# CI and merge automation

**Role:** how the merge gate executes the test contract and how the native GitHub merge queue closes
a change. **Not:** a second test registry, a status store or permission to skip a check. The test
contract is owned by [the tests README](../../apps/editor/tests/README.md).

## Operating model

```text
Implement → local lanes → PR → review → CI → merge queue → merge
```

The queue is native GitHub functionality. An agent does not rebase sibling work or rerun a green PR
to integrate an unrelated merge. The queue validates each batch against current `main`.

## What CI runs

The [Merge gate](../../.github/workflows/merge-gate.yml) runs on every pull request and merge
group, without workflow-level path filters. It also runs Full every Sunday at 07:17 UTC and on
manual dispatch. There is no automatic push run on main.

| Profile | Jobs | Pass condition |
| --- | --- | --- |
| Minimal | Classify/static checks, merge gate | Git whitespace check and, for Markdown, the documentation reference walk |
| Full | Classify, static checks (Biome, tooling tests), suite matrix, Postgres API, linux-x64 goldens, merge gate | Every job succeeds |

**Pull requests stay Full until the queue has run cleanly (D2).** The classifier still recognizes a
Focused profile for editor-source changes, but the pull-request path upgrades it to Full; only a
documentation or CSS-only delta stays Minimal. The Focused job is kept for the lean profile that
VER-9b will enable after the queue proves itself.

The classifier compares the checked-out SHA against the exact base SHA in the event. Git reports
additions and deletions separately for renames so the old path is also classified. The highest
profile wins. A Git, event or checkout error fails the job.

- **Minimal** covers Markdown under the documentation, research and audit roots and the root
  README and CONTRIBUTING guides. It also covers regular CSS additions and edits within editor
  source/static, plus a conservative Svelte style-only proof.
- **Full** covers workspace packages, the API, tests, workflow/configuration, repo routing,
  security, persisted contracts, public/visitor runtime and geometry/layout ownership.

Each matrix suite runs through `tools/harness/run-suite.mjs --suite <name>`. A Vitest suite must
collect at least one test file and one test; an empty lane fails. Command suites prove their result
with the exit status. The Postgres API job runs the same runner against a live database.

The gate reads no artifacts. It re-derives the expected job ids from `prepare`'s profile and
requires `success` from every one. A missing, skipped, cancelled or failed job fails, as does an
unknown event or profile. A merge group must be Full. The single required check context is
`merge gate`; the profile-specific jobs, including `linux-x64` goldens, are enforced by the gate.

## Merge groups

The batch profile uses `merge_group.base_sha` through `merge_group.head_sha`, including the net
effect of every entry. A merge group always runs Full. Group runs keep isolated concurrency.

## Status

`npm run status` prints the checked-out commit, the suite contract and the canary baseline. It no
longer reads remote evidence or reports capability maturity; the gate proves a run, and the canary
runner proves the corpus.

## Merge queue

The prepared ruleset is [`.github/rulesets/main-branch.json`](../../.github/rulesets/main-branch.json).
The owner activates it after PR 1 merges (D2). Until then the queue rule is inactive; do not add
pull requests to a queue.

```bash
gh api --method PUT \
  repos/Biskiq/spatial-sketch-editor/rulesets/22803329 \
  --input .github/rulesets/main-branch.json
```

The ruleset allows merge commits only and sets the queue to `MERGE`, so each packet commit stays
on `main` and LNT-2's blame-ignore entry later points at real history. The only required check is
`merge gate`, from GitHub Actions.

| Setting | Value |
| --- | --- |
| `min_entries_to_merge` | 1 |
| `min_entries_to_merge_wait_minutes` | 0 |
| `max_entries_to_merge` | 1 |
| `max_entries_to_build` | 3 |
| `grouping_strategy` | `ALLGREEN` |
| `merge_method` | `MERGE` |
| `check_response_timeout_minutes` | 60 |

Verify the rule and the required contexts:

```bash
gh api repos/Biskiq/spatial-sketch-editor/rulesets/22803329 \
  --jq '.rules[] | select(.type == "merge_queue" or .type == "required_status_checks")'
```

## Rollback

Revert the gate commit to restore artifact-based certification; revert the ruleset file and
re-apply it with the command above.
