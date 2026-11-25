// Tooling lane: documentation references and performance-tooling tests.
//
// These files prove repository tooling, not the editor runtime, so they run
// outside `test:fast`, `test:arch` and `test:heavy`. The static CI job runs
// them with the lint step.
import { defineConfig } from 'vitest/config';

import { svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: ['tooling-tests/**/*.test.ts'],
		setupFiles: ['./tests/helpers/editor-cwd.ts'],
		environment: 'node'
	}
});
