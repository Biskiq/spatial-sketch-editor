# T3.P01.S03 — acceptance record: Compound and runtime preparation

**Slice:** T3.P01.S03 · **Status:** authorized 2026-10-17, **in-progress umbrella — partial
implementation, no acceptance recorded, no capability accepted**
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Split direction:** [split-proposal.md](./split-proposal.md) — owner-delegated approval 2026-10-17; registered and authorized as `T3.P01.S05` + `T3.P01.S06` ([record](../../../../reference/decisions/s03-split-followup-authorization-2026-10-17.md))
**Phase:** [T3.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

## What is implemented in this increment

| Artifact | What it is |
| --- | --- |
| [`packages/project-model/src/f4/unit-acceptance.ts`](../../../../../packages/project-model/src/f4/unit-acceptance.ts) | The F4-facing half of the additive `unit-acceptance-v1` admission: `createUnitPlannerRegistry` (the **landed** registry with a wider admission profile — compound/unit planners admitted, resource planners only with explicit staging, duplicate kind still refused), `prepareUnitIntent` (the **landed** dispatcher, taking its granted profile from the registry alone, so registration and dispatch cannot disagree) and `validateUnitTargets` (F.1 resolution against one supplied envelope). |
| [`packages/project-model/src/units/acceptance-staging.ts`](../../../../../packages/project-model/src/units/acceptance-staging.ts) | The F.2-dependent half: `stageUnitResources` (deterministic, duplicate-free staging or nothing), taking the resolved identity from the resolver and cross-checking it against the envelope field that identity is derived from, so a staged record cannot name a revision the resolver did not answer. A content revision and an external-bytes pin are different identities and both are kept when present. It lives behind the inactive `./units` subpath because the architecture gate forbids `f4/**` from reaching the unit envelope before `T3.P01.S04`; `f4/unit-acceptance.ts` imports nothing from it. |
| [`packages/project-model/src/f4/prepare.ts`](../../../../../packages/project-model/src/f4/prepare.ts) | Additive per-call `PrepareAdmission` (`inspectTargets` only) and an **optional** `PlannerRegistry.admission` profile. Both admissions must hold for a compound or resource-bearing intent: the registry's granted profile **and** the planner's own declaration. With no profile the dispatcher is exactly the landed `local-single-domain-v1` rule — compound, unit and resource operations are still refused, with the landed reasons and messages. |
| [`packages/project-model/src/channels/handoff.ts`](../../../../../packages/project-model/src/channels/handoff.ts) | The **role half** of `camera-handoff-v1` only: handoff roles (Follow, Look-through, Preview), the different-role rule, return and cleanup rules, and the displaced run's pending obligation for stale-run cleanup — all delegating to the landed ticket protocol. Guided/free ownership/return and bounded Experience session semantics are **not** here, so no scope constant is exported and the capability is not claimed. No pose, FOV or order authority. |
| Barrels | `f4/index.ts` and `channels/index.ts` appends only. No landed export changed. |

## Interface changes in this increment

- `PlannerRegistry.admission` is a new **optional** member: a registry built without
a profile behaves exactly as the landed `local-single-domain-v1` (same domain set,
refusal order, reasons and messages), and a hand-built conformance registry needs
no change. This keeps the addition additive rather than a required field on a
landed shape. The registry **publishes no profile at all** when the caller asked for
none, because an always-present profile made the dispatcher treat the landed path
as widened and emit the widened wording; the landed compound and resource
messages are now pinned text in the suite rather than a property of a code path.
- `PrepareAdmission` carries only `inspectTargets`; it cannot widen admission at
dispatch time. The registry is the single authority for the granted profile, and
there is no exported admission constant that could downgrade it.
- `StagedUnitResource.contentRevision` is the **resolver's** concrete revision —
the resource's own revision, or its pin's content hash for external bytes. A
resource with neither is `repair-required` at resolution and never stages.

## Evidence

Conformance suites exist and the coordinator ran them on the tree this record
describes: `check:project-model` clean; the editor `check` red only on the
pre-existing unrelated `camera-output-conformance.test.ts:345` error, which is
also red on untouched `main`; `test:arch` 161/161 (including the F.2 inactivity
boundary); `test:fast` 1744/1744; `test:heavy` 118/118; and the focused suites
(`f4-unit-acceptance` 15, `camera-handoff` 8, `f4-acceptance` 31) green. Those
are the coordinator's observations on these worktrees, not a merge-gate record
against `main`: this increment is not merged, nothing is accepted, and the
real-Postgres/API evidence this plan requires does not exist because no Save or
API code is part of it. The suites are the declared evidence rows:

- [`apps/editor/tests/lib/authoring/f4-unit-acceptance.test.ts`](../../../../../apps/editor/tests/lib/authoring/f4-unit-acceptance.test.ts)
  — the wider admission installs through the same coordinator and history; the
  landed registry still refuses the same planner and publishes no profile, so its
  compound and resource dispatch messages stay the landed text (pinned); duplicate
  kind and unconfigured resource planners are refused; an unresolved target
  refuses **before** planning and installs nothing; a real Camera view resolves
  against a real F.2 envelope; resource staging dedupes, sorts, stages a pinned
  external resource by its pin hash, refuses a partial set or a resource with
  neither revision nor pin, and refuses a record whose resolver answer and
  envelope fields disagree; a compound or resource-bearing intent is refused for a
  planner that did not declare that acceptance even in a widened registry; and a
  staging-registry planner is not refused at dispatch for the need it registered
  with, tested with a resource-bearing intent.
- [`apps/editor/tests/lib/project-model/camera-handoff.test.ts`](../../../../../apps/editor/tests/lib/project-model/camera-handoff.test.ts)
  — handoff from Inspection to a declared role records the return obligation;
  non-handoff and same-role handoffs refuse; a return restores the displaced role
  under a strictly newer epoch and spends the returning ticket; a replaced
  handoff's return is voided; handoff cleanup never ends an Inspection claim;
  return and cleanup of a free output are idempotent no-ops.

## Not implemented, and therefore not claimed

The [split proposal](./split-proposal.md) moves these to the two proposed slices;
none of them is evidenced here:

- the F.2 **candidates** themselves — actual Camera View + Presentation +
  optional Stop construction by domain planners, and resource-lock validation
  beyond the admission seam;
- `conditional-save-units-v1` and its **real-DB conformance at zero skips** (the
  live current-source Save path is unchanged and is the only live path — no
  second writer and no new-format route were added);
- the shared Experience lowering/interpreter, reducer/clock, holds/continuation,
  guard/Continue/detour state, semantic DOM companion/Info Panel and the
  guided/free/reduced-motion controllers;
- the AM-6 program traces, ownership/stale-event acceptance rows and the unit
  single/compound operation matrices;
- any capability acceptance, gate state change or `F4` readiness claim. T1's base
  acceptance is not relabelled as complete F4 readiness.

## Status and next step

This record claims **no S03 slice acceptance or capability acceptance**. The PR #138
preparatory increment (`b13c5d73`) passed independent code review and was accepted
**only as an incremental implementation**, under the owner's delegated decision
of 2026-10-17. Register and separately authorize the proposed S03a/S03b follow-ups
before their implementation, then complete the verification each plan requires: the full lane for the
two new suites, `npm run check` for the touched packages, the arch lane, and the
zero-skip DB suite for the Save half once it exists. Neither capability can be
recorded from this increment alone: `unit-acceptance-v1` needs the candidates and
unit Save, and `camera-handoff-v1` needs the guided/free and Experience-session
half that this module does not provide.
