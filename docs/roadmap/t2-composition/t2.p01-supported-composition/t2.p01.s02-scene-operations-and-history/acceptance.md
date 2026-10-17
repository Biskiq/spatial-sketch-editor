# T2.P01.S02 — acceptance record: Scene operations and shared history

**Slice:** T2.P01.S02 · **Status:** implemented at `d38594b3`, awaiting independent review — no
acceptance recorded
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Phase:** [T2.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

`T2.P01.S02` is owner-authorized ([record](../../../../reference/decisions/s02-pair-authorization-2026-10-16.md)),
implemented on branch `T2-P01-S02` cut from `main` `74367936` (PR #132 merged), and verified below.
It has **not** been independently reviewed or accepted. Nothing on this page claims acceptance,
readiness for merge, a phase result or a gate state, and no production host registers these
planners yet.

## Delivered

- **Seven Scene planners** in `packages/project-model/src/scene-planning/`, one per operation
  (`place-object`, `move-horizontal`, `set-yaw`, `place-on-floor`, `resize-on-floor`,
  `duplicate-one`, `delete-one`), each admitting domain `scene` only with `compound`, `units` and
  `resources` false. `createScenePlanners` returns them for registration with the landed F.4
  coordinator; the slice adds no history, installer, adapter variant or second validation pass.
- **Captured intent reader** (`intent-payload.ts`): strict payload/target/allocation reading.
  Unknown keys, non-finite numbers, a target naming another entity, a non-exact revision or a
  non-canonical Scene location refuse with a path and code; a captured id that already exists
  refuses and is never renamed.
- **Snapshot-qualified support** (`support.ts`): support is re-derived from the snapshot's own
  canonical Layout compile through the landed `layout-core` floor-support query. The generation is
  `scene-support@<sourceContentId>`; a captured choice from another generation refuses, a missing
  required resting elevation refuses, and more than one eligible context asks the creator. Nothing
  raycasts a mesh or picks an elevation.
- **Record-scope guard** (`record-scope.ts`): every candidate returns through one finalizer that
  compares the entity id sequence, per-field ownership on the targeted entity, every untargeted
  entity and cluster exactly, cluster order, and only the delete cleanup (membership loss plus a
  below-minimum cluster drop). A planner that overreaches is refused, never normalized.
- **Conformance** in two files: the pure planner/guard suite and the acceptance suite that drives
  the real coordinator with T1.P01.S03's test-only conformance Layout planner.

No F4 capability, no production Layout operation and no editor policy import is added to the
package; the normalized-definition policy is injected.

## Verification at `d38594b3` (2026-10-16)

Run from the slice worktree: the code under test is commit `d38594b3`, and the only working-tree
change on top of it is this record and the baton/register text committed with it (the documentation
link checks ran against that text):

| Gate | Command | Result |
| --- | --- | --- |
| Fast lane | `npm run test:fast` | 112 files / 1,586 tests pass |
| Architecture lane | `npm run test:arch` | 17 files / 148 tests pass |
| Heavy lane | `npm run test:heavy` | 8 files / 118 tests pass |
| Complete suite | `npm run test:full -- --maxWorkers=2` | 137 files / 1,852 tests pass, zero skips |
| Editor check | `npm run check` | 0 errors, 0 warnings |
| Package check | `npm run check:project-model` | `tsc --noEmit` clean |
| Production build | `npm run build` | passes |

Focused contracts, each run whole:

- `tests/lib/project-model/scene-operation-planners.test.ts` — 25 tests.
- `tests/lib/authoring/scene-operation-acceptance.test.ts` — 7 tests.

**One pre-existing concurrency flake, left unchanged.** `tests/lib/project-model/camera-output-conformance.test.ts`
("holds every invariant over all action sequences up to depth 5", a bounded exhaustive traversal)
exceeded vitest's 5 s default in an unrestricted concurrent lane (7.2 s and 16.2 s on two runs)
while passing alone in 2.4–2.6 s. It reproduces on unmodified `main` `74367936` in this environment
(two failed unrestricted runs, one pass), so it is not caused by this slice and its test, assertions
and timeout are untouched. The final complete-suite gate below was run at `--maxWorkers=2`, the
practice S01 recorded for the same default-budget contracts; the unrestricted lane's result is
recorded exactly as observed rather than presented as green.

## Criteria → evidence

| Plan criterion | Evidence |
| --- | --- |
| Deterministic replay; Redo restores captured ids without planning | planner suite "prepares identical candidates from identical captured inputs and never mutates the source"; acceptance suite counts `prepare()` calls across Undo/Redo |
| One accepted edit → one undo result; a new edit truncates redo | acceptance "installs one placement once…" and "truncates redo when a new Scene edit follows an undo" |
| Chronological Undo across domains (L1→S1→L2) on one stack | acceptance "undoes chronologically across Layout and Scene through one stack (L1→S1→L2)" |
| No-op, invalid, stale and refused requests write nothing | acceptance "writes nothing for a no-op, a refused operation or a stale request"; planner suite covers `no_op`, `missing-target`, `stale-revision`, stale generation |
| Stale and previous-epoch results cannot install | this suite covers the stale-revision path; epoch cancellation is the landed coordinator contract (`f4-acceptance.test.ts`, T1-owned, run in the same suite) |
| Camera-bearing Scene bytes unchanged | acceptance "keeps Camera-bearing bytes identical through every accepted operation"; the T1 adapter guard still runs inside every admission |
| Untargeted rewrite admitted by the adapter is refused by T2's guard | acceptance "refuses a mutation-control candidate the adapter admits, through the T2 record-scope guard" (entity, cluster and field variants) |
| Support refusals: no-support, choice no longer yielded, duplicate without support; query order independent | planner suite "support and refusals" and "snapshot-qualified support selection" |
| Delete cleans membership and empty clusters atomically, exact correspondence | planner suite delete case; acceptance Undo restores the exact prior snapshot |
| Direct-caller bypass fails | the layout of the landed contracts is unchanged: the coordinator is the only accepted writer (`f4-acceptance.test.ts` bypass test, T1-owned) and this slice adds no install path |
| Public-route isolation; no editor policy in a package barrel | `f4-public-isolation.test.ts` (arch lane) still reaches the package's F.4 modules and no editor authoring module; `scene-planning/` imports no editor, Svelte or Three module |

## Not claimed

No independent review, acceptance, closeout, merge or phase closure. The merged gate for this
implementation PR still requires the complete verification contract against then-current `main`,
including the DB-backed API suites this slice does not touch. Browser journeys and manual rows are
not required at this slice's declared `architecture-integration` tier and none were performed; the
integration route remains [T2.P01.S04](../t2.p01.s04-bounded-composition-loop/implementation-plan.md).

## Entry points

Implementation: `packages/project-model/src/scene-planning/{support,record-scope,operations,intent-payload,planners}.ts`.
Regressions: `apps/editor/tests/lib/project-model/scene-operation-planners.test.ts`,
`apps/editor/tests/lib/authoring/scene-operation-acceptance.test.ts`.

## Residuals

- Live host registration, viewport compile-generation mapping and the editing surface stay with
  `T2.P01.S03`; integration and phase acceptance stay with `T2.P01.S04`.
- A model entity's contact height is trusted from the captured intent (S01's verified-metadata
  rule); a primitive's contact is checked analytically against its dimensions.
- `duplicate-one` offsets in world X/Z only and refuses cluster members and set duplication with a
  reason, as the plan requires; there is no silent re-grounding.
