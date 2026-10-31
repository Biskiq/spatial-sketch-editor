/**
 * R217.S17A — Objects acceptance, from a genuinely empty project.
 *
 * Real pointer input on the shipped Stage. No Room or compiled floor exists at any
 * point; the Room-floor precedence is proved by the planner tests.
 *
 * Run through the T1 supervisor:
 *   T1_S02_QA_SPEC=perf/flows/s17a-objects-acceptance.spec.ts \
 *     npx vite-node --script perf/run-t1-s02-browser-qa.mjs
 */
import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TEST_AUTH_SESSION_COOKIE, loginAs } from '../../tests/e2e/test-auth';
import { newMeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT } from '../lib/config';
import { acceptedResultCount, uniqueProjectId, waitForCameraSettled } from '../lib/flow';

const apiOrigin = process.env.PERF_API_ORIGIN!;
const editorOrigin = process.env.PERF_BASE_URL!;
const resultsDir = process.env.PERF_RESULTS_DIR!;
const STAGE = '[role="application"][aria-label="Spatial stage"]';
const DOCK = '[data-stage-dock]';
const VIEWPORTS = [[1440, 900], [1280, 800], [1180, 820], [820, 1180]] as const;

type Entity = { kind: string; name: string; position: number[]; form?: { generator: { outline: { u: number; v: number; smooth: boolean }[]; extent: number } }; primitive?: string };

async function source(page: Page) {
	const menu = page.getByLabel('Application menu');
	await menu.click();
	const button = page.getByRole('button', { name: 'Download source JSON', exact: true });
	await expect(button).toBeEnabled({ timeout: 20_000 });
	const [file] = await Promise.all([page.waitForEvent('download'), button.click()]);
	if (await button.isVisible()) await menu.click();
	const path = await file.path();
	return JSON.parse(await readFile(path!, 'utf8'));
}
async function entities(page: Page): Promise<Entity[]> {
	return (await source(page)).units.scene.data.entities;
}
async function centre(page: Page, dx = 0, dy = 0) {
	const box = (await page.locator(STAGE).boundingBox())!;
	return { x: box.x + box.width / 2 + dx, y: box.y + box.height * 0.42 + dy };
}
async function accepted(page: Page, before: number) {
	await expect.poll(() => acceptedResultCount(page), { timeout: 30_000 }).toBeGreaterThan(before);
}
async function setStageReading(page: Page, reading: 'Plan' | '3D') {
	await page.getByRole('button', { name: reading === 'Plan' ? '2D' : '3D', exact: true }).click();
	await waitForCameraSettled(page);
}
const tile = (page: Page, name: string) => page.getByRole('group', { name: 'Shapes' }).getByRole('button', { name, exact: true });
async function clickAt(page: Page, dx: number, dy: number) {
	const before = await acceptedResultCount(page);
	const at = await centre(page, dx, dy);
	await page.mouse.move(at.x, at.y);
	await page.mouse.click(at.x, at.y);
	await accepted(page, before);
	await expect(tile(page, 'Box')).toBeVisible({ timeout: 20_000 });
}
async function drag(page: Page, from: [number, number], to: [number, number]) {
	const a = await centre(page, ...from);
	const b = await centre(page, ...to);
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move(b.x, b.y, { steps: 12 });
}
async function openObjects(page: Page) {
	await page.locator(`${DOCK} [data-dock-slot="library"]`).click();
	await expect(tile(page, 'Box')).toBeVisible({ timeout: 20_000 });
}

