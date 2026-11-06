---
name: gardener
description: On-demand repository gardening. Moves dead or closed material to the archive, flags drift between docs and code, and opens one reviewable pull request. Never deletes outright and never runs on a schedule.
---

# Gardener

Invoked by the owner or an agent finishing a significant change — before onboarding, after a large
merge, or when context feels heavy. Not a required step in any plan.

## Boundaries

```text
ARCHIVE ONLY   move to docs/archive/; never delete outright
ONE PR         one reviewable pull request, no direct push to main
NO AUTHORITY   archived material is history, never current truth
NO SCHEDULE    a hook, bot or timer is not an owner invocation
```

## Procedure

1. **Find drift, not churn.** Read `npm run status`, then compare active docs against code and the
   owning contracts. Dead links, duplicate current-truth, retired routes still presented as active,
   and closed material still in the live tree are candidates. Do not invent work or rewrite
   contracts whose authority is unchanged.
2. **Check consumers before every move.** Search links, imports, scripts, tests, assets, workflow
   references and research citations. Repair inbound links and commands in the same diff.
3. **Preserve evidence.** Keep reproducible assets, accepted sheets, research findings, owner
   acceptance/waiver records and decision provenance. A closed phase's status never proves a
   capability works; do not archive evidence that a current contract or test relies on.
4. **Move with Git.** `git mv` into the existing `docs/archive/` family, keeping a self-contained
   package's assets together. Add a short entry to [`docs/archive/README.md`](../../../docs/archive/README.md)
   with the old → new mapping. Never create an archive-exclusion rule or a per-file approval record.
5. **Prove the result.** Run the documentation gate, the architecture lane and any focused checks
   for repaired consumers. Open one pull request describing the disposition table and the checks.

## Report

```text
MOVED     old path → archive path (why)
KEPT      path (why it is still live)
REPAIRED  consumer → new target
DRIFT     doc claim vs code/contract (opened flag or fixed)
CHECKS    commands and results
```
