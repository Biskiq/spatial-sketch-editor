# T2.P02.S02 — Import, review, approve and place: implementation plan

**Slice:** T2.P02.S02 · **Status:** approved — owner-authorized and released 2026-10-23.
The [owner release](../../../../reference/decisions/post-batch-e-authorization-2026-10-23.md) authorizes this
post-S01 plan; implementation starts per the release list (`docs/roadmap/now.md`). Bounded T1 host/shell review and trusted-base gate checks remain required. **Phase:** [T2.P02](../README.md) ·
[register](../README.md#slice-register) · [runbook](../../../../operations/t2-composition/README.md) ·
[design](../shell-draft.md) · [coordination](../../../cross-track-execution.md#next-parallel-batch).

```text
CONSUMES: F1.reference@1, F2.unit-envelope@1, F4.intent-acceptance@1, T1.viewport-projection@1
REQUIRES: F1.reference@1:unit-resolution-v1, F2.unit-envelope@1:unit-envelope-v1, F4.intent-acceptance@1:unit-acceptance-v1, F4.intent-acceptance@1:conditional-save-units-v1, T1.viewport-projection@1:viewport-projection-v1
VERIFICATION: architecture-integration
INTEGRATION ROUTE: ../t2.p02.s03-integrated-final-gate/acceptance.md
```

## Starting boundary and outcome

S01 landed resources format 2, Scene format 3, owner-only staging/immutable approval and
same-project Save pin verification. It did not land import UI, worker preparation, model placement
or actual creator-model rendering. The current renderer uses a footprint fallback for creator IDs;
the Scene adapter admits native placement definitions, and its contact resolver handles primitives.
Build from those current seams rather than treating admission as a complete import journey.

The creator chooses one GLB, or one glTF plus its local buffers/maps, reviews observed content,
confirms scale/pivot/footprint, approves and places it in the same World Stage. It renders with its
maps, can be moved, turned, uniformly resized, duplicated and deleted in Plan and 3D, survives Save
and fresh reopen, and appears in isolated Preview. Two instances share one immutable resource
revision with independent entity identities. No publication or T4 dependency is introduced.

## Implementation sequence and file boundaries

1. **Library procedure and client.** Add T2-owned import procedure/session and API-client modules
   beside `apps/editor/src/lib/authoring/adapters/scene/`, using S01's declared-file staging,
   file upload, approval, cancel and immutable-content routes in `apps/api/src/app.ts` and
   `model-persistence.ts`. Review the [shell draft](../shell-draft.md) before build. Import is
   invoked through Library and Head Find, not a new permanent pointer tool. A bounded current-project
   approved-model entry permits another placement without re-import; this is not general library
   management. Keep source files, progress and reports in procedure/session state, never authored units.
2. **Lazy worker and retained evidence.** Load worker/ingest code only when Import opens. Validate
   glTF semantics and local-file closure before approval; reject missing files and unsupported
   required extensions in words. Never fetch arbitrary external dependencies. Load Draco, meshopt
   or KTX2 decoders only for sources needing them. Recipe `creator-import@1` preserves every node,
   empty and mesh (no leaf pruning, dedup, join or flatten), appends a pivot root, records source-to-
   derivative node correspondence, encodes geometry with meshopt and textures as WebP, and caps
   textures at 2048 px with reductions reported. Record original bytes/hash, recipe identity/version
   and report digest; distinguish observed parts/animations/variants from admitted whole-object use.
   Source set is at most 50 MiB and derivative at most 25 MiB. The browser creates the derivative;
   the API checks structure and pins rather than processing model bytes.
3. **Approve and resolve.** Show metric bounds, explicit source-unit scale, bottom-centre or bounds-
   centre pivot and a floor footprint/contact preview; never silently infer units. Freeze the approved
   definition and pins. Approval is outside authored history. Resolve its immutable derivative using
   the approved resource pin and S01's owner-only hash-keyed content route. Add runtime-safe resolved
   model input to `apps/editor/src/lib/museum/assets/AssetModel.svelte` and its callers, without
   teaching visitor code about editor sessions or importing authoring modules. Preserve catalogue
   behavior and the truthful generic fallback/error state. Account for source-unit scale and pivot
   exactly once; the approved footprint, contact, Plan projection and rendered bounds must agree.
4. **Atomic placement.** Extend `packages/project-model/src/scene-planning/` and the Scene adapter's
   placement-definition resolution. The single placement planner alone receives the required
   resources write grant under H0's per-planner scope; other Scene planners retain their own grants.
   First placement accepts resource definition, exact revision lock and entity together through F4.
   Undo removes that first accepted result atomically; Redo restores it. Later instances reuse the
   resource/lock and add distinct entity identities. Refusal changes none of them. Resolve metadata
   from the accepted same-envelope model resource, never a second mutable catalogue or per-instance
   Plan proxy. A new format or shared-interface need requires its owning amendment, not a silent field.
5. **Manipulation and rendering lifecycle.** Extend `authoring/adapters/scene/placement.ts`,
   `authoring/scene/plan-scene-footprint.ts`, Scene planners and candidate/render contributions to
   consume approved floor contact and footprint for place/move/yaw/uniform resize/duplicate/delete.
   Layout supplies floor support and is never mutated. Use the same Scene transform and acceptance
   path in both readings; catalogue contact verification stays excluded. Share immutable decoded
   assets where safe while keeping cloned instance identity/material state independent. Own fetches,
   aborts, temporary object URLs, worker lifetime, decoded cache references, textures and GPU disposal;
   releasing an instance must not dispose another instance's shared resource. Fresh reopen resolves
   pins again, not a stale session URL. Thread runtime-safe approved model resolution into Preview
   without creating a second renderer or weakening public/Preview boundaries. `/p` stays catalogue-only.
6. **Observe and revise.** Run the journeys and shell states below against the integrated tree;
   record browser observations and revise the feature before acceptance. Promote landed behavior to
   the owning assets, Scene-content and persistence contracts only when it lands.

## Write map

Paths are relative to the repository root and remeasured at the trusted base; new module names
are proposals the implementation may refine within the same owner and directory.

| Surface | Writer / review | Bounded work |
| --- | --- | --- |
| `apps/editor/src/lib/authoring/adapters/scene/import/**` (new: procedure, session, worker entry, ingest recipe) and a new model-import client under `apps/editor/src/lib/platform/` | T2 | Library procedure, lazy worker, `creator-import@1`, staging/upload/approve/cancel client over S01 routes |
| `apps/editor/src/lib/authoring/adapters/scene.adapter.ts`, `adapters/scene/{placement,candidate-ghost,support-occlusion}.ts`, `authoring/scene/{plan-scene-footprint,plan-scene-hit,object-definition-policy}.ts` | T2 | Resource-backed placement definitions, contact, Plan projection, manipulation |
| `packages/project-model/src/scene-planning/**` (`planners.ts` `SCENE_PLANNER_ADMISSION` per-planner resources grant, operations, support) | T2; T1.P02.S05 also edits `scene-planning/frame.ts` | Atomic resource + lock + entity placement; serialize with S05 per the [shared-file table](../../../cross-track-execution.md#shared-files-and-merge-protocol) |
| `packages/project-model/src/units/**` (resource staging in `units/planning.ts`, barrels) | T2 writes; T3 F2 review | Only what the resources grant needs; T3.P02.S02 also edits `units/planning.ts` — serialize per the shared-file table |
| `apps/editor/src/lib/museum/assets/AssetModel.svelte`, `apps/editor/src/lib/visitor/VisitorEntities.svelte` and the Preview threading | T2; T3 reviews Preview, visitor boundary checks unchanged | Runtime-safe approved-derivative resolution, fetch/cache/dispose |
| Stage host/Card/Find contribution extension (`apps/editor/src/lib/authoring/stage/**`, shell) | T1 writes or reviews a bounded T2 patch | Editable Card facts, Library/Head Find invocation; serialize with T3's host patch per the shared-file table |
| `apps/api/src/{app.ts,model-persistence.ts}`, `apps/api/migrations/` only if required | T2 during S02 | Only what the import journey needs; S01's immutable byte route is reused, not duplicated |
| Tests: `apps/editor/tests/lib/authoring/scene/**`, `tests/lib/project-model/{model-resource-admission,place-object-candidate,scene-operation-planners}.test.ts`, `tests/lib/visitor/**`, `apps/api/tests/model-resources.test.mjs`; perf: a new import/place flow under `apps/editor/perf/flows/` | T2 | Contract, lifecycle, boundary, DB-backed API and F5/F6/F13/first-load evidence |

**Dependencies.** Licensing is [undecided](../../../../reference/decisions/post-batch-e-authorization-2026-10-23.md#licensing-direction).
New runtime or dev packages (for example `@gltf-transform/*` in the browser, meshoptimizer, or
decoders beyond those three ships) are admitted only under a permissive licence (for example MIT,
BSD, ISC, Apache-2.0, Zlib), with each package, version and licence recorded in
[acceptance.md](./acceptance.md). A copyleft, source-available or unclear licence is a
stop-and-report to the owner, never a vendored workaround.

## Host contribution contract and coordination

Use the existing Stage adapter factory/services, `registerPlanner`, task/Find/instrument contributions,
Card subject/name/facts, pointer-intent, overlay/graphics/ghost and canonical selection paths. Import
contributes one task and editor-only view; task close, lens parking and disposal cancel or park its
session through the one host lifecycle. Resume revalidates project/epoch/source identity explicitly.
The domain adapter owns values, validation and intents; host chrome only renders and routes them.

The landed generic Card exposes read-only facts and a name writer, not all Round 2 numeric writers.
Before build, specify the smallest T1-reviewed contribution extension for editable Scene facts
(field identity/label/unit/value, live read-only state, commit/refusal and focus return), Library/Head
Find invocation, and any required runtime-safe model-render input. Numeric edits and rays submit the
same domain intents. This is a bounded consuming-slice integration patch, not a prerequisite to
rebuild the entire shell. T2 must stop and report any host/shell/route need to T1; no unilateral edits
there or new host state/selection/acceptance authority. Record the agreed file owner and merge order
before that patch is built. Unavailable domain operations receive no handle or writable field.

T2 owns Scene/resources closure, planners/adapters, Import and necessary API changes. Shared
`units/**` changes need T3's F2 review and serialized merging. F4 host changes need T3 review.
T1 owns Stage host/shell/spatial route and Layout. Work may run alongside T1 native Walls: no C1
prerequisite exists. H0 is merged and Preview is merged; recheck those facts and consumed gates at
this slice's own trusted base. Do not inherit another lane's unaccepted code or acceptance.

## Failure, race and access behavior

Use one import-session identity tied to project and host epoch. Cancel at choose/read/review/upload/
approve, task replacement, logout, project replacement and stale completion invalidate installation
and release owned work. An approval already committed on the server may remain an unused immutable
revision; it must not install into a different project or history. Cancel staging through the API
where still cancellable. Retry network failure within the same valid session without duplicate
placements or changed pins. Expired staging restarts honestly; access-triggered 24-hour cleanup is
current behavior, with no background worker promised here.

Keep selection while reviewing; approval alone changes no source/history/selection. Floor placement
selects the accepted entity. Invalid or stale placement refuses locally with no partial resource,
lock, entity or history entry. Source validation, API pin mismatch, missing bytes and decode failure
show distinct reasoned states; a fallback must not be reported as successful mapped-model rendering.

The whole procedure and placement have keyboard paths, visible labels/focus, progress announcements,
reachable Cancel and local refusal text. Card fields support units, finite-value validation and
explicit commit; blur never commits. During a ray gesture the field displays the live value without
becoming a second writer. Esc unwinds numeric entry/proposal/procedure deliberately; focus returns
to the invoking Library/Find control. Narrow desktop and reduced motion preserve reachable controls,
Stage context and explicit Preview return. No wireframe keymap is adopted by implication.

## Acceptance and evidence

Record criteria/results, tested revision/diff, commands, environment, viewport and reduced-motion
state in [acceptance.md](./acceptance.md). No result is claimed by this plan.

- Empty project and starter: import a mapped model, review observed/admitted report, explicitly
  confirm scale/pivot/footprint, approve and place; then move, turn, resize, duplicate, delete,
  Undo/Redo, Save and reopen in a fresh session. Verify both readings agree, floor contact survives
  resizing, two instances share immutable pins but independent identity, and Preview renders the
  actual mapped derivative. Preview is now merged; record this evidence here rather than defaulting
  it to S03. S03 rechecks integration.
- Worker/contract fixtures prove node/empty/mesh correspondence and no destructive pruning, conditional
  decoder use, texture reductions, source retention, source-unit/pivot application and approved
  footprint/contact agreement. Include Draco/meshopt/KTX2 inputs and truthful observed-but-not-admitted
  part/animation/variant reports; qualified references keep `componentId: null`.
- Oversize source/derivative, malformed input, absent local dependencies, unsupported required
  extensions, expired/cancelled staging, API failure, stale approval/project replacement, changed pin
  and decode failure install no partial source. Exercise late completion after cancellation and
  replacement, retries, first-placement Undo/Redo and shared-resource instance deletion.
- Browser observations cover ordinary selection/rest, near-bound file, cancel at each step,
  offline approval/retry, keyboard-only procedure and transforms, local refusal, narrow desktop,
  reduced motion, lens park/revalidated Resume and Preview exit. Apply Round 2 shell acceptance,
  including Card facts and rays/points, not pixel equivalence to a prototype.

**Correctness:** architecture-integration evidence includes complete affected Scene planning,
resource/lock closure, current-format admission, Plan projection/contact, model-render lifecycle,
Stage adapter and visitor/Preview isolation contracts plus package/editor checks. Any API edits
require `check:api` and reachable-Postgres `test:api` with zero skips and the DB target recorded.
Use an isolated per-lane database (or Compose stack) so parallel lanes never share or reset each
other's data. Use [the test manual](../../../../../apps/editor/tests/README.md) for exact lanes/commands. The
implementation-PR merge gate remains complete on then-current main: full editor suite, unconditional
arch, heavy correctness, root check/build, affected shared-package checks and API check/DB-backed
suite with zero skips. Rebase and rerun before a later merge; narrowed slice tier never narrows this
merge contract. S03 remains the exhaustive integrated final gate.

**Performance before acceptance:** on the owner's MacBook Air M2 / 16 GB, record F5 admission long
tasks, worker time, peak heap, GPU-memory delta and chosen → placed; F6 placement at S/M; the hard
GPU-memory row at M; F13 repeated import/place/delete including shared-instance disposal; and Stage
first-load/bundle delta proving Import/decoders stay lazy. Use H0's workflow and the
[performance contract](../../../../reference/components/performance.md), recording fixture, revision,
environment and unrun rows. Resolve hard misses within S02; give target misses a written disposition.
S03 rechecks F5/F6/GPU/F9/F13/first-load and cannot erase an earlier hard miss.

## Exclusions and owner decisions

No parts/component admission, clips, variants, re-import correspondence, multiple models per import,
formats beyond glTF/GLB, catalogue contact qualification, attachment, provider search, general library
scope, project deletion, publication or T4 release closure. Project-deletion implementation belongs
to T3's proposed C3 lifecycle work; S03 verifies retention/pin integrity without adding deletion.

The owner release covers this plan and the reconciled [shell draft](../shell-draft.md) as S02's
design destination. T1's review of the bounded host extension is a start condition for that host
patch only, not for the T2-owned domain work. Any design departure or new shared-interface
requirement is reported to its owner.
