# Architecture Cycle — live state and protocol

**Role:** the sole live cycle state and the operative protocol. Answers: which
cycle stage is open, which bounded window is configured, and what the next action
is.

```text
NOT:  a plan · an activity diary · product status · product next-work
OWNS: meta stage, the validation window and the mechanism register

PROVENANCE  strategic model / harvested workflow rules
                                 → ../archive/technical/architecture-cycle/operating-cycle-plan.md
                                   (archived 2026-09-27 evidence; recoverable with
                                    git show e90a58224443bdbf44114d7285d55c983b79cc84:<old-path>)
            close / transition   → ../../.agents/skills/phase-closeout/SKILL.md (owner-invoked)
BOUNDARY    product status stays in ../roadmap/README.md; the product baton stays in
            ./current.md. Nothing here restates either.
```

## State

| Stage | Readiness | Window | Exposure slices (≤3) | Opener (expected) | Terminal | Opened by | Exposure rows | Closed by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PHASE_1` | `awaiting-bounded-slice-window-plan` | T-track spatial foundation — **selected, not open** | — (none listed until the first relevant T1 phase plan configures them) | — | — | — | — | — |

- **`<phase> — selected, not open`** is the only window state before validation:
  the Phase 0 diagnosis selected a spatial-foundation window, and no capability
  slice has started because no capability plan is authorized.
- An **open** window with an empty exposure list is a defect, and `PHASE_1` with no
  configured window is a STOP for the close preflight.
- `STEADY` is reached only from `PHASE_3_EVALUATE` with a verdict row per mechanism.

**Stage vocabulary (preserved):** `WAITING` … `STEADY`. Closed Phase 0 reviews,
adjudication and the installed Phase 1 plan are archived at
[`../archive/technical/architecture-cycle/`](../archive/technical/architecture-cycle/);
the frozen reviews are not rewritten.

## Mechanism register

| Mechanism | State after #115 | Proof route |
| --- | --- | --- |
| **M1** Layout semantic mutation boundary | **dormant** — the editor mutation runner and its call-site test were removed with the editor shell; the core planner tests remain | re-armed by the first T1 slice that introduces Layout mutation wiring, which supplies the call-site proof |
| **M2** Wall/Floor vertical authority | core proofs remain (`layout-wall-height`, `layout-wall-birth-height`); the **editor half is dormant** | kernel suite + the T1 slice that re-wires vertical authoring |
| **M3** Persisted canonical curve model | **unchanged** — core proofs remain (`layout-curve-schema`, `layout-curve-read-path`, `layout-curve-planners`) | kernel suite |
| **M4** Junction commit-time identity | core proofs remain (`layout-junction-identity`, `layout-wall-chain`, `layout-room-reconciliation`); the **editor half is dormant** | kernel suite + the T1 slice that re-wires junction commits |
| **M5** Project replacement / Navigator guard | **dormant** — the hierarchy and replacement wiring were removed | re-armed by the first T1 or T3 slice that introduces project/session replacement |
| **M6** Lifecycle transition | satisfied by the state table, the three hooks and the gates test | `parallel-track-gates` structure check |
| **M7** Encountered routing | satisfied by the state table, the three hooks and the gates test | `parallel-track-gates` structure check |

The first configured T1 window should include at least one slice that re-arms a
dormant mechanism. Otherwise the owner's verdict for those mechanisms is **not
exposed** — honest, never PASS. Phase 3 outcomes are future evidence, not a #115
acceptance condition.

## Bounded window rules

- The first relevant T1 phase plan names **one to three** exposure-bearing slices
  that capability work already justifies, plus an **expected opener** and a
  **terminal**. The bound is 3; changing it requires an owner amendment.
- **Opening.** The window opens when **any** listed exposure slice starts
  authorized implementation — it does not wait for the nominal opener. The opening
  slice is the one that moves the cycle from `PHASE_1` to `PHASE_2_VALIDATING`.
- **Closing.** Closure requires the terminal accepted **and** every other listed
  exposure accepted or explicitly discharged. Closure moves the cycle to
  `PHASE_3_EVALUATE`, where the owner gives a per-mechanism
  keep / simplify / delete / not-exposed verdict. After that verdict the cycle
  reaches `STEADY`, which triggers no routine diagnosis.
- **Diagnosis** happens only on a demonstrated failure plus owner authorization. A
  pending verdict blocks nothing except its own handoff.

## Actions

**`configure-window`** — the first relevant T1 phase plan lists ≤3 exposure slices
with an expected opener and a terminal, sets readiness to `ready` when those slice
IDs exist in the phase README with a plan anchor, and records the window as
`selected, not open`.

**`open-window`** — when a listed slice starts authorized implementation, set
`Opened by` to that slice and move `PHASE_1 → PHASE_2_VALIDATING`. Any listed slice
may open the window; the opener need not be the nominal one.

**`record-exposure`** — when a listed slice is accepted or shipped, add its exposure
row. A listed slice reaching `accepted`/`shipped` with no exposure row is a defect.

**`close-window`** — when the terminal is accepted and every other listed exposure is
accepted or explicitly discharged, mark the window closed and move
`PHASE_2_VALIDATING → PHASE_3_EVALUATE`.

**`owner-verdict`** — the owner records keep / simplify / delete / not-exposed per
mechanism, then the cycle moves to `STEADY`. A missing verdict row for a mechanism
blocks `STEADY`. STEADY performs no routine diagnosis; ordinary phase close is
hygiene (reconcile · subtract · compact closed work) and stays `STEADY`.

**`diagnosis-request`** — a demonstrated architectural failure plus owner
authorization moves `STEADY → PHASE_0_DUE`. The cycle never re-enters diagnosis on
its own.

## Hooks — the only entry points

Unrelated work never loads this document. Three one-line hooks are the whole
integration surface:

1. **Phase planning.** The first relevant T1 phase plan follows `configure-window`.
2. **Implementation start** (the track runbook's start step): *"If your slice ID is
   listed under Exposure slices and `Opened by` is empty, follow `open-window`
   before capability work."*
3. **Slice closeout:** *"If your slice is listed under Exposure slices, follow
   `record-exposure`, then `close-window` if the closure predicate is now true."*

## Validation

The `parallel-track-gates` test that WP5 creates with the execution structure
that registers the tracks (not yet in the tree) uses the same Markdown table
helper as the gate register, with in-memory negative fixtures and positive
controls. It must fail on:

- more than three exposures;
- readiness `ready` without listed slice IDs that exist in a phase README, a
  terminal, and a plan anchor;
- **any listed exposure slice at `in-progress`, `accepted` or `shipped` while
  `Opened by` is empty or the stage is still `PHASE_1`** — a missed opening is
  caught in that slice's own change;
- an `accepted`/`shipped` listed slice with no exposure row;
- a satisfied closure predicate with a stale stage;
- premature closure while a listed exposure is pending;
- `STEADY` without a verdict row for every mechanism.

Positive controls: a **non-listed** slice starting causes no cycle requirement; a
**listed** slice other than the nominal opener may open the window; unrelated T3
data and T4 envelope slices remain eligible while the T1 window is open.

## `current.md` META pointer

```text
META line present  ⇔  this file requires an owner action
line shape:  META: Architecture cycle — <action> → ../operations/architecture-cycle.md
writer:      whoever applies a cycle transition that changes that (phase-closeout steps 8–9 own
             the phase-close instance); removal follows the same rule in reverse
```

This file owns the condition; [`current.md`](./current.md) only mirrors it.

## Routes

```text
1  docs/README.md "Where truth lives"   — the pull-based row (deliberate meta work)
2  every phase plan's FINAL PHASE GATE  — the close path discovers the cycle from the phase it closes
3  phase-closeout (preflight, steps 8–9) — the owner-invoked procedure that writes the stage and the
                                          META pointer (slice-closeout only makes the final gate
                                          CLOSABLE; it never touches the cycle)
```

Deliberately **not** routed from `AGENTS.md`, the router's IMPLEMENT/DESIGN/RESEARCH
blocks, any phase child route, ordinary implementation startup context, or
`work-checkpoint`.
