import { defineConfig } from 'vitest/config';

import { VITEST_PROJECTS } from './tools/harness/vitest-projects.mjs';

export default defineConfig({
	test: {
		projects: VITEST_PROJECTS
	}
});
