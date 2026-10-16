# Operations — event procedures

**Role:** the three event procedures that outlive a single slice — **track completion**,
**product integration acceptance** and **bounded replanning**. They are entered only by the
explicit events below.

```text
NOT:  product status (roadmap/README.md) · a baton (current.md or a track baton) · a plan or a tracker
OWNS: the completion handoff, integration acceptance and replanning procedures
LOAD: only when one of the three events is actually invoked
```

Ordinary slice work never loads this file. A slice's own route is
[`current.md`](./current.md) (navigation) → the owning track's baton → its phase README → its plan,
with the track runbook's start step
and the [gate register](../roadmap/README.md#gate-register) for eligibility.

## Track completion

```text
ENTRY:      explicit owner request, against the track's approved bounded objectives
VERIFY:     each objective's completion evidence, every required phase closure (PHASE CLOSE
            blocks and the track's phase rows), and the transfer of every residual to a named
            owner (a track phase, a debt row, or an explicit owner discharge)
WRITE:      TRACK COMPLETE (owner · date · evidence) on the track's row in the global
            roadmap's track register — the row also moves to `shipped`
KEEP:       domain code, contracts, gates and their regressions; a completed track closes no
            product capability and deletes no authority
NOT:        no product integration acceptance, no Baseline, no other track's closure
```

An objective that cannot be evidenced, or a residual without an owner, stops the completion —
the track stays `in-progress` until it is resolved or explicitly re-scoped by the owner.

## Product integration acceptance

```text
ENTRY:      an approved integration plan plus its recorded acceptance
VERIFY:     the plan's declared gate, on the integrated tree, against the recorded evidence —
            never a focused run standing in for the integrated result
WRITE:      acceptance of that gate and version only (the gate register row and its acceptance
            record), plus the integration plan's own record
NOT:        contributing phases and tracks are not closed, no Baseline is declared, and no
            capability outside the accepted gate is authorized
```

An integration plan exists only when one is needed: if a phase's integrated gate already supplies
the proof, that gate is routed instead of a second plan being written. A concrete, owner-authorized
product goal writes **one** plan under `docs/roadmap/integration/<gate-id>/`; ids are stable.

## Bounded replanning

Replanning happens only on one of these events:

- a new product goal the owner authorizes;
- an approved completion handoff (a track or phase whose objectives changed because the
  destination moved);
- an orphaned obligation — a deferred row, successor obligation or residual with no live owner.

```text
ENTRY:      explicit owner authorization
WRITE:      changed objectives, a new track or phase, or a transferred obligation — recorded in
            the owning roadmap README / phase README / track register
KEEP:       accepted gate identities stay stable; an incompatible interface change is a new
            gate version, never an edit to an accepted row
NOT:        no silent re-scope of an in-progress phase, no new status store, no parallel plan
```

Replanning is not the route for a defect fixed in place (that is the owning plan) or for a
recorded debt (that is [`tech-debt/README.md`](./tech-debt/README.md)).

## Related routes

```text
TRACK STATUS:      ../roadmap/README.md          (track + phase lifecycle, gate register)
TRACK OBJECTIVES:  ../roadmap/<track>/README.md
OP PROCEDURE:      ./<track>/README.md           (runbooks: eligibility, start step, routes)
CURRENT WORK:      ./current.md                (navigation → the owning track's baton)
CYCLE STATE:       ./architecture-cycle.md       (its own three hooks only)
INTERRUPTION:      ./checkpoints/README.md
```
