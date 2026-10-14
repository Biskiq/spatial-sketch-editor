// Heavy lane: expensive correctness/property/stress work (see `test-lanes.ts`).
//
// Membership is a whole file whose tests are uniformly expensive. A file with a
// cheap subset and an expensive subset is split instead (WP3T did this for the
// correspondence and curve suites), so the lane never carries a file whose
// cheap half would make a focused run pay the expensive half's setup.
import { defineConfig } from 'vitest/config';

import { HEAVY_FILES } from './test-lanes';
import { svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: HEAVY_FILES,
		environment: 'node'
	}
});
