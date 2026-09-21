---
name: phase-closeout
description: Close one major P-phase deterministically. MANUAL-ONLY — use only when the owner explicitly requests major-phase closure (for example "close P23", "ship P23", "run phase-closeout for P23"). A passed final gate makes a phase closable, not closed.
---

# Phase Closeout

Closes one major P-phase: owner ratification → phase-local closed state → P-level status → product
baton → phase-wide closed work → Architecture Operating Cycle transition → META pointer.

**Manual-only.** This skill is entered solely on an explicit owner request to close the phase. A
declared final gate that has passed has made the phase *closable*; it has not authorized its
closure.

## Entry guard — owner-invoked only

```text
Major-phase closure is owner-invoked only.

Do not enter this procedure merely because:
- the declared final gate is accepted;
- the phase appears complete;
- the baton says "phase-close decision pending owner ratification";
- all child work appears shipped.

Final-gate acceptance makes a phase CLOSABLE, not CLOSED.

Without an explicit owner request to close the phase:
STOP and report that phase closure remains pending.
```

Sufficient owner intent — for example:

```text
close P23
close out P23
ship P23
run phase-closeout for P23
close P23 after P23.16
close P23.16 and then close P23       (same-task authorization; see below)
```

Not sufficient:

```text
P23.16 passed
P23.16 is done
close P23.16
the final gate is accepted
the phase looks complete
current.md says phase-close decision pending
```

A previous agent's recommendation is **not** owner authorization. If the owner asked only to close
the final slice, the correct action is `slice-closeout`: it closes the child, leaves the baton on
the phase-close decision, and stops.

**Same-task authorization.** When the owner explicitly requested both closing the final slice *and*
closing the phase in one task, that authorization already exists — `slice-closeout` completes the
child and hands off here. Entry is never inferred from the baton, the phase state, or a prior
agent's recommendation; only from explicit owner phase-close intent.

## Before step 1 — the phase must be closable

Read the phase README (`docs/roadmap/<phase>/README.md`) and its declared gate artifact:

```text
no FINAL PHASE GATE line
  → STOP and report. Finality is never inferred from child numbering, from
    "this looks like the last child", or from the gate artifact's title.

FINAL PHASE GATE names a child
  → verify that child's acceptance at step 2.
```

## Procedure

One ordered batch: if a step fails, later steps are simply not performed, and a re-run resumes from
the first unsatisfied step.

### Step 1 — Declared finality

The phase README must declare the final gate explicitly. No final-gate line → STOP and report;
never infer finality from numbering.

### Step 2 — Gate acceptance verified → the phase is CLOSABLE

Run the gate artifact's exit criteria and record the acceptance evidence in that artifact
(existing plan-status convention). "Closable" is a phase-local fact: nothing P-level has changed
yet. If already recorded for this content, reuse the evidence — do not re-run a gate for its own
sake. If the accepted full body and its compaction would land in the same PR, that is
the P1 optimisation and is allowed only when that PR is explicitly guaranteed to land
with a merge commit (not squash/rebase). Otherwise use canonical P2: land the accepted
full body on main first, verify its anchor is reachable, then compact it in a later
commit/PR.

`slice-closeout` normally already recorded this when it closed the final-gate child and left the
baton on the phase-close decision; re-verify, do not re-run for its own sake.

### Step 3 — Owner ratification → provenance

An explicit owner ruling is required. Record it as one line in the phase-close record with its
date and anchor:

```text
Owner ratification: closed by owner ruling <date> (<PR/commit anchor>)
```

The record is the `PHASE CLOSE` block written at step 4 — its `CLOSED:` line carries the
ratification date and anchor (the closeout evidence may quote the full line). No form, no
workflow, no separate governance artifact. If the owner has not ratified, STOP here: the phase
stays in-progress, the cycle is unchanged, no META appears.

### Preflight — stage compatibility (required; after step 3, before step 4)

Read the cycle `STAGE` in `docs/operations/architecture-cycle.md` and compute the legal
post-close transition. The transition is validated **before any close write**, so an impossible
one is caught while the phase is still open:

```text
WAITING            → PHASE_0_DUE
PHASE_2_VALIDATING → PHASE_3_EVALUATE
STEADY             → STEADY (unchanged; record the close only)
any other stage    → no legal transition
```

No legal transition → STOP before changing any phase status (steps 4–9 do not run). Legal →
remember the expected target `T`, then perform steps 4–7; step 8 writes `T`.
On a re-run (the phase README already carries the `PHASE CLOSE` block), read the persisted
`CYCLE TARGET` instead of recomputing — after step 8 the cycle `STAGE` *is* the target.

### Step 4 — Phase-local close state

Add/replace a `PHASE CLOSE` block in the phase README:

