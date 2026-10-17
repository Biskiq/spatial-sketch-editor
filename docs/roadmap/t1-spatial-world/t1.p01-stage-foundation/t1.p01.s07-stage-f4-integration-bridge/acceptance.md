# T1.P01.S07 — acceptance record: Stage↔F4 integration bridge

**Status: in-progress; acceptance withheld; PR #137 remains unmerged.**
[Plan](./implementation-plan.md) · [phase](../README.md) ·
[AM-5 reconciliation/proposed completion](./am5-reconciliation.md).
`T1.viewport-projection@1:viewport-projection-v1` remains **ratified**, not accepted.
No capability or closeout is recorded here.

## Reviewable implementation

- Factory registration disposal reads the current binding, disposes it once, and does not retain
  power over a later same-ID registration. A throwing disposer cannot strand other bindings or
  interrupt acceptance/Camera reacquisition.
- Domain modules export `createAdapter` from the domain-owned `authoring/adapters/*.adapter.ts`
  catalogue. The generic mount supplies public planner registration and F4 submission. No production
  Layout/Scene writer is installed. Adapter-owned Svelte instruments render through the one home;
  current bindings supply their facts/UI, and unregistration closes their owned task and gesture.
- Find dispatch preserves adapter identity and resolves its declared task kind, independently of
  Find/task IDs. Duplicate local IDs across adapters neither collide in the UI nor select another
  adapter's instrument.
- F4 replacement has an additive host-admission callback before baseline/history commit. It fences
  pending accepts immediately, validates Stage admission, and supplies the actual fresh epoch.
  A real project-identity refusal preserves source, revision, epoch, history, selection and claim.
- Accepted changes notify the route: the canvas consumes the updated snapshot, with live history,
  selection and task state. Host commands stay busy through Stage installation/compensation.
  Retained facade/context mutations cannot reach a replacement session, and captured projection/rays
  refuse after their evaluation expires.
- Requalification preserves a retired-subject reason through the host, and component correspondence
  is matched before a subject-level entry can decide its fate.
- Narrow shell conformance restores the Index hidden state and reserves Stage space with scrollable
  Index contents. Browser evidence covers expanded/collapsed Index, long identity, 640px/390px and
  reduced-motion states.
- The pre-existing invalid fourth Vitest argument was removed from Camera exhaustive conformance.
  Its existing 60-second option and depth-5 traversal are preserved; the typecheck can now be green.

## Evidence identity

Work continues on **T1-P01-S07**, based on `fcf1fbaa`. Verification was captured with HEAD
`bdaf5721` plus the review-fix increment, before that increment was committed and pushed for PR
review at the owner's request. The source-file manifest identifies the exact tested files; committing
and pushing the increment does not constitute slice acceptance. The manifest and final check results
are under [evidence](./evidence/verification.md).

The integration candidate applies the complete PR delta cleanly onto then-current `main`
`d2607caf85e35d9ae54241b5fb72fd2f45b31cbe` (including PR #138's T3 preparatory seams and PR #139's research documentation), including the additive F4
coordinator changes. It is a detached validation tree, not a merge or an accepted capability.

## Fresh independent review

A separate reviewer inspected the complete original PR plus the pending increment, reported
Find/ownership, task teardown, requalification, actual-epoch, stale-callback/evaluation and throwing-
disposer findings, then re-reviewed the fixes. Final code verdict: **no remaining actionable
implementation findings**; independently ran eight relevant suites, **105 tests passed**, and
`git diff --check fcf1fbaa` passed. This code verdict explicitly withholds slice acceptance and merge
readiness for the remaining contract/evidence requirements.

## Browser evidence

An explicit test-only Vite configuration injects the conformance adapter and a visible replacement
button into the existing host guard. This is the approved plan's test-hook allowance, not an
unapproved production hook. The normal production composition has no writer.

[Browser actions and DOM observations](./evidence/browser-actions.json) record starter Wall height
**3 → 4 → 3 → 4 → 3 metres** for baseline/edit/Undo/Redo/replacement in **both Plan and 3D**.
Content identity returns exactly to the baseline on Undo/replacement and to the edited identity on
Redo. Confirmed replacement leaves both history buttons disabled. An actual adapter-owned Svelte
button submits the intent; the Head handles Undo/Redo. Screenshots are linked in
[verification](./evidence/verification.md). No browser exceptions were observed in the recorded run.
This proves the bounded Layout workflow; it does not prove Scene selection or inactive-lens Resume.

## AM-5 probe table reconciliation

| Probe | Evidence and limit |
| --- | --- |
| Projection/inverse | `camera-viewport-evaluation.test.ts`, `stage-facade.test.ts`, consumer probes: settled Plan/3D/intermediate projection/rays, stale evaluations and explicit frames. New retained factory-context regression refuses stale math after navigation. |
| Layout | `layout-plan-representation.test.ts`, facade/content-change suites: canonical correspondence, eligible fragments, exclusion/Reveal, compiled surfaces. No second compiler or production writer. |
| T2-style consumer | Consumer probes project a canonical Scene entity and resolve an explicit plane point. The external test-only domain module registers both Layout and Scene planners, submits both through the public services, contributes UI and traverses the single history. **Scene identity selection/Card conformance remains missing.** |
| T3-style consumer | Existing read-only Camera projection/inspection probe and contributed instrument lifecycle tests. No Camera authoring, second output or Preview claim. |
| Replacement/lifetime | Current-binding exact disposal; failure-path baseline preservation; actual epoch; late accept; retained callbacks; expired math; task-close gesture; throwing cleanup. **Lens exit/inactive-task Resume remains missing.** |
| Shell/isolation | Contribution ordering/owner dispatch and Camera invariance; arch public/visitor/preview boundaries; browser workflow in both readings plus narrow/long-identity/reduced-motion states. **The generic accepted-read and F.1 ordered-selection requirements remain unresolved.** |

The integrated suites rerun the table's existing probes. **A passing suite is not full conformance**
for a missing contract requirement. The narrow proposed API/completion amendment is in
[AM-5 reconciliation](./am5-reconciliation.md); it is not approved or implemented.

## Exact acceptance and merge blockers

1. Complete source-independent accepted read and F.1 ordered/primary selection, including a real
   Scene selection/Card consumer proof. Resolve the proposed public-API extension before changing it.
2. Complete lens-exit writer cancellation, inactive task parking and explicit revalidated Resume.
3. Rerun/record the complete gate at the actual proposed merge revision against then-current main.
   The detached candidate results do not claim a merged-tree revision or slice acceptance.
4. Obtain independent **slice acceptance** against all requirements, then routine closeout. Only that
   process may accept the capability, with S02 remaining its sole provider. No merge is requested.

The browser criterion is now observed for its bounded test-only Layout workflow. It does not waive
any blocker above. The exhaustive merge rule also requires API typechecks and DB-backed tests even for this
editor-only increment. Their actual results and zero-skip requirement are recorded in the evidence;
no affected-code exception is claimed.
