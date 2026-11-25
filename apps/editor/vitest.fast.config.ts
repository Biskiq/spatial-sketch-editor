// Inner-loop lane: the full suite minus the arch and heavy lanes.
//
// Membership is the filename suffix alone: `*.arch.test.ts` and
// `*.heavy.test.ts` belong to their lanes, everything else is fast.
import { configDefaults, defineConfig } from 'vitest/config';

import { ALL_TESTS_INCLUDE, svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: ALL_TESTS_INCLUDE,
		setupFiles: ['./tests/helpers/editor-cwd.ts'],
		exclude: [...configDefaults.exclude, 'tests/**/*.arch.test.ts', 'tests/**/*.heavy.test.ts'],
		environment: 'node'
	}
});
