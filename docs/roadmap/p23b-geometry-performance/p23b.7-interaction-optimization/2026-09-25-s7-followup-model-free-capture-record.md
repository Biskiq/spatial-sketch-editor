# P23B.7 S7 follow-up — the model-free capture: the bounded fix S7's attribution named (CLOSED)

```text
AUTHORITY: NONE — closed-work stub. The contract is owned in code (`LayoutPreviewSnapshot` ·
`captureLayoutPreviewSnapshot` in `apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts`)
and pinned by its oracle + the permanent guard. Full body recoverable via the recovery line.
```

## Delivered

Owner-directed at review time (plan §0.9): the capture no longer clones the derived `model` at all —
`LayoutPreviewSnapshot` no longer declares it, and the restore already re-projected the model from
the shared geometry it carries by reference. The change is ONE revertible commit (`git revert <sha>`
returns the tree exactly to the S7 revision); no consumer needed a change (both history hosts compare
`project.layout`; the viewport only captures and restores).

## Evidence

```text
deterministic   snapshot members now: source · project · geometry · issues · bounds · messages
                cloned streams on the 40-Wall all-curved fixture: 22,022 B / 643 objects
                removed stream (live derived model): 3,412,257 B / 39,106 objects
advisory        REMOVED clone p50 114.23 ms through the editor-style proxy · SHIPPED capture
                p50 1.41 ms (same session, same construction; ms printed, never asserted)
gates           check:layout-core PASS · check (editor + museum) 0/0 · touched suites 51 tests ·
                full suite 347 files passed | 1 skipped, 4,912 tests passed | 1 skipped ·
                arch 254 · perf 62 passed | 1 skipped (ratchet reproduced) · root build PASS
```

NOT claimed: no browser re-run — the post-fix browser number is unmeasured and 107–149 ms stays the
pre-fix evidence; no budget, baseline or ratchet file was touched.

## Entry points

```text
fix + restore  apps/editor/src/lib/editor/layout/layout-preview-state.svelte.ts
oracle         apps/editor/tests/lib/editor/layout/layout-preview-state.test.ts
guard          apps/editor/tests/lib/editor/layout/p23b7-snapshot-payload-guard.test.ts
               (relative payload bound · source contract · self-tested no-reader scan)
probe          apps/editor/tests/lib/bench/p23b7-capture-attribution.test.ts
```

## Recovery

```text
git show 73a5167c:<this path>          # full body (the fix commit — its last full commit)
git show closed/p23b.7:<this path>     # as of the accepted head
DEGRADATION (squash): branch commits are not ancestors of `main` post-merge; recovery runs via
git fetch origin refs/pull/92/head && git show <A>:<path>. tag closed/p23b.7 is local only.
```
