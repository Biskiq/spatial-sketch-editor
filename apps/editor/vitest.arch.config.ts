// Architecture lane: durable boundaries only (see `test-lanes.ts`).
//
// Run whole before every PR and in CI. Never path-gated — a Plan or store
// change can break a camera drawer / visitor boundary through shared code.
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
