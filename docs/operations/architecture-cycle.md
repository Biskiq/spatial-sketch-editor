# Architecture Cycle — live state and protocol

**Role:** the sole live cycle state and the operative protocol. Answers: which cycle stage is open,
which bounded exposure window is configured, and what the next action is.

```text
NOT:  a plan · an activity diary · product status · product next-work · a standing audit
OWNS: meta stage, the bounded exposure window and the mechanism register
LOAD: only by its three hooks below — unrelated work never opens this file

PROVENANCE  strategic model / harvested workflow rules
                                 → ../archive/technical/architecture-cycle/operating-cycle-plan.md
                                   (archived 2026-09-27 evidence; recoverable with
                                    git show e90a58224443bdbf44114d7285d55c983b79cc84:<old-path>)
            closed Phase 0 investigation, frozen reviews, adjudication and the installed Phase 1
            plan → ../archive/technical/architecture-cycle/
BOUNDARY    product status stays in ../roadmap/README.md; the product baton stays in
            ./current.md. Nothing here restates either.
```

**Preserved by the PR #115 migration:** the completed Phase 0 investigation, its frozen reviews and
adjudication, the installed Phase 1 plan and the original method (archived above); the stage
vocabulary `WAITING` … `STEADY`; and the current stage `PHASE_1` with readiness
`awaiting-bounded-slice-window-plan` and a **selected, unopened** T-track spatial-foundation window.
The JSON state fence, the transition evaluator and the CLI action codes are gone: the tables below,
five short action headings and three one-line hooks replace them.

## State

