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
type Drawn = {
	kind: 'drawn';
	origin: [number, number, number];
	along: [number, number, number];
	hiddenNormal: [number, number, number];
	halfLength: number;
	depthMeters: number;
	hidden: 'left' | 'right';
	start: [number, number, number];
	end: [number, number, number];
};

function drawnCut(depthMeters: number, hidden: 'left' | 'right' = 'right'): Drawn {
	return {
		kind: 'drawn',
		origin: [0, 0, 0],
		along: [1, 0, 0],
		hiddenNormal: hidden === 'left' ? [0, 0, -1] : [0, 0, 1],
		halfLength: 0.9,
		depthMeters,
		hidden,
		start: [-0.9, 0, 0],
		end: [0.9, 0, 0]
	};
}

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
		page.on('pageerror', (error) => console.error('STAGE_CLIP_PAGEERROR', error.message));
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

		// 7. The drawn arm: finite segment, finite depth, Flip and a stable program
		//    count on the same real GPU, including the imported material column.
		const drawnRest = await page.evaluate(() => window.__STAGE_CLIP__.drawn(null));
		expect(drawnRest.error).toBe(0);
		const drawnBaseline = drawnRest.programs;
		const cellOf = (cells: typeof drawnRest.cells, x: number, z: number): string =>
			cells.find((cell) => cell.x === x && cell.z === z)!.color;
		// At rest every cell and the ground are drawn.
		for (const cell of drawnRest.cells) expect(cell.color).not.toBe(drawnRest.background);

		const drawn = await page.evaluate((reading) => window.__STAGE_CLIP__.drawn(reading as never), drawnCut(0.15));
		expect(drawn.error).toBe(0);
		for (const cell of drawn.cells) {
			const hidden = Math.abs(cell.x) <= 0.9 && (cell.z > 0 || cell.z < -0.15);
			if (hidden) expect(cell.color, `drawn cell ${cell.x}/${cell.z}`).toBe(drawn.background);
			else expect(cell.color, `drawn cell ${cell.x}/${cell.z}`).toBe(cellOf(drawnRest.cells, cell.x, cell.z));
		}
		expect(drawn.programs).toBe(drawnBaseline);

		// The depth ray: 0.5 m uncovers the −0.4 m layer, 0.1 m stays in the shown band.
		const deeper = await page.evaluate((reading) => window.__STAGE_CLIP__.drawn(reading as never), drawnCut(0.5));
		expect(deeper.programs).toBe(drawnBaseline);
		expect(cellOf(deeper.cells, 0.7, -0.4)).toBe(cellOf(drawnRest.cells, 0.7, -0.4));
					expect(cellOf(deeper.cells, 0.7, -0.1)).toBe(cellOf(drawnRest.cells, 0.7, -0.1));
		expect(cellOf(deeper.cells, 0.7, 0.5)).toBe(deeper.background);

		// Flip: the shown/removed sides exchange, at the same program count.
		const flipped = await page.evaluate((reading) => window.__STAGE_CLIP__.drawn(reading as never), drawnCut(0.6, 'left'));
		expect(flipped.programs).toBe(drawnBaseline);
		expect(cellOf(flipped.cells, 0.7, -0.4)).toBe(flipped.background);
		expect(cellOf(flipped.cells, 0.7, 0.5)).toBe(cellOf(drawnRest.cells, 0.7, 0.5));

		// Moving the segment (a different midpoint/extent) does not recompile.
		const movedDrawn = await page.evaluate(
			(reading) => window.__STAGE_CLIP__.drawn(reading as never),
			{ ...drawnCut(0.15), origin: [0.25, 0, 0], start: [-0.65, 0, 0], end: [1.15, 0, 0] }
		);
		expect(movedDrawn.programs).toBe(drawnBaseline);
		// Moving the extent left keeps the old left column outside the new cut.
		expect(cellOf(movedDrawn.cells, -1.5, 0.5)).toBe(cellOf(drawnRest.cells, -1.5, 0.5));

		// A snapshot in the middle of the drawn cut renders as built, then restores.
		const drawnAsBuilt = await page.evaluate((reading) => window.__STAGE_CLIP__.drawnAsBuilt(reading as never), drawnCut(0.15));
		expect(drawnAsBuilt.hash).toBe(drawnRest.hash);
		const drawnLive = await page.evaluate((reading) => window.__STAGE_CLIP__.drawn(reading as never), drawnCut(0.15));
		expect(drawnLive.hash).toBe(drawn.hash);

		// Shadows remain rendered from the unclipped world with a drawn reading.
		const shadowDrawnRest = await page.evaluate(() => window.__STAGE_CLIP__.shadow(null));
		// Deep enough that the whole receiver is on the shown side: this isolates the
		// shadow map from the colour cut, which is what the assertion is about.
		const shadowDrawnCut = await page.evaluate((reading) => window.__STAGE_CLIP__.shadow(reading as never), drawnCut(5));
		expect(shadowDrawnCut.hash).toBe(shadowDrawnRest.hash);

		// 8. Editor ink is cut with its subject: the fat-line shader (no project_vertex
		//    chunk) compiles, discards inside the extent on the hidden side only, and
		//    neither ink material recompiles across cut → move → Flip → put back.
		const inkRest = await page.evaluate(() => window.__STAGE_CLIP__.ink(null));
		expect(inkRest.error).toBe(0);
		for (const [name, color] of Object.entries(inkRest.samples)) expect(color, `ink at rest ${name}`).not.toBe(inkRest.background);
		const inkCut = await page.evaluate((reading) => window.__STAGE_CLIP__.ink(reading as never), drawnCut(0.15));
		expect(inkCut.error).toBe(0);
		expect(inkCut.samples['hiddenLine@0.5']).toBe(inkCut.background);
		expect(inkCut.samples['ghost@0.5']).toBe(inkCut.background);
		expect(inkCut.samples['hiddenLine@1.5']).toBe(inkRest.samples['hiddenLine@1.5']);
		expect(inkCut.samples['ghost@1.5']).toBe(inkRest.samples['ghost@1.5']);
		expect(inkCut.samples['shownLine@0.5']).toBe(inkRest.samples['shownLine@0.5']);
		await page.screenshot({ path: testInfo.outputPath('ink-drawn-cut.png') });
		const inkFlipped = await page.evaluate((reading) => window.__STAGE_CLIP__.ink(reading as never), drawnCut(0.6, 'left'));
		expect(inkFlipped.samples['hiddenLine@0.5']).toBe(inkRest.samples['hiddenLine@0.5']);
		expect(inkFlipped.samples['shownLine@0.5']).toBe(inkFlipped.background);
		const inkLevel = await page.evaluate(() => window.__STAGE_CLIP__.ink({ kind: 'level', cutY: 2, lowerY: null } as never));
		expect(inkLevel.samples['hiddenLine@1.5']).toBe(inkLevel.background);
		expect(inkLevel.samples['shownLine@1.5']).toBe(inkRest.samples['shownLine@1.5']);
		const inkBack = await page.evaluate(() => window.__STAGE_CLIP__.ink(null));
		expect([inkCut.programs, inkFlipped.programs, inkLevel.programs, inkBack.programs]).toEqual([
			inkRest.programs,
			inkRest.programs,
			inkRest.programs,
			inkRest.programs
		]);
		expect(inkBack.samples).toEqual(inkRest.samples);

		// 9. X2: the cutaway twin on the same GPU. Whole → cut removes exactly the
		//    above-stub pixels, the paper cap is present, and no program appears; a
		//    twin caster's shadow image and 120 stationary frames are unchanged.
		const cutawayWhole = await page.evaluate(() => window.__STAGE_CLIP__.cutaway(null));
		expect(cutawayWhole.error).toBe(0);
		const cutawayCut = await page.evaluate(() => window.__STAGE_CLIP__.cutaway(1));
		expect(cutawayCut.error).toBe(0);
		expect(cutawayWhole.above).not.toBe(cutawayWhole.background);
		expect(cutawayCut.above).toBe(cutawayCut.background);
		expect(cutawayCut.below).toBe(cutawayWhole.below);
		expect(cutawayWhole.cap).not.toBe(cutawayWhole.background);
		expect(cutawayCut.cap).toBe(cutawayWhole.cap);
		expect(cutawayCut.programs).toBe(cutawayWhole.programs);

		const cutawayShadowWhole = await page.evaluate(() => window.__STAGE_CLIP__.cutawayShadow(null));
		const cutawayShadowCut = await page.evaluate(() => window.__STAGE_CLIP__.cutawayShadow(1));
		expect(cutawayShadowWhole.error).toBe(0);
		expect(cutawayShadowCut.error).toBe(0);
		expect(cutawayShadowCut.hash).toBe(cutawayShadowWhole.hash);
		await page.screenshot({ path: testInfo.outputPath('cutaway-twin.png') });

		// A Slice reading must not clear X2's independently owned top. Both a Level
		// and a Drawn reading are applied while the stub is cut; each must leave the
		// above-stub pixels hidden and the cap in place.
		const farLevel = { kind: 'level' as const, cutY: 6, lowerY: null };
		const farDrawn = {
			kind: 'drawn' as const,
			origin: [100, 0, 100] as [number, number, number],
			along: [1, 0, 0] as [number, number, number],
			hiddenNormal: [0, 0, 1] as [number, number, number],
			halfLength: 0.1,
			depthMeters: 0.1,
			hidden: 'right' as const,
			start: [100, 0, 100] as [number, number, number],
			end: [100.2, 0, 100] as [number, number, number]
		};
		for (const reading of [farLevel, farDrawn]) {
			const mixed = await page.evaluate((value) => window.__STAGE_CLIP__.cutawaySlice(value as never), reading);
			expect(mixed.error).toBe(0);
			expect(mixed.above).toBe(mixed.background);
			expect(mixed.below).not.toBe(mixed.background);
			expect(mixed.cap).not.toBe(mixed.background);
			expect(mixed.programs).toBe(cutawayWhole.programs);
		}

		// 10. X2 §10.2: orbit eleven Rooms while the cut set moves from Room to
		//     Room. The whole-scene baseline is taken first; cutting must not add a
		//     program at any of the 66 orbit frames.
		const orbit = await page.evaluate(() => window.__STAGE_CLIP__.cutawayOrbit(6));
		expect(orbit.frames).toBe(66);
		expect(orbit.errors).toEqual([0]);
		expect(orbit.baseline).toBeGreaterThan(0);
		expect(orbit.distinctPrograms).toEqual([orbit.baseline]);

		const stationary = await page.evaluate(() => window.__STAGE_CLIP__.cutawayStationary(120));
		expect(stationary.distinctHashes).toBe(1);
		expect(stationary.distinctPrograms).toBe(1);
		expect(stationary.first).toBe(stationary.last);
		expect(stationary.error).toBe(0);

		console.log(
			`stage clip: ${JSON.stringify({
				programs: rest.programs,
				drawnPrograms: drawnBaseline,
				cutHash: cut.hash,
				restHash: rest.hash,
				drawnHash: drawn.hash,
				drawnRestHash: drawnRest.hash,
				shadow: shadowRest.hash,
				shadowDrawn: shadowDrawnRest.hash,
				inkPrograms: inkRest.programs,
				orbitPrograms: orbit.distinctPrograms
			})}`
		);
		await page.evaluate(() => window.__STAGE_CLIP__?.close());
	} finally {
		await session.close();
	}
});
