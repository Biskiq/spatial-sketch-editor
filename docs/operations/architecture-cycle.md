# Architecture Cycle — live state

**Role:** live meta state for the architecture operating cycle. Answers: which cycle stage is
open, on which trigger, and what the next action is.

```text
NOT:  a plan · an activity diary · product status · product next-work
OWNS: meta stage only

PROVENANCE  strategic model      → ../roadmap/architecture-operating-cycle-plan.md
            live cycle state     → (this file)
            close / transition   → ../../.agents/skills/phase-closeout/SKILL.md (owner-invoked)
            historical planning evidence
                                 → ../roadmap/architecture-operating-cycle-workflow-harvest.md
BOUNDARY    product status stays in ../roadmap/README.md; the product baton stays in ./current.md.
            Nothing here restates either.
```

## State

```text
STAGE              WAITING
STATUS             installed; no diagnosis due
TRIGGER            prerequisite cycle infrastructure landed
PRODUCT CONTEXT    P23 (in progress) — the close that will open Phase 0
OWNER ACTION       not required
NEXT               none pending
EXIT CONDITION     the owning phase is owner-closed
VALIDATION WINDOW  empty
ACTIVE MECHANISMS  none
CALIBRATION        unchanged
EVIDENCE           empty
```

`OWNER ACTION` is what makes the `current.md` META pointer mechanical instead of judged (below);
`EVIDENCE` lets Phase 0 resume without reading the whole evidence set. No field without a job.

## Stages

| Stage | Meaning | Entry trigger | Required action | Exit condition | Next | META |
| --- | --- | --- | --- | --- | --- | --- |
| `WAITING` | Cycle installed; nothing due | prerequisite cycle infrastructure installed | none | the owning phase is owner-closed | `PHASE_0_DUE` | no |
| `PHASE_0_DUE` | A product phase closed; retrospective diagnosis is owed | phase close recorded (phase-closeout step 8) | owner authorizes Phase 0 to start | owner authorizes start | `PHASE_0_ACTIVE` | **yes** |
| `PHASE_0_ACTIVE` | Phase-0 evidence in progress: two fresh-context semantic architecture reviews + one bounded structural-workflow companion diagnostic | owner authorization | run both semantic reviews over the same range without reading each other's output before adjudication; run the structural-workflow diagnostic as separate evidence — it is not a third architecture reviewer | the Phase-0 evidence required for **both lanes** is available | `ADJUDICATION` | no |
| `ADJUDICATION` | Owner classifies and decides in two lanes inside one lifecycle | the Phase-0 evidence required for both lanes exists | architecture lane: classify each candidate A/B/C/D and answer "what catches it next time?"; structural-workflow lane: adjudicate the workflow evidence separately (no consequential gap / existing-tool or workflow correction / narrow custom-tool gap) | both lanes adjudicated and the single overall transition recorded | `PHASE_1` or `STEADY` | **yes** |
| `PHASE_1` | Smallest justified response is being installed | an outcome that justifies ≥1 mechanism | install only the justified mechanisms, then reconcile the prepared window implementation plan and **remain here** with `STATUS: ready for validation` | the first implementation slice of the window phase starts | `PHASE_2_VALIDATING` | no (unless action pending) |
| `PHASE_2_VALIDATING` | Prospective validation during normal product work | first implementation slice of the window phase starts | none — observe; answer calibration if scope materially changes | the window phase closes | `PHASE_3_EVALUATE` | no |
| `PHASE_3_EVALUATE` | Keep / simplify / delete | validation window closed | record a verdict per mechanism | verdicts recorded; survivors folded into normal practice | `STEADY` | **yes** |
| `STEADY` | No meta action; normal development; every phase close performs ordinary reconciliation/subtraction/closed-work hygiene and **stays** `STEADY` | verdicts recorded, or neither lane justified a mechanism | none | a **new demonstrated architectural failure**, or an explicit owner request for a fresh diagnosis | `PHASE_0_DUE` | no |

## Transitions

