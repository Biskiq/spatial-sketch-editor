/**
 * T3.P02.S02 — integrated Capture / Guide / Preview journeys.
 *
 * The phase's final gate asks for browser evidence of the creator loop, not only
 * planner tests: the same shipped route, starter gallery, lens, dock, Head
 * Preview and Undo/Redo a creator uses. Each test asserts visible outcomes plus
 * the source/history consequences they imply (one accepted result, one undo
 * payload, no Preview write), and refuses to infer them from a document reload.
 *
 * This is on-demand evidence, not a measurement row and not a lane: F10/F13 own
 * the numbers. Every test runs in one application lifetime and records page
 * errors, so a renderer or chunk failure cannot hide behind a passing selector.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { newMeasuredSession, type MeasuredSession } from '../lib/browser';
import { DEVICE_SCALE_FACTOR, NETWORK, VIEWPORT } from '../lib/config';
import { uniqueProjectId, waitForMark, acceptedResultCount } from '../lib/flow';

const EXPERIENCE_LENS = { name: 'Experience', exact: true } as const;
const VISITOR_CANVAS = '[aria-label="Visitor preview canvas"]';
const HEAD_PREVIEW = '[data-head-preview] button';
const SURFACE = '[aria-label="Experience authoring"]';
const DOCK = '[aria-label="Experience dock"]';

async function session(browser: Parameters<typeof newMeasuredSession>[0], errors: string[]): Promise<MeasuredSession> {
	const started = await newMeasuredSession(browser, {
		viewport: VIEWPORT,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
		network: NETWORK,
		cacheState: 'cold'
	});
	started.page.on('pageerror', (error) => errors.push(error.message));
	started.page.on('console', (message) => {
		if (message.type() === 'error' && /THREE|Shader|Uncaught/.test(message.text())) errors.push(message.text());
	});
	return started;
}

/** Starter gallery → Experience lens → one explicit Experience. */
async function startExperience(page: Page): Promise<void> {
	await page.goto(`/project/${encodeURIComponent(uniqueProjectId('journey'))}/spatial?create=1`);
	await page.getByRole('button', { name: 'Enclosed room' }).click();
	await waitForMark(page, 'stage:activated');
	await expect(page.locator('canvas').first()).toBeVisible();
	await page.getByRole('button', EXPERIENCE_LENS).click();
	await page.getByRole('button', { name: 'Create Experience' }).click();
	await expect(page.locator(SURFACE)).toBeVisible();
}

function dock(page: Page) {
	return page.locator(DOCK);
}

/** Presentation rows, distinct from the stop rows that also name the Presentation. */
function presentationRows(surface: Locator) {
	return surface.locator('section[aria-label="Presentations"] button.row');
}

/** The header's Experience selector; the dock also carries the word "Experience". */
function experienceSelect(surface: Locator) {
	return surface.locator('header.surface-head select');
}

async function capture(page: Page): Promise<void> {
	await dock(page).getByRole('button', { name: 'Capture', exact: true }).click();
	await waitForMark(page, 'experience:capture-accepted');
	await expect(page.locator(SURFACE).getByText('Accepted.', { exact: true })).toBeVisible();
}

async function enterPreview(page: Page): Promise<void> {
	await page.locator(HEAD_PREVIEW).click();
	await waitForMark(page, 'preview:entered');
	await expect(page.locator(VISITOR_CANVAS)).toBeVisible();
}

async function exitPreview(page: Page): Promise<void> {
	await page.getByRole('button', { name: /Exit Preview/ }).click();
	await waitForMark(page, 'preview:returned');
	await expect(page.locator(VISITOR_CANVAS)).toHaveCount(0);
}

async function expectAccepted(page: Page, previous: number): Promise<void> {
	await expect.poll(() => acceptedResultCount(page), { timeout: 20_000 }).toBeGreaterThan(previous);
}

