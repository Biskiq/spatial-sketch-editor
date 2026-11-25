# Locality and lean verification: audit and plan

**Status:** owner-approved 2026-11-24 (D1–D4 and Biome, section 2); nothing here changes code,
tests or CI. **Base:** `main` at
`6b62f7241` (X9, PR #413). **Evidence:** this tree, Merge gate run `45529863261` (X9's last full
run) and a Biome 2.6.9 trial on a copy of the tree (section 7). Every figure is measured or
counted; Appendix A gives the method. **Tier:** 2 for the plan. Each packet carries its own tier.

This is multi-PR work under the [workflow](../../workflow.md). Section 9 gives the order:

1. This pull request merges the approved plan.
2. Five wave pull requests carry the packets, one commit per packet.
3. The closeout commit, last in the fifth, promotes the rules of sections 5 and 7 into the routed
   contracts and deletes this directory.

## 1. Summary

The boundaries are sound after X9, but the modules are not. Changing one Finish operation means
reading a 3,024-line planner whose `prepare` function alone is 1,808 lines. The median editor
module transitively reaches 169 files and 80,301 lines, 45% of the editor. The test code
(206,714 lines) is 73% the size of the production code. Code changes always run the Full CI
profile: 5 min 19 s wall and about 15 runner-minutes per push. Nothing revalidates a pull request
against `main` after another pull request merges.

| Measure | Today | Target |
| --- | --- | --- |
| Production files ≥ 1,000 lines | 50 (83,415 lines) | 0 outside justified algorithm exceptions |
| Functions ≥ 250 lines | 71 (36,211 lines); longest 1,954 | ≤ 10, each a justified exception |
| Median transitive closure, editor module | 80,301 lines | ≤ 35,000 |
| Representative agent read sets (section 3) | 8,300–22,700 lines | ≤ 2,500–6,000 |
| `export *` in workspace packages | 126 | 0 |
| Searchable text | 1,137,748 lines | ≤ 560,000 |
| Vitest cases; test code | 6,880; 215,485 lines | ambition ≈ 4,800; ≈ 140,000 (not quotas) |
| Pull-request run | 5 min 19 s, ≈ 15.4 runner-min | ≤ 3 min, ≤ 7 runner-min once the queue is active |
| Revalidation after another merge | none | every merge, on the updated `main` |

**Why context is expensive:**

1. **Barrels.** Barrel `export *` re-exports make one import pull in a whole package:
   `project-model` re-exports all of `layout-core`. Resolving barrel imports alone halves the
   median editor closure, but it leaves agent read sets unchanged.
2. **Accumulating closures.** Operations accrete inside `create*` factory closures and
   `prepare(kind)` branch chains, because the shared state lives there.
3. **Mixed files.** One file holds Camera, Experience and Scene planners, and other files mix
   planners with geometry helpers or validators.
4. **Search noise and history.** Production is 25% of searchable text; prototypes are 39%.

**Why verification is heavy:**

1. **Slice organization.** Suites are organized by the roadmap slice that added them.
2. **Stale tests.** Retirement guards and historical captures outlive their subjects.
3. **No profile selection.** Every code change runs Full.
4. **Oversized evidence machinery.** A 4,230-line evidence harness with 3,797 lines of its own
   tests serves 40 tagged test titles.

## 2. Scope, invariants and decisions

**In scope:** mechanical extraction and relocation in `apps/editor/src`, `apps/api/src` and
`packages/*/src`; package entry points; dead tooling, development routes, test seams and
compatibility branches; test subtraction and reorganization; lanes, CI and the harness; Biome;
pre-alpha versioning; and the rules that keep the result.

**Out of scope:** features, algorithm or numeric changes, renderer work, performance work, and
fixes for the defects in section 8.

**Preserved:**

- semantic authorities and canonical algorithms, including their call order;
- product behavior, authentication, security hooks and persistence semantics;
- visitor isolation;
- the X9 composition contract;
- the `perf:spot` and bundle reports.

**Owner decisions, approved 2026-11-24:**

| # | Decision | Ruling |
| --- | --- | --- |
| D1 | The capability evidence harness: maturity and health computation, provenance artifacts, check guards and issue guards | Retire it. `npm run status` keeps focus, holds, flags, claims and the latest `main` gate result. `capabilities.json` keeps ids, anchors and surfaces as the journey inventory. The required contexts become `merge gate` alone |
| D2 | Merge-queue activation (owner action, with the prepared ruleset) | The owner activates it after PR 1 merges. Pull requests stay on Full until VER-9b, in PR 5, confirms that the queue runs cleanly |
| D3 | Adopting the squashed migration baseline on existing databases | Adopt it non-destructively after a read-only schema comparison (section 7). No destructive write to a non-disposable database without the owner's explicit sign-off |
| D4 | Check removal, which is Tier 2 | Section 7's deletion rules are approved once. A deletion that cites them, backed by VER-0 canaries and successor proof, merges after normal review |

**Minor decisions, resolved here:**

