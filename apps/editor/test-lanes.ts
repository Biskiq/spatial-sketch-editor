/**
 * Test-lane membership — T1 of the test-suite harvest (2026-09-19).
 *
 * Lanes are selected by configuration, never by moving files: the mirrored
 * `tests/lib/**` tree and every `import.meta.url` boundary root stay put.
 *
 *   npm test        → the full suite (unchanged default, CI + pre-PR gate)
 *   npm run test:fast   → inner loop: everything EXCEPT arch + heavy + perf
 *   npm run test:arch   → durable architecture boundaries (always run pre-PR)
 *   npm run test:heavy  → expensive correctness/property/stress work
 *   npm run test:perf   → timing/budget gates
 *   npm run test:full   → the same effective suite as `npm test`
 *
 * Every path below is relative to `apps/editor/` (the vitest root) and must be
 * justified by the harvest report, not by filename or file size. `test:fast`
 * excludes exactly these files and nothing else.
 *
 * Architecture membership is a curated, harvest-backed list of durable
 * boundaries. The arch lane is NEVER path-gated: it runs whole pre-PR and in
 * CI on every change.
 */

/**
 * Durable architecture boundaries: visitor/editor isolation, single
 * camera-motion/navigation ownership (contracts' single-owner source group),
 * Layout/Scene format ownership, transaction guards, package/import
 * direction, plan-render, camera-core, wall-mesh shell and project-model
 * boundaries. Harvest §C KEEP_ARCH list.
 */
export const ARCH_FILES: string[] = [
	// Package / import direction + render/camera/wall boundaries.
	'tests/lib/layout/layout-geometry-boundary.test.ts',
	'tests/lib/layout/plan-render-boundary.test.ts',
	'tests/lib/museum/camera-core-boundary.test.ts',
	'tests/lib/museum/layout/wall-mesh-shell-boundary.test.ts',
	'tests/lib/project-model-boundary.test.ts',
	'tests/lib/bench/bench-boundary.test.ts',
	// Visitor/editor isolation (cold release, public closure, identity).
	'tests/lib/museum/visitor-import-boundary.test.ts',
	'tests/lib/visitor/visitor-cold-runtime.test.ts',
	'tests/lib/visitor/visitor-public-route.test.ts',
	'tests/lib/visitor/visitor-identity-isolation.test.ts',
	'tests/lib/visitor/preview-surface-boundary.test.ts',
	'tests/lib/visitor/visitor-runtime-state.test.ts',
	'tests/vite/preview-surface-boundary-plugin.test.ts',
	'tests/vite/public-surface-boundary-plugin.test.ts',
	// Format policy / transaction guards / Layout↔Scene ownership (F0 gates).
	'tests/lib/editor/store/project-format-policy.test.ts',
	'tests/lib/editor/project-format-writers.test.ts',
	'tests/lib/editor/project-format-writer-fixtures.test.ts',
	'tests/lib/editor/project-format-visitor-parity.test.ts',
	'tests/lib/editor/p23-f0-stage5-small-items.test.ts',
	// Bind/wiring migration contract (import-direction source walk).
	'tests/lib/editor/editor-store-bind-migration.test.ts',
	// T3a (§L): the `contracts.test.ts` accumulator was dismantled. Its
	// behavioural core moved into `test:fast` (its owners' files); the two
	// unconditional boundaries that needed a home of their own are these.
	'tests/lib/editor/app/editor-entry-boundary.test.ts',
	'tests/lib/editor/gizmo/editor-gizmo-boundary.test.ts',
	// Frozen `/museum/editor` relic isolation (harvest §C.1.4 / T2c). Every one
	// of its six claims is an unconditional mount/isolation guarantee — the
	// mount target, the Paris-only gate, the frozen transport, the shared-store
	// drift detector and the live-shell isolation branches — so it belongs with
	// the other durable boundaries rather than with ordinary behavior. Its
	// rendered/behavioral mechanism is not what put it here.
	'tests/lib/editor/app/relic-smoke.test.ts'
];

/**
 * Expensive correctness/property/stress work.
 *
 * Kept deliberately conservative for T1. Membership requires a whole file
 * whose tests are uniformly expensive; a file that mixes dense work with
 * cheap representative behavior stays in `test:fast` until T4 can split it
 * without rewriting test bodies (harvest §D/F — see the harvest report's T1
 * section for the deferred candidates and why).
 */
export const HEAVY_FILES: string[] = [
	// Subprocess harness (~29% of the suite's per-file time): shells out to
	// sh/shasum/gltf-transform per run. All six tests spawn the job.
	'tests/lib/content/normalize-asset.test.ts',
	// T4 — the mixed files T1 deferred, split so the cheap behavior stays in
	// `test:fast` and only the dense sweeps leave it. Each was split along a
	// boundary the file itself already drew (a banner-delimited section, a
	// `describe`, or the file's own stress/sweep cases); the assertion bodies
	// were moved verbatim and the `describe` titles retained, so full test names
	// are unchanged. See harvest §P.
	//
	// P1.4 dense whole-transition acceptance matrices: a >=1001-value edge-local
	// progress grid per fixture (~5.0s). The behavioral suite (constants,
	// easing, path construction, guard repairs, sampling) stays fast.
	'tests/lib/museum/navigation/camera-motion-dense-sweeps.test.ts',
	// The two oblique-host sweeps: 591 independently projected divider
	// positions each (~3.4s). The sibling single-case regressions of the same
	// `describe` stay in `test:fast`.
	'tests/lib/layout/angled-plan-noding-sweeps.test.ts',
	// Compiling the small/medium tiers and the 1,000-room tier (~2.9s).
	'tests/lib/layout/layout-scale-compile.test.ts',
	// Corner, arch and opening watertight matrices over profile families (~1.3s).
	'tests/lib/layout/wall-mesh-watertight-matrices.test.ts',
	// P23B.6 S2 retention exercise: 101 accepted edits, history branch and GC.
	'tests/lib/editor/layout/p23b6-s2-behavior-retention.test.ts'
];

/**
 * Timing/budget gates only (harvest §F): bend-perf plus the bench
 * measurement/budget files. Functional coverage of the same features stays in
 * `test:fast`.
 */
export const PERF_FILES: string[] = [
	'tests/lib/bench/bend-perf.test.ts',
	'tests/lib/bench/bench-report.test.ts',
	'tests/lib/bench/browser-bench.test.ts',
	'tests/lib/bench/p23b-baseline-contract.test.ts',
	// P23B.5 (owner-approved extra scope, plan §0.6): the deterministic reuse
	// counter gate. It is a BUDGET gate, not a timing gate — absolute structural
	// invariants plus a committed ratchet of request/miss/hit counts — and it
	// belongs beside the P23B.0 baseline contract rather than in `test:fast`,
	// which already runs the S2–S5 behavioral proofs of the same feature.
	'tests/lib/bench/p23b5-reuse-budget.test.ts',
	'tests/lib/layout/p23b-fixture-contract.test.ts',
	'tests/lib/editor/layout/p23b-interaction-measure.test.ts',
	'tests/lib/bench/three-stats.test.ts',
	'tests/lib/bench/plan-bench.test.ts'
];

/** Everything the fast lane excludes (`test:fast` = full − these). */
export const NON_FAST_FILES: string[] = [...ARCH_FILES, ...HEAVY_FILES, ...PERF_FILES];
