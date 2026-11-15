/**
 * Gate C (E7) measurement runner.
 *
 * Bounded: three Worlds, Stage and visit, rest / orbit / short drag, 10 s each,
 * plus one shadow-off control and three cold starts. It is a local evidence
 * tool, not a product script and not a CI gate.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.GATE_C_URL ?? 'http://localhost:5173/dev/render-budget';
const EVIDENCE = process.env.GATE_C_EVIDENCE ?? '/tmp/gate-c';

const browser = await chromium.launch({
	headless: false,
	args: [
		'--disable-backgrounding-occluded-windows',
		'--disable-renderer-backgrounding',
		'--disable-background-timer-throttling',
		'--use-angle=metal'
	]
});
const context = await browser.newContext({ viewport: { width: 1700, height: 950 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });

const environment = await page.evaluate(() => {
	const canvas = document.createElement('canvas');
	const gl = canvas.getContext('webgl2');
	const ext = gl.getExtension('WEBGL_debug_renderer_info');
	return {
		vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
		renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
		dpr: window.devicePixelRatio,
		visibility: document.visibilityState,
		userAgent: navigator.userAgent
	};
});

mkdirSync(EVIDENCE, { recursive: true });
const worlds = ['empty', 'small-room', 'gallery-wall'];
const surfaces = ['stage', 'preview'];
const patterns = ['rest', 'orbit', 'drag'];
const runs = [];
for (const world of worlds) {
	for (const surface of surfaces) {
		for (const pattern of patterns) {
			const capture =
				world === 'gallery-wall' && surface === 'stage' && pattern === 'orbit'
					? 'gate-c-stage-gallery.png'
					: world === 'gallery-wall' && surface === 'preview' && pattern === 'orbit'
						? 'gate-c-visit-gallery.png'
						: null;
			const pending = page.evaluate(
				([worldId, surfaceId, patternId]) =>
					window.__RENDER_BUDGET__.run(worldId, surfaceId, patternId, 10),
				[world, surface, pattern]
			);
			if (capture !== null) {
				await page.waitForTimeout(2000);
				await page.screenshot({ path: `${EVIDENCE}/${capture}` });
			}
			const summary = await pending;
			runs.push(summary);
			console.log(
				`${world}/${surface}/${pattern}: frames ${summary.renderedFrames}, p50 ${summary.frameIntervalsMs?.p50?.toFixed(2) ?? '—'}, p95 ${summary.frameIntervalsMs?.p95?.toFixed(2) ?? '—'}, calls ${summary.callsP50}, tris ${summary.trianglesP50}, shadow maps/frame ${summary.shadowMapsPerFrame.toFixed(2)}`
			);
		}
	}
}

const shadowOff = await page.evaluate(() =>
	window.__RENDER_BUDGET__.run('gallery-wall', 'preview', 'orbit', 10, { shadows: false })
);
runs.push(shadowOff);
console.log(
	`gallery-wall/preview/orbit (shadows off): frames ${shadowOff.renderedFrames}, p50 ${shadowOff.frameIntervalsMs?.p50?.toFixed(2)}, p95 ${shadowOff.frameIntervalsMs?.p95?.toFixed(2)}, calls ${shadowOff.callsP50}, tris ${shadowOff.trianglesP50}, shadow maps/frame ${shadowOff.shadowMapsPerFrame.toFixed(2)}`
);

const coldStarts = [];
for (const world of worlds) {
	const result = await page.evaluate((worldId) => window.__RENDER_BUDGET__.coldStart(worldId), world);
	coldStarts.push(result);
	console.log(
		`cold ${world}: mounted ${result.mountLatencyMs?.toFixed(1)} ms, first frame ${result.firstFrameLatencyMs?.toFixed(1)} ms, entry-frame ${result.entryFrameLatencyMs?.toFixed(1)} ms`
	);
}

const budget = await page.evaluate(() => window.__RENDER_BUDGET__.budget);
const output = {
	generatedAt: new Date().toISOString(),
	base: BASE,
	environment,
	budget,
	runs,
	coldStarts,
	notes: {
		device: 'Apple M2, ANGLE Metal, system Chrome launched by Playwright at deviceScaleFactor 1',
		window: '1280 × 720 CSS per surface, renderer pixel ratio pinned to 1',
		notMeasured: 'phone-class hardware was not supplied; no desktop-to-phone extrapolation'
	}
};
writeFileSync(`${EVIDENCE}/gate-c-result.json`, JSON.stringify(output, null, 2));
console.log(`wrote ${EVIDENCE}/gate-c-result.json`);
await browser.close();
