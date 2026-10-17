# T2.P01.S02 — acceptance record: Scene operations and shared history

**Slice:** T2.P01.S02 · **Status:** implemented; reviewed at `af39acd1`; two follow-up findings
repaired at `62d4d5b0` and **independent re-review of that revision is pending** — acceptance is not
claimed, and owner acceptance, closeout and merge remain separate events
**Plan:** [implementation-plan.md](./implementation-plan.md) — owns this slice's acceptance criteria
**Review:** [independent-review.md](./independent-review.md) — three adversarial rounds, repairs and verdicts
**Phase:** [T2.P01](../README.md) · **Register:** [phase slice register](../README.md#slice-register)

`T2.P01.S02` is owner-authorized ([record](../../../../reference/decisions/s02-pair-authorization-2026-10-16.md)),
implemented on branch `T2-P01-S02` cut from `main` `74367936` (PR #132 merged), and reviewed in
three rounds whose findings are repaired and re-verified. This page records what was built, what
was run at which revision, and what remains outside the slice. It does not claim owner acceptance,
closeout, merge or a phase result, and no production host registers these planners yet. The
round-3 repairs at `62d4d5b0` are not yet independently re-reviewed, so the acceptance this page
described at `af39acd1` is withdrawn until they are.

## Delivered

- **Seven Scene planners** in `packages/project-model/src/scene-planning/`, one per operation
  (`place-object`, `move-horizontal`, `set-yaw`, `place-on-floor`, `resize-on-floor`,
  `duplicate-one`, `delete-one`), each admitting domain `scene` only with `compound`, `units` and
  `resources` false. `createScenePlanners` returns them for registration with the landed F.4
  coordinator; the slice adds no history, installer, adapter variant or second validation pass.
- **Strict captured-intent reader** (`intent-payload.ts`): unknown keys, non-finite numbers, a
  target naming another entity, a non-exact revision, a non-canonical Scene location, a mismatched
  support-choice variant or an unexpected allocation all refuse with a path and code. Collected
  reader issues are a refusal even when the reader could still return a value, so nothing is
  silently ignored. A captured id that already exists refuses and is never renamed.
- **Snapshot-qualified support** (`support.ts`): support is re-derived from the snapshot's own
  canonical Layout compile through the landed `layout-core` floor-support query. The generation is
  `scene-support@<sourceContentId>`; a captured choice from another generation refuses, a missing
  required resting elevation refuses, and an ambiguous or no-longer-yielded choice discloses only
  the contexts the operation could use — or refuses `no-support` when none exists. Nothing
  raycasts a mesh or picks an elevation.
- **Record-scope guard** (`record-scope.ts`): every candidate returns through one finalizer that
  compares the entity id sequence, per-field ownership on the targeted entity, every untargeted
  entity and cluster exactly, cluster order, and only the delete cleanup (membership loss plus a
  below-minimum cluster drop). Carried Scene fields and cluster fields are derived from the
  documents rather than listed by hand, so a field added to the format is protected when it lands.
  A planner that overreaches is refused, never normalized.
- **Honest poses.** Move preserves Y, rotation, scale, dimensions and material sharing; yaw owns
  only the `rotation[1]` component (sub-tolerance pitch/roll are preserved, an equivalent stored
  angle is not rewritten into a different representation, and the guard grants that one component
  so a pitch or roll rewrite is refused); resize owns uniform scale and the compensating Y;
  duplicate is exactly +0.5 m world X/Z; delete is exact removal with atomic cleanup.
- **Frames are only used when they can be verified.** `project-world` is the identity conversion
  and is checked; an `owner-frame` needs its owner's resolver, which a pure planner is not given,
  so it refuses `unsupported-frame` rather than trusting a caller-supplied origin and yaw.
- **Conformance** in two files: the pure planner/guard suite and the acceptance suite that drives
  the real coordinator with T1.P01.S03's test-only conformance Layout planner.

No F4 capability, no production Layout operation and no editor policy import is added to the
package; the normalized-definition policy is injected.

## Independent review

Three adversarial rounds ran against distinct risk axes: planner semantics, guard soundness,
support/intent boundaries, evidence strength, and — in the third round — the two findings raised
against the pushed head. The first two rounds found four substantive defects and one evidence
defect, all repaired and re-verified:

1. recorded reader issues were discarded on the success path, so an unknown payload key or a
   mismatched support-choice variant installed (`9818c329`);
2. a captured choice the snapshot no longer yielded disclosed ineligible candidates (`9818c329`);
3. the guard compared a hand-maintained Scene field list, leaving a future field unprotected
   (`9818c329`, completed for clusters at `bd7178eb`);
4. yaw operations zeroed sub-tolerance pitch/roll they do not own (`9818c329`);   5. the recorded complete-suite command never forwarded `--maxWorkers=2` to vitest, so the gate
   described was not the gate that ran; the command is corrected below and was re-run.

Evidence gaps were also closed: every operation now replays to an identical candidate, delete is
undone to the exact prior snapshot, duplicate refusals and captured-input defects assert their
codes, guard cases assert the violating path, a legitimate captured choice has a positive case, and
a yaw-equivalent edit reports `no_op`. The reviewer verdict at `af39acd1` was in
[independent-review.md](./independent-review.md): no substantiated defect remained in that scope.

That verdict did not survive the third round. Two follow-up findings were reproduced and are
substantive, both repaired at `62d4d5b0`:

6. **An owner-qualified frame was trusted, not resolved.** A structurally valid `owner-frame`
   reference (owner, frame id, revision) was accepted with whatever `origin`/`yaw` came with it —
   no frame lookup, no placement, no revision match — and all four frame-carrying operations would
   plan from that unverified transform. The intent reader now refuses it as `unsupported-frame`,
   keeping `invalid-value` for a malformed reference and admitting the identity frame.
7. **The guard granted a whole `rotation` field to a yaw edit.** The scope vocabulary was
   field-level, so a planner that rewrote pitch or roll would have been admitted as "rotation
   changed". A grant may now name one component (`rotation[1]`); the unnamed components stay inside
   the exact comparison, and both yaw-owning planners grant exactly that component.

Both repairs carry tests that fail on the earlier code, confirmed by mutation: reverting the reader
fails the four-operation owner-frame refusal, and reverting the guard to component-blind grants
fails the pitch/roll case while a yaw-only change stays admitted. Because the repairs were
authored by the same coordinator that ran the review, **independent re-review of `62d4d5b0` is
required before acceptance is claimed again**.

## Verification at `62d4d5b0` (2026-10-16)

Run from the slice worktree with the round-3 repairs applied and a clean tree. The earlier round
(`af39acd1`) recorded the same gates at 112/1,594, 17/148, 8/118 and 137/1,860; the counts below
are this revision's.

| Gate | Command | Result |
| --- | --- | --- |
| Fast lane | `npm run test:fast` | 112 files / 1,596 tests pass |
| Architecture lane | `npm run test:arch` | 17 files / 148 tests pass |
| Heavy lane | `npm run test:heavy` | 8 files / 118 tests pass |
| Complete suite | `npm run test:full -w @portfolio/editor -- --maxWorkers=2` | 137 files / 1,862 tests pass |
| Editor check | `npm run check` | 0 errors, 0 warnings |
| Package check | `npm run check:project-model` | `tsc --noEmit` clean |
| Production build | `npm run build` | passes |

Focused contracts, each run whole:

- `tests/lib/project-model/scene-operation-planners.test.ts` — 33 tests (31 before round 3).
- `tests/lib/authoring/scene-operation-acceptance.test.ts` — 9 tests.

Mutation check for the two new tests: accepting owner-frames again fails the refusal test, and
reverting `omitGrants` to component-blind deletion fails the pitch/roll guard case; both pass with
the repairs in place.

**Gate-capacity note.** The F.3 bounded exhaustive Camera sweep ("holds every invariant over all
action sequences up to depth 5") is a ~2.5 s traversal alone, but it exceeds vitest's 5 s default
when the fast lane starves it; two runs failed that way on unmodified `main` `74367936` in this
environment, so it is not caused by this slice. At `af39acd1` it declares a 30 s budget, matching
the repository's convention for bounded sweeps (`f4-acceptance`, `layout-scale-compile`,
`angled-plan-noding-sweeps`); the traversal and its assertion are unchanged. The complete suite is
additionally run at `--maxWorkers=2`, and the recorded form is the one that actually forwards the
flag to vitest.

## Criteria → evidence

| Plan criterion | Evidence |
| --- | --- |
| Deterministic replay; Redo restores captured ids without planning | planner suite "replays every operation to an identical candidate and never mutates the source" (all seven, membership pinned); acceptance suite counts `prepare()` calls across Undo/Redo |
| One accepted edit → one undo result; a new edit truncates redo | acceptance "installs one placement once…" and "truncates redo when a new Scene edit follows an undo" |
| Chronological Undo across domains (L1→S1→L2) on one stack | acceptance "undoes chronologically across Layout and Scene through one stack (L1→S1→L2)" |
| No-op, invalid, stale and refused requests write nothing | acceptance "writes nothing for a no-op, a refused operation or a stale request"; planner suite covers `no_op`, `missing-target`, `stale-revision`, stale generation, unknown keys and a yaw-equivalent edit |
| Stale and previous-epoch results cannot install | this suite covers the stale-revision path; epoch cancellation is the landed coordinator contract (`f4-acceptance.test.ts`, T1-owned, run in the same suite) |
| Camera-bearing Scene bytes unchanged | acceptance "keeps Camera-bearing bytes identical through every accepted operation"; the T1 adapter guard still runs inside every admission |
| Untargeted rewrite admitted by the adapter is refused by T2's guard | acceptance "refuses a mutation-control candidate the adapter admits…" (entity, cluster and field variants); planner suite pins the violating path for entity, cluster, ownership and future-field cases |
| Only verifiable frames are used; an unresolvable one refuses | planner suite "refuses an owner-qualified frame instead of trusting an unverified conversion": all four frame-carrying operations refuse `unsupported-frame`, a malformed reference stays `invalid-value`, and the identity frame still prepares |
| A yaw edit cannot rewrite the components it does not own | planner suite "admits a yaw change but refuses one that rewrites the pitch or roll it does not own" using the shared `YAW_SCOPE_FIELD` grant; the same test shows a whole-field grant would have admitted it |
| Support refusals: no-support, choice no longer yielded, duplicate without support; query order independent | planner suite "support and refusals" and "snapshot-qualified support selection", including the resolving-choice positive case and the eligible-only disclosure |
| Delete cleans membership and empty clusters atomically, exact correspondence | planner suite delete case; acceptance "undoes a delete to the exact prior snapshot, restoring its cluster cleanup" (bytes, content id and restored cluster, then Redo) |
| Direct-caller bypass fails | acceptance "installs nothing when a caller writes and admits a Scene document directly": a directly admitted document leaves the accepted source, revision, history and install count untouched, so there is no shared store to write through. The test does not call a second install API — none exists on the coordinator |
| Public-route isolation; no editor policy in a package barrel | `f4-public-isolation.test.ts` (arch lane) still reaches the package's F.4 modules and no editor authoring module; `scene-planning/` imports no editor, Svelte or Three module |

## Not claimed

No implementation acceptance at `62d4d5b0` until it is independently re-reviewed. No owner
acceptance, closeout, merge or phase closure. The merged gate for this implementation PR
still requires the complete verification contract against then-current `main`, including the
DB-backed API suites this slice does not touch. Browser journeys and manual rows are not required at
this slice's declared `architecture-integration` tier and none were performed; the integration route
remains [T2.P01.S04](../t2.p01.s04-bounded-composition-loop/implementation-plan.md).

## Entry points

Implementation: `packages/project-model/src/scene-planning/{support,record-scope,operations,intent-payload,planners}.ts`.
Regressions: `apps/editor/tests/lib/project-model/scene-operation-planners.test.ts`,
`apps/editor/tests/lib/authoring/scene-operation-acceptance.test.ts`.

## Residuals

- Live host registration, viewport compile-generation mapping and the editing surface stay with
  `T2.P01.S03`; integration and phase acceptance stay with `T2.P01.S04`.
- A model entity's contact height is trusted from the captured intent (S01's verified-metadata
  rule); a primitive's contact is checked analytically against its dimensions within `1e-9 m`.
- The primitive contact formula exists both here and in S01's editor object-definition policy; the
  two owners should converge on one source before either changes.
- A yaw difference below `1e-9 rad` is absorbed as `no_op` by construction, consistent with the
  upright tolerance.
- There is no frame resolver in this slice, so an `owner-frame` intent has no admitted use: it
  refuses `unsupported-frame`. Admitting one requires the owning domain's resolver and a check that
  the captured conversion matches the resolved placement; until then, local frame input is only
  the identity.
- S01's `preparePlaceObjectCandidate` still documents its `frameReference` as host-resolved and its
  own suite pins an owner-frame acceptance. S02's planners cannot reach it with an owner frame, but
  that builder seam closes when a real frame resolver is admitted, not here.
- `duplicate-one` offsets in world X/Z only and refuses cluster members and set duplication with a
  reason, as the plan requires; there is no silent re-grounding.
