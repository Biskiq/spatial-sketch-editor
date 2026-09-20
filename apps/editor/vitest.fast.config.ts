// Inner-loop lane: the full suite minus the arch/heavy/perf lanes.
//
// Excludes EXACTLY the files listed in `test-lanes.ts`; it never infers new
// exclusions from filenames or file size. `npm test` still runs everything.
import { configDefaults, defineConfig } from 'vitest/config';

import { NON_FAST_FILES } from './test-lanes';
import { ALL_TESTS_INCLUDE, svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: ALL_TESTS_INCLUDE,
		exclude: [...configDefaults.exclude, ...NON_FAST_FILES],
		environment: 'node'
	}
});
