/** Actual WebGL ownership proof; an isolated correctness fixture, never an F13 measurement. */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { newMeasuredSession } from '../lib/browser';
import type { RendererLifetimeFixture, FixtureOptions } from '../regressions/renderer-lifetime-entry';

declare global {
	interface Window { __RENDERER_LIFETIME__: RendererLifetimeFixture }
}

for (const [name, options] of [
	['default framebuffer', {}],
	['render target viewport/scissor', { target: '2d' }],
	['render target with explicit overrides', { target: '2d', override: true }],
	['cube face and mip level', { target: 'cube', mip: 1 }]
] as const satisfies readonly (readonly [string, FixtureOptions])[]) {
test(`retired secondary Canvases collect while the first keeps rendering: ${name}`, async ({ browser }, testInfo) => {
	const compiled = await build({
		entryPoints: [fileURLToPath(new URL('../regressions/renderer-lifetime-entry.ts', import.meta.url))],
		bundle: true, write: false, minify: true, format: 'iife', platform: 'browser', target: 'chrome120'
	});
	const session = await newMeasuredSession(browser, {
		viewport: { width: 800, height: 600 }, deviceScaleFactor: 1, network: 'N0'
	});
	try {
		const { page, cdp } = session;
		await page.setContent('<!doctype html><body>');
		await page.addScriptTag({ content: compiled.outputFiles[0]!.text });
		await cdp.send('HeapProfiler.enable');
		const first = await page.evaluate((settings) => window.__RENDERER_LIFETIME__.open(settings), options);
		const initial = await page.evaluate((id) => window.__RENDERER_LIFETIME__.draw(id), first);
		expect(initial.colors).toBeGreaterThan(16);
		expect(initial.error).toBe(0);
		if (!('target' in options)) await page.locator('canvas').screenshot({ path: testInfo.outputPath('survivor-before.png') });
		await cdp.send('HeapProfiler.collectGarbage');
		const baseline = await cdp.send('Memory.getDOMCounters');
		const samples = [];
		const reuploads = [];
		const steadyDraws = [];
		for (let cycle = 0; cycle < 6; cycle++) {
			const secondary = await page.evaluate(() => window.__RENDERER_LIFETIME__.open());
			const secondaryImage = await page.evaluate((id) => window.__RENDERER_LIFETIME__.draw(id), secondary);
			expect(secondaryImage.colors).toBeGreaterThan(16);
			expect(secondaryImage.error).toBe(0);
			await page.evaluate((id) => window.__RENDERER_LIFETIME__.close(id), secondary);
			const released = await page.evaluate((id) => window.__RENDERER_LIFETIME__.stats(id), first);
			expect(released.textures).toBe(initial.textures - 1);
			// Same camera/material/program: a surviving renderer must refresh the
			// deleted sampler binding even without a material or camera change.
			const survivor = await page.evaluate((id) => window.__RENDERER_LIFETIME__.draw(id), first);
			expect(survivor).toEqual(initial);
			reuploads.push(await page.evaluate((id) => window.__RENDERER_LIFETIME__.stats(id), first));
			await page.evaluate((id) => window.__RENDERER_LIFETIME__.draw(id), first);
			steadyDraws.push(await page.evaluate((id) => window.__RENDERER_LIFETIME__.stats(id), first));
			await expect.poll(async () => {
				await cdp.send('HeapProfiler.collectGarbage');
				return page.evaluate(() => window.__RENDERER_LIFETIME__.collected());
			}).toBe(true);
			const counts = await cdp.send('Memory.getDOMCounters');
			expect(counts).toEqual(baseline);
			samples.push(counts);
		}
		if (!('target' in options)) await page.locator('canvas').screenshot({ path: testInfo.outputPath('survivor-after.png') });
		console.log(`overlapping renderer samples: ${JSON.stringify({ initial, baseline, samples, reuploads, steadyDraws })}`);
		await page.evaluate(() => window.__RENDERER_LIFETIME__.closeAll());
		await expect.poll(async () => {
			await cdp.send('HeapProfiler.collectGarbage');
			return page.evaluate(() => window.__RENDERER_LIFETIME__.collected());
		}).toBe(true);
	} finally {
		await session.close();
	}
});

}
