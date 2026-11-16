/**
 * SL1 test 14 — the rendered clip seam, on real WebGL.
 *
 * A jsdom lane cannot answer this: the sign, the ground exemption, the shadow pass
 * and the program count all live in the GL pipeline. This fixture is an isolated
 * correctness check (not an F13 measurement) and is owner-run, like Verified 20.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { newMeasuredSession } from '../lib/browser';
import type { StageClipFixture } from '../regressions/stage-clip-entry';

declare global {
	interface Window { __STAGE_CLIP__: StageClipFixture }
}

type Report = ReturnType<StageClipFixture['report']>;
type Reading = { kind: 'level'; cutY: number; lowerY: number | null };

/** The band centres the fixture draws, in metres. */
function bandCentre(index: number): number {
	return -0.5 + 0.125 + index * 0.25;
}

test('the clip seam discards exactly what the reading says, and nothing else', async ({ browser }, testInfo) => {
	const compiled = await build({
		entryPoints: [fileURLToPath(new URL('../regressions/stage-clip-entry.ts', import.meta.url))],
		bundle: true,
		write: false,
		minify: true,
		format: 'iife',
		platform: 'browser',
		target: 'chrome120'
	});
	const session = await newMeasuredSession(browser, {
		viewport: { width: 900, height: 700 },
		deviceScaleFactor: 1,
		network: 'N0'
	});
	try {
		const { page } = session;
		await page.setContent('<!doctype html><body style="margin:0">');
		await page.addScriptTag({ content: compiled.outputFiles[0]!.text });
		await page.waitForFunction(() => 'undefined' !== typeof window.__STAGE_CLIP__);

		const report = (reading: Reading | null, scene?: 'bands' | 'plain'): Promise<Report> =>
			page.evaluate(
				([value, where]) =>
					window.__STAGE_CLIP__.report(value as never, where as never) as never,
				[reading, scene] as const
			);

		const rest = await report(null);
		expect(rest.error).toBe(0);
		expect(rest.hash).not.toBe('');

		// 1. At rest every band is drawn, with no clipped variant in sight.
		for (const band of rest.bands) {
			for (const row of band.rows) expect(row).not.toBe(rest.background);
		}
		expect(rest.ground).not.toBe(rest.background);
		const unclipped = await report(null, 'plain');
		expect(unclipped.hash).toBe(rest.hash);
		// The absolute program count differs by construction (a clipped material links a
		// clipped shader); what must not change is the clipped scene's own count, below.
		expect(rest.programs).toBeGreaterThan(0);

		// 2. To the floor at 1.20 m: everything above is gone, everything below is
		//    pixel-identical, and the ground survives. Programs are counted from here,
		//    after both band scenes have compiled their own variants.
		const baseline = (await report(null)).programs;
		expect(baseline).toBeGreaterThan(0);
		const toFloor: Reading = { kind: 'level', cutY: 1.2, lowerY: null };
		const cut = await report(toFloor);
		expect(cut.error).toBe(0);
		cut.bands.forEach((band, index) => {
			const centre = bandCentre(index);
			if (centre > 1.2) {
				for (const row of band.rows) expect(row, `band ${index} at ${centre} m`).toBe(rest.background);
			} else {
				expect(band.rows, `band ${index} at ${centre} m`).toEqual(rest.bands[index]!.rows);
			}
		});
		expect(cut.ground).not.toBe(rest.background);
		await page.screenshot({ path: testInfo.outputPath('cut-1.20-to-floor.png') });

		// 3. A finite depth: only the band between 0.50 m and 1.20 m remains.
		const band: Reading = { kind: 'level', cutY: 1.2, lowerY: 0.5 };
		const bounded = await report(band);
		expect(bounded.error).toBe(0);
		bounded.bands.forEach((row, index) => {
			const centre = bandCentre(index);
			const inside = centre >= 0.5 && centre <= 1.2;
			if (inside) expect(row.rows, `band ${index}`).toEqual(rest.bands[index]!.rows);
			else for (const value of row.rows) expect(value, `band ${index}`).toBe(rest.background);
		});
		expect(bounded.ground).not.toBe(rest.background);
		await page.screenshot({ path: testInfo.outputPath('cut-1.20-depth-0.50.png') });

		// 4. Programs never recompile across rest → cut → move → put back.
		expect([cut.programs, bounded.programs]).toEqual([baseline, baseline]);
		const moved = await report({ kind: 'level', cutY: 2.1, lowerY: null });
		expect(moved.programs).toBe(baseline);
		const returned = await report(null);
		expect(returned.programs).toBe(baseline);
		const rest$ = await page.evaluate(() => window.__STAGE_CLIP__.rest());
		expect(rest$.programs).toBe(baseline);
		expect(rest$.planes).toBe(2);

		// 5. The shadow pass is unclipped: the same image with the Slice on.
		const shadowRest = await page.evaluate(() => window.__STAGE_CLIP__.shadow(null));
		const shadowCut = await page.evaluate(() => window.__STAGE_CLIP__.shadow({ kind: 'level', cutY: 1.2, lowerY: null }));
		expect(shadowRest.error).toBe(0);
		expect(shadowCut.error).toBe(0);
		expect(shadowCut.hash).toBe(shadowRest.hash);

		// 6. A snapshot taken during the Slice renders as built, and the live image
		//    is unaffected by having been retreated.
		const asBuilt = await page.evaluate(() => window.__STAGE_CLIP__.asBuilt({ kind: 'level', cutY: 1.2, lowerY: null }));
		expect(asBuilt.hash).toBe(rest.hash);
		const live = await page.evaluate(() => window.__STAGE_CLIP__.report({ kind: 'level', cutY: 1.2, lowerY: null }));
		expect(live.hash).toBe(cut.hash);

		console.log(
			`stage clip: ${JSON.stringify({
				programs: rest.programs,
				cutHash: cut.hash,
				restHash: rest.hash,
				shadow: shadowRest.hash
			})}`
		);
		await page.evaluate(() => window.__STAGE_CLIP__?.close());
	} finally {
		await session.close();
	}
});
