# Operations — event procedures

**Role:** the four event procedures that outlive a single slice — **track completion**,
**product integration acceptance** (a gate), **product milestone acceptance** (a named product
milestone, never a gate) and **bounded replanning**. They are entered only by the explicit events
below.

```text
NOT:  product status (roadmap/README.md) · a baton (current.md or a track baton) · a plan or a tracker
OWNS: the completion handoff, integration acceptance, milestone acceptance and replanning procedures
LOAD: only when one of the four events is actually invoked
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
This procedure accepts a gate only. It does not accept a product milestone; that is the next
section's separate outcome.

## Product milestone acceptance

A product milestone (for example [Core Editor Stability](../roadmap/core-editor-stability.md)) is a
named, owner-approved state of the product's usefulness. It is **not** a gate. It has no version,
provider, `Requires` scope or register row, and accepting it changes no gate state or capability
readiness. It is evidenced as a whole product workflow, not as a sum of accepted providers.

```text
ENTRY:      an owner-approved milestone definition (docs/roadmap/<milestone-id>.md) plus an
            owner-authorized acceptance plan at docs/roadmap/integration/<milestone-id>/plan.md
VERIFY:     every criterion of the definition on one integrated tree at a recorded revision: the
            complete merge gate, the definition's browser journeys and observations, and
            independent review; contributing slices' accepted evidence is cited, and re-run only
            where the plan requires the integrated result
WRITE:      docs/roadmap/integration/<milestone-id>/acceptance.md (revision, evidence, review,
            owner acceptance, any explicit owner waiver per criterion) and the definition's status
            line; nothing in the gate register, and no checker change
NOT:        no gate, version or capability is created or accepted; no phase or track is closed;
            no Baseline is declared; work the milestone unblocks still needs its own owner
            authorization
```

A failed or unevidenced criterion stops acceptance. The owner may amend the definition explicitly
or waive a named criterion in the acceptance record; nothing is waived silently. One milestone has
one plan directory, and its id is stable.

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