- `docs/archive/` stays in the tree and stays search-ignored.
- `prototypes/`, `broad-research/`, `Repo-Audit/` and `review/` become search-ignored; explicit
  paths still work.
- The WebGPU migration harness stays as owner tooling. Its harness tests leave the product lanes,
  while tests of product WebGPU code stay.
- The budget ratchet stays (section 5).
- The weekly scheduled Full run ends once the queue is active; manual dispatch remains.
- Biome alone is adopted on the trial evidence (section 7); the owner confirmed it. ESLint is added
  only if a second rune-typed defect of the same class appears.

## 3. Baseline

| Production code | Value |
| --- | --- |
| Files, lines (`.ts`, `.svelte`, `.js`, `.mjs`) | 876, 281,951 |
| Files ≥ 1,500 / ≥ 1,000 / ≥ 600 lines | 24 / 50 / 140 |
| Functions ≥ 250 lines | 71, holding 36,211 lines (13%) |
| Median closure, editor / `project-model` / `layout-core` module | 80,301 / 54,364 / 4,051 lines |
| The same, with barrel imports resolved to their defining modules | 39,248 / 27,093 / 3,700 lines |
| `export *` statements; `layout-core` root importers | 126; 118 |
| Exported test seams (`*ForTest`, test observers) | 28 in 10 kernel files |
| Kernel instrumentation | 43 timing spans, 225 work counts, 25 files |
| Roadmap identifiers in production source | 260 in 144 files |

**Representative agent read sets.** A read set is the module itself plus the defining modules of
its direct imports, which is what an agent opens to change one operation. Barrel removal does not
change these numbers because the definers are themselves oversized. Only the splits shrink them,
so LOC-0 measures each row again after LOC-1 and after each split.

| Task: module | Own | Direct definers | Closure → barrels resolved | Read-set target |
| --- | ---: | ---: | ---: | ---: |
| Wall length edit: `packages/layout-core/src/layout-wall-first-precision.ts` | 3,931 | 31 files, 18,745 | 30,837 → 30,837 | ≤ 6,000 |
| Finish operation: `packages/project-model/src/scene-planning/finish-planners.ts` | 3,025 | 25 files, 10,148 | 77,507 → 49,465 | ≤ 4,000 |
| Camera payload validation: `packages/project-model/src/units/validate.ts` | 2,064 | 20 files, 9,319 | 64,605 → 34,162 | ≤ 3,000 |
| Experience Stop planner: `packages/project-model/src/units/planning.ts` | 2,950 | 16 files, 7,091 | 71,540 → 41,097 | ≤ 4,000 |
| Paint tray state: `apps/editor/src/lib/authoring/look/finish-authoring.svelte.ts` | 2,293 | 27 files, 11,576 | 125,850 → 92,549 | ≤ 5,000 |
| Wall frame helper: `apps/editor/src/lib/authoring/adapters/layout/precision.ts` | 1,859 | 27 files, 18,056 | 94,383 → 47,905 | ≤ 3,000 |
| Library route: `apps/api/src/app.ts` with `apps/api/src/form-library.ts` | 3,160 | 13 local files, 5,189 | — | ≤ 2,500 |

**Verification.**

| Lane | Files | Cases | CI wall | Concentration |
| --- | ---: | ---: | ---: | --- |
| fast | 509 | 6,347 | 212 s | top 20 files are 56% of test time |
| arch | 39 | 395 | 53 s | six tree-walking files take 72.5 s of 102.6 s |
| heavy | 11 | 138 | 96 s | `t1s06-persistent-pipeline` alone takes 84 s |
| API (Postgres) | 17 | — | 135 s job | 17 chained `vite-node` processes |

Total runner time is 922 s per full run, and setup is about 30 s per job.

- **Profile use.** Of the last 100 runs, 79 succeeded and none of those was Focused.
- **Run volume.** X9's branch ran the gate 30 times in eleven hours.
- **Bootstrap.** Agent bootstrap reading totals 982 lines. The tests README alone is 415 lines,
  and both the root and area `AGENTS.md` files open with eager "Read first" link lists.

## 4. Modularity audit

**A1. Accumulating functions.** The largest are listed below; Appendix B lists the rest.

- Editor factories: `createFinishAuthoring` (1,954), `createExperienceController` (1,715),
  `createInkSession` (1,463), `createExperienceLens` (1,196), `createFinishCard` (802), and the Stage
  shell commands, state and input factories (≈ 780 each).
- Finish planners: `prepare` (1,808), one function holding 14 `if (kind === …)` branches.
- Kernel functions: `executeWallChainCandidate` (551), `certifyRoundRoom` (483) and
  `compileWallFirstWithPhysicalWalls` (431).

X9 deferred the editor factories to this follow-up.

**A2. Barrels.** `layout-core` has 63 `export *` statements, the `project-model` root 15, `units`
17, `scene-planning` 23 and `camera-core` 8.

- The `project-model` root re-exports `@portfolio/layout-core`, so each Layout symbol has two
  import paths.
- `units/validate.ts` reaches the whole compiler (117 files) for one codec helper.

**A3. Mixed files.**