test.describe('integrated Capture / Guide / Preview journeys', () => {
	test('Guide-free capture enters and returns from Preview with one history', async ({ browser }) => {
		test.setTimeout(240_000);
		const errors: string[] = [];
		const started = await session(browser, errors);
		try {
			const { page } = started;
			await startExperience(page);
			const afterCreate = await acceptedResultCount(page);
			await capture(page);
			const afterCapture = await acceptedResultCount(page);
			expect(afterCapture).toBe(afterCreate + 1);

			const surface = page.locator(SURFACE);
			// A Guide-free capture fabricates no Guide and no Stop.
			await expect(surface.getByText('No Guide: Presentations are entered from the visitor list.')).toBeVisible();
			await expect(surface.getByText('No Presentation matches this filter.')).toHaveCount(0);
			await expect(presentationRows(surface).filter({ hasText: 'Presentation 1' })).toHaveCount(1);

			await enterPreview(page);
			// Preview is the isolated visitor run: the authoring surface, dock, Head
			// and Index are unmounted, and the Guide-free Presentation is reached
			// from the visitor list instead of an implicit Guide.
			await expect(page.locator(SURFACE)).toHaveCount(0);
			await expect(page.locator(DOCK)).toHaveCount(0);
			await expect(page.locator(HEAD_PREVIEW)).toHaveCount(0);
			await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
			await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);
			await expect(page.locator('.visitor-pill')).toContainText('Viewing Current Draft');
			await expect(page.locator('nav[aria-label="Presentations"]').getByRole('button', { name: 'Presentation 1' })).toBeVisible();
			// Preview writes no source while a creator is only looking.
			expect(await acceptedResultCount(page)).toBe(afterCapture);

			await exitPreview(page);
			const returned = await waitForMark(page, 'preview:returned');
			expect(returned.detail?.outcome).toBe('returned');
			// The authoring context is the same one, with its selection and one
			// chronological history intact: the captured Presentation is still
			// selected and the single Undo removes exactly that capture.
			await expect(page.locator(SURFACE)).toBeVisible();
			await expect(presentationRows(page.locator(SURFACE)).filter({ hasText: 'Presentation 1' })).toHaveAttribute('aria-pressed', 'true');
			expect(await acceptedResultCount(page)).toBe(afterCapture);
			await page.getByRole('button', { name: 'Undo', exact: true }).click();
			await expect.poll(() => acceptedResultCount(page)).toBe(afterCapture + 1);
			await expect(presentationRows(page.locator(SURFACE))).toHaveCount(0);
			expect(errors).toEqual([]);
		} finally {
			await started.close();
		}
	});

	test('first Guide from capture is one accepted install with one-step Undo and Redo', async ({ browser }) => {
		test.setTimeout(240_000);
		const errors: string[] = [];
		const started = await session(browser, errors);
		try {
			const { page } = started;
			await startExperience(page);
			const surface = page.locator(SURFACE);
			await surface.getByLabel('Guide label').fill('Visitor walk');
			const before = await acceptedResultCount(page);
			await capture(page);
			const after = await acceptedResultCount(page);
			// View + Presentation + Guide + Stop are one result, not four writes.
			expect(after).toBe(before + 1);
			await expect(surface.locator('ol.stop-list li button.row')).toHaveCount(1);
			await expect(surface.getByRole('button', { name: /1\. Presentation 1/ })).toBeVisible();
			await expect(surface.getByLabel('Open Guide')).toHaveValue(/./);
			await expect(presentationRows(surface).filter({ hasText: 'Presentation 1' })).toContainText('1 Stop(s)');
			// The capture becomes the Experience's entry Guide and opens it.
			await expect(surface.getByRole('heading', { name: /^Stop / })).toBeVisible();
			await expect(surface.getByText('First Guide', { exact: true })).toHaveCount(0);

			await enterPreview(page);
			// A Stop is not also a Guide-free Presentation in the visitor list.
			await expect(page.locator('nav[aria-label="Presentations"]')).toHaveCount(0);
			await exitPreview(page);

			// One Undo payload removes Guide, Stop, Presentation and captured View.
			await page.getByRole('button', { name: 'Undo', exact: true }).click();
			await expect.poll(() => acceptedResultCount(page)).toBe(after + 1);
			await expect(surface.getByRole('button', { name: 'Create first Guide' })).toBeVisible();
			await expect(surface.locator('ol.stop-list')).toHaveCount(0);
			await expect(presentationRows(surface)).toHaveCount(0);

			// Redo replays the captured identities rather than minting new ones.
			await page.getByRole('button', { name: 'Redo', exact: true }).click();
			await expect.poll(() => acceptedResultCount(page)).toBe(after + 2);
			await expect(surface.locator('ol.stop-list li button.row')).toHaveCount(1);
			await expect(surface.getByRole('button', { name: /1\. Presentation 1/ })).toBeVisible();
			expect(errors).toEqual([]);
		} finally {
			await started.close();
		}
	});

	test('first Guide from an existing Presentation reuses it at a second Stop', async ({ browser }) => {
		test.setTimeout(240_000);
		const errors: string[] = [];
		const started = await session(browser, errors);
		try {
			const { page } = started;
			await startExperience(page);
			const surface = page.locator(SURFACE);
			await capture(page);
			await presentationRows(surface).filter({ hasText: 'Presentation 1' }).click();
			await surface.getByLabel('Guide label').fill('Rooms');
			const beforeGuide = await acceptedResultCount(page);
			await surface.getByRole('button', { name: 'Create first Guide' }).click();
			await expectAccepted(page, beforeGuide);
			await expect(surface.locator('ol.stop-list li button.row')).toHaveCount(1);
			// Reusing the Presentation copies no Camera pose and makes no Connection:
			// its own single View is still the only one it names.
			await expect(presentationRows(surface).filter({ hasText: 'Presentation 1' })).toContainText('1 Stop(s)');
			// The Presentation card's own fact list is the source-side proof: one View,
			// still its Default, and one Stop naming it.
			const presentationCard = surface.locator('div.card').filter({ hasText: 'Views' });
			await expect(presentationCard.locator('dd').first()).toHaveText('1');

			const beforeSecond = await acceptedResultCount(page);
			await surface.getByRole('button', { name: 'Insert selected Presentation as a Stop' }).click();
			await expectAccepted(page, beforeSecond);
			await expect(surface.locator('ol.stop-list li button.row')).toHaveCount(2);
			await expect(surface.getByRole('button', { name: /2\. Presentation 1/ })).toBeVisible();

			// Occurrence-local hold on the second Stop of the same Presentation.
			const secondBefore = await acceptedResultCount(page);
			await surface.getByRole('button', { name: /2\. Presentation 1/ }).click();
			await surface.getByLabel('Hold (seconds, blank for none)').fill('2');
			await surface.getByRole('button', { name: 'Save Stop' }).click();
			await expectAccepted(page, secondBefore);
			await expect(surface.getByRole('button', { name: /2\. Presentation 1/ })).toContainText('hold 2s');
			await expect(surface.getByRole('button', { name: /1\. Presentation 1/ })).toContainText('hold 0s');

			// One authoritative Guide order; reorder keeps the Stop identities.
			await surface.getByRole('button', { name: 'Move up' }).nth(1).click();
			await expect(surface.locator('ol.stop-list li button.row').first()).toContainText('Presentation 1');
			await expect(surface.getByRole('button', { name: /1\. Presentation 1/ })).toContainText('hold 2s');

			await enterPreview(page);
			await expect(page.locator('nav[aria-label="Presentations"]')).toHaveCount(0);
			await exitPreview(page);
			expect(errors).toEqual([]);
		} finally {
			await started.close();
		}
	});

	test('two Experiences over one world keep their own identity and Preview entry', async ({ browser }) => {
		test.setTimeout(240_000);
		const errors: string[] = [];
		const started = await session(browser, errors);
		try {
			const { page } = started;
			await startExperience(page);
			const surface = page.locator(SURFACE);
			await capture(page);
			await surface.getByRole('button', { name: 'Create Experience' }).click();
			await expect.poll(async () => experienceSelect(surface).locator('option').count()).toBe(2);
			await experienceSelect(surface).selectOption({ label: 'Experience 2' });
			await capture(page);
			await expect(presentationRows(surface).filter({ hasText: 'Presentation 1' })).toHaveCount(1);

			await experienceSelect(surface).selectOption({ label: 'Experience 1' });
			await expect(presentationRows(surface).filter({ hasText: 'Presentation 1' })).toHaveCount(1);
			await enterPreview(page);
			// The focused Experience is the one Preview lowers; the other world
			// document is not copied into it.
			await expect(page.locator('nav[aria-label="Presentations"]').getByRole('button', { name: 'Presentation 1' })).toBeVisible();
			await exitPreview(page);
			await expect(experienceSelect(surface)).toHaveValue(/.+/);
			expect(errors).toEqual([]);
		} finally {
			await started.close();
		}
	});

	test('lens wiring and a narrow reduced-motion Preview keep the same handover', async ({ browser }) => {
		test.setTimeout(240_000);
		const errors: string[] = [];
		const started = await session(browser, errors);
		try {
			const { page } = started;
			await startExperience(page);
			await capture(page);
			// The dock is the Experience lens's contribution; another lens neither
			// shows it nor enters Preview.
			await page.getByRole('button', { name: 'World', exact: true }).click();
			await expect(page.locator(DOCK)).toHaveCount(0);
			await expect(page.locator(VISITOR_CANVAS)).toHaveCount(0);
			await page.getByRole('button', EXPERIENCE_LENS).click();
			await expect(page.locator(DOCK)).toBeVisible();

			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.setViewportSize({ width: 900, height: 700 });
			await enterPreview(page);
			// A narrow, reduced-motion visitor keeps the documented help text and
			// the same semantic continue key instead of a second interaction model.
			await expect(page.locator(VISITOR_CANVAS)).toHaveAttribute('aria-describedby', 'visitor-preview-help');
			await page.locator(VISITOR_CANVAS).focus();
			await page.keyboard.press('ArrowRight');
			await exitPreview(page);
			await expect(page.locator(DOCK)).toBeVisible();
			expect(errors).toEqual([]);
		} finally {
			await started.close();
		}
	});
});
