// Architecture lane: durable boundaries only (see `test-lanes.ts`).
//
// Run whole for architecture verification. CI includes these files in Focused
// and Full profiles. See tests/README.md for the local change-impact contract.
import { defineConfig } from 'vitest/config';

import { ARCH_FILES } from './test-lanes';
import { svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: ARCH_FILES,
		environment: 'node'
	}
});