```text
STATUS: shipped           # mirror; docs/roadmap/README.md is the status authority
STAGE: closed
CLOSED: <date> — owner ratification recorded in <anchor>
FINAL GATE: <child> (<artifact>) — accepted <date>
CYCLE TARGET: <T>         # PHASE_0_DUE | PHASE_3_EVALUATE | STEADY, persisted from the preflight
CLOSED WORK: <stubs/archive summary or pointer>
```

`STATUS` mirrors the canonical enum (`proposed | planning | approved | in-progress | shipped |
archived`, `docs/roadmap/README.md`) — never invent a status outside it. The tracker row stays
authoritative, and closure is carried by `STAGE: closed` plus the CLOSED/FINAL GATE lines.
`CYCLE TARGET` is the durable record of the preflight's validated transition, so recovery reads
it instead of inferring it. Reconcile the phase's `STAGE:`/`CURRENT:`/`NEXT:` lines to the closed
state.

### Step 5 — P-level status

`docs/roadmap/README.md` row for the phase → `shipped`. This is the machine-readable "phase is
closed" state everything else keys off.

### Step 6 — Product baton

`docs/operations/current.md` → `PHASE:` the next phase in the tracker pipeline, with
`CHILD`/`STAGE`/`NEXT` set to the next real work item. Read the pipeline; never assume the next
phase. The baton stays product-only here.

### Step 7 — Closed work

Apply the hybrid closed-work rule defined in the `slice-closeout` skill ("Closed work (hybrid
rule)") to the artifacts **this phase close itself changes or compacts** — same anchor safety,
same P1/P2 rule, same recovery verification:

```text
ARCHIVE A COPY (copy the full body to docs/archive/roadmap/<phase>/<slice>/…, keep a stub)
  multi-file bundle/workspace (design/QA/research directories, assets), or non-text evidence

STUB + EXACT GIT RECOVERY (no archive copy)
  any single prose work artifact (plan, QA record, reconciliation, addendum)

LEAVE ALONE
  already-correctly-archived material · P1–P22 · the live phase README
```

The final-gate child was already fully closed by `slice-closeout`, including its own steps 8–11
hygiene — this step does not finish an unfinished child. The one artifact deliberately held back
by `slice-closeout` is the **declared gate artifact**, kept live while it served as phase-close
evidence (step 2 reads it); compact it here, now that the phase is actually closed. Repair links
for every path this step moves, and confirm no live router treats compacted material as
authority (`slice-closeout` steps 10–11 applied to this step's moves).

### Step 8 — Cycle stage

Write the target `T` validated by the preflight to `docs/operations/architecture-cycle.md`; never
recompute it here and never invent one. `PHASE_0_DUE` is written with `TRIGGER`, `PRODUCT CONTEXT`
and `OWNER ACTION: required`; `PHASE_3_EVALUATE` with `OWNER ACTION: required` (verdicts are an
owner call); a `STEADY` target records the close and adds nothing.

### Step 9 — META pointer

Add the `META:` line to `docs/operations/current.md` only when the state written at step 8 has
`OWNER ACTION: required`:

```text
META: Architecture cycle — <action> → ../operations/architecture-cycle.md
```

A `STEADY` outcome therefore produces no META line. Remove the line when `OWNER ACTION` returns
to `not required`.

### Idempotence

No locking, no database. Four cheap conventions:

```text
- The phase README "PHASE CLOSE" block is the close marker. It proves owner authorization,
  prevents the closure decision from being repeated, and persists CYCLE TARGET. It does NOT mean
  the batch finished.
- A re-run that finds the `PHASE CLOSE` block never re-asks for owner ratification (step 3):
  it reads the persisted `CYCLE TARGET`, inspects steps 5–9, WRITES any missing consequence, and
  stops when all are satisfied. A close that stopped after step 4 is completed by the re-run, not
  merely reported on. If the block itself is missing (the close stopped at step 3), resume at
  step 4 — the preflight re-runs safely, because the cycle is still pre-close.
- Every step is "ensure value", never "increment". Re-running writes the same values.
- Step 7 is a no-op for any artifact already carrying "AUTHORITY: NONE", so a second run cannot
  double-compact or lose a body.
```

Completion is judged by the consequence surfaces (steps 5–8) plus the META line (step 9), never
by the marker alone. Record the drift report in the closeout record:

```text
phase README: closed ✓ | roadmap row: shipped ✓ | baton: <next phase> ✓ | cycle: <expected target> ✓ | META: <present|absent> ✓
```

If a step fails: later steps are not performed, note where the close stopped, and resume at the
first unsatisfied step next run.

Rules: follow `docs/README.md` routing; read minimum necessary context; enter only on explicit
owner phase-close intent; do not rewrite product scope, architecture, roadmap order, design
decisions, or history during closeout beyond what the phase shipped. Do not commit unless asked.
