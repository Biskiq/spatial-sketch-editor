import { expect, test } from '@playwright/test';

test('serves the real SVG favicon from the built app', async ({ page, request }) => {
	const response = await request.get('/favicon.svg');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type'] ?? '').toContain('image/svg+xml');
	const body = await response.body();
	expect(body.length).toBeGreaterThan(0);
	expect(body.toString('utf8')).toContain('<svg');

	await page.goto('/');
	const href = await page.locator('link[rel="icon"]').getAttribute('href');
	expect(href).not.toBeNull();
	expect(new URL(href!, page.url()).pathname).toBe('/favicon.svg');
});
