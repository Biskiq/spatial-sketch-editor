# Historical batch coordination — October 2026

Archived 2026-10-23 from `main` `93ec96cadb752dd1c24bdea3b97570763d77948b`.
The complete pre-consolidation file is recoverable with
`git show 93ec96cadb752dd1c24bdea3b97570763d77948b:docs/roadmap/cross-track-execution.md`.
The sections below preserve the batch protocols and the then-current recommendation; they
are evidence, not present launch permission or live status. Decision records remain under
`docs/reference/decisions/`. Its copyleft licensing mentions are history: the owner rescinded that
choice and licensing is [undecided](../../../reference/decisions/post-batch-e-authorization-2026-10-23.md#licensing-direction).
Relative links were written from `docs/roadmap/`. Current allocation and dependencies live in
[Cross-track coordination](../../../roadmap/cross-track-execution.md).

## Execution DAG and earliest product milestones

**Current evidence, 2026-10-22:** T1.P01, T2.P01 and T3.P01 are shipped and closed. Their
accepted providers remain exactly those in the [gate register](./README.md#gate-register).
[Batch E](#authorized-batch-e-2026-10-22) registered H0, C1 and C2 as T3.P03, T1.P02 and T2.P02.
T3.P03 is authorized and released. `T1.P02.S01`, `T2.P02.S01` and the finalized `T3.P02.S01` are
authorized and released, each starting only after `T3.P03.S01` merges. Every later child is
registered `proposed` and held. The graph below is the one current execution recommendation.
Earlier dated batch sections retain their authorization provenance, not current launch permission.

```mermaid
flowchart TD
  BASE["Accepted F1–F4, viewport and Camera/Experience cutover; P01 phases closed (main f516e1ff)"]
  H0A["T3.P03.S01: planner scope + build isolation (merges first)"]
  H0B["T3.P03.S02: measurement workflow + phase final gate"]
  C1A["T1.P02.S01: Layout format 6 + captured identity"]
  C1B["T1.P02.S02: Draw, close, divide, delete; rail; dedupe"]
  C1C["T1.P02.S03: Opening family"]
  C1G["T1.P02.S04: final gate"]
  C2A["T2.P02.S01: model storage, formats, Save verification"]
  C2B["T2.P02.S02: import, approve, place, reopen"]
  C2G["T2.P02.S03: final gate"]
  PV["T3.P02.S01: capture + Guide-free and Cut Preview (finalized scope)"]
  PG["T3.P02.S02: integrated final gate"]
  LC["C3 proposal: rename/delete; T3 API + T1 shell"]
  CES["Core Editor Stability: owner-approved criteria and integrated acceptance"]
  REL["T4 deferred by R1-D: request planning after milestone acceptance"]
  BASE --> H0A
  H0A -->|merged| H0B
  H0A -->|merged| C1A
  H0A -->|merged| C2A
  H0A -->|merged| PV
  C1A --> C1B --> C1C --> C1G
  C2A --> C2B --> C2G
  PV --> PG
  H0B -.->|harness before consuming acceptance; manual evidence meanwhile| C1B
  H0B -.-> C2B
  H0B -.-> PV
  PV -.->|Preview evidence; else checked in C2's final gate| C2G
  PV -.->|preferred T3 capacity order| LC
  C1G --> CES
  C2G --> CES
  PG --> CES
  LC --> CES
  CES --> REL

  FACE["T1 provider: Wall face-frame query"]
  PLACE["T2: solve-once surface placement"]
  PART["T2: component table, resolver and admission operations"]
  PICK["T1 + T2: part selection and admission UI"]
  ANNO["T3: reusable part-annotated Presentation"]
  VERT["T1: vertical cutover; datums, structures, per-level faces"]
  TOL["T1: coordinate and tolerance contract"]
  E2["E2: selected overhead-family qualification"]
  E1["E1: 2D kernel qualification when needed"]
  ROOF["T1: first qualified overhead family"]
  ATT["Optional attachment: versioned Scene format, transport and joint planners"]
  BASE --> FACE
  FACE --> PLACE
  C2G --> PART
  PART --> PICK
  PICK --> ANNO
  PV --> ANNO
  C1G --> VERT
  BASE --> TOL
  TOL --> E2
  TOL --> E1
  E2 --> ROOF
  VERT --> ROOF
  E1 -.->|only if area booleans or offsets are used| ROOF
  H0A --> ATT
  FACE --> ATT
  C1A -->|non-reusing Layout allocation| ATT
  PART -.->|only for part-qualified attachment| ATT

  classDef accepted fill:#d8ecd8,stroke:#3c7a3c,color:#1e3d1e
  classDef released fill:#cfe8d6,stroke:#2d7a4a,color:#16391f,stroke-width:2px
  classDef gated fill:#d6e4f5,stroke:#2f5f99,color:#17304d,stroke-width:2px
  classDef registered fill:#f3e2c4,stroke:#9b7621,color:#4c3b13
  classDef proposed fill:#fff2ce,stroke:#9b7621,color:#4c3b13
  classDef deferred fill:#eeeeee,stroke:#999999,color:#555555,stroke-dasharray:4 3
  class BASE accepted
  class H0A,H0B released
  class C1A,C2A,PV gated
  class C1B,C1C,C1G,C2B,C2G,PG registered
  class LC,FACE,PLACE,PART,PICK,ANNO,VERT,TOL,E2,E1,ROOF,ATT proposed
  class CES,REL deferred
```

Solid arrows are actual provider or integration prerequisites. Dashed arrows carry a stated
condition or capacity preference; they do not invent an accepted gate. Node states: *released* —
authorized and released from the hold (T3.P03); *gated* — authorized and released, starting only
after `T3.P03.S01` merges; *registered* — a registered `proposed` child that still needs its own
authorization; *proposed* — not yet registered; *deferred* — owner-deferred. H0 corrects existing
accepted mechanisms; it creates no new F gate or accepted capability. `T3.P03.S01` is the only
merge prerequisite shared by the product lanes, which otherwise consume nothing from one another.
No release slice depends on advanced vertical, attachment or annotation work unless the owner
changes the milestone criteria.

### Convergence batch and next planning wave

#### Authorized batch E (2026-10-22)

**Owner-authorized 2026-10-22** ([record](../reference/decisions/batch-e-authorization-2026-10-22.md), E1–E7, from the
[coordination proposal](./next-batch-2026-10-22.md#owner-decisions)). H0's correctness slice
`T3.P03.S01` merges first; then `T1.P02.S01`, `T2.P02.S01` and `T3.P02.S01` run in parallel with
H0's measurement slice `T3.P03.S02`. T3.P03, T1.P02 and T2.P02 are registered; the four launch
slices and `T3.P03.S02` are authorized and released, and every later child stays `proposed` and held.
No closed phase is reopened, and no gate, version or capability changes.

#### Batch E lanes and launch plans

| Lane | Owner and outcome | Launch slice | Before implementation | Readiness |
| --- | --- | --- | --- | --- |
| H0 | T3 F4 owner, T1 boundary review. Per-planner scope, current build isolation, the on-demand harness and baseline | [T3.P03.S01](./t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s01-planner-scope-and-build-isolation/implementation-plan.md), then [S02](./t3-experience/t3.p03-shared-acceptance-and-measurement/t3.p03.s02-measurement-workflow-and-final-gate/implementation-plan.md) | Nothing further: registered (E1), authorized and released (E2) | S01 startable now; S02 after S01 merges |
| C1 | T1. Empty → draw → close → divide → Opening → delete with captured identity and derived roles | [T1.P02.S01](./t1-spatial-world/t1.p02-native-wall-creation/t1.p02.s01-layout-identity-and-format-cutover/implementation-plan.md); S02–S04 registered in [T1.P02](./t1-spatial-world/t1.p02-native-wall-creation/README.md) | `T3.P03.S01` merged | S01 authorized and released (E7) with the drawing policy accepted (E3); later plans written after each predecessor's acceptance |
| C2 | T2 ingest/API owner, T1 host review. Import → approve → place → Save → reopen one own GLB | [T2.P02.S01](./t2-composition/t2.p02-own-model-import/t2.p02.s01-model-resource-storage-and-admission/implementation-plan.md); S02–S03 registered in [T2.P02](./t2-composition/t2.p02-own-model-import/README.md) | `T3.P03.S01` merged | S01 authorized and released (E7) with the bounds accepted (E4) |
| Capture/Preview | T3. Capture, Guide-free and Cut Preview, Save/history | [T3.P02.S01](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md) with its finalized scope | `T3.P03.S01` merged | Finalized scope accepted (E5) and released (E7); historical authorization retained |
| C3 follow-on | T3 persistence/API, T1 shell. Rename/delete with conflict and dirty-replacement safety; deletes the project's model revisions | Not yet planned | After the first-wave interfaces settle, by T3 capacity after S01 | Next T3 slice to plan |

**Reference hardware (E6).** Hard rows are run and accepted on the owner's MacBook Air M2 with
16 GB, operated by the owner ([E6 amendment](../reference/decisions/batch-e-authorization-2026-10-22.md#amendment-e6-reference-machine-named)); laptop A stays the accessibility target the
budgets describe. This covers F2 for `T1.P02.S01`, F10 for `T3.P02.S01`, and the drawing, import
and placement rows for the S02 slices. Another developer machine's CPU run counts only when
calibrated against it; hardware-independent delivery rows need no machine.

#### Batch E shared files and merge order

One writer per row; everything else is read-only for the other lanes.

| Area | Writer | Rule for everyone else |
| --- | --- | --- |
| F4 host: `packages/project-model/src/f4/`, the unit acceptance adapter, editor `lib/authoring/f4/` | `T3.P03.S01` | Read-only afterwards; a later need is a T3-reviewed change |
| Public/Preview boundary predicate, both Vite boundary plugins, boundary tests | `T3.P03.S01` | Later lanes add assertions only; none is weakened |
| Harness, its config, bundle report, editor devDependencies and `perf` scripts | `T3.P03.S02` | Consumers add their own flow marks and specs in their own files |
| Shared unit type, validation and envelope-closure modules in `packages/project-model/src/units/` | Each lane edits only its own entries: T1 Layout, T2 resources and Scene closure, T3 Experience and program | Merged serially; T3's F2 owner reviews each change; the later merger rebases and reruns the full gate |
| `@portfolio/layout-core`, the Layout unit, Layout adapters, the starter gallery | T1.P02 | Read-only |
| Stage host, `stage/shell/`, the spatial route | T1.P02 | T2/T3 contribute through the adapter contract. T3's Head Preview entry and takeover is an owned integration patch reviewed by T1. Any other host need is a stop-and-report |
| Scene format, Scene planning, Scene adapters, the Import procedure | T2.P02 | Read-only |
| `apps/api/**` and migrations | T2.P02 | Read-only. T1.P02.S01 changes API behavior only through the shared Layout validation and runs the API gates |
| Experience and Camera units, lowering, interpreter, the Preview surface, T3 authoring adapters | T3.P02.S01 | Read-only |
| Root barrels, `package.json` exports, [`test-lanes.ts`](../../apps/editor/test-lanes.ts) | Append-only | The second merger resolves |
| Gate register, phase registers, batons | Each slice's own rows and its own track's baton | No cross-track register edits; a lane reads `T3.P03.S01`'s row for its start gate and never edits it |
| `docs/roadmap/t4-release/**`, `prototypes/**` | Nobody | Frozen (R1-D); prototypes stay evidence |

**Merge order.**

1. `T3.P03.S01` merges first. Every product lane starts from a base containing it.
2. `T1.P02.S01`, `T2.P02.S01`, `T3.P02.S01` and `T3.P03.S02` then run in parallel and merge in
   acceptance order, each as its own P1 merge commit. A later merger rebases and reruns the complete
   merge gate on then-current `main`. No lane imposes an order on another.
3. Each lane's next slice starts only after its predecessor's acceptance and its own authorization.
   No acceptance record may include another lane's unaccepted implementation.
4. Each phase's final gate rechecks its integrated flows. The Core Editor Stability acceptance plan
   follows the [milestone route](./core-editor-stability.md#acceptance-route) after the lanes ship.

#### Batch E acceptance and performance gates

Each slice records the [performance contract](../reference/components/performance.md) rows below
before acceptance. Hard misses are resolved inside the slice; target misses get a written disposition.
A final gate cannot defer a slice's hard miss.

| Slice | Acceptance core | Performance evidence before acceptance |
| --- | --- | --- |
| `T3.P03.S01` | RR-4 refusal; joint planner admitted within `writes`; both build mutation proofs; Preview closure test | None: no product flow changes |
| `T3.P03.S02` (final gate) | Correlated input-to-frame measurement; bundle report; baseline with unrun rows named; S01 rechecked | Baseline F1, F2, F7, F9, F13 and the F3/F4/F8 method on the shipped drag |
| `T1.P02.S01` | Identity guards; derived-role differential; strict format 6; unchanged creator journeys | F2 open at S and M against the H0 baseline |
| `T1.P02.S02` | Empty → draw → close → divide → delete; policy refusals; Undo/Redo, Save, reload | F3 drag and per-move evaluation, F4 commit and F8 Undo/Redo (hard S/M, L reported), F13, Stage first-load delta |
| `T1.P02.S03` | Opening place/remove, host preference, refusal | F4 for Opening commit |
| `T2.P02.S01` | DB-backed API at zero skips; model pins verified at Save; strict formats | None: no editor flow |
| `T2.P02.S02` | Import → approve → place → duplicate → Save → reopen → Preview | F5 (hard long-task rows), F6 at S/M, GPU memory at M, F13, Stage first-load delta with Import lazy |
| `T3.P02.S01` | Capture/bind as one accepted result; Guide-free and Guide Preview; Save/reload | F10 capture/bind and Preview entry (hard S/M), Preview chunk lazy, F13 Preview enter/exit cycles |

**Next capability wave.** T1 plans the Wall face-frame query and T2 solve-once surface placement;
that consumer can use existing objects and has no artificial own-GLB or vertical dependency.
C2 feeds T2 component identity/resolution/admission, then T1 part-selection/admission UI and T3
reusable annotations; the provider precedes its UI, avoiding a dependency cycle. T1 plans the
vertical cutover after C1: decide enclosure/closure policy, test per-level face derivation and
compare compiler organizations fairly. E2 qualifies the selected overhead family; E1 is needed
only where that family uses booleans/offsets. Compound roof massing, exact copyleft licence before
a relevant dependency ships, and attachment removal/parameter policies remain consumer-triggered
owner calls. No broad research program or geometry library is required for the first wave.

**Design development.** Feature-level placement of prototype capabilities in the shell is a
consuming-slice design task: draft → review → build → browser observation → revise. The first
drafts are the [C1](./t1-spatial-world/t1.p02-native-wall-creation/shell-draft.md),
[C2](./t2-composition/t2.p02-own-model-import/shell-draft.md) and
[S01](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/shell-draft.md)
shell drafts. Keep PLATE's ratified shared composition, identity, material, metrics, return and
accessibility rules. A slice records a proposed departure for owner review; prototype chrome never
becomes the production shell by default.

**After the lanes ship:** request the Core Editor Stability integrated acceptance plan through
its [milestone route](./core-editor-stability.md#acceptance-route). Do not create that workspace
now, declare the milestone accepted from slice merges, or resume T4 early. Earlier foundation
DAG detail remains in the dated batch provenance and phase acceptances below; readiness is always
rechecked at trusted base, never inferred from this diagram.

## Parallel batch 2026-10-16

The owner authorized `T1.P01.S02`, `T1.P01.S03`, `T2.P01.S01` and `T3.P01.S01` to run in parallel
([decision](../reference/decisions/parallel-slice-authorization-2026-10-16.md)). Each consumes only
the accepted `references-v1`/`inspection-v1` on post-PR #126 `main`; none consumes another, so none
may wire, import or depend on another's unmerged output. A slice that finds it needs to stops and
reports instead.

**Shared-file ownership.** One writer per shared module for the batch's duration:

| Area | Writer in this batch | Rule for everyone else |
| --- | --- | --- |
| `@portfolio/camera-core` | `T1.P01.S02` | read-only |
| Editor route, host, Stage and shell modules | `T1.P01.S02` | read-only |
| `@portfolio/layout-core` | new modules only: `T1.P01.S02` (Plan representation), `T2.P01.S01` (floor-support query) | nobody changes the compiler, its tolerances or an existing query |
| `@portfolio/project-model` | new modules only: `T1.P01.S03` (F4 contracts, admission, content identity), `T2.P01.S01` (Scene planning), `T3.P01.S01` (units, program, converter, additive reference extension) | nobody changes landed reference/channel behavior or the Scene v1 codec |
| [`package.json`](../../packages/project-model/package.json) `exports` of project-model | `T3.P01.S01` adds its subpaths | any other addition appends |
| Editor F4 coordinator/history module | `T1.P01.S03` | — |
| Editor object-definition policy and admitted inventory | `T2.P01.S01` | — |
| Barrels [`project-model`](../../packages/project-model/src/index.ts), [`layout-core`](../../packages/layout-core/src/index.ts) and [`test-lanes.ts`](../../apps/editor/test-lanes.ts) | append-only | the second merger resolves the textual conflict |
| Boundary tests (public surface, project-model, camera-core) | additive assertions per slice | no slice weakens an existing assertion |
| Landed `reference/*` contracts | none during the batch | `T1.P01.S02` updates `architecture.md` §Product routes at its own closeout |

**Content identity.** `T1.P01.S02` and `T1.P01.S03` both need the current-source content identity
that S03 owns: `sha256Bytes` over the strict writer's normalized source with ID-keyed Layout
identity maps ordered and only `layout.identity.cursor` excluded from the digest. Full canonical
source retains the cursor for persistence/history; hash equality is authored-content equality,
not full-source byte equality. Whichever merges first lands the single project-model export with its invariance
tests; the other rebases and reuses it. `T3.P01.S01` uses the same hash primitive for unit
`contentRevision` and defines no current-source identity.

**Merge protocol.** Each slice merges on its own after independent acceptance and routine closeout;
there is no batch merge and no imposed order. Every merge reruns the complete merge gate in
[`tests/README.md`](../../apps/editor/tests/README.md#what-a-change-requires) on the then-current
`main`, whatever the slice's iteration tier; a slice whose shared module changed underneath it
rebases and reruns before merging. Integration of the viewport host with F4 (accepted install, Undo/
Redo commands, replacement baseline, selection requalification, Camera-output rebase) is
`T1.P01.S04`'s first increment by default (reassigned to `T1.P01.S07` by ruling D2 of 2026-10-17).

**Cycle.** `T1.P01.S02` is a listed exposure: its first authorized implementation opens the T1.P01
window through the runbook start step. `T1.P01.S03`, `T2.P01.S01` and `T3.P01.S01` are not exposures
and open nothing; an open window and its pending verdicts block none of them.

**Remaining risks** (owners named; none blocks the batch's start):

| # | Risk | Owner and mitigation |
| --- | --- | --- |
| R1 | `T1.P01.S02` is large and on the critical path of every viewport consumer. | S02 implementer proposes a registered split rather than silently deferring criteria. |
| R2 | `T3.P01.S01` is large, and Experience 1 / `ExecutionProgram@1` freeze before the interpreter and authoring UI exist. | Codec-level fixtures for every AM-6 case now; a later required-meaning change is a versioned F amendment. A split (converter as its own slice) is the owner's option. |
| R3 | `T2.P01.S03` authorized before `T1.P01.S04` would leave host↔F4 wiring unowned. | Owner assigns it explicitly at that authorization. |
| R4 | Contact-metadata verification may exclude the non-unit-normalization model. | `T2.P01.S01` records the exclusion; the phase proceeds with analytical primitives and verified models. |
| R5 | `T3.P01.S02`'s Save control needs a home in the T1 shell Head. | **Settled 2026-10-16** ([record](../reference/decisions/s02-pair-authorization-2026-10-16.md)): T3 owns persistence and client Save state; T1's host↔F4 wiring slice owns the Head integration. `T1.P01.S02` never calls the unconditional `PUT`. |
| R6 | T3.P02 cannot register until `T3.camera-experience-cutover@1` is drafted and ratified. | T3 drafts it with `T3.P01.S04`'s authorization request. |
| R7 | Per-accept validation, serialization and hashing may be costly on dense projects. | `T1.P01.S03` records a measured observation on the densest fixture (TD-5's lesson). |
| R8 | Client/server canonical-byte or digest-version skew would make equal contents compare unequal. | `T3.P01.S02` carries the content-identity scheme as transport metadata, pinned by a golden-digest test, and refuses a mismatch explicitly (`identity-scheme-mismatch` / `source-version-mismatch` / `content-identity-mismatch`), never as a conflict. |
| R9 | Barrel and lane-list merge conflicts. | Append-only rule; second merger resolves. |
| R10 | The window `T1.P01.S02` opens may stay open for a long time. | Pending verdicts block no other track (cycle disposition below). |

## Parallel pair 2026-10-16

The owner authorized `T2.P01.S02` and `T3.P01.S02` to run in parallel
([decision](../reference/decisions/s02-pair-authorization-2026-10-16.md)) on post-PR #129 `main`
(`1315b1a2`), while `T1.P01.S02` (PR #128) is still open under the batch above. Each slice consumes
only accepted `references-v1` and `local-single-domain-v1`. Neither consumes the other or #128, so
neither may wire, import or depend on their unmerged output. A slice that finds it needs to stops
and reports instead.

**Shared-file ownership** (in addition to #128's batch rows, which stand until it merges):

| Area | Writer | Rule for everyone else |
| --- | --- | --- |
| `project-model` `src/scene-planning/` | `T2.P01.S02` | read-only |
| `project-model` Save protocol subpath module and its `package.json` `exports` entry | `T3.P01.S02` | appending another subpath is fine |
| `content-identity.ts` and its test | none in the pair: T3's scheme constant lives in its Save subpath | #128 still carries a stale copy; per the batch's content-identity rule it drops it on rebase and reuses the landed export |
| `project-model` `src/f4/**`, the current-source adapter and `apps/editor/src/lib/authoring/f4/**` (T1-owned, shipped) | none | read-only; a needed change is a stop-and-report to T1 |
| `apps/api/**`, migrations, `apps/editor/src/lib/platform/project-persistence.ts` and the editor client Save state | `T3.P01.S02` | read-only; T1's read-only boot relies on the additive `GET` shape |
| Editor routes, host, Stage and shell modules | `T1.P01.S02` (#128) | read-only for both slices: no route, Head or host edit |
| Root barrels and [`test-lanes.ts`](../../apps/editor/test-lanes.ts) | append-only | the second merger resolves the textual conflict |
| Boundary tests (public surface, project-model) | additive assertions per slice | no slice weakens an existing assertion |

**Merge protocol.** As for the batch: each slice merges on its own after independent acceptance and
routine closeout. Every merge reruns the complete merge gate on the then-current `main`;
`T3.P01.S02` also runs the DB-backed API suite with zero skips. The Head Save integration is T1's
and starts only after `conditional-save-current-v1` is accepted. Neither slice is a cycle exposure.

## Authorized batch 2026-10-17

**Batch A is owner-authorized 2026-10-17** ([decision](../reference/decisions/next-batch-authorization-2026-10-17.md)):
`T1.P01.S07` and `T3.P01.S03`. S03's two follow-ups, `T3.P01.S05` and `T3.P01.S06`, were separately
owner-authorized on 2026-10-17 ([record](../reference/decisions/s03-split-followup-authorization-2026-10-17.md));
S03's umbrella was reconciled and closed after both halves shipped. Batch A is complete: S07 shipped
in PR #137, and S03 shipped through S05 (PR #140) and S06 (PR #141). Batch B was authorized later by
its own record ([§Authorized batch B](#authorized-batch-b-2026-10-17)). All T4 work, including `T4.P01.S01`, is
deferred by ruling R1-D until [Core Editor Stability](./core-editor-stability.md) is accepted. These are the shared-file and merge rules for the batches of the
[2026-10-17 next-batch proposal](./next-batch-2026-10-17.md). The decisions, rationale and launch conditions live
in that proposal, not here. Batch A is `T1.P01.S07` and `T3.P01.S03`. Batch B is `T1.P01.S04` and `T2.P01.S03`, startable only after S07 ships
and `viewport-projection-v1` is accepted at their trusted base. Both conditions hold on `main` since
PR #137.

```mermaid
flowchart LR
  V["T1 S02 (shipped)"] --> B["T1 S07: Stage↔F4 bridge → viewport-projection-v1 accepted"]
  L["T1 S03 (shipped)"] --> B
  B --> P["T1 S04: Layout precision + Head Save"]
  B --> UI["T2 S03: Place/Move/Yaw/Undo"]
  P --> W["T1 S05: Wall manipulation"] --> G["T1 S06: final gate"]
  P --> T2F["T2 S04 (needs Head Save)"]
  UI --> T2F
  U["T3 S01/S02 (shipped)"] --> X5["T3 S05: unit acceptance + Save (shipped)"]
  U --> X6["T3 S06: runtime + handoff (shipped)"]
  X5 --> X["T3 S03: umbrella (shipped by reconciliation)"]
  X6 --> X
  X --> CUT["T3 S04 (proposed)"]
```

This was the batch A delta as authorized: it replaced the `V --> UI` edge with `V → S07 → UI` and
added S07 as S04's predecessor. The [execution DAG](#execution-dag-and-earliest-product-milestones)
now incorporates it. The T3 edges here follow that DAG's direction: the split halves feed the
umbrella reconciliation.

**Batch A shared-file ownership** (for its duration):

| Area | Writer | Rule for everyone else |
| --- | --- | --- |
| Editor routes, host, Stage, shell and Head modules | `T1.P01.S07` | read-only; a needed change is a stop-and-report to T1 |
| Existing `@portfolio/camera-core` modules (`viewport.ts`, `camera-motion.ts`, `camera-route.ts`, …) | `T1.P01.S07`, only where the wiring requires it | read-only for `T3.P01.S05` and `T3.P01.S06`; a needed change is a stop-and-report to T1 |
| New `@portfolio/camera-core` modules (guided/free/reduced-motion controllers) | `T3.P01.S06` | evaluate through the existing Camera authority; no second pose/FOV interpolation |
| `project-model` `src/f4/**` and `src/units/**` (the additive unit-acceptance extension) | `T3.P01.S05` | `T1.P01.S07` consumes public exports; any host-facing addition is additive, and the second merger resolves; landed `local-single-domain-v1` behavior changes for neither. `T3.P01.S06` is read-only here |
| `project-model` `src/channels/**` (F3) | `T3.P01.S06` (additive `camera-handoff-v1`) | `inspection-v1` and the ticket protocol S07 rebases on stay byte-compatible; S07 reruns its probes if T3 merges first. `T3.P01.S05` is read-only here |
| `project-model` Save subpath, `apps/api/**`, migrations and editor `authoring/save/**` | `T3.P01.S05` | read-only for `T3.P01.S06`; no live unit route is enabled |
| `docs/roadmap/t4-release/**` | none (T4 deferred, R1-D) | frozen |
| Root barrels, `package.json` exports and [`test-lanes.ts`](../../apps/editor/test-lanes.ts) | append-only | the second merger resolves the textual conflict |
| Boundary tests (public surface, project-model, camera-core) | additive assertions per slice | no slice weakens an existing assertion |
| Gate register rows | each slice's closeout edits only its own gate rows (S07: `T1.viewport-projection`; S05: F4 entries; S06: the F3 entry) | same table, distinct rows; the second merger resolves |

**Merge protocol.** As in the earlier batches, each slice merged on its own after independent
acceptance and routine closeout, with no imposed order inside a batch. Every merge reran the complete
merge gate on the then-current `main`. `T3.P01.S05` also ran the DB-backed API suite with zero
skips.

**S03 split follow-up ownership (2026-10-17).** S05 and S06 register inside their own implementation
PRs and carry one coordinated registration commit; no planning-only PR exists. They are not cycle
exposures. S05 owns the F4/F2/unit/Save surfaces above and must leave the live Save route
current-source-only; S06 owns the F3 channels surface and new camera-core runtime modules. S03's umbrella row, plan and
acceptance record stayed in place until both were accepted, then closed by reconciliation. The
original S03 batch-A rules for editor routes/host/Stage/T1-owned modules, retired gates and T4 stay
in force for both.

**Cycle.** None of these slices is an exposure except `T1.P01.S04`, which is already listed. Its start
records no new opening, because the window has been open since S02. S07 is deliberately not added:
the window is at its bound of three.

## Authorized batch B 2026-10-17

**Batch B is owner-authorized 2026-10-17** ([decision](../reference/decisions/batch-b-authorization-2026-10-17.md)):
`T1.P01.S04` (existing Layout precision, with the Head Save integration in scope) and `T2.P01.S03`
(first coherent editing surface). They run in parallel, and neither consumes the other. Both consume
`T1.viewport-projection@1:viewport-projection-v1`, accepted at `ab8504aa` through S07 (PR #137), and
the F1/F4 local scopes. S04 additionally requires `conditional-save-current-v1` (ruling D3). The
record verifies every prerequisite against `main` `a8e4d45e`. Each slice still re-checks eligibility
at its own trusted base through its runbook start step.

```mermaid
flowchart LR
  B["T1 S07: viewport-projection-v1 (shipped)"] --> P["T1 S04: Layout precision + Head Save (authorized)"]
  B --> UI["T2 S03: Place/Move/Yaw/Undo (authorized)"]
  S["T3 S02: conditional-save-current-v1 (shipped)"] --> P
  C["T2 S02: Scene acceptance (shipped)"] --> UI
  P --> W["T1 S05 (proposed)"] --> G["T1 S06: final gate (proposed)"]
  P --> T2F["T2 S04: needs Head Save (proposed)"]
  UI --> T2F
  X["T3 S03/S05/S06 (shipped)"] --> CUT["T3 S04: own authorization path (proposed)"]
  T4["T4 (deferred, R1-D)"]
```

T3.P01.S04 and T4 are drawn without batch B edges on purpose: batch B neither waits for them nor
feeds them. T3.P01.S04 later migrates the current-source adapters of any T1/T2 slice still
unaccepted at activation (K6). That is S04's obligation, not a batch B prerequisite.

**Batch B shared-file ownership** (for its duration):

| Area | Writer | Rule for everyone else |
| --- | --- | --- |
| PLATE Head (Save integration, unsaved-work signalling, sign-in draft resume) | `T1.P01.S04` | read-only; T3 owns the Save protocol, server and client state machine, and T1.P01.S04 builds none of them |
| Layout adapter modules (Dimensions instrument, Card name writer, capability-Find entries, Place → Layout plinth) | `T1.P01.S04` | read-only for `T2.P01.S03` |
| Scene adapter modules (Place/Move/Yaw/Undo surface) | `T2.P01.S03` | read-only for `T1.P01.S04` |
| Place/Find/Card/instrument registration | each slice, only through S07's contribution points | append-only registration; the second merger resolves |
| Host core, routes and shell modules | `T1.P01.S04` (Save mount, Card-name contribution, Layout proposal lease) and `T2.P01.S03` (only the additive pointer/surface/task-close seams and the route's contributed-task mirror named in the [T2 host-seam exception](../reference/decisions/t2-s03-host-seams-2026-10-17.md) and its 2026-10-18 addendum, plus the one candidate-mesh contribution and `StageCanvas` render block named in the [renderer exception](../reference/decisions/t2-s03-renderer-exception-2026-10-17.md)) | any other change is a stop-and-report; the second merger resolves the shared files; no second renderer, selection, navigation or acceptance authority |
| `layout-core` and `project-model` | new modules only | nobody changes the compiler, an existing query or `src/scene-planning/` semantics |
| `apps/api/**`, migrations and the Save subpath | none (T3-owned) | read-only; the local [Compose backend](../local-development.md#backend-in-docker-recommended) runs it unchanged |
| `docs/roadmap/t4-release/**` | none (T4 deferred, R1-D) | frozen |
| Root barrels, `package.json` exports and [`test-lanes.ts`](../../apps/editor/test-lanes.ts) | append-only | the second merger resolves the textual conflict |
| Gate register | none | batch B accepts no capability and edits no gate row |

**Shared files after the two host exceptions.** The batch no longer has disjoint diffs: both
slices write `stage/stage-facade.ts` and the spatial route (T2's write includes the route's
contributed-task mirror approved in the host-seam exception's addendum), and T2 additionally writes
`stage/shell/StageCanvas.svelte` under the renderer exception. The combined tree was tested before
either merge (check clean, `test:fast` 1894/1894, `test:arch` 163/163), so the additions compose;
each merge still reruns the full gate on the then-current `main`.

**Merge protocol.** Each slice merges on its own after independent acceptance and routine closeout,
with no imposed order inside the batch. Every merge reruns the complete merge gate on the
then-current `main`. A slice that touches `apps/api/**` reruns `npm run check:api` and the DB-backed
`npm run test:api` with zero skips; the Compose database (`npm run test:api:stack`) is an accepted
target. `T1.P01.S04` must be accepted before `T2.P01.S04` starts. `T1.P01.S05` waits for S04.

**Cycle.** `T1.P01.S04` is the only exposure. Its start records no new opening, because the window has
been open since S02, and its exposure row and mechanism verdicts are recorded at its closeout.
`T2.P01.S03` is not an exposure.

## Authorized batch C 2026-10-19

**Owner-authorized 2026-10-19.** Two records carry the decisions:

- the [batch C record](../reference/decisions/batch-c-authorization-2026-10-19.md):
  `T1.P01.S05` ∥ `T2.P01.S04`, the current-source freeze and the `T1.P01.S06` route;
- the [T3 cutover record](../reference/decisions/t3-cutover-ratification-2026-10-19.md): the AM-9
  clean source epoch and `T3.P01.S04` in two phases.

Both were approved as written (C3 post-cutover; Guide-free fix in S04). The evidence and reasoning are in the
[batch C proposal](./batch-c-2026-10-19.md). Prerequisites were verified against `main` `5fee2a2d`.

```mermaid
flowchart LR
  P["T1 S04 (shipped)"] --> W["T1 S05 + TD-8 (authorized)"]
  UI["T2 S03 (shipped)"] --> T2F["T2 S04 final gate (authorized)"]
  P --> T2F
  W --> FRZ{{"current-source freeze"}}
  T2F --> FRZ
  RAT["owner ratification (AM-9)"] --> CA["T3 S04 phase A: T3-owned files"]
  CA --> CB["T3 S04 phase B: caller migration"]
  FRZ --> CB
  CB --> G["T1 S06 final gate, on units (batch D)"]
  CB --> PRE["T3.P02 registration (batch D)"]
  CB -.-> ACT["owner-run activation (operational, unexecuted)"]
  ACT -.-> DEP["deployed new epoch"]
```

`W → FRZ` and `T2F → FRZ` are K6 made explicit: T3.P01.S04 migrates landed callers once. The
`CB → G` and `CB → PRE` edges are the post-cutover route ruling C3 established. **Reconciled
2026-10-20 (batch D ruling D4):** this diagram previously drew `ACT → G` and `ACT → PRE`, which made
a deployed activation a gate on engineering work. That reading contradicts the more specific ratified
text — C3 (“after `T3.P01.S04` is accepted”), R5 (“the merge is the code cutover … activation is a
separate owner-run step”) and AM-9 §6 — so the arrows now leave the accepted code, and activation is a
dashed operational branch that gates nothing. Activation has not been executed. The four distinct
states are recorded in the
[batch D record](../reference/decisions/batch-d-authorization-2026-10-20.md#d4--sequencing-code-local-verification-deployment-and-the-next-consumers).

**Shared-file ownership** (for batch C and S04 phase A; phase B takes over after the freeze):

| Area | Writer | Rule for everyone else |
| --- | --- | --- |
| Host core: `stage/stage-facade.ts`, `stage-session.ts`, `stage-input.ts`, `stage-contributions.ts`, `stage-adapter-host.ts`, `host-acceptance.ts`, `stage/shell/**` and the spatial route | `T1.P01.S05` (Wall handles, pointer capture, the TD-8 fix) | `T2.P01.S04`: additive registration only, through S07's contribution points and the existing [T2 host seams](../reference/decisions/t2-s03-host-seams-2026-10-17.md) and [renderer exception](../reference/decisions/t2-s03-renderer-exception-2026-10-17.md), unextended. A new seam is a stop-and-report to T1. S04 phase A: read-only. |
| Layout adapters (`authoring/adapters/layout*`, `authoring/layout/**`) and `@portfolio/layout-core` | `T1.P01.S05` | read-only; nobody changes the compiler or its tolerances |
| Scene adapters (`authoring/adapters/scene*`, `authoring/scene/**`) and project-model `src/scene-planning/**` (additive only) | `T2.P01.S04` | read-only |
| Current-source F4/Save: project-model `src/f4/**`, `content-identity.ts`, `src/save/**`, editor `authoring/f4/**` and `authoring/save/**`, `platform/project-persistence.ts` | none until the freeze; then S04 phase B | read-only; a needed change is a stop-and-report |
| `apps/api/**` and migrations; project-model `src/units/**`, `src/program/**` and `src/migration/**`; `lib/visitor/**`; legacy flow-order exports in camera-core and project-model | `T3.P01.S04` phase A | read-only for batch C |
| Root barrels, `package.json` exports and [`test-lanes.ts`](../../apps/editor/test-lanes.ts) | append-only | the second merger resolves the conflict |
| Boundary tests | additive assertions per slice | no slice weakens an existing assertion |
| Gate register | batch C: none; S04: its cutover row and the F4 retirement entries at its own closeout | — |
| `docs/roadmap/t4-release/**` | none (R1-D) | frozen |

**Merge protocol.**

1. `T1.P01.S05` and `T2.P01.S04` merge in either order after independent acceptance and routine
   closeout. If both are ready together, S05 merges first. Every merge reruns the complete merge gate
   on then-current `main`.
2. **The freeze.** After both have merged, no current-source caller lands until S04 merges.
3. `T3.P01.S04` is one implementation PR. Phase B rebases onto the frozen `main` and merges last. On
   top of the exhaustive tier it runs `check:api`, a DB-backed `test:api` with zero skips, and a
   reset-migration rehearsal on the Compose stack (`npm run test:api:stack`). Its merge is a merge
   commit (P1).
4. Activation on the deployed environment is a separate owner-run step. Both deployment orders refuse
   rather than misread: AM-9 relies on a schema fence and strict version refusal, not on deploy
   timing.

**Cycle.** `T1.P01.S05` is the configured terminal exposure. Its start opens nothing new. Its
closeout records the S05 exposure row, which makes the window closable; the owner's mechanism
verdicts are a separate event. `T2.P01.S04` and `T3.P01.S04` are not exposures.

## Authorized batch D 2026-10-20

**Owner-authorized 2026-10-20** ([record](../reference/decisions/batch-d-authorization-2026-10-20.md),
D1–D4). Two slices run in parallel on the post-cutover base `origin/main` `9a457f6b` (PR #158):

| Slice | Phase | Plan | Consumes / Requires |
| --- | --- | --- | --- |
| `T1.P01.S06` — Integrated final gate (the phase's declared final gate) | T1.P01 | [plan](./t1-spatial-world/t1.p01-stage-foundation/t1.p01.s06-integrated-final-gate/implementation-plan.md) | `F1.reference@1`, `F2.unit-envelope@1`, `F4.intent-acceptance@1`, `T1.viewport-projection@1`, `T3.camera-experience-cutover@1` / `unit-resolution-v1`, `unit-envelope-v1`, `unit-acceptance-v1`, `conditional-save-units-v1`, `viewport-projection-v1` |
| `T3.P02.S01` — First capture and Cut Preview | T3.P02 | [plan](./t3-experience/t3.p02-capture-and-cut-preview/t3.p02.s01-first-capture-and-cut-preview/implementation-plan.md) | the same six gates / the same five scopes plus `camera-handoff-v1` |

```mermaid
flowchart LR
  B["main 9a457f6b (PR #158 merged, gate accepted)"] --> S6["T1 S06: integrated final gate"]
  B --> P1["T3.P02.S01: capture + Cut Preview"]
  TD["TD-10 narrow repair + regression (T1 host)"] --> S6
  S6 --> CL{{"T1.P01 closable (owner close event)"}}
  P1 --> P2["T3.P02.S02: integrated final gate (proposed)"]
```

**Prerequisites verified at `9a457f6b`.** `T3.camera-experience-cutover@1` is `accepted` with
`T3.P01.S04` as sole provider at `06a8aac8`; every `Requires` scope is `active`; `T2.P01.S04` and
`T3.P01.S04` carry accepted final-gate evidence; and the accepted revisions are ancestors of `main`.
TD-10 is open in the tree and is T1's first increment (D2).

**Shared-file ownership.** One writer per row; everything else is read-only for the other slice.

| Area | Writer | Rule for everyone else |
| --- | --- | --- |
| Host core: `stage/stage-facade.ts`, `stage-session.ts`, `stage-input.ts`, `stage-contributions.ts`, `stage-adapter-host.ts`, `host-acceptance.ts`, `stage/shell/**`, the spatial route (including the TD-10 repair) | `T1.P01.S06` | `T3.P02.S01`: additive registration only through AM-5's task/Find/instrument points and the accepted viewport facade. A new host seam is a stop-and-report to T1, never an edit. |
| Layout adapters (`authoring/adapters/layout*`, `authoring/layout/**`) and `@portfolio/layout-core` | nobody in batch D | read-only; the compiler and its tolerances do not change |
| Scene adapters (`authoring/adapters/scene*`, `authoring/scene/**`) and project-model `src/scene-planning/**` | nobody in batch D | read-only; S06 verifies the shipped behaviour, it does not re-open it |
| `project-model` `src/units/**` (Experience unit, lowering, runtime), `src/f4/**`, `src/save/**`, and `@portfolio/camera-core` | `T3.P02.S01`, additive | `T1.P01.S06` is read-only. An incompatible shared-shape change is a new gate major and a re-declared consumer: stop and report. |
| New T3 authoring surface directories and their adapters | `T3.P02.S01` | `T1.P01.S06` does not edit them; it verifies the host journeys that reach them |
| `apps/api/**` and migrations | nobody in batch D | read-only; S06 exercises the shipped F2 Save path, T3.P02.S01 consumes it |
| Root barrels, `package.json` exports, [`test-lanes.ts`](../../apps/editor/test-lanes.ts) | append-only | the second merger resolves the conflict |
| Editor tests and boundary suites | each slice adds its own files and assertions | no slice weakens an existing assertion; a shared fixture is owned by the slice that first needs it |
| Gate register, phase registers, batons | each slice edits only its own rows and its own track's baton | no cross-track register edits |
| `docs/roadmap/t4-release/**`, `prototypes/**` | nobody | frozen (R1-D); the PR #154 prototype program is untouched |

**Merge protocol.**

1. Each slice runs its runbook start step at its own trusted base, then implements, is reviewed
   independently against its own acceptance criteria, and runs its own `slice-closeout`.
2. Each merges as its own P1 merge commit after independent acceptance, rerunning the complete merge
gate on then-current `main`. There is no imposed order: the slices consume nothing from each other.
3. `T1.P01.S06`'s acceptance makes `T1.P01` closable and is not a T1 phase closure; a separate owner
   event closes it. `T3.P02.S01`'s acceptance is not the phase gate and claims no capability entry.
4. `T3.P02.S02` stays `proposed`. It starts only from its own owner authorization after S01 is
   accepted, and its `Requires` are unchanged by anything in this batch.
5. Neither slice's acceptance evidence may include the other's unaccepted implementation. S06 proves
   the authoring foundation that already shipped, T3.P02.S01 proves capture and Cut Preview, and the
   creator loop's integrated result is `T3.P02.S02`'s.

**Not in batch D.** T1 Wall creation (K3), T2 GLB import (K1), project lifecycle (K4) and all T4 work
stay subsequent candidates: registered and authorized only by their own owner events.

## Owner ratifications and cycle disposition

**Owner-ratified 2026-10-15** ([decision record](../reference/decisions/f-ratification-2026-10-15.md));
the recommendation below is preserved as the original proposal text. That decision ratified exact
F1–F5 shapes/providers, the two-field readiness amendment, early Layout/Scene F4 and
Save timing, source-independent revision/facade/output contracts, local-edit/conditional-Save mode,
canonical starter-gallery entry, shared bounded program/profile, and covered migration/recovery/
converter retirement. Recommended answers are the allocations and scopes above. A publication gap
requires actual inventory plus a separate owner decision at activation, not blanket approval here.

T1 keeps proposed exposures S02/S04/S05, expected opener S02 and terminal S05. Starter creation is
validated project boot from a canonical template, not live Wall drawing or junction-commit wiring;
M4's editor half remains unexposed. Configure only after registration; keep selected and unopened
until a listed authorized implementation starts. No global cycle/lifecycle edit is made now. A
pending cycle verdict does not block unrelated tracks; changed exposure IDs require reconciliation
before configuring the window, never an automatic fourth exposure.

## Preserved sections from the pre-consolidation coordination file

Copied verbatim (relative links are as written in `docs/roadmap/`); the current capability-readiness
rule lives in [Cross-track coordination](../../../roadmap/cross-track-execution.md#capability-readiness).

### Capability-readiness amendment

The current gate checker reads `Consumes` gate/version and overall state, not incremental
capability scope. It cannot prove that accepted local F4 also implements cloud or compound
behavior. Do not rely on a green current checker to admit such a consumer.

Propose only two additive fields: **Accepted capabilities** on each gate/version row and
**Requires** on each slice row. The latter names exact pairs, written here as
`F4.intent-acceptance@1:local-single-domain-v1`. `Consumes` retains ordinary Gate@Version syntax.
No additional gate, parallel registry or per-track acceptance protocol is introduced.

Each Accepted-capabilities entry links a durable record containing capability ID/version,
contract/amendment anchor, admitted source kinds, prerequisites, extension slice, actual shared
exports, conformance, independent acceptance and ancestor implementation commit. Pending scopes
stay in plans and do not appear as accepted entries. Existing evidence is retained when another
scope is added; the gate's sole provider is unchanged. A scope can also be explicitly retired,
with historical evidence retained and no new consumer eligible for it.

Eligibility requires the exact gate **and every required capability**, with its prerequisite
closure, to be accepted in the current tree **and at the trusted base** (`git merge-base HEAD main`).
The slice cannot add its own prerequisite evidence.This applies to new starts/in-progress/accepted
consumers; shipped historical slices retain their original scopes/evidence, as with historical gate
majors. Retiring an adapter removes its active admission, not historical evidence or base invariants.

For F.4, retirement splits two layers that `local-single-domain-v1` initially bundles. The enduring
layer is recorded as its own scope on the same F.4 entry —
`F4.intent-acceptance@1:acceptance-invariants-v1`, which never retires: opaque accepted revision,
content-digest comparison, atomic install with one undo result, stale/ABA rejection and one
chronological history. It persists across the source transition and is the prerequisite of
`unit-acceptance-v1` and `conditional-save-units-v1`. The retiring layer is the current-source
adapter admission (`local-single-domain-v1` current-source planning/validation and
`conditional-save-current-v1` persistence), which T3 S04 retires together with all its callers; after
that point no new or in-progress consumer may Require either retiring scope, while shipped slices keep
their evidence. The checker records retirement as a terminal state on the retiring scope's own entry
— no parallel registry, no permanent legacy admission — and fails any new or in-progress Requires
naming a retired scope. The inactive converter retires in T3 S04 without running (AM-9).
Acceptance of an interface is distinct from
ratification, implementation and consumer eligibility. `T1.P01.S01` installs the two-field
validation and controls for missing/unimplemented scope, consumer self-satisfaction, retired scope
and the trusted base (owner-ratified 2026-10-15): a consumer needing incremental readiness now
fails the arch-lane gate rather than relying on review alone. This file changes neither the live
register nor its checker. The rule's
normative statement and checker definition live in
[`f-foundation-contracts/README.md`](./f-foundation-contracts/README.md#capability-readiness); this
file keeps only the proposed allocation, the capability dependencies and the enforcement handoff,
and does not restate F semantics.

Compatible optional kind/family/source-adapter admissions retain the gate major and get explicit
new capability evidence. Breaking required identity, revision, result, coordinate or lifecycle
semantics needs a new major, retained old evidence and consumer re-declaration. A capability name
cannot disguise an incompatible semantic change. A consumer must declare what it actually uses.

| Capability added after the base | Extension slice | Exact scope / prerequisites |
| --- | --- | --- |
| F1.reference@1:unit-resolution-v1 | T3.P01.S01 | Camera/Experience/resource kinds and supplied F2 lock resolution; preserves missing/repair identity. Extends `references-v1`. |
| F1.reference@1:release-addresses-v1 | T4.P01.S02 | Publication/pinned-release semantic addresses with concrete release context and removed/repair results. Extends `references-v1`; needs shared unit/program identity. |
| F4.intent-acceptance@1:conditional-save-current-v1 | T3.P01.S02 | Create-only / expected-saved-base persistence of current source using full shared validation, atomic server OCC and retry receipts. Needs `local-single-domain-v1`; not F2, Stage or source activation. |
| F4.intent-acceptance@1:unit-acceptance-v1 | T3.P01.S05 | F2-backed single-domain and compound Camera/Experience acceptance, complete reference/lock validation, admitted resource staging and whole-operation history. Needs F2 and the enduring `acceptance-invariants-v1`, never the retiring `local-single-domain-v1`/`conditional-save-current-v1`, so the capability stays eligible once the current-source adapter retires. |
| F4.intent-acceptance@1:conditional-save-units-v1 | T3.P01.S05 | Same conditional Save protocol over F2 source; needs unit-acceptance-v1/base invariants and reuses prior Save protocol evidence, not active current-source admission. Inactive until S04; never a second live writer. |
| F3.channels@1:camera-handoff-v1 | T3.P01.S06 | Inspection, guided/free, Follow, Look-through and Preview ownership/return with stale-run cleanup; bounded Experience session semantics use the shared program. Needs `inspection-v1` and F2 program codec; real Stage integration is later T3.P02 evidence. |

**Slice prerequisites and exported-capability prerequisites are different claims.** A slice's
`Requires` names what that slice's implementation consumes; a capability's declared prerequisites
are what any later consumer needs from it. `T3.P01.S03`'s two registered halves owned the
implementation and are shipped; S03's original obligations are reconciled. `T3.P01.S05` builds the F2 unit admission and Save and
consumes F2 plus the enduring `acceptance-invariants-v1`; it does not consume the retiring
`local-single-domain-v1`/`conditional-save-current-v1` admissions. `T3.P01.S06` consumes
`inspection-v1` and the F2 program codec. The `unit-acceptance-v1`, `conditional-save-units-v1` and
`camera-handoff-v1` capabilities declare F2, `acceptance-invariants-v1` and `inspection-v1` as
appropriate — never a retiring admission and never each other's unaccepted output.

Initial local F4 admission includes registration and conformance for both Layout and Scene,
not T2's complete placement capability. T2 S02 registers its actual operations. No resource/lock
mutation or multi-domain dispatch succeeds under `local-single-domain-v1` alone.


### Source-first migration and activation ownership

> **Rewritten 2026-10-19 on ratification of [AM-9](../reference/composition-execution.md#am-9-shared-camera-and-experience-cutover)**
> ([T3 cutover record](../reference/decisions/t3-cutover-ratification-2026-10-19.md)). The owner
> ruled saved data disposable, so AM-7's inventory, covered-data exception, quiescence/CAS
> conversion and converter retirement no longer apply. The earlier text is recoverable at `5fee2a2d`.

T3 S01 prepared an old-source conversion candidate, which stays inactive and test-only and retires in
S04 without ever running. T3 S05 prepared the new-source unit planners, acceptance and Save adapters,
and T3 S06 the Experience runtime, Camera handoff and profile controllers, both without live
activation; S03's umbrella reconciled the original scope once both closed. T3 S04 installs AM-9's
clean source epoch: one transactional reset migration under an advisory lock that removes all
authored rows and fences the schema to the F2 envelope, current-format-only admission with typed
refusals, and atomic retirement of the current-source Stage/F4/Save/starter adapters with every
existing T1/T2 caller. In-progress consumer plans re-declare the already accepted F2/unit
capabilities from S05/S06. This is caller integration, not Camera authoring, and it does not consume
its own T3 gate. T2 definition inputs then come from immutable project pins; Scene-only placement
admits pinned/procedural entries. The F2 starter may install an explicitly captured bounded palette;
absent pins are unavailable, and further resource admission remains staged T2 follow-on work.

No ordinary Undo crosses the source-format transition: every project starts at a new-format
baseline. Old clients, files and drafts fail explicitly. Normal readers/writers accept only the new
format, and skew between the independently deployed API and editor refuses rather than misreads.
T3 removes legacy node-order orchestration. No converter, reverse serializer or old-format reader
survives.

T4 has no default legacy Experience converter or retained selection map. It lowers F2 units and
T3's authored identities into the **same T3 execution program** used by Preview. T4 S03/S04 may
exercise closed F2 candidate fixtures and inactive storage before T3 activation. T4 S05 waits for
the accepted T3 cutover, then owns prepared publication/API/resource/browser activation and source
snapshot delivery retirement. One Camera engine and one Experience interpreter serve both paths.

The publication gap is approved (2026-10-19, K2/R4) and is empty by construction, because the reset
removes every publication and release row. During an approved empty-release gap, new source publication returns typed
prepared-reader-required, cold public reads return their explicit unavailable/not-found outcome,
and status/Unpublish remain honest; the real /p/ route and isolation checks remain. Never silently reinterpret old bytes or keep a competing old visitor
engine. T4's barrier
fences mutations, switches prepared metadata/artifacts/resources and cold reader together, and
retires all authored delivery callers. Recovery after new-format edits rolls forward or explicitly
restores disclosed backups; prepared activations roll back to a compatible prepared runtime/pointer
with fresh OCC revisions. No permanent dual-format reader/writer or source fallback.

