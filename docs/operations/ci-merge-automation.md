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

The [Merge gate](../../.github/workflows/merge-gate.yml) runs on every pull request and merge
group, without workflow-level path filters. It also runs Full every Sunday at 07:17 UTC and on
manual dispatch. There is no automatic push run on main.

| Profile | Jobs that start on a PR | Required evidence |
| --- | --- | --- |
| Minimal | Classify/static checks and merge gate | Git whitespace check and, for Markdown, the documentation reference walk and ledger anchors |
| Focused | The same two jobs plus editor focused verification | Editor typecheck and Vitest artifacts from the selected files |
| Full | The same two jobs plus the existing suite matrix, DB-backed API job, check guards and linux-x64 | Complete existing suite provenance and a successful native golden job |

The classifier compares the checked-out integration SHA against the exact base SHA in the event.
Git reports additions and deletions separately for renames so the old path is also classified.
The highest profile wins. A Git or event error blocks certification.

- **Minimal** covers Markdown under the documentation, research and audit roots, and the root
  README and CONTRIBUTING guides. It also covers regular CSS additions and edits within editor
  source/static, plus a conservative Svelte style-only proof. Source CSS with changed or multiline resource references, or with escapes, takes a higher profile. The Svelte proof requires one plain terminal style block on
  its own line, identical bytes before and after the block, and no markup or changed resource references
  in the style. Other Svelte edits follow the code rules.
- **Focused** is the default for editor source and static changes that remain after the Full
  rules. It runs the architecture files plus authoring and design tests and the changed source
  area's matching test directory. Camera, navigation, experience and routes add the experience
  and museum tests outside museum layout. Unknown editor areas and static assets use a broader
  set of editor cohorts. Tests that read source text, mount routes or load modules at runtime
  stay covered by area, even when they have no import edge to the changed file. Focused excludes
  the curated Heavy lane. Critical changes and scheduled or manual Full runs retain those tests.
- **Full** covers workspace packages, the API, tests and harnesses, workflow/configuration,
  repo routing and workflow policy, security, persisted contracts, public/visitor runtime and
  geometry/layout ownership. JSON and other structured runtime configuration are Full.
  Unknown paths outside editor source/static and approved documentation, nonregular files
  and executable mode changes are Full. See [the classifier](../../tools/harness/plan.mjs)
  for the exact paths.

The Full matrix runs all three disjoint editor lanes, editor check/build, API typecheck and the
grouped package typechecks. The separate API job requires a live Postgres contract run with zero
skips. The native Linux x64 job still runs the pinned corpus and determinism boundary.
Local commands, including the complete `npm test` command, keep their existing semantics.

The gate independently resolves the plan from the event and checks job outcomes and matching
suite artifacts. Focused evidence must include the exact selected test files in the Vitest
report. Omitted suites and goldens are recorded as `not applicable`. The required check contexts
remain `merge gate`, `check guards` and `linux-x64`. GitHub reports conditional jobs as skipped.
Every Full PR runs the guard scan. In a lower-profile PR, the verified delta contains no changes
to paths that can declare guarded tests.

## Tooling choice

Git already provides the exact, NUL-delimited file and mode delta and the two blobs needed
for the Svelte check. It works with read-only checkout access and adds no action to pin or trust.

- [dorny/paths-filter](https://github.com/dorny/paths-filter) is maintained and MIT-licensed.
  It handles push and merge-group comparisons with Git and uses the PR files API by default
  (requires `pull-requests: read`). Its filters operate on changed paths and statuses.
- [step-security/changed-files](https://github.com/step-security/changed-files) is a maintained,
  MIT-licensed action with PR, merge-group and push support. It can enumerate file and status
  changes from local Git or the PR API. Both actions still require blob comparison for the
  Svelte proof and custom mapping from results to the harness evidence contract.
- [Vitest](https://github.com/vitest-dev/vitest) is maintained, MIT-licensed and already pinned
  here. Its [CLI](https://vitest.dev/guide/cli) supports `related` and `--changed` for import-based
  selection. Biskiq also has filesystem and runtime contracts that the static import graph
  cannot see. Explicit area cohorts and architecture tests give deterministic selection with
  the existing Vitest runner and reporter, without a second dependency graph.

## Merge groups and main evidence

The batch profile uses `merge_group.base_sha` through `merge_group.head_sha`, including the
net effects of every entry. The guards run for every group even if its net delta is Minimal.
[event-context.mjs](../../tools/harness/event-context.mjs) walks the synthetic commit's first-parent
chain, verifies each queued PR association, and supplies each entry's own labels and delta.
Approval on one entry cannot authorize a removal in another, even if the batch later restores
the test. A missing association, wrong head, unexpected commit shape or wrong base fails closed.
Group runs keep isolated concurrency.

`npm run status` accepts complete, successful reports from scheduled and manual runs on main
and historical main pushes. It requires an exact head match for current evidence. Older full
reports are eligible only as ancestor comparisons. Current capability evidence may be unknown
between full runs. Run the Merge gate manually on main to refresh it when needed.

## Optional merge-queue activation

The queue rule is **not active** in the repository today. Do not add pull requests to a queue before
this command runs. Activate only with explicit owner authorization. Change-aware CI does not require this step.

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

Revert this implementation PR to restore the previous unconditional suites and push trigger.
Both versions support merge groups and publish the same required contexts.