| Stage | Readiness | Window | Exposure slices (≤3) | Opener (expected) | Terminal | Opened by | Exposure rows | Closed by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PHASE_1` | `awaiting-bounded-slice-window-plan` | T-track spatial foundation — **selected, not open** | — | — | — | — | — | — |

- **`<phase> — selected, not open`** is the only window state before validation: the Phase 0
  diagnosis selected a spatial-foundation window, and no capability slice has started because no
  capability plan is authorized.
- **Readiness** is `awaiting-bounded-slice-window-plan` before the window is configured, `ready`
  once it is configured with a live slice list and a terminal, `open` in
  `PHASE_2_VALIDATING`, `owner-verdict-owed` in `PHASE_3_EVALUATE`, `steady` in `STEADY` and
  `diagnosis-due` in `PHASE_0_DUE`. The owner-action state lives here and nowhere else.
- An **open** window with an empty exposure list is a defect, and `PHASE_1` with no configured
  window is a STOP for the close preflight.
- `STEADY` is reached only from `PHASE_3_EVALUATE` with a verdict row per mechanism.

## Mechanism register

| Mechanism | Status | Proof route | Verdict |
| --- | --- | --- | --- |
| **M1** Layout semantic mutation boundary | `dormant` | the editor mutation runner and its call-site test were removed with the editor shell; core planner tests remain. Re-armed by the first T1 slice that introduces Layout mutation wiring, which supplies the call-site proof | — |
| **M2** Wall/Floor vertical authority | `dormant` (editor half) | core proofs remain (`layout-wall-height`, `layout-wall-birth-height`); re-armed by the T1 slice that re-wires vertical authoring | — |
| **M3** Persisted canonical curve model | `installed` | kernel suite (`layout-curve-schema`, `layout-curve-read-path`, `layout-curve-planners`) | — |
| **M4** Junction commit-time identity | `dormant` (editor half) | core proofs remain (`layout-junction-identity`, `layout-wall-chain`, `layout-room-reconciliation`); re-armed by the T1 slice that re-wires junction commits | — |
| **M5** Project replacement / Navigator guard | `dormant` | the hierarchy and replacement wiring were removed; re-armed by the first T1 or T3 slice that introduces project/session replacement | — |
| **M6** Lifecycle transition | `installed` | the state table, the three hooks and the gates test | — |
| **M7** Encountered routing | `installed` | the state table, the three hooks and the gates test | — |

**Status is the first word of the cell: `installed` or `dormant`.** `Verdict` stays `—` until the
owner records keep / simplify / delete / not-exposed. The first configured T1 window should include
at least one slice that re-arms a dormant mechanism; otherwise the owner's verdict for those
mechanisms is **not exposed** — honest, never PASS. Phase 3 outcomes are future evidence, not a
PR #115 acceptance condition.

## Bounded window rules

- The first relevant T1 phase plan names **one to three** exposure-bearing slices that capability
  work already justifies, plus an **expected opener** and a **terminal**. The bound is 3; changing
  it requires an owner amendment.
- **Opening.** The window opens when **any** listed exposure slice starts authorized implementation
  — it does not wait for the nominal opener. The opening slice is the one that moves the cycle from
  `PHASE_1` to `PHASE_2_VALIDATING`.
- **Closing.** Closure requires the terminal accepted **and** every other listed exposure accepted
  or explicitly discharged. Closure moves the cycle to `PHASE_3_EVALUATE`, where the owner gives a
  per-mechanism keep / simplify / delete / not-exposed verdict. After that verdict the cycle reaches
  `STEADY`, which triggers no routine diagnosis.
- **Diagnosis** happens only on a demonstrated failure plus owner authorization. A pending verdict
  blocks nothing except its own handoff.

## Actions

**`configure-window`** — the first relevant T1 phase plan lists ≤3 exposure slices with an expected
opener and a terminal, sets readiness to `ready` when those slice IDs exist in the phase README with
a plan anchor, and records the window as `selected, not open`.

**`open-window`** — when a listed slice starts authorized implementation, set `Opened by` to that
slice, set readiness to `open` and move `PHASE_1 → PHASE_2_VALIDATING`. Any listed slice may open
the window; the opener need not be the nominal one.

**`record-exposure`** — when a listed slice is accepted or shipped, add its exposure row. A listed
slice reaching `accepted`/`shipped` with no exposure row is a defect.

**`close-window`** — when the terminal is accepted and every other listed exposure is accepted or
explicitly discharged, mark the window closed, set readiness to `owner-verdict-owed` and move
`PHASE_2_VALIDATING → PHASE_3_EVALUATE`.

**`owner-verdict`** — the owner records keep / simplify / delete / not-exposed per mechanism, then
the cycle moves to `STEADY` with readiness `steady`. A missing verdict row for a mechanism blocks
`STEADY`. `STEADY` performs no routine diagnosis; ordinary phase close is hygiene (reconcile ·
subtract · compact closed work) and stays `STEADY`.

**`diagnosis-request`** — a demonstrated architectural failure plus owner authorization moves
`STEADY → PHASE_0_DUE` with readiness `diagnosis-due`. The cycle never re-enters diagnosis on its own.

## Hooks — the only entry points

Unrelated work never loads this document. Three one-line hooks are the whole integration surface:

1. **Phase planning.** The first relevant T1 phase plan follows `configure-window`.
2. **Implementation start** (the track runbook's start step): *"If your slice ID is listed under
   Exposure slices and `Opened by` is empty, follow `open-window` before capability work."*
3. **Slice closeout:** *"If your slice is listed under Exposure slices, follow `record-exposure`,
   then `close-window` if the closure predicate is now true."*

## Validation

`apps/editor/tests/docs/parallel-track-gates.test.ts` reads this file with the same Markdown table
helper as the gate register, and fails on:

- more than three exposures;
- readiness `ready` without listed slice IDs that exist in a phase README, a terminal and a plan
  anchor;
- **any listed exposure slice at `in-progress`, `accepted` or `shipped` while `Opened by` is empty
  or the stage is still `PHASE_1`** — a missed opening is caught in that slice's own change;
- an `accepted`/`shipped` listed slice with no exposure row;
- a satisfied closure predicate with a stale stage;
- premature closure while a listed exposure is pending;
- `STEADY` without a verdict row for every mechanism.

Positive controls: a **non-listed** slice starting causes no cycle requirement; a **listed** slice
other than the nominal opener may open the window; unrelated T3 data and T4 envelope slices remain
eligible while the T1 window is open.

## Routes

```text
1  docs/README.md "Architecture cycle (meta)" row — deliberate meta work only
2  the track runbook's start step — the implementation-start hook (`open-window`)
3  slice-closeout — the closeout hook (`record-exposure`, then `close-window` when the predicate holds)
4  the first relevant T1 phase plan — `configure-window`
```

Deliberately **not** routed from `AGENTS.md`, the router's IMPLEMENT/DESIGN/RESEARCH blocks, any
phase child route, ordinary implementation startup, `work-checkpoint` or `phase-closeout`: an
ordinary slice loads no cycle document, and phase close performs no cycle transition.