- `units/planning.ts` holds Camera View and Connection planners, 13 Experience planners and the
  Scene Sky, Environment, Look and Treatment planners.
- `adapters/layout/precision.ts` has 29 importers. Its lines 992–1,858 are pointer and frame
  geometry, which most of those importers want without the planners.
- `layout-wall-first-precision.ts` also holds the topology validator and private copies of vector
  helpers.

**A4. Flat kernel.** `layout-core/src` holds 75 files in one directory, every name prefixed with
`layout-`.

**A5. Seams and instrumentation in kernels.**

- Ten files export 28 test seams.
- `packages/layout-core/src/p2311-perf.ts` threads spans and counts through 25 files. Its consumers
  are the `perf:spot` ledger (`apps/editor/src/lib/platform/perf-work.ts`) and a second
  `__P2311_PERF__` development-mark path.

**A6. Development routes in production.** `apps/editor/src/routes/dev` holds 23 files and 5,813
lines (seven S8 gate routes, `materials`, `assets`). Nothing gates them to development builds, so
the product deployment serves them.

**A7. Orphaned tooling and assets.**

- `apps/editor/perf` (63 files) mixes the ratified spot check and bundle report with 22 slice-era
  acceptance flows, their runners and persistent-store regressions.
- `apps/editor/scripts` is mostly S8 gate machinery.
- `chopin-salon_l.webp` is the only tracked binary that nothing references.
- `apps/.c2-test-fast.log` and an empty `.cursor/` are untracked and ignored, and `.gitignore`
  still lists retired P23B capture paths.

**A8. The API.** `apps/api/src/app.ts` (1,329 lines) is one `createApp` of about 950 lines. It
holds:

- the security hooks: secure session, origin and CORS checks, the error handler and pool shutdown;
- seven route families: health, auth with the test-auth seam, projects, publication, models,
  library and assets.

`apps/api/src/form-library.ts` (1,831) is the library dispatcher for forms and material Finishes.
It mixes shared storage with the operations themselves:

- shared storage: idempotency receipts, staging rows, object keys, image sniffing, copying and
  verification, and reclamation;
- the form operations and the material operations;
- thumbnails and a 300-line transfer.

`model-persistence.ts` (1,287) and `image-repair.ts` (845) exceed the budget as well.

**A9. Package tests in the app.** 133 test files under `apps/editor/tests/lib/` import only
workspace packages. They live in `layout`, `project-model`, `camera-core`, `geometry-core`,
`experience` and `content`, yet run through the editor's Svelte configuration. `tests/lib/authoring`
is flat (160 files) while `src/lib/authoring` has 18 feature folders.

## 5. The locality contract

At closeout these rules go into `AGENTS.md`, `packages/AGENTS.md`, `apps/editor/AGENTS.md` and
`apps/api/AGENTS.md`, replacing the text they supersede.

1. **One operation family per module.** A family shares inputs, outputs and invariants. A module
   holds one family and the private helpers only it uses.
2. **Budgets with a ratchet.** Files stay at or below 600 lines (hard 800) and functions at or below
   200. A closure factory counts as one function. The allowlist shrinks as packets land. An entry
   may be added only with a one-line reason accepted in review, for one of two cases:
   - a data table;
   - a cohesive algorithm whose phases share enough mutable state that splitting it would forward
     many locals or invent a carrier type.
3. **Split only on real seams.** A split that needs long parameter lists, a context object that
   exists only to carry them, a new interface with one implementation, or a pass-through module is
   wrong. Keep that code together and allowlist it. A shared context is right only where several
   operations already share that state, as the Finish planners' closures do.
4. **The registry is the index.** Each authority has one planner registry, which maps each kind to
   its family module. A new operation adds one row and one function.
5. **Packages expose families, not barrels.** A family's `index.ts` names its public surface with
   explicit exports, and `package.json` exports one subpath per family. Inside a package, modules
   import siblings directly. Packages contain no `export *` and no re-exports of another package.
6. **No test seams in production.** A kernel that must be observed takes an optional observer in
   its existing options.
7. **Comments state the current contract.** They keep mathematical reasoning, tolerance rationales
   and invariants. Roadmap identifiers and arrival narration go; Git holds history.
8. **Tests live with their workspace,** mirrored to its families or features.
9. **Extending.** Add to a family when the addition shares its inputs and invariants and fits the
   budget. Otherwise add a family and a registry row. Never grow a closure factory; add a
   sub-owner.

LOC-0 enforces rules 2 and 5, the seam ban and the absence of family import cycles with one arch
check over the shared import reader. It adds no other procedure.

## 6. Verification audit

**B1. Retirement guards.**

| Test | Size | CI time | What it guards |
| --- | --- | ---: | --- |
| `room-frame-retirement` | 116 lines, 7 cases | 24.6 s | the removed Room frame; the slowest fast-lane file |
| `directional-light-retirement` | 196 lines, 11 cases | — | the removed Directional kind |
| `legacy-isolation` (arch) | — | — | the relic externalized by PR #115 |
| `workflow-cutover` (arch) | — | — | a completed process cutover |
| `objects-panel-guard` | — | — | removed controls |

