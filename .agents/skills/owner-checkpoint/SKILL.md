---
name: owner-checkpoint
description: On-demand owner checkpoint summary after a significant change. Reports functionality changes, status movements and regressions, Tier 1 merges, ranked open flags and next unclaimed work. No schedule and no stored checkpoint document.
---

# Owner Checkpoint

Invoked by the owner or an agent at a significant-change checkpoint. This is a report, not a plan
step, acceptance record or scheduled digest.

## Inputs

- `npm run status` — capability maturity/health, regressions, flags and claims.
- Merged Tier 1 work since the previous checkpoint.
- Open issues and draft pull requests, including flags and claims.

## Report

```text
CHANGED     significant functionality since the previous checkpoint
STATUS      movements and regressions (capability ids)
TIER 1      pull requests merged since the previous checkpoint
FLAGS       open flags ranked by how much work each blocks
NEXT        unclaimed capabilities, ranked
DECISIONS   Tier 2/owner decisions still needed (if any)
```

## Boundaries

```text
NO DOCUMENT   report in chat or the pull request; no acceptance or checkpoint file
NO SCHEDULE   no hook, bot or timer
NO CEREMONY   optional owner habit, not a required step in plans
```

Do not infer a status change from prose: report only what the computed report and merged checks
show. Keep transient recovery separate: `work-checkpoint` owns interrupted-work resumes.
