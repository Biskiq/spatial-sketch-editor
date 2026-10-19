# T2.P01.S04 — Bounded composition loop and final gate: implementation plan

**Slice:** T2.P01.S04 · **Status:** approved — owner-authorized 2026-10-19 as batch C · **Phase:** [T2.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T2](../../README.md) · **Runbook:**
[T2 operations](../../../../operations/t2-composition/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, F4.intent-acceptance@1:conditional-save-current-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This is the phase's **FINAL PHASE GATE**.

## Prerequisite

S01–S03 accepted; `T3.P01.S02`'s `conditional-save-current-v1` accepted at this slice's trusted base;
T1's Head Save integration accepted
([assignment](../../../../reference/decisions/s02-pair-authorization-2026-10-16.md)). The integration is a
slice dependency, not a capability. The gate checker cannot see it, so it is checked at this slice's
start against the named T1 slice's acceptance record.

## Scope

Add explicit positive uniform Resize on floor, using the same support/contact result in preview and
commit. Numeric scale is the guaranteed route; add a direct handle only if its scale and pivot are
legible. Admit every finite positive scalar the operation can represent; do not import the old
helper's silent minimum/reset policy. Non-finite, zero, negative or unequal-axis input refuses without
averaging. Expose no independent-scale mode or misleading light scale control.

Add duplicate/delete through the common scoped actions/Find list and the S02 operations
(`resize-on-floor`, `duplicate-one` and `delete-one` already exist in `scene-planning/operations.ts`).
Prove canonical source JSON download/parse/reload through the shared project replacement guard.

**Scope correction (batch C ruling C4).** T1 already ships *Download source JSON*, *Open
source JSON* through the replacement guard, and *Reload remote* (Head and spatial route, PR #148).
This slice reuses them and proves the journey. It adds no Head, persistence or Save UI. A direct
Resize handle is admitted only through S07's contribution points and the existing T2 host/renderer
seams, without extending them; any new host seam is a stop-and-report to T1. Record the base the
journeys ran on, and whether it contains T1's TD-8 fix. Reload
validates everything before installation, cancels one active preview, starts a new session/history
baseline and never creates a synthetic source edit. It is source JSON with existing static
references, not a portable asset package. Cloud reads use retained validated paths. Save and reload
go through `T3.P01.S02`'s accepted `conditional-save-current-v1` and its client Save state, as
mounted by T1's Head integration. This slice builds no Save state, protocol or Head control of its
own. It proves the creator journey: dirty versus saved by full captured source, an in-flight older
Save never marking newer edits saved, and a conflict preserving work until Reload. Persistence adds
no Undo stack or source edit.
After T3 activation use the accepted unit Save adapter.

## Exit criteria

Run the full [phase evidence matrix](../README.md#phase-acceptance-evidence-final-gate), including all
required repository verification; review all four slice outcomes together. Record any detailed 3D UX
decisions with their scope and evidence.

## Readiness declaration

This slice is **owner-authorized** (2026-10-19, batch C with `T1.P01.S05`,
[record](../../../../reference/decisions/batch-c-authorization-2026-10-19.md)). Nothing here claims
implementation, acceptance or readiness. Its prerequisites hold on `main` `5fee2a2d`, including T1's
Head Save integration accepted through `T1.P01.S04`; the runbook start step re-checks them. A passed final gate makes the phase closable,
not closed. Evidence belongs in [acceptance.md](./acceptance.md).
