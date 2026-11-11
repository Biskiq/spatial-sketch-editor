# CI and merge automation

**Role:** how the merge gate executes the test contract and how the native GitHub merge queue closes
a change. **Not:** a second test registry, a status store or permission to skip a check. The test
contract is owned by [the tests README](../../apps/editor/tests/README.md); this page describes the
execution and activation boundary.

## Operating model

```text
Implement → focused local tests → PR → review → CI → merge queue → merge
```

The queue is native GitHub functionality. An agent does not rebase sibling work, update a behind
branch by hand, or rerun a green PR to "integrate" an unrelated merge. The queue validates each batch
against current `main`, so one standalone PR proceeds without waiting for another and independent
PRs can be queued without manual rebasing.

## What CI runs

The [Merge gate](../../.github/workflows/merge-gate.yml) runs on `pull_request`, on `push` to `main`
and on `merge_group`, with no path filter. It records one provenance artifact per required suite and
the `merge gate` aggregator refuses a run whose evidence is missing, failed, interrupted, from
another commit, produced by a command override, or missing a real reporter artifact.

| Suite | Kind | Why it is separate |
| --- | --- | --- |
| `npm run test:fast` | Vitest | The complete population minus the arch and heavy lanes |
| `npm run test:arch` | Vitest | Unconditional architecture, isolation and documentation boundaries |
| `npm run test:heavy` | Vitest | Dense correctness, property and stress work |
| `npm run check` | command | Svelte/TypeScript check |
| `npm run build` | command | Editor production build |
| `npm run check:api` | command | API TypeScript check |
| `npm run test:api` | TAP | DB-backed API contract, zero skips |
| `package checks` | command | Camera, layout, geometry and project-model type checks in one job |

The four package checks share one job because they are homogeneous `tsc` runs whose separate
checkouts and installs cost more than the checks themselves. Grouping is a job-shell change only:
the job runs four producers, and the aggregate still requires all four provenance records. Every
other suite keeps its own stable check name.

The editor population is partitioned, not sampled. `test:fast` excludes exactly the curated arch and
heavy files; [lane-membership.test.ts](../../apps/editor/tests/config/lane-membership.test.ts) proves
that every curated entry exists, the lanes are disjoint, and `fast + arch + heavy` equals every
collected test file. It also reads the three lane configs, so a hand-edited include cannot silently
drop a file. `npm test` remains the complete local suite and is never narrowed or removed; CI does
not run it on top of the lanes because that would execute every arch and heavy test twice.

The arch lane is never path-gated. A documentation-only change still runs it, and the provenance
aggregator cannot certify a run that omitted it.

## Merge-group contract

Every workflow that provides a required context also triggers on `merge_group`:

- [Merge gate](../../.github/workflows/merge-gate.yml) — `merge gate`, `check guards` and every
  suite job.
- [Native form Linux x64 goldens](../../.github/workflows/native-form-goldens.yml) — `linux-x64`.

For a merge-group run, `github.sha` is the synthetic merge commit GitHub built for the batch. Every
job checks out that same commit and the aggregator records it with `--commit "$GITHUB_SHA"`, so the
report is correctly attributed to the tested queue commit and never mistaken for a `main` push
report. `status` discovery still accepts only a successful `push` run on `main`; merge-group reports
are merge evidence, not main history.

`check guards` must report on the queue commit. A `merge_group` payload has no PR number and its
`head_sha` is the synthetic integration commit, not a PR head. The base branch comes from
`merge_group.base_ref` (never the unavailable `github.base_ref`) and is validated against the
repository default branch. [event-context.mjs](../../tools/harness/event-context.mjs) walks the
synthetic commit's first-parent chain back to `base_sha`; each merge's second parent is a queued PR
head, matched to an open PR through GitHub's own commit association.

Each entry is evaluated separately: its own labels authorize only its own integration delta, from
the previous queue tip to that entry's merge commit. The first entry starts at the event's exact
`base_sha`; no `origin/main` fetch is used for a queue run, so a branch that advanced after the group
was built cannot change the comparison. An owner approval on PR A therefore cannot authorize a check
removal in unrelated PR B. A non-merge commit, an entry with no open PR, a head mismatch, or a
non-default base fails closed.

Merge-group concurrency is not cancelled: a queue group is already an isolated validation, and
cancelling it would discard evidence GitHub is waiting for. Pull-request runs and `main` pushes keep
`cancel-in-progress`.

## Measured baseline

