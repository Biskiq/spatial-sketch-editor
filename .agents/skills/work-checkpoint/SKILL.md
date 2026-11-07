---
name: work-checkpoint
description: Checkpoint substantial interrupted work for same- or cross-agent resume. Use to create, resume, update, or complete a checkpoint without reconstructing prior investigation.
---

# Work Checkpoint

Transient recovery state for unfinished work.
Applies to: debugging, research, architecture investigation, implementation, planning.

## Create

- Only when substantial work is interrupted and expensive to reconstruct.
- One checkpoint per active interrupted task: `docs/operations/checkpoints/<task>.md`.
- Same task → update existing file in place. Never `*-2.md`, `*-final.md`.

## Procedure

```text
CREATE:
- no checkpoint for this task → write schema below

UPDATE:
- same task has checkpoint → overwrite stale frontier
- preserve still-valid ESTABLISHED / EVIDENCE / RULED OUT

POINT:
- the active draft pull request, task or handoff names the checkpoint explicitly
- NEXT = resume checkpoint

COMPLETE:
- promote durable findings
- delete checkpoint
- clear the explicit pointer in the active pull request/task/handoff
```

## Schema

```text
# <task> — checkpoint

TASK: <capability id / draft PR / task>
RESUME ROUTE: <active PR/task/handoff → exact plan, contract or artifact this continues>
TYPE:
STATUS: paused
GOAL:

CONSTRAINTS:
- original task/scope boundaries
- owner ruling / existing deferral if relevant

READ:
- exact files/docs already relevant

ESTABLISHED:
- confirmed facts only

EVIDENCE:
- path/symbol/test/commit anchors

RULED OUT:
- disproven hypotheses

DO NOT REPEAT:
- investigation already completed

CURRENT:
- present reasoning frontier / partial implementation state

VERIFICATION:
- what actually ran (focused | affected-subsystem | architecture-integration | exhaustive)
- tested revision (commit or tree) and the working-diff identity at that time
- the acceptance still owed, if any

NEXT:
1. exact next action
2. exact next action

OPEN:
- unresolved questions
```

Omit irrelevant fields.

## Rules

```text
ESTABLISHED ≠ hypothesis
RULED OUT = actually disproven
CURRENT = current frontier, not narrative history
NEXT = 1–3 exact continuation actions
NEXT may not silently broaden beyond GOAL / CONSTRAINTS
```

A focused green run is never inherited as acceptance: a checkpoint that recorded only a focused run
says so, and the required acceptance run stays owed. **Lifecycle belongs to the live work item**
(the draft pull request, issue or owner handoff) and **durable contracts own their facts** — a
checkpoint mirrors neither; it carries the task identity, resume route and verification record only.

No chain-of-thought prose. Conclusions, evidence, decisions, next actions only.

If investigation discovers a product/scope decision is required: record it as
OPEN/BLOCKER, do not invent the decision.

If a capability-linked issue or durable research already owns part of the diagnosis: reference it,
do not rediscover or copy it into the checkpoint. The checkpoint owns the
unfinished frontier; the durable owner owns established deferred diagnosis.

## Resume

- Read the active draft pull request/task/handoff → checkpoint.
- Inspect live Git state.
- START: checkpoint READ / EVIDENCE targets.
- EXPAND: bounded new files/symbols/tests allowed when NEXT or new evidence
  requires them. Do not restart broad investigation.
- Continue from NEXT.

## Complete

Promote before delete (only verified reusable knowledge — see the durable owner
routed from [`docs/README.md`](../../../docs/README.md); no doc change merely for
completeness):

```text
bug deferred → capability-linked GitHub issue
research completed → owning research/synthesis artifact
landed behavior → reference/*
durable decision → owning reference contract or one-page decision record
active plan-specific state → the owning active plan (only if that plan owns it)
```

Never promote to a slice README/index: a slice workspace does not need one, and
the exact plan stays its own artifact.

Do not archive raw checkpoints.
