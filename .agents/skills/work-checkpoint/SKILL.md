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
- current.md RESUME → checkpoint path
- NEXT = resume checkpoint

COMPLETE:
- promote durable findings
- delete checkpoint
- remove RESUME pointer
- advance current.md if clean boundary reached
```

## Schema

```text
# <task> — checkpoint

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

No chain-of-thought prose. Conclusions, evidence, decisions, next actions only.

If investigation discovers a product/scope decision is required: record it as
OPEN/BLOCKER, do not invent the decision.

If durable tech-debt/research already owns part of the diagnosis: reference it,
do not rediscover or copy it into the checkpoint. The checkpoint owns the
unfinished frontier; the durable owner owns established deferred diagnosis.

## Resume

- Read current.md → checkpoint.
- Inspect live Git state.
- START: checkpoint READ / EVIDENCE targets.
- EXPAND: bounded new files/symbols/tests allowed when NEXT or new evidence
  requires them. Do not restart broad investigation.
- Continue from NEXT.

## Complete

Promote before delete:

```text
bug deferred → operations/tech-debt/
research completed → owning research/synthesis artifact
landed behavior → reference/*
verification/rulings → closeout/archive
implementation status → phase/slice README
```

Do not archive raw checkpoints.
