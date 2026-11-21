#!/usr/bin/env node
/**
 * Dev-only PR B gate runner.
 *
 * Runs the real `/dev/s8-gates` route on the observed Chromium backends and
 * writes exactly what completed. It never upgrades a software WebGL2 adapter to
 * an M2 result, and it leaves a failed/unavailable case as `unavailable` or
 * `failed` rather than manufacturing a pass.
 *
 * Usage (from `apps/editor`, with the dev server running):
 *   node scripts/run-s8-gates.mjs
 *   node apps/editor/scripts/run-s8-gates.mjs --out docs/.../s8-b-gates.json   (from the repository root)
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env.S8_GATE_BASE_URL ?? 'http://localhost:5199';
const OUT_INDEX = process.argv.indexOf('--out');
const OUT_PATH = OUT_INDEX >= 0 ? process.argv[OUT_INDEX + 1] : null;
/** Optional exploratory radiance scales, recorded separately and never adopted. */
const EXPLORE = process.env.S8_GATE_EXPLORE ?? '';
/**
 * Each case requests one backend through the browser, never through the page:
 * the product renderer is WebGPU-first and falls back to WebGL2 only when
 * WebGPU is unavailable. The hardware WebGL2 case therefore hides
 * `navigator.gpu` before any page script runs (a browser-level init script; the
 * route itself is unchanged) and keeps ANGLE on Metal, so the fallback runs on
 * the host GPU rather than on SwiftShader. `S8_GATE_INCLUDE_SOFTWARE=1` adds the SwiftShader case for
 * comparison; it is recorded with its software flag and never qualifies a gate.
 */
const BACKENDS = [
	{
		name: 'webgl2',
		args: ['--use-angle=metal'],
		hideWebGPU: true
	},
	{
		name: 'webgpu',
		args: ['--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=metal']
	},
	...(process.env.S8_GATE_INCLUDE_SOFTWARE === '1'
		? [
				{
					name: 'webgl2-swiftshader',
					args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
					hideWebGPU: true
				}
			]
		: [])
];
const CASES = [
	{ gate: 'highlight', dpr: 1 },
	{ gate: 'residency', dpr: 1 },
	{ gate: 'residency', dpr: 1.5 }
];

async function runCase(browser, backend, testCase) {
	const context = await browser.newContext({
		viewport: { width: 800, height: 800 },
		deviceScaleFactor: testCase.dpr,
		colorScheme: 'dark'
	});
	if (backend.hideWebGPU) {
		await context.addInitScript(() => {
			Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });
		});
	}
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (error) => errors.push(String(error)));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	const key = `${backend.name}/${testCase.gate}@${testCase.dpr}`;
	try {
		await page.goto(
			`${BASE_URL}/dev/s8-gates?gate=${testCase.gate}&dpr=${testCase.dpr}${EXPLORE ? `&explore=${EXPLORE}` : ''}`,
			{ waitUntil: 'domcontentloaded' }
		);
		await page.waitForSelector('html[data-s8-gate-ready="true"]', { timeout: 240_000 });
		const raw = await page.locator('main[data-s8-gate-result]').getAttribute('data-s8-gate-result');
		const observedBackend = await page.locator('[data-canvas-host]').getAttribute('data-backend');
		const status = await page.locator('[data-s8-gate-status]').textContent();
		if (!raw) {
			return {
				requestedBackend: backend.name,
				observedBackend: observedBackend ?? 'unavailable',
				status: 'failed',
				statusText: status,
				errors
			};
		}
		return {
			requestedBackend: backend.name,
			observedBackend: observedBackend ?? 'unavailable',
			status: 'captured',
			statusText: status,
			result: JSON.parse(raw),
			errors
		};
	} catch (error) {
		return {
			requestedBackend: backend.name,
			observedBackend: 'unavailable',
			status: 'unavailable',
			error: error instanceof Error ? error.message : String(error),
			errors
		};
	} finally {
		await context.close();
	}
}

async function main() {
	const results = { capturedAt: new Date().toISOString(), cases: {} };
	for (const backend of BACKENDS) {
		const browser = await chromium.launch({
			headless: true,
			args: [...backend.args, '--disable-gpu-sandbox']
		});
		try {
			for (const testCase of CASES) {
				const key = `${backend.name}/${testCase.gate}@${testCase.dpr}`;
				results.cases[key] = await runCase(browser, backend, testCase);
				const entry = results.cases[key];
				console.log(`${key}: ${entry.status} (observed ${entry.observedBackend})`);
			}
		} finally {
			await browser.close();
		}
	}
	if (OUT_PATH !== null) {
		writeFileSync(resolve(process.cwd(), OUT_PATH), `${JSON.stringify(results, null, 2)}\n`);
	}
	console.log(JSON.stringify(results, null, 2));
}

await main();