**B2. Historical captures and measurement.**

- `t1s01-format6-differential` compares against digests recorded by format-5 code.
- The P23B family is 29 files, 12,729 lines, 195 cases and 32.5 s. It mixes three kinds of file:
  - independent reference oracles that are checked against today's code, such as
    `p23b11-correspondence-reference.ts`;
  - in-revision differentials;
  - observation collectors and measurement files.
- The S8 slice-acceptance suites total 9 files and 3,411 lines.

**B3. Slice-organized suites.**

- 2,786 case titles (40%) carry roadmap ids, and 27 test files exceed 1,000 lines.
- `layout-wall-manipulation` (94 cases) mixes six slices; `spatial-route-gesture` (121 cases,
  23.7 s) mixes at least nine.

**B4. Source text outside arch.** 18 fast-lane files assert production source text, contrary to
rule 6 of the tests README.

**B5. Duplicated helpers.** Test files redefine `mount` 28 times, `settle` 25 and `eventually` 19.
193 `formatVersion` literals sit in 106 files.

**B6. Misclassification.**

- Tooling tests run in the editor fast lane: 19 files, 5,335 lines and 31 s.
- Package tests use the editor configuration.
- Lane membership is a curated 205-line list with its own meta-test.

**B7. Arch cost.** Each boundary file walks and parses the tree in its own worker.

**B8. CI.** Almost every path classifies as Full, so the Focused profile is unused. The merge queue
is inactive. Forty `[cap:…]` markers on 6,880 cases feed the maturity machinery.

**B9. Versioning residue.**

- `docs/reference/components/persistence.md` still describes pre-baseline "source-trial
  migrations".
- Several compatibility branches survive in code:
  - the identity ledger stays optional for older documents;
  - six legacy material ids still resolve;
  - legacy texture and model-finish paths remain;
  - a pending Save keeps an incompatible Layout stamp;
  - Save state still accepts a pre-migration token-only baseline;
  - a legacy auto-bezier sampler remains.
- Version refusals are asserted in UI and adapter suites as well as in the codecs.
- The API applies 11 ordered migrations. Migration 005 has a dedicated reset test.

## 7. The verification contract

A test exists for an editor workflow journey, a canonical invariant, or a named regression it
would catch. The README's rules 1–4 decide every deletion: a successor must fail on the same
defect, and replacement claims are proved. Canaries add evidence; they never replace that
reasoning. The case and line targets are ambitions, never quotas.

1. **No retirement tests.** The exception is an isolation boundary that ongoing work can still
   break.
2. **No historical oracles.** Digests or captures recorded by an earlier revision's code are
   deleted. Goldens remain only where bytes are the contract: canonical serialization and the
   `geometry-core` corpus.
3. **Independent oracles stay.** A reference implementation checked against today's code is kept,
   because it catches defects that an in-revision differential shares with the code under test.
   Its scope may shrink; its independence may not. Distinct invariants keep distinct tests, however
   similar their setup.
4. **Lanes by filename.** `*.arch.test.ts` and `*.heavy.test.ts` belong to their lanes; everything
   else is fast. Budgets: a fast file ≤ 2 s and the fast lane ≤ 90 s on CI; a heavy file ≤ 20 s.
5. **Source text only in arch,** read through one shared index.
6. **Contract names.** No slice ids in suite names or titles.
7. **Versions through constants.** One refusal test per format family, in its codec suite.
8. **One kit** for mounting, settling, polling and small Layout and Scene builders.
9. **No timing assertions.**

**CI.** The Merge gate keeps its events.

- **Gate.** The gate job re-derives the expected job set from the classifier itself and requires
  `success` from every expected job. It fails on any of the following:
  - a missing, skipped, cancelled or failed job;
  - an unknown event;
  - a classifier error;
  - a test job that collects zero files;
  - a tracked `*.test.ts` that no Vitest project includes.
- **Projects.** A root Vitest configuration lists its projects by glob (`apps/editor` and
  `packages/*`), so a relocated or new package test is collected without a registry edit.

| Event | Jobs |
| --- | --- |
| Pull request, Markdown only | whitespace, documentation references |
| Pull request, code (until D2 is confirmed) | Full: Biome; `svelte-check`; package and API checks; fast lane in two shards; arch; heavy; build; API with Postgres |
| Pull request, code (after VER-9b) | the same without heavy and API, which run only when their paths change |
| Merge group, manual dispatch | Full, unconditionally |

**Lint and format: Biome.** The trial ran Biome 2.6.9 with the `types` domain on a copy of the tree.

- **Speed.** Biome linted 885 files in 0.84 s, or 3.1 s with Svelte full support, and a format
  check took 0.37 s.
- **Svelte.** Without full support Biome reads only `<script>`, which produced 1,383 false
  unused-variable and unused-import reports in `.svelte` files. Full support reduced that to 32.