test.describe('S17A Objects', () => {
	test('creates every object kind on the datum of an empty project', async ({ browser }) => {
		test.setTimeout(600_000);
		const login = await loginAs({ user: 'agent-admin', apiOrigin, secret: process.env.E2E_TEST_AUTH_SECRET!, origin: editorOrigin });
		const { page, context } = await newMeasuredSession(browser, { viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, network: NETWORK, cacheState: 'cold' });
		const equals = login.cookie.indexOf('=');
		expect(login.cookie.slice(0, equals)).toBe(TEST_AUTH_SESSION_COOKIE);
		await context.addCookies([{ name: login.cookie.slice(0, equals), value: login.cookie.slice(equals + 1), url: editorOrigin }]);
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => { if (message.type() === 'error' && /THREE|Shader|Uncaught/.test(message.text())) errors.push(message.text()); });
		const shot = (name: string) => page.screenshot({ path: resolve(resultsDir, `s17a-${name}.png`) });

		await page.goto(`/project/${encodeURIComponent(uniqueProjectId('s17a'))}/spatial?create=1`);
		await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
		expect((await source(page)).units.layout.data.rooms).toHaveLength(0);

		// One panel, one entry per object, no selector, no floor warning.
		await expect(page.locator(`${DOCK} [data-dock-slot="library"]`)).toHaveAttribute('aria-label', 'Objects');
		await openObjects(page);
		await expect(page.locator('select[aria-label="Place object"]')).toHaveCount(0);
		await expect(page.getByText('No Room floor')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Models' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Import model…' })).toBeVisible();
		await shot('panel-empty-project');

		for (const reading of ['Plan', '3D'] as const) {
			await setStageReading(page, reading);
			await waitForCameraSettled(page);
			const offset = reading === 'Plan' ? -120 : -440;

			// Box: click, then drag with a live preview, in this reading.
			await tile(page, 'Box').click();
			await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
			const count = (await entities(page)).length;
			await clickAt(page, offset, -100);
			const clicked = (await entities(page)).at(-1)!;
			expect(clicked.kind).toBe('form');
			expect(clicked.position[1]).toBe(0);
			expect(clicked.form!.generator.extent).toBe(1);
			expect(await entities(page)).toHaveLength(count + 1);

			await drag(page, [offset, 30], [offset + 80, 80]);
			await shot(`box-drag-${reading}`);
			const before = await acceptedResultCount(page);
			await page.mouse.up();
			await accepted(page, before);
			await expect(tile(page, 'Box')).toBeVisible({ timeout: 20_000 });
			expect((await entities(page)).at(-1)!.kind).toBe('form');

			// Round, one Undo restores exactly.
			await tile(page, 'Round').click();
			const round = await entities(page);
			await clickAt(page, offset + 170, -100);
			await page.getByRole('button', { name: 'Undo', exact: true }).click();
			await expect.poll(async () => (await entities(page)).length, { timeout: 20_000 }).toBe(round.length);
			await page.getByRole('button', { name: 'Redo', exact: true }).click();
			await expect.poll(async () => (await entities(page)).length, { timeout: 20_000 }).toBe(round.length + 1);

			// Free: three corners, closed on the start.
			await tile(page, 'Free').click();
			const free = await entities(page);
			for (const point of [[offset + 170, 20], [offset + 240, 20], [offset + 210, 90]] as const) {
				const at = await centre(page, ...point);
				await page.mouse.click(at.x, at.y);
			}
			await shot(`free-draft-${reading}`);
			const closing = await acceptedResultCount(page);
			const start = await centre(page, offset + 170, 20);
			await page.mouse.click(start.x, start.y);
			await accepted(page, closing);
			await expect.poll(async () => (await entities(page)).length, { timeout: 20_000 }).toBe(free.length + 1);

			// Esc clears a Free draft and leaves no trace; the tool stays armed.
			await tile(page, 'Free').waitFor();
			const draft = await centre(page, offset, 170);
			await page.mouse.click(draft.x, draft.y);
			await page.keyboard.press('Escape');
			await expect(tile(page, 'Free')).toBeVisible();
			expect(await entities(page)).toHaveLength(free.length + 1);
		}

		// Sphere places through the same panel, on the datum. Models that this project
		// cannot hold are not offered; the approved-model leg is in the S03 acceptance flow.
		await setStageReading(page, 'Plan');
		await tile(page, 'Sphere').click();
		await clickAt(page, 300, -200);
		const sphere = (await entities(page)).at(-1)!;
		expect(sphere.kind).not.toBe('form');
		await clickAt(page, 300, -60);
		expect((await entities(page)).at(-1)!.primitive ?? (await entities(page)).at(-1)!.name).toBe(sphere.primitive ?? sphere.name);
		// Exact position, on the datum.
		await tile(page, 'Box').click();
		await page.getByRole('button', { name: 'All', exact: true }).click();
		const exact = page.getByRole('group', { name: 'Exact position' });
		await exact.getByLabel('X (m)').fill('12');
		await exact.getByLabel('Z (m)').fill('-7');
		const typed = await acceptedResultCount(page);
		await exact.getByRole('button', { name: 'Place' }).click();
		await accepted(page, typed);
		const placed = (await entities(page)).at(-1)!;
		expect(placed.position).toEqual([12, 0, -7]);

		// Coverage of the compact row at every acceptance size.
		await expect(tile(page, 'Box')).toBeVisible({ timeout: 20_000 });
		for (const [width, height] of VIEWPORTS) {
			await page.setViewportSize({ width, height });
			await shot(`compact-${width}x${height}`);
			const stage = (await page.locator(STAGE).boundingBox())!;
			const row = (await page.getByRole('group', { name: 'Shapes' }).boundingBox())!;
			expect(row.height, `compact row at ${width}x${height}`).toBeLessThan(stage.height * 0.2);
		}
		expect(errors).toEqual([]);
	});
});
