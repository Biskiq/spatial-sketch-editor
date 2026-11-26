# Verification contract

Focused affected tests are the local inner loop. The merge gate certifies the integration delta.
Scope limits edits and leaves repository-level verification intact. See
[CI and merge automation](../../../docs/operations/ci-merge-automation.md) for profile selection.

## Ownership and test kit

- Mirror editor suites to their feature in `tests/lib/`. Keep package-pure suites and fixtures
  with the owning workspace. Cross-workspace integration stays with its consumer. Keep
  `.test.*` out of production source.
- Import editor source using `$lib` and public package entry points. Relative imports join
  test helpers and fixtures. Use extensionless TypeScript imports.
- Put scenario fixtures next to their tests and shared editor setup in [the test kit](./kit/index.ts).
  Reuse `mountComponent` / `mountWithProps`, `settle` and `eventually` for mounted tests.
  Always clean up the mount and its effects. Use `emptyLayout`, `layoutEnclosure`,
  `emptyScene` / `sceneWith`, and `emptySceneUnit` / `sceneUnitWith` for current-format fixtures.
  Use `bootProject` when the test needs real Stage admission. Builders take versions from codecs.
- Use [the architecture index](./arch/README.md) for shared boundary entry points. Use
  `tests/helpers/import-closure.ts` for import graphs and `tests/helpers/docs-references.ts`
  for Markdown. Share a parser per grammar and document any distinct root or import policy.
  Keep ad hoc QA scripts and generated artifacts outside Vitest's discovery paths.

## Test design rules

- Own one coherent behavior per suite and split at distinct contracts. Give the suite and cases
  names that describe the failure. Extend an existing contract when it can catch the same defect.
- Exercise outputs, identity, order, diagnostics and real call-site behavior. Keep assertions
  on forbidden imports, dependency direction, isolation and unique ownership in architecture
  suites. A pure helper test cannot prove that production invokes it correctly.
- Use representative equivalence classes. Where density proves continuity, conservatism or
  geometric correctness, preserve the sweep and give it explicit timeout headroom.
- Keep fixture inputs readable and expectations in the test. Use current version constants and
  maintain one dedicated version-refusal check per format family in the codec suites.

### Successors and deletion

Delete tests for removed behavior. For supported behavior, require a successor that fails on
the same defect in equivalent execution conditions, source roots and lanes. Keep a narrow
call-site proof where invocation, polarity, ownership or teardown matters. Matching assertions or
subjects are only leads. Demonstrate a claimed successor or changed boundary with a targeted
mutation where possible and keep unrelated controls green. Every
[canary](../../../tools/canaries/README.md) that names a removed test must be killed before and
after replacement. Preserve distinct invariants and independent reference oracles.

## Lanes

Membership uses filename suffixes. `*.arch.test.ts` owns architecture and isolation.
`*.heavy.test.ts` owns dense correctness, property and stress tests. Other files run in fast.
The lanes are disjoint and their union is the complete suite. Use the root scripts to run package
and editor projects together. An empty lane or a test outside all projects fails verification.

```sh
npm run test:fast
npm run test:arch
npm run test:heavy
npm test
```

Run the whole architecture lane before a PR. The tooling lane owns documentation and workflow checks.
Keep a cheap representative when moving dense cases to heavy. Split around the expensive cases
and keep their exhaustive inputs. Tooling tests have a separate `npm run test:tooling` entry point.

## What a change requires

| Change | Evidence |
| --- | --- |
| Fast suite, fixture or ordinary production behavior | Whole affected contract. Inspect callers and escalate to affected type checks, architecture, build and heavy coverage. |
| Heavy suite, fixture or production invariant it exercises | Complete affected heavy contract including its exhaustive cases, or the entire lane when it is the contract. |
| Architecture, boundaries or documentation | Whole arch lane before a PR. Use the documentation gate alone while iterating on links. |
| Shared setup or Vitest configuration | Every affected lane and complete coverage at acceptance. |
| Package code | Its contract and workspace type check. Include editor/API consumers where the change reaches them. |
| API code, suites or fixtures | `npm run check:api` and DB-backed `npm run test:api` with zero skips. Use a reachable test `DATABASE_URL` or `npm run test:api:stack` with local Compose. Record the DB target. |

Full merge-gate evidence includes `npm run check`, all three lanes, `npm run build`,
`npm run check:api`, the DB-backed API tests, and all affected package checks. The root editor
check/build commands do not run the API. Local runs and CI evidence are reported separately.
Before intensive local runs, check load, memory and other worktrees, limit worker counts as
appropriate and use a free heavy-testing slot. Broad local runs require owner authorization.

### Focused verification

From the repository root, use `npx vitest run <suite-path>` for editor or package files. From
`apps/editor`, use `npx vitest run --config vitest.tooling.config.ts tooling-tests/docs` for documentation.
File arguments are path filters. `-t` filters names after collection and still runs shared hooks.
Confirm the selection is nonempty. To focus an API test, build once in `apps/api` and run
`npx vite-node tests/<file>.test.mjs` with the test database configured.

### Browser QA policy

Exercise affected visual and interaction behavior with focused manual browser QA. Inspect
rendering and console errors and capture targeted evidence. Keep the non-browser gates and
leave final manual acceptance to the owner. Full Playwright capture, automated journey replay
and bulk recording require explicit owner authorization. For authorized automation, use
`tests/e2e/test-auth.ts` with a local `E2E_TEST_AUTH_SECRET` from
[the environment example](../../../.env.example), an allowlisted automation identity and the
editor Origin. Keep this test-auth seam disabled in production.

### Correctness tests vs performance benchmarks

Heavy correctness includes deterministic operation counts, geometric sweeps and differentials.
Keep wall-clock performance thresholds out of the correctness lanes. The owner initiates
runtime benchmarking based on an observed slowdown. The comprehensive benchmark matrix is
suspended. Use the authorized `perf:spot` triggers in the
[performance contract](../../../docs/reference/components/performance.md). Bundle provenance
and functional browser flow tooling sit outside the Vitest lanes.
