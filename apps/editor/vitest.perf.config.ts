// Perf lane: timing/budget gates only (see `test-lanes.ts`).
//
// Functional coverage of the same features stays in `test:fast`; this lane
// holds the measurement gates that are slow and flaky in the inner loop.
import { defineConfig } from 'vitest/config';

import { PERF_FILES } from './test-lanes';
import { svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: PERF_FILES,
		environment: 'node'
	}
});
