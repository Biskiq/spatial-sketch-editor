---
name: phase-closeout
description: Close one roadmap phase deterministically. MANUAL-ONLY — use only when the owner explicitly requests phase closure (for example "close T1.P01", "close the spatial foundation phase", "run phase-closeout for T1.P01"). A passed final gate makes a phase closable, not closed.
---

# Phase Closeout

Close one phase: owner ratification → phase-local closed state → track phase row → product baton →
phase-wide closed work. A phase is `T1.P01` inside track `T1`; `R115` is a repository phase that
registers in the global roadmap instead of a track.

## Entry guard — owner-invoked only

```text
Phase closure is owner-invoked. Do NOT enter because:
- the declared final gate is accepted;
- the phase appears complete;
- the baton says "phase-close decision pending owner ratification";
- every child work item appears shipped.

Final-gate acceptance makes a phase CLOSABLE, not CLOSED.
No explicit owner request → STOP and report that closure is pending.
```

Sufficient intent: `close T1.P01` · `close out T1.P01` · `ship the T1 viewport phase` ·
`run phase-closeout for T1.P01` · `close T1.P01 after T1.P01.S03` · `close T1.P01.S03 and then close
T1.P01` (same-task authorization).

Not sufficient: `T1.P01.S03 passed` · `the final gate is accepted` · `the phase looks complete` ·
`current.md says phase-close decision pending`. A prior agent's recommendation is never authorization,
and entry is never inferred from the baton or the phase state. Asked only to close the final slice →
run `slice-closeout`: it closes the child, leaves the baton on the phase-close decision, and stops.

## Closable — check before step 1

Read the phase README and the artifact its FINAL PHASE GATE names:

```text
no FINAL PHASE GATE line → STOP and report; never infer finality from slice numbering or the title
it names a slice        → verify that slice's acceptance and the phase's integration at step 2
```

A phase with a non-empty slice register must declare exactly one FINAL PHASE GATE; the structure check
`apps/editor/tests/docs/parallel-track-gates.test.ts` fails a missing or mis-targeted one.

## Procedure

One ordered batch. A failed step stops the rest; a re-run resumes at the first unsatisfied step.
Steps are "ensure value", never "increment": re-running writes the same values.

### Step 1 — Declared finality

The phase README declares the final gate explicitly (pre-check above). Otherwise STOP and report.

### Step 2 — Final gate and integration verified → the phase is CLOSABLE

The declared final gate's **full integration acceptance** must be recorded: the phase's integrated
result, not a focused or per-slice run standing in for it. **Validate the recorded evidence; do not
re-execute it** — reuse the gate artifact's recorded commands, tested revision and results, and report
anything the phase still owes rather than re-running suites for their own sake. A missing, stale or
narrowed integrated result → STOP: the phase stays in-progress and closable is not written.

`closable` is phase-local: nothing above the phase has changed yet. `slice-closeout` normally already
recorded the child-side evidence; re-verify, never re-produce.

### Step 3 — Owner ratification → provenance

An explicit owner ruling is required; record one line in the phase-close record with its date and
anchor:

```text
Owner ratification: closed by owner ruling <date> (<PR/commit anchor>)
```

That line is part of the `PHASE CLOSE` block written at step 4. No form, no separate governance
artifact. No ratification → STOP: the phase stays in-progress, and no closure state is written
anywhere.

### Step 4 — Phase-local close state

Add or replace the `PHASE CLOSE` block in the phase README:

```text
PHASE CLOSE
Stage:        closed
Closed:       <date> — owner ratification recorded in <anchor>
Final gate:   <slice-id> → <gate artifact> — accepted <date>
Integration:  <the integrated acceptance this closure rests on>
Preservation: <stub/archive summary or pointer to the preservation report>
```

`Stage` is `active | closable | closed`; closure is carried by `Stage: closed` plus the `Closed` line.
The block is the close marker and proves owner authorization. Reconcile any `STATUS`/`NEXT` text the
phase README carries.

### Step 5 — Track phase row

Write the phase's row in its **track README**'s phase register: `Phase | Status | Depends on |
Workspace` → `shipped` (a repository phase writes its own row in the global roadmap's track register
instead). That register is the machine-readable closed state; do not copy it into the phase README.
A `TRACK COMPLETE` block is **not** written here — track completion is a separate, explicit owner
event (`operations/README.md`).

### Step 6 — Product baton

Rewrite the **owning track's** baton `docs/operations/<track>/current.md` as the reconciled
current-state snapshot: the phase that now holds the work, its active slice, and the next real step;
never edit another track's baton. **Never assume a next phase** — read the
track's phase register and the global roadmap, and if no phase is registered, say so and leave the
baton on the track's next planning decision. The baton stays product-only here. A phase close never
writes `docs/roadmap/now.md`. Only an owner release does, including pruning a row whose slice has
shipped.

### Step 7 — Closed work

Apply the rule owned by `slice-closeout/references/preservation.md` to the artifacts this phase close
changes or compacts: the same preservation default, the same evidence convention, the same P1/P2
anchor safety, tag-ancestry verification and preservation report. Read it there; never restate or
re-decide it here.

Phase close adds only the phase-wide scope: whole-phase integration, surviving cross-slice
contradictions, and the gate artifact. The final-gate slice is already fully closed, hygiene included —
this step finishes no unfinished slice. The one artifact `slice-closeout` held back is the **declared
gate artifact**: compact it here. Repair links for every path this step moves, run the documentation
cross-reference checker after any link edit, and confirm no live router treats compacted material as
authority.

### Idempotence

```text
- The phase README's PHASE CLOSE block is the close marker: it proves owner authorization and
  prevents a repeated closure decision — but it is NOT proof the batch finished.
- A re-run that finds the block NEVER re-asks for owner ratification: inspect steps 5–7, WRITE any
  missing consequence, and stop when all are satisfied. A close that stopped after step 4 is completed
  by the re-run, not merely reported on. Block missing (stopped at step 3) → resume at step 4.
- Step 7 is a no-op for an artifact already carrying "AUTHORITY: NONE", so a second run cannot
  double-compact or lose a body.
- A re-run that finds a moved or renamed phase re-resolves the phase README before writing anything.
```

Judge completion by the consequence surfaces, never by the marker alone. Record the drift report in
the closeout record:

```text
phase README: PHASE CLOSE closed ✓ | track phase row: shipped ✓ | baton: <next> ✓ | integration: recorded ✓
```

A failed step: later steps do not run; note where the close stopped and resume there next run.

## Boundaries

- **No cycle transition.** The architecture cycle is opened and closed by its own hooks
  (`operations/architecture-cycle.md`); phase close performs no cycle write and reads no cycle state.
- **No track or program procedure.** Track completion, product integration acceptance and bounded
  replanning are the event sections of `operations/README.md`.
- Follow `docs/README.md` routing; read the minimum necessary context; enter only on explicit owner
  phase-close intent; never rewrite product scope, architecture, roadmap order, design decisions or
  history beyond what the phase shipped. Do not commit unless asked.
