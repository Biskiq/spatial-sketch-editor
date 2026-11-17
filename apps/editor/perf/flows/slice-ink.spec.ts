/**
 * SL1 — the Slice's ink, seen on a real GPU.
 *
 * The review's objection was that the ghost, the clipped contour and the cap pick had
 * never been looked at: they were wired, unit-tested and unverified. This fixture
 * draws them from the shipped modules (`sectionMeshes`, `capFillsOf`, `SLICE_INK`,
 * `createStageClip`, the material store) and samples the pixels, so each of the three
 * claims is answered by what the frame shows rather than by a source assertion:
 *
 * - **the cap** — the removed Wall's exposed section is paper at `cutY`, and the drawn
 *   cap geometry sits exactly at the cut (a downward ray meets it there, and at rest
 *   there is no cap). The Stage's own cap *pick* is `plan-pick-provider`'s band
 *   surface, which is unit-tested; this fixture does not claim to drive it;
 * - **the ghost** — a wholly hidden subject is drawn where its body is clipped away,
 *   and drawn *translucent* (a lighter presence than the same ghost opaque);
 * - **the clipped ink** — a contour holding the Canvas's planes is gone above the cut
 *   while its unclipped twin (the ghost's exemption) is still there.
 *
 * Owner-run, like the clip seam's fixture; not a measurement.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { newMeasuredSession } from '../lib/browser';
import type { SliceInkFixture } from '../regressions/slice-ink-entry';

declare global {
	interface Window { __SLICE_INK__: SliceInkFixture }
}

type Report = ReturnType<SliceInkFixture['report']>;
type Reading = { kind: 'level'; cutY: number; lowerY: number | null };

const CUT: Reading = { kind: 'level', cutY: 1.2, lowerY: null };

function rgb(hex: string): [number, number, number] {
	const value = Number.parseInt(hex.slice(1), 16);
	return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Manhattan distance in 8-bit channels: a tolerance a human would call "the same". */
function distance(left: string, right: string): number {
	const [ar, ag, ab] = rgb(left);
	const [br, bg, bb] = rgb(right);
	return Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
}

test('the ghost, the clipped contour and the cap fill are actually drawn', async ({ browser }, testInfo) => {
	const compiled = await build({
		entryPoints: [fileURLToPath(new URL('../regressions/slice-ink-entry.ts', import.meta.url))],
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
		await page.waitForFunction(() => 'undefined' !== typeof window.__SLICE_INK__);

		const report = (reading: Reading | null): Promise<Report> =>
			page.evaluate((value) => window.__SLICE_INK__.report(value as never), reading);

		const rest = await report(null);
		expect(rest.error).toBe(0);
		expect(rest.pixels.wallAbove).not.toBe(rest.background);
		expect(rest.pixels.clippedContourAbove).not.toBe(rest.background);
		// Nothing is cut, so there is no section: that pixel is the Wall's own lit surface,
		// not paper, and there is no cap surface for a ray to find.
		expect(distance(rest.pixels.cap, '#f0e7d2')).toBeGreaterThan(48);
		expect(rest.capPickY).toBeNull();
		const restPick = await page.evaluate(() => window.__SLICE_INK__.restPick());
		expect(restPick).toBeNull();
		await page.screenshot({ path: testInfo.outputPath('slice-ink-rest.png') });

		const cut = await report(CUT);
		expect(cut.error).toBe(0);

		// 1. The body above the cut is gone; the body below is not; the cut is capped.
		expect(cut.pixels.wallAbove).toBe(cut.background);
		expect(cut.pixels.wallBelow).not.toBe(cut.background);
		expect(cut.pixels.cap).not.toBe(cut.background);
		// Paper tone, not the Wall's lambert tone: the fill is the section, not the body.
		expect(distance(cut.pixels.cap, '#f0e7d2'), `cap pixel ${cut.pixels.cap}`).toBeLessThan(48);
		expect(distance(cut.pixels.cap, rest.pixels.wallAbove)).toBeGreaterThan(12);

		// 2. The cap is drawn geometry at the cut, not a picture of one: a downward ray
		//    at the Wall's column lands on it at exactly cutY, and there is nothing to
		//    land on at rest. (The shipped pick is the provider's band surface, unit-tested.)
		expect(cut.capPickY).not.toBeNull();
		expect(Math.abs(cut.capPickY! - CUT.cutY)).toBeLessThan(1e-3);

		// 3. The contour holding the Canvas's planes is cut with its subject; the
		//    unclipped twin — the ghost's exemption — is still drawn above the cut.
		expect(cut.pixels.clippedContourAbove).toBe(cut.background);
		expect(cut.pixels.unclippedContourAbove).not.toBe(cut.background);

		// 4. The hidden subject is drawn where its body was clipped away, and drawn as
		//    a ghost: visibly present, and visibly lighter than the same ghost opaque.
		expect(cut.pixels.ghost).not.toBe(cut.background);
		const opaque = await page.evaluate(
			(value) => window.__SLICE_INK__.opaqueGhost(value as never),
			CUT
		);
		expect(distance(cut.pixels.ghost, opaque)).toBeGreaterThan(24);
		expect(distance(cut.pixels.ghost, cut.background)).toBeGreaterThan(8);
		// The body it stands for is not the thing being seen: at rest that pixel is the
		// subject's own lit surface.
		expect(distance(cut.pixels.ghost, rest.pixels.ghost)).toBeGreaterThan(24);
		await page.screenshot({ path: testInfo.outputPath('slice-ink-cut-1.20.png') });

		// 5. One cap polygon for one Wall body, and no GL error along the way.
		const counts = await page.evaluate(() => window.__SLICE_INK__.counts());
		expect(counts.caps).toBe(1);
		expect(counts.error).toBe(0);

		console.log(
			`slice ink: ${JSON.stringify({
				rest: rest.hash,
				cut: cut.hash,
				cap: cut.pixels.cap,
				ghost: cut.pixels.ghost,
				opaqueGhost: opaque,
				capPickY: cut.capPickY
			})}`
		);
		await page.evaluate(() => window.__SLICE_INK__?.close());
	} finally {
		await session.close();
	}
});
