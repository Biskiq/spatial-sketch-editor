# T1.P01.S07 — acceptance record: Stage↔F4 integration bridge

**Status: in-progress; acceptance withheld; PR #137 remains unmerged.**
[Plan](./implementation-plan.md) · [phase](../README.md) ·
[AM-5 reconciliation/completion](./am5-reconciliation.md).
`T1.viewport-projection@1:viewport-projection-v1` remains **ratified**, not accepted.
No capability or closeout is recorded here.

## Reviewable implementation

### Host wiring, contributions and lifetime (committed increment `bbc1203a`)

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

### AM-5 completion (committed `a67793e4` plus review fixes through `933bf285`, on top of `bbc1203a`)

- **Encoding-neutral accepted read.** `accepted-read.ts` owns the common snapshot; the current
  encoding lives behind the explicit adapter in `current-stage-source.ts`. `StageDomainRead` no
  longer exposes `project` or `current`; the current adapter refuses a foreign kind/version instead
  of decoding, and the alternate-encoding consumer reads a `test-read-port@27` snapshot with no
  source or decoder import. `StageDomainRead.layoutLevelId` carries the **authored** level id
  because the compiled floor list can be empty (a source with objects and no enclosure) while its
  Layout subjects still resolve.
- **Exact scope of that boundary.** The port removes the required `ProjectDocument` and fixes the
  encoding metadata (`sourceKind`/`sourceVersion`/`compileGeneration`). It does **not** publish a
  free-form domain: `StageDomainRead` still requires the current Layout and Scene read projections
  (compiled geometry, authored level, datum, runtime Scene, Room registry, navigation graph) that
  AM-5's interface row names, and Camera is reference/inspection access, not a Camera view. A
  non-Layout encoding can relabel and read the snapshot, but it cannot yet publish its own domain
  shape — that is AM-5's next consumer's work, not a claim this increment makes.
- **Ordered F.1 selection with one primary.** `semantic-selection.ts` admits the ordered value,
  refuses unknown/stale references, an invalid Layout representation and a primary outside the
  value, and dedups on the resolver's canonical identity — two valid qualifications of one subject
  (`project-root` and its `layout-location`) become one entry, and the stored address is the
  resolver's, not the caller's alias.
- **Lens/task lifecycle.** Session-owned lens, task status and writer generation. A lens exit parks
  the task **before** cancelling its writers exactly once and then cancels the command writers too,
  so an in-flight acceptance is cancelled as well. Resume requalifies the target against current
  content, refuses the wrong lens, and requires the owning adapter's `revalidate` for a contributed
  task; a directly opened host task (Plan membership) resumes on target requalification alone
  because it carries no adapter configuration to revalidate. Resume restores neither selection nor
  view. The coordinator gains an additive `cancelPending()`, accepts **and restores** register as
  command writers, and the route renders the inactive task with explicit Resume/Close.
- **Writer cancellation scopes.** Opening or closing a task cancels task/gesture/Camera writers only;
  a lens transition cancels those plus commands. Accepted content closes an active task and cancels
  its task-scoped writers without touching the command that is committing the install.
- **Adapter port widening.** `StageAdapterServices.authoring.registerPlanner` and the host's
  `registerPlanner` accept `DomainPlanner<unknown>`; `currentStagePlanner` is the explicit adapter
  for a planner written against the typed current source. Registration refuses nothing new: dispatch
  already refuses a planner whose declared source kinds/versions do not name the admitted snapshot.
- **Adapter-context lifetime.** A binding's context now ends with **that binding** (its disposer),
  not with the session's writer generation. Opening or closing a task therefore no longer
  invalidates a live adapter's selection capability, while a lens transition, content change or
  replacement still ends the previous contexts through re-binding. Task-scoped instrument services
  keep the writer-generation guard.
- **Route facts.** A non-Layout subject's Card shows its domain and its adapter's contributed facts
  instead of Layout eligibility/datum rows, and the route's Plan-membership task refuses a
  non-Layout subject with a visible reason (the refusal belongs to the route that owns that task
  kind, not to the session).
- **Two panel/pointer defects found by the browser run and fixed.** The Experience panel and the inactive-task
  banner now stop their own pointer/click events (the pointer-driven Stage captured the press and
  the buttons never received a click), and the parked-task notice moved to the Stage's top-left
  where the selection Card cannot cover Resume.

## Evidence identity

Work continues on **T1-P01-S07**, based on `fcf1fbaa`. The code head is **`933bf285`** (`a67793e4`
plus review fixes `4127b63f`, `4c831fc5`, `933bf285`; base `bbc1203a`), the pushed AM-5 increment
after three review rounds. Its 22 changed/added `src`/`tests` files are individually hashed in
[am5-source-manifest.json](./evidence/am5-source-manifest.json), aggregate SHA-256
`7351d55edd223804cdcf27965f1e07638ad64c266d9768be537713371a561e2a` over the sorted
`<path>` TAB `<sha256>` newline lines that the manifest itself defines. All lanes were re-run on
`933bf285`; see [verification](./evidence/verification.md). `npm run test:api` was **not** run and
no gate has run against a merge revision.

