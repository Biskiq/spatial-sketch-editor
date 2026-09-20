// Vitest config for @portfolio/editor — Slice 1.E infrastructure.
//
// Goal: let `npm test` exercise the editor test suite so future refactor
// slices can prove correctness the same way the safety net does.
//
// `npm test` runs the COMPLETE suite (all lanes). Lane configs
// (`vitest.fast.config.ts`, `vitest.arch.config.ts`, `vitest.heavy.config.ts`,
// `vitest.perf.config.ts`) select subsets for the inner loop and pre-PR gate;
// see `test-lanes.ts` for membership and `docs/operations/`
// `test-suite-harvest-2026-09-19.md` §F for the lane model.
//
// The Svelte plugin + `$lib` alias live in `vitest.shared.ts` so every lane
// uses the same module graph.
import { defineConfig } from 'vitest/config';

import { ALL_TESTS_INCLUDE, svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: ALL_TESTS_INCLUDE,
		environment: 'node'
	}
});
