# T1.P01.S06 — Integrated final gate: implementation plan

**Slice:** T1.P01.S06 · **Status:** proposed — not authorized · **Phase:** [T1.P01](../README.md) ·
[slice register](../README.md#slice-register) · **Track:** [T1](../../README.md) · **Runbook:**
[T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:references-v1, F4.intent-acceptance@1:local-single-domain-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This plan is the phase's declared **FINAL PHASE GATE** and the integration route every narrowed
slice in this phase routes its deferred proof to; its acceptance record is the phase's declared
final-gate artifact. It is proposed and not authorized: nothing here is implemented, accepted,
ready or evidenced.

## Prerequisite

S01–S05 and S07 accepted with routine closeout. The seam provider remains independently accepted:
under owner ruling D1 (2026-10-17) the viewport capability is accepted through S07, not through this gate.

**Proposed route (batch C ruling C3, [prepared record](../../../../reference/decisions/batch-c-authorization-2026-10-19.md),
not yet approved).** S06 runs once, **after `T3.P01.S04` is accepted**. Run before the cutover, its
evidence would go stale when T3 replaces the current-source adapter and the starter boot (AM-5's
boot seam, K6). It would also put an exhaustive run on the cutover's critical path, and T1's next
phase (K3) waits for the F2 cutover anyway.

Under this route, S06's own authorization record re-declares the slice:

- `Consumes` adds `F2.unit-envelope@1` and `T3.camera-experience-cutover@1`;
- `Requires` replaces the retiring `local-single-domain-v1` with the unit scopes that S04 makes live
  (`unit-resolution-v1`, `unit-acceptance-v1`, and `conditional-save-units-v1` for the Save/reload
  journey).

The register row and the `Requires` pin stay unchanged until that record exists. The checker refuses
an unregistered gate version, and the cutover gate is still `undrafted`. On the post-cutover tree,
the journey below also verifies the sign-in Save resume
([TD-9](../../../../operations/tech-debt/README.md#td-9--the-sign-in-save-resume-is-half-wired)).
The owner's alternative is to run S06 on current source right after S05; `T3.P01.S04` phase B then
waits for S06 as well.

## Produces

Recorded phase integration acceptance only.

## Scope

Run the complete repository contract below and record independent review of: existing
project → Plan select/search → precision edit/refusal → flip to 3D → direct edit/cancel →
Undo/Redo → canonical source download/reopen → project replacement. Include an empty project,
nonzero floor datum, curved Wall, shared Junction, duplicate names, Opening void/cap,
independent coincident structures, dense geometry, long identity, narrow/short shell and
reduced motion. Add empty boot → native plinth → precision → source reopen. Include the seam
consumer probes and zero editor machinery in public chunks.

Proposed slice tiers: S01/S02/S03/S05/S07 architecture-integration, S04 affected-subsystem; each
narrows through this exhaustive S06 integration route. Focused iteration never substitutes for
acceptance. Every implementation-PR merge still retains the complete repository gate including
heavy correctness. Do not add a second harness or repeat accepted evidence merely for closeout.
The full implementation-PR merge contract still applies regardless of slice tier.

## Acceptance criteria

**Required evidence:** fast/heavy kernel correctness and full editor suite; unconditional arch
lane (including documentation/execution gates and visitor/public/preview boundaries); root
check/build and affected shared-package checks; browser journeys with recorded revision,
workload and consumer conformance. Use [tests/README](../../../../../apps/editor/tests/README.md)
for exact lane/command policy and
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md)
when launching/attaching a browser. If API code is later added by approved scope expansion,
API check and DB-backed tests with zero skips are additional, never replaced by root scripts.
Performance-sensitive Stage work gets comparable workload observations over actual shallow
editor inputs, without reviving the retired benchmark harness or machine-time thresholds.

The final gate makes the phase **closable** after routine slice closeout. Only an explicit
owner phase-close request closes it; neither phase nor cycle closure is fabricated here.

## Readiness declaration

This slice is `proposed` and **not authorized**: it runs only after S01–S05 and S07 are
accepted with routine closeout, it consumes `F1.reference@1`, `F4.intent-acceptance@1` and
`T1.viewport-projection@1` accepted at its trusted base, and its `Requires` capabilities
(`references-v1`, `local-single-domain-v1`, `viewport-projection-v1`) must be accepted before it starts. No gate state,
readiness, implementation, acceptance, evidence or commit is claimed by this plan. A passed
final gate makes the phase closable, not closed, and only an explicit owner phase-close request
closes it. Under the architecture cycle, this slice neither opens nor waits for the window: the
terminal verdicts stay the owner's.
