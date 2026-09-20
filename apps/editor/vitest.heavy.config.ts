// Heavy lane: expensive correctness/property/stress work (see `test-lanes.ts`).
//
// Membership is conservative for T1 — only whole files whose tests are
// uniformly expensive. Mixed files stay in `test:fast` until T4 can split them
// without rewriting test bodies.
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
