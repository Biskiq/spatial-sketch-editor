---
name: slice-closeout
description: Close a shipped roadmap slice deterministically. Use when a roadmap slice has completed acceptance and is ready to close, or when explicitly asked to close/ship/archive that slice. If the slice is its phase's declared final gate, the phase-close procedure also runs.
---

# Slice Closeout

Deterministic slice lifecycle: plan → implementation → QA → reference update → handoff → closed
work. A declared final phase gate additionally runs the phase-close procedure.

## Guard — does this close also close the phase?

Read the phase README (`docs/roadmap/<phase>/README.md`) **before step 1** and compare this
child against its declared final gate:

```text
no FINAL PHASE GATE line, or it names another child
  → ordinary child close: run steps 1–11 exactly as today.
    No phase action, no P-level change, no cycle change, no META line.

FINAL PHASE GATE names this child
  → run steps 1–6, apply the final-gate step-7 override, then "Phase close (final gate only)".
```

Finality is never inferred from child numbering, from "this looks like the last child", or from
the gate artifact's title — the declared line is the only signal. A normal child close therefore
cannot accidentally close its parent, and no child close ever touches P-level status.

## Procedure

1. Verify implementation/acceptance: run the slice acceptance rows live plus
   `npm test`, `npm run check`, `npm run build` as the plan requires. Record gate numbers.
   Do not rerun already-valid expensive gates when unchanged evidence is
   trustworthy; rerun only when changes invalidate evidence, acceptance
   requires it, or uncertainty exists.
2. Inspect any active checkpoint for that slice: promote durable findings first
   (deferred bug → `operations/tech-debt/`; completed research → owning
   artifact; landed behavior → `reference/*`; verification/rulings →
   closeout/archive; status → phase README), then delete the checkpoint
   and remove any `current.md` RESUME pointer. Do not archive raw checkpoints.
3. Update affected durable reference contracts (`docs/reference/...`) only if the
   slice established or changed durable knowledge future work would otherwise
   rediscover; reconcile/supersede stale claims it invalidates.
   Roadmap proposals must never silently become reference truth; only landed behavior moves.
4. Write/update slice closeout evidence (acceptance record, rulings, residuals).
5. Mark the slice shipped in its phase README (`docs/roadmap/<phase>/README.md`) —
   the phase README owns child status/order and routes each child's exact plan/QA
   artifact directly. Do not create or maintain a slice README/index for status;
   the exact plan stays its own artifact.
   This step applies to an ordinary child; at a declared final gate the phase-close block below
   also runs.
6. Update `docs/roadmap/README.md` only if P-level execution/planning/order changed.
7. Update `docs/operations/current.md` to the next work item (baton, not history).
   **Final-gate override:** at a declared final gate whose phase is not yet owner-closed, the next
   work item *is* the phase-close decision — set that baton (see "Phase close" below) and STOP
   before steps 8–11. The baton advances to the next pipeline phase only at phase-close step 6.
8. Closed work uses the hybrid rule: leave a path-preserving stub at the artifact's
   original path (`STATUS: CLOSED`, `AUTHORITY: NONE`, outcome, residuals, current
   contracts, exact recovery) recording `git show <A>:<path>`, and add an archive copy
   under `docs/archive/roadmap/...` only for multi-file bundles and non-text evidence.
   Archive is opt-in evidence only, never authority. The phase-close procedure below owns the
   mechanics (anchor computation, two-commit protocol, verification).
9. Prune transient/stale artifacts (empty states, superseded husks, `__qa-*` plates).
10. Repair links: search the repo for every moved path; fix Markdown, HTML/image,
    and prototype relative paths; verify case-sensitive paths.
11. Verify no live router treats archived material as authority
    (`docs/README.md`, `docs/roadmap/README.md`, phase READMEs,
    `docs/operations/current.md`). Run any existing docs/link checks — there is no checked-in
    docs/link checker, so run the manual search explicitly: search every moved or stubbed path,
    including evidence assets, and verify case-sensitive paths.

## Phase close (final gate only)

Entered only from the guard above. These are the phase-close steps; they are distinct from the
slice steps 1–11, and step 7's override is the hand-off between them. The close is one ordered
batch: if a step fails, later steps are simply not performed, and a re-run resumes from the first
unsatisfied step.

**Step 7 override — the hand-off.** Before this procedure, set the baton to the phase-close
decision and stop the slice close:

```text
PHASE:    <this phase>
CHILD:    <final gate child> — accepted (<date>)
STAGE:    phase-close decision pending owner ratification
NEXT:     owner closes <phase>, or leaves it open
ROUTE:    the phase README FINAL PHASE GATE block + the gate artifact
BLOCKER:  owner ratification
```

### Step 1 — Declared finality

The phase README must declare the final gate explicitly. No final-gate line → STOP and report;
never infer finality from numbering.

### Step 2 — Gate acceptance verified → the phase is CLOSABLE

Run the gate artifact's exit criteria and record the acceptance evidence in that artifact
(existing plan-status convention). "Closable" is a phase-local fact: nothing P-level has changed
yet. If already recorded for this content, reuse the evidence — do not re-run a gate for its own
sake. If this close performs the closed-work step in the same PR, use the merge-style-independent
route (land the accepted body first, compact afterwards) and verify anchor reachability after
merge.

### Step 3 — Owner ratification → provenance

An explicit owner ruling is required. Record it as one line in the phase-close record with its
date and anchor:

```text
Owner ratification: closed by owner ruling <date> (<PR/commit anchor>)
```

The record is the `PHASE CLOSE` block written at step 4 — its `CLOSED:` line carries the
ratification date and anchor (the closeout evidence may quote the full line). No form, no
workflow, no separate governance artifact. If the owner has not ratified, STOP here: the phase
stays in-progress, the cycle stays `WAITING`, no META appears.

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

Apply the hybrid rule from step 8 above to this close's artifacts:

```text
ARCHIVE A COPY (copy the full body to docs/archive/roadmap/<phase>/<slice>/…, keep a stub)
  multi-file bundle/workspace (design/QA/research directories, assets), or non-text evidence

STUB + EXACT GIT RECOVERY (no archive copy)
  any single prose work artifact (plan, QA record, reconciliation, addendum)

LEAVE ALONE
  already-correctly-archived material · P1–P22 · the live phase README
```

Anchor `A` is the last commit that contained the artifact's full body; compute it **before**
writing the stub:

```bash
A=$(git log -1 --format=%H -- <path>)
```

The stub records `git show <A>:<path>`. Never use `--amend` — it rewrites `A` and invalidates the
written anchor. Commit the accepted body first and compact afterwards (merge-style independent);
if the recovery line was invalidated by a squash or force-push, annotate it to the reachable form
(`git fetch origin refs/pull/<n>/head && git show <A>:<path>`) and record the degradation. Verify
in the same session, after merge:

```bash
git merge-base --is-ancestor <A> main && echo "anchor reachable"
git show <A>:<path> | head -3
```

A stub must never be readable as live instructions: `AUTHORITY: NONE` and no content that
competes with `reference/*`.

Slice hygiene still applies to the gate slice: run slice steps 9–11 (prune transient artifacts,
repair links for every moved path, confirm no live router treats archived material as authority)
once, as part of this step.

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

Rules: follow `docs/README.md` routing; read minimum necessary context; do not
rewrite product scope, architecture, roadmap order, design decisions, or history
during closeout beyond what the slice shipped. Do not commit unless asked.
