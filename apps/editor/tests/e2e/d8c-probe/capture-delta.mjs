import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.env.D8C_PROBE_BASE ?? 'http://127.0.0.1:5321';
const out = new URL('./evidence/', import.meta.url);
await mkdir(out, { recursive: true });

const scenarios = [
	{
		name: 'hanging-industrial-gallery-webgpu-close-stripped-on-bulb-point',
		url: `${base}/tests/e2e/d8c-probe/index-fixture.html?candidate=hanging-industrial&world=gallery&view=close&emission=stripped&state=on&anchor=bulb&kind=point&intensity=3.141592653589793`
	},
	{
		name: 'hanging-industrial-gallery-webgl2-close-stripped-on-bulb-point',
		url: `${base}/tests/e2e/d8c-probe/index-fixture.html?candidate=hanging-industrial&world=gallery&view=close&emission=stripped&state=on&anchor=bulb&kind=point&intensity=3.141592653589793`,
		webgl2: true
	},
	{
		name: 'hanging-industrial-salon-webgpu-close-stripped-off-bulb-point',
		url: `${base}/tests/e2e/d8c-probe/index-fixture.html?candidate=hanging-industrial&world=salon&view=close&emission=stripped&state=off&anchor=bulb&kind=point&intensity=3.141592653589793`
	},
	{
		name: 'hanging-industrial-salon-webgl2-close-stripped-off-bulb-point',
		url: `${base}/tests/e2e/d8c-probe/index-fixture.html?candidate=hanging-industrial&world=salon&view=close&emission=stripped&state=off&anchor=bulb&kind=point&intensity=3.141592653589793`,
		webgl2: true
	},
	{
		name: 'hanging-industrial-salon-webgpu-room-stripped-on-bulb-point',
		url: `${base}/tests/e2e/d8c-probe/index-fixture.html?candidate=hanging-industrial&world=salon&view=room&emission=stripped&state=on&anchor=bulb&kind=point&intensity=3.141592653589793`
	},
	{
		name: 'hanging-industrial-salon-webgpu-range-stripped-on-bulb-point',
		url: `${base}/tests/e2e/d8c-probe/index-fixture.html?candidate=hanging-industrial&world=salon&view=range&emission=stripped&state=on&anchor=bulb&kind=point&intensity=3.141592653589793`
	}
];

const browser = await chromium.launch({
	headless: true,
	args: ['--enable-unsafe-webgpu', '--enable-features=Metal', '--use-angle=metal']
});
const contexts = {
	webgpu: await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }),
	webgl2: await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
};
await contexts.webgl2.addInitScript(() => {
	Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
});

const reportPath = new URL('capture-report.json', out);
const existing = JSON.parse(await readFile(reportPath, 'utf8'));
const byName = new Map(existing.map((entry) => [entry.name, entry]));

for (const scenario of scenarios) {
	const backend = scenario.webgl2 ? 'webgl2' : 'webgpu';
	const page = await contexts[backend].newPage();
	const errors = [];
	page.on('pageerror', (error) => errors.push(error.message));
	try {
		await page.goto(scenario.url, { waitUntil: 'domcontentloaded' });
		await page.waitForTimeout(9000);
		const state = await page.evaluate(() => window.__D8C_PROBE__ ?? null);
		await page.screenshot({
			path: new URL(`${scenario.name}.jpg`, out).pathname,
			type: 'jpeg',
			quality: 84
		});
		byName.set(scenario.name, {
			name: scenario.name,
			backend,
			status: state?.status ?? 'missing',
			observedBackend: state?.backend ?? null,
			modelDrawn: state?.modelDrawn ?? false,
			drawCalls: state?.drawCalls ?? null,
			triangles: state?.triangles ?? null,
			materials: state?.materials ?? [],
			errors
		});
		console.log(scenario.name, state?.status, state?.backend);
	} finally {
		await page.close();
	}
}

await writeFile(reportPath, JSON.stringify([...byName.values()], null, 2));
await browser.close();
