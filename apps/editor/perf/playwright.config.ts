/**
 * Playwright configuration for the on-demand measurement harness (T3.P03.S02).
 *
 * This config lives outside the Vitest lanes and outside every root script:
 * `npm test`, `npm run check` and `npm run build` never collect or call it.
 * It adds no CI job, schedule or benchmark registry.
 *
 * Browsers come from Playwright's own cache: Chromium is always available, and
 * branded stable Chrome runs where the machine has it (the 'chrome' project).
 * A fresh context per run means no user profile, cache or cookie is inherited.
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:4173';
const resultsDir = process.env.PERF_RESULTS_DIR;

export default defineConfig({
	testDir: './flows',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	forbidOnly: true,
	timeout: 240_000,
	expect: { timeout: 20_000 },
	outputDir: `${resultsDir ?? '.perf-results'}/artifacts`,
	reporter: [['list']],
	use: {
		baseURL,
		// Ordinary timing runs use the rAF scheduling proxy. The separate
		// trace-proof diagnostic explicitly records Chrome CDP trace images;
		// Playwright tracing stays off so it adds no workload to ordinary runs.
		// Method limits and owner disposition live in the trace deviation record.
		trace: 'off',
		video: 'off',
		screenshot: 'only-on-failure',
		actionTimeout: 20_000
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1920, height: 1080 },
				deviceScaleFactor: 1
			}
		},
		{
			// Branded Chrome where installed; the contract's gating Chrome row records
			// `chrome://version`. Playwright fails this project clearly when absent.
			name: 'chrome',
			use: {
				channel: 'chrome',
				viewport: { width: 1920, height: 1080 },
				deviceScaleFactor: 1
			}
		}
	],
	webServer:
		process.env.PERF_BASE_URL === undefined
			? {
					command: 'node perf/serve.mjs',
					cwd: '..',
					url: baseURL,
					reuseExistingServer: true,
					timeout: 180_000,
					stdout: 'pipe',
					stderr: 'pipe'
				}
			: undefined
});