```text
prerequisite cycle infrastructure installed → WAITING
WAITING      + phase owner-closed      → PHASE_0_DUE
PHASE_0_DUE  + owner authorizes        → PHASE_0_ACTIVE
PHASE_0_ACTIVE + Phase-0 evidence for both lanes available → ADJUDICATION
ADJUDICATION + neither lane justifies a mechanism → STEADY   (no PHASE_1, no PHASE_2)
ADJUDICATION + either lane justifies ≥1 mechanism → PHASE_1
PHASE_1      + justified mechanisms + reconciled window plan
                                       → PHASE_1             (STATUS: ready for validation)
PHASE_1      + first implementation slice of the window phase starts
                                       → PHASE_2_VALIDATING  (window = that phase, e.g. P26)
PHASE_2_VALIDATING + window phase ends → PHASE_3_EVALUATE
PHASE_3_EVALUATE + verdicts            → STEADY
STEADY       + ordinary major phase close → STEADY   (reconcile · subtract · close work)
STEADY       + new demonstrated failure, or owner-requested fresh diagnosis → PHASE_0_DUE
```

**Phase 2 begins at implementation, not at installation.** Installing the mechanisms and
reconciling the prepared window plan leaves the cycle in `PHASE_1` with
`STATUS: ready for validation`; `PHASE_2_VALIDATING` opens on the **first implementation slice**
of the window phase, and no `VALIDATION WINDOW` is opened before it starts.

**Steady state does not re-run Phase 0.** A major phase close is *hygiene*, not *diagnosis*: it
performs the ordinary closeout work (reconciliation, subtraction of stale guidance, closed-work
compaction) and the cycle remains `STEADY`. Diagnosis restarts only on evidence — a new
demonstrated architectural failure — or because the owner explicitly asks for a fresh
retrospective.

**When neither lane justifies a mechanism, no window opens.** The cycle goes straight to `STEADY`
with `TRIGGER: none pending` and `ACTIVE MECHANISMS: none`; a validation window with an empty
mechanism list is a defect, not a valid value.

**Two lanes, one transition.** Architecture and structural-workflow evidence are adjudicated
separately but transition together: a consequential workflow correction alone, or an architecture
mechanism alone, is enough to reach `PHASE_1`. A mostly-C/D architecture result never vetoes the
structural-workflow lane, and a workflow finding never manufactures architecture machinery. The
architecture lane's A/B/C/D classification stays valid inside its lane.

**Early mechanism verdicts.** A mechanism that clearly succeeds or fails early may move
`PHASE_2_VALIDATING → PHASE_3_EVALUATE` before the window closes; record the reason here. The
window phase still closes normally.

## `current.md` META pointer

```text
META line present  ⇔  this file's OWNER ACTION: required
line shape:  META: Architecture cycle — <action> → ../operations/architecture-cycle.md
writer:      whoever applies a cycle transition that changes OWNER ACTION — the line is written
             or removed in that same transition. phase-closeout step 9 is the phase-close
             instance (WAITING → PHASE_0_DUE, PHASE_2_VALIDATING → PHASE_3_EVALUATE);
             a non-close transition counts the same way (e.g. PHASE_0_ACTIVE → ADJUDICATION sets
             OWNER ACTION: required with no close and no ruling), as does a stage change by
             owner ruling
removal:     the same rule in reverse — whenever OWNER ACTION returns to not required
             (Phase 0 authorized, adjudication resolved, verdicts recorded)
```

This file owns the condition; `docs/operations/current.md` only mirrors it.

## ROUTES — the three seams, nothing else

```text
1  docs/README.md "Where truth lives"          — the pull-based row (deliberate meta work)
2  phase README FINAL PHASE GATE line          — the close path discovers the cycle from the
                                                 phase it is closing
3  phase-closeout (preflight, 8–9)             — the owner-invoked procedure that performs the
                                                 phase close writes the stage and the META pointer
                                                 (slice-closeout only makes the final gate
                                                 CLOSABLE; it never touches the cycle)
```

The tracker's `META:` line (`../roadmap/README.md`) repeats the same pointer for P-level readers;
it is tracker metadata, not a fourth discovery route.

Deliberately **not** routed from `AGENTS.md`, the IMPLEMENT/DESIGN/RESEARCH blocks, any phase
child route, ordinary implementation startup context, or `work-checkpoint`.
