---
name: breaker
description: On-demand exploratory testing of working and polished capabilities. Every defect found lands as a failing tagged test or a bug issue; no new UX, no schedule.
---

# Breaker

Invoked by the owner or an agent after a significant change, or when a capability claims more than
its checks prove. Not a required plan step and not a scheduled agent.

## Boundaries

```text
TARGET      capabilities reported working or polished (the hardest claims first)
EVIDENCE    a failing tagged test or a bug issue per defect
NO NEW UX   never invent a feature, control or interaction to "fix" an observation
NO GUESSING record uncertainty as ambiguous/needs-decision instead of deciding it
```

## Procedure

1. **Pick the claim.** Read `npm run status` and the capability entry in `capabilities.json`. Note
   its `surface` and the checks that make it `working`/`polished`.
2. **Exercise the creator journey, not the test's happy path.** Use the real route or harness at a
   realistic viewport; try the second occurrence, repeated visits, cancel/undo/redo, stale data,
   narrow/coarse targets and reload. Use `browser-hygiene` when driving a browser.
3. **Classify what you see.**
   - Automatable defect → add an expected-failure reproducer tagged
     `[cap:<id> core known-failing:#<issue>]` linked to a `bug` issue.
   - Cannot automate yet → open a `bug` issue with exact steps, observed result and evidence.
   - Undecided product choice or missing design → open `needs-decision`, `needs-ux`, `ambiguous` or
     `needs-research`; do not build a speculative control.
4. **Prove the marker path.** The expected failure must be the defect, not a broken fixture; keep
   the suite otherwise green. Removing the defect makes the test pass, and the fixing PR removes
   the stale marker.
5. **Report** the capability, journey, defect class, issue/test link, and what was not exercised.

## Report

```text
CAPABILITY  id · maturity/health before
JOURNEY     steps, viewport, data
DEFECT      observed vs expected
EVIDENCE    failing test path or issue number
LEFT OPEN   uncertainty/flags
```
