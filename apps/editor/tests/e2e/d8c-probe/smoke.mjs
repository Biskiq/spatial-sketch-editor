import { chromium } from '@playwright/test';

const base = process.env.D8C_PROBE_BASE ?? 'http://127.0.0.1:5321';
const webgl2 = process.env.D8C_FORCE_WEBGL2 === '1';
const browser = await chromium.launch({
	headless: true,
	args: webgl2 ? [] : ['--enable-unsafe-webgpu', '--enable-features=Metal', '--use-angle=metal']
});
const page = await browser.newPage({
	viewport: { width: Number(process.env.D8C_WIDTH ?? 1280), height: Number(process.env.D8C_HEIGHT ?? 720) },
	deviceScaleFactor: Number(process.env.D8C_DPR ?? 1)
});
if (webgl2) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
	});
}

const errors = [];
page.on('console', (message) => {
	if (
		message.text().startsWith('[ctx]') ||
		message.text().startsWith('[gpuerr]') ||
		message.text().startsWith('[tex]') ||
		message.text().startsWith('[texerr]')
	)
		console.log(message.text());
	if (message.type() === 'error' || message.type() === 'warning') errors.push(`${message.type()}: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}\n${error.stack ?? ''}`));
page.on('response', (response) => {
	if (response.status() >= 400) errors.push(`http ${response.status()} ${response.url()}`);
});
page.on('requestfailed', (request) => errors.push(`requestfailed ${request.url()} ${request.failure()?.errorText}`));
await page.goto(
	`${base}/tests/e2e/d8c-probe/${process.env.D8C_PAGE ?? 'index-fixture.html'}?candidate=${process.env.D8C_CANDIDATE ?? 'hanging-industrial'}&world=${process.env.D8C_WORLD ?? 'salon'}&view=${process.env.D8C_VIEW ?? 'room'}&emission=${process.env.D8C_EMISSION ?? 'stripped'}${process.env.D8C_QUERY ?? ''}`,
	{ waitUntil: 'domcontentloaded' }
);
console.log('webgl2', webgl2);
// Do not poll during WebGPU initialization: repeated cross-process evaluates
// starve the headless Dawn instance and the device is lost. Wait, then read.
await page.waitForTimeout(Number(process.env.D8C_SETTLE ?? 8000));
const state = await page.evaluate(() => window.__D8C_PROBE__ ?? null);
console.log('status', state?.status, 'backend', state?.backend, 'frames', state?.frames, 'draws', state?.drawCalls, 'tris', state?.triangles, 'error', state?.error);
if (state?.materials) {
	console.log('materialTypes', [...new Set(state.materials.map((m) => m.type))]);
	console.log('transmission', [...new Set(state.materials.map((m) => m.transmission))]);
	console.log('emissive', state.materials.map((m) => `${m.emissive}/${m.emissiveIntensity}/${m.emissiveMap}`));
}
console.log('errors', errors.slice(0, 30));
console.log(
	'dom',
	await page.evaluate(() => ({
		canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
			width: canvas.width,
			height: canvas.height,
			clientWidth: canvas.clientWidth,
			clientHeight: canvas.clientHeight
		})),
		host: document.querySelector('[data-canvas-host]')?.getBoundingClientRect().toJSON() ?? null,
		phase: document.querySelector('[data-canvas-host]')?.getAttribute('data-phase') ?? null
	}))
);
await page.screenshot({ path: `/tmp/d8c-smoke-${webgl2 ? 'webgl2' : 'webgpu'}.png` });
await browser.close();
