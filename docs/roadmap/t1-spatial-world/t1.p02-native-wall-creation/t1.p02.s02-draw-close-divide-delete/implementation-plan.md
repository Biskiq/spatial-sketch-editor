# T1.P02.S02 — Draw, close, divide and delete: implementation plan

**Slice:** T1.P02.S02 · **Status:** proposed — not authorized or released ·
**Phase:** [T1.P02](../README.md#slice-register) · **Track:** [T1](../../README.md) ·
**Runbook:** [T1 operations](../../../../operations/t1-spatial-world/README.md) ·
**Design:** [shell draft](../shell-draft.md#draw-s02) · **Acceptance:** [record](./acceptance.md)

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t1.p02.s04-integrated-final-gate/acceptance.md
```

## Outcome and readiness

A creator draws a straight Wall chain, deliberately joins existing topology, closes an
enclosure, divides a Room and deletes a Wall through the shared Stage and F4 acceptance.
Plan and 3D read the same candidate; numeric and keyboard paths have the same semantics.
The phase's [owner-accepted drawing policy](../README.md#drawing-and-enclosure-policy-owner-accepted-2026-10-22)
owns enclosure, connection and refusal rules; this plan does not reopen them.

S01 is shipped. **S05 retirement must be accepted and merged before S02 starts.** Recheck
its merged tree, H0 `T3.P03.S01`, consumed gates and active scopes through the runbook.
This complete proposed plan still needs review, its own owner authorization and release-list
entry; neither registration nor Round 2 ratification releases production implementation.

The bounded shell allocation proposed here is S02's original shared-shell scope: dock
Select/Ink, their contribution seam, Card/lower-column arbitration and moving ordinary Layout
facts into the Card. Review that allocation with T3 for shared Head/F4 changes before build.
It does not include every Round 2 tool, a new Index model or a general shell rebuild.
The [shell draft](../shell-draft.md) defines the explicit current-to-target cutover and
remaining feature decisions. A requested expansion needs owner scope/release, not an implicit
interpretation of the ratified prototype.

## Owning paths and operation boundary

- `packages/layout-core/src/layout-wall-chain.ts` and existing topology/noding/deletion
  planners remain the semantic authority. Add bounded policy refusals there where needed;
  no shell geometry reconstruction or second compiler. Preserve one working datum.
- `apps/editor/src/lib/authoring/adapters/layout.adapter.ts` and its `layout/` modules own
  planner registration, captured requests, proposal/gesture lifecycle and Layout fields.
  Extract a focused drawing adapter beside them instead of growing the precision UI into
  a second authoring session. Reuse `precision.ts`, `wall-gesture.ts`, `paused-proposal.ts`
  and `adapter-support.ts` where their owned responsibilities apply.
- `apps/editor/src/lib/authoring/stage/` owns input, semantic selection, contribution
  aggregation, session lifetime and admission/install. Its `shell/` components host the
  dock/palette, Card and bounded Instrument composition. T3 reviews shared F4 or Head
  edits; T2/T3 review contribution compatibility. Domain writers stay in their adapters.
- Core, adapter, Stage/selection, F4 and shell regressions live under `apps/editor/tests/`;
  keep kernel math assertions in kernel families and actual caller wiring in adapter/host
  contracts. Visitor/public imports contain no new authoring machinery.

## Implementation sequence

1. **Rebase inventory and baseline.** Inspect the accepted post-S05 compiler/planner,
   identity capture, Stage input/selection, F4 scope enforcement and existing task/gesture
   contributions. Record exact trusted base and affected tests. Confirm no legacy Layout
   import remains and capture comparable S/M compile/commit/Undo and Stage-load observations
   through the ratified [performance contract](../../../../reference/components/performance.md).
2. **Remove repeated work before adding hot-path load.** Reuse validated compiled candidate
   output at install and Undo/Redo admission only where revision/content identity proves it
   is the same result; invalidation must cover replacement, new revision and changed inputs.
   Keep immutable accepted source and derived/cache/session state separate. Prove full
   output equivalence with a heavy-lane differential and deterministic compile-count oracle
   across ordinary edit, refusal, Undo/Redo and replacement. Never accept stale geometry to
   achieve a timing target.
3. **Register bounded F4 operations.** Define one captured chain-commit intent and one
   Wall-delete intent, using current F1 references, explicit working level and the S01
   operation capture for every created Wall/Junction/Room identity. Preview and final
   acceptance use the same immutable input/capture; cancel consumes no authored state and
   replay never remints IDs from occupancy. Register exact per-planner Layout scope under
   H0 enforcement, reject stale references/levels and keep source writes inside F4.
   Chain/segment creation, split/crossing/subdivision and first-enclosure work compose
   inside the canonical planners. Do not expose an uncaptured standalone noding allocator
   as an accepted intent: thread the operation capture through any newly wired path.
4. **Implement the chain state machine.** Idle/armed → start → editable chain → finishing
   proposal → accepted, with explicit cancel/refusal and stale-context paths. Stage hits
   distinguish an existing Junction, explicit Wall-interior split and a free point;
   proximity alone never connects. Junctions are selectable references with generation
   requalification. Starting from a selected Junction/Wall end or a typed coordinate uses
   the same planner path. Each next point may be typed; live length/angle marks use the
   shared exact parser and one coordinate convention. Add the finish action to Stage input;
   proposed key bindings are reviewed for conflicts rather than copied from the prototype.
5. **Finish and unwind.** Close by selecting the start Junction, finish an open chain with
   the finish action, or finish on a deliberate existing host. Show planner-derived
   enclosure/division/free-standing consequence before the finishing gesture. Accept the
   entire chain once and select the last created Wall; Ink remains armed. Backtrack changes
   the live chain, cancellation discards it, and a refused finish keeps it editable with
   repair words and no partial source. Follow Round 2 Esc palette-first behavior without
   leaving a hidden proposal: the next unwind cancels the live chain before tool disarm.
   Generalize Undo/Redo blocking from named gesture owners to the active proposal/lease
   contract; retain its reason until finish/cancel. Replacement, reading change, disposal
   and stale completion cancel or revalidate through the existing session policy.
6. **Delete with consequences.** Wall deletion in the Card's scoped action and keyboard
   path names affected Openings and Room merge/open consequences before acceptance.
   One accepted operation deletes hosted Openings and reconciles topology; it does not
   retarget Camera/Experience IDs. Derive diagnostics on retained deleted references.
   Refuse unsupported geometry/references without a partial delete. Do not add Opening
   creation or an independently editable Junction operation.
7. **Build the bounded Round 2 shell cutover.** Implement the reviewed
   [dock/Card composition](../shell-draft.md#bounded-s02-cutover), retaining adapter-owned
   operations and canonical selection. Move live ordinary Layout Wall/Opening precision
   fields from Dimensions into Card facts; remove their former writer/task at that cutover,
   including keyboard/Find routes. Keep their existing validation and undo granularity.
   Library/Guide/repair-style tasks keep one invoked Instrument above the palette; audit
   each existing contribution for an explicit compatible home so no task disappears or is
   duplicated. Do not implement absent tools to fill the dock. Preserve current Scene and
   Experience task behavior through adapter contributions and review any necessary mapping
   with their owners. Field ownership outside Layout is not silently migrated here.
8. **Observe and revise.** Run the browser journeys below against recorded revision,
   viewport, reading and motion preference using browser hygiene. Revise shell composition
   in the same slice. If fitting existing contributors requires a general shell or foreign
   domain rewrite, stop and report the boundary; do not broaden the slice without release.

## Acceptance and verification

| Concern | Required proof |
| --- | --- |
| Creator path | Empty and starter: free Wall → deliberate join → enclosure → division → deletion; Plan/3D agree at each step; one Undo/Redo per accepted chain/delete and Save/reload preserve identities |
| Policy refusal | Crossing without Junction, collinear overlap, disconnected nested ring, stale level/reference and invalid numeric input refuse with repair text and zero partial source; chain stays editable |
| Identity/call-site | Delete/recreate, Undo then different edit, Redo and reload/edit do not reuse IDs; actual registered planners receive capture/level and cannot escape F4 Layout scope |
| Session/input | Junction selection requalifies; pointer and typed coordinates agree; finish/backtrack/cancel, palette-first Esc, tool switch, reading change, replacement and disposal leave no hidden proposal or stale completion |
| Deletion | Hosted Openings disappear in the same undo step; Room survivor/reconciliation policy holds; Camera/Experience keep deleted IDs with derived diagnostics and no retarget |
| Shell | Select/Ink and contributions work with nothing selected; Card fields are the sole migrated Layout writers; no duplicate Dimensions path; lower column/Card do not overlap or move Camera; retained tasks remain reachable |
| Boundaries | Single compiler, one selection/session, visitor/public isolation, no editor helper in visitor chunks and all retained kernel invariants stay green |

Use focused whole-contract tests during iteration; add meaningful caller-level and policy
regressions, not tests that merely mirror a helper. Architecture-integration evidence routes
to S04; **every implementation-PR merge still runs the full required gate** from
[tests/README](../../../../../apps/editor/tests/README.md#what-a-change-requires): root
check/build, affected package checks, fast/heavy/full editor suite and unconditional arch,
API check and DB-backed API tests with zero skips when touching its contracts. Shared
Layout/project-model admission and Save are part of this slice's impact and must be verified;
record the API DB target without credentials. Root checks never substitute for the API.

Browser evidence includes empty/starter draw/close/divide/delete in 2D and 3D, keyboard-only,
invalid numeric entry, narrow and short shells, reduced motion, Card precision, active
Library/Guide arbitration where present and unsaved project replacement. Record revision,
viewport and observed outcome; do not label a plan or prototype screenshot as a passed journey.

## Performance acceptance and escalation

On the designated MacBook Air M2, 16 GB, record comparable workload/revision/environment for:
F3 input-to-matching-preview, latest-input age, final-preview completion, frames and long tasks;
per-move evaluation; F4 commit and F8 Undo/Redo at S/M; F2 open, F13 leak cycles and Stage
first-load delta. Use the performance contract's harness/workloads and budgets, not guessed
local thresholds. Correctness/compile-count green does not prove latency acceptance.

If F3 misses at M after deduplication, run the bounded incremental or worker experiment
inside the same compiler/evaluator authority and preserve the full differential oracle.
If that still misses at L, changing “preview equals planner output” is an owner decision;
report the measurement and stop that semantic expansion. S04 cannot erase an S02 budget miss.
S01's **still-unrun F2 open timings at S/M** remain separately assigned to S04 against H0's
baseline; nothing here treats them as measured or globally waived.

Record M4 as re-armed at closeout because Junction commits are rewired. This configures no
new architecture window and records no owner architecture verdict. S04 remains the final
gate; a passed slice does not close the phase.

## Exclusions and decisions before build

No Opening creation family (S03), curves/circles, levels, structures, datums, overheads,
attachments, face-frame provider or new compound cross-domain operation. Ink exposes only
the straight-Wall reading the domain supports, with no unsupported Shape/roof/round options.
The existing one-datum working-level check is not levels support.

Before build, review the bounded shared-shell allocation, exact Ink naming/palette and
key bindings, the Card migration fields and contributor home mapping. These feature choices
must conform to Round 2 and the accepted phase policy; departures or scope expansion return
to the owner. Authorization/release and any later performance-semantics ruling stay owner-only.