The 2026-11-11 baseline run (`43104546090`) took **6m23s** wall-clock and **15.95 runner-minutes**
across 14 merge-gate jobs. `npm test` alone was 285s and sat on the critical path, while
`test:arch` (59s) and `test:heavy` (170s) re-ran files it had already executed.

The post-change measurement is recorded on the implementation PR, against the final head SHA, using
the same method: run-created-to-updated wall-clock and the sum of per-job `started_at` to
`completed_at` durations from the Actions jobs API. A timing claim is evidence only when a run
actually produced it; this page does not pre-state the result.

Sharding was evaluated and not adopted. Splitting the heavy lane would require a shard-aware
provenance merge, and the remaining critical path is the API lane; the added evidence complexity is
not justified by the wall-clock it could recover. Grouping the remaining editor and API checks with the package checks would save setup time but
serialise the critical static checks behind one job, so those stay parallel. The measured baseline
and the final measurement are compared job-for-job on the same runner class.

## Activation (one owner action, after this merges)

The queue rule is **not active** in the repository today. Do not add pull requests to a queue before
this command runs. Activate only after the workflows above are on `main`.

Prerequisite: the repository is public, so GitHub merge queue is available. Confirm the workflow
runs on `main` contain `merge_group` and that the required contexts are unchanged.

```bash
gh api --method PUT \
  repos/Biskiq/spatial-sketch-editor/rulesets/22803329 \
  --input .github/rulesets/main-branch.json
```

This is a full, reviewable ruleset replacement: the existing deletion, non-fast-forward,
pull-request and required-status-check rules are preserved byte-for-byte, and the merge-queue rule is
added. The required contexts remain exactly `merge gate`, `check guards` and `linux-x64`, each with
the GitHub Actions integration. The branch condition remains `~DEFAULT_BRANCH`; no wildcard is
introduced.

The queue is configured for single-PR integration, no minimum batch wait and modest concurrent
validation:

| Setting | Value | Meaning |
| --- | --- | --- |
| `min_entries_to_merge` | 1 | A single PR can merge immediately |
| `min_entries_to_merge_wait_minutes` | 0 | No artificial batch wait |
| `max_entries_to_merge` | 1 | A batch merges one PR at a time |
| `max_entries_to_build` | 3 | At most three PRs are validated concurrently |
| `grouping_strategy` | `ALLGREEN` | Every PR in a batch must pass |
| `merge_method` | `SQUASH` | Squash each queued PR, matching the repository convention |
| `check_response_timeout_minutes` | 60 | Bounded wait for required checks |

Verify the rule and the required contexts:

```bash
gh api repos/Biskiq/spatial-sketch-editor/rulesets/22803329 \
  --jq '.rules[] | select(.type == "merge_queue" or .type == "required_status_checks")'
```

## Rollback

Remove the queue rule first, then revert the workflow change. Reverting the workflow while the queue
is active would leave queued PRs waiting for a `merge_group` context that no longer reports.

```bash
gh api --method PUT \
  repos/Biskiq/spatial-sketch-editor/rulesets/22803329 \
  --input .github/rulesets/main-branch.pre-merge-queue.json
```

[main-branch.pre-merge-queue.json](../../.github/rulesets/main-branch.pre-merge-queue.json) is the
exact pre-activation snapshot: the current rules minus the merge-queue rule. A test asserts it equals
the desired ruleset with only that rule removed, so the rollback cannot drift from the activation
file. After removing the rule, revert the implementation commit normally; the prior `npm test`
suite contract is restored with it.

## Residual limits

- **One-time comparison gap.** The suite identity changes from `npm test` to the three lanes. The
  last pre-migration `main` report does not contain the new names, so the first post-merge report has
  no complete ancestor report and regression comparison is unavailable for that one merge. The
  second report restores it. Gate completeness is not affected.
- **Queue commit shape.** The guards resolver depends on GitHub's two-parent-per-entry queue shape.
  A different shape fails closed. This is intentional: the alternative, parsing the temporary branch
  name, trusts a value the queued change can influence.
- **PR association.** Each queued entry head must match an open PR through GitHub's commit
  association. An unmatched entry fails closed rather than silently dropping its authorization.
- **Per-entry labels.** Authorization does not cross entry boundaries. A change that genuinely needs
  the same owner approval in two queued PRs must carry the label on both.
- **Queue provider.** Merge queue is native GitHub; this repository adds no custom orchestrator and
  no third-party queue.
