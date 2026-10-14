// Architecture lane: durable boundaries only (see `test-lanes.ts`).
//
// Run whole before every PR and at every acceptance gate. Never path-gated — a
// Plan or store change can break a camera drawer / visitor boundary through
// shared code. No tracked CI workflow enforces this yet; the reviewed plan and
// `tests/README.md` ("What a change requires") are the mechanism.
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
