// Architecture lane: durable boundaries, selected by filename.
//
// Run whole for architecture verification. CI includes these files in Focused
// and Full profiles. See tests/README.md for the local change-impact contract.
import { defineConfig } from 'vitest/config';

import { svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: ['tests/**/*.arch.test.ts'],
		setupFiles: ['./tests/helpers/editor-cwd.ts'],
		environment: 'node',
		// Each boundary test walks and parses the whole source tree. That costs about five
		// seconds on a loaded runner, so the 5s default fails on timing, not on a boundary.
		testTimeout: 30_000
	}
});
