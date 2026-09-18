---
name: work-checkpoint
description: Checkpoint interrupted work for cross-agent resume. Use when substantial work is interrupted mid-task and another agent must continue the same unit without reconstructing the investigation.
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
```

No chain-of-thought prose. Conclusions, evidence, decisions, next actions only.

## Complete

Promote before delete:

```text
bug deferred → operations/tech-debt/
research completed → owning research/synthesis artifact
landed behavior → reference/*
verification/rulings → closeout/archive
implementation status → phase/slice README
```

Then delete checkpoint. Remove current.md RESUME. Do not archive raw checkpoints.
