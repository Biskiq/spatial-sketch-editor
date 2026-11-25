// Heavy lane: expensive correctness/property/stress work, selected by filename.
//
// A file is heavy when its tests are uniformly expensive. A file with a cheap
// subset and an expensive subset is split instead, so the lane never carries a
// file whose cheap half would make a focused run pay the expensive half's setup.
import { defineConfig } from 'vitest/config';

import { svelteTestSetup } from './vitest.shared';

export default defineConfig({
	...svelteTestSetup,
	test: {
		include: ['tests/**/*.heavy.test.ts'],
		setupFiles: ['./tests/helpers/editor-cwd.ts'],
		environment: 'node'
	}
});
