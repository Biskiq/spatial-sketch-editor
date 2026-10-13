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
   location-independent by design: `import { createTextureVerifier } from '$lib/platform/texture-verifier'`.
   The `$lib` alias is configured in `vitest.shared.ts` and in the SvelteKit-generated
   tsconfig (inherited by `svelte-check`), so tests typecheck in place.
2. **Relative imports are reserved for sibling test helpers and fixtures** that move
   together with the test (e.g. `./__fixtures__/p23b-fixtures`).
3. No extension on imports: `allowImportingTsExtensions` is off, so
   `'$lib/platform/texture-verifier'` not `'$lib/platform/texture-verifier.ts'`.

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
   source/import grammar, share one extractor/predicate (`tests/helpers/lib-source.ts`
   for source reads, `tests/helpers/docs-references.ts` for Markdown) instead of
   parallel regexes — two patterns for one invariant means two holes.

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
- **Records are not held to link resolution.** `docs/archive/` and `Repo-Audit/`
  are excluded by prefix, and `ARCHIVAL_RECORD_PREFIXES` covers the closed phase
  records, superseded syntheses, immutable decision records and protected
  prototype evidence whose paths record what was open when they were written.
  #115 removed the editor shell those records describe; the plan deletes or
  relocates them (`implementation-plan.md` §8.3–§8.5), at which point the list
  collapses into the `docs/archive/` prefix.

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
those files and infers nothing from a filename or a file's size.

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
