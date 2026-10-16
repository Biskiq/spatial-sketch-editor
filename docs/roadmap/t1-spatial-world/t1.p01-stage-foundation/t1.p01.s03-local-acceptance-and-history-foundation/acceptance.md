# T1.P01.S03 — implementation and independent-review evidence

**Slice:** T1.P01.S03 · **Status:** in-progress; review fixes verified 2026-10-16; formal acceptance pending
**Plan:** [implementation-plan.md](./implementation-plan.md)
**Phase:** [T1.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)
**Contract:** [AM-4](../../../../reference/composition-execution.md#am-4-f4-local-acceptance-save-and-retirement-v1)

Independent review started from implementation `65e8b084a9f03c66d16e87e443f9a4ec288da60c`
on branch `T1-P01-S03`, [PR #129](https://github.com/Biskiq/spatial-sketch-editor/pull/129).
The resulting production/test tree is commit `5737f7c0d1f0e3894301800076b7cdb932d52abf`.
Its inspected and fetched `main` base is `bbff4f2005180748e99f2d6d63bbbd37faf3424c`.
All work and verification used the designated `batch-2026-10-16/T1.P01.S03` worktree.

This is review evidence, **not formal slice acceptance or closeout**. The slice stays `in-progress`;
`F4.intent-acceptance@1` stays `ratified`, with no Accepted-capabilities entry. Neither scope below
is claimable by a consumer yet. No closeout, merge, host activation or cloud readiness is recorded.

## Findings and fixes

The initial adversarial run reproduced **10 failing cases**, with the pre-existing 19 cases in those
two selected files passing. Further cases exercised replacement/history contention and extension
boundaries. Final re-review also reproduced a repair-mode Undo failure with real folded-Wall geometry. All substantiated in-scope defects were fixed:

| Severity | Defect in the reviewed implementation | Final behavior and regression evidence |
| --- | --- | --- |
| P1 | Returned snapshots, revisions and sources were writable aliases; edits could bypass validation and alter history without changing its digest. | Own and deeply freeze captured state, revision metadata and published facades. `publishes detached immutable source, revision and history` exercises attempted writes and restoration. |
| P1 | Declaring a Scene or Layout planner did not constrain its actual candidate; unrelated Layout, Camera, resource and project fields could change. | The current adapter compares admitted contents against the baseline and domain, rejecting unrelated changes. `enforces domain, Camera, resource and project ownership on actual candidates` uses otherwise valid candidates. Registration also refuses non-Layout/Scene domains and captures registration metadata. |
| P1 | Undo/Redo directly installed history states without shared validation. | Both are asynchronous adapter admissions against the currently accepted blocking-issue baseline, with exact canonical-source/content checks, generation/revision rechecks and cursor movement only after success. Tests cover validation refusal, repaired-blocker reintroduction, edit-versus-Undo contention, exact mixed history, branch truncation and the 100-state bound. |
| P1 | Default ordinal revision labels could collide with boot revisions or another coordinator lifetime, defeating stale/ABA checks. | Default revisions use UUIDs outside planning; reused/invalid local identities and replacement revisions refuse. Tests cover coordinator lifetimes, imported baseline labels and stale intents after Undo restores identical contents. |
| P1 | Async completion reread the caller's mutable expected revision. | Capture and validate intent data before dispatch/admission. Mutating the original request cannot authorize a stale candidate; the contention test gives another edit the first install. |
| P1 | Epoch string reuse allowed prior completions or an older replacement to install; edits during replacement could be overwritten. | A private monotonically advancing generation guards every completion independently of caller labels. Replacement blocks edits/restores until the latest request finishes; reverse-order replacement tests prove only the latest installs. |
| P2 | Exact `after` correspondence references still named the previous content. | Qualify both sides to the actual before/after identities and invert relations for Undo. No selection assignment is performed. |
| P2 | Determinism validation recursed forever on cycles, invoked accessors, lost valid null captures and bypassed capture validation via the separate argument. | Descriptor-based data inspection refuses cycles/accessors/non-data; structured cloning refuses proxies. Both capture paths are validated and detached; null is retained. Malformed input, planner exceptions and digest failures produce typed refusals without installation. |
| P2 | Content identity included allocation bookkeeping, and ID-keyed identity-map order leaked into canonical identity. | Order those maps and omit only `layout.identity.cursor` from the authored digest. Preserve full canonical bytes, including the cursor, for exact history/persistence. Tests distinguish authored assignment changes from cursor movement and reverse nested input key order. |
| P2 | The enduring coordinator had no preparation extension seam independent of the retiring local registry. | Supply an optional source-independent preparation provider while retaining common input capture, stale checks, admission, immutable installation and history. A synthetic non-current source exercises that seam, including stale refusal and Undo/Redo; it establishes no F2/unit capability. |

Behavioral regressions are in [f4-acceptance.test.ts](../../../../../apps/editor/tests/lib/authoring/f4-acceptance.test.ts),
[content-identity.test.ts](../../../../../apps/editor/tests/lib/project-model/content-identity.test.ts) and
[f4-current-source-admission.test.ts](../../../../../apps/editor/tests/lib/authoring/f4-current-source-admission.test.ts).
The fixes are in the [coordinator](../../../../../apps/editor/src/lib/authoring/f4/acceptance-coordinator.ts),
[history](../../../../../apps/editor/src/lib/authoring/f4/history.ts),
[F4 package modules](../../../../../packages/project-model/src/f4/index.ts) and
[content identity](../../../../../packages/project-model/src/content-identity.ts).

## Capability evidence — acceptance-invariants-v1

**Record status:** review-ready, not accepted. **Contract:** AM-4 on the existing F4 gate.
**Prerequisite:** `F1.reference@1:references-v1`, accepted at the trusted base.
**Source scope:** source-independent lifecycle; exercised with current-source and a synthetic
non-current source. No required lifecycle signature names `ProjectDocument` or an F2 encoding.

Shared exports include `AuthoringIntent`, `AcceptedSnapshot`, `AcceptanceResult`,
`AcceptanceSourceAdapter`, `prepareIntent` and `sameRevision` from `@portfolio/project-model`.
Editor-only exports are `createAcceptanceCoordinator` and `AuthoringHistory`; they never enter the
package barrel. The source-independent preparation option retains the same lifecycle for later
extensions instead of forcing consumers to implement another installer/history.

Conformance covers deterministic replay, immutable publication, one install/undo result per change,
fresh revision identity, out-of-order admission, stale/ABA and superseded-generation refusal,
replacement contention, typed failure rollback, exact mixed Layout/Scene restoration, redo
truncation and the fixed 100-state coordinator bound. Restoration reuses full admission against the current accepted baseline and cannot
advance a stale or refused cursor. A repair-mode Undo cannot reintroduce a blocking fold that the
currently accepted Layout has removed. Undo-to-identical-authored-contents restores its digest under a
fresh revision. No-op/refused work adds no history. Correspondence is data only.

## Capability evidence — local-single-domain-v1

**Record status:** review-ready, not accepted. **Contract:** AM-4 on the existing F4 gate.
**Prerequisite:** `acceptance-invariants-v1` on that gate. **Admitted source:** `current-source@5`,
the current wall-first Layout/world-local Scene document pair. This scope retires at T3.P01.S04;
the enduring lifecycle above does not.

Shared exports include `createPlannerRegistry`, `prepareIntent`, `admitCurrentSourceContent`,
`admitCurrentSource`, `createCurrentSourceAdapter`, `canonicalSourceJson`, `computeSourceContentId`
and `sourceContentIdForCanonicalJson`. The adapter runs the existing project validator with host
Scene options and the visitor's `prepareRuntime`, including canonical Layout compilation and Scene
resolution, and refuses newly introduced blocking issues relative to its baseline. It adds no
compiler, evaluator, source format or second identity implementation.

The conformance-scoped Layout transform goes through the retained canonical planner; the Scene
candidate changes a validated entity scalar. Tests cover full validation rollback, the host's
unknown-asset refusal despite option-less validation succeeding, new blocking geometry refusal and
baseline-relative admission. Actual candidate comparison protects unrelated domains, Camera and
resources. Compound/resource targets and compound/unit/resource planner registrations refuse.
Camera-bearing Scene bytes survive accept/Undo/Redo, and restored source passes the writer round trip.

The [public-isolation proof](../../../../../apps/editor/tests/lib/authoring/f4-public-isolation.test.ts)
walks the public route's real import graph, with nonempty controls reaching package F4 modules;
it reaches neither the editor coordinator nor history. The whole architecture lane also exercises
the repository's visitor/public, preview, package and authority boundaries. No route or host was edited.

## Verification

Environment: macOS arm64, Node `v26.7.0`, local development Postgres at
`localhost:5432/biskiq`. Required database-backed API tests executed with **zero skips**.
Commands below ran from the worktree root; `npm exec -w @portfolio/editor --` selects the editor
Vitest root without changing any case selection.

| Gate | Result |
| --- | --- |
| Focused `vitest run` over the three behavioral files above | 43 tests, 3 files passed before the final repair regression; the final full run includes all 44 behavioral cases; no `-t` narrowing |
| `npm run test:arch` | 140 tests, 16 files passed; includes F4 public isolation |
| `npm test -w @portfolio/editor -- --maxWorkers=2` | **1,644 tests, 123 files passed**, 31.21 s; complete suite including heavy and arch |
| `npm run check` | 0 errors, 0 warnings |
| `npm run check:layout-core`, `check:project-model`, `check:camera-core` | All passed |
| `npm run build` | Passed; existing large-chunk advisory only |
| `npm run check:api` and `npm run test:api` | Passed; **39 tests across seven API files, 0 failures, 0 skips** |
| `git diff --check bbff4f2005180748e99f2d6d63bbbd37faf3424c 5737f7c0d1f0e3894301800076b7cdb932d52abf` | Passed for the committed implementation range |

The initial complete run used default workers alongside build/API verification: 1,642 tests passed
and the unchanged F3 depth-5 exhaustive test exceeded its existing 5,000 ms timeout. The final full
run used two workers without a competing build and passed all 1,643 cases; after adding the repair regression, the final full run passed all 1,644 cases. No timeout, assertion,
fixture density, sweep or case selection was weakened. The explicit arch lane is rerun after this
review record and status reconciliation; it also validates the evidence links and gate state.

### Per-accept cost observation

The prior cost probe used many objects but no Wall geometry and bypassed the coordinator. The final
probe uses the retained **40-Wall all-curved** fixture (10 Rooms), plus 41 Layout objects and 240
Scene entities. A real proof planner produces a changed entity candidate; the probe captures the
exact input passed by the coordinator to the adapter. The full canonical source is 175,408 JSON
characters. Baseline boot is outside the measured operation, and separate validation/serialization/
digest probes run afterward on that same captured candidate.

Focused-run observation at the tested implementation: validation **1.8 ms**, serialization **1.8 ms**,
digest **1.4 ms**, admission **51.8 ms**, complete acceptance **57.3 ms**. These are observations,
not a benchmark guarantee or threshold. No permanent performance workflow was added.

## Final review and remaining obligations

Re-review covered the complete PR against the approved scope and AM-4, plus the corrective diff
against the original implementation. No substantiated in-scope defect remains open. The shared
modules stay runtime-safe, the coordinator/history stay editor-only, and no landed F1/F3 behavior,
Scene codec, host, route or other worktree was changed.

Production operations, Stage installation, Undo/Redo commands, replacement/selection wiring and
Camera-output rebase remain S04's work. Undo/Redo now return promises and callers must await typed
restoration outcomes. Future allocating planners must capture IDs and maintain their domain's
allocation high-water discipline; this slice ships no allocating production intent or host allocator.
Save, F2/unit/compound validation and resource staging retain their separately assigned ownership.
The synthetic extension test is not evidence of their readiness.

Formal owner acceptance/capability registration, routine closeout and merge remain pending by the
requested stop boundary. The full merge gate must be rerun against a changed `main` if peer slices
land before #129 is integrated. No current code, database or verification blocker remains.
