/**
 * D8c.1 capture driver.
 *
 * One page per scenario, no polling during renderer initialization: a repeated
 * cross-process evaluate starves headless Dawn and the WebGPU device is lost.
 * Wait for the probe's own settle, read once, screenshot.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.env.D8C_PROBE_BASE ?? 'http://127.0.0.1:5321';
const out = new URL('./evidence/', import.meta.url);
await mkdir(out, { recursive: true });

const scenarios = [];
const candidates = ['hanging-industrial', 'lantern', 'modern-ceiling', 'wall-sconce'];

for (const candidate of candidates) {
	scenarios.push(
		{ candidate, view: 'room', emission: 'stripped', state: 'on' },
		{ candidate, view: 'close', emission: 'stripped', state: 'on' },
		{ candidate, view: 'close', emission: 'source', state: 'off' },
		{ candidate, view: 'gallery-close', emission: 'stripped', state: 'on' }
	);
}

// Candidate-specific calibration and the alternate emitter anchors.
scenarios.push(
	{
		candidate: 'hanging-industrial',
		view: 'close',
		emission: 'stripped',
		state: 'on',
		query: '&anchor=bulb&kind=point&intensity=3.141592653589793',
		variant: 'bulb-point'
	},
	{
		candidate: 'hanging-industrial',
		view: 'close',
		emission: 'stripped',
		state: 'on',
		query: '&anchor=bulb&kind=spot&angle=25&intensity=3.141592653589793',
		variant: 'bulb-spot'
	},
	{
		candidate: 'hanging-industrial',
		view: 'close',
		emission: 'source',
		state: 'on'
	},
	{
		candidate: 'hanging-industrial',
		view: 'range',
		emission: 'stripped',
		state: 'on'
	},
	{
		candidate: 'lantern',
		view: 'close',
		emission: 'source',
		state: 'on'
	},
	{
		candidate: 'lantern',
		view: 'close',
		emission: 'stripped',
		state: 'on',
		query: '&anchor=mouth&kind=spot&angle=25&intensity=3.141592653589793',
		variant: 'mouth-spot'
	},
	{
		candidate: 'lantern',
		view: 'range',
		emission: 'stripped',
		state: 'on'
	},
	{
		candidate: 'modern-ceiling',
		view: 'close',
		emission: 'source',
		state: 'on'
	},
	{
		candidate: 'wall-sconce',
		view: 'close',
		emission: 'stripped',
		state: 'on',
		query: '&anchor=mouth&kind=spot&angle=25&intensity=3.141592653589793',
		variant: 'mouth-spot'
	},
	{
		candidate: 'wall-sconce',
		view: 'range',
		emission: 'stripped',
		state: 'on'
	}
);

function nameOf(scenario, backend) {
	const parts = [
		scenario.candidate,
		scenario.world ?? 'salon',
		backend,
		scenario.view,
		scenario.emission,
		scenario.state
	];
	if (scenario.variant) parts.push(scenario.variant);
	return parts.join('-');
}

function urlOf(scenario) {
	const world = scenario.view === 'gallery-close' ? 'gallery' : (scenario.world ?? 'salon');
	const view = scenario.view === 'gallery-close' ? 'close' : scenario.view;
	const params = new URLSearchParams({
		candidate: scenario.candidate,
		world,
		view,
		emission: scenario.emission,
		state: scenario.state
	});
	return `${base}/tests/e2e/d8c-probe/index-fixture.html?${params}${scenario.query ?? ''}`;
}

const browser = await chromium.launch({
	headless: true,
	args: ['--enable-unsafe-webgpu', '--enable-features=Metal', '--use-angle=metal']
});
const webgpu = await browser.newContext({
	viewport: { width: 1280, height: 720 },
	deviceScaleFactor: 1
});
const webgl2 = await browser.newContext({
	viewport: { width: 1280, height: 720 },
	deviceScaleFactor: 1
});
await webgl2.addInitScript(() => {
	Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
});
const reports = [];

for (const backend of ['webgpu', 'webgl2']) {
	const context = backend === 'webgpu' ? webgpu : webgl2;
	for (const scenario of scenarios) {
		// Gallery-close is captured on WebGPU; WebGL2 keeps the Salon matrix.
		if (scenario.view === 'gallery-close' && backend === 'webgl2') continue;
		if (scenario.view === 'range' && backend === 'webgl2') continue;
		const page = await context.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});
		const name = nameOf(scenario, backend);
		try {
			await page.goto(urlOf(scenario), { waitUntil: 'domcontentloaded' });
			await page.waitForTimeout(9000);
			let state = await page.evaluate(() => window.__D8C_PROBE__ ?? null);
			if (state?.status === 'rendering') {
				await page.waitForTimeout(5000);
				state = await page.evaluate(() => window.__D8C_PROBE__ ?? null);
			}
			await page.screenshot({
				path: new URL(`${name}.jpg`, out).pathname,
				type: 'jpeg',
				quality: 84
			});
			reports.push({
				name,
				backend,
				scenario,
				status: state?.status ?? 'missing',
				observedBackend: state?.backend ?? null,
				modelDrawn: state?.modelDrawn ?? false,
				drawCalls: state?.drawCalls ?? null,
				triangles: state?.triangles ?? null,
				textures: state?.textures ?? null,
				error: state?.error ?? null,
				materials: state?.materials ?? [],
				errors
			});
			console.log(name, state?.status, state?.backend, state?.error ?? '');
		} catch (error) {
			reports.push({ name, backend, scenario, status: 'driver-error', error: String(error), errors });
			console.log(name, 'DRIVER ERROR', String(error).slice(0, 160));
		} finally {
			await page.close();
		}
	}
}

await writeFile(new URL('capture-report.json', out), JSON.stringify(reports, null, 2));
await browser.close();
console.log(`wrote ${reports.length} scenarios to ${out.pathname}`);
