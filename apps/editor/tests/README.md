# Tests — `apps/editor/tests/`

All Vitest suites live here, mirrored to `src/lib/`. A test for
`src/lib/layout/wall-mesh-builder.ts` sits at
`tests/lib/layout/wall-mesh-builder.test.ts`. **No `.test.ts` files live under `src/`.**

## Start here (startup verification summary)

Repository-level verification applies regardless of task scope: implement the
slice, then run the contract below — task scope never narrows required
verification (AGENTS.md rule 11). Major lanes: `test:fast` (inner loop),
`test:arch` (ownership/isolation boundaries, always before a PR, never
path-gated), `test:heavy` (dense correctness/stress). PR #115 removed the PERF
lane with its configuration: the bench harness, the `/dev/perf*` routes and the
`bench:record`/`reuse:record` scripts are gone, and the two former PERF-lane
files that asserted kernel correctness run in the default suite. Read lane internals ([Lanes](#lanes), [Running](#running)) when the
implementation or verification task actually needs that lane — not before the
first edit. Test-design authority for adding/replacing tests:
[Test design rules](#test-design-rules).

## Import rules

1. **Import source modules via `$lib` aliases, never relative paths.** Tests are
   location-independent by design: `import { validateProject } from '$lib/project/project-codec'`.
   The `$lib` alias is configured in `vitest.shared.ts` and in the SvelteKit-generated
   tsconfig (inherited by `svelte-check`), so tests typecheck in place.
2. **Relative imports are reserved for sibling test helpers and fixtures** that move
   together with the test (e.g. `./__fixtures__/p23b-fixtures`).
3. No extension on imports: `allowImportingTsExtensions` is off, so
   `'$lib/project/project-codec'` not `'$lib/project/project-codec.ts'`.

## Test design rules

Durable doctrine for adding, replacing and placing tests. This section is the
authority; the evidence behind it (measurements, migration history, review
findings) was recorded in the retired `test-suite-harvest-2026-09-19` harvest
that #115 deleted because it described a test tree #115 restructures
(`git show e90a5822:docs/operations/test-suite-harvest-2026-09-19.md`), and none
of it is needed to contribute a normal test.

### Successors and deletion

1. **Same feature ≠ successor.** A replacement counts as a successor only if it
   would fail on the **same defect** the removed test protected. Naming a test
   that covers a related subject proves nothing.
2. **Identical assertion text ≠ duplicate coverage.** Same expression + same
   asserted value/pattern + same polarity identifies a *candidate* only.
   Deleting also requires equivalent execution conditions, source root and lane
   coverage.
3. **Machinery correctness ≠ call-site correctness.** A perfect helper, store or
   pure function stays green after production stops invoking it. When the
   invariant depends on wiring, polarity, teardown, ownership or invocation,
   keep a narrow **call-site proof** alongside the machinery test.
4. **Replacement claims are proved by mutation.** For a successor/replacement
   claim, or any change to an architecture or call-site boundary, prefer a
   mutation that (a) reintroduces the old defect, (b) makes the proposed
   successor fail, and (c) leaves unrelated controls green. This is not required
   for ordinary new unit tests.

### Behavioral vs architecture proof

5. **Prefer behavioral proof** over source-shape proof whenever the behavior can
   actually be exercised.
6. **Source inspection is appropriate for genuine architecture invariants only:**
   forbidden imports, dependency direction, unique ownership, absence of a
   duplicate system, visitor/editor isolation, and source-level composition
   boundaries where no executable harness exists.
7. **One parser per grammar.** When several tests must interpret the same
   source/import grammar, share one extractor/predicate instead of parallel
   regexes — two patterns for one invariant means two holes. The shared readers
   are `tests/helpers/import-closure.ts` for source and import specifiers
   (`parseModuleSpecifiers`, `stripComments`, `resolveSpecifier`) and
   `tests/helpers/docs-references.ts` for Markdown. A boundary suite may keep a
   local walk when its **root, allowed-import set or defect** differs from those
   readers — that is a different invariant, not a second pattern for this one —
   but it should say so where the walk is written. WP3T retired
   `tests/helpers/lib-source.ts`: no file imported it, and its visitor root named
   the deleted `apps/museum`; the two arch owners that absorbed its candidates
   already carry better-suited readers.

### Lanes

8. `test:fast` owns ordinary behavioral feedback.
9. `test:arch` owns unconditional architecture/ownership/isolation boundaries. It
   runs whole before a PR and is **never path-gated**.
10. `test:heavy` owns dense correctness/property/stress work.
11. **No timing gate lives in this suite after #115.** The PERF lane, the P23B
    browser baseline/ratchet contracts and their recorders were removed with
    `lib/bench/**`. Timing is only ever asserted *relatively* on identical input,
    never as a wall-clock floor, and a measurement harness returns only if an
    owner ratifies one — a number that can pass or fail on machine noise alone is
    not a gate.
12. **Split, do not cut.** Moving expensive work to `heavy` keeps cheap
    representative behavior in `fast`.
13. **Draw the boundary around the expensive `it`s**, not automatically around a
    large file or its enclosing `describe`. An “is this section dense?” claim
    needs per-test evidence whenever it is not obvious.
14. **When the density is the proof, keep the density** and give the test
    explicit timeout headroom rather than shrinking the sweep.
15. `npm test` / `test:full` remain the complete suite: the lane union must equal
    full and the lanes must stay pairwise disjoint.

### Naming and ownership

16. **Prefer durable subsystem/contract names** over roadmap/slice-era names once
    the behavior is a stable product contract.
17. **A rename does not fix mixed ownership.** If a file genuinely bundles
    unrelated subjects, do not hide that behind an inaccurate umbrella name.

### Adding or restructuring a test

18. **One coherent behavioral contract per suite.** Name the contract the suite
    owns; when a second, unrelated contract grows inside it, split on that
    behavioral seam. Never split on line count or file size.
19. **A new test names the material failure it catches.** If an existing check
    already fails on that defect, extend it instead of adding a parallel one.
20. **Reuse before adding.** Extend the suite that owns the guarantee and prefer
    the existing fixtures, readers and helpers. A duplicated helper smaller than
    its abstraction cost is fine; an opaque universal fixture builder is not.
21. **Representative equivalence classes — except where density is the proof.**
    Dense numerical and geometric sweeps stay dense: the density *is* the
    evidence of continuity and conservative sampling. Elsewhere one
    representative per equivalence class beats a near-duplicate matrix.
22. **Assert the contract, not the decomposition.** Pin required output, identity,
    ordering and diagnostics rather than incidental internal structure a
    refactor may legitimately change.
23. **Fixtures stay narrow, visible and self-owned.** Scenario inputs are readable
    at the call site, cleanup is reliable, and the expectations a test pins
    (identity digests, verdicts) live with the test — never in a roadmap,
    measurement or ledger document.
24. **Deleted subject vs proven successor.** Both are legitimate; a deletion
    quota is not. Rules 1–4 decide which one a change is.
25. **Focused feedback is not acceptance.** The focused ladder below is for
    iteration; the §7.4 contract at a checkpoint is the acceptance evidence.

## What lives here vs in `src/`

| Thing | Where |
|---|---|
| Test suites | `tests/lib/...`, mirrored to `src/lib/...` |
| Test-only helpers (`editor-test-utils.ts`, `layout-a1-fixtures.ts`) | `tests/lib/...` next to their consumers |
| A repo-wide check with no `src/` counterpart (documentation cross-references) | `tests/helpers/docs-references.ts` + `tests/docs/` |
| Fixtures (`__fixtures__/` dirs with `.ts` + `.json`) | `tests/lib/.../__fixtures__/` |
| Modules imported by both tests **and** `src/` | stay in `src/lib/` |

If a helper starts being imported from `src/`, move it back to `src/lib/` and flip the
imports back to `$lib`.

## Caveats

- **Boundary tests walk `src/` via `import.meta.url`**
  (`layout-geometry-boundary`, `camera-core-boundary`, `wall-mesh-shell-boundary`,
  `project-model-boundary`, the `visitor/*` isolation suites and
  `legacy-isolation`). They compute roots as
  `resolve(import.meta.url, '../../../src')` — update them if `tests/` moves.
  The `$lib/layout` renderer-free sweep lives in `layout-geometry-boundary`; the
  wall-mesh shell/import boundary is owned by `wall-mesh-shell-boundary`, so
  `wall-mesh-builder` is a behavioral file and walks no source.
- **No `__`-prefixed QA plates in the tree.** A `__qa-*` plate runs inside the
  suite via the vitest `include` pattern and writes into the tree — keep QA
  fixtures outside matched paths.
- **The documentation gate reads the repository root, not `src/`.**
  `tests/helpers/docs-references.ts` derives the root from `import.meta.url` like
  the other boundary helpers, and intersects its walk with `git ls-files` so an
  untracked scratch copy is never held to the gate. When git is unavailable it
  falls back to the walk alone, minus the named exclusions. Numbered sections are
  held to their own sequence (a gap is a swallowed heading; a `# 6.–13. … — moved`
  placeholder accounts for a declared range), and a heading glued to the rule
  above it (`---# 7. Core color system`) is reported directly, because Markdown
  renders it as prose and the section disappears.
- **Records are not held to link resolution.** Two permanent prefixes are excluded:
  `docs/archive/` (history by contract) and `Repo-Audit/` (an audit log written
  against another checkout). That is the whole exclusion list, and the gate
  asserts it as an exact set, so a new exclusion has to be added deliberately
  rather than appearing as a blind spot. A *historical locator* inside a kept
  record is declared instead, with a written path in an `EVIDENCE-PATHS` region
  (`docs/README.md` → "Historical paths in a record"); the record's links,
  definitions and `#anchors` are still resolved, because those are the reader's
  route today. WP4 removed the temporary `ARCHIVAL_RECORD_PREFIXES` list and its
  guard machinery once the closed records it covered were archived or deleted.

## Running

```bash
npm test        # vitest run (include pattern: tests/**/*.{test,spec}.{js,ts}) — the complete suite
npm run check   # svelte-check — picks up tests/ via the generated tsconfig
```

### Lanes

The suite is split into lanes by **configuration, not by file moves** — the
mirrored tree and every `import.meta.url` boundary root stay put. Membership
lives in `apps/editor/test-lanes.ts`; the scripts are in
`apps/editor/package.json`:

```bash
npm run test:fast    # inner loop: everything EXCEPT arch + heavy
npm run test:arch    # durable architecture boundaries (always run before a PR)
npm run test:heavy   # expensive correctness/property/stress work
npm run test:full    # the same effective suite as `npm test`
```

Membership is a curated list in `test-lanes.ts`, so `test:fast` excludes exactly
those files and infers nothing from a filename or a file's size. That list is
itself proved rather than trusted: `tests/config/lane-membership.test.ts` reads
the tree, asserts every curated entry exists and is unique, that arch and heavy
are disjoint, and that their union is exactly the curated set — with
missing-entry, overlap, duplicate and dropped-file controls, so a renamed suite
or a file that runs in no lane fails instead of reporting green.

The arch lane also carries one **repo-wide documentation gate**
(`tests/docs/documentation-references.test.ts`): every Markdown document the
repository authors must resolve its own relative links, written-out paths and
`#section` anchors. It belongs to the arch lane because nothing imports a `docs/`
reference — no lane, build or type-check can see a moved file or a renamed
heading, so only an unconditional lane can hold it. Run it alone while writing
documentation:

```bash
cd apps/editor && npx vitest run --config vitest.arch.config.ts tests/docs
```

(#115 removed the P23B.0 browser baseline recorder and the P23B.5 reuse ratchet
with `lib/bench/**`: there is no `bench:record`, no `reuse:record` and no
checked-in baseline or ledger to re-record. Their historical measurements stay
recoverable at the baseline SHA, and the owner statement records the
benchmark's purpose as fulfilled.)

The lane also carries the **execution-structure gate**
(`tests/docs/parallel-track-gates.test.ts`): the track and gate registers, the
phase slice register, the router's fresh-agent routes and the architecture
cycle's state/mechanism tables. It enforces the gate-version rules (exact
`Gate@Version` references, one provider per version, accepted-only
prerequisites, the trusted-base check that stops a consumer satisfying its own
prerequisite in its own diff), the final-gate and verification-tier rules, the
exposure-window opening rule and the two closeout skills' evidence preflight —
with an in-memory negative fixture for every rule and positive controls for the
cases that must stay eligible. Its subject is the execution structure itself,
which no build, lane report or type check can see, so only an unconditional lane
can hold it.

`npm test` still runs the complete suite and is never narrowed. The arch lane
is never path-gated: a Plan or store change can break a camera drawer or
visitor boundary through shared code. Membership is executable fact in
`apps/editor/test-lanes.ts`; the rules for *placing* a test are under
[Test design rules](#test-design-rules) above. The retired harvest held the
original lane model and the final measurements
(`git show e90a5822:docs/operations/test-suite-harvest-2026-09-19.md`).

## What a change requires

Verification is triggered by **what changed**, not only by production-code
edits. A test edit is a change like any other and lands through the same
contract its subject does. This is the §7.7 ladder
(`docs/roadmap/parallel-track-cutover/implementation-plan.md` §7.7) made
concrete for this tree; it adds no workflow, runner or CI job.

| Changed | Required before the change is judged green |
| --- | --- |
| A `fast` test, its fixtures or its local helper | The **complete affected contract** — the whole file, not a `-t` case: `npx vitest run <file>` |
| A `heavy` test or its fixtures | The affected heavy contract **including its exhaustive cases**; no `-t` narrowing, and `npm run test:heavy` when the lane is the contract |
| An `arch` boundary test | The **whole arch lane** at the applicable review gate: `npm run test:arch` |
| Production code a heavy correctness invariant exercises | The relevant heavy contract during verification, alongside the affected fast contract |
| Shared test setup (`tests/helpers/**`, `tests/docs/**`), `test-lanes.ts`, `vitest.shared.ts` or a `vitest.*.config.ts` | Every lane the change reaches **and** the full suite at acceptance (`npm test`) |
| Production code (ordinary) | The affected contract, then the §7.7 escalation for its subsystem, call sites and package type checks |
| `apps/api` code, its tests or fixtures | `npm run check:api` and the DB-backed `npm run test:api` with **zero skips** (a reachable `DATABASE_URL`; the run's DB target is recorded at a checkpoint — `npm run test:api:stack` targets the local Compose database that `npm run stack:up` starts). Root `check`, `build` and `test` cover the editor only and never sub for an API run |

Every #115 checkpoint and every future implementation-PR merge gate keeps the
declared complete verification contract — the §7.4 contract **including
`test:heavy`** — however small the change looks. This is a change-impact policy,
not a demand to run every heavy suite after every edit: focused runs are
iteration feedback and never stand in for acceptance evidence (rule 25).

### Slice verification tiers (the PR #115 WP5 cutover)

A reviewed slice plan declares its own tier, and the tier decides what closeout
must see:

```text
VERIFICATION: iteration | affected-subsystem | architecture-integration | exhaustive
INTEGRATION ROUTE: <the phase's declared gate or integration plan>   (when not exhaustive)
```

A narrowed tier must resolve its replacement **integration route** — normally its
phase's declared `FINAL PHASE GATE`, whose plan must itself declare exhaustive
verification — and the phase cannot become `closable` until that integrated result
is recorded. A one-slice implementation PR still needs the full gate before merge.
PR #115 checkpoints are always `exhaustive`: this cutover narrows focused iteration
and docs/planning slices, never a checkpoint. The gates test fails a missing
integration route or a narrowed final gate, and `slice-closeout` refuses a close
whose required evidence is missing.

No tracked CI workflow enforces any of this today — there is no
`.github/workflows` in the repository, and the older lane comments' "in CI"
promise was never installed. The reviewed plan and the acceptance record are the
enforcement mechanism until a CI integration is separately authorized. Do not
describe an automatic trigger as existing unless one is verified in the tree.

### Correctness tests vs performance benchmarks

`test:heavy` carries expensive **correctness** work: dense numerical and
geometric sweeps, whole-table differentials and deterministic operation counts.
They stay in `test:heavy` and must pass like any other test. A deterministic
operation-count assertion is a correctness oracle, not a timing measurement, and
slow-but-exact coverage is not a reason to weaken it (rules 12–14).

Actual latency, frame-time, memory, allocation and throughput benchmarks are a
different thing, and since the **2026-10-28 owner policy amendment** they are
exclusively **owner-initiated**, triggered by an observed slowdown. No slice,
phase, final gate, plan or closeout may run the formal performance matrix as an
acceptance prerequisite. Existing measurements are historical evidence, not
mandatory prerequisites; an unmeasured row stays unmeasured, never a pass. A
passing correctness suite is not evidence that runtime performance is unchanged.
#115 deliberately retired the P23B PERF harness, the browser baseline recorder,
the reuse ratchet and every wall-clock threshold (rule 11), and its WP5 installed
the execution structure rather than a benchmark: **no** permanent benchmark
workflow, registry, scheduled job or CI gate exists, and adding one needs
separate owner authorization. Harnesses and historical evidence are preserved
for a future owner-commissioned investigation.
[Decision record](../../../docs/reference/decisions/performance-mandate-suspension-2026-10-28.md).

## Focused verification

Installed Vitest is 3.2.7. These commands are run from `apps/editor` unless
stated, and each one below has been exercised on this tree. A focused run is
feedback, not acceptance (rule 25).

```sh
npx vitest run tests/lib/layout/layout-curve-editing.test.ts      # one contract
npx vitest run tests/lib/museum/navigation/camera-motion.test.ts -t 'live target and FOV'
npx vitest list tests/lib/museum/navigation/camera-motion.test.ts -t 'live target and FOV'
npx vitest related --run src/lib/layout/wall-mesh-builder.ts       # importers of a source file
npx vitest run --changed HEAD                                      # what the branch touched
```

A file filter is a path substring and `-t` matches the full test name as a
regex, so both still collect, transform and run that file's shared hooks: a
cheap file is not the same as a cheap case, and `-t` cannot avoid a file-wide
`beforeAll`. Check a selection is non-empty without `--passWithNoTests`.

API contracts sit outside Vitest, so run the one you changed after a single
build:

```sh
cd apps/api && npm run build && npx vite-node tests/projects.test.mjs
```

Escalate by risk, not by habit. Documentation- and planning-only changes use the
documentation and arch gates rather than fabricating product runs; a checkpoint
uses the complete §7.4 contract, including the DB-backed API files with zero
skips.

## Agent E2E (`tests/e2e/`)

Browser-driven agent tests log in without the external OAuth ceremony through
the API test-auth seam (`POST {PUBLIC_API_ORIGIN}/test-auth/session`,
`apps/api/src/test-auth.ts`): bearer `E2E_TEST_AUTH_SECRET` + `{ user }` mints
the canonical app session for an allowlisted automation identity
(`agent-admin`, `agent-user-a`, `agent-user-b` → normal `google:e2e-*` user
ids). Ownership and permission checks apply unchanged.

- Helper: `tests/e2e/test-auth.ts` (`loginAs`, Node-side — browsers hide
  `Set-Cookie`; install the returned pair in the browser context, then
  navigate). Never imported by `src/`.
- Its contract is pinned by `tests/e2e/test-auth.test.ts` (runs in the normal
  `npm test` above).
- API-side coverage lives in `apps/api/tests/test-auth.test.mjs` (seam
  session, secret/identity rejection, structural absence without the option,
  cross-ownership on real Postgres).
- Enable locally with `E2E_TEST_AUTH_SECRET` in `.env` (ignored, local-only;
  see [`.env.example`](../../../.env.example)). NEVER set it on production — without it the route does
  not exist (404).
- Non-browser POSTs need the `Origin` header matching the API's editor origin;
  pass `origin` to `loginAs`.


## Product convergence performance workflow

**The mandatory workflow is suspended indefinitely.** The
[2026-10-28 decision](../../../docs/reference/decisions/performance-mandate-suspension-2026-10-28.md)
supersedes the 2026-10-22 on-demand acceptance requirement. No formal F2/F3/F4/F8/F13 matrix,
battery-mode certification or full `npm run perf` workflow is authorized as an acceptance step.
Performance investigations are exclusively owner-initiated after an observed slowdown.

Historical method, retained for such an investigation: a consuming slice recorded performance
evidence against
[the owning browser-performance contract](../../../docs/reference/components/performance.md)
before acceptance; hard misses were resolved inside the slice and targets received a disposition;
the phase final gate rechecked integrated flows. Those obligations are no longer current.

The Playwright/CDP harness and bundle report remain in the tree, outside the default lanes and with
no CI job, schedule or registry. Harnesses, workloads and historical evidence are preserved; no
benchmark was authorized by the suspension. The no-CI/no-scheduled-job policy remains current, and
unrelated workflow additions still need owner authorization. Ratifying targets or retaining a
harness releases no production scope from the owner hold.