The committed increment's own identity (HEAD `bdaf5721` plus its review fixes at `bbc1203a`, and the
integration candidate on `d2607caf`) remains in [verification](./evidence/verification.md) with its
source manifest. Committing and pushing an increment does not constitute slice acceptance.

## Independent review

The committed host-wiring increment was reviewed: a separate reviewer inspected the complete PR plus
its review increment, reported Find/ownership, task teardown, requalification, actual-epoch,
stale-callback/evaluation and throwing-disposer findings, then re-reviewed the fixes. That verdict —
**no remaining actionable implementation findings**, eight relevant suites, 105 tests — covers
`bbc1203a` only.

The AM-5 increment had its own review round on 2026-10-17: four independent passes (concurrency and
lifetime, contract and identity, route/browser harness, evidence honesty) read it without writing to
it. Every finding was fixed in `4127b63f` and re-verified — canonical requalified identity, real
cancellation of task writers, task open/close no longer aborting an accept, refusal messages that
name what happened, adapter isolation in the render loop, and the narrow-shell panel/notice layout.
[Verification](./evidence/verification.md) lists the findings and their fixes.

That is a review of the implementation, not acceptance: no round evaluated a merge revision, and none
may accept the capability. A second round checked the fixes and the records themselves; a third
reviewed the code the second round changed and found one lifetime defect (the parked-task hold could
overwrite a task a canceller deliberately opened), fixed in `933bf285`. What remains is the
[fresh review of the final code head](#exact-acceptance-and-merge-blockers) named below — the rounds
fixed what they found, but each reviewed the revision before its own fixes.

## Browser evidence

An explicit test-only Vite configuration injects the conformance adapter and a visible replacement
button into the existing host guard. This is the approved plan's test-hook allowance, not an
unapproved production hook. The normal production composition has no writer; the
[production-exclusion scan](./evidence/production-exclusion.json) finds zero probe sentinels in 349
emitted files.

[Browser actions and DOM observations](./evidence/browser-actions.json) are one continuous session
(267 commands) against the AM-5 increment. It records:

- **Layout, both readings.** Starter Wall height **3 → 4 m**, Undo **3 m**, Redo **4 m**; content
  identity `sha256-4525f51d…` at 3 m and `sha256-e5364103…` at 4 m, history buttons matching the
  state in each reading.
- **Scene identity.** An F.1 Scene entity authored through the accepted path, selected through
  `setSelection`, shown in the Card as `ENTITY · SCENE · entity-conformance` with adapter-contributed
  facts, and echoed through `selectionChanged` (ordered ids + primary).
- **Scene edit + history.** `receiveShadow` **false → true** on the selected entity; the Scene
  selection survives accept, Undo and Redo with its primary and order intact.
- **Lens parking and explicit Resume.** Experience parks the Scene task (`instrument: null`,
  inactive notice), the writers are cancelled, selection and history are kept; returning to World
  keeps it inactive; Resume restores the instrument with the same selection, history and pose.
- **Replacement.** The real host guard replaces the project: both history buttons disabled, the
  Scene group and selection gone, and the baseline content hash restored.

Screenshots: [Plan baseline](./evidence/plan-baseline.png), [edit](./evidence/plan-edit.png),
[undo](./evidence/plan-undo.png), [redo](./evidence/plan-redo.png),
[Scene selection](./evidence/plan-scene-selection.png), [Scene edit](./evidence/plan-scene-edit.png),
[Scene undo](./evidence/plan-scene-undo.png), [Scene redo](./evidence/plan-scene-redo.png),
[lens inactive](./evidence/plan-scene-lens-inactive.png),
[lens return](./evidence/plan-scene-lens-return.png), [resume](./evidence/plan-scene-resume.png),
[3D Scene selection](./evidence/3d-scene-selection.png), [3D edit](./evidence/3d-edit.png),
[3D undo](./evidence/3d-undo.png), [3D redo](./evidence/3d-redo.png),
[3D replacement](./evidence/3d-replacement.png), [Plan replacement](./evidence/plan-replacement.png).

Two commands in the transcript exited non-zero: one screenshot path given relative to the wrong
directory (re-run with the absolute path; no product effect), and one real defect — the Resume
button covered by the selection Card, fixed with the two panel/pointer defects above. The fixed run
follows it in the same transcript.

After the review fixes, one 390 × 844 spot check re-measured the two new panels (no horizontal
overflow, the parked panel clear of the reading toolbar, the Experience panel's button reachable) and
is recorded with its transcript in [verification](./evidence/verification.md#narrow-shell-spot-check-after-the-review-fixes-4127b63f).

This is bounded conformance evidence, not production authoring, and it does not waive any blocker
below.

## AM-5 probe table reconciliation

| Probe | Evidence and limit |
| --- | --- |
| Projection/inverse | `camera-viewport-evaluation.test.ts`, `stage-facade.test.ts`, consumer probes: settled Plan/3D/intermediate projection/rays, stale evaluations and explicit frames. Retained factory-context regression refuses stale math after navigation. |
| Layout | `layout-plan-representation.test.ts`, facade/content-change suites: canonical correspondence, eligible fragments, exclusion/Reveal, compiled surfaces. No second compiler or production writer. |
| T2-style consumer | Consumer probes project a canonical Scene entity and resolve an explicit plane point. The external test-only domain module registers both Layout and Scene planners, submits both through the public services, contributes UI and traverses the single history. **Now**: Scene identity selection, Card facts and the `selectionChanged` echo are proved in `stage-semantic-lifecycle.test.ts` and in the browser run. |
| T3-style consumer | Read-only Camera projection/inspection probe and contributed instrument lifecycle tests. No Camera authoring, second output or Preview claim. |
| Replacement/lifetime | Current-binding exact disposal; failure-path baseline preservation; actual epoch; late accept; retained callbacks; expired math; task-close gesture; throwing cleanup; binding-scoped context invalidation. **Now**: lens exit parks then cancels writers once and refuses old contexts; Resume revalidates against current content and refuses an invalid configuration, a different lens and a target that no longer resolves. |
| Shell/isolation | Contribution ordering/owner dispatch and Camera invariance; arch public/visitor/preview boundaries; browser workflow in both readings plus narrow/long-identity/reduced-motion states. **Now**: the encoding-neutral accepted-read port and F.1 ordered selection are implemented, a second encoding reads the snapshot with no source/decoder import, and the production build excludes every probe sentinel. |

A passing suite is not full conformance for a missing contract requirement; the table now claims only
what the name-and-address rows above record.

## Known limits a reviewer should check, not re-derive

These are recorded as limits of this increment, not as hidden defects:

- **Instrument services are partly narrowed.** The instrument's `stage` services guard
  `setSelection`, `select` and `acquireGesture`, and `authoring.accept` is guarded by the writer
  generation. The rest of the facade (`openTask`, `changeLens`, `installAccepted`, `resumeTask`) is
  still reachable from a captured instrument closure; those calls are themselves session- and
  epoch-guarded, but the "old closure is inert" claim covers only the four guarded methods. A
  narrower instrument-services type is the next step, not a silent assumption.
- **Correspondence must state canonical addresses.** Requalification matches a correspondence
  `before` by full address against the canonical identity admission stored, and stores the
  canonicalised `after`. A planner that emits a valid *second* qualification of the same subject
  (for example `project-root` for a Layout subject whose canonical location is its level) finds no
  entry and the subject is reported as `no-correspondence` instead of being retargeted. This is a
  deliberate, documented matching rule; no in-repo planner emits a non-canonical address today.
- **Resume of a retired target is not exercised end to end.** The negative test resumes a target that
  no longer resolves, not a subject a real accepted change retired. The requalification logic that
  retires subjects is covered in `stage-host-acceptance.test.ts`; resuming through it is the gap.
- **A world task is not resumable from the Experience lens.** The parked panel is therefore shown
  only in the lens whose Resume can succeed, and the Experience panel says so in words.
- **Layout-only accepted changes clear a Scene selection.** The correspondence for such an operation
  lists only Layout subjects, and the host refuses to assume an unlisted subject survived.
- **`npm run test:api` and any merge-revision gate remain unrun** for this increment.

## Exact acceptance and merge blockers

1. **A fresh independent review of the final code head** (`933bf285`, `7351d55e…` manifest). The
   2026-10-17 rounds fixed what they found, but each reviewed the increment before its own fixes.
2. **The complete gate at the actual proposed merge revision** against then-current `main`:
   `npm test`, `npm run test:arch`, `npm run check`, `npm run build`, the three kernel checks, and
   the API typecheck plus DB-backed API tests with **zero skips** on a disposable database. The
   lane results in [verification](./evidence/verification.md) are on the branch, not on a merge
   revision; the API suites were **not** run for this increment.
3. **Independent slice acceptance** against all requirements, then routine closeout. Only that
   process may accept the capability, with S02 remaining its sole provider. No merge is requested.

The browser criterion is observed for the bounded test-only workflow in both readings, including
Scene selection and lens Resume. It does not waive the blockers above.
