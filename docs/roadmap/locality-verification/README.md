# Locality and lean verification: audit and plan

**Status:** plan for owner review. Nothing in this pull request changes code, tests or CI.
**Base:** `main` at `6b62f7241` (X9, PR #413). **Evidence:** this tree and Merge gate run
`45529863261` (X9's last full run, 2026-11-25). Every figure is measured or counted; Appendix A
gives the method. **Tier:** 2. The plan removes and downgrades checks and changes the CI contract
and the capability ledger's role. It also rewrites one persistence rule and replaces the database
migration history. Each packet carries its own tier (section 8).

The plan follows the [workflow](../../workflow.md): the owner rules on section 2's decisions, then
packets are claimed and merged individually. At closeout, section 5's and section 7's rules are
promoted into the routed contracts and this directory is deleted.

## 1. Summary

The repository's boundaries are sound after X9, but its files are not. An agent that changes one
Finish operation opens a 3,024-line planner whose `prepare` function alone is 1,808 lines. Its
imports transitively reach 152 files and 77,507 lines. The median editor module reaches 169 files
and 80,301 lines, 45% of the editor. Verification has grown the same way. The test code
(206,714 lines) is 73% the size of the production code. Code changes always run the Full profile,
at about 15 runner-minutes per push. Nothing revalidates a branch against `main` after
another pull request merges.

| Measure | Today | Target |
| --- | --- | --- |
| Production code (`apps/editor/src`, `packages/*/src`, `apps/api/src`) | 876 files, 281,951 lines | ≤ 268,000 lines |
| Production files ≥ 1,000 lines | 50 (83,415 lines) | ≤ 3, allowlisted |
| Functions ≥ 250 lines | 71 (36,211 lines); largest 1,954 | ≤ 8; none > 300 |
| Median transitive import closure, editor module | 169 files, 80,301 lines | ≤ 35,000 lines |
| Median transitive import closure, `project-model` module | 95 files, 54,364 lines | ≤ 12,000 lines |
| `export *` re-exports in workspace packages | 126 | 0 |
| Text visible to a default repository search | 2,496 files, 1,137,748 lines | ≤ 560,000 lines |
| Vitest cases | 6,880 | ≤ 4,800 |
| Test code (editor + API) | 215,485 lines | ≤ 140,000 lines |
| Pull-request run | 5 min 19 s wall, ≈ 15.4 runner-min; Focused never used | ≤ 3 min wall, ≤ 7 runner-min |
| Revalidation after another merge | none: the queue is inactive | every merge validated on the updated `main` |
| Fast lane on CI | 212 s | ≤ 90 s |

Correctness is retained by construction rather than by assertion count. A canary corpus of at
least 40 seeded defects must be fully killed before the first deletion and after the last (VER-0).
Every ledger capability keeps a behavioural journey, and no characterization or mounted-journey
assertion changes during a mechanical move.

**Why context is expensive.** Four mechanisms, largest effect first:

1. **Barrels.** `@portfolio/layout-core` exports 63 modules through `export *`, and
   `@portfolio/project-model` re-exports all of `layout-core`. A validator that needs one codec
   function therefore depends on the whole architectural compiler. Resolving barrel imports to
   their defining modules alone halves the median editor closure (80,301 → 39,248 lines).
2. **Accumulating closures.** New operations are appended where the shared state already lives,
   either a `create*` factory closure or a `prepare(kind)` branch chain. The 71 functions of 250
   lines or more hold 13% of all production code.
3. **Mixed files.** One file holds Camera, Experience and Scene planners. Another holds Wall
   planners beside the pointer-geometry helpers that 29 modules import, and a third pairs Layout
   planners with a topology validator.
4. **Search noise and history.** Production code is 25% of searchable text; prototypes are 39%.
   Production source carries 260 roadmap identifiers, and 40% of test titles name slices.

**Why verification is heavy.** The suite is organized by the roadmap slice that added each test,
not by the contract it protects. It keeps retirement guards, historical-revision differentials and
test-only reference reimplementations long after their subject settled. CI classifies nearly every
change as Full: of the last 100 runs, 79 succeeded and none of those was Focused. A provenance and
capability-evidence harness of 4,230 lines, with 3,797 lines of its own tests, serves 40 tagged
test titles.

## 2. Scope, invariants and owner decisions

**In scope:** mechanical extraction and relocation of production modules; package entry points;
removal of dead tooling, development routes, test seams and compatibility branches; subtraction and
reorganization of tests; lane, CI and harness redesign; versioning policy; durable rules that keep
the result from regrowing.

**Out of scope:** new features; algorithm, ordering or numeric changes in any kernel; renderer
work; performance optimization beyond verification cost; changes to hard rules 1–7 and 9–10.

**Preserved:** every semantic authority and its single owner; canonical algorithms and their call
order; product behavior; visitor isolation; the X9 composition contract (entries, sub-owners,
`LIFECYCLE_ORDER`, `ESCAPE_LADDER`, region keys, ports); owner-ratified `perf:spot` and bundle
reports. A move that needs any characterization assertion to change stops (section 11).

Owner decisions. Each is Tier 2; the recommendation comes first.

| # | Decision | Recommended | Alternative |
| --- | --- | --- | --- |
| D1 | Capability evidence harness | Retire maturity/health computation, provenance artifacts, check guards and issue guards. `npm run status` prints focus, holds, flags, claims and the latest `main` gate result. `capabilities.json` keeps ids, anchors and surfaces as the journey inventory | Keep the harness, move its tests to a separate `node:test` job, trim fixtures |
| D2 | Merge queue | Activate the prepared ruleset. Pull requests run the lean set, and the queue runs the complete set on `main` plus the batch | Stay unqueued: no revalidation; weekly Full remains the only main certification |
| D3 | Required contexts | One `merge gate` | Keep `merge gate`, `check guards`, `linux-x64` |
| D4 | `docs/archive/` (1,844 files) | Delete from the tree and tag the last revision that holds it; Git is the history | Keep it, search-ignored |
| D5 | Prototypes and research | Search-ignore `prototypes/`, `broad-research/`, `Repo-Audit/` and `review/`; explicit paths still work | Leave them searchable |
| D6 | WebGPU migration experiment | Delete the experiment, its six editor tests and scripts unless a migration is scheduled | Keep it isolated |
| D7 | Database migrations | Squash the 11 migrations into one baseline; reset `schema_migrations` on each live database once | Keep the history |
| D8 | Size budgets | A shrink-only arch check (LOC-0) | Report-only metrics |
| D9 | Check removal | Approve the deletion categories of section 7 once, under the successor rules, rather than file by file | Per-file owner review |
| D10 | Weekly scheduled Full run | Drop it once D2 is active, because every merge group certifies `main`; keep manual dispatch | Keep the schedule |

## 3. Baseline

Production code by size (`.ts`, `.svelte`, `.js`, `.mjs` in `apps/editor/src`, `packages/*/src`
and `apps/api/src`):

| Threshold | Files | Lines in those files |
| --- | ---: | ---: |
| ≥ 1,500 lines | 24 | — |
| ≥ 1,000 lines | 50 | 83,415 |
| ≥ 600 lines | 140 | 151,657 |
| ≥ 400 lines | 229 | — |

Transitive import closures (type-only edges included, because an agent reads types too):

| Scope | Median files | Median lines | p90 lines | Median if barrels resolved |
| --- | ---: | ---: | ---: | ---: |
| `apps/editor/src` (642 modules) | 169 | 80,301 | 136,024 | 39,248 |
| `packages/project-model` (114) | 95 | 54,364 | 67,843 | 27,093 |
| `packages/layout-core` (75) | 10 | 4,051 | 31,904 | 3,700 |
| `packages/camera-core` (9) | 3 | 2,190 | 5,690 | — |

| Hotspot | Lines | Closure files | Closure lines |
| --- | ---: | ---: | ---: |
| `packages/layout-core/src/layout-wall-first-precision.ts` | 3,930 | 54 | 30,837 |
| `packages/project-model/src/scene-planning/finish-planners.ts` | 3,024 | 152 | 77,507 |
| `packages/project-model/src/units/planning.ts` | 2,949 | 133 | 71,540 |
| `packages/project-model/src/units/validate.ts` | 2,063 | 117 | 64,605 |
| `packages/project-model/src/scene-planning/operations.ts` | 1,577 | 125 | 67,810 |
| `apps/editor/src/lib/authoring/look/finish-authoring.svelte.ts` | 2,292 | 302 | 125,850 |
| `apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts` | 2,054 | 303 | 125,770 |
| `apps/editor/src/lib/authoring/adapters/layout/precision.ts` | 1,858 | 194 | 94,383 |
| `apps/editor/src/lib/authoring/adapters/scene/placement.ts` | 1,652 | 296 | 123,171 |

Verification, from run `45529863261`:

| Lane | Files | Cases | Vitest wall | Notes |
| --- | ---: | ---: | ---: | --- |
| fast | 509 | 6,347 | 212 s | top 10 files are 42% of test time, top 20 are 56% |
| arch | 39 | 395 | 53 s | six source-walking files take 72.5 s of 102.6 s test time |
| heavy | 11 | 138 | 96 s | one file, `t1s06-persistent-pipeline`, is 84 s |
| API (TAP, Postgres) | 17 | — | 135 s job | 17 chained `vite-node` processes |

| Gate job | Seconds |
| --- | ---: |
| `npm run test:fast` | 247 |
| `npm run test:api` | 135 |
| `npm run test:heavy` | 127 |
| `npm run test:arch` | 86 |
| `npm run check` | 72 |
| `npm run build` | 65 |
| package checks | 49 |
| `npm run check:api` | 47 |
| `linux-x64` | 33 |
| check guards | 28 |
| classify | 18 |
| merge gate | 15 |
| **Total runner time** | **922 (≈ 15.4 min)** |

Setup (checkout, Node, `npm ci`) is about 30 s per job. Test execution dominates. X9's branch ran
the gate 30 times in eleven hours: 22 green, 1 red and 7 cancelled.

Agent bootstrap reading: the root and area `AGENTS.md` files, the docs router, the workflow, the
tests README, the CI page, the path map and the harness README total 982 lines. The tests README
alone is 415 lines, much of it history of PR #115.

## 4. Modularity audit

**A1. Closure factories and kind branch chains accumulate.** The longest functions in production:

| Lines | Function |
| ---: | --- |
| 1,954 | `createFinishAuthoring` in `apps/editor/src/lib/authoring/look/finish-authoring.svelte.ts` |
| 1,808 | `prepare` (14 `if (kind === …)` branches) in `packages/project-model/src/scene-planning/finish-planners.ts` |
| 1,715 | `createExperienceController` in `apps/editor/src/lib/authoring/experience/experience-controller.svelte.ts` |
| 1,463 | `createInkSession` in `apps/editor/src/lib/authoring/adapters/layout/ink-session.ts` |
| 1,196 | `createExperienceLens` in `apps/editor/src/lib/authoring/experience/experience-lens.svelte.ts` |
| 802 | `createFinishCard` in `apps/editor/src/lib/authoring/look/finish-card.svelte.ts` |
| 784 / 782 / 763 | `createStageShellCommands`, `createStageShellState`, `createStageInputArbiter` (`stage/route/`) |
| 745 / 669 / 633 / 619 | object-mark, region-gesture, placement-binding and opening-placement sessions |
| 551 / 487 / 483 / 457 / 452 / 431 | `executeWallChainCandidate`, `createPlanRetainer`, `certifyRoundRoom`, `planWallRemovalSet`, `planDissolveJunction`, `compileWallFirstWithPhysicalWalls` |

Appendix B lists all 71. X9 explicitly left most of the editor entries as follow-up: Finish
authoring, the Experience internals, adapters, Unfold gestures and further `stage-shell-state`
splits.

**A2. Barrels hide ownership and inflate closures.** There are 126 `export *` statements:
`layout-core` 63, `project-model` root 15, `units` 17, `scene-planning` 23 and `camera-core` 8.
The `layout-core` root has 118 importers. The `project-model` root re-exports `@portfolio/layout-core`,
so one Layout symbol is importable from two packages. `units/validate.ts` imports one codec helper
from the `layout-core` root and reaches the whole compiler: 117 files.

**A3. Files mix authorities or purposes.**

- `packages/project-model/src/units/planning.ts` holds the Camera View and Connection planners,
  thirteen Experience planners and the Scene Sky, Environment, Look and Treatment planners.
- `apps/editor/src/lib/authoring/adapters/layout/precision.ts` has 29 importers. Its lines 992–1,858
  hold pointer and frame geometry (`wallFrame`, `curvedWallFrame`, `wallStationFrame`,
  `wallLengthFromPointer` and others) that most importers want without the planners.
- `layout-wall-first-precision.ts` carries the topology validator
  (`validateWallFirstTopology`, `detectWallCurveTopologyCrossings`, closed-wall contacts) and private
  copies of vector helpers (`distance`, `subtract`, `add`, `scale`, `normalize`, `dot`).
- `units/validate.ts` validates Layout delegation, Scene, Camera, Experience, resources, envelope
  closure and frozen-JSON proofs, and serializes.

**A4. A flat kernel package.** `layout-core/src` has 75 files in one directory, all prefixed
`layout-`. Families (codec, compile, world index, wall chain, rooms, spaces, curves, round,
topology operations, snap, plan representation) are visible only through naming.

**A5. Test seams and measurement live in kernels.** Ten production files export 28 distinct
`*ForTest` setters or test observers; `layout-wall-first-precision.ts` alone mentions them 41
times. `packages/layout-core/src/p2311-perf.ts` threads 43 timing spans and 225 work-count sites
through 25 kernel files. It has two consumers: the `perf:spot` ledger
(`apps/editor/src/lib/platform/perf-work.ts`) and a second development-mark path gated by
`__P2311_PERF__`.

**A6. Development surfaces ship in production.** `apps/editor/src/routes/dev` holds 23 files and
5,813 lines (`s8-bench`, `s8-d`, `s8-e`, `s8-f`, `s8-g`, `s8-gates`, `s8-oracle`, `materials` and
`assets`) with no development-only gate, so they are served by the product deployment. Hard rule 4
names `/` and `/editor` as the product routes.

**A7. Orphaned tooling.** `apps/editor/perf` (63 files, 16,261 lines) mixes the ratified spot check
and bundle report with 22 slice-era Playwright acceptance flows, their runners and persistent-store
regressions. `apps/editor/scripts` (17 files) is mostly S8 gate machinery.
`apps/editor/experiments/webgpu-migration` is 6,972 lines with six editor tests.

**A8. History in code.** 260 roadmap identifiers (`T2.S4a`, `P23.11`, `R217.S15`, PR numbers) appear
in 144 production files. Comments are 16% of production TypeScript lines, and many file headers
narrate how the module arrived rather than what it owns.

**A9. Search noise.** A default repository search reads 2,496 text files and 1,137,748 lines:
prototypes 449,013, tests 221,783, production 283,151, `docs/roadmap` 79,231 and
`broad-research` 29,255. `.ignore` excludes only `docs/archive/`.

**A10. Package tests live in the app.** 133 test files under `apps/editor/tests/lib/{layout,
project-model,camera-core,geometry-core,experience,content}` import only workspace packages. They
run through the editor's Svelte-enabled config, and an agent working on a package must know to
look in the app. The README's "tests mirror `src/lib`" rule no longer holds either:
`tests/lib/authoring` is flat with 160 files, while `src/lib/authoring` has 18 feature folders.

## 5. The locality contract

These rules are promoted at closeout into `AGENTS.md`, `packages/AGENTS.md` and
`apps/editor/AGENTS.md`, replacing text rather than appending to it.

1. **One operation family per module.** A family shares inputs, outputs and invariants: Wall
   scalar edits, curve edits, Finish palette writes. A module holds one family and the private
   helpers only it uses.
2. **Budgets.** Production files stay at or below 600 lines (hard cap 800); functions stay at or
   below 200 lines. A closure factory counts as one function, so it composes sub-owners instead of
   growing. Data tables, such as the material catalogue, may be allowlisted by name. The allowlist
   only shrinks.
3. **The registry is the index.** Each authority has one planner registry (`createLayoutPlanners`,
   `createFinishPlanners`, `createUnitCandidatePlanners`, the Scene operation set) that maps each
   kind constant to the module that plans it. Adding an operation means one registry row and one
   family module; nothing else.
4. **Packages expose families, not barrels.** Each family folder's `index.ts` lists its public
   surface with explicit named exports and serves as the family's contract. `export *` is banned
   in `packages/*/src`. `package.json` exports one subpath per family, and consumers import the
   family. Inside a package, modules import siblings directly, never through an index.
5. **Import from the owner.** A package never re-exports another package's symbols.
6. **One home for shared helpers.** Each package has one vector/number helper module. Private
   copies are removed when a file is touched.
7. **No test seams in production.** Production code exports no `*ForTest` functions and keeps no
   module-level test state. A kernel that must be observed takes an optional observer in its
   existing options object. The one work observer is a declared port with one consumer.
8. **Comments state the current contract.** Roadmap identifiers, PR numbers and arrival history
   belong in Git. A header names what the module owns, what it refuses and its invariants.
9. **Tests live with their workspace.** Package tests live in `packages/<name>/tests`, mirrored to
   the package's families. Editor tests mirror `src/lib` feature folders.
10. **Extending.** When an addition shares a family's inputs and invariants and fits the budget,
    add it to the family. When it introduces a new authority, family or input shape, or would
    exceed the budget, create a new family module and register it. Never grow a closure factory:
    add a sub-owner. Never add a re-export.

Enforcement is one cheap arch check (LOC-0) over the shared import reader:

- the budgets, with a ratcheting allowlist;
- no `export *` in packages;
- no cross-package re-export;
- no exported `*ForTest` names;
- no import cycles among family folders.

## 6. Verification audit

**B1. Retirement and absence guards.** These tests prove that something deleted stays deleted:

| File | Lines | Cases | CI time | Subject |
| --- | ---: | ---: | ---: | --- |
| `tests/lib/visitor/room-frame-retirement.test.ts` | 116 | 7 | 24.6 s | Room frame removal; compiles the M grid twice |
| `tests/lib/project-model/directional-light-retirement.test.ts` | 196 | 11 | — | Directional kind and Scene 6 refusal |
| `tests/lib/legacy-isolation.test.ts` (arch) | 102 | 2 | 2.6 s | the relic externalized by PR #115 |
| `tests/docs/workflow-cutover.test.ts` (arch) | 176 | 9 | 0.2 s | a completed process cutover |
| `tests/lib/authoring/objects-panel-guard.test.ts` | 35 | 4 | — | removed controls stay out of source |
| `tests/lib/render/webgpu-experiment-isolation.test.ts` | 65 | 4 | — | experiment isolation (D6) |

The slowest fast-lane file is a retirement guard.

**B2. Historical and test-only references.** The P23B family is 29 files, 12,729 lines and 195
cases (32.5 s). It includes `p23b11-correspondence-reference.ts`, a 2,294-line test-only
reimplementation, and `p23b4-observed-reference.ts`. `t1s01-format6-differential.test.ts` compares
compiles against digests recorded at the last format-5 revision. `stage-pick-differential.test.ts`
replays winners captured on an older `main`. The S8 slice family (9 files, 3,411 lines) records
slice acceptance (`s8-pr-d-acceptance`, `s8-pr-e-acceptance`, `s8-pr-d-production-targets`,
`s8-characterization`, `tests/lib/dev/s8-*`).

**B3. Slice-organized suites.** 2,786 of 6,880 case titles (40%) carry roadmap identifiers, and 27
test files exceed 1,000 lines. `layout-wall-manipulation.test.ts` (3,293 lines, 94 cases) mixes
six slices; `spatial-route-gesture.test.ts` (2,988 lines, 121 cases, 23.7 s) mixes at least nine.
Slice-organized suites hide equivalence classes, which is how near-duplicate permutations
accumulate.

**B4. Source-shape assertions outside the arch lane.** 18 fast-lane files assert production source
text: `stage-handles`, `stage-paper`, `experience-shared-homes`, `playback`, `camera-paths`,
`stage-height-sheet`, `spatial-route-gesture`, `spatial-route-experience-homes` and others. This
breaks rule 6 of the tests README.

**B5. Duplicated harness helpers.** Local helpers are redefined across test files: `mount` 28 times,
`settle` 25, `eventually` 19, `wall` 18, `scene` 15, `box` 14, `documentOf` 13, `boot` 13 and
`stageCss`, `harness` and `acceptedLayout` 12 each. A `formatVersion` literal appears 193 times in
106 test files, so every format bump touches dozens of unrelated tests.

**B6. Misclassification.** Tooling tests run in the editor fast lane: `tests/harness`,
`tests/lib/perf`, `tests/e2e` and the bundle plugin, 19 files, 5,335 lines and 31 s. Package tests
run with the editor configuration (A10). One heavy file is 62% of the heavy lane. Lane membership
lives in a curated list (`apps/editor/test-lanes.ts`, 205 lines), proved by
`apps/editor/tests/config/lane-membership.test.ts`.

**B7. The arch lane re-reads the tree.** Each boundary file walks and parses `src` and `packages`
in its own worker. Six files take 10–15 s each, and the same contention makes the suite time out
locally under load.

**B8. CI profiles are unused.** The classifier sends Layout, adapters, sessions, saves, geometry,
schemas, every test edit and every configuration file to Full. That covers nearly all real work:
of the last 100 runs, 79 succeeded and none of those was Focused. The queue is inactive, so a pull request
tested against an old base merges untested against the new one.

**B9. Evidence machinery outweighs its signal.** The ledger defines 34 capabilities. Tests carry 40
`[cap:…]` markers across 18 of them, on 6,880 cases. Maturity and health are computed from those
markers through provenance artifacts, an aggregator, report discovery, a guard scan of the
TypeScript syntax tree and an issue-event workflow.

**B10. Compatibility and versioning residue.**

- `docs/reference/components/persistence.md` still describes "source-trial migrations" before a
  baseline. That contradicts the owner's no-migration stance.
- Compatibility branches survive in code:
  - the identity ledger is optional on read for "pre-P23.12 documents";
  - six legacy material ids stay resolvable;
  - a `legacy` texture row storage path and a `legacy` model-finish geometry kind;
  - a pending Save keeps "a recognizable incompatible Layout stamp";
  - a "pre-migration token-only baseline" in Save state;
  - a curve sampler for "legacy auto-bezier" segments.
- Version refusals are asserted in UI and adapter suites (for example 10 in
  `unit-acceptance-conformance`, 8 in `scene-editing-surface`) as well as in the codecs.
- The API applies 11 ordered SQL migrations.

## 7. The verification contract

**Purpose.** A test exists for one of three reasons:

- an editor workflow journey;
- a canonical invariant: hard rules, authority uniqueness, determinism, codec strictness or
  identity;
- a regression whose named defect it would catch.

Everything else is deleted. These rules extend the tests README's existing rules 1–25. Its
successor and mutation rules still decide whether a deletion needs a successor.

1. **No retirement tests.** Once a removal merges, its absence is not tested. The exception is an
   isolation boundary that ongoing work can still break, such as visitor/editor isolation.
2. **No historical oracles.** No test compares against an earlier revision's code, digest or
   capture. A golden is allowed only where the bytes are the contract: canonical serialization and
   the `geometry-core` pinned corpus.
3. **In-revision differentials only.** An optimized path may be checked against the plain path
   in the same revision (short-circuit against exhaustive, incremental against fresh). A test-only
   reimplementation of a kernel is not kept when such a differential exists.
4. **Lanes by filename.** `*.arch.test.ts` and `*.heavy.test.ts` belong to their lanes; everything
   else is fast. Union and disjointness then hold by construction. Budgets: a fast file ≤ 2 s on
   CI and the whole fast lane ≤ 90 s; a heavy file ≤ 20 s.
5. **Source text only in arch.** Source-shape assertions use the shared source index (VER-2) and
   live only in the arch lane.
6. **Contract names.** Suites and titles name the contract, never the slice.
7. **Versions through constants.** Tests take versions from the codec constants or fixture
   builders. Each format family has exactly one refusal test, in its codec suite.
8. **One kit.** Mounting, settling, polling and small Layout/Scene builders come from one test kit.
   A helper smaller than its import is still welcome locally.
9. **No timing assertions.** This rule is unchanged.

**CI design.** The design applies D1–D3 and D10. The required context is `merge gate`, which checks
`needs.*.result`.

| Event | Runs | Purpose |
| --- | --- | --- |
| `pull_request`, Markdown-only delta | whitespace check, documentation reference check | fast feedback |
| `pull_request`, any other delta | `svelte-check`; package checks with `check:api` in one job; fast lane in two shards; arch lane; build. Heavy runs when `packages/layout-core`, `camera-core` or `geometry-core` change; API with Postgres when `apps/api` or project-model persistence changes | lean signal on the branch |
| `merge_group` | every job, unconditionally | certifies the exact tree that lands on `main` |
| `workflow_dispatch` | every job | on demand |

The queue settings already prepared in [CI and merge automation](../../operations/ci-merge-automation.md)
are kept: single-entry merges, at most three entries validated concurrently, all green. Independent
pull requests never wait for each other before the queue, and inside it each is tested against
`main` plus the entries ahead of it. The `linux-x64` corpus runs with the `geometry-core` package
tests; the runner is already Linux x64.

**Versioning policy.** It replaces the persistence rule above. Until the owner declares beta, each
persisted format admits exactly one version. A format change bumps the number, and readers refuse
every other version with `unsupported_format_version`. There is no migration, conversion, dual
reader, optional-on-read field for older documents, compatibility fixture or historical
differential. Fixtures are regenerated in the same pull request. The database schema is one
baseline (D7) until beta.

## 8. Work packets

Packets are claimed as draft pull requests named by packet id. Each packet must:

- be a mechanical change, or a deletion under section 7;
- keep every unrelated test green;
- report its metric delta from `tools/metrics` (LOC-0);
- name its tier.

Code moves are cut-and-paste with import edits. They never change a signature, order, constant or
algorithm.

Proposed layouts below are shown in `text` blocks; `<proposed>` marks paths that do not exist yet.

### LOC-0: Metrics and budget ratchet (Tier 1, adds a check)

- A `tools/metrics` script, run with `vite-node`, reuses `apps/editor/tests/helpers/import-closure.ts`
  (one parser per grammar). It reports the section 3 tables as JSON and Markdown: size
  distribution, function lengths, closures, barrels, seams, roadmap ids and searchable lines.
- `locality-budgets.arch.test.ts` enforces section 5's checks with an allowlist seeded from today's
  exceedances. Later packets delete allowlist entries; none may add one.
- Acceptance: the script reproduces section 3 within 1%, and the check runs in under 1 s.

### LOC-1: Package entry points (Tier 1)

Land this packet alone, while no other pull request is open. It touches every importer.

1. Give each `layout-core`, `project-model` and `camera-core` family an `index.ts` with explicit
   named exports, and add one `package.json` subpath per family.
2. Codemod every importer to the family subpath. The codemod resolves each imported name through
   the barrel export map, using Appendix A's resolution.
3. Delete the root barrels' `export *` lines and `export * from '@portfolio/layout-core'` in
   `project-model`.
4. Update `program-entry-closure`, `layout-geometry-boundary` and `project-model-boundary` to the
   subpaths. Their closures shrink; their forbidden sets do not change.
5. Verify that the eager and lazy client closures in the bundle report do not grow, and that
   `svelte-check` and every package check pass.

Acceptance: 0 `export *`; editor median closure ≤ 45,000 lines; `project-model` median ≤ 30,000.

### LOC-2: Wall precision family (Tier 1)

```text
<proposed> packages/layout-core/src/precision/
  index.ts                  public planners, intents, PrecisionPlan, PrecisionRejection
  types.ts                  operation, intent and result types
  finalize.ts               finalizeCandidate, finalizeWallGeometryCandidate, Room identity assertion, guarded allocator
  junction-wall.ts          exact Junction move, rigid Wall move, length, angle, thickness, height, subdivision
  open-side.ts              Space open-side offset and end slide
  curve.ts                  convert, knot insert/move/delete, bend, proposed curve shape
  architecture-proposal.ts  drag proposal, candidate splice, affected extent, verdict scope, preflight
  rectangle.ts              exact rectangle dimensions, resolveRectangle
  objects.ts                presets, object transform and delete
<proposed> packages/layout-core/src/topology/
  wall-first-topology.ts    validateWallFirstTopology, closed-Wall contacts
  curve-crossings.ts        detectWallCurveTopologyCrossings
<proposed> packages/layout-core/src/vec2.ts   the package's one vector/finite-number helper module
```

Acceptance: no file > 600 lines; the `junction-wall` closure ≤ 12,000 lines. No test changes
except imports.

### LOC-3: Kernel families (Tier 1; camera files are hard-rule-1 territory, so moves only)

Fold the flat `layout-core/src` into family folders and drop the redundant `layout-` prefix.
Split each long function into named phases called in the identical order. The existing geometry
and identity tests pin the result.

| Source | Families |
| --- | --- |
| `layout-geometry.ts` (3,090) | compile session; compile entry and Space preflight; physical Walls; Junctions; Rooms, Openings and objects; query records and bounds |
| `layout-world-index.ts` (2,222) | copy-on-write candidates; delta verification; certified index build and patch; planar combinatorial map; record validation |
| `layout-wall-chain.ts` (2,633) | chain planning; candidate execution; noding and tee fixes; virtual-edge absorption; arcs |
| `layout-room-reconciliation.ts` (2,056) | boundary lookup and composition; correspondence; reconciliation; split/merge survivors; portal remap |
| `layout-plan-representation.ts`, `layout-junction-resolution.ts`, `layout-wall-development.ts`, `layout-geometry-delta.ts`, `layout-snap.ts`, `layout-wall-first-codec.ts`, `layout-round-room.ts`, `layout-wall-topology-ops.ts`, `layout-geometry-curve.ts`, `layout-round-ops.ts` | split by the exported families listed in Appendix B |
| `packages/camera-core/src/camera-motion.ts` (2,083), `viewport.ts` (1,773) | route sampling, guards and curve evaluation; projection and framing. One folder each, no behavior change |

### LOC-4: Finish planners (Tier 1)

`prepare` becomes a context plus one function per kind. Each closure that captured `request`,
`kind` or `options` becomes a member of a context built once per call. Each branch body moves
verbatim, with its check order preserved. `finish-planners.test.ts` (1,775 lines) splits along the
same seams.

```text
<proposed> packages/project-model/src/scene-planning/finish/
  index.ts         createFinishPlanners: kind → plan function (the index)
  context.ts       envelope, before, header, reader, reference(), scope, complete(), materialGrant(),
                   resolveDerivedAssign(), withResources(), readProjectFinish()
  readers.ts       payload readers (edit, targets, surface refs, register images, patch edits)
  assign.ts  surface-assign.ts  colour-coat.ts  edit.ts  register.ts
  rename-remove.ts  patch.ts  from-image.ts  palette.ts
```

The existing `finish-model.ts`, `finish-treatment.ts`, `finish-inspect.ts` and `colour-coat.ts`
join the folder. Acceptance: no module > 450 lines; one operation's closure ≤ 20,000 lines.

### LOC-5: Unit planning by authority (Tier 1)

```text
<proposed> packages/project-model/src/units/planning/
  index.ts               createUnitCandidatePlanners, createUnitAcceptanceProfile
  shared.ts              refusal, envelope, revision, reference and capture helpers
  camera-view.ts         CAMERA_VIEW_UPDATE
  camera-connection.ts   CAMERA_CONNECTION_CREATE / UPDATE, anchors and timing
  experience/            create, capture-bind (phased), guide, stop, presentation, update, removal
<proposed> packages/project-model/src/scene-planning/environment.ts
                         SCENE_ENVIRONMENT_SET, SCENE_SKY_UPDATE, SCENE_LOOK_APPLY / RESTORE, SCENE_TREATMENT_SET
```

The Scene planners move to the Scene planning family, so Camera, Experience and Scene authorities
no longer share a file. Registration stays in the unit candidate registry.

### LOC-6: Unit validation by domain (Tier 1)

Split `units/validate.ts` into envelope (including `envelopeFindings`, split per finding family),
dependency lock, Scene, Camera, Experience, resource, frozen-JSON proof and serialization modules.
Each domain validator imports only its own codec through its `layout-core` family subpath.
Acceptance: the Camera validator's closure ≤ 6,000 lines.

### LOC-7: Scene operations (Tier 1)

Split `scene-planning/operations.ts` into transform (move, yaw, lift, resize, place on floor),
Form (create, copy, size, profile), lifecycle (name, duplicate, delete), support and finalization.
`intent-payload.ts` (1,074) follows the same families.

### LOC-8: Editor adapter hubs (Tier 1)

- Split `adapters/layout/precision.ts`: pointer and frame geometry moves out of the planner module,
  and its 29 importers import only what they use.
- Split `layout-contributions.ts`: `markDescriptors` (515) and the contribution factory become
  per-contribution modules (marks, Card facts, Room actions).
- Decompose `ink-session.ts` and `adapters/scene/placement.ts` (1,652, 16 importers) into
  sub-owners.

### LOC-9: Factories to entries and sub-owners (Tier 1)

Apply X9's entry and sub-owner rules (EC1–EC4, no sibling runtime imports) to the A1 factories:
Finish authoring, the Experience controller and lens, Finish Card, Stage shell commands, state and
input, the object-mark, region, placement and Opening sessions, the contribution view, Unfold
gestures, Material import, Save state and the plan pick provider.

Method:

1. List the state each nested function closes over.
2. Group the functions by shared state.
3. Make each group a sub-owner, keeping any rune-holding sub-owner in a `.svelte.ts` module.
4. Compose the groups in the entry.

`LIFECYCLE_ORDER` and the mounted reactive-semantics tests stay the contract. Split components of
more than 800 lines (`ExperienceGuide.svelte` 1,983, `LibraryMaterialEditor.svelte`, `EditorIndex.svelte`,
`StageLibrary.svelte`, `VisitorPreviewSurface.svelte`, `FinishCardSection.svelte`, `WorldToolbar.svelte`)
into child components along markup regions whose state is local. One packet per feature, parallel
across features.

### LOC-10: Kernel seams and instrumentation (Tier 1)

- Rename `p2311-perf.ts` to a work-observer module.
- Keep only the spans and counts that the `perf:spot` ledger reports or that a retained count
  oracle reads. Delete the rest, and delete the `__P2311_PERF__` development-mark path.
- Replace each `*ForTest` setter with an optional observer on the kernel's existing options, or
  delete it with the test that used it (VER-4).

Acceptance: 0 exported `*ForTest` names; `perf:spot` output unchanged in shape.

### LOC-11: Production surface and tooling subtraction (Tier 1, D6)

- Delete the `routes/dev/s8-*` routes, the S8 scripts and their `tests/lib/dev` tests.
- Put the `dev/materials` and `dev/assets` tools behind a development-only 404. That is the
  reversible default; delete them instead if the owner prefers.
- In `perf`, keep `spot.ts`, the bundle report and provenance, `generate-workloads.ts`, `serve.mjs`
  and `perf/lib` that these use. Delete the slice-era flows and their runners, `retired-suite.mjs`
  and `regressions/`.
- Delete the WebGPU experiment under D6.

### LOC-12: History and search hygiene (Tier 0, D4, D5)

- Extend `.ignore` (D5) and apply D4.
- Delete completed roadmap plans whose slices have merged, extracting any enduring rule first.
- Rewrite production comments that cite roadmap ids or arrival history; this is suitable for a
  mechanical-edit agent.
- Compress the agent bootstrap: tests README ≤ 150 lines, CI page ≤ 60, workflow ≤ 90.

### VER-0: Canaries, journeys and baselines (Tier 0, before any deletion)

- A canary corpus of at least 40 patch files, each a realistic defect mapped to the tests that
  should catch it, with a runner that applies each one in a scratch worktree. Coverage: every hard
  rule, codec strictness (admits N−1, admits an unknown key), each authority's planners, Undo
  grouping, selection requalification, conditional Save, compile determinism, Room identity,
  Experience lowering order and API ownership.
- A journey map: each of the 34 ledger capabilities names at least one behavioural test.
- Per-file CI durations recorded as the baseline (Appendix A).
- Any canary that survives at baseline gets a test first. The runner is on demand: deletion packets
  run it, and CI never does.

### VER-1: Lanes by filename and package-local tests (Tier 1, D9)

- Rename arch and heavy files to their suffixes, configure lanes by glob, and delete
  `test-lanes.ts` and `lane-membership.test.ts`.
- Move the 133 package-pure test files to `packages/<name>/tests`, mirrored to the families created
  by LOC-2 to LOC-7. Each package gets a Node-environment Vitest config without the Svelte plugin
  and a `test` script; the root `test` runs every workspace.
- Re-mirror `tests/lib/authoring` into feature folders. Boundary roots computed from
  `import.meta.url` are updated in the same commit.

### VER-2: Shared arch source index (Tier 1)

- A Vitest global setup builds one source index through the shared reader, once per run: files,
  comment-stripped text and import specifiers.
- Arch suites read the index instead of walking the tree. Merge the 39 arch files into about 12
  contract files: isolation, authority uniqueness, render layering, package direction,
  composition/ownership and documentation.
- Map every surviving assertion old to new, the way X9's Appendix B did.

Acceptance: arch lane ≤ 20 s on CI; no guarantee lost.

### VER-3: Retirement and historical subtraction (Tier 2 under D9)

- Delete the B1 files except the WebGPU guard, which follows D6.
- Delete `t1s01-format6-differential`, the captured-`main` replay in `stage-pick-differential`
  (keep its live-registry fallback case), `workflow-cutover` and the S8 slice-acceptance suites
  whose assertions duplicate the Finish planner or catalogue suites. Prove each duplicate claim
  under the README's rules 1–4.
- Directional-light refusal reduces to one unknown-kind case in the Scene codec suite.

### VER-4: P23B and S06 consolidation (Tier 2 under D9)

- Keep the in-revision differentials: short-circuit against exhaustive correspondence, pruning
  neutrality and incremental against fresh compile. Keep the identity falsifiers.
- Delete the frozen references (`p23b11-correspondence-reference.ts`, `p23b4-observed-reference.ts`),
  the observation collectors and the measurement files.
- Reduce `t1s06-persistent-pipeline` from 84 s to at most 15 s. Keep one sustained sequence per edit
  kind; the per-step equivalence is the invariant, not the sequence length.
- Target: the family drops from 12,729 lines to at most 3,000, keeping every canary killed.

### VER-5: Contract suites (Tier 1)

- Reorganize the 27 files over 1,000 lines and the `tests/lib/authoring` and `tests/lib/layout` trees
  by contract.
- Collapse near-duplicate permutations to one case per equivalence class, except where density is
  the proof (rules 12–14 and 21).
- Strip slice ids from titles.
- Target: −25% cases in those trees.

### VER-6: Source-shape tests (Tier 1)

Convert each B4 file to behavioural proof, move it into the arch index, or delete it as a
retirement guard.

### VER-7: Test kit and version constants (Tier 0)

Add one `tests/kit` for mounting, settling, polling, boot and the small Layout and Scene builders,
and replace the B5 copies. Fixture builders take versions from the codec constants.

### VER-8: Tooling tests out of the editor lanes (Tier 1)

- Move harness tests to `node:test` under `tools/` (or delete them under D1) and perf tests under
  `perf/`.
- Make the documentation reference check a plain Node script run by the docs job. It keeps the
  shared Markdown reader.

### VER-9: CI and harness (Tier 2, D1–D3, D10)

- Implement the section 7 workflow: the simplified classifier, the two fast shards, the conditional
  heavy and API jobs, and the `needs`-based gate.
- Under D1, delete `aggregate`, `report`, `discover`, `produce`, `guards`, `event-context`,
  `issue-rules`, `issue-response`, `linked-fixes`, `ledger` and the maturity half of `status`, plus
  the issue-guards workflow.
- Remove the 40 `[cap:…]` markers and update the CI page and workflow text.
- The owner activates the queue (D2) with the existing ruleset command after this merges.

### VER-10: API verification (Tier 1, D7)

- Run the 17 API test files from one process after the single build. Today each starts its own
  `vite-node`.
- Under D7, squash the migrations into one baseline and keep the advisory-lock test.

Target: API job ≤ 90 s.

### VER-11: Versioning hardening (Tier 2: persistence rule)

- Replace the persistence rule with section 7's policy.
- For each B10 compatibility branch, prove that no current-format document can reach it, then
  delete the branch and its tests.
- Keep one refusal test per format family (N−1, N+1, missing) in the codec suites, and delete the
  scattered refusal assertions in UI and adapter suites.

## 9. Acceptance criteria

All criteria are measured by the LOC-0 script and the gate's Vitest reports on the closeout
revision. Each row's baseline is section 3.

| Area | Criterion | Baseline | Target |
| --- | --- | ---: | ---: |
| Locality | production lines | 281,951 | ≤ 268,000 |
| Locality | files ≥ 1,000 lines / ≥ 600 lines | 50 / 140 | ≤ 3 / ≤ 50 |
| Locality | functions ≥ 250 lines; longest | 71; 1,954 | ≤ 8; ≤ 300 |
| Locality | median closure, editor module | 80,301 lines | ≤ 35,000 |
| Locality | p90 closure, editor module | 136,024 lines | ≤ 95,000 |
| Locality | median closure, `project-model` module | 54,364 lines | ≤ 12,000 |
| Locality | p90 closure, `layout-core` module | 31,904 lines | ≤ 15,000 |
| Locality | read set for one Wall length edit (module + test) | 3,930 + 3,293 lines | ≤ 600 + ≤ 600 |
| Locality | read set for one Finish operation (module + test) | 3,024 + 1,775 lines | ≤ 450 + ≤ 400 |
| Locality | `export *` / cross-package re-exports / exported test seams | 126 / 1 / 28 | 0 / 0 / 0 |
| Locality | roadmap ids in production source | 260 | 0 |
| Locality | default-searchable text | 1,137,748 lines | ≤ 560,000 |
| Locality | agent bootstrap documents | 982 lines | ≤ 450 |
| Tests | Vitest cases | 6,880 | ≤ 4,800 |
| Tests | test code (editor + API) | 215,485 lines | ≤ 140,000 |
| Tests | test files > 1,000 lines | 27 | 0 |
| Tests | titles carrying slice ids | 2,786 | 0 |
| Tests | fast-lane files asserting source text | 18 | 0 |
| Tests | `formatVersion` literals in tests | 193 | ≤ 1 per format family |
| CI | pull-request wall time, p50 | 5 min 19 s | ≤ 3 min |
| CI | runner time per pull-request push | ≈ 15.4 min | ≤ 7 min |
| CI | fast / arch / heavy lane | 212 / 53 / 96 s | ≤ 90 / 20 / 45 s |
| CI | merge-group certification | none | every merge, ≤ 5 min wall |
| CI | harness code + its tests (D1) | 4,230 + 3,797 lines | ≤ 600 + ≤ 300 |
| CI | required contexts (D3) | 3 | 1 |
| Correctness | canaries killed | not measured | 100% at baseline and at closeout |
| Correctness | ledger capabilities with a behavioural journey | not mapped | 34 of 34 |
| Correctness | characterization and mounted-journey assertions changed by a move | — | 0 |
| Correctness | eager client bundle closure | X9 record | not larger |

## 10. Sequencing, parallelism and rollback

| Wave | Packets | Runs in parallel with | Notes |
| --- | --- | --- | --- |
| 0 | VER-0, LOC-0 | each other | baselines before anything moves |
| 1 | VER-3, VER-4, VER-6, VER-8, LOC-11, LOC-12, VER-9 (once D1–D3 are ruled) | each other; disjoint files | subtract first, so later moves carry less |
| 2 | LOC-1 | nothing | codemod over every importer; land it quickly |
| 3 | LOC-2 and LOC-3 (layout-core), LOC-4 to LOC-7 (project-model), each with its VER-1 test move | each other by file family | packages first, so editor imports settle once |
| 4 | LOC-8, LOC-9 (one packet per feature), VER-5, VER-7 | each other by feature | the editor's tests move into feature folders here |
| 5 | VER-2, VER-10, VER-11, LOC-10 | each other | then closeout: promote section 5 and 7 rules, delete this plan |

Every packet reverts on its own. Moves keep the old module's public names until the packet's own
importers move, so a revert never strands a caller. Deletion packets list each deleted file and its
canary results in the pull request.

## 11. Risks and stop conditions

**Stop and report to the owner** in any of these cases:

- a move needs a characterization, mounted-journey or digest assertion to change;
- a canary survives a deletion;
- a split needs a new import cycle, a sibling runtime import between sub-owners, or a changed
  `LIFECYCLE_ORDER`;
- the eager client closure grows;
- a performance trigger in the performance contract applies (`perf:spot` then runs as that
  contract says).

**Risks.**

- **Codemod conflicts with in-flight work.** LOC-1 runs alone. Feature packets run per feature, and
  a branch that would cross another's reservation waits.
- **Rune semantics in sub-owners.** Code that holds `$state` or `$derived` stays in a `.svelte.ts`
  module. Moving a closure must not turn a live reference into a copied value; the mounted
  reactive-semantics tests are the check.
- **Deleting the only proof.** The canaries, rules 1–4 and the journey map cover this. A deletion
  without canary evidence is not merged.
- **Queue without lean PRs.** If D2 is declined, Full remains on pull requests, and only the fast
  sharding and subtraction savings apply.

## Appendix A. Measurement method

- **Sizes:** `git ls-files` over `apps/editor/src`, `packages/*/src` and `apps/api/src`, counted with
  `wc -l`.
- **Functions:** top-level and one-tab-indented function or arrow declarations, measured to their
  closing brace at the same indent.
- **Closures:** a graph of static and dynamic `import` and `export … from` specifiers, resolved
  through `$lib`, relative paths and each workspace `package.json` `exports`, with type-only edges
  included. "Barrels resolved" maps each name imported from an `index.ts` to its defining module
  through `export *` and named re-exports.
- **Tests:** the `harness-test-{fast,arch,heavy}` Vitest JSON artifacts of run `45529863261`. File
  time is `endTime − startTime`; case time is the reported duration.
- **CI:** job and step timestamps of the same run, and the last 100 Merge gate runs (79 successful).
- **Search:** `rg --files` minus binary media, counted with `wc -l`.

LOC-0 turns this method into the committed script; its first output replaces these figures if
they differ.

## Appendix B. Inventories

**All functions of 250 lines or more (71, 36,211 lines).** The first 45:

```text
1954 createFinishAuthoring            1808 prepare (finish planners)        1715 createExperienceController
1463 createInkSession                 1196 createExperienceLens              802 createFinishCard
 784 createStageShellCommands          782 createStageShellState             763 createStageInputArbiter
 745 createObjectMarkSession           669 createRegionGestureSession        633 createPlacementBinding
 619 createOpeningPlacementSession     603 createContributionView            592 createStageUnfoldGestures
 551 executeWallChainCandidate         527 runE7Gate (dev route)             524 createMaterialImportSession
 515 markDescriptors                   503 createSaveState                   499 createPlanPickProvider
 489 createSceneModelRepresentation    488 createStageExperienceBinding      487 createPlanRetainer
 483 certifyRoundRoom                  481 createLayoutInstrument            479 createStageSession
 457 planWallRemovalSet                452 planDissolveJunction              432 createSceneContributions
 431 compileWallFirstWithPhysicalWalls 420 createCaptureBindPlanner          417 createExperiencePlayback
 411 planWallChainInternal             406 createLightPlacementSession       404 createLightLookThrough
 394 familyArmed (WorldToolbar)        384 createProfileRevisionSession      382 createObjectDrawSession
 378 createStudioController            376 tryCompileWallFirstLayoutGeometryDelta
 369 createStagePainter                368 createCameraSession               362 envelopeFindings
 359 createAppearanceIssues
```

**Slowest fast-lane files** (CI seconds / cases): `room-frame-retirement` 24.6 / 7;
`spatial-route-gesture` 23.7 / 121; `spatial-route-experience-homes` 15.8 / 55; harness
`gate-production` 11.7 / 49; `layout-candidate-memo` 7.4 / 17; `p23b11-correspondence-reference`
6.2 / 38; `t1s06-incremental-compile` 6.2 / 10; `stage-paper` 5.0 / 29; harness `event-context`
4.5 / 12; `camera-output-conformance` 4.5 / 11; `t1s06-area-certificate` 4.4 / 1; harness
`capability-status` 4.4 / 18.

**Slowest arch files** (CI seconds): `scene-adapter-boundary` 14.7, `integration-ownership` 13.5,
`stage-shell-composition` 12.2, `light-adapter-boundary` 12.0, `material-factory-boundary` 10.0,
`light-realizer-boundary` 9.9, `compile-entry-boundary` 5.8, `documentation-references` 5.1.

**Subtraction families** (lines / cases / CI seconds): P23B 12,729 / 195 / 32.5; S06 and format-6
1,581 / 60 / 99.7; S8 slice acceptance 3,411 / 79 / 0.9; retirement guards 690 / 37 / 27.6; harness,
perf and e2e tooling in the fast lane 5,335 / 163 / 31.4; WebGPU experiment tests 1,329 / 48 / 0.6;
open-space slice suites (rename and merge, not delete) 2,908 / 83 / 1.3.
