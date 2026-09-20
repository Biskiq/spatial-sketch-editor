# Tests — `apps/editor/tests/`

All Vitest suites live here, mirrored to `src/lib/`. A test for `src/lib/editor/editor-selection.ts`
sits at `tests/lib/editor/editor-selection.test.ts`. **No `.test.ts` files live under `src/`.**

## Import rules

1. **Import source modules via `$lib` aliases, never relative paths.** Tests are
   location-independent by design: `import { editorSelection } from '$lib/editor/editor-selection'`.
   The `$lib` alias is configured in `vitest.config.ts` and in the SvelteKit-generated
   tsconfig (inherited by `svelte-check`), so tests typecheck in place.
2. **Relative imports are reserved for sibling test helpers and fixtures** that move
   together with the test (e.g. `./__fixtures__/layout-g1-fixtures`).
3. No extension on imports: `allowImportingTsExtensions` is off, so
   `'$lib/editor/editor-selection'` not `'$lib/editor/editor-selection.ts'`.

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
  `plan-render-boundary`, `layout-geometry-boundary`, `visitor-import-boundary`,
  `editor-store-bind-migration`, `wall-mesh-builder`). They compute roots as
  `resolve(import.meta.url, '../../../src')` — update them if `tests/` moves.
- **The dev perf route** (`src/routes/dev/perf/+page.svelte`) imports scale fixtures
  from here via a relative path. Keep that in sync if fixtures move.
- **No `__`-prefixed QA plates in the tree.** A `__qa-*` plate runs inside the
  suite via the vitest `include` pattern and writes into the tree — keep QA
  fixtures outside matched paths.
- **A drawing gesture on Plan needs `setPointerCapture` stubbed** for synthetic
  pointers. That is the only platform call QA stubs; no app gesture logic is
  touched by it.
- **Keyboard/traversal contracts that slice Svelte source are shape pins.**
  `p23-13-keyboard` slices `LayoutPlanViewport.svelte` and asserts text — it
  passed while the announcement missed required value+units. Drive the path
  live (or assert the composed string) before trusting refactors that
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

`npm test` still runs the complete suite and is never narrowed. The arch lane
is never path-gated: a Plan or store change can break a camera drawer or
visitor boundary through shared code. See
`docs/operations/test-suite-harvest-2026-09-19.md` §F for the lane model.

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
