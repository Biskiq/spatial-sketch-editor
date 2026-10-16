/**
 * Test-lane membership.
 *
 * Lanes are selected by configuration, never by moving files: the mirrored
 * `tests/lib/**` tree and every `import.meta.url` boundary root stay put.
 *
 *   npm test            → the full suite (durable default; the acceptance gate)
 *   npm run test:fast   → inner loop: everything EXCEPT arch + heavy
 *   npm run test:arch   → durable architecture boundaries (always run pre-PR)
 *   npm run test:heavy  → expensive correctness/property/stress work
 *   npm run test:full   → the same effective suite as `npm test`
 *
 * Every path below is relative to `apps/editor/` (the vitest root). `test:fast`
 * excludes exactly these files and nothing else.
 *
 * Architecture membership is a curated list of durable boundaries. The arch
 * lane is NEVER path-gated: it runs whole before every PR and at every
 * acceptance gate. No tracked CI workflow enforces that today — see
 * `tests/README.md` ("What a change requires"); the reviewed plan and the
 * acceptance record are the mechanism.
 *
 * PR #115 removed the PERF lane with its configuration (`lib/bench/**`, the
 * `/dev/perf*` routes and the `bench:record`/`reuse:record` scripts). The two
 * former PERF-lane files that WP0 classified as category A kernel invariants —
 * `p23b-fixture-contract` and `p23b-room-unit-proposal-cost` — now run in the
 * default suite with everything else.
 */

/**
 * Durable architecture boundaries: visitor/public isolation, single
 * camera-motion/navigation ownership, Layout/Scene format ownership,
 * package/import direction, camera-core, wall-mesh shell, project-model and
 * documentation cross-reference boundaries, plus the PR #115 `legacy/`
 * isolation guarantee.
 */
export const ARCH_FILES: string[] = [
	// Package / import direction + render/camera/wall/geometry boundaries.
	'tests/lib/layout/layout-geometry-boundary.test.ts',
	'tests/lib/museum/camera-core-boundary.test.ts',
	'tests/lib/museum/layout/wall-mesh-shell-boundary.test.ts',
	'tests/lib/project-model-boundary.test.ts',
	// Visitor/editor isolation (cold release, public closure, identity).
	'tests/lib/visitor/visitor-cold-runtime.test.ts',
	'tests/lib/visitor/visitor-public-route.test.ts',
	'tests/lib/visitor/visitor-identity-isolation.test.ts',
	'tests/lib/visitor/preview-surface-boundary.test.ts',
	'tests/lib/visitor/visitor-runtime-state.test.ts',
	'tests/vite/preview-surface-boundary-plugin.test.ts',
	'tests/vite/public-surface-boundary-plugin.test.ts',
	// Documentation cross-reference integrity. Durable and repo-wide: no product
	// code imports a `docs/` link, so a moved file or a renamed section heading
	// breaks a reader's route silently, in every lane and every build.
	'tests/docs/documentation-references.test.ts',
	// PR #115 frozen-project isolation: no product file imports, aliases or
	// references `legacy/`. The frozen project was externalized (§3.7), so this
	// is now the standing repository-side proof that nothing reintroduced it.
	'tests/lib/legacy-isolation.test.ts',
	// PR #115 §9.4/§11: the execution-structure gate. It reads the track and gate registers, the
	// phase slice register, the router's fresh-agent routes and the cycle's state/mechanism
	// tables, and it is the only enforcement of the version/eligibility rules, the trusted-base
	// prerequisite check and the exposure-window opening rule, so it belongs to an unconditional
	// lane. Its subject is the repository's execution structure, exactly like the docs gate below.
	'tests/docs/parallel-track-gates.test.ts',
	// T1.P01.S03: the F.4 editor-only isolation boundary — the public route's
	// module graph stays free of the acceptance coordinator and its history while
	// the shared contract package stays reachable. Nothing imports an F4 editor
	// module, so no lane report or build can see the leak, and only the
	// unconditional lane can own it.
	'tests/lib/authoring/f4-public-isolation.test.ts',
	// The lane-membership proof itself (WP3T §7.6 area 6): unique, existing,
	// disjoint lanes whose union is the curated set, with a missing-entry,
	// overlap, duplicate and dropped-file control. It polices the runner
	// configuration rather than any product code, and no lane report can reveal a
	// file that runs in no lane, so only the unconditional lane can own it.
	'tests/config/lane-membership.test.ts'
];

/**
 * Expensive correctness/property/stress work.
 *
 * Membership requires a whole file whose tests are uniformly expensive.
 */
export const HEAVY_FILES: string[] = [
	// Subprocess harness: shells out to sh/shasum/gltf-transform once per test,
	// so the file's cost is external process startup rather than in-process work.
	// All six tests spawn the job.
	'tests/lib/content/normalize-asset.test.ts',
	// P1.4 dense whole-transition acceptance matrices: a >=1001-value edge-local
	// progress grid per fixture (~5.0s).
	'tests/lib/museum/navigation/camera-motion-dense-sweeps.test.ts',
	// The two oblique-host sweeps: 591 independently projected divider
	// positions each (~3.4s).
	'tests/lib/layout/angled-plan-noding-sweeps.test.ts',
	// Compiling the small/medium tiers and the 1,000-room tier (~2.9s).
	'tests/lib/layout/layout-scale-compile.test.ts',
	// Corner, arch and opening watertight matrices over profile families (~1.3s).
	'tests/lib/layout/wall-mesh-watertight-matrices.test.ts',
	// Whole-Room drag slice — the preview-parity differential: it compiles every
	// committed 40-Wall fixture (translated and rotated) to diff the compile
	// against the rigid image of the baseline (~4s).
	'tests/lib/layout/p23b-room-unit-proposal-parity.test.ts',
	// WP3T §7.6 area 1: the whole-table correspondence differential. Its file-wide
	// `beforeAll` runs the entire 44-case matrix twice (short-circuit and
	// exhaustive) to re-derive the frozen reference, the filter-neutrality table
	// and the count oracle — 5.6s for 11 assertions, which made every focused run
	// of that file pay the same 5.6s. The cheap adversarial rows it was split from
	// stay in `correspondence-prune-neutrality.test.ts` (fast) with no file-wide
	// setup, and they carry the same defect detection per row.
	'tests/lib/layout/correspondence-reference-differential.test.ts',
	// WP3T §7.6 area 1, the other file the plan named: 30 whole-table rows over
	// the identity condition and the extent scope, each re-deriving a complete
	// case (measured 5.75s in the full run, 2.29s focused). Unlike the
	// correspondence differential there is no cheap subset to retain — every row
	// has the same cost shape — so the whole file moves rather than splitting
	// into an arbitrary "representative" fast half.
	'tests/lib/layout/p23b11-conditional-gate.test.ts'
];

/** Everything the fast lane excludes (`test:fast` = full − these). */
export const NON_FAST_FILES: string[] = [...ARCH_FILES, ...HEAVY_FILES];
