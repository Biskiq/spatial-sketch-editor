# T3.P03.S01 — Planner scope and build isolation: implementation plan

**Slice:** T3.P03.S01 · **Status:** approved — owner-authorized 2026-10-22 as batch E (E2,
[record](../../../../reference/decisions/batch-e-authorization-2026-10-22.md)) and released from the
hold; implemented on `t3/p03-s01-planner-scope-build-isolation`, awaiting review and acceptance ·
**Phase:** [T3.P03](../README.md) ·
[slice register](../README.md#slice-register) · **Runbook:** [T3 operations](../../../../operations/t3-experience/README.md)

```text
CONSUMES: F2.unit-envelope@1, F4.intent-acceptance@1
REQUIRES: F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t3.p03.s02-measurement-workflow-and-final-gate/acceptance.md
```

The first-wave merge prerequisite: C1, C2 and T3.P02.S01 implementation starts from the base where
this slice has merged. It changes no gate row, capability record or source format.

## 1. Enforce each planner's declared scope

**Defect (verified at `f516e1ff`).** A planner declares one `domain` and a boolean `compound`
(`packages/project-model/src/f4/types.ts`). The dispatcher compares that declaration with the
intent's *targets* only, and an untargeted intent skips the check. The adapter's `validateChange`
(`packages/project-model/src/units/acceptance.ts`) compares changed units with an *adapter-wide*
`compound` flag, and the live Stage host builds that adapter with `compound: true`
(`apps/editor/src/lib/authoring/stage/host-acceptance.ts`). The coordinator passes only the
planner's domain. The domain comparison therefore never runs: the RR-4 probe's Scene-declared planner
that also moves a Wall is accepted, targeted or untargeted.

**Change.**

1. The coordinator hands `validateChange` the producing planner's whole admission, not only its
   domain (`apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts`).
2. `validateChange` derives the changed domains from unit content revisions, as it already does,
   and requires them to fall inside that planner's write set: its own `domain` when `compound` is
   false; its `domain` plus a declared `writes` list when `compound` is true. Resource and lock
   changes still require the planner's `resources` grant. The adapter-wide flag remains what the
   host profile *grants*, never what a planner may write.
3. `PlannerAdmission` gains the optional `writes` field. Registration refuses a compound planner
   that omits it. The one compound planner, `unit.experience-presentation-stop-create`, declares
   Camera and Experience.
4. A scope failure is a typed refusal: no install, no revision change, no history entry, no
   partial source. Existing stale/ABA, no-op, thrown-candidate and snapshot-history behavior is
   unchanged.

Registered planners at `f516e1ff`: eight Layout and seven Scene planners, all single-domain and live;
`unit.camera-view-update` (Camera, single-domain) and the joint Experience planner, wired only in
the unit conformance profile. The fix must leave all of them admissible within their scope.

## 2. Align public and Preview build isolation with the current tree

**Defect.** `apps/editor/src/lib/visitor/preview-surface-boundary.ts` still forbids the deleted
`src/lib/editor/` tree and has no `src/lib/authoring/` entry. Both build plugins
(`apps/editor/vite/preview-surface-boundary-plugin.ts`, `apps/editor/vite/public-surface-boundary-plugin.ts`)
use that predicate, so neither build rejects authoring machinery. Only
`apps/editor/tests/lib/authoring/f4-public-isolation.test.ts` rejects the authoring tree, and only
for the public route; nothing checks the `VisitorPreviewSurface.svelte` closure.

**Change.**

1. Replace the stale pattern with the authoring tree in the shared predicate. Keep every other
   forbidden pattern and every runtime-safe allowance (layout-core, camera-core, project-model
   evaluators stay admissible).
2. Retarget the fixtures and string tokens that still name the deleted tree, in
   `apps/editor/tests/vite/public-surface-boundary-plugin.test.ts`,
   `apps/editor/tests/vite/preview-surface-boundary-plugin.test.ts`,
   `apps/editor/tests/lib/visitor/preview-surface-boundary.test.ts`,
   `apps/editor/tests/lib/visitor/visitor-public-route.test.ts`,
   `apps/editor/tests/lib/visitor/visitor-cold-runtime.test.ts`,
   `apps/editor/tests/lib/visitor/visitor-identity-isolation.test.ts` and
   `apps/editor/tests/lib/layout/layout-geometry-boundary.test.ts`. Each changed assertion states the
   defect it catches; no assertion is weakened or deleted.
3. Add the missing source-closure test for the Preview surface root, mirroring the public-route
   closure test, and append it to the arch lane in `apps/editor/test-lanes.ts`.

## Acceptance

1. The RR-4 overreach planner becomes a regression test in the unit-acceptance suite: refused
   untargeted and Scene-targeted, with source, revision and history unchanged. Equivalent
   Layout-only and Scene-only planners still succeed. The joint Experience planner still succeeds
   atomically through the conformance profile; the same planner with a Layout write added is
   refused. A compound planner without `writes` cannot register.
2. Mutation proof for both builds: a fixture importing an authoring module from the public root, and
   one from the Preview root, each fails its plugin; controls importing runtime-safe evaluators pass.
   The new closure test fails when an authoring import is injected into the Preview surface.
3. Every existing proof still passes: no-op, stale, thrown candidate, Undo/Redo, replacement, the
   live Layout and Scene adapters' call-site proofs, and the visitor/public suites.

Verification: the affected F4 and boundary contracts, the whole arch lane, `npm run check`, and the
heavy lane where it covers acceptance. The complete repository gate runs at merge, as it does for
every implementation PR, and S02 rechecks the integrated result.
