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
STAGE              ADJUDICATION
STATUS             Phase-0 evidence for both lanes is available and integrated into main; the
                   owner's classification, decision and single overall transition are outstanding
TRIGGER            the Phase-0 evidence required for both lanes became available 2026-09-22
                   (mechanical control pass merged in #76; review-a.md #77, review-b.md #78 and
                   structural-workflow.md #79 merged on explicit owner authorization)
PRODUCT CONTEXT    P23 (shipped) — the closed phase whose range Phase 0 reviews; next pipeline
                   phase is P23B (geometry performance, planning; umbrella landed, children
                   proposed); P26 follows, still planning
OWNER ACTION       required — owner classifies each architecture candidate A/B/C/D and adjudicates
                   the structural-workflow lane, then records the single overall transition
NEXT               owner adjudication in two lanes inside one lifecycle: architecture lane —
                   classify each candidate A/B/C/D and answer "what catches it next time?"; the
                   structural-workflow lane is adjudicated separately, on its own evidence. The
                   single overall transition is PHASE_1 (≥1 justified mechanism) or STEADY (none)
EXIT CONDITION     both lanes adjudicated and the single overall transition recorded
VALIDATION WINDOW  empty
ACTIVE MECHANISMS  none
CALIBRATION        unchanged
EVIDENCE           frozen range f8411f7..b5f75e7 (P23; 2026-09-08 → 2026-09-22); evidence
                   destinations under ../roadmap/architecture-operating-cycle/phase-0/ —
                   mechanical-control-pass.md COMPLETE (three structural sets: persisted
                   format/schema surface, canonical document-writer surface, visitor/editor
                   dependency boundary; no candidate classified); review-a.md · review-b.md ·
                   structural-workflow.md COMPLETE and on main — frozen, independent and read as
                   they stand; adjudication.md still owed
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
| `PHASE_1` | Smallest justified response is being installed | an outcome that justifies ≥1 mechanism | install only the justified mechanisms: write `ACTIVE MECHANISMS`, `VALIDATION WINDOW: <phase> — selected, not open` and `STATUS: mechanisms installed — window plan not yet reconciled`. Then reconcile the window phase's prepared implementation plan against them and write `STATUS: ready for validation` — two writes, not one | STATUS is `ready for validation` and the selected window's first implementation slice starts | `PHASE_2_VALIDATING` | no (unless action pending) |
| `PHASE_2_VALIDATING` | Prospective validation during normal product work | first implementation slice of the window phase starts | none — observe; answer calibration if scope materially changes | the window phase closes, or a reasoned early mechanism verdict is recorded | `PHASE_3_EVALUATE` | no |
| `PHASE_3_EVALUATE` | Keep / simplify / delete | the validation window closes, or a reasoned early mechanism verdict is recorded (the window stays open until its own phase closes) | record a verdict per mechanism | verdicts recorded **and** the window closed; survivors folded into normal practice | `STEADY` | **yes** |
| `STEADY` | No meta action; normal development; every phase close performs ordinary reconciliation/subtraction/closed-work hygiene and **stays** `STEADY` | verdicts recorded, or neither lane justified a mechanism | none | a **new demonstrated architectural failure**, or an explicit owner request for a fresh diagnosis | `PHASE_0_DUE` | no |

## Transitions

```text
prerequisite cycle infrastructure installed → WAITING
WAITING      + phase owner-closed      → PHASE_0_DUE
PHASE_0_DUE  + owner authorizes        → PHASE_0_ACTIVE
PHASE_0_ACTIVE + Phase-0 evidence for both lanes available → ADJUDICATION
ADJUDICATION + neither lane justifies a mechanism → STEADY   (no PHASE_1, no PHASE_2)
ADJUDICATION + either lane justifies ≥1 mechanism → PHASE_1
PHASE_1      + justified mechanisms installed
                                       → PHASE_1             (STATUS: mechanisms installed —
                                                              window plan not yet reconciled)
PHASE_1      + the window phase's prepared implementation plan reconciled
                                       → PHASE_1             (STATUS: ready for validation)
PHASE_1      + the selected window's first implementation slice starts, with
               STATUS: ready for validation
                                       → PHASE_2_VALIDATING  (window = that phase, e.g. P26, opens)
PHASE_1      + that phase's first implementation slice while STATUS is still
               installed-not-reconciled → no transition (STOP: readiness comes first)
PHASE_1 | PHASE_2_VALIDATING | PHASE_3_EVALUATE
             + a product phase other than the selected window closes
                                       → same stage         (the close is recorded; the stage and the
                                                              window are preserved)
PHASE_2_VALIDATING + window phase closes → PHASE_3_EVALUATE  (window recorded closed)
PHASE_3_EVALUATE + the selected window closes
                                       → PHASE_3_EVALUATE    (unchanged; the window is now closed and
                                                              the verdicts stay owed)
PHASE_3_EVALUATE + verdicts recorded AND the window closed → STEADY
STEADY       + ordinary major phase close → STEADY   (reconcile · subtract · close work)
STEADY       + new demonstrated failure, or owner-requested fresh diagnosis → PHASE_0_DUE
```

**Phase 2 begins at implementation, not at installation.** Installing the mechanisms and
reconciling the prepared window plan leaves the cycle in `PHASE_1` with
`STATUS: ready for validation`; `PHASE_2_VALIDATING` opens on the **first implementation slice**
of the window phase, and no `VALIDATION WINDOW` is opened before it starts.

**`VALIDATION WINDOW` values.** The field carries one phase and one state, and the two writes above
are why it has more than two:

```text
empty                        WAITING → ADJUDICATION, and again when neither lane justifies a mechanism
<phase> — selected, not open PHASE_1, from installation until the window's first implementation slice
<phase> — open (started <date>)
                             from that first slice through PHASE_2_VALIDATING, and it STAYS open if an
                             early mechanism verdict moved the cycle into PHASE_3_EVALUATE
<phase> — closed (<date>)    once the window phase itself closes, on either close path
```

An **open** window with an empty mechanism list stays a defect, and `PHASE_1` with an empty window is
a STOP for the close preflight. A phase other than the selected window closing never changes this
value.

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
