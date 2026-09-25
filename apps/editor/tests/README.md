# Tests — `apps/editor/tests/`

All Vitest suites live here, mirrored to `src/lib/`. A test for `src/lib/editor/editor-selection.ts`
sits at `tests/lib/editor/editor-selection.test.ts`. **No `.test.ts` files live under `src/`.**

## Start here (startup verification summary)

Repository-level verification applies regardless of task scope: implement the
slice, then run the contract below — task scope never narrows required
verification (AGENTS.md rule 11). Major lanes: `test:fast` (inner loop),
`test:arch` (ownership/isolation boundaries, always before a PR, never
path-gated), `test:heavy` (dense correctness/stress), `test:perf` (timing
gates). Read lane internals ([Lanes](#lanes), [Running](#running)) when the
implementation or verification task actually needs that lane — not before the
first edit. Test-design authority for adding/replacing tests:
[Test design rules](#test-design-rules).

## Import rules

1. **Import source modules via `$lib` aliases, never relative paths.** Tests are
   location-independent by design: `import { editorSelection } from '$lib/editor/editor-selection'`.
   The `$lib` alias is configured in `vitest.config.ts` and in the SvelteKit-generated
   tsconfig (inherited by `svelte-check`), so tests typecheck in place.
2. **Relative imports are reserved for sibling test helpers and fixtures** that move
   together with the test (e.g. `./__fixtures__/layout-g1-fixtures`).
3. No extension on imports: `allowImportingTsExtensions` is off, so
   `'$lib/editor/editor-selection'` not `'$lib/editor/editor-selection.ts'`.

## Test design rules

Durable doctrine for adding, replacing and placing tests. This section is the
authority; the evidence behind it (measurements, migration history, review
findings) is in `docs/operations/test-suite-harvest-2026-09-19.md` §Q/§R and is
not needed to contribute a normal test.

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
   source/import grammar, share one extractor/predicate
   (`museum/visitor-import-boundary` is the reference) instead of parallel
   regexes — two patterns for one invariant means two holes.

### Lanes

8. `test:fast` owns ordinary behavioral feedback.
9. `test:arch` owns unconditional architecture/ownership/isolation boundaries. It
   runs whole before a PR and is **never path-gated**.
10. `test:heavy` owns dense correctness/property/stress work.
11. `test:perf` owns timing/budget gates and never substitutes for functional
    correctness coverage. P23B fixture identity, browser-report and
    instrumentation-disabled contracts live in this lane.
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

## What lives here vs in `src/`

| Thing | Where |
|---|---|
| Test suites | `tests/lib/...`, mirrored to `src/lib/...` |
| Test-only helpers (`editor-test-utils.ts`, `layout-a1-fixtures.ts`) | `tests/lib/...` next to their consumers |
| Fixtures (`__fixtures__/` dirs with `.ts` + `.json`) | `tests/lib/.../__fixtures__/` |
| Modules imported by both tests **and** `src/` | stay in `src/lib/` (e.g. `bench-types.ts`, `plan-bench.ts` — used by the dev perf route) |

If a helper starts being imported from `src/`, move it back to `src/lib/` and flip the
imports back to `$lib`.

## Caveats

- **Boundary tests walk `src/` via `import.meta.url`** (`bench-boundary`,
  `plan-render-boundary`, `layout-geometry-boundary`, `camera-core-boundary`,
  `wall-mesh-shell-boundary`, `visitor-import-boundary`, `project-model-boundary`,
  `editor-store-bind-migration`). They compute roots as
  `resolve(import.meta.url, '../../../src')` — update them if `tests/` moves.
  The `$lib/layout` renderer-free sweep lives in `layout-geometry-boundary`; the
  wall-mesh shell/import boundary is owned by `wall-mesh-shell-boundary`, so
  `wall-mesh-builder` is a behavioral file and walks no source.
- **The dev perf route** (`src/routes/dev/perf/+page.svelte`) imports scale fixtures
  from here via a relative path. Keep that in sync if fixtures move.
- **No `__`-prefixed QA plates in the tree.** A `__qa-*` plate runs inside the
  suite via the vitest `include` pattern and writes into the tree — keep QA
  fixtures outside matched paths.
- **A drawing gesture on Plan needs `setPointerCapture` stubbed** for synthetic
  pointers. That is the only platform call QA stubs; no app gesture logic is
  touched by it.
- **Keyboard/traversal contracts that slice Svelte source are shape pins.**
  `plan-keyboard-navigation` slices `LayoutPlanViewport.svelte` and asserts text —
  it passed while the announcement missed required value+units. The pure halves
  now have direct tests (`plan-keyboard-readout`, `plan-keyboard-session`), but
  that slice cannot fail if the viewport simply stops calling them: drive the
  path live (or assert the composed string) before trusting refactors that
  rename/reorder those handlers.

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
npm run test:fast    # inner loop: everything EXCEPT arch + heavy + perf
npm run test:arch    # durable architecture boundaries (always run before a PR)
npm run test:heavy   # expensive correctness/property/stress work
npm run test:perf    # timing/budget gates
npm run test:full    # the same effective suite as `npm test`
```

The P23B.0 browser baseline is exported from `/dev/perf/p23b` and written only
through `bench:record`:

```bash
npm run bench:record -w @portfolio/editor -- --p23b-browser-report /absolute/path/p23b-browser-baseline.json
```

The recorder requires the clean-tree, method-v4 browser report and validates
all seven fixture identities before writing `g3-baseline.json`. Tests never
write the checked-in baseline.

The P23B.5 reuse ratchet (`…/p23b.5-caching-reuse-optimization/reuse-counter-ratchet.json`)
follows the same rule, and the perf-lane gate fails when its counts drift:

```bash
npm run reuse:record -w @portfolio/editor -- --reason "why the counts moved"
```

The reason is required, the source tree must be clean (so `recordedCommit` names
the state that produced the counts — commit the change first, re-record, then
commit the record), and the recorder refuses to write when the shared invariant
checker reports a violation. No test writes the record.

`npm test` still runs the complete suite and is never narrowed. The arch lane
is never path-gated: a Plan or store change can break a camera drawer or
visitor boundary through shared code. Membership is executable fact in
`apps/editor/test-lanes.ts`; the rules for *placing* a test are under
[Test design rules](#test-design-rules) above. See
`docs/operations/test-suite-harvest-2026-09-19.md` §F for the original lane
model and §R for the final measurements.

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
  see `.env.example`). NEVER set it on production — without it the route does
  not exist (404).
- Non-browser POSTs need the `Origin` header matching the API's editor origin;
  pass `origin` to `loginAs`.
