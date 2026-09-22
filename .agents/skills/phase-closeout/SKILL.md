---
name: phase-closeout
description: Close one major P-phase deterministically. MANUAL-ONLY — use only when the owner explicitly requests major-phase closure (for example "close P23", "ship P23", "run phase-closeout for P23"). A passed final gate makes a phase closable, not closed.
---

# Phase Closeout

Close one major P-phase: owner ratification → phase-local closed state → P-level status → product baton
→ phase-wide closed work → Architecture Operating Cycle transition → META pointer.

## Entry guard — owner-invoked only

```text
Major-phase closure is owner-invoked only. Do NOT enter because:
- the declared final gate is accepted;
- the phase appears complete;
- the baton says "phase-close decision pending owner ratification";
- all child work appears shipped.

Final-gate acceptance makes a phase CLOSABLE, not CLOSED.
No explicit owner request → STOP and report that closure is pending.
```

Sufficient intent: `close P23` · `close out P23` · `ship P23` · `run phase-closeout for P23` ·
`close P23 after P23.16` · `close P23.16 and then close P23` (same-task authorization).

Not sufficient: `P23.16 passed` · `P23.16 is done` · `close P23.16` · `the final gate is accepted` ·
`the phase looks complete` · `current.md says phase-close decision pending`. A prior agent's
recommendation is never authorization, and entry is never inferred from the baton or the phase state.
Asked only to close the final slice → run `slice-closeout`: it closes the child, leaves the baton on
the phase-close decision, and stops.

## Closable — check before step 1

Read the phase README (`docs/roadmap/<phase>/README.md`) and its gate artifact:

```text
no FINAL PHASE GATE line → STOP and report; never infer finality from child numbering or the title
it names a child         → verify that child's acceptance at step 2
```

## Procedure

One ordered batch. A failed step stops the rest; a re-run resumes at the first unsatisfied step.

### Step 1 — Declared finality

The phase README declares the final gate explicitly (pre-check above). Otherwise STOP and report.

### Step 2 — Gate acceptance verified → the phase is CLOSABLE

Run the gate artifact's exit criteria; record the evidence there (existing plan-status convention).
"Closable" is phase-local: nothing P-level has changed yet. `slice-closeout` normally already recorded
this; re-verify, never re-run a gate for its own sake.

### Step 3 — Owner ratification → provenance

Explicit owner ruling required; record one line in the phase-close record with its date and anchor:

```text
Owner ratification: closed by owner ruling <date> (<PR/commit anchor>)
```

That record is the `PHASE CLOSE` block written at step 4 — its `CLOSED:` line carries the date and
anchor. No form, no separate governance artifact. No ratification → STOP: the phase stays
in-progress, the cycle is unchanged, no META appears.

### Preflight — stage compatibility (required; after step 3, before step 4)

Read the cycle `STAGE` in `docs/operations/architecture-cycle.md`; compute the legal transition before
any close write:

```text
WAITING                                                   → PHASE_0_DUE
PHASE_1 | PHASE_2_VALIDATING | PHASE_3_EVALUATE,
  closing phase ≠ selected validation window              → same stage (unchanged; record the close
                                                            only — stage and window preserved)
PHASE_2_VALIDATING, closing phase = selected window       → PHASE_3_EVALUATE (the window closes with it)
PHASE_3_EVALUATE, closing phase = selected window          → PHASE_3_EVALUATE (unchanged; the window is
                                                            now closed, verdicts stay owed)
PHASE_1, closing phase = selected window                  → no legal transition (the window never
                                                            opened)
PHASE_0_ACTIVE | ADJUDICATION, any close                  → no legal transition
STEADY, any close                                         → STEADY (unchanged; record the close only)
```

Window identity is the cycle file's `VALIDATION WINDOW` value, never the phase name: a close is a
window close only when the closing phase is the selected one. A product phase other than the window
closes during `PHASE_1`, `PHASE_2_VALIDATING` or `PHASE_3_EVALUATE` without advancing the cycle — the
installed stage and the window survive it.

Two inconsistent states STOP before computing, in every stage: `PHASE_1` with an empty
`VALIDATION WINDOW`, and an **open** window with `ACTIVE MECHANISMS: none` (already a defect in the
cycle file).

No legal transition → STOP before any phase-status change (steps 4–9 do not run). Legal → hold the
target `T`; step 8 writes it. On a re-run, read the persisted `CYCLE TARGET` instead of recomputing.

### Step 4 — Phase-local close state

Add or replace a `PHASE CLOSE` block in the phase README:

```text
STATUS: shipped           # mirror; docs/roadmap/README.md is the status authority
STAGE: closed
CLOSED: <date> — owner ratification recorded in <anchor>
FINAL GATE: <child> (<artifact>) — accepted <date>
CYCLE TARGET: <T>         # PHASE_0_DUE | PHASE_1 (unchanged) | PHASE_2_VALIDATING (unchanged) |
                          # PHASE_3_EVALUATE | PHASE_3_EVALUATE (unchanged; window closed) | STEADY,
                          # persisted from the preflight
CLOSED WORK: <stubs/archive summary or pointer>
```

