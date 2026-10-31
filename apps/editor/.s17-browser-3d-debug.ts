import { chromium } from '@playwright/test';
import { seedS17BrowserProject } from './tests/e2e/s17-seed-mixed-project';

const editorOrigin = process.env.EDITOR_ORIGIN ?? 'http://127.0.0.1:5173';
const apiOrigin = process.env.PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:8787';
const secret = process.env.E2E_TEST_AUTH_SECRET;
if (secret === undefined || secret.length === 0) throw new Error('E2E_TEST_AUTH_SECRET is missing');
const seed = await seedS17BrowserProject({ apiOrigin, editorOrigin, testAuthSecret: secret });
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
	browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
	const separator = seed.session.cookie.indexOf('=');
	await context.addCookies([{ name: seed.session.cookie.slice(0, separator), value: seed.session.cookie.slice(separator + 1), url: editorOrigin, httpOnly: true, sameSite: 'Lax' }]);
	const page = await context.newPage();
	page.on('pageerror', (error) => console.log('pageerror', error.message));
	page.on('console', (message) => { if (message.type() === 'error') console.log('console-error', message.text()); });
	await page.goto(`${editorOrigin}/project/${seed.projectId}/spatial`, { waitUntil: 'domcontentloaded', timeout: 60000 });
	await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
	await page.waitForTimeout(5000);
	const gotIt = page.getByRole('button', { name: 'Got it' });
	if (await gotIt.count()) await gotIt.click();
	await page.locator('button[data-drafting-reading="3d"]').click();
	await page.waitForTimeout(1500);
	const geometry = await page.evaluate(() => ({
		canvas: document.querySelector('canvas')?.getBoundingClientRect().toJSON(),
		overlay: document.querySelector('svg.overlay')?.getBoundingClientRect().toJSON(),
		body: document.body.innerText.slice(-800),
		marks: Array.from(document.querySelectorAll('[data-mark-id]')).map((node) => ({ id: node.getAttribute('data-mark-id'), title: node.querySelector('title')?.textContent }))
	}));
	await page.screenshot({ path: '/tmp/s17-3d-debug.png' });
	console.log(JSON.stringify({ geometry, url: page.url() }));
	await context.close();
} finally {
	if (browser !== null) await browser.close();
	await seed.cleanup();
}