- **Type-aware defects.** In plain TypeScript, `noUnnecessaryConditions` catches `boolean !== null`.
  In `finish-authoring.svelte.ts` it misses the `dropper !== null` defect, because Biome resolves no
  ambient Svelte declaration, so `$state(false)` has an unknown type. An ambient `.d.ts` did not
  help; only an explicit `let x: boolean` annotation did. `tsc` and `svelte-check` miss the defect
  too, because TypeScript allows comparison with `null`.
- **Precision.** The rule reported 63 findings repo-wide. In a sample of 12, most were deliberate
  defensive checks on untrusted input or intentional `while (true)` loops.
- **Noise.** The `recommended` preset also reports 2,889 non-null assertions, which this code uses
  deliberately. Under full Svelte support it adds 120 CSS specificity reports and Svelte
  accessibility reports that overlap with `svelte-check`.
- **Formatter.** A tab, single-quote, 100-column configuration would rewrite 744 of 885 files.

Decision: adopt Biome for linting and formatting, with `tsc` and `svelte-check` retained.

- **Rules.** The recommended correctness and suspicious rules apply. The style group, Svelte
  accessibility (owned by `svelte-check`), CSS specificity and the `types` domain are off.
- **Findings.** The LNT-1 commit fixes true positives and turns noisy rules off; it does
  not add suppression comments.
- **Formatting.** The formatter lands last, as one commit recorded in `.git-blame-ignore-revs`.
- **No ESLint.** A type-aware ESLint would close the rune gap, but one instance is not a material
  gap, so no ESLint is added. If a second rune-typed defect of the same class appears, that
  decision is revisited.

**Versioning.** Until the owner declares beta, each persisted format admits exactly one version.
A change bumps the number, and readers refuse every other version with
`unsupported_format_version`. There is no migration, converter, dual reader, optional-on-read field
for older documents, compatibility fixture or historical differential. Fixtures are regenerated in
the same commit.

The database is handled in two distinct ways:

- **Disposable databases** (local Compose, CI services, test schemas) are rebuilt from the
  baseline freely.
- **Existing databases adopt the baseline without writes.** The baseline replaces migration `001`
  with the full current schema, and the runner already skips recorded versions and ignores extra
  ones. An existing database is adopted only after a read-only schema comparison shows it matches
  the baseline (D3). Dropping, resetting or rewriting a non-disposable database, including
  `schema_migrations`, needs the owner's explicit authorization. Later schema changes are new
  numbered migrations; documents are refused, never converted.

## 8. Discovered defects

Mechanical extraction moves code verbatim. A defect it exposes becomes a `bug` issue with a
failing test and gets its own focused fix, never a silent change inside a move.