`STATUS` mirrors the canonical enum (`proposed | planning | approved | in-progress | shipped |
archived`) — never invent one. Closure is carried by `STAGE: closed` plus the CLOSED/FINAL GATE lines.
`CYCLE TARGET` is the durable preflight record, so a recovery reads it rather than inferring it.
Reconcile `STAGE:`/`CURRENT:`/`NEXT:`.

### Step 5 — P-level status

`docs/roadmap/README.md` phase row → `shipped`. This is the machine-readable closed state.

### Step 6 — Product baton

`docs/operations/current.md` → `PHASE:` the next phase in the tracker pipeline, with `CHILD`/`STAGE`/
`NEXT` set to the next real work item. Read the pipeline; never assume the next phase. The baton stays
product-only here.

### Step 7 — Closed work

Apply the rule owned by `slice-closeout` ("Closed work (hybrid rule)") to the artifacts this phase
close changes or compacts: same preservation default, same evidence convention, same P1/P2 anchor
safety and tag-ancestry verification, phase-close tags `closed/<phase>` (`closed/p23`) with push state
reported, and the preservation report written into the final-gate artifact's stub (or the phase
README's `PHASE CLOSE` block when the gate artifact has no stub). Read it there; never restate or
re-decide it here.

Phase close adds only the phase-wide scope: whole-phase integration, surviving cross-slice
contradictions, and the gate artifact. The final-gate child is already fully closed, hygiene included —
this step finishes no unfinished child. The one artifact `slice-closeout` held back is the **declared
gate artifact**: compact it here. Repair links for every path this step moves, and confirm no live
router treats compacted material as authority (`slice-closeout` steps 10–11).

### Step 8 — Cycle stage

Write the preflight's target `T` to `docs/operations/architecture-cycle.md`; never recompute or invent
one. `PHASE_0_DUE` → also write `TRIGGER`, `PRODUCT CONTEXT`, `OWNER ACTION: required`.
`PHASE_3_EVALUATE` → `OWNER ACTION: required` (verdicts are an owner call). `STEADY` → record the close,
add nothing.

A **same-state** target writes no stage. It performs the "ensure value" pass — stage and
`ACTIVE MECHANISMS` stay as they are — and the close is recorded in the phase README alone. On **both**
window-close paths — the `PHASE_2_VALIDATING → PHASE_3_EVALUATE` transition and the same-state close
from an early `PHASE_3_EVALUATE` — also flip `VALIDATION WINDOW` to `closed (<date>)`. A close that is
not the selected window's changes no window value, in any stage. Continue to step 9 in every case.

### Step 9 — META pointer

Add the `META:` line to `docs/operations/current.md` only when step 8's state has
`OWNER ACTION: required`:

```text
META: Architecture cycle — <action> → ../operations/architecture-cycle.md
```

`STEADY` → no META line. Remove it when `OWNER ACTION` returns to `not required`.

The invariant is `OWNER ACTION` ⇔ pointer, so a same-state close that leaves `OWNER ACTION` unchanged
leaves the pointer as it is: a non-window close in an installed stage adds nothing, and a same-state
window close from an early `PHASE_3_EVALUATE` is already under `OWNER ACTION: required`, so its
verdict pointer stays rather than being re-added or removed.

### Idempotence

```text
- The phase README "PHASE CLOSE" block is the close marker: it proves owner authorization, prevents a
  repeated closure decision, and persists CYCLE TARGET — but it is NOT proof the batch finished.
- A re-run that finds the block NEVER re-asks for owner ratification: read the persisted CYCLE TARGET,
  inspect steps 5–9, WRITE any missing consequence, and stop when all are satisfied. A close that
  stopped after step 4 is completed by the re-run, not merely reported on. Block missing (stopped at
  step 3) → resume at step 4; the preflight re-runs safely because the cycle is still pre-close.
- Every step is "ensure value", never "increment": re-running writes the same values.
- Step 7 is a no-op for an artifact already carrying "AUTHORITY: NONE", so a second run cannot
  double-compact or lose a body.
```

Judge completion by the consequence surfaces (steps 5–8) plus the META line (step 9), never by the
marker alone. Record the drift report in the closeout record:

```text
phase README: closed ✓ | roadmap row: shipped ✓ | baton: <next phase> ✓ | cycle: <expected target> ✓ | META: <present|absent> ✓
```

A failed step: later steps do not run; note where the close stopped and resume there next run.

Rules: follow `docs/README.md` routing; read minimum necessary context; enter only on explicit owner
phase-close intent; never rewrite product scope, architecture, roadmap order, design decisions or
history beyond what the phase shipped. Do not commit unless asked.
