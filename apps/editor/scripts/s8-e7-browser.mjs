/** The browsers and page shared by the E7 generator and gate runner. */
import { chromium } from '@playwright/test';

export const BASE_URL = process.env.S8_GATE_BASE_URL ?? 'http://localhost:5199';

export const BACKENDS = {
	webgl2: { args: ['--use-angle=metal'], hideWebGPU: true },
	webgpu: { args: ['--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=metal'], hideWebGPU: false }
};

export function launch(name) {
	return chromium.launch({ headless: true, args: [...BACKENDS[name].args, '--disable-gpu-sandbox'] });
}

/** Open `/dev/materials` and wait until it is ready; throws the page's own error. */
export async function openMaterials(browser, name, query = '') {
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
	if (BACKENDS[name].hideWebGPU) {
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
	try {
		await page.goto(`${BASE_URL}/dev/materials${query}`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('main[data-e7-ready="true"], main[data-e7-ready="error"]', { timeout: 240_000 });
		const failure = await page.locator('main').getAttribute('data-e7-error');
		if (failure !== null) throw new Error(failure);
	} catch (error) {
		await context.close();
		throw new Error(`${error instanceof Error ? error.message : error}\n${errors.join('\n')}`);
	}
	return { context, page, errors };
}
