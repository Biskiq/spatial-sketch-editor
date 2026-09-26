# P23B.7 S7 — the `commit-capture` residual, targeted (CLOSED)

```text
AUTHORITY: NONE — closed-work stub. The mechanism is owned in code
(`captureLayoutPreviewSnapshot` in `apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts`)
and pinned by its probe; the review-time fix and the permanent guard are recorded in the sibling
S7 follow-up record. Full body recoverable via the recovery line.
```

## Delivered (finding)

`commit-capture` deep-cloned `project` + `model` + `issues` through `JSON.parse(JSON.stringify(...))`
with geometry by reference. On the 40-Wall fixture the derived `model` was 3,412,257 of 3,434,187
payload bytes (99.4 %) with NO production reader installing it: the restore re-projects the model
from the shared geometry and the transient guard reads only `project.layout`. The same clone costs
p50 ~20 ms on a plain state vs ~133 ms through the editor-style `$state` proxy (node, advisory) — the
multiplier behind the browser's 107–149 ms. No fix was taken here; the record named the bounded next
action (which landed as the review-time follow-up).

## Evidence / gates

§5.1 records the PR-gate re-run and the test-budget fix: with this probe in place the full suite
failed exactly one test — the probe's own advisory proxy loop — on vitest's default 5000 ms timeout;
the repetition count is now caller-bounded (1 + 3) and both advisory tests carry `{ timeout: 120000 }`.
No deterministic assertion, payload, fixture or mechanism changed. Gates at the PR gate: full suite
346 files passed | 1 skipped, 4,908 tests passed | 1 skipped · arch 23 files / 254 tests · perf 8
passed | 1 skipped, 62 passed | 1 skipped (ratchet reproduced) · both checks · root build PASS. No
browser capture was run (per plan §0.8.3).

## Entry points

```text
probe       apps/editor/tests/lib/bench/p23b7-capture-attribution.test.ts
mechanism   apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts
```

## Recovery

```text
git show 73a5167c:<this path>          # full body (last full commit; the S7 follow-up edited §2's pointer)
git show closed/p23b.7:<this path>     # as of the accepted head
DEGRADATION (squash): branch commits are not ancestors of `main` post-merge; recovery runs via
git fetch origin refs/pull/92/head && git show <A>:<path>. tag closed/p23b.7 is local only.
```