| Location | Defect | Effect |
| --- | --- | --- |
| `finish-authoring.svelte.ts:1300` ([#415](https://github.com/Biskiq/spatial-sketch-editor/issues/415)) | `dropper: dropper !== null` on a boolean `$state` is always true | the Paint tray's dropper button always reports `aria-pressed` |
| `layout-wall-first-precision.ts:850–859`, `921–930`, `2209–2212` ([#416](https://github.com/Biskiq/spatial-sketch-editor/issues/416)) | `planExactWallLength`, `planExactWallAngle` and `proposeWallKnotRemoval` each call `guardRoundRoomMemberGeometryEdit` twice with identical arguments | redundant work; the second call may have been meant to guard a different subject, so check the intent before deduplicating |
| `apps/editor/src/routes/dev` | S8 gate and material tools are served by production builds | development surface on the product deployment (LOC-11 removes or gates it) |

Implementers append further discoveries here or in issues; nothing is fixed in passing.

## 9. Execution

The packets land in five wave pull requests, one clean commit per packet, in the order below. LOC-3
and LOC-13 take one commit per family or file, and LOC-8 and LOC-9 one per feature. A packet that
moves a file also does three other things for that file in the same commit:

- strips its roadmap comments (rule 7);
- removes its test seams;
- relocates its tests.

Within a wave, each path belongs to one packet commit, so a commit reverts on its own. Where a later
commit builds on an earlier one (LNT-1's static step under VER-9, VER-1a on LOC-1, LOC-9 on LOC-8,
each feature on VER-7's kit), the later one reverts first. Each wave pull request gets one
fresh-context review. Its description lists every commit with its tier. For each deletion it also
lists the removed files, the rule cited and the canary result. PR 1 and PR 5 carry the Tier 2
packets that the section 2 approvals cover. Any Tier 2 change beyond those approvals waits for the
owner.

Packet commits stay on `main`. PR 1 merges with a merge commit, and VER-9 sets the prepared
ruleset's queue `merge_method` to `MERGE`, so the queue does the same for PRs 2 to 5. A squash would
collapse a wave into one commit and leave LNT-2's blame-ignore entry pointing at nothing. Returning
to `SQUASH` after the closeout is the owner's call.

| PR | Packet commits, in order | Touches |
| --- | --- | --- |
| 1 | **VER-0** canaries, journey map, baselines | new `tools/canaries` |
| 1 | **LOC-0** metrics and budget check | new `tools/metrics`, one new arch test |
| 1 | **LNT-1** Biome lint (new dependency, approved) | `biome.json`, root `package.json` and lockfile, the static step of `merge-gate.yml` |
| 1 | **HYG-1** `.ignore`, `.gitignore`, orphaned asset, local log and empty directory | those paths |
| 1 | **LOC-10** work observer: spans and counts limited to what `perf:spot` and retained oracles read; `__P2311_PERF__` removed | `p2311-perf.ts` and its call sites |
| 1 | **LOC-11** development routes, slice-era perf flows, S8 scripts, WebGPU harness tests | `src/routes/dev`, `perf/`, `scripts/`, `tests/lib/dev`, harness-only WebGPU tests, editor `package.json` scripts |
| 1 | **VER-3** retirement and historical subtraction | the B1 files, `t1s01-format6-differential`, the duplicating S8 suites under `tests/lib/project-model` and `tests/lib/render` |
| 1 | **VER-4** P23B and S06 consolidation | `tests/lib/layout/{p23b*,t1s06*}`, their fixtures |
| 1 | **VER-6** source-shape conversion | the B4 files that VER-3 does not delete (source assertions only) |
| 1 | **VER-8** documentation and perf tooling tests out of the editor lanes | `tests/docs`, `tests/helpers/docs-references.ts`, `tests/lib/perf`, `tools/harness/check-docs.mjs` |
| 1 | **VER-9** CI gate, Full on pull requests, harness retired (D1), queue `merge_method` | `.github/`, `tools/harness/**` except `check-docs`, `tests/harness`, `capabilities.json`, `docs/operations/ci-merge-automation.md` |
| 1 | **VER-10** API runner and migration baseline (D3 for existing databases) | `apps/api/tests`, `apps/api/migrations`, the API `test` script |
| — | *PR 1 merges. The owner activates the merge queue (D2) before PR 2 merges.* | |
| 2 | **LOC-1** family entry points and import codemod | every importer |
| 2 | **VER-1a** lanes by filename, root Vitest projects, package configs; deletes `test-lanes.ts` and its meta-test | lane configs, arch and heavy file renames |
| 3 | **LOC-2** Wall precision and topology | `layout-wall-first-precision.ts` and its tests |
| 3 | **LOC-3** `layout-core` families, one commit each: compile, world index, wall chain, Room reconciliation, the rest | each source file and its tests |
| 3 | **LOC-3c** `camera-core` (moves only; hard rule 1) | `camera-motion.ts`, `viewport.ts` |
| 3 | **LOC-4** Finish planners | `scene-planning/finish*`, `colour-coat.ts` and their tests |
| 3 | **LOC-5** unit planning by authority | `units/planning.ts` and its tests |
| 3 | **LOC-6** unit validation by domain | `units/validate.ts` and its tests |
| 3 | **LOC-7** Scene operations | `scene-planning/operations.ts`, `intent-payload.ts` and their tests |
| 3 | **LOC-13** API, one commit per file: `app.ts`, `form-library.ts`, `model-persistence.ts`, `image-repair.ts` | those files and their tests |
| 4 | **VER-7** test kit, new files only | new `tests/kit` |
| 4 | **LOC-8** editor adapter hubs, then **LOC-9** factories and large components, one commit per feature. Each feature commit also reorganizes its own suites into contract suites (VER-5) and adopts the kit | one feature folder and its tests |
| 5 | **VER-1c** remaining package-test moves | remaining tests |
| 5 | **VER-2** arch source index | arch files |
| 5 | **VER-11** versioning hardening | codecs and their suites |
| 5 | **VER-9b** lean pull-request profile, once the queue's runs on PRs 2 to 4 are confirmed clean (D2) | `merge-gate.yml` |
| 5 | **LNT-2** Biome formatter: one isolated reformat commit, the last code change | every source file |
| 5 | **Closeout:** LNT-2's SHA in `.git-blame-ignore-revs`, bootstrap documents rewritten, rules promoted, remaining comment sweep, plan deleted | `.git-blame-ignore-revs`, documents |

PR 5 is not rebased after LNT-2, so the recorded SHA stays the one that reaches `main`.

**Rollback.** In an open wave pull request, a bad packet is fixed or reverted by its own commit.
After a merge, a wave reverts as a whole only until the next wave builds on it, and after that the
fix goes forward. LOC-1 in PR 2 is the main point past which revert is no longer cheap, which is why
PR 2 holds only LOC-1 and VER-1a and should merge quickly.

### Packet notes

- **LOC-0.** A `vite-node` script reuses `apps/editor/tests/helpers/import-closure.ts`. It reports
  the section 3 tables, including the read sets, and checks rules 2 and 5, the seam ban and family
  import cycles in under 1 s.
- **LNT-1 and LNT-2.** Apply the section 7 configuration. `biome ci` runs in the static job and adds
  about 4 s.
- **VER-0.**
  - At least 40 patch files, each a realistic defect mapped to the tests that should catch it.
  - Coverage: each hard rule, codec strictness, each authority's planners, Undo grouping, selection,
    conditional Save, compile determinism, Room identity, Experience lowering and API ownership.
  - A journey map from the 34 ledger capabilities to their behavioural tests.
  - The runner is on demand and never runs in CI. A canary that survives at baseline gets a test
    first.
- **VER-3.**
  - Delete the B1 files.
  - Delete `t1s01-format6-differential`, after checking whether its separate derived-role
    assertion is covered elsewhere.
  - Delete the S8 suites whose assertions duplicate the planner or catalogue suites, proved under
    rules 1–4.
  - The Directional-kind and `roomId` refusals each keep one case in the Scene codec suite, unless
    the unknown-key cases already cover them.
  - `stage-pick-differential` stays: it pins current selection winners.
- **VER-4.**
  - Keep every independent reference oracle that is checked against current code. Trim scope, not
    independence.
  - Keep the in-revision differentials and the identity falsifiers.
  - Delete observation collectors, measurement files and historical captures.
  - Reduce `t1s06-persistent-pipeline` from 84 s toward 15 s by keeping one sustained sequence per
    edit kind; the per-step equivalence is the invariant.
- **LOC-2.**
  - Precision families: types, finalization, Junction and Wall scalar edits, open-side edits, curve
    edits, architecture proposals, rectangle and objects.
  - Topology families: Wall-first validation and curve crossings.
  - One vector helper module for the package.
  - The duplicated guards (section 8) move verbatim.
- **LOC-3.**
  - `layout-geometry.ts`: compile session, entry, physical Walls, Junctions, Rooms with Openings and
    objects, query records.
  - `layout-world-index.ts`: copy-on-write candidates, delta verification, certified index,
    planar map.
  - `layout-wall-chain.ts`: planning, execution, noding, virtual edges, arcs.
  - Room reconciliation: boundary, correspondence, reconciliation, survivors, portals.
  - Long kernel functions split into named phases only where rule 3 allows; otherwise allowlist
    them.
- **LOC-4.**
  - A context built once per call replaces the closures that the 14 branches share.
  - Each branch body moves verbatim into its own function, with check order preserved, and the
    registry maps each kind to its function.
  - `finish-model`, `finish-treatment`, `finish-inspect` and `colour-coat` join the folder.
- **LOC-5.**
  - Camera View, Camera Connection and the Experience planners (create, capture-bind, Guide, Stop,
    Presentation, update, removal) become separate modules.
  - The Scene Environment, Sky, Look and Treatment planners move into Scene planning.
  - Registration stays in the unit registry.
- **LOC-6.** Separate envelope, lock, Scene, Camera, Experience, resource, frozen-JSON and
  serialization modules. Each domain validator imports only its own codec family.
- **LOC-7.** Transform, Form, lifecycle, support and finalization families.
- **LOC-8.**
  - Pointer and frame geometry leaves the Layout precision adapter.
  - Layout contributions split per contribution.
  - The Ink session and Scene placement become sub-owners.
- **LOC-9.**
  - X9's entry and sub-owner rules apply to the A1 factories: group nested functions by the state
    they share.
  - Sub-owners that hold runes stay in `.svelte.ts` modules.
  - Components over 800 lines split along markup regions whose state is local.
  - `LIFECYCLE_ORDER` and the mounted reactive-semantics tests remain the contract.
- **LOC-13.**
  - `createApp` stays the composition root, with the same security hooks registered in the same
    order.
  - Route families become plain `registerXRoutes(app, deps)` functions called in today's order,
    not encapsulated plugins, so hook and session scoping are unchanged.
  - Shared reply and request helpers go to one HTTP module.
  - The library splits into storage, forms, materials, thumbnails, transfer and the generic item
    operations, with its historical file name replaced.
  - SQL text, transactions, write leases and receipts are unchanged.
  - Checks: `check:api` and the Postgres suite with zero skips.
- **VER-1.**
  - Arch and heavy files take their suffixes.
  - The 133 package-pure tests move into `packages/<name>/tests` under a Node-environment Vitest
    configuration without the Svelte plugin.
  - Editor tests mirror the feature folders.
  - Roots computed from `import.meta.url` change in the same commit, and the inert `[cap:…]`
    markers are dropped as titles are touched.
- **VER-2.** A global setup builds one source index per run. The 39 arch files merge into about 12
  contract files, with an old-to-new assertion map as in X9. Target: arch ≤ 20 s.
- **VER-9.**
  - The gate fails closed (section 7). Pull requests stay Full.
  - The prepared ruleset's queue `merge_method` becomes `MERGE` (section 9).
  - Under D1, delete the aggregator, report, discovery, producer, guards, event context, issue
    rules and response, linked fixes, the ledger module, the maturity half of `status` and the
    issue-guards workflow.
- **VER-10.** One process runs the 17 API files after one build. The baseline migration replaces
  `001`, and the advisory-lock test stays. The migration-005 reset test goes, while the constraint
  it proves stays as part of the schema.
- **VER-11.**
  - Replace the persistence rule with the section 7 policy.
  - For each B9 branch, prove no current-format document reaches it, then delete it with its tests.
  - Move scattered refusal assertions into the codec suites.
- **Closeout.**
  - Bootstrap documents: the tests README ≤ 150 lines and the CI page ≤ 60. Eager "Read first"
    lists become lazy triggers ("read X when Y").
  - Comments: a final sweep over files no packet moved.
  - The plan directory is deleted.

## 10. Acceptance criteria

The criteria are measured on the closeout revision by LOC-0 and the gate's Vitest reports. Test
figures are ambitions.

| Criterion | Baseline | Target |
| --- | ---: | ---: |
| Production lines | 281,951 | ≤ 270,000 |
| Files ≥ 1,000 / ≥ 600 lines, outside allowlisted exceptions | 50 / 140 | 0 / ≤ 50 |
| Functions ≥ 250 lines | 71 | ≤ 10, all allowlisted with reasons |
| Median / p90 closure, editor module | 80,301 / 136,024 | ≤ 35,000 / ≤ 95,000 |
| Median closure, `project-model` module | 54,364 | ≤ 12,000 |
| Read sets (section 3) | 8,300–22,700 | at or below each row's target |
| `export *`, cross-package re-exports, test seams, roadmap ids in source | 126, 1, 28, 260 | 0 each |
| Searchable text | 1,137,748 lines | ≤ 560,000 |
| Bootstrap documents | 982 lines | ≤ 450 |
| Vitest cases; test code | 6,880; 215,485 | ≈ 4,800; ≈ 140,000 |
| Test files > 1,000 lines; titles with slice ids; fast files asserting source | 27; 2,786; 18 | 0; 0; 0 |
| Pull request, after D2 | 5 min 19 s; ≈ 15.4 runner-min | ≤ 3 min; ≤ 7 runner-min |
| Fast / arch / heavy lane | 212 / 53 / 96 s | ≤ 90 / 20 / 45 s |
| Merges validated on updated `main` | 0% | 100% after D2 |
| Canaries killed; capabilities with a journey | not measured; not mapped | 100%; 34 of 34 |
| Characterization or journey assertions changed by moves; bundle eager closure | — | 0; not larger |

## 11. Risks and stop conditions

**Stop and report** in any of these cases:

- a move needs a characterization, journey or digest assertion to change;
- a canary survives a deletion;
- a split needs a new import cycle, a sibling runtime import or a changed `LIFECYCLE_ORDER`;
- the eager client closure grows;
- a performance trigger in the performance contract applies;
- an API change alters a hook, its order or SQL text.

**Risks.**

- **Codemod conflicts.** LOC-1 shares PR 2 only with VER-1a, which builds on it.
- **Rune semantics.** Moving a closure must not turn a live reference into a copy; the mounted
  tests catch this.
- **Over-fragmentation.** Rule 3 and the allowlist reasons check it in review.
- **Lost proof.** Rules 1–4, independent oracles and canaries protect against it.
- **Reformat churn.** LNT-2 lands last, as one commit.
- **Delayed queue activation.** Pull requests stay Full until VER-9b confirms clean queue runs.

## Appendix A. Measurement method

- **Sizes:** `git ls-files` with `wc -l`.
- **Functions:** declarations measured to the closing brace at the same indent.
- **Closures:** static and dynamic imports and re-exports, resolved through `$lib`, relative paths
  and each package's `exports`, with type-only edges included. Read sets use the direct edges with
  barrel names mapped to their defining modules; API local edges are counted from relative imports.
- **Tests:** the Vitest JSON artifacts of run `45529863261`.
- **CI:** job and step times of that run and the last 100 Merge gate runs.
- **Search:** `rg --files` minus binary media.
- **Biome:** 2.6.9 installed outside the repository and run on a `git archive` copy with a root
  `biome.json`. Rune probes ran in a separate scratch directory.

## Appendix B. Functions of 250 lines or more beyond A1

`createObjectMarkSession` 745, `createRegionGestureSession` 669, `createPlacementBinding` 633,
`createOpeningPlacementSession` 619, `createContributionView` 603, `createStageUnfoldGestures` 592,
`runE7Gate` 527 (development route), `createMaterialImportSession` 524, `markDescriptors` 515,
`createSaveState` 503, `createPlanPickProvider` 499, `createSceneModelRepresentation` 489,
`createStageExperienceBinding` 488, `createPlanRetainer` 487, `createLayoutInstrument` 481,
`createStageSession` 479, `planWallRemovalSet` 457, `planDissolveJunction` 452,
`createSceneContributions` 432, `createCaptureBindPlanner` 420, `createExperiencePlayback` 417,
`planWallChainInternal` 411, `createLightPlacementSession` 406, `createLightLookThrough` 404,
`familyArmed` 394, `createProfileRevisionSession` 384, `createObjectDrawSession` 382,
`createStudioController` 378, `tryCompileWallFirstLayoutGeometryDelta` 376, `createStagePainter` 369,
`createCameraSession` 368, `envelopeFindings` 362, `createAppearanceIssues` 359, and 26 more under 359
lines, listed by LOC-0.
