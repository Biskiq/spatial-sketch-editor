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
	'tests/lib/visitor/p22-1-cold-runtime.test.ts',
	'tests/lib/visitor/p22-3-public-route.test.ts',
	'tests/lib/visitor/p23-12-visitor-identity-isolation.test.ts',
	'tests/lib/visitor/preview-surface-boundary.test.ts',
	'tests/lib/visitor/visitor-runtime-state.test.ts',
	'tests/vite/preview-surface-boundary-plugin.test.ts',
	'tests/vite/public-surface-boundary-plugin.test.ts',
	// Format policy / transaction guards / Layout↔Scene ownership (F0 gates).
	'tests/lib/editor/store/p23-f0-stage1-format-policy.test.ts',
	'tests/lib/editor/p23-f0-stage2-writers.test.ts',
	'tests/lib/editor/p23-f0-stage3-writer-fixtures.test.ts',
	'tests/lib/editor/p23-f0-stage4-visitor-parity.test.ts',
	'tests/lib/editor/p23-f0-stage5-small-items.test.ts',
	// Bind/wiring migration contract (import-direction source walk).
	'tests/lib/editor/editor-store-bind-migration.test.ts',
	// Visitor closure + single nav/motion owner + Layout/Scene ownership +
	// relic mount boundaries. Currently one mixed accumulator; harvest §C.1.2
	// plans a lossless 7-way split (T3a) that will move its behavioral core
	// into the fast lane.
	'tests/lib/editor/app/contracts.test.ts',
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
	'tests/lib/content/normalize-asset.test.ts'
];

/**
 * Timing/budget gates only (harvest §F): bend-perf plus the bench
 * measurement/budget files. Functional coverage of the same features stays in
 * `test:fast`.
 */
export const PERF_FILES: string[] = [
	'tests/lib/bench/p2311-bend-perf-pass.test.ts',
	'tests/lib/bench/bench-report.test.ts',
	'tests/lib/bench/browser-bench.test.ts',
	'tests/lib/bench/three-stats.test.ts',
	'tests/lib/bench/plan-bench.test.ts'
];

/** Everything the fast lane excludes (`test:fast` = full − these). */
export const NON_FAST_FILES: string[] = [...ARCH_FILES, ...HEAVY_FILES, ...PERF_FILES];
