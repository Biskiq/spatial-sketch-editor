# T1.P01.S06 — Integrated final gate: implementation plan

**Slice:** T1.P01.S06 · **Status:** in progress — owner-authorized as batch D, with the
[corrective D1 amendment](./d1-amendment.md) explicitly ratified. Host corrections and the fixture
browser pass are implemented; final verification and owner acceptance are recorded in the
[acceptance record](./acceptance.md). **Not accepted.** ·
**Phase:** [T1.P01](../README.md) · [slice register](../README.md#slice-register) · **Track:**
[T1](../../README.md) · **Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1, T3.camera-experience-cutover@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: exhaustive
```

This plan is the phase's declared **FINAL PHASE GATE** and the integration route every narrowed
slice in this phase routes its deferred proof to; its acceptance record is the phase's declared
final-gate artifact. It is authorized and in progress: the TD-10 repair and every automated lane it
requires are recorded in the [acceptance record](./acceptance.md), which is **not** an acceptance.

## Authorization

`T1.P01.S06` is owner-authorized 2026-10-20 as batch D (ruling D1, [record](../../../../reference/decisions/batch-d-authorization-2026-10-20.md)),
on the post-cutover base `origin/main` `9a457f6b` (PR #158). The authorization covers the exhaustive
integrated verification this plan declares and the narrow TD-10 disposition below. The owner-approved [D1 amendment](./d1-amendment.md) additionally authorizes only the named
TD-11/12 corrections, necessary S05 compatibility/regressions and the separately approved Index
cloneability correction. No second harness, general host refactor or narrowing of the journeys is authorized.

## Prerequisite

S01–S05 and S07 accepted with routine closeout. The seam provider remains independently accepted:
under owner ruling D1 (2026-10-17) the viewport capability is accepted through S07, not through this gate.

**Route (batch C ruling C3, owner-approved, plus batch D D1).** S06 runs once, **after `T3.P01.S04` is
accepted**, which it now is. Running it before the cutover was declined: its evidence would have gone
stale when T3 replaced the current-source adapters and the starter boot (AM-5's boot seam, K6).

**Verified at the authorized base `9a457f6b`.** `T3.camera-experience-cutover@1` is `accepted` with
`T3.P01.S04` as its sole provider, at implementation revision `06a8aac8`; every `Requires` scope above
is `active`; and the capability records are reachable from `main`. This slice's register row, header
and `parallel-track-gates.test.ts` pin were rewritten in the same commit that retired the
local single-domain admission scope, so no retried current-source admission remains.

**Save journey.** The sign-in Save resume that TD-9 required is delivered by `T3.P01.S04` (TD-9 is
closed in the debt ledger) and is verified here end to end through the real route, not by deletion.

## TD-10 obligation (before or within this slice)

`TD-10` remains open in the tree at the authorized base and is T1-host-owned
([ledger](../../../../operations/tech-debt/README.md#td-10--a-late-successful-source-open-applies-after-a-newer-session-epoch)):

```text
defect    `openSourceJson` and `applyReloadOffer` in the spatial route await `bootFromSourceJson`
          and install the result without re-checking `session.isCurrent(token)`, unlike `loadProject`
          and the resumed-save path. A late admitted Open or accepted Reload can overwrite a newer
          project and its saved base.
route     a narrow host repair (capture the token before admission, abandon a result whose epoch is
          no longer current, report nothing for the stale action) plus the route-level regression
          TD-10 names. It may land as a standalone tech-debt PR before this slice (the PR #159
          precedent) or as this slice's first increment.
required  stale async admission can never replace a newer source or a newer saved base; a stale
          result shows no success or refusal notice.
forbidden a general session/lifetime refactor, a second replacement guard, or a green suite standing
          in for the regression TD-10 names.
closing   this slice verifies the repaired journey and closes TD-10 in the ledger with its commit and
          test. S06 cannot claim the host journeys while TD-10 stays open.
```

The repair is a precondition of the acceptance evidence, not a widening of the slice: it changes one
admission path's epoch check and adds one regression.

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

Add, on the post-cutover tree, the journeys the F2 cutover moved: F2-only boot and source
replacement, the strict admission refusals (pre-epoch file/client/draft, unknown version), an
acknowledged conditional unit Save with its conflict and *Reload remote* path, the sign-in Save
resume, and the TD-10 stale-admission regression. Review also settles the shell-layout observation
`T3.P01.S04` carried forward — the Card overlapping the Compose buttons during pointer interaction on
a narrow viewport — as either a defect this stage fixes or a recorded residual with an owner.

S01/S02/S03/S05/S07 were architecture-integration and S04 affected-subsystem; each narrows through
this exhaustive S06 integration route. Focused iteration never substitutes for acceptance. Every
implementation-PR merge still retains the complete repository gate including heavy correctness. Do not
add a second harness or repeat accepted evidence merely for closeout. The full implementation-PR merge
contract still applies regardless of slice tier.

## Acceptance criteria

**Required evidence:** fast/heavy kernel correctness and full editor suite; unconditional arch
lane (including documentation/execution gates and visitor/public/preview boundaries); root
check/build and affected shared-package checks; browser journeys with recorded revision,
workload and consumer conformance. Use [tests/README](../../../../../apps/editor/tests/README.md)
for exact lane/command policy and
[browser hygiene](../../../../../.agents/skills/browser-hygiene/SKILL.md)
when launching/attaching a browser. The F2 Save journey is API-backed, so `check:api` and a
DB-backed `test:api` run with zero skips; root scripts never replace them. Performance-sensitive Stage
work gets comparable workload observations over actual shallow editor inputs, without reviving the
retired benchmark harness or machine-time thresholds.

The final gate makes the phase **closable** after routine slice closeout. Only an explicit
owner phase-close request closes it; neither phase nor cycle closure is fabricated here.

## Readiness declaration

This slice is `approved` and **unimplemented**: it runs only on a trusted base where S01–S05 and S07
are accepted with routine closeout, `T3.camera-experience-cutover@1` is `accepted`, and every scope
named in `Requires` is `active`. It consumes no retired current-source admission, and its evidence
does not depend on any `T3.P02` implementation — `T3.P02.S01` is an independent parallel slice whose
own acceptance is `T3.P02.S02`'s. No gate state, readiness, implementation, acceptance, evidence or
commit is claimed by this plan. A passed final gate makes the phase closable, not closed, and only an
explicit owner phase-close request closes it. Under the architecture cycle, this slice neither opens
nor waits for the window: the T1.P01 window is closed and the terminal verdicts stay the owner's.


## Takeover authorization and review frontier

The owner approved the [D1 corrective amendment](./d1-amendment.md) and its separate narrow Index
correction on October 20, 2026. That approval supersedes this plan's original TD-10-only code limit
only for those named increments and necessary regressions. The owner subsequently requested no more
independent review and commit/push for their own review, then resumed completion of the final verification. The acceptance record contains
the executed fixture matrix and the final exhaustive gate still owed. The slice remains unaccepted;
no phase closure or merge is authorized by this checkpoint.
