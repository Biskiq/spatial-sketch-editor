/**
 * Dedicated configuration for the post-Bench-2 attribution check.
 *
 * It is deliberately separate from `perf/playwright.config.ts`: the attribution
 * runs the same tiny spec against two already-built revisions, one server at a
 * time, so it has no webServer and is never collected by `npm run perf`.
 */
import { defineConfig } from '@playwright/test';

const baseURL = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
	testDir: '.',
	testMatch: 'attribution.spec.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 180_000,
	reporter: [['list']],
	use: {
		baseURL,
		trace: 'off',
		video: 'off',
		screenshot: 'only-on-failure',
		actionTimeout: 20_000
	},
	projects: [
		{
			name: 'chrome',
			use: {
				channel: 'chrome',
				viewport: { width: 1920, height: 1080 },
				deviceScaleFactor: 1
			}
		}
	]
});